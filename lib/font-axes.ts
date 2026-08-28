/* ===================================================================== *
 * 폰트가 지원하는 변형(굵기 · 이탤릭)
 *
 * 구글 폰트 임베드 코드의 family 파라미터가 그 폰트로 무엇을 쓸 수 있는지 그대로
 * 말해준다. 형식은 `family=이름:축목록@값목록` 이고 값은 단일값 또는 `min..max` 다.
 *
 *   Aboreto                                  축 없음        → 400 하나뿐
 *   Noto+Sans+KR:wght@100..900               wght 범위      → 굵기 선택 가능
 *   Inter:ital,opsz,wght@0,14..32,100..900;1,…  ital+wght   → 굵기 + 이탤릭
 *
 * 임베드 코드로 판정하는 이유: 실제로 로드되지 않는 변형을 고르게 하면 브라우저가
 * 가짜 볼드/기울임(synthetic)으로 대충 그려버려, 고른 대로 안 나오는데 원인도
 * 안 보인다. 파일 업로드 폰트는 임베드 코드가 없어 아무것도 제안하지 않는다.
 *
 * fonts.ts 가 아니라 별도 파일인 이유: 그쪽은 최상단에서 supabase 클라이언트를 만들어
 * 브라우저 환경을 전제하므로, 순수 함수 하나를 테스트하려 해도 import 부터 실패한다.
 * ===================================================================== */

export interface FontAxes {
  /** 고를 수 있는 굵기 목록. 1개 이하면 선택할 것이 없다는 뜻 */
  weights: number[]
  /** 이 폰트가 진짜 이탤릭 자족을 싣고 있는가 */
  italic: boolean
}

const WEIGHT_STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900]

export function parseFontAxes(embedCode: string | undefined | null): FontAxes {
  const none: FontAxes = { weights: [], italic: false }
  const code = embedCode
  if (!code) return none // 파일 업로드 폰트는 축을 알 수 없다

  const spec = code.match(/family=([^&"')]+)/)?.[1]
  if (!spec) return none
  const [, axisPart, valuePart] = spec.match(/^[^:]+:([^@]+)@(.+)$/) ?? []
  if (!axisPart || !valuePart) return none

  const axes = axisPart.split(",")
  const tuples = valuePart.split(";").map((t) => t.split(","))

  const valuesOf = (axis: string): string[] => {
    const i = axes.indexOf(axis)
    if (i < 0) return []
    return tuples.map((t) => t[i]).filter((v): v is string => Boolean(v))
  }

  const italic = valuesOf("ital").includes("1")

  const weights = new Set<number>()
  for (const raw of valuesOf("wght")) {
    const range = raw.match(/^(\d+)\.\.(\d+)$/)
    if (range) {
      const [min, max] = [Number(range[1]), Number(range[2])]
      for (const w of WEIGHT_STEPS) if (w >= min && w <= max) weights.add(w)
    } else if (/^\d+$/.test(raw)) {
      weights.add(Number(raw))
    }
  }

  return { weights: [...weights].sort((a, b) => a - b), italic }
}
