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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

let warned = false

export function createSupabaseAdminClient(): SupabaseClient {
  // 키가 아직 없으면 anon 으로 폴백한다 — RLS 를 조이는 마이그레이션을 적용하기
  // 전까지는 동작에 차이가 없고, 키를 넣는 순간 곧바로 정상 동작한다.
  const key = serviceRoleKey || anonKey
  if (!serviceRoleKey && !warned) {
    warned = true
    console.warn(
      "[supabase-admin] SUPABASE_SERVICE_ROLE_KEY 가 없어 anon 키로 폴백합니다. " +
        "RLS 강화 마이그레이션을 적용하기 전에 반드시 설정하세요.",
    )
  }

  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
