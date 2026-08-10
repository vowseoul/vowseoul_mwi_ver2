import { createHmac } from "crypto"
import { getSecret } from "./dashboard-session"

/**
 * 방문자 IP 해시 — 예전엔 SHA-256(IP) 그대로였다. IPv4 전체 주소공간(2^32)은
 * 솔트 없는 해시라도 전수대입으로 수 초 내 원본 복원이 가능해, 가명처리로
 * 인정되지 않는다(개인정보 보호법 제29조 안전조치 미달).
 *
 * HMAC(비밀키, IP+날짜)로 바꾸면 키 없이는 복원 불가능해지고, 날짜가 매일 바뀌는
 * 솔트 역할을 해 장기 추적(이 사람이 여러 날 방문했는지)도 불가능해진다 — 의도된
 * 동작이다. 통계는 이미 일 단위로 집계하므로(§app/api/cron/aggregate-visit-stats)
 * 그날의 순 방문자 수 계산에는 영향이 없다.
 */
export function hashVisitorIp(ip: string, date: Date = new Date()): string {
  const dayKey = date.toISOString().slice(0, 10) // YYYY-MM-DD
  return createHmac("sha256", getSecret()).update(`visit-ip:${ip}.${dayKey}`).digest("hex")
}
