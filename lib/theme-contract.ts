import type { BlockManifestEntry } from "./theme-template"

/**
 * 테마 구조 계약 검사 — scripts/check-theme-contract.mjs의 검사 규칙을 그대로 이식했다.
 * 그쪽은 파일시스템(scripts/themes/<key>/)에서 읽은 문자열을 검사하는 Node 스크립트이고,
 * 여기는 브라우저(관리자 템플릿 편집기의 ZIP 업로드)에서 같은 문자열을 검사해야 해서
 * 별도 모듈로 뒀다 — .mjs 스크립트는 Next.js 빌드에 안 들어가고, 반대로 이 파일을 스크립트
 * 쪽에서 직접 import하려면 로더 설정이 새로 필요해 배보다 배꼽이 커진다. 규칙이 바뀌면
 * 두 곳 다 고쳐야 한다는 점만 유의할 것.
 *
 * 검사 항목:
 *  1) slot_manifest 의 모든 슬롯에 대응하는 data-slot="키" 가 HTML에 있는가
 *  2) block_manifest 의 모든 블럭에 대응하는 data-block="키" 가 HTML에 있는가
 *  3) title:true 인 블럭에 data-block-title 이 있는가
 *  4) <section> 태그에 인라인 style 속성이 없는가 (주입 CSS가 항상 이겨서 블럭 여백
 *     오버라이드가 그 섹션에서만 안 먹는 버그가 된다)
 */
export function checkThemeContract(
  html: string,
  slotManifest: string[],
  blockManifest: BlockManifestEntry[]
): string[] {
  const errors: string[] = []

  for (const slotKey of slotManifest) {
    if (!html.includes(`data-slot="${slotKey}"`)) {
      errors.push(`[slot] data-slot="${slotKey}" 가 HTML에 없음 (슬롯 매니페스트에 선언됨)`)
    }
  }

  for (const entry of blockManifest) {
    const blockKey = entry.key
    if (!html.includes(`data-block="${blockKey}"`)) {
      errors.push(`[block] data-block="${blockKey}" 가 HTML에 없음 (블럭 매니페스트에 선언됨)`)
      continue
    }
    if (entry.title) {
      const sectionMatch = html.match(new RegExp(`<section[^>]*data-block="${blockKey}"[\\s\\S]*?</section>`))
      const sectionHtml = sectionMatch?.[0] ?? ""
      if (!sectionHtml.includes("data-block-title")) {
        errors.push(`[block] data-block="${blockKey}" 는 title:true 인데 data-block-title 마커가 없음`)
      }
    }
  }

  const inlineStyleSections = html.match(/<section[^>]*\sstyle="[^"]*"[^>]*>/g) || []
  for (const tag of inlineStyleSections) {
    errors.push(`[inline-style] <section> 에 인라인 style 사용 금지 (블럭 여백 오버라이드를 이김): ${tag.slice(0, 80)}…`)
  }

  return errors
}
