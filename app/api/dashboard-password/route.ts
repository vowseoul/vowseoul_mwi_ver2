import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { dashboardCookieName, verifyDashboardToken } from "@/lib/dashboard-session"
import { hashDashboardPassword, verifyDashboardPassword } from "@/lib/dashboard-password"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { logAuditEvent } from "@/lib/audit-log"

/** 기본값이 연락처 뒷 4자리(4자리 숫자)라 그대로 두면 바꾸는 의미가 없다 */
const MIN_LENGTH = 6

/**
 * 신랑신부 본인의 대시보드 비밀번호 변경.
 *
 * 로그인 쿠키만으로는 허용하지 않고 현재 비밀번호를 다시 받는다 — 가족 폰이나 공용
 * PC에 세션이 남아 있으면 남이 비밀번호를 갈아버릴 수 있기 때문이다. 인증 관문이므로
 * /api/dashboard-auth 와 같은 rate limit 을 건다.
 *
 * 비밀번호를 바꿔도 이미 발급된 세션 쿠키는 만료(12시간)까지 살아 있다 — 토큰 서명에
 * 비밀번호가 섞여 있지 않기 때문이다(§lib/dashboard-session.ts). 대시보드 링크는
 * 신랑신부에게만 전달되고 변경 시점에 열려 있는 세션도 대부분 본인 것이라, 지금은
 * 이 동작을 의도적으로 그대로 둔다.
 */
export async function POST(request: Request) {
  let body: { invitationId?: unknown; currentPassword?: unknown; newPassword?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const { invitationId, currentPassword, newPassword } = body
  if (
    typeof invitationId !== "string" || !invitationId ||
    typeof currentPassword !== "string" || !currentPassword ||
    typeof newPassword !== "string" || !newPassword
  ) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const jar = await cookies()
  if (!verifyDashboardToken(jar.get(dashboardCookieName(invitationId))?.value, invitationId)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
  }

  if (newPassword.length < MIN_LENGTH) {
    return NextResponse.json({ error: `새 비밀번호는 ${MIN_LENGTH}자 이상이어야 합니다.` }, { status: 400 })
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "현재 비밀번호와 다른 값을 입력해주세요." }, { status: 400 })
  }

  if (!(await checkRateLimit("dashboard-password", getClientIp(request)))) {
    return NextResponse.json({ error: "너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요." }, { status: 429 })
  }

  const admin = createSupabaseAdminClient()
  const { data: invitation } = await admin
    .from("invitations")
    .select("dashboard_password")
    .eq("id", invitationId)
    .is("deleted_at", null)
    .maybeSingle()

  const storedHash = String(invitation?.dashboard_password ?? "")
  if (!invitation || !storedHash || !(await verifyDashboardPassword(currentPassword, storedHash))) {
    return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다." }, { status: 401 })
  }

  const { error } = await admin
    .from("invitations")
    .update({ dashboard_password: await hashDashboardPassword(newPassword) })
    .eq("id", invitationId)

  if (error) {
    console.error("dashboard-password change failed:", error.message)
    return NextResponse.json({ error: "비밀번호를 변경하지 못했습니다." }, { status: 500 })
  }

  // 값 자체는 남기지 않는다 — 변경이 있었다는 사실만 기록해 담당자가 "기본값이 아니다"를
  // 이력으로도 확인할 수 있게 한다.
  await logAuditEvent(admin, {
    invitationId,
    actorType: "customer",
    action: "dashboard_password.changed",
    summary: "신랑신부가 대시보드 비밀번호를 변경했습니다.",
  })

  return NextResponse.json({ ok: true })
}
