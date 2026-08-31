import { describe, it, expect } from "vitest"
import { resolveRecipients } from "./notify-recipients"

const staff = [{ id: "a" }, { id: "b" }, { id: "c" }]

describe("resolveRecipients", () => {
  it("담당자가 지정돼 있으면 그 사람에게만 간다", () => {
    expect(resolveRecipients(staff, "b")).toEqual([{ id: "b" }])
  })

  it("담당자가 없으면 전 직원에게 간다", () => {
    // 고객 13건 중 9건이 담당자 미지정이다 — 여기서 빈 목록을 주면 대부분의 알림이 사라진다.
    expect(resolveRecipients(staff, null)).toEqual(staff)
    expect(resolveRecipients(staff, undefined)).toEqual(staff)
    expect(resolveRecipients(staff, "")).toEqual(staff)
  })

  it("담당자가 더 이상 직원이 아니면 전 직원으로 되돌린다", () => {
    // 퇴사한 사람의 id 가 남아 있을 때 그 사람만 찾다 빈 목록을 주면 알림이 조용히 사라진다.
    expect(resolveRecipients(staff, "삭제된-사람")).toEqual(staff)
  })

  it("직원이 아무도 없으면 빈 목록", () => {
    expect(resolveRecipients([], "b")).toEqual([])
  })
})
