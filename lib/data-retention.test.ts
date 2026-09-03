import { describe, it, expect } from "vitest"
import { formatExpiryNotice, parseRetentionSettings, DEFAULT_RETENTION_DAYS } from "./data-retention"

/**
 * 만료 안내는 인쇄물에 대고 하는 약속이다. 여기가 어긋나면 "이 날까지 됩니다"라고
 * 적힌 종이가 그 전에 죽는다 — 화면에서는 아무 이상이 보이지 않는 종류의 오류다.
 */
describe("formatExpiryNotice", () => {
  it("예식일 + 보관일수로 만료일을 계산한다", () => {
    const r = formatExpiryNotice("2026-12-13", 14)
    expect(r?.label).toBe("2026년 12월 27일")
  })

  it("달과 해를 넘겨도 맞는다", () => {
    expect(formatExpiryNotice("2026-12-25", 14)?.label).toBe("2027년 1월 8일")
    expect(formatExpiryNotice("2026-02-20", 14)?.label).toBe("2026년 3월 6일")
  })

  it("예식일이 없거나 깨졌으면 아무 날짜도 지어내지 않는다", () => {
    // 그럴듯한 날짜를 만들어 보여주면 종이에 잘못된 약속이 박힌다.
    expect(formatExpiryNotice(null, 14)).toBeNull()
    expect(formatExpiryNotice(undefined, 14)).toBeNull()
    expect(formatExpiryNotice("", 14)).toBeNull()
    expect(formatExpiryNotice("예식일미정", 14)).toBeNull()
  })
})

describe("parseRetentionSettings", () => {
  it("설정이 없거나 이상하면 기본값으로 떨어진다", () => {
    for (const bad of [undefined, null, {}, { daysAfterWedding: 0 }, { daysAfterWedding: -3 }, { daysAfterWedding: "14" }]) {
      expect(parseRetentionSettings(bad).daysAfterWedding).toBe(DEFAULT_RETENTION_DAYS)
    }
  })

  it("설정된 값을 그대로 쓴다", () => {
    expect(parseRetentionSettings({ daysAfterWedding: 14 }).daysAfterWedding).toBe(14)
    expect(parseRetentionSettings({ daysAfterWedding: 90.7 }).daysAfterWedding).toBe(90)
  })
})
