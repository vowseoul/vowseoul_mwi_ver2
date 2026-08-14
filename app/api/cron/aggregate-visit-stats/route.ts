import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { notifyCronFailure } from "@/lib/cron-alert"

/**
 * visit_logs(방문 1건당 1행)를 하루 단위로 집계해 visit_daily_stats에 저장한다.
 *
 * 이 집계 없이는 신랑신부 대시보드·관리자 통계가 인기 청첩장의 visit_logs
 * 원본 전체를 매번 훑어야 해서, 방문이 쌓일수록 점점 느려진다(§FEATURE_ROADMAP.md
 * A6). 원본은 예식일 +14일 파기 정책(§app/invitation/[id]/dashboard/page.tsx)에
 * 이미 걸려 있어 무한 증식은 아니지만, 그 며칠 사이에도 인기 청첩장은 수천 행이
 * 쌓일 수 있다.
 *
 * "어제" 하루치만 확정 집계한다 — 오늘 데이터는 아직 끝나지 않았으므로 화면에서
 * 원본을 직접 세면 된다(오늘 하루치는 많아야 수백 행이라 느릴 일이 없다).
 * upsert라 하루 늦게 돌거나 재실행돼도 안전하다.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("CRON_SECRET 환경변수가 설정되지 않았습니다.")
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    return await runAggregate()
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    await notifyCronFailure("aggregate-visit-stats", `예외 발생: ${detail}`)
    return NextResponse.json({ error: "처리 중 예외가 발생했습니다." }, { status: 500 })
  }
}

async function runAggregate() {
  const admin = createSupabaseAdminClient()

  const now = new Date()
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
  const dayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const visitDate = dayStart.toISOString().slice(0, 10)

  const { data: logs, error } = await admin
    .from("visit_logs")
    .select("invitation_id, ip_hash")
    .gte("visited_at", dayStart.toISOString())
    .lt("visited_at", dayEnd.toISOString())

  if (error) {
    await notifyCronFailure("aggregate-visit-stats", `visit_logs 조회 실패: ${error.message}`)
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 })
  }

  const byInvitation = new Map<string, { total: number; uniques: Set<string> }>()
  for (const log of logs ?? []) {
    const key = String(log.invitation_id)
    const entry = byInvitation.get(key) ?? { total: 0, uniques: new Set<string>() }
    entry.total += 1
    entry.uniques.add(String(log.ip_hash))
    byInvitation.set(key, entry)
  }

  const rows = Array.from(byInvitation.entries()).map(([invitation_id, { total, uniques }]) => ({
    invitation_id,
    visit_date: visitDate,
    total_visits: total,
    unique_visitors: uniques.size,
  }))

  if (rows.length > 0) {
    const { error: upsertError } = await admin
      .from("visit_daily_stats")
      .upsert(rows, { onConflict: "invitation_id,visit_date" })
    if (upsertError) {
      await notifyCronFailure("aggregate-visit-stats", `upsert 실패: ${upsertError.message}`)
      return NextResponse.json({ error: "집계 저장에 실패했습니다." }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, date: visitDate, invitations: rows.length, totalVisits: logs?.length ?? 0 })
}
