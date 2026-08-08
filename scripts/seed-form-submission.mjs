/**
 * 동기화 검증용 form_submission 시드.
 * serif-pink-demo 청첩장의 고객(9d75a192...)에 대해 풍부한 폼 데이터를 넣는다.
 * (식순/혼주/계좌/개별사진 등 — 기존 sync가 버리던 필드 포함)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const sb = createClient(url, anon)

const CUSTOMER_ID = '9d75a192-a51b-41b8-9a45-bf0196685110'

// 유효한 form_instance 하나 확보 (없으면 안내)
const { data: instances } = await sb.from('form_instances').select('id, customer_id').limit(20)
console.log('form_instances 개수:', instances?.length || 0)
let instanceId = instances?.find(i => i.customer_id === CUSTOMER_ID)?.id || instances?.[0]?.id
if (!instanceId) { console.error('❌ form_instance가 없어 시드 불가'); process.exit(1) }
console.log('사용할 form_instance_id:', instanceId)

const data = {
  groom_name: '김민준', bride_name: '이서연',
  groom_name_en: 'Minjun', bride_name_en: 'Seoyeon',
  wedding_date: '2027-05-07', wedding_time: '낮 12시',
  venue_name: '그랜드 호텔 3F 그랜드볼룸', venue_address: '서울 강남구 테헤란로 501',
  greeting_message: '서로가 마주 보며 다져온 사랑을\n이제 함께 한 곳을 바라보며 걸어가고자 합니다.',
  main_image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80',
  groom_photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
  bride_photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
  groom_father_name: '김정호', groom_mother_name: '박선영',
  bride_father_name: '이성재', bride_mother_name: '최미경',
  show_wedding_program: '예',
  wedding_programs: [
    { time: '11:00', text: '하객 맞이 및 로비 안내' },
    { time: '11:30', text: '개식사 및 화촉점화' },
    { time: '12:00', text: '축가 및 하객 인사' },
  ],
  account_groom_bank: '카카오뱅크', account_groom_number: '3333-01-1234567', account_groom_holder: '김민준',
  account_bride_bank: '국민은행', account_bride_number: '123-45-6789012', account_bride_holder: '이서연',
}

const { error } = await sb.from('form_submissions').upsert({
  form_instance_id: instanceId,
  customer_id: CUSTOMER_ID,
  data,
  is_complete: true,
}, { onConflict: 'form_instance_id' })

if (error) { console.error('❌', error.message); process.exit(1) }
console.log('✅ form_submission 시드 완료 (data 키:', Object.keys(data).length, '개)')
