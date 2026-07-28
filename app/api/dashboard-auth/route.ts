import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import {
  createDashboardToken,
  dashboardCookieName,
  passwordMatches,
} from "@/lib/dashboard-session"

/**
 * 신랑신부 대시보드 비밀번호 인증.
 *
 * 비밀번호(`invitations.dashboard_password`)는 이 라우트 밖으로 절대 나가지
 * 않는다 — 응답에는 invitation id 만 담기고, 통과 시 서명된 httpOnly 쿠키를
 * 심어준다. 실제 가드는 /invitation/[id]/dashboard 의 Server Component 가 이
 * 쿠키를 검증해서 수행한다.
 */
export async function POST(request: Request) {
  let slug: unknown
  let password: unknown
  try {
    const body = await request.json()
    slug = body?.slug
    password = body?.password
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  if (typeof slug !== "string" || typeof password !== "string" || !slug || !password) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const { data: invitation, error } = await supabase
    .from("invitations")
    .select("id, dashboard_password")
    .eq("public_slug", slug)
    .maybeSingle()

  if (error) console.error("dashboard-auth lookup failed:", error.message)

  // 존재하지 않는 slug 와 비밀번호 불일치를 같은 응답으로 묶어 slug 존재 여부를
  // 탐색하지 못하게 한다.
  if (!invitation || !passwordMatches(password, String(invitation.dashboard_password ?? ""))) {
    return NextResponse.json(
      { error: "비밀번호가 올바르지 않습니다. (기본값: 연락처 뒷 4자리)" },
      { status: 401 },
    )
  }

  const invitationId = String(invitation.id)
  const { token, maxAge } = createDashboardToken(invitationId)

  const response = NextResponse.json({ invitationId })
  response.cookies.set(dashboardCookieName(invitationId), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  })
  return response
}
