/**
 * 테마 시드 스크립트.
 * scripts/themes/<key>/ 의 template.html / template.css / slot_manifest.json /
 * field_manifest.json / block_manifest.json 을 읽어 Supabase themes 테이블에 upsert 한다.
 * upsert 전에 check-theme-contract.mjs 의 구조 계약 검사를 통과해야 한다 —
 * data-slot/data-block 이 매니페스트와 어긋난 테마가 그대로 배포되는 것을 막는다.
 *
 * 사용:  node scripts/seed-theme.mjs serif-pink "Serif Pink (폴라로이드)" a0000000-0000-4000-8000-000000000001
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { checkTheme } from './check-theme-contract.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const [, , key = 'serif-pink', name = 'Serif Pink (폴라로이드)', id = 'a0000000-0000-4000-8000-000000000001'] = process.argv

const contractErrors = checkTheme(key)
if (contractErrors.length > 0) {
  console.error(`❌ ${key}: 구조 계약 검사 실패 — upsert 하지 않음`)
  for (const e of contractErrors) console.error(`   - ${e}`)
  process.exit(1)
}

const env = readFileSync(join(root, '.env.local'), 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const sb = createClient(url, anon)

const base = join(root, 'scripts', 'themes', key)
const template_html = readFileSync(join(base, 'template.html'), 'utf8')
const template_css = readFileSync(join(base, 'template.css'), 'utf8')
const slot_manifest = JSON.parse(readFileSync(join(base, 'slot_manifest.json'), 'utf8'))
const field_manifest = JSON.parse(readFileSync(join(base, 'field_manifest.json'), 'utf8'))
const block_manifest_path = join(base, 'block_manifest.json')
const block_manifest = existsSync(block_manifest_path)
  ? JSON.parse(readFileSync(block_manifest_path, 'utf8'))
  : []

const { data, error } = await sb.from('themes').upsert({
  id,
  name,
  render_engine: 'template',
  is_active: true,
  template_html,
  template_css,
  slot_manifest,
  field_manifest,
  block_manifest,
}).select('id, name, render_engine, slot_manifest, field_manifest, block_manifest')

if (error) {
  console.error('❌ seed failed:', JSON.stringify(error))
  process.exit(1)
}
console.log('✅ seeded theme:', JSON.stringify(data?.[0], null, 2))
console.log(`\n미리보기 URL:  /preview/theme/${id}`)
