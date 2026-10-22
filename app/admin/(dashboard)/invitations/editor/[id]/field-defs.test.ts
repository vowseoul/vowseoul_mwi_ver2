import { describe, expect, it } from "vitest"
import { buildBlockListItems, dropInBlockList } from "./field-defs"

const rows = ["hero", "greeting", "gallery", "account", "share"]
const draggable = ["greeting", "gallery", "account"]
const images = [
  { id: "a", afterBlock: "greeting", url: "a.jpg" },
  { id: "b", afterBlock: "share", url: "b.jpg" },
  { id: "c", afterBlock: "rsvp", url: "c.jpg" }, // 이 테마 목록에 없는 블럭
]

describe("buildBlockListItems", () => {
  it("각 블럭 뒤에 그 블럭 아래 사진을, 목록에 없는 블럭의 사진은 맨 뒤에 둔다", () => {
    expect(buildBlockListItems(rows, images)).toEqual([
      "hero", "greeting", "img:a", "gallery", "account", "share", "img:b", "img:c",
    ])
  })
})

describe("dropInBlockList", () => {
  const items = buildBlockListItems(rows, images)
  const at = (id: string) => items.indexOf(id)

  it("사진을 끌면 놓인 자리 바로 위의 블럭 뒤로 들어간다", () => {
    // img:b 를 account 자리로 끌면 gallery 와 account 사이 → gallery 뒤
    const r = dropInBlockList(items, at("img:b"), at("account"), images, draggable)
    expect(r && "images" in r && r.images.find((i) => i.id === "b")?.afterBlock).toBe("gallery")
  })

  it("사진을 메인 위로 끌어도 메인 뒤로 들어간다", () => {
    const r = dropInBlockList(items, at("img:a"), 0, images, draggable)
    expect(r && "images" in r && r.images.find((i) => i.id === "a")?.afterBlock).toBe("hero")
  })

  it("사진 배열 순서는 목록 순서를 따르고 다른 사진의 위치는 그대로다", () => {
    const r = dropInBlockList(items, at("img:c"), at("gallery"), images, draggable)
    if (!r || !("images" in r)) throw new Error("expected images")
    expect(r.images.map((i) => [i.id, i.afterBlock])).toEqual([["a", "greeting"], ["c", "greeting"], ["b", "share"]])
  })

  it("블럭을 끌면 끌 수 있는 블럭 순서만 돌려주고 사진은 건드리지 않는다", () => {
    expect(dropInBlockList(items, at("account"), at("greeting"), images, draggable)).toEqual({
      blockOrder: ["account", "greeting", "gallery"],
    })
  })

  it("제자리에 놓거나 위치를 모르면 아무것도 바꾸지 않는다", () => {
    expect(dropInBlockList(items, 2, 2, images, draggable)).toBeNull()
    expect(dropInBlockList(items, -1, 2, images, draggable)).toBeNull()
  })
})
