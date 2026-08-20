import { describe, it, expect, afterAll } from "vitest"
import { adminClient, supabaseAvailable } from "./integration-env"
import { checkRateLimit, getClientIp } from "./rate-limit"

/**
 * 시도 횟수 제한은 "안 걸릴 때"가 아니라 "걸릴 때"를 확인해야 의미가 있다.
 * 지금까지 이 모듈에는 테스트가 없었는데, 조용히 통과만 시켜도 화면상 아무 이상이
 * 없는 종류다 — 제한이 풀린 걸 알아채는 순간은 대개 청구서나 침해 이후다.
 */

const SCOPE = "itest-rate-limit"
const available = supabaseAvailable()

afterAll(async () => {
  if (!available) return
  await adminClient().from("rate_limit_attempts").delete().eq("scope", SCOPE)
})

describe("checkRateLimit", () => {
  it("정해진 횟수를 넘기면 거부한다", async (ctx) => {
    if (!available) return ctx.skip()
    const id = `max3-${Date.now()}`
    const results: boolean[] = []
    for (let i = 0; i < 4; i++) results.push(await checkRateLimit(SCOPE, id, 3))
    expect(results).toEqual([true, true, true, false])
  }, 30000)

  it("창구(scope)와 대상(identifier)이 다르면 서로 영향이 없다", async (ctx) => {
    if (!available) return ctx.skip()
    // 한 IP 가 한 창구를 소진해도 다른 창구·다른 IP 는 멀쩡해야 한다.
    // 여기가 어긋나면 하객 한 명이 전체 하객의 지도를 막을 수 있다.
    const a = `iso-a-${Date.now()}`
    const b = `iso-b-${Date.now()}`
    for (let i = 0; i < 2; i++) await checkRateLimit(SCOPE, a, 2)
    expect(await checkRateLimit(SCOPE, a, 2)).toBe(false)
    expect(await checkRateLimit(SCOPE, b, 2)).toBe(true)
    expect(await checkRateLimit(`${SCOPE}-other`, a, 2)).toBe(true)
    await adminClient().from("rate_limit_attempts").delete().eq("scope", `${SCOPE}-other`)
  }, 30000)

  it("창구마다 다른 한도를 줄 수 있다", async (ctx) => {
    if (!available) return ctx.skip()
    // 지오코딩은 하객이 지도를 열 때마다 불리고 같은 NAT 뒤 하객들이 IP 를 공유해서,
    // 인증 관문용 기본값(10)을 그대로 쓰면 정상 하객의 지도가 먼저 깨진다.
    const id = `wide-${Date.now()}`
    for (let i = 0; i < 10; i++) await checkRateLimit(SCOPE, id, 60)
    expect(await checkRateLimit(SCOPE, id, 60), "기본값이었다면 여기서 막혔을 횟수").toBe(true)
    expect(await checkRateLimit(SCOPE, id, 10), "좁은 한도로 물으면 같은 기록이 이미 넘친다").toBe(false)
  }, 30000)
})

describe("getClientIp", () => {
  const req = (headers: Record<string, string>) => new Request("http://x/", { headers })

  it("프록시 뒤에서는 x-forwarded-for 의 첫 주소를 쓴다", () => {
    expect(getClientIp(req({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" }))).toBe("203.0.113.7")
    expect(getClientIp(req({ "x-forwarded-for": "  203.0.113.7  " }))).toBe("203.0.113.7")
  })

  it("헤더가 없으면 하나로 뭉뚱그린다", () => {
    // 뭉뚱그린 값도 같은 창구 안에서는 제한이 걸린다 — 식별이 안 된다고
    // 무제한으로 통과시키면 제한 자체가 무의미해진다.
    expect(getClientIp(req({}))).toBe("unknown")
    expect(getClientIp(req({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4")
  })
})
