import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { dashboardCookieName, verifyDashboardToken } from "@/lib/dashboard-session"
import { logAuditEvent } from "@/lib/audit-log"
import { coupleLabel } from "@/lib/telegram"
import { notifyStaff } from "@/lib/notify-staff"

/**
 * 시안 검수 화면(/invitation/[id]/review)의 수정 요청 제출 · 확정.
 *
 * 신랑신부는 Supabase 계정이 없는 익명 사용자라, 기존 대시보드와 동일하게
 * 비밀번호 인증으로 발급된 서명 쿠키로 권한을 판정하고(§lib/dashboard-session.ts),
 * 실제 쓰기는 service_role로 대신한다(§app/api/dashboard-data/route.ts와 동일 패턴).
 */

type Action =
  | { action: "addRevision"; invitationId: string; blockKey: string | null; note: string }
  | { action: "approve"; invitationId: string }

async function assertAuthorized(invitationId: string): Promise<boolean> {
  const jar = await cookies()
  return verifyDashboardToken(jar.get(dashboardCookieName(invitationId))?.value, invitationId)
}

/**
 * 알림에 쓸 신랑·신부 표시명과, 담당자를 가릴 customerId.
 *
 * 표시명은 고객이 폼에서 입력한 content_data 를 우선하고, 비어 있으면
 * customers 행(관리자가 등록한 값)으로 폴백한다.
 *
 * customerId 를 함께 돌려주는 이유는 여기서 이미 invitations 를 읽기 때문이다 —
 * 담당자를 찾겠다고 같은 행을 한 번 더 조회할 이유가 없다.
 */
async function resolveCouple(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  invitationId: string
): Promise<{ label: string; customerId: string | null }> {
  const { data: inv } = await supabase
    .from("invitations")
    .select("content_data, customer_id")
    .eq("id", invitationId)
    .maybeSingle()

  const content = (inv?.content_data && typeof inv.content_data === "object"
    ? inv.content_data
    : {}) as Record<string, unknown>
  let groom = typeof content.groom_name === "string" ? content.groom_name : ""
  let bride = typeof content.bride_name === "string" ? content.bride_name : ""

  if ((!groom || !bride) && inv?.customer_id) {
    const { data: customer } = await supabase
      .from("customers")
      .select("groom_name, bride_name")
      .eq("id", inv.customer_id)
      .maybeSingle()
    groom = groom || customer?.groom_name || ""
    bride = bride || customer?.bride_name || ""
  }
  return { label: coupleLabel(groom, bride), customerId: inv?.customer_id ?? null }
}

export async function POST(request: Request) {
  let body: Action
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const { invitationId } = body
  if (typeof invitationId !== "string" || !invitationId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }
  if (!(await assertAuthorized(invitationId))) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
  }

  const supabase = createSupabaseAdminClient()

  if (body.action === "addRevision") {
    const note = body.note?.trim()
    if (!note) return NextResponse.json({ error: "요청 내용을 입력해주세요." }, { status: 400 })

    const { data: invitation, error: invError } = await supabase
      .from("invitations")
      .select("review_round")
      .eq("id", invitationId)
      .is("deleted_at", null)
      .maybeSingle()
    if (invError || !invitation) {
      return NextResponse.json({ error: "청첩장을 찾을 수 없습니다." }, { status: 404 })
    }

    const { data: revision, error: insertError } = await supabase
      .from("invitation_revisions")
      .insert({
        invitation_id: invitationId,
        round: Math.max(1, invitation.review_round),
        block_key: body.blockKey,
        note,
      })
      .select()
      .single()
    if (insertError) {
      console.error("review-submit addRevision failed:", insertError.message)
      return NextResponse.json({ error: "요청을 저장하지 못했습니다." }, { status: 500 })
    }

    const { error: updateError } = await supabase
      .from("invitations")
      .update({ review_status: "changes_requested" })
      .eq("id", invitationId)
    if (updateError) console.error("review-submit status update failed:", updateError.message)

    await logAuditEvent(supabase, {
      invitationId,
      actorType: "customer",
      action: "revision.requested",
      summary: `신랑신부가 수정 요청을 남겼습니다: "${note.slice(0, 60)}${note.length > 60 ? "…" : ""}"`,
    })

    // 텔레그램 알림 — 수정 요청은 관리자가 바로 반영해야 하는 작업이라 즉시 통보한다.
    // 링크는 요청 URL 의 origin 을 그대로 써서 배포 도메인을 따로 설정하지 않아도 동작한다.
    const revised = await resolveCouple(supabase, invitationId)
    const revisedUrl = `${new URL(request.url).origin}/admin/invitations/editor/${invitationId}`
    const excerpt = `${note.slice(0, 100)}${note.length > 100 ? "…" : ""}`
    await notifyStaff(supabase, {
      kind: "review_revision",
      customerId: revised.customerId,
      telegramText: `✏️ ${revised.label}님이 청첩장 검수 피드백을 남기셨습니다.\n"${excerpt}"\n${revisedUrl}`,
      push: { title: "수정 요청 도착", body: `${revised.label}님: ${excerpt}`, url: revisedUrl },
    })

    return NextResponse.json({ ok: true, revision })
  }

  if (body.action === "approve") {
    const { error } = await supabase
      .from("invitations")
      .update({ review_status: "approved" })
      .eq("id", invitationId)
    if (error) {
      console.error("review-submit approve failed:", error.message)
      return NextResponse.json({ error: "처리하지 못했습니다." }, { status: 500 })
    }

    await logAuditEvent(supabase, {
      invitationId,
      actorType: "customer",
      action: "review.approved",
      summary: "신랑신부가 시안을 확정했습니다.",
    })

    const approved = await resolveCouple(supabase, invitationId)
    const approvedUrl = `${new URL(request.url).origin}/admin/invitations/editor/${invitationId}`
    await notifyStaff(supabase, {
      kind: "review_approved",
      customerId: approved.customerId,
      telegramText: `✅ ${approved.label}님이 청첩장 검수를 완료(확정)하셨습니다.\n${approvedUrl}`,
      push: { title: "시안 확정", body: `${approved.label}님이 청첩장을 확정했습니다.`, url: approvedUrl },
    })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "알 수 없는 작업입니다." }, { status: 400 })
}
