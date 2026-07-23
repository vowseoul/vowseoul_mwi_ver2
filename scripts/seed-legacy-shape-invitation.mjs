/**
 * 레거시 호환 검증용 시드.
 * 어드민 useCreateInvitationMutation 이 실제로 쓰는 camelCase content_data 형태 그대로
 * 청첩장을 만들어, 새 템플릿 렌더러가 마이그레이션 없이 렌더하는지 확인한다.
 *
 * 사용: node scripts/seed-legacy-shape-invitation.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const sb = createClient(url, anon)

const THEME_VERSION_ID = 'a0000000-0000-4000-8000-0000000000f1' // Serif Pink v1
const INVITATION_ID = 'a0000000-0000-4000-8000-0000000000e2'
const CUSTOMER_ID = '9d75a192-a51b-41b8-9a45-bf0196685110'
const SLUG = 'serif-pink-legacy'

// ⬇︎ 어드민 mutation 이 생성하는 것과 동일한 camelCase 형태
const content_data = {
  groomName: '박정수',
  brideName: '이지선',
  weddingDate: '2027-09-18',
  weddingTime: '오후 2시',
  venueName: '라벤더 컨벤션 5F',
  venueAddress: '서울 서초구 반포대로 100',
  groomNameEn: 'Jungsoo',
  brideNameEn: 'Jisun',
  invitationMessage:
    '서로가 마주 보며 다져온 사랑을\n이제 함께 한곳을 바라보며 걸어가고자 합니다.\n저희의 뜻깊은 출발에 함께해 주세요.',
  galleryImages: [],
  rsvpEnabled: true,
  customStyles: {},
}

const expires = new Date(); expires.setFullYear(expires.getFullYear() + 2)

const { error } = await sb.from('invitations').upsert({
  id: INVITATION_ID,
  customer_id: CUSTOMER_ID,
  theme_version_id: THEME_VERSION_ID,
  public_slug: SLUG,
  dashboard_slug: `dash-${SLUG}`,
  dashboard_password: '0000',
  content_data,
  customization_overrides: {},
  block_order: [],
  status: 'published',
  og_meta: {},
  published_at: new Date().toISOString(),
  expires_at: expires.toISOString(),
})

if (error) { console.error('❌', error.message); process.exit(1) }
console.log('✅ 레거시 형태 청첩장 생성')
console.log(`\n발행 URL:  /w/${SLUG}`)
