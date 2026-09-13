import { describe, it, expect } from "vitest"
import { normalizeNaverPlaceUrl, isNaverPlaceUrl } from "./naver-place"

/**
 * 이 값은 청첩장의 "네이버지도" 버튼이 실제로 여는 주소가 된다 — 아무 도메인이나
 * 통과하면 버튼 이름이 거짓이 되고, 하객을 임의의 주소로 보내는 통로가 된다.
 */
describe("normalizeNaverPlaceUrl", () => {
  it("네이버 지도 장소 주소를 그대로 받는다", () => {
    expect(normalizeNaverPlaceUrl("https://map.naver.com/p/entry/place/11669211"))
      .toBe("https://map.naver.com/p/entry/place/11669211")
    expect(normalizeNaverPlaceUrl("https://map.naver.com/v5/entry/place/11669211"))
      .toBe("https://map.naver.com/v5/entry/place/11669211")
  })

  it("공유 단축 주소(naver.me)도 받는다", () => {
    expect(normalizeNaverPlaceUrl("https://naver.me/xAbCdEf")).toBe("https://naver.me/xAbCdEf")
  })

  it("스킴이 빠져 있으면 붙여준다", () => {
    // 주소창에서 복사하면 https:// 가 빠지는 경우가 흔하다.
    expect(normalizeNaverPlaceUrl("map.naver.com/p/entry/place/123")).toBe("https://map.naver.com/p/entry/place/123")
  })

  it("앞뒤 공백을 흘려준다", () => {
    expect(normalizeNaverPlaceUrl("  https://naver.me/abc  ")).toBe("https://naver.me/abc")
  })

  it("네이버가 아닌 도메인은 거부한다", () => {
    for (const bad of [
      "https://example.com/p/entry/place/1",
      "https://map.naver.com.evil.com/place/1",
      "https://notnaver.com/",
      "javascript:alert(1)",
      "",
      "   ",
      null,
      undefined,
      "그냥 글자",
    ]) {
      expect(normalizeNaverPlaceUrl(bad as string | null), `입력: ${String(bad)}`).toBeNull()
      expect(isNaverPlaceUrl(bad as string | null)).toBe(false)
    }
  })

  it("네이버 하위 도메인은 받는다", () => {
    expect(normalizeNaverPlaceUrl("https://m.map.naver.com/p/entry/place/1")).not.toBeNull()
  })
})
