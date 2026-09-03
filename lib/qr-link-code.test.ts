import { describe, it, expect } from "vitest"
import { generateQrCode, normalizeQrCode } from "./qr-link-code"

describe("generateQrCode", () => {
  it("헷갈리는 글자를 쓰지 않는다", () => {
    // 인쇄물이 걸린 상황에서 0/O, 1/l/I 를 잘못 읽으면 되살릴 방법을 못 찾는다.
    const codes = Array.from({ length: 200 }, generateQrCode).join("")
    expect(codes).not.toMatch(/[01oil]/)
    expect(codes).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]+$/)
  })

  it("길이가 일정하고 매번 다르다", () => {
    const set = new Set(Array.from({ length: 500 }, generateQrCode))
    expect(set.size).toBe(500)
    expect([...set].every((c) => c.length === 8)).toBe(true)
  })
})

describe("normalizeQrCode", () => {
  it("주소를 통째로 붙여넣어도 코드만 뽑는다", () => {
    // 관리자가 손에 쥔 건 코드가 아니라 QR 이 가리키는 주소다.
    expect(normalizeQrCode("https://vowseoul.com/q/ab23cd45")).toBe("ab23cd45")
    expect(normalizeQrCode("http://localhost:3000/q/ab23cd45")).toBe("ab23cd45")
  })

  it("대문자·공백·구분기호를 흘려준다", () => {
    expect(normalizeQrCode("  AB23-CD45 ")).toBe("ab23cd45")
    expect(normalizeQrCode("ab23 cd45")).toBe("ab23cd45")
  })

  it("빈 입력은 빈 문자열", () => {
    expect(normalizeQrCode("")).toBe("")
    expect(normalizeQrCode("   ")).toBe("")
  })
})
