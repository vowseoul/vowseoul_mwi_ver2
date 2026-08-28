import { describe, it, expect } from "vitest"
import { moveFieldsInList } from "./form-builder-layout"

const f = (key: string, page: string, section: string) => ({ key, options: { page_title: page, section_title: section } })
const keys = (list: { key: string }[]) => list.map((x) => x.key).join(",")

// 1단계에 A(a1,a2) / B(b1), 2단계에 C(c1)
const base = () => [
  f("a1", "1단계", "A"), f("a2", "1단계", "A"), f("b1", "1단계", "B"), f("c1", "2단계", "C"),
]

describe("moveFieldsInList", () => {
  it("대상 필드를 지정하면 그 앞에 꽂는다", () => {
    expect(keys(moveFieldsInList(base(), [2], "1단계", "A", 0))).toBe("b1,a1,a2,c1")
  })

  it("앞에서 뒤로 옮겨도 한 칸 밀리지 않는다", () => {
    // 옮길 필드를 빼면 대상의 인덱스가 하나 당겨진다. 원본 인덱스를 그대로 쓰면
    // a1 이 a2 뒤가 아니라 b1 뒤로 넘어간다 — 화면상 구별이 안 되는 종류의 어긋남이다.
    expect(keys(moveFieldsInList(base(), [0], "1단계", "B", 2))).toBe("a2,a1,b1,c1")
  })

  it("대상이 없으면 그 섹션 끝에 붙인다", () => {
    expect(keys(moveFieldsInList(base(), [3], "1단계", "A"))).toBe("a1,a2,c1,b1")
  })

  it("빈 섹션으로 옮기면 그 단계 끝에 붙인다", () => {
    // 섹션에 기준 삼을 필드가 없어도 다른 단계 사이에 끼어들면 안 된다
    expect(keys(moveFieldsInList(base(), [0], "1단계", "새섹션"))).toBe("a2,b1,a1,c1")
    expect(keys(moveFieldsInList(base(), [0], "3단계", "새섹션"))).toBe("a2,b1,c1,a1")
  })

  it("여러 개를 옮겨도 자기들끼리의 순서는 지킨다", () => {
    const moved = moveFieldsInList(base(), [0, 2], "2단계", "C")
    expect(keys(moved)).toBe("a2,c1,a1,b1")
    expect(moved.filter((x) => ["a1", "b1"].includes(x.key)).every((x) => x.options.section_title === "C")).toBe(true)
  })

  it("옮긴 필드 자신에게 떨어뜨리면 아무것도 바뀌지 않는다", () => {
    expect(keys(moveFieldsInList(base(), [1], "1단계", "A", 1))).toBe("a1,a2,b1,c1")
    expect(keys(moveFieldsInList(base(), [], "1단계", "A", 0))).toBe("a1,a2,b1,c1")
  })

  it("옮긴 필드에는 새 단계·섹션이 찍힌다", () => {
    const [moved] = moveFieldsInList(base(), [3], "1단계", "A").filter((x) => x.key === "c1")
    expect(moved.options).toEqual({ page_title: "1단계", section_title: "A" })
  })
})
