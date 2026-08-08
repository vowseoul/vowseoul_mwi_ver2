/**
 * 발행 경로(/w/[slug]) 검증용 데모 청첩장 시드.
 *  - Serif Pink 테마의 theme_versions 행 생성
 *  - 그 버전을 참조하는 invitations 행 생성 (content_data = 실제 필드키 데이터)
 * 기존 데이터는 수정하지 않고 고정 id 로 upsert 하므로 재실행 안전.
 *
 * 사용: node scripts/seed-demo-invitation.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const sb = createClient(url, anon)

const THEME_ID = 'a0000000-0000-4000-8000-000000000001'          // Serif Pink
const THEME_VERSION_ID = 'a0000000-0000-4000-8000-0000000000f1'
const INVITATION_ID = 'a0000000-0000-4000-8000-0000000000e1'
const SLUG = 'serif-pink-demo'

// 데모용 고객 (기존 테스트 고객 재사용)
const CUSTOMER_ID = '9d75a192-a51b-41b8-9a45-bf0196685110'

const content_data = {
  groom_name: '김민준',
  bride_name: '이서연',
  groom_name_en: 'Minjun',
  bride_name_en: 'Seoyeon',
  wedding_date: '2027-05-07',
  wedding_time: '낮 12시',
  venue_name: '그랜드 호텔 3F 그랜드볼룸',
  venue_address: '서울 강남구 테헤란로 501',
  greeting_message:
    '서로가 마주 보며 다져온 사랑을\n이제 함께 한 곳을 바라보며\n걸어갈 수 있는 큰 사랑으로 키우고자 합니다.\n귀한 걸음 하시어 축복해 주시면 감사하겠습니다.',
  main_image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80',
  groom_photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
  bride_photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
  groom_father_name: '김정호',
  groom_mother_name: '박선영',
  bride_father_name: '이성재',
  bride_mother_name: '최미경',
  gallery_images: [
    'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80',
    'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&q=80',
    'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=600&q=80',
    'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&q=80',
  ],
  show_wedding_program: '예',
  wedding_programs: [
    { time: '11:00', text: '하객 맞이 및 로비 안내' },
    { time: '11:30', text: '개식사 및 화촉점화' },
    { time: '11:35', text: '신랑 신부 입장' },
    { time: '11:45', text: '혼인서약 및 성혼선언문 낭독' },
    { time: '12:00', text: '축가 및 하객 인사' },
    { time: '12:15', text: '신랑 신부 행진 및 피로연' },
  ],
  account_groom_bank: '카카오뱅크',
  account_groom_number: '3333-01-1234567',
  account_groom_holder: '김민준',
  account_bride_bank: '국민은행',
  account_bride_number: '123-45-6789012',
  account_bride_holder: '이서연',
}

// 1) theme_versions
const { error: tvErr } = await sb.from('theme_versions').upsert({
  id: THEME_VERSION_ID,
  theme_id: THEME_ID,
  version_number: 1,
  design_tokens: {},
  block_variant_selections: {},
  default_block_order: [],
  status: 'active',
  change_note: 'B+iframe 템플릿 엔진 데모',
})
if (tvErr) { console.error('❌ theme_versions:', tvErr.message); process.exit(1) }
console.log('✅ theme_version:', THEME_VERSION_ID)

// 2) invitations
const expires = new Date(); expires.setFullYear(expires.getFullYear() + 2)
const { error: invErr } = await sb.from('invitations').upsert({
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
  bgm_url: '/bgm/canon.mp3',
  published_at: new Date().toISOString(),
  expires_at: expires.toISOString(),
})
if (invErr) { console.error('❌ invitations:', invErr.message); process.exit(1) }

console.log('✅ invitation:', INVITATION_ID)
console.log(`\n발행 URL:  /w/${SLUG}`)
