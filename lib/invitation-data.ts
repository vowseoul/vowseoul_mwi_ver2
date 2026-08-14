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

/**
 * form_submissions.data(필드키 그대로) → content_data 로 병합할 값을 만든다.
 * 폼 필드 카탈로그(field_library)와 청첩장 렌더러가 기대하는 필드키가 완전히 같지 않아
 * (예: 폼은 "direction_tpt", 렌더러는 "traffic_info") 값이 있어도 그대로 스프레드하면
 * 연결되지 않는 항목들이 있다 — 여기서 그 매핑을 보정한다.
 * 값이 없는 키는 결과에 포함하지 않는다 (호출자가 기존 content_data 위에 얹을 때
 * 빈 값으로 기존 값을 지워버리지 않도록).
 */
const FORM_TO_CONTENT_KEY_ALIASES: [string, string[]][] = [
  ["traffic_info", ["direction_tpt"]],
  ["parking_info", ["direction_prk"]],
  ["shuttle_info", ["direction_sht", "rsvp_shuttle_detail"]],
  ["gallery_view_type", ["gallery_format"]],
  // greeting_message는 "예식 정보" 카테고리의 정식 필드다. 같은 뜻으로 만들어진
  // "모바일 청첩장" 카테고리의 대체/구버전 필드(greeting_message_m/greeting_message_mobile)가
  // 채워져 있는데 정식 필드가 비어 있으면 그 값을 대신 쓴다.
  ["greeting_message", ["greeting_message_m", "greeting_message_mobile"]],
]

/**
 * "혼주 고인 표기" 다중선택(mselect) 필드 → 렌더러가 쓰는 4개의 개별 *_deceased 플래그로 분해.
 * mselect는 콤마로 이어붙인 문자열로 제출된다(app/form/[slug]/page.tsx의 handleCheckboxChange).
 */
const PARENTS_DECEASED_OPTION_TO_KEY: Record<string, string> = {
  "신랑측 아버지": "groom_father_deceased",
  "신랑측 어머니": "groom_mother_deceased",
  "신부측 아버지": "bride_father_deceased",
  "신부측 어머니": "bride_mother_deceased",
}

export function buildContentDataFromForm(rawFormData: RawInvitationData): RawInvitationData {
  const out: RawInvitationData = { ...rawFormData }
  for (const [contentKey, formKeys] of FORM_TO_CONTENT_KEY_ALIASES) {
    if (out[contentKey] != null && out[contentKey] !== "") continue
    for (const formKey of formKeys) {
      const v = rawFormData[formKey]
      if (v != null && v !== "") { out[contentKey] = v; break }
    }
  }

  const parentsDeceased = rawFormData.parents_deceased
  if (typeof parentsDeceased === "string" && parentsDeceased) {
    const selected = new Set(parentsDeceased.split(",").map((s) => s.trim()))
    for (const [option, deceasedKey] of Object.entries(PARENTS_DECEASED_OPTION_TO_KEY)) {
      if (out[deceasedKey] == null || out[deceasedKey] === "") {
        out[deceasedKey] = selected.has(option) ? "예" : "아니오"
      }
    }
  }

  return out
}

/**
 * 폼의 카카오 공유 필드(kakao_share_title/kakao_share_text/kakao_share_img) →
 * invitations.og_meta 형태로 변환. 셋 다 비어 있으면 null을 반환해 기존 og_meta를
 * 건드리지 않도록 한다 (관리자가 편집기에서 직접 입력한 값을 폼 동기화가 지우면 안 된다).
 */
export function deriveOgMetaFromForm(rawFormData: RawInvitationData): { title?: string; description?: string; image?: string } | null {
  const title = rawFormData.kakao_share_title
  const description = rawFormData.kakao_share_text
  const image = rawFormData.kakao_share_img
  const out: { title?: string; description?: string; image?: string } = {}
  if (typeof title === "string" && title) out.title = title
  if (typeof description === "string" && description) out.description = description
  if (typeof image === "string" && image) out.image = image
  return Object.keys(out).length > 0 ? out : null
}

/**
 * 고객이 폼에서 "이 기능 넣어주세요/빼주세요" 식으로 답한 토글들 →
 * customization_overrides.disabled_slots / blocks 형태로 변환.
 * 폼의 toggle 필드는 손대지 않으면 아예 키가 없으므로("예"/"아니오"만 명시적으로 온다),
 * 값이 없는 항목은 결과에 포함하지 않는다 — 관리자가 편집기에서 이미 다르게 설정해둔 걸
 * "고객이 답 안 함"으로 덮어쓰면 안 된다. show_direction 필드는 선택지가 "아니요"로 등록돼
 * 있어(다른 필드는 "아니오") 두 표기를 모두 off로 인식한다.
 */
function readFormToggle(rawFormData: RawInvitationData, key: string): boolean | null {
  const v = rawFormData[key]
  if (v === "예") return true
  if (v === "아니오" || v === "아니요") return false
  return null
}

const SLOT_TOGGLE_FORM_KEYS: [string, string][] = [
  ["show_rsvp", "rsvp"],
  ["account_expose", "account"],
  ["guestbook_expose", "guestbook"],
  ["show_direction", "map"],
]

export interface FormDerivedOverrides {
  disabledSlotsAdd: string[]
  disabledSlotsRemove: string[]
  blockPatches: Record<string, Record<string, boolean>>
}

export function deriveOverridesFromForm(rawFormData: RawInvitationData): FormDerivedOverrides {
  const disabledSlotsAdd: string[] = []
  const disabledSlotsRemove: string[] = []
  for (const [formKey, slotKey] of SLOT_TOGGLE_FORM_KEYS) {
    const on = readFormToggle(rawFormData, formKey)
    if (on === true) disabledSlotsRemove.push(slotKey)
    else if (on === false) disabledSlotsAdd.push(slotKey)
  }

  const blockPatches: Record<string, Record<string, boolean>> = {}
  const mealOn = readFormToggle(rawFormData, "rsvp_meal")
  if (mealOn !== null) blockPatches.rsvp = { ...blockPatches.rsvp, mealEnabled: mealOn }
  const shuttleOn = readFormToggle(rawFormData, "rsvp_shuttle")
  if (shuttleOn !== null) blockPatches.rsvp = { ...blockPatches.rsvp, shuttleEnabled: shuttleOn }
  const ddayOn = readFormToggle(rawFormData, "show_dday")
  if (ddayOn !== null) blockPatches.calendar = { ...blockPatches.calendar, ddayEnabled: ddayOn }

  return { disabledSlotsAdd, disabledSlotsRemove, blockPatches }
}

/**
 * 폼의 bgm 필드는 "music" 타입이라 제출값이 재생 URL이 아니라 고른 음원의 파일명이다
 * (app/form/[slug]/page.tsx 의 case 'music' — handleInputChange(field.field_key, file.name)).
 * 실제 URL은 그 필드의 옵션(음원 목록, {name,url}[])에만 있고, 그 옵션은 폼 발행 시점에
 * 고정된 form_instances.fields_snapshot 안에 들어 있다 — 그래서 제출값만으로는 URL을 못 만들고
 * 스냅샷과 함께 봐야 한다. invitations.bgm_url 에 넣을 재생 가능한 URL을 여기서 찾아낸다.
 */
export function resolveBgmUrlFromSnapshot(fieldsSnapshot: unknown, bgmFileName: unknown): string | null {
  if (typeof bgmFileName !== "string" || !bgmFileName) return null
  if (!Array.isArray(fieldsSnapshot)) return null
  const bgmField = fieldsSnapshot.find((f) => f && typeof f === "object" && (f as Record<string, unknown>).field_key === "bgm") as Record<string, unknown> | undefined
  if (!bgmField) return null
  let options = bgmField.options
  if (typeof options === "string") {
    try { options = JSON.parse(options) } catch { return null }
  }
  const musicFiles = (options as Record<string, unknown> | undefined)?.music_files
  if (!Array.isArray(musicFiles)) return null
  const match = musicFiles.find((f) => f && typeof f === "object" && (f as Record<string, unknown>).name === bgmFileName) as Record<string, unknown> | undefined
  return typeof match?.url === "string" ? match.url : null
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

  // 3) 혼주 고인(故) 표시 — 각 부모 이름 필드에 '故 ' 접두어를 붙인다.
  // 별도 슬롯/템플릿 마커 없이 기존 data-field="..._name" 값 자체를 덮어쓰므로
  // 테마 템플릿을 전혀 건드리지 않고도 모든 테마에 곧바로 적용된다.
  const deceasedPairs: [string, string][] = [
    ["groom_father_deceased", "groom_father_name"],
    ["groom_mother_deceased", "groom_mother_name"],
    ["bride_father_deceased", "bride_father_name"],
    ["bride_mother_deceased", "bride_mother_name"],
  ]
  for (const [deceasedKey, nameKey] of deceasedPairs) {
    const isDeceased = raw[deceasedKey] === "예" || raw[deceasedKey] === true
    if (isDeceased && data[nameKey]) {
      data[nameKey] = `故 ${data[nameKey]}`
    }
  }

  return data
}

/* ===================================================================== *
 * 식순(wedding_programs) 정규화 — 발행 렌더러(slot-registry.tsx)와 편집기
 * (customize-client.tsx)가 각자 다른 규칙으로 이 값을 정규화하고 있었다.
 * 편집기 쪽은 레거시 "12:00 | 입장" 문자열 형식을 아예 걸러내 편집기에 빈
 * 목록으로 보였고, 그 상태로 저장하면 원본 데이터가 통째로 사라졌다 —
 * 두 화면이 반드시 같은 함수를 써야 이 드리프트가 다시 생기지 않는다.
 * ===================================================================== */
export type SequenceEvent = { time: string; title: string }

/** 다양한 입력 형태를 {time,title}[] 로 정규화 ("12:00 | 입장" 문자열, {title}/{desc}/{text} 객체 모두 지원) */
export function normalizeSequence(value: unknown): SequenceEvent[] {
  if (!Array.isArray(value)) return []
  const out: SequenceEvent[] = []
  for (const item of value) {
    if (typeof item === "string") {
      const [time, ...rest] = item.split("|")
      if (rest.length) out.push({ time: time.trim(), title: rest.join("|").trim() })
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>
      const time = typeof o.time === "string" ? o.time : ""
      const title = typeof o.title === "string" ? o.title
        : typeof o.desc === "string" ? o.desc
        : typeof o.text === "string" ? o.text : ""
      if (time || title) out.push({ time, title })
    }
  }
  return out
}

/**
 * 토글 필드 값 판정 ('예'/'아니오' 문자열 또는 boolean). 미설정(null/undefined)은
 * '표시'로 간주한다. 폼 필드 카탈로그의 토글 선택지가 "아니오"/"아니요"로
 * 통일돼 있지 않아 둘 다 받는다(예: show_direction 필드는 "아니요"로 등록돼 있음).
 */
export function isToggledOff(value: unknown): boolean {
  if (value == null) return false
  return value === false || value === "false" || value === "아니오" || value === "아니요" || value === "off"
}
