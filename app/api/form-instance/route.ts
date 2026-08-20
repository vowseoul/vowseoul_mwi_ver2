import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { formCookieName, verifyFormToken } from "@/lib/form-session"

/**
 * 공개 폼(/form/[slug])이 읽는 유일한 통로.
 *
 * 이전에는 브라우저가 anon 키로 form_instances 를 직접 조회했고, 그 한 번의 쿼리에
 * form_submissions(제출한 답변 전체)와 customers(신랑신부 이름)가 임베드로 딸려왔다.
 * 문제가 셋이었다:
 *
 *  1. 답변이 비밀번호 확인 전에 내려왔다 — 잠금 화면은 그 위에 덮이는 UI 일 뿐이라
 *     슬러그만 알면 네트워크 탭에서 그대로 보였다.
 *  2. form_instances 목록 조회가 열려 있어 슬러그 전체를 나열할 수 있었다 —
 *     "슬러그를 아는 사람만 접근"이라는 전제 자체가 성립하지 않았다.
 *  3. form_submissions 는 RLS 가 anon 전체 읽기라, 슬러그를 몰라도 다른 고객의
 *     이름·연락처·예식장 주소를 통째로 읽을 수 있었다.
 *
 * 이제 조회는 여기서만 일어나고 anon 의 SELECT 권한은 두 표 모두 회수됐다
 * (§supabase/migrations/20260820000000). 슬러그 하나를 정확히 알아야 하고,
 * 비밀번호가 걸린 폼이면 잠금해제 토큰까지 있어야 답변이 내려간다.
 *
 * 쓰기(임시저장·제출)는 아직 anon 이 직접 한다 — 별도로 옮긴다.
 */

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug")
  if (!slug) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { data: instance, error } = await supabase
    .from("form_instances")
    .select("id, customer_id, template_id, fields_snapshot, unique_url_slug, status, expires_at, created_at, has_password")
    .eq("unique_url_slug", slug)
    .maybeSingle()

  if (error || !instance) {
    return NextResponse.json({ error: "양식을 찾을 수 없습니다." }, { status: 404 })
  }

  const jar = await cookies()
  const unlocked =
    !instance.has_password || verifyFormToken(jar.get(formCookieName(instance.id))?.value, instance.id)

  if (!unlocked) {
    // 잠금 화면이 그릴 수 있는 최소한만 — 폼 구성도 답변도 이름도 주지 않는다.
    // id 를 주는 이유: 잠금해제 요청(/api/form-auth)이 쿠키를 이 id 로 발급한다.
    return NextResponse.json({
      id: instance.id,
      unique_url_slug: instance.unique_url_slug,
      status: instance.status,
      expires_at: instance.expires_at,
      has_password: true,
      locked: true,
    })
  }

  // 잠금이 풀린 뒤에야 답변과 신랑신부 이름을 함께 내려보낸다.
  const [{ data: customer }, { data: submissions }] = await Promise.all([
    supabase.from("customers").select("id, groom_name, bride_name, wedding_date")
      .eq("id", instance.customer_id).maybeSingle(),
    supabase.from("form_submissions")
      .select("id, data, is_complete, updated_at, consent_agreed_at, consent_version")
      .eq("form_instance_id", instance.id),
  ])

  return NextResponse.json({
    ...instance,
    locked: false,
    customer: customer ?? null,
    form_submissions: submissions ?? [],
  })
}
