/**
 * 폼 빌더의 bgm/music 필드에 이미 업로드되어 있던 음원들을 BGM 관리(bgms 테이블)로
 * 백필한다. 이후부터는 폼 빌더에서 새로 올리는 음원이 자동으로 bgms 에 등록되고
 * (§ forms/builder useRegisterBgmAssetMutation), BGM 관리에 추가한 음원은 렌더링
 * 시점에 모든 bgm 필드 선택지에 자동으로 합쳐진다(§ lib/bgm-choices.ts) — 이 스크립트는
 * 과거분(기존 form_template_fields.options.music_files)만 한 번 채워 넣는 용도다.
 *
 * 사용: node scripts/backfill-bgm-assets.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const env = readFileSync(join(root, '.env.local'), 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const serviceRoleMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)
if (!serviceRoleMatch) {
  console.error('❌ .env.local 에 SUPABASE_SERVICE_ROLE_KEY 가 없습니다 — bgms 쓰기 권한에 필요합니다.')
  process.exit(1)
}
const serviceRole = serviceRoleMatch[1].trim()
const sb = createClient(url, serviceRole)

const { data: musicFields, error: fieldsError } = await sb
  .from('form_template_fields')
  .select('options, field_library:field_library_id(field_type)')

if (fieldsError) {
  console.error('❌ form_template_fields 조회 실패:', fieldsError.message)
  process.exit(1)
}

const uniqueByUrl = new Map()
for (const row of musicFields || []) {
  if (row.field_library?.field_type !== 'music') continue
  const musicFiles = row.options?.music_files
  if (!Array.isArray(musicFiles)) continue
  for (const file of musicFiles) {
    if (!file?.url || uniqueByUrl.has(file.url)) continue
    uniqueByUrl.set(file.url, {
      name: file.title || file.name || file.url.split('/').pop() || 'Untitled',
      url: file.url,
    })
  }
}

console.log(`🔍 폼 필드에서 발견한 음원 ${uniqueByUrl.size}개`)

if (uniqueByUrl.size === 0) {
  console.log('추가할 음원이 없습니다.')
  process.exit(0)
}

const { data: existingBgms, error: existingError } = await sb.from('bgms').select('url')
if (existingError) {
  console.error('❌ 기존 bgms 조회 실패:', existingError.message)
  process.exit(1)
}
const existingUrls = new Set((existingBgms || []).map((b) => b.url))

const toInsert = Array.from(uniqueByUrl.values()).filter((b) => !existingUrls.has(b.url))
console.log(`➕ 신규 등록 대상: ${toInsert.length}개 (이미 등록됨: ${uniqueByUrl.size - toInsert.length}개)`)

if (toInsert.length === 0) {
  console.log('모두 이미 BGM 관리에 등록되어 있습니다.')
  process.exit(0)
}

const { error: insertError } = await sb.from('bgms').insert(
  toInsert.map((b) => ({ name: b.name, url: b.url, is_active: true }))
)

if (insertError) {
  console.error('❌ bgms 삽입 실패:', insertError.message)
  process.exit(1)
}

console.log(`✅ ${toInsert.length}개 음원을 BGM 관리에 등록했습니다.`)
for (const b of toInsert) console.log(`   - ${b.name}`)
