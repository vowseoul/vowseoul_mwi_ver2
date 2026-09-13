import { describe, it, expect } from "vitest"
import { parseAccountIconOrder, ACCOUNT_ICON_DEFAULT_ORDER } from "./theme-template"

/**
 * 아이콘이 하나라도 사라지면 하객이 송금할 길이 막힌다 — 저장된 값이 어떻게 망가져
 * 있어도 세 개가 모두 살아 있어야 한다.
 */
describe("parseAccountIconOrder", () => {
  it("설정이 없으면 기본 순서", () => {
    for (const empty of [undefined, null, [], {}, "kakao"]) {
      expect(parseAccountIconOrder(empty)).toEqual(ACCOUNT_ICON_DEFAULT_ORDER)
    }
  })

  it("저장된 순서를 그대로 쓴다", () => {
    expect(parseAccountIconOrder(["copy", "toss", "kakao"])).toEqual(["copy", "toss", "kakao"])
  })

  it("일부만 적혀 있으면 나머지를 뒤에 붙인다", () => {
    expect(parseAccountIconOrder(["copy"])).toEqual(["copy", "kakao", "toss"])
    expect(parseAccountIconOrder(["toss", "copy"])).toEqual(["toss", "copy", "kakao"])
  })

  it("모르는 값과 중복은 버린다", () => {
    expect(parseAccountIconOrder(["naverpay", "copy", "copy", 3, null])).toEqual(["copy", "kakao", "toss"])
  })
})
