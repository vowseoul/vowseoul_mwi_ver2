import { describe, it, expect } from "vitest"
import { daysUntil, formatDday } from "./dday"

const at = (iso: string) => new Date(iso)

describe("formatDday", () => {
  it("오늘이면 D-DAY", () => {
    // 예식 당일 오후에도 D+1 로 뒤집히면 안 된다 — 목록에서 오늘 예식을 지나간 것처럼 보이게 한다.
    expect(formatDday("2026-12-13", at("2026-12-13T00:01:00"))).toBe("D-DAY")
    expect(formatDday("2026-12-13", at("2026-12-13T23:59:00"))).toBe("D-DAY")
  })

  it("앞으로 남았으면 D-n, 지났으면 D+n", () => {
    expect(formatDday("2026-12-13", at("2026-12-12T23:00:00"))).toBe("D-1")
    expect(formatDday("2026-12-13", at("2026-12-01T09:00:00"))).toBe("D-12")
    expect(formatDday("2026-12-13", at("2026-12-14T01:00:00"))).toBe("D+1")
    expect(formatDday("2026-12-13", at("2027-01-12T12:00:00"))).toBe("D+30")
  })

  it("달과 해를 넘겨도 맞는다", () => {
    expect(formatDday("2027-01-01", at("2026-12-25T12:00:00"))).toBe("D-7")
    expect(formatDday("2026-03-01", at("2026-02-20T12:00:00"))).toBe("D-9")
  })

  it("서머타임 없는 한국이라도 시각 차이에 흔들리지 않는다", () => {
    // 자정 직전과 직후가 같은 날이면 같은 값이어야 한다.
    expect(daysUntil("2026-12-20", at("2026-12-01T00:00:00"))).toBe(19)
    expect(daysUntil("2026-12-20", at("2026-12-01T23:59:59"))).toBe(19)
  })

  it("날짜가 없거나 깨졌으면 표시하지 않는다", () => {
    for (const bad of [null, undefined, "", "미정", "2026-13"]) {
      expect(formatDday(bad as string | null)).toBeNull()
    }
  })

  it("시각이 붙은 값도 읽는다", () => {
    expect(formatDday("2026-12-13T00:00:00+09:00", at("2026-12-11T12:00:00"))).toBe("D-2")
  })
})
