import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { mergeInvitationRaw } from "@/lib/invitation-data"
import { DATA_RETENTION_SETTINGS_KEY, computeExpiryDate, parseRetentionSettings } from "@/lib/data-retention"

/**
 * 데이터 자동 파기 — 예식일 + 보관일수(관리자 설정, 기본 30일)가 지난 청첩장을
 * 소프트 삭제한다 (deleted_at + status='expired' — useDeleteInvitationMutation 의
 * 소프트 삭제 폴백과 동일한 규칙이라 관리자 화면에서 "삭제된 것처럼" 자연히 사라진다).
 *
 * is_sample=true 인 청첩장(데모/샘플용)은 예식일과 무관하게 항상 제외한다.
 *
 * Vercel Cron 등 외부 스케줄러가 주기적으로 호출한다 (vercel.json). CRON_SECRET 이
 * 설정되어 있지 않으면 무조건 거부한다 — 잘못 노출되면 대량 삭제 엔드포인트가 되므로
 * "설정 안 되어 있으면 열어준다" 쪽으로는 절대 fail-open 하지 않는다.
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

  const admin = createSupabaseAdminClient()

  const { data: retentionRow } = await admin
    .from("settings")
    .select("value")
    .eq("key", DATA_RETENTION_SETTINGS_KEY)
    .maybeSingle()
  const { daysAfterWedding } = parseRetentionSettings(retentionRow?.value)

  const { data: invitations, error } = await admin
    .from("invitations")
    .select("id, content_data, customer_id, customers(wedding_date)")
    .is("deleted_at", null)
    .eq("is_sample", false)

  if (error) {
    console.error("purge-expired-invitations: invitations 조회 실패:", error.message)
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 })
  }

  const EXPIRY_WARNING_DAYS = 3
  const now = new Date()
  const purgedIds: string[] = []
  const soonToExpire: { id: string; daysLeft: number; label: string }[] = []

  for (const inv of invitations ?? []) {
    const customer = Array.isArray(inv.customers) ? inv.customers[0] : inv.customers
    const raw = mergeInvitationRaw(inv as Record<string, unknown>, customer as Record<string, unknown> | null)
    const weddingDate = typeof raw.wedding_date === "string" ? raw.wedding_date : null
    if (!weddingDate) continue // 예식일 미입력 상태면 만료 판단 불가 — 건드리지 않는다

    const expiry = computeExpiryDate(weddingDate, daysAfterWedding)
    if (Number.isNaN(expiry.getTime())) continue

    if (expiry < now) {
      purgedIds.push(inv.id as string)
      continue
    }

    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= EXPIRY_WARNING_DAYS) {
      const label = [raw.groom_name, raw.bride_name].filter(Boolean).join(" ♥ ") || "청첩장"
      soonToExpire.push({ id: inv.id as string, daysLeft, label })
    }
  }

  if (purgedIds.length > 0) {
    const { error: updateError } = await admin
      .from("invitations")
      .update({ deleted_at: now.toISOString(), status: "expired" })
      .in("id", purgedIds)
    if (updateError) {
      console.error("purge-expired-invitations: 소프트 삭제 실패:", updateError.message)
      return NextResponse.json({ error: "삭제 처리에 실패했습니다." }, { status: 500 })
    }
  }

  // 만료 임박 알림 — 한 청첩장당 딱 한 번만 보낸다. 크론이 매일 도는데 dedup이 없으면
  // 3일 내내 같은 알림이 반복 삽입된다. 이미 이 청첩장으로 보낸 적이 있는지는
  // link_to 값으로 판별한다(청첩장 하나가 만료 경고 대상이 되는 건 보관정책상 일생에 한 번뿐).
  if (soonToExpire.length > 0) {
    const { data: existingWarnings } = await admin
      .from("notifications")
      .select("link_to")
      .eq("type", "link_expiring")
    const alreadyWarned = new Set((existingWarnings ?? []).map((w) => w.link_to))

    const toNotify = soonToExpire.filter((s) => !alreadyWarned.has(`/admin/invitations/editor/${s.id}`))
    if (toNotify.length > 0) {
      const { error: notifyError } = await admin.from("notifications").insert(
        toNotify.map((s) => ({
          type: "link_expiring",
          title: "청첩장 만료 임박",
          message: `${s.label} — ${s.daysLeft}일 후 보관 정책에 따라 자동 삭제됩니다.`,
          link_to: `/admin/invitations/editor/${s.id}`,
        }))
      )
      if (notifyError) console.error("purge-expired-invitations: 만료 임박 알림 삽입 실패:", notifyError.message)
    }
  }

  return NextResponse.json({
    ok: true,
    checked: invitations?.length ?? 0,
    purged: purgedIds.length,
    purgedIds,
    warned: soonToExpire.length,
  })
}
