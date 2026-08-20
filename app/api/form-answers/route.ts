import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { formCookieName, verifyFormToken } from "@/lib/form-session"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

/**
 * 공개 폼(/form/[slug])의 임시저장·제출.
 *
 * 원래는 읽기만 서버로 옮기고 쓰기는 anon 직접 접근으로 남길 생각이었다. 안 된다 —
 * PostgREST 의 쓰기는 읽기 권한 없이 성립하지 않기 때문이다. 실제로 확인한 것:
 *
 *   upsert(onConflict)  → 401  "GRANT SELECT ON public.form_submissions TO anon"
 *   update ?id=eq.X     → 401  WHERE 절이 참조하는 컬럼에도 SELECT 권한이 필요하다
 *
 * 즉 anon 에게 쓰기를 남기려면 읽기도 같이 열어둬야 하고, 그러면 애초에 닫으려던
 * 답변 유출이 그대로 남는다. 읽기/쓰기를 나눠 옮기려던 계획 자체가 성립하지 않아
 * 여기서 함께 옮긴다.
 *
 * 권한 판정은 조회와 같다 — 슬러그를 정확히 알아야 하고, 비밀번호가 걸린 폼이면
 * 잠금해제 쿠키까지 있어야 한다. 이전 신뢰 모델("instanceId 를 아는 것 = 제출 권한")과
 * 달리 instanceId 는 클라이언트가 정하지 않는다. 슬러그로 서버가 찾은 폼에만 쓴다.
 */

export async function POST(request: Request) {
  let body: {
    slug?: string
    data?: Record<string, unknown>
    isComplete?: boolean
    consentAgreedAt?: string
    consentVersion?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const { slug, data, isComplete, consentAgreedAt, consentVersion } = body
  if (typeof slug !== "string" || !slug || !data || typeof data !== "object") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  // 폼 하나를 채우는 동안 저장은 몇 번 안 일어난다(임시저장 버튼과 최종 제출뿐).
  // 넉넉히 잡아도 자동화된 덮어쓰기 시도는 걸린다.
  if (!(await checkRateLimit("form-answers", getClientIp(request)))) {
    return NextResponse.json({ error: "너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요." }, { status: 429 })
  }

  const supabase = createSupabaseAdminClient()
  const { data: instance } = await supabase
    .from("form_instances")
    .select("id, customer_id, status, expires_at, has_password")
    .eq("unique_url_slug", slug)
    .maybeSingle()

  if (!instance) {
    return NextResponse.json({ error: "양식을 찾을 수 없습니다." }, { status: 404 })
  }

  if (instance.has_password) {
    const jar = await cookies()
    if (!verifyFormToken(jar.get(formCookieName(instance.id))?.value, instance.id)) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }
  }

  if (instance.expires_at && new Date(instance.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "만료된 폼입니다." }, { status: 410 })
  }

  const { error: upsertError } = await supabase
    .from("form_submissions")
    .upsert([{
      form_instance_id: instance.id,
      customer_id: instance.customer_id,
      data,
      is_complete: Boolean(isComplete),
      missing_fields: [],
      ...(consentAgreedAt ? { consent_agreed_at: consentAgreedAt, consent_version: consentVersion } : {}),
    }], { onConflict: "form_instance_id" })

  if (upsertError) {
    console.error("form-answers upsert failed:", upsertError.message)
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 })
  }

  if (isComplete) {
    const { error: statusError } = await supabase
      .from("form_instances")
      .update({ status: "completed" })
      .eq("id", instance.id)
    if (statusError) console.error("form-answers status update failed:", statusError.message)
  }

  // customers 갱신·알림은 기존 라우트가 계속 담당한다(§app/api/form-submit/route.ts).
  // 클라이언트가 이어서 호출하므로 여기서는 instanceId/customerId 를 돌려준다 —
  // 클라이언트가 스스로 정한 값이 아니라 서버가 슬러그로 찾은 값이라는 점이 핵심이다.
  return NextResponse.json({ ok: true, instanceId: instance.id, customerId: instance.customer_id })
}
