/**
 * 에셋 관리에 등록된 임베드(구글 폰트) 타입 폰트 중, family 필드가 실제 @import가 등록하는
 * font-family 이름과 다른 것들을 바로잡는다. (예: family="HahmletKR"로 저장돼 있지만
 * @import는 실제로 "Hahmlet"이라는 이름으로 폰트를 등록 — 브라우저는 "HahmletKR"이라는
 * 폰트를 찾지 못해 --font-kr에 넣어도 조용히 기본 글꼴로 렌더된다.)
 *
 * 1) settings.fonts 의 family 를 실제 이름으로 수정
 * 2) 이미 그 폰트를 선택해 --font-kr/--font-en 오버라이드에 옛 family 이름이 저장된
 *    invitations.customization_overrides 도 함께 새 이름으로 고쳐 써야 기존 청첩장도 즉시 반영된다.
 *
 * 사용: node scripts/fix-font-family-mismatch.mjs
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
  console.error('❌ .env.local 에 SUPABASE_SERVICE_ROLE_KEY 가 없습니다.')
  process.exit(1)
}
const sb = createClient(url, serviceRoleMatch[1].trim())

function extractGoogleFontFamily(embedCode) {
  const match = embedCode.match(/family=([^&:'"]+)/)
  if (!match) return null
  return decodeURIComponent(match[1].replace(/\+/g, ' '))
}

const { data: settingsRow, error: settingsError } = await sb
  .from('settings')
  .select('value')
  .eq('key', 'fonts')
  .maybeSingle()

if (settingsError) {
  console.error('❌ settings(fonts) 조회 실패:', settingsError.message)
  process.exit(1)
}

const fonts = Array.isArray(settingsRow?.value) ? settingsRow.value : []
const renameMap = new Map() // oldFamily -> newFamily

const fixedFonts = fonts.map((f) => {
  if (f.type !== 'embed' || !f.embedCode) return f
  const real = extractGoogleFontFamily(f.embedCode)
  if (real && real !== f.family) {
    renameMap.set(f.family, real)
    return { ...f, family: real }
  }
  return f
})

if (renameMap.size === 0) {
  console.log('불일치하는 폰트가 없습니다. 종료합니다.')
  process.exit(0)
}

console.log(`🔧 family 이름 불일치 ${renameMap.size}건 발견:`)
for (const [oldName, newName] of renameMap) console.log(`   - "${oldName}" → "${newName}"`)

const { error: updateFontsError } = await sb.from('settings').upsert({ key: 'fonts', value: fixedFonts })
if (updateFontsError) {
  console.error('❌ settings(fonts) 업데이트 실패:', updateFontsError.message)
  process.exit(1)
}
console.log('✅ settings(fonts) 업데이트 완료')

// customization_overrides 안의 --font-kr/--font-en 값이 옛 family를 가리키던 invitations 도 함께 수정
const { data: invitations, error: invError } = await sb
  .from('invitations')
  .select('id, customization_overrides')

if (invError) {
  console.error('❌ invitations 조회 실패:', invError.message)
  process.exit(1)
}

let patched = 0
for (const inv of invitations || []) {
  const overrides = inv.customization_overrides
  if (!overrides || typeof overrides !== 'object') continue

  let changed = false
  const next = { ...overrides }
  for (const key of ['--font-kr', '--font-en']) {
    const value = next[key]
    if (typeof value !== 'string') continue
    for (const [oldName, newName] of renameMap) {
      if (value.includes(`'${oldName}'`)) {
        next[key] = value.split(`'${oldName}'`).join(`'${newName}'`)
        changed = true
      }
    }
  }

  if (changed) {
    const { error } = await sb.from('invitations').update({ customization_overrides: next }).eq('id', inv.id)
    if (error) {
      console.error(`   ⚠️ invitation ${inv.id} 갱신 실패:`, error.message)
    } else {
      patched++
    }
  }
}

console.log(`✅ 기존 청첩장 오버라이드 ${patched}건 수정 완료`)
