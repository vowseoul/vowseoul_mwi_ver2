/**
 * 테마 파일(git) ↔ themes 테이블(DB) 드리프트 감지.
 *
 * scripts/themes/<key>/{template.html,template.css,slot_manifest.json,
 * field_manifest.json,block_manifest.json}은 사람이 `node scripts/seed-theme.mjs`를
 * 수동 실행해야만 실제 themes 테이블에 반영된다 — 이 스텝을 잊으면 "git엔 있지만
 * 실제 청첩장엔 없는" 코드가 조용히 쌓인다. 이 스크립트는 그 드리프트를 감지만
 * 한다(자동 재시딩은 하지 않음 — seed-theme.mjs가 구조 계약 검사를 거치므로
 * 그쪽을 그대로 쓰는 게 안전하다).
 *
 * 사용: node scripts/check-theme-drift.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const env = readFileSync(join(root, '.env.local'), 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const serviceKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
const sb = createClient(url, serviceKey)

// "Serif Pink (폴라로이드)" 같은 DB name을 "serif-pink" 같은 로컬 폴더 키와
// 매칭하기 위한 느슨한 슬러그화 — 괄호 이후는 버리고 공백을 하이픈으로.
function slugify(name) {
  return name.split('(')[0].trim().toLowerCase().replace(/\s+/g, '-')
}

// 화면 표시명이 폴더 키와 갈라진 알려진 케이스 — DB에서 "Soft Envelope"로 개명됐지만
// 로컬 폴더/코드 전반은 여전히 serif-pink로 부른다(§메모리: vowseoul-template-theme-architecture).
const NAME_ALIASES = { 'soft-envelope': 'serif-pink' }

const themesDir = join(root, 'scripts', 'themes')
const localKeys = readdirSync(themesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

const { data: rows, error } = await sb
  .from('themes')
  .select('id, name, render_engine, template_html, template_css, slot_manifest, field_manifest, block_manifest')
  .eq('render_engine', 'template')

if (error) {
  console.error('❌ themes 조회 실패:', error.message)
  process.exit(1)
}

let driftCount = 0
const matchedIds = new Set()

for (const key of localKeys) {
  const base = join(themesDir, key)
  const localHtml = readFileSync(join(base, 'template.html'), 'utf8')
  const localCss = readFileSync(join(base, 'template.css'), 'utf8')
  const localSlot = JSON.parse(readFileSync(join(base, 'slot_manifest.json'), 'utf8'))
  const localField = JSON.parse(readFileSync(join(base, 'field_manifest.json'), 'utf8'))
  const blockPath = join(base, 'block_manifest.json')
  const localBlock = existsSync(blockPath) ? JSON.parse(readFileSync(blockPath, 'utf8')) : []

  const row = rows.find((r) => {
    const slug = slugify(r.name ?? '')
    return slug === key || NAME_ALIASES[slug] === key
  })
  if (!row) {
    console.log(`⚠️  ${key}: DB에 매칭되는 테마 행이 없음 (한 번도 시드되지 않았을 수 있음)`)
    driftCount++
    continue
  }
  matchedIds.add(row.id)

  const diffs = []
  if (row.template_html !== localHtml) diffs.push('template.html')
  if (row.template_css !== localCss) diffs.push('template.css')
  if (JSON.stringify(row.slot_manifest) !== JSON.stringify(localSlot)) diffs.push('slot_manifest.json')
  if (JSON.stringify(row.field_manifest) !== JSON.stringify(localField)) diffs.push('field_manifest.json')
  if (JSON.stringify(row.block_manifest ?? []) !== JSON.stringify(localBlock)) diffs.push('block_manifest.json')

  if (diffs.length > 0) {
    console.log(`❌ ${key} (${row.id}): DB와 다름 — ${diffs.join(', ')}`)
    console.log(`   node scripts/seed-theme.mjs ${key} "${row.name}" ${row.id}`)
    driftCount++
  } else {
    console.log(`✅ ${key}: 일치`)
  }
}

for (const row of rows) {
  if (!matchedIds.has(row.id)) {
    console.log(`⚠️  DB 테마 "${row.name}" (${row.id})는 로컬 scripts/themes/*에 매칭되는 폴더가 없음`)
    driftCount++
  }
}

if (driftCount > 0) {
  console.log(`\n${driftCount}건의 드리프트 발견.`)
  process.exit(1)
}
console.log('\n드리프트 없음 — git과 DB가 일치합니다.')
