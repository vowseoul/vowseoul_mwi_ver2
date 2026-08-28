import { createHmac, timingSafeEqual } from "crypto"
import { getSecret } from "./dashboard-session"

/**
 * 정보 수집 폼(/form/[slug]) 잠금해제 토큰.
 *
 * 이전에는 비밀번호 통과 여부가 클라이언트 상태(isUnlocked)일 뿐이었다. 폼 내용과
 * 이미 제출한 답변이 마운트 시점에 한꺼번에 내려왔고 비밀번호 화면은 그 위에 덮이는
 * 것뿐이라, 슬러그만 알면 비밀번호 없이 네트워크 응답에서 답변을 그대로 볼 수 있었다
 * — 비밀번호가 정작 지키기로 한 데이터를 지키지 않고 있었다.
 *
 * 이제 답변은 이 토큰을 가진 요청에만 내려간다(§app/api/form-instance/route.ts).
 *
 * 서명 키는 대시보드 토큰(§lib/dashboard-session.ts)과 공유하되, 메시지 앞에 용도
 * 접두사를 붙여 값이 섞이지 않게 한다 — lib/visit-hash.ts 가 같은 키를 쓰면서
 * 접두사로 구분하는 것과 같은 방식이다. 접두사가 없으면 대시보드 토큰을 폼 토큰
 * 자리에 옮겨 붙일 여지가 생긴다.
 */

const TTL_MS = 1000 * 60 * 60 * 12 // 12시간 — 폼은 한 번에 다 못 채우고 돌아오는 경우가 많다
const PREFIX = "form"

/** 폼별 쿠키 이름 — 한 사람이 여러 폼을 열어둘 수 있다 */
export function formCookieName(instanceId: string): string {
  return `vs_form_${instanceId}`
}

function sign(instanceId: string, expiresAt: number): string {
  return createHmac("sha256", getSecret()).update(`${PREFIX}.${instanceId}.${expiresAt}`).digest("hex")
}

export function createFormToken(instanceId: string): { token: string; maxAge: number } {
  const expiresAt = Date.now() + TTL_MS
  return {
    token: `${expiresAt}.${sign(instanceId, expiresAt)}`,
    maxAge: Math.floor(TTL_MS / 1000),
  }
}

/** 쿠키 값이 이 폼에 대해 유효한 서명이고 아직 만료되지 않았는가 */
export function verifyFormToken(token: string | undefined, instanceId: string): boolean {
  if (!token) return false
  const [expiresRaw, signature] = token.split(".")
  const expiresAt = Number(expiresRaw)
  if (!expiresAt || !signature || Date.now() > expiresAt) return false

  const expected = sign(instanceId, expiresAt)
  // 길이가 다르면 timingSafeEqual 이 던지므로 먼저 거른다
  if (signature.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
