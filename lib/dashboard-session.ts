import { createHmac, timingSafeEqual } from "crypto"

/**
 * 신랑신부 대시보드(/invitation/[id]/dashboard) 접근 토큰.
 *
 * 이전 구조는 브라우저가 `invitations.dashboard_password` 를 직접 SELECT 해서
 * 클라이언트에서 문자열 비교했다 — 네트워크 탭에 비밀번호가 그대로 노출됐고,
 * 애초에 대시보드 페이지 자체에 가드가 없어 invitation UUID 만 알면 인증을
 * 건너뛸 수 있었다. 이제 비밀번호 비교는 서버(/api/dashboard-auth)에서만
 * 일어나고, 통과하면 서명된 httpOnly 쿠키를 발급한다.
 *
 * 토큰 형식: `<만료 epoch(ms)>.<HMAC-SHA256(invitationId.exp)>`
 * 쿠키에 invitationId 자체는 담지 않는다 — 쿠키 이름이 청첩장별로 갈리고,
 * 서명 대상에 id 가 포함돼 다른 청첩장 쿠키를 옮겨 붙일 수 없다.
 */

const TTL_MS = 1000 * 60 * 60 * 12 // 12시간

/** 청첩장별 쿠키 이름 — 하객이 여러 청첩장 대시보드를 동시에 열 수 있다 */
export function dashboardCookieName(invitationId: string): string {
  return `vs_dash_${invitationId}`
}

/**
 * 서명 키. 미설정 시 개발 환경에서만 고정 폴백을 쓰고, 프로덕션에서는
 * 서명 없는 토큰이 발급되지 않도록 즉시 실패시킨다.
 */
function getSecret(): string {
  const secret = process.env.DASHBOARD_SESSION_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === "production") {
    throw new Error("DASHBOARD_SESSION_SECRET 환경변수가 설정되지 않았습니다.")
  }
  return "dev-only-insecure-dashboard-secret"
}

function sign(invitationId: string, expiresAt: number): string {
  return createHmac("sha256", getSecret()).update(`${invitationId}.${expiresAt}`).digest("hex")
}

export function createDashboardToken(invitationId: string): { token: string; maxAge: number } {
  const expiresAt = Date.now() + TTL_MS
  return {
    token: `${expiresAt}.${sign(invitationId, expiresAt)}`,
    maxAge: Math.floor(TTL_MS / 1000),
  }
}

/** 쿠키 값이 이 청첩장에 대해 유효한 서명이고 아직 만료되지 않았는가 */
export function verifyDashboardToken(token: string | undefined, invitationId: string): boolean {
  if (!token) return false
  const [expiresRaw, signature] = token.split(".")
  const expiresAt = Number(expiresRaw)
  if (!expiresAt || !signature || Date.now() > expiresAt) return false

  const expected = sign(invitationId, expiresAt)
  // 길이가 다르면 timingSafeEqual 이 던지므로 먼저 거른다
  if (signature.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

/** 비밀번호 비교 — 길이 노출을 줄이기 위해 해시 후 상수시간 비교 */
export function passwordMatches(input: string, expected: string): boolean {
  const digest = (v: string) => createHmac("sha256", getSecret()).update(v).digest()
  return timingSafeEqual(digest(input), digest(expected))
}
