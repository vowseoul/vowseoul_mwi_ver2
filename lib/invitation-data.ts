import type { FieldData } from "@/components/invitation/invitation-frame"

/**
 * 필드키 → 렌더러 데이터 어댑터.
 *
 * 폼 제출값 / invitations.content_data (필드키 → 값)를 받아,
 * 1) 문자열 필드는 그대로 통과시키고
 * 2) 디자인에서 쓰이는 "파생 표시 필드"(영문 날짜, D-day, 요일 등)를 계산해 채운다.
 *
 * 템플릿의 [data-field] 는 이 결과(FieldData)에서만 값을 꽂으므로,
 * "같은 내용 = 같은 값" 이 보장된다.
 */

/** gallery_images 처럼 배열/객체가 섞여 들어올 수 있는 원본 데이터 타입 */
export type RawInvitationData = Record<string, unknown>

/** customers 에서 기본값으로 끌어올 필드키 (컬럼명이 필드키와 동일) */
const CUSTOMER_FIELD_KEYS = [
  "groom_name", "bride_name", "wedding_date", "wedding_time", "venue_name", "venue_address",
] as const

/**
 * 청첩장 렌더용 원본 데이터 병합.
 * customers 기본값 위에 content_data(레거시 camelCase는 필드키로 정규화 후)를 덮어쓴다.
 * 발행 경로와 편집기 미리보기가 이 함수를 공유해 결과가 어긋나지 않도록 한다.
 */
export function mergeInvitationRaw(
  invitation: Record<string, unknown>,
  customer: Record<string, unknown> | null,
): RawInvitationData {
  const fromCustomer: RawInvitationData = {}
  if (customer) {
    for (const key of CUSTOMER_FIELD_KEYS) {
      const v = customer[key]
      if (v != null && v !== "") fromCustomer[key] = v
    }
  }
  const contentData = (invitation.content_data && typeof invitation.content_data === "object")
    ? invitation.content_data as RawInvitationData
    : {}

  // content_data 를 먼저 정규화해야 레거시 값도 고객 기본값보다 우선한다
  const raw: RawInvitationData = { ...fromCustomer, ...normalizeLegacyKeys(contentData) }
  if (invitation.bgm_url) raw.bgm_url = invitation.bgm_url
  return raw
}

const MONTHS_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
const WEEKDAYS_KR = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]

/** 'YYYY-MM-DD' (+선택적 시간) 문자열을 로컬 자정 기준 Date 로 파싱 */
function parseWeddingDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null
  const datePart = value.slice(0, 10)
  const d = new Date(datePart + "T00:00:00")
  return isNaN(d.getTime()) ? null : d
}

/** D-day 문자열: 남은 날이면 D-N, 당일이면 D-DAY, 지났으면 D+N */
function computeDday(target: Date, now = new Date()): string {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const diffDays = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86400000)
  if (diffDays > 0) return `D-${diffDays}`
  if (diffDays === 0) return "D-DAY"
  return `D+${Math.abs(diffDays)}`
}

/**
 * 레거시 content_data(camelCase) → 필드키 매핑.
 * 기존 어드민 플로우로 생성된 청첩장을 마이그레이션 없이 새 렌더러에서 쓰기 위함.
 * 필드키 값이 이미 있으면 그쪽이 우선한다.
 */
const LEGACY_KEY_MAP: Record<string, string> = {
  groomName: "groom_name",
  brideName: "bride_name",
  groomNameEn: "groom_name_en",
  brideNameEn: "bride_name_en",
  weddingDate: "wedding_date",
  weddingTime: "wedding_time",
  venueName: "venue_name",
  venueAddress: "venue_address",
  invitationMessage: "greeting_message",
  greetingMessage: "greeting_message",
  mainImage: "main_image",
  galleryImages: "gallery_images",
  groomPhoto: "groom_photo",
  bridePhoto: "bride_photo",
  weddingPrograms: "wedding_programs",
}

/** 레거시 키를 필드키로 정규화한 원본 데이터를 반환 (필드키 우선) */
export function normalizeLegacyKeys(raw: RawInvitationData): RawInvitationData {
  const out: RawInvitationData = { ...raw }
  for (const [legacyKey, fieldKey] of Object.entries(LEGACY_KEY_MAP)) {
    const legacyValue = raw[legacyKey]
    const existing = out[fieldKey]
    const isEmpty = existing == null || existing === ""
    if (isEmpty && legacyValue != null && legacyValue !== "") {
      out[fieldKey] = legacyValue
    }
  }
  return out
}

/** 원본 데이터를 렌더러용 FieldData 로 변환 */
export function buildFieldData(rawInput: RawInvitationData, now = new Date()): FieldData {
  const raw = normalizeLegacyKeys(rawInput)
  const data: FieldData = {}

  // 1) 문자열/숫자 필드 통과 (배열·객체는 슬롯 아일랜드가 raw 로 직접 사용)
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue
    if (typeof value === "string") data[key] = value
    else if (typeof value === "number" || typeof value === "boolean") data[key] = String(value)
  }

  // 2) 파생 표시 필드 계산
  const d = parseWeddingDate(raw.wedding_date)
  if (d) {
    const y = d.getFullYear()
    const m = d.getMonth() // 0-based
    const day = d.getDate()
    data.wedding_date_en = `${MONTHS_EN[m]} ${day}, ${y}`
    data.wedding_date_display = `${y}. ${String(m + 1).padStart(2, "0")}. ${String(day).padStart(2, "0")}`
    data.wedding_weekday = WEEKDAYS_KR[d.getDay()]
    data.wedding_dday = computeDday(d, now)
  }

  return data
}
