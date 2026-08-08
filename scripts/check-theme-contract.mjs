/**
 * 테마 구조 계약 검사기.
 * scripts/themes/<key>/ 의 template.html 이 slot_manifest.json / block_manifest.json 이
 * 선언한 계약을 실제로 지키는지 확인한다. seed-theme.mjs 가 upsert 하기 전에 이 검사를 통과해야 한다.
 *
 * 검사 항목:
 *  1) slot_manifest 의 모든 슬롯에 대응하는 data-slot="키" 가 HTML에 있는가
 *  2) block_manifest 의 모든 블럭에 대응하는 data-block="키" 가 HTML에 있는가
 *  3) title:true 인 블럭에 data-block-title 이 있는가 (data-block-label 은 선택)
 *  4) <section> 태그에 인라인 style 속성이 없는가 (주입 CSS 를 인라인 스타일이 항상 이겨서
 *     블럭 여백 오버라이드가 그 섹션에서만 안 먹는 버그가 됨 — PLAN_DESIGN_CONTROLS.md §3.3)
 *
 * 사용:  node scripts/check-theme-contract.mjs serif-pink
 *        node scripts/check-theme-contract.mjs        (전체 테마 검사)
 */
import { readFileSync, existsSync, readdirSync } from 'fs'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const themesRoot = join(__dirname, 'themes')

export function checkTheme(key) {
  const base = join(themesRoot, key)
  const errors = []

  const html = readFileSync(join(base, 'template.html'), 'utf8')
  const slotManifest = JSON.parse(readFileSync(join(base, 'slot_manifest.json'), 'utf8'))

  const blockManifestPath = join(base, 'block_manifest.json')
  const blockManifest = existsSync(blockManifestPath)
    ? JSON.parse(readFileSync(blockManifestPath, 'utf8'))
    : []

  // 1) slot 계약
  for (const slotKey of slotManifest) {
    if (!html.includes(`data-slot="${slotKey}"`)) {
      errors.push(`[slot] data-slot="${slotKey}" 가 template.html에 없음 (slot_manifest 선언됨)`)
    }
  }

  // 2) block 계약
  for (const entry of blockManifest) {
    const blockKey = entry.key
    if (!html.includes(`data-block="${blockKey}"`)) {
      errors.push(`[block] data-block="${blockKey}" 가 template.html에 없음 (block_manifest 선언됨)`)
      continue
    }
    // 3) title 계약 — 해당 블럭 섹션 내부에 data-block-title 이 있는지 대략 검사
    //    (섹션 단위 파싱 없이 <section ... data-block="key" ...> 부터 다음 </section> 까지 슬라이스)
    if (entry.title) {
      const sectionMatch = html.match(
        new RegExp(`<section[^>]*data-block="${blockKey}"[\\s\\S]*?</section>`)
      )
      const sectionHtml = sectionMatch?.[0] ?? ''
      if (!sectionHtml.includes('data-block-title')) {
        errors.push(`[block] data-block="${blockKey}" 는 title:true 인데 data-block-title 마커가 없음`)
      }
    }
  }

  // 4) 인라인 style 금지
  const inlineStyleSections = html.match(/<section[^>]*\sstyle="[^"]*"[^>]*>/g) || []
  for (const tag of inlineStyleSections) {
    errors.push(`[inline-style] <section> 에 인라인 style 사용 금지 (블럭 여백 오버라이드를 이김): ${tag.slice(0, 80)}…`)
  }

  return errors
}

// CLI로 직접 실행됐을 때만 검사를 돌린다 (seed-theme.mjs 가 checkTheme 을 import 해서 쓸 수 있도록)
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const argKey = process.argv[2]
  const keys = argKey ? [argKey] : readdirSync(themesRoot).filter((d) => existsSync(join(themesRoot, d, 'template.html')))

  let hasError = false
  for (const key of keys) {
    const errors = checkTheme(key)
    if (errors.length === 0) {
      console.log(`✅ ${key}: 계약 검사 통과`)
    } else {
      hasError = true
      console.error(`❌ ${key}: 계약 위반 ${errors.length}건`)
      for (const e of errors) console.error(`   - ${e}`)
    }
  }

  if (hasError) process.exit(1)
}
