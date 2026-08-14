import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"

/**
 * 하객 RSVP 응답 취소(삭제) — 개인정보 보호법 제36조(정보주체의 삭제 요구권) 대응.
 *
 * rsvp_responses는 anon에게 INSERT만 열려 있고 UPDATE/DELETE는 막혀 있다
 * (§upsert_rsvp_response RPC 주석, rsvp_responses_invitation_phone_key 유니크
 * 인덱스로 본인 식별) — 그래서 삭제도 service_role을 쓰는 여기서 대신한다.
 * 본인 확인은 제출 당시와 동일하게 (invitation_id, 전화번호) 조합으로 한다 —
 * 방명록과 달리 처음부터 실명·연락처로 식별되는 데이터라 별도 비밀번호는
 * 요구하지 않는다.
 */
export async function POST(request: Request) {
  let body: { invitationId?: string; phone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const { invitationId, phone } = body
  if (typeof invitationId !== "string" || !invitationId || typeof phone !== "string" || !phone.trim()) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const digitsOnly = phone.replace(/[^0-9]/g, "")

  const { data: rows } = await supabase
    .from("rsvp_responses")
    .select("id, phone")
    .eq("invitation_id", invitationId)

  const match = rows?.find((r) => String(r.phone ?? "").replace(/[^0-9]/g, "") === digitsOnly)
  // invitationId + 전화번호 조합이 실제로 존재하는지를 응답 코드 차이(404 vs 200)로
  // 노출하지 않는다 — 그 자체가 "이 사람이 참석 응답을 했는가"를 알려주는 오라클이 된다.
  if (match) {
    const { error: deleteError } = await supabase.from("rsvp_responses").delete().eq("id", match.id)
    if (deleteError) {
      console.error("rsvp-cancel failed:", deleteError.message)
      return NextResponse.json({ error: "취소 처리에 실패했습니다." }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
