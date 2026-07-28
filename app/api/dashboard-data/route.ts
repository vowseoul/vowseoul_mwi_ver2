import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { dashboardCookieName, verifyDashboardToken } from "@/lib/dashboard-session"

/**
 * 신랑신부 대시보드의 수집 데이터 변경(방명록 노출 전환 / 단일 삭제).
 *
 * 하객 데이터는 anon 키로 읽고 쓸 수 없도록 RLS 를 조일 것이므로, 브라우저에서
 * 직접 supabase.from(...).delete() 하던 것을 전부 이 라우트로 옮겼다. 권한 판정은
 * Supabase 세션이 아니라 비밀번호 인증으로 발급된 서명 쿠키로 한다 — 신랑신부는
 * Supabase 계정이 없기 때문이다.
 */

type Action =
  | { action: "toggleGuestbook"; invitationId: string; id: string; isVisible: boolean }
  | { action: "delete"; invitationId: string; id: string; target: "rsvp" | "guestbook" }

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

  const { invitationId, id } = body
  if (typeof invitationId !== "string" || typeof id !== "string" || !invitationId || !id) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  if (!(await assertAuthorized(invitationId))) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
  }

  const supabase = createSupabaseAdminClient()

  if (body.action === "toggleGuestbook") {
    // invitation_id 조건을 함께 걸어 다른 청첩장의 행을 건드릴 수 없게 한다
    const { error } = await supabase
      .from("guestbook_entries")
      .update({ is_visible: !!body.isVisible })
      .eq("id", id)
      .eq("invitation_id", invitationId)
    if (error) {
      console.error("dashboard-data toggle failed:", error.message)
      return NextResponse.json({ error: "노출 설정을 변경하지 못했습니다." }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (body.action === "delete") {
    const table = body.target === "rsvp" ? "rsvp_responses" : "guestbook_entries"
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", id)
      .eq("invitation_id", invitationId)
    if (error) {
      console.error(`dashboard-data delete ${table} failed:`, error.message)
      return NextResponse.json({ error: "삭제하지 못했습니다." }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "알 수 없는 작업입니다." }, { status: 400 })
}
