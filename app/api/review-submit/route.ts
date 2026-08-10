import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { dashboardCookieName, verifyDashboardToken } from "@/lib/dashboard-session"

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
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "알 수 없는 작업입니다." }, { status: 400 })
}
