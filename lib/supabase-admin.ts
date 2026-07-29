import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * 서버 전용 Supabase 클라이언트 (service_role).
 *
 * RLS 를 우회하므로 **절대 클라이언트 번들에 들어가면 안 된다** — 이 모듈은
 * Server Component / Route Handler 에서만 import 할 것. 환경변수도 의도적으로
 * `NEXT_PUBLIC_` 접두사가 없어 브라우저 번들에 주입되지 않는다.
 *
 * 쓰는 곳은 "익명 사용자를 대신해 서버가 대신 읽어야 하는" 경로다:
 *  - 발행 청첩장(/w/[slug]) — invitations 행에 dashboard_password 가 있어
 *    anon 에게 SELECT 를 열어둘 수 없다
 *  - 신랑신부 대시보드 — 비밀번호로 인증했지만 Supabase 계정은 없으므로
 *    RLS 입장에선 여전히 anon 이다. 접근 판정은 서명 쿠키로 이미 끝냈고,
 *    실제 조회만 이 클라이언트가 대신한다
 *
 * 관리자 화면은 진짜 Supabase 세션(authenticated)을 갖고 있으므로 이 클라이언트가
 * 아니라 기존 createSupabaseServerClient() / 브라우저 클라이언트를 그대로 쓴다.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

/**
 * 예전에는 이 키가 없으면 anon 키로 조용히 폴백했다 — RLS 강화 마이그레이션 적용 전까지의
 * 임시 안전장치였다. 지금은 invitations/customers 의 anon SELECT 가 이미 막혀 있어서,
 * 폴백이 걸리면 이 클라이언트를 쓰는 모든 공개 경로(/w/[slug], /dashboard/[slug], 폼 제출,
 * 파기 크론 등)가 "정상 응답(빈 결과)"처럼 보이면서 실제로는 데이터를 전혀 못 읽는다.
 * 예: 발행된 청첩장 링크를 열면 슬러그가 멀쩡한데도 "찾을 수 없는 청첩장"이 뜨는 버그로
 * 나타난다 — 원인을 알 수 없어 훨씬 진단하기 어려우므로, 이제는 조용히 넘어가지 않고
 * 바로 에러를 던져 배포 로그에 원인이 드러나게 한다.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  if (!serviceRoleKey) {
    throw new Error(
      "[supabase-admin] SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다. " +
        "Vercel 프로젝트 설정 > Environment Variables 에 등록 후 다시 배포하세요.",
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
