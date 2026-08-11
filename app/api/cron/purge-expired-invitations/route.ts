import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { mergeInvitationRaw } from "@/lib/invitation-data"
import { DATA_RETENTION_SETTINGS_KEY, GUEST_DATA_PURGE_DAYS, HARD_DELETE_GRACE_DAYS, computeExpiryDate, parseRetentionSettings } from "@/lib/data-retention"
import { purgeGuestData } from "@/lib/guest-data-purge"
import { deleteInvitationUploads } from "@/lib/storage-cleanup"

/**
 * 데이터 자동 파기 — 하루 한 번 도는 크론이 3단계를 수행한다.
 *
 * 1) 하객 데이터 파기: 예식일 + 14일(GUEST_DATA_PURGE_DAYS) 지난 청첩장의
 *    rsvp_responses/guestbook_entries/visit_logs/visit_daily_stats를 하드 삭제한다.
 *    이전에는 신랑신부가 대시보드에 접속해야만(§app/invitation/[id]/dashboard/page.tsx)
 *    실행됐는데, 아무도 안 들어오면 하객 개인정보가 무기한 남는 문제가 있었다.
 * 2) 청첩장 소프트 삭제: 예식일 + 보관일수(관리자 설정, 기본 30일)가 지난 청첩장을
 *    소프트 삭제한다(deleted_at + status='expired').
 * 3) 하드 삭제 승격: 소프트 삭제된 지 30일(HARD_DELETE_GRACE_DAYS) 더 지난 청첩장을
 *    실제로 DELETE한다 — 오삭제 복구 여지를 남기면서도 결국은 완전히 파기하기 위함.
 *    이 시점에 해당 청첩장이 쓴 업로드 이미지도 Storage에서 지우고, 고객의 마지막
 *    청첩장이었다면 고객(customers) 행도 함께 하드 삭제한다.
 *
 * is_sample=true 인 청첩장(데모/샘플용)은 세 단계 모두에서 항상 제외한다.
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

  // ---------------------------------------------------------------------
  // 1 & 2) 활성 청첩장 순회 — 하객 데이터 파기 판정 + 청첩장 소프트 삭제 판정
  // ---------------------------------------------------------------------
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
  const guestDataPurgedIds: string[] = []
  const soonToExpire: { id: string; daysLeft: number; label: string }[] = []

  for (const inv of invitations ?? []) {
    const customer = Array.isArray(inv.customers) ? inv.customers[0] : inv.customers
    const raw = mergeInvitationRaw(inv as Record<string, unknown>, customer as Record<string, unknown> | null)
    const weddingDate = typeof raw.wedding_date === "string" ? raw.wedding_date : null
    if (!weddingDate) continue // 예식일 미입력 상태면 만료 판단 불가 — 건드리지 않는다

    const wedding = new Date(weddingDate)
    if (!Number.isNaN(wedding.getTime())) {
      const daysSinceWedding = Math.floor((now.getTime() - wedding.getTime()) / (1000 * 60 * 60 * 24))
      if (daysSinceWedding >= GUEST_DATA_PURGE_DAYS) {
        await purgeGuestData(admin, inv.id as string)
        guestDataPurgedIds.push(inv.id as string)
      }
    }

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

  // ---------------------------------------------------------------------
  // 3) 하드 삭제 승격 — 소프트 삭제된 지 HARD_DELETE_GRACE_DAYS 이상 지난 청첩장
  // ---------------------------------------------------------------------
  const hardDeleteCutoff = new Date(now.getTime() - HARD_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000)
  const { data: staleInvitations, error: staleError } = await admin
    .from("invitations")
    .select("id, customer_id, content_data, customization_overrides, og_meta, bgm_url")
    .not("deleted_at", "is", null)
    .lt("deleted_at", hardDeleteCutoff.toISOString())
    .eq("is_sample", false)

  if (staleError) console.error("purge-expired-invitations: 하드삭제 대상 조회 실패:", staleError.message)

  const hardDeletedInvitationIds: string[] = []
  const hardDeletedCustomerIds: string[] = []

  for (const inv of staleInvitations ?? []) {
    // 이 시점엔 하객 데이터가 이미 비어 있을 것이지만, 혹시 놓친 게 있으면 마지막으로 한 번 더.
    await purgeGuestData(admin, inv.id)
    await deleteInvitationUploads(admin, [inv.content_data, inv.customization_overrides, inv.og_meta, inv.bgm_url])

    const { error: deleteError } = await admin.from("invitations").delete().eq("id", inv.id)
    if (deleteError) {
      console.error(`purge-expired-invitations: 청첩장 하드삭제 실패 (${inv.id}):`, deleteError.message)
      continue
    }
    hardDeletedInvitationIds.push(inv.id)

    if (!inv.customer_id) continue
    const { count: remaining } = await admin
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", inv.customer_id)
    if ((remaining ?? 0) > 0) continue

    // 고객의 마지막 청첩장이었다 — 고객이 폼에 올린 이미지까지 정리하고 고객 행 자체를 지운다.
    // (form_instances/form_submissions는 customers FK가 ON DELETE CASCADE라 자동으로 함께 지워진다.)
    const { data: submissions } = await admin
      .from("form_submissions")
      .select("data")
      .eq("customer_id", inv.customer_id)
    if (submissions) {
      await deleteInvitationUploads(admin, submissions.map((s) => s.data))
    }

    const { error: customerDeleteError } = await admin.from("customers").delete().eq("id", inv.customer_id)
    if (customerDeleteError) {
      console.error(`purge-expired-invitations: 고객 하드삭제 실패 (${inv.customer_id}):`, customerDeleteError.message)
      continue
    }
    hardDeletedCustomerIds.push(inv.customer_id)
  }

  return NextResponse.json({
    ok: true,
    checked: invitations?.length ?? 0,
    guestDataPurged: guestDataPurgedIds.length,
    purged: purgedIds.length,
    purgedIds,
    warned: soonToExpire.length,
    hardDeleted: hardDeletedInvitationIds.length,
    customersDeleted: hardDeletedCustomerIds.length,
  })
}
