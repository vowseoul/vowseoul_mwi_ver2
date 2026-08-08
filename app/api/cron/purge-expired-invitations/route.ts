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

  const now = new Date()
  const purgedIds: string[] = []

  for (const inv of invitations ?? []) {
    const customer = Array.isArray(inv.customers) ? inv.customers[0] : inv.customers
    const raw = mergeInvitationRaw(inv as Record<string, unknown>, customer as Record<string, unknown> | null)
    const weddingDate = typeof raw.wedding_date === "string" ? raw.wedding_date : null
    if (!weddingDate) continue // 예식일 미입력 상태면 만료 판단 불가 — 건드리지 않는다

    const expiry = computeExpiryDate(weddingDate, daysAfterWedding)
    if (Number.isNaN(expiry.getTime()) || expiry >= now) continue

    purgedIds.push(inv.id as string)
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

  return NextResponse.json({ ok: true, checked: invitations?.length ?? 0, purged: purgedIds.length, purgedIds })
}
