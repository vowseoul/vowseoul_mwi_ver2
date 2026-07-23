/**
 * 테마 디자인 토큰(themes.styles) 설정/해제 — 에디터 '저장'과 동일한 DB 쓰기.
 * 사용:
 *   node scripts/set-theme-tokens.mjs green   # 검증용 토큰 적용
 *   node scripts/set-theme-tokens.mjs reset   # 토큰 제거(원본 CSS 기본값으로 복귀)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const sb = createClient(url, anon)

const THEME_ID = 'a0000000-0000-4000-8000-000000000001'
const mode = process.argv[2] || 'green'

const styles = mode === 'reset'
  ? {}
  : { '--accent': '#2E7D5B', '--bg': '#EDF3EF', '--ink': '#22332B' }

const { error } = await sb.from('themes').update({ styles }).eq('id', THEME_ID)
if (error) { console.error('❌', error.message); process.exit(1) }
console.log(`✅ styles ${mode === 'reset' ? '초기화' : '적용'}:`, JSON.stringify(styles))
