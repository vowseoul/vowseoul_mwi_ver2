import { createSupabaseAdminClient } from "./supabase-admin"

/**
 * 인증 관문 3종(대시보드/폼/방명록 삭제 비밀번호)에 시도 횟수 제한이 전혀
 * 없었다 — 기본 비밀번호가 "연락처 뒷 4자리"(탐색공간 10,000)라 PBKDF2 해시
 * 자체가 견고해도 무제한 대입을 막지 못하면 무의미하다.
 *
 * ponytail: 창구별 IP당 윈도우 내 시도 횟수만 세는 가장 단순한 형태 — 오래된
 * 행을 지우는 정리 작업이 없어 rate_limit_attempts가 계속 자란다. 실패 시도만
 * 쌓이는 테이블이라 이 앱 규모에서는 느리게 자라지만, 트래픽이 커지면 크론으로
 * "N일 이전 행 삭제"를 추가할 것.
 */
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10

/**
 * scope+identifier 조합이 최근 WINDOW_MS 안에 max번을 넘겨 시도했으면 false.
 *
 * max 를 창구별로 달리 줄 수 있게 열어둔 이유: 인증 관문(기본값 10)과 달리 어떤
 * 창구는 정상 사용자도 훨씬 자주 두드린다. 지오코딩(§app/api/geocode)이 그렇다 —
 * 하객이 청첩장 지도를 열 때마다 호출되고, 같은 통신사 NAT 뒤 하객들이 하나의 IP 를
 * 공유하므로 10회 제한을 그대로 쓰면 정상 하객의 지도가 먼저 깨진다.
 */
export async function checkRateLimit(
  scope: string,
  identifier: string,
  max: number = MAX_ATTEMPTS,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient()
  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString()
  const { count } = await supabase
    .from("rate_limit_attempts")
    .select("*", { count: "exact", head: true })
    .eq("scope", scope)
    .eq("identifier", identifier)
    .gte("created_at", windowStart)

  if ((count ?? 0) >= max) return false

  await supabase.from("rate_limit_attempts").insert({ scope, identifier })
  return true
}

/** Vercel/프록시 뒤에서 실제 클라이언트 IP를 추출 — 없으면 "unknown"으로 뭉뚱그려 최소한 같은 창구 안에서는 제한이 걸리게 한다 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return request.headers.get("x-real-ip") || "unknown"
}
