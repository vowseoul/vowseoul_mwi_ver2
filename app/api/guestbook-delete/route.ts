import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { verifyPassword } from "@/lib/dashboard-password"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

/**
 * 방명록 본인 삭제 — 개인정보 보호법 제36조(정보주체의 삭제 요구권) 대응.
 *
 * password_hash는 GuestbookIsland의 조회 select 목록에서 애초에 제외돼 있어
 * 브라우저가 직접 비교할 방법이 없다. 여기서 service_role로 조회·검증한 뒤
 * 대신 삭제한다. 이 기능이 생기기 전에 등록된 글은 password_hash가 빈 문자열이라
 * (§초기 스키마 주석 — 자리표시자) 어떤 비밀번호를 넣어도 삭제되지 않는다 —
 * 애초에 설정된 비밀번호가 없으니 맞는 동작이다.
 */
export async function POST(request: Request) {
  let body: { entryId?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const { entryId, password } = body
  if (typeof entryId !== "string" || !entryId || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const allowed = await checkRateLimit("guestbook-delete", getClientIp(request))
  if (!allowed) {
    return NextResponse.json({ error: "너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요." }, { status: 429 })
  }

  const supabase = createSupabaseAdminClient()
  const { data: entry } = await supabase
    .from("guestbook_entries")
    .select("password_hash")
    .eq("id", entryId)
    .maybeSingle()

  if (!entry) {
    return NextResponse.json({ error: "이미 삭제되었거나 존재하지 않는 글입니다." }, { status: 404 })
  }

  const storedHash = String(entry.password_hash ?? "")
  if (!storedHash || !(await verifyPassword(password, storedHash))) {
    return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 401 })
  }

  const { error: deleteError } = await supabase.from("guestbook_entries").delete().eq("id", entryId)
  if (deleteError) {
    console.error("guestbook-delete failed:", deleteError.message)
    return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
