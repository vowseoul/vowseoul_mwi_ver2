import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { passwordMatches } from "@/lib/dashboard-session"
import { verifyPassword, isHashedDashboardPassword } from "@/lib/dashboard-password"

/**
 * 정보 수집 폼(/form/[slug]) 비밀번호 검증.
 *
 * 이전에는 useFormInstanceBySlugQuery가 access_password를 select('*')로 그대로
 * 브라우저에 내려보내 클라이언트에서 문자열 비교했다 — 네트워크 탭에 실제 비밀번호가
 * 노출됐다. 이제 비교는 여기서만 일어나고, 값 자체는 클라이언트로 전달되지 않는다.
 *
 * access_password는 이제 새로 발행되는 폼부터 PBKDF2 해시로 저장된다
 * (§app/admin/(dashboard)/forms/publish/page.tsx, lib/dashboard-password.ts —
 * invitations.dashboard_password 와 동일한 해시). 마이그레이션 이전에 발행된
 * 평문 값도 여전히 남아있을 수 있어 isHashedDashboardPassword로 형식을 가려
 * 레거시 평문은 passwordMatches(상수시간 문자열 비교)로 폴백한다.
 */
export async function POST(request: Request) {
  let body: { slug?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const { slug, password } = body
  if (typeof slug !== "string" || !slug || typeof password !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { data: instance } = await supabase
    .from("form_instances")
    .select("access_password")
    .eq("unique_url_slug", slug)
    .maybeSingle()

  if (!instance) {
    return NextResponse.json({ error: "양식을 찾을 수 없습니다." }, { status: 404 })
  }
  if (!instance.access_password) {
    return NextResponse.json({ ok: true })
  }
  const stored = instance.access_password
  const matches = isHashedDashboardPassword(stored)
    ? await verifyPassword(password, stored)
    : passwordMatches(password, stored)
  if (!matches) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
