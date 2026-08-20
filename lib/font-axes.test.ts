import { describe, it, expect } from "vitest"
import { parseFontAxes } from "./font-axes"

/**
 * 실제로 로드되지 않는 변형을 고르게 두면 브라우저가 가짜 볼드/기울임으로 대충
 * 그려버린다 — 고른 대로 안 나오는데 원인이 화면에 안 보이는 종류라, 임베드 코드가
 * 실제로 싣는 축만 노출해야 한다. 여기 있는 임베드 코드는 전부 이 프로젝트에
 * 등록돼 있는 실물이다.
 */

const font = (embedCode?: string) => embedCode

describe("parseFontAxes", () => {
  it("축이 없는 폰트는 고를 것이 없다", () => {
    const a = parseFontAxes(font("@import url('https://fonts.googleapis.com/css2?family=Aboreto&display=swap');"))
    expect(a).toEqual({ weights: [], italic: false })
  })

  it("wght 범위에서 고를 수 있는 굵기를 뽑는다", () => {
    const a = parseFontAxes(font("@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@100..900&display=swap');"))
    expect(a.weights).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900])
    expect(a.italic).toBe(false)
  })

  it("ital 축이 1을 포함할 때만 이탤릭으로 본다", () => {
    // Inter 는 ital,opsz,wght 세 축을 한 번에 싣는다 — 축 순서와 값 순서가 맞물려야 한다
    const inter = parseFontAxes(font(
      "@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');"
    ))
    expect(inter.italic).toBe(true)
    expect(inter.weights).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900])

    // ital 축이 있어도 0(정체)만 실으면 이탤릭은 없는 것이다
    const uprightOnly = parseFontAxes(font(
      "@import url('https://fonts.googleapis.com/css2?family=X:ital,wght@0,400..700&display=swap');"
    ))
    expect(uprightOnly.italic).toBe(false)
    expect(uprightOnly.weights).toEqual([400, 500, 600, 700])
  })

  it("범위가 아니라 개별 값으로 지정한 굵기도 읽는다", () => {
    const a = parseFontAxes(font("@import url('https://fonts.googleapis.com/css2?family=X:wght@300;700&display=swap');"))
    expect(a.weights).toEqual([300, 700])
  })

  it("파일 업로드 폰트는 축을 알 수 없어 아무것도 제안하지 않는다", () => {
    expect(parseFontAxes(font(undefined))).toEqual({ weights: [], italic: false })
  })

  it("형식이 어긋난 임베드 코드에 던지지 않는다", () => {
    for (const code of ["", "not a url", "@import url('https://x/css2?family=');", "@import url('https://x/css2?family=A:wght@');"]) {
      expect(() => parseFontAxes(font(code))).not.toThrow()
      expect(parseFontAxes(font(code)).weights).toEqual([])
    }
  })
})
