import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"

/**
 * 관리자 전용: 특정 청첩장의 누적 방문수(visit_logs) 초기화.
 *
 * visit_logs 는 방문 기록 무결성을 위해 RLS 상 authenticated 에게도 SELECT만
 * 열려 있고 DELETE 권한이 없다 (다른 테이블처럼 "FOR ALL TO authenticated" 가
 * 아니다) — 그래서 브라우저에서 직접 delete 하면 조용히 0건 영향으로 끝난다.
 * 이 라우트가 로그인 세션으로 ADMIN 권한을 확인한 뒤 service_role 로 대신 삭제한다.
 */
export async function POST(request: Request) {
  let invitationId: unknown
  try {
    const body = await request.json()
    invitationId = body?.invitationId
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  if (typeof invitationId !== "string" || !invitationId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const sessionSupabase = await createSupabaseServerClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
  }

  const { error, count } = await admin
    .from("visit_logs")
    .delete({ count: "exact" })
    .eq("invitation_id", invitationId)

  if (error) {
    console.error("reset-visits failed:", error.message)
    return NextResponse.json({ error: "방문수를 초기화하지 못했습니다." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted: count ?? 0 })
}
