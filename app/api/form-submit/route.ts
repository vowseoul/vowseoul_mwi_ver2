import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"

/**
 * 공개 폼(/form/[slug]) 제출 완료 시 customers 테이블 갱신.
 *
 * customers 는 RLS 가 `FOR ALL TO authenticated` 로만 열려 있어 anon(공개 폼
 * 제출자)은 쓸 수 없다 — 브라우저에서 직접 update 하면 조용히 0건 영향으로
 * "성공" 처리되고 status 가 실제로는 바뀌지 않는다. 이 라우트가 서버에서
 * service_role 로 대신 갱신한다.
 *
 * 권한 판정: form_instances/form_submissions 는 RLS 가 없어 slug(URL)를 아는
 * 사람은 이미 자유롭게 쓸 수 있다 — 즉 "슬러그를 안다 = 그 인스턴스에 제출
 * 가능"이 기존 신뢰 모델이다. 여기서는 instanceId 가 실제로 customerId 소유인지만
 * 대조해 다른 고객 행을 덮어쓰지 못하게 막는다.
 */

export async function POST(request: Request) {
  let body: { instanceId?: string; customerId?: string; data?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const { instanceId, customerId, data } = body
  if (typeof instanceId !== "string" || typeof customerId !== "string" || !instanceId || !customerId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()

  const { data: instance, error: instanceError } = await supabase
    .from("form_instances")
    .select("id, customer_id")
    .eq("id", instanceId)
    .single()

  if (instanceError || !instance || instance.customer_id !== customerId) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
  }

  const customerUpdates: Record<string, unknown> = { status: "form_completed" }
  if (data?.groom_name) customerUpdates.groom_name = data.groom_name
  if (data?.bride_name) customerUpdates.bride_name = data.bride_name
  if (data?.wedding_date) customerUpdates.wedding_date = data.wedding_date
  if (data?.venue_name) customerUpdates.venue_name = data.venue_name
  if (data?.venue_address) customerUpdates.venue_address = data.venue_address

  const { error: updateError } = await supabase
    .from("customers")
    .update(customerUpdates)
    .eq("id", customerId)

  if (updateError) {
    console.error("form-submit customers update failed:", updateError.message)
    return NextResponse.json({ error: "고객 정보를 갱신하지 못했습니다." }, { status: 500 })
  }

  // 관리자 헤더 벨 알림 — 실패해도 폼 제출 자체는 이미 완료된 것이므로 응답을 막지 않는다.
  const groomName = typeof data?.groom_name === "string" ? data.groom_name : ""
  const brideName = typeof data?.bride_name === "string" ? data.bride_name : ""
  const coupleName = [groomName, brideName].filter(Boolean).join(" ♥ ") || "고객"
  const { error: notifyError } = await supabase.from("notifications").insert({
    type: "form_submitted",
    title: "폼 제출 완료",
    message: `${coupleName}님이 정보 입력 폼을 제출했습니다.`,
    link_to: `/admin/customers/${customerId}`,
  })
  if (notifyError) console.error("form-submit notification insert failed:", notifyError.message)

  return NextResponse.json({ ok: true })
}
