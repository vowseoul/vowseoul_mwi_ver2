import { describe, it, expect, vi, afterEach } from "vitest"
import {
  createDashboardToken, verifyDashboardToken, dashboardCookieName, passwordMatches,
} from "./dashboard-session"
import { createFormToken, verifyFormToken, formCookieName } from "./form-session"

/**
 * 신랑신부 대시보드와 공개 폼의 접근을 지키는 건 이 서명 토큰 하나뿐인데,
 * 지금까지 테스트가 없었다.
 *
 * 깨져도 조용한 쪽이라 특히 위험하다 — 서명 검증이 헐거워지면 남의 대시보드가
 * 열려도 에러 하나 나지 않고, 화면상으로는 정상 동작과 구별되지 않는다.
 * 여기서 고정하는 건 "통과하는가"가 아니라 "통과하지 말아야 할 것이 막히는가"다.
 */

afterEach(() => { vi.useRealTimers() })

const ID = "11111111-1111-1111-1111-111111111111"
const OTHER = "22222222-2222-2222-2222-222222222222"

describe("대시보드 토큰", () => {
  it("정상 발급한 토큰은 같은 청첩장에서 통과한다", () => {
    const { token, maxAge } = createDashboardToken(ID)
    expect(verifyDashboardToken(token, ID)).toBe(true)
    expect(maxAge).toBe(12 * 60 * 60)
  })

  it("다른 청첩장에는 쓸 수 없다", () => {
    // 쿠키 이름이 청첩장별로 갈리므로, 이름만 바꿔 옮겨 붙이는 게 가장 쉬운 공격이다.
    // 서명 대상에 id 가 들어 있어 막힌다.
    const { token } = createDashboardToken(ID)
    expect(verifyDashboardToken(token, OTHER)).toBe(false)
    expect(dashboardCookieName(ID)).not.toBe(dashboardCookieName(OTHER))
  })

  it("서명을 한 글자만 바꿔도 막힌다", () => {
    const { token } = createDashboardToken(ID)
    const [exp, sig] = token.split(".")
    const flipped = sig[0] === "a" ? "b" : "a"
    expect(verifyDashboardToken(`${exp}.${flipped}${sig.slice(1)}`, ID)).toBe(false)
  })

  it("만료 시각을 늘려 잡아도 막힌다", () => {
    // 서명이 만료 시각까지 덮지 않으면, 값을 미래로 고쳐 무기한 사용할 수 있다.
    const { token } = createDashboardToken(ID)
    const [exp, sig] = token.split(".")
    const extended = Number(exp) + 365 * 24 * 60 * 60 * 1000
    expect(verifyDashboardToken(`${extended}.${sig}`, ID)).toBe(false)
  })

  it("12시간이 지나면 서명이 맞아도 막힌다", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    const { token } = createDashboardToken(ID)
    expect(verifyDashboardToken(token, ID)).toBe(true)

    vi.setSystemTime(new Date("2026-01-01T11:59:00Z"))
    expect(verifyDashboardToken(token, ID), "만료 1분 전").toBe(true)

    vi.setSystemTime(new Date("2026-01-01T12:00:01Z"))
    expect(verifyDashboardToken(token, ID), "만료 직후").toBe(false)
  })

  it("형식이 깨진 값에 던지지 않고 false 를 준다", () => {
    // 서명 길이가 다르면 timingSafeEqual 이 예외를 던진다. 그게 라우트까지
    // 올라가면 500 이 되고, 잘린 쿠키 하나로 페이지가 죽는다.
    for (const bad of [
      undefined, "", ".", "abc", "123", "123.", ".abc", "abc.def",
      `${Date.now() + 60000}.short`,
      `${Date.now() + 60000}.${"f".repeat(200)}`,
      "NaN.deadbeef", `0.${"a".repeat(64)}`,
    ]) {
      expect(() => verifyDashboardToken(bad as string | undefined, ID)).not.toThrow()
      expect(verifyDashboardToken(bad as string | undefined, ID), `입력: ${String(bad)}`).toBe(false)
    }
  })
})

describe("폼 토큰과 대시보드 토큰은 서로 통용되지 않는다", () => {
  it("같은 id 로 만든 대시보드 토큰을 폼 잠금해제에 쓸 수 없다", () => {
    // 두 토큰은 서명 키를 공유한다. 메시지 앞의 용도 접두사가 유일한 구분선이라,
    // 그게 빠지면 대시보드 쿠키를 폼 쿠키 자리에 옮겨 붙일 수 있게 된다.
    const dash = createDashboardToken(ID).token
    const form = createFormToken(ID).token
    expect(verifyFormToken(dash, ID)).toBe(false)
    expect(verifyDashboardToken(form, ID)).toBe(false)
    expect(formCookieName(ID)).not.toBe(dashboardCookieName(ID))
  })

  it("폼 토큰도 같은 규칙을 지킨다", () => {
    const { token } = createFormToken(ID)
    expect(verifyFormToken(token, ID)).toBe(true)
    expect(verifyFormToken(token, OTHER)).toBe(false)
    expect(verifyFormToken(undefined, ID)).toBe(false)
  })
})

describe("passwordMatches", () => {
  it("맞는 값만 통과한다", () => {
    expect(passwordMatches("1234", "1234")).toBe(true)
    expect(passwordMatches("1234", "1235")).toBe(false)
    expect(passwordMatches("", "")).toBe(true)
  })

  it("길이가 달라도 던지지 않는다", () => {
    // 먼저 해시해서 길이를 맞추기 때문에 상수시간 비교가 가능하다.
    // 원문을 그대로 비교하면 길이가 다를 때 예외가 나고, 그 예외 자체가
    // "길이가 다르다"는 정보를 흘린다.
    expect(() => passwordMatches("a", "aaaaaaaaaaaaaaaa")).not.toThrow()
    expect(passwordMatches("a", "aaaaaaaaaaaaaaaa")).toBe(false)
  })
})
