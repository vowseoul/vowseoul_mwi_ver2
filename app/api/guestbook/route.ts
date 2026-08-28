import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"

/**
 * 방명록 공개 조회(GuestbookIsland). RLS는 "행 가시성"만 제어할 뿐 "반드시
 * invitation_id로 필터"는 강제할 수 없어, anon SELECT를 열어두면 그 청첩장의
 * invitation_id를 몰라도 전 청첩장 방명록(실명 포함)을 한 번에 조회할 수 있었다
 * (§20260814000000_phase1_security_hardening.sql). 그래서 공개 조회는 여기서
 * invitation_id로 스코프를 강제한 뒤 service_role로 대신 읽는다.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const invitationId = searchParams.get("invitationId")

  if (!invitationId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("guestbook_entries")
    .select("id, author_name, message")
    .eq("invitation_id", invitationId)
    .eq("is_visible", true)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("guestbook fetch failed:", error.message)
    return NextResponse.json({ error: "방명록을 불러오지 못했습니다." }, { status: 500 })
  }

  return NextResponse.json({ entries: data ?? [] })
}
