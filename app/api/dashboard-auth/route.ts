import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import {
  createDashboardToken,
  dashboardCookieName,
} from "@/lib/dashboard-session"
import { verifyDashboardPassword } from "@/lib/dashboard-password"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

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

  const allowed = await checkRateLimit("dashboard-auth", getClientIp(request))
  if (!allowed) {
    return NextResponse.json({ error: "너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요." }, { status: 429 })
  }

  // 신랑신부는 Supabase 계정이 없는 익명 사용자라, invitations 를 읽으려면
  // service_role 이 필요하다 (RLS 상 anon 은 invitations SELECT 가 막혀 있다 —
  // 이 행에 dashboard_password 가 들어 있으니 당연히 열어둘 수 없다).
  const supabase = createSupabaseAdminClient()
  const { data: invitation, error } = await supabase
    .from("invitations")
    .select("id, dashboard_password")
    .eq("public_slug", slug)
    // 삭제·파기된 청첩장에는 대시보드 세션을 새로 내주지 않는다. 이 필터가 없어서
    // 보관기간이 지나 하객 데이터가 파기된 뒤에도 로그인이 200으로 통과했다.
    .is("deleted_at", null)
    .maybeSingle()

  if (error) console.error("dashboard-auth lookup failed:", error.message)

  // 존재하지 않는 slug 와 비밀번호 불일치를 같은 응답으로 묶어 slug 존재 여부를
  // 탐색하지 못하게 한다.
  const storedHash = String(invitation?.dashboard_password ?? "")
  if (!invitation || !storedHash || !(await verifyDashboardPassword(password, storedHash))) {
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
