import type { RawInvitationData } from "./invitation-data"

/**
 * 테마 미리보기용 샘플 원본 데이터 (실제 필드키 기준).
 * 실 청첩장 데이터가 없을 때 테마 렌더를 확인하는 용도.
 * 실제 발행에서는 form_submissions / invitations.content_data 가 이 자리를 대체한다.
 */
export const SAMPLE_RAW: RawInvitationData = {
  groom_name: "김민준",
  bride_name: "이서연",
  groom_name_en: "Minjun",
  bride_name_en: "Seoyeon",
  wedding_date: "2027-05-07",
  wedding_time: "낮 12시",
  venue_name: "그랜드 호텔 3F 그랜드볼룸",
  venue_address: "서울 강남구 테헤란로 501",
  greeting_message:
    "서로가 마주 보며 다져온 사랑을\n이제 함께 한 곳을 바라보며\n걸어갈 수 있는 큰 사랑으로 키우고자 합니다.\n귀한 걸음 하시어 축복해 주시면 감사하겠습니다.",
  main_image: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80",
  groom_photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
  bride_photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80",
  groom_father_name: "김정호",
  groom_mother_name: "박선영",
  groom_relationship: "의 아들",
  bride_father_name: "이성재",
  bride_mother_name: "최미경",
  bride_relationship: "의 딸",
  gallery_images: [
    "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80",
    "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&q=80",
    "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=600&q=80",
    "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&q=80",
  ],
  // 식순 — 실제 필드키 wedding_programs (field_type: timentext → [{time, text}])
  show_wedding_program: "예",
  wedding_programs: [
    { time: "11:00", text: "하객 맞이 및 로비 안내" },
    { time: "11:30", text: "개식사 및 화촉점화" },
    { time: "11:35", text: "신랑 신부 입장" },
    { time: "11:45", text: "혼인서약 및 성혼선언문 낭독" },
    { time: "12:00", text: "축가 및 하객 인사" },
    { time: "12:15", text: "신랑 신부 행진 및 피로연" },
  ],
  // 배경음악 — bgm 슬롯이 사용
  bgm_url: "/bgm/canon.mp3",
  account_groom_bank: "카카오뱅크",
  account_groom_number: "3333-01-1234567",
  account_groom_holder: "김민준",
  account_bride_bank: "국민은행",
  account_bride_number: "123-45-6789012",
  account_bride_holder: "이서연",
}
