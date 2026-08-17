import { BLOCK_LABEL_FALLBACK } from "@/lib/theme-template"

/**
 * customize-client.tsx의 필드 정의·라벨 상수와 순수 헬퍼 함수 모음.
 * 원래 편집기 컴포넌트 파일 맨 위 380줄 정도를 차지하고 있어 본체 로직을
 * 찾기 어려웠다 — 로직 변경 없이 그대로 옮긴 것뿐이다.
 */

export type FieldType = "text" | "textarea" | "tel" | "image"
export interface FieldDef { key: string; label: string; type: FieldType }

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  none: "검수 전",
  in_review: "검수 요청됨",
  changes_requested: "수정 요청 있음",
  approved: "확정됨",
}

/** field_manifest 에 있을 때만 노출되는 필드 (테마가 실제로 쓰는 것만 보여준다) */
export const CONTENT_FIELD_DEFS: FieldDef[] = [
  { key: "groom_name", label: "신랑 이름", type: "text" },
  { key: "bride_name", label: "신부 이름", type: "text" },
  { key: "groom_name_en", label: "신랑 영문 이름", type: "text" },
  { key: "bride_name_en", label: "신부 영문 이름", type: "text" },
  { key: "groom_relationship", label: "신랑측 호칭", type: "text" },
  { key: "bride_relationship", label: "신부측 호칭", type: "text" },
  { key: "groom_father_name", label: "신랑 아버지 성함", type: "text" },
  { key: "groom_mother_name", label: "신랑 어머니 성함", type: "text" },
  { key: "bride_father_name", label: "신부 아버지 성함", type: "text" },
  { key: "bride_mother_name", label: "신부 어머니 성함", type: "text" },
  { key: "groom_phone", label: "신랑 연락처", type: "tel" },
  { key: "bride_phone", label: "신부 연락처", type: "tel" },
  { key: "groom_father_phone", label: "신랑 아버지 연락처", type: "tel" },
  { key: "groom_mother_phone", label: "신랑 어머니 연락처", type: "tel" },
  { key: "bride_father_phone", label: "신부 아버지 연락처", type: "tel" },
  { key: "bride_mother_phone", label: "신부 어머니 연락처", type: "tel" },
  { key: "groom_sns_instagram", label: "신랑 인스타그램", type: "text" },
  { key: "bride_sns_instagram", label: "신부 인스타그램", type: "text" },
  { key: "venue_name", label: "예식장명", type: "text" },
  { key: "venue_hall", label: "홀 이름", type: "text" },
  { key: "venue_address", label: "예식장 주소", type: "text" },
  { key: "traffic_info", label: "교통 안내", type: "textarea" },
  { key: "parking_info", label: "주차 안내", type: "textarea" },
  { key: "shuttle_info", label: "셔틀버스 안내", type: "textarea" },
  { key: "greeting_message", label: "인사말", type: "textarea" },
  { key: "main_image", label: "메인 이미지", type: "image" },
  { key: "groom_photo", label: "신랑 사진", type: "image" },
  { key: "bride_photo", label: "신부 사진", type: "image" },
  { key: "greeting_image", label: "인사말 이미지 (선택)", type: "image" },
  { key: "rsvp_meal_menu", label: "식사 종류 (쉼표로 구분, 비우면 한식/양식 기본)", type: "text" },
]

/** slot_manifest 에 'account' 가 있을 때만 노출 (필드키 마커가 아니라 슬롯 데이터라 field_manifest 에 없음) */
export const ACCOUNT_FIELD_DEFS: FieldDef[] = [
  { key: "account_groom_bank", label: "은행", type: "text" },
  { key: "account_groom_number", label: "계좌번호", type: "text" },
  { key: "account_groom_holder", label: "예금주", type: "text" },
  { key: "account_bride_bank", label: "은행", type: "text" },
  { key: "account_bride_number", label: "계좌번호", type: "text" },
  { key: "account_bride_holder", label: "예금주", type: "text" },
  { key: "extra_account_groom", label: "신랑측 혼주 계좌 (자유 입력)", type: "textarea" },
  { key: "extra_account_bride", label: "신부측 혼주 계좌 (자유 입력)", type: "textarea" },
]

/** 부모 이름 필드 → 고인(故) 표시 플래그 필드키. buildFieldData 가 이 값을 보고 이름 앞에 '故 '를 붙인다 */
export const DECEASED_KEY_BY_NAME_FIELD: Record<string, string> = {
  groom_father_name: "groom_father_deceased",
  groom_mother_name: "groom_mother_deceased",
  bride_father_name: "bride_father_deceased",
  bride_mother_name: "bride_mother_deceased",
}
export const DECEASED_KEYS = Object.values(DECEASED_KEY_BY_NAME_FIELD)

/** slot_manifest 에 'contact' 가 있을 때만 노출 (연락처 표시 여부 토글에 쓰는 이름 라벨용) */
export const CONTACT_FIELD_DEFS: FieldDef[] = [
  { key: "groom_phone", label: "신랑 연락처", type: "tel" },
  { key: "groom_father_phone", label: "신랑 아버지 연락처", type: "tel" },
  { key: "groom_mother_phone", label: "신랑 어머니 연락처", type: "tel" },
  { key: "bride_phone", label: "신부 연락처", type: "tel" },
  { key: "bride_father_phone", label: "신부 아버지 연락처", type: "tel" },
  { key: "bride_mother_phone", label: "신부 어머니 연락처", type: "tel" },
]

/**
 * 슬롯 키 → 관리 화면에 보여줄 한글 이름. 테마가 지원하는 기능 중 이 청첩장만 끄고
 * 싶을 때 쓴다. 블럭과 겹치는 키는 BLOCK_LABEL_FALLBACK을 그대로 재사용한다 —
 * 예전엔 이 맵을 따로 손으로 채워서 "식순"(여기)/"예식 순서"(블럭 아코디언)처럼
 * 같은 개념이 화면마다 다른 이름으로 보이는 드리프트가 있었다. bgm/map처럼
 * 블럭보다 세밀한 슬롯 전용 개념만 별도로 채운다.
 */
export const SLOT_LABELS: Record<string, string> = {
  ...BLOCK_LABEL_FALLBACK,
  bgm: "배경음악",
  map: "오시는 길 (지도)",
}

export const ALL_TEXT_FIELD_DEFS = [...CONTENT_FIELD_DEFS, ...ACCOUNT_FIELD_DEFS]
export const MANAGED_CONTENT_KEYS = new Set([
  ...ALL_TEXT_FIELD_DEFS.map((f) => f.key),
  "wedding_date", "wedding_time", "gallery_images", "gallery_view_type", "gallery_align", "greeting_image_ratio", "wedding_programs", "show_wedding_program",
  "phone_expose", "groom_show_phone", "bride_show_phone",
  "gallery_zoom_block", "account_collapsed", "bgm_autoplay",
  "extra_contacts",
  ...DECEASED_KEYS,
])

/** 목록 항목을 인접한 위치와 맞바꾼다 — 갤러리 사진 순서, 섹션 삽입 이미지 순서 재정렬에 공용으로 쓴다 */
export function moveArrayItem<T>(arr: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (index < 0 || target < 0 || target >= arr.length) return arr
  const next = [...arr]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/**
 * 테마 CSS에서 사이즈 토큰의 실제 폴백 값을 읽는다 (예: `var(--text-title, 18px)` → 18).
 * 사이즈 토큰은 themes.styles 에 기본값을 따로 저장하지 않고 CSS 폴백을 유일한 기본값 출처로
 * 삼기로 했으므로(THEME_TOKEN_GUIDE.md §1.2), 슬라이더에 보여줄 "테마 기본값"은 여기서 파싱한다.
 */
export function extractTokenDefault(css: string, tokenName: string): number | null {
  const escaped = tokenName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
  const match = new RegExp(`var\\(${escaped}\\s*,\\s*(\\d+(?:\\.\\d+)?)px\\)`).exec(css)
  return match ? Number(match[1]) : null
}
