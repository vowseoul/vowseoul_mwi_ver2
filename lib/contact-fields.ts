/**
 * 축하 연락처의 "추가 연락처" 필드 — 신랑·신부 본인 연락처는 여전히 고정 필드
 * (groom_phone/bride_phone)로 남고, 그 외(혼주·형제자매 등)는 개수가 정해져 있지
 * 않아 값 하나에 배열로 담는다. §lib/account-fields.ts 와 같은 이유·같은 패턴이다.
 */

export interface ContactEntry {
  relation: string
  name: string
  phone: string
}

export const EMPTY_CONTACT: ContactEntry = { relation: "", name: "", phone: "" }

/** 관계 드롭다운 프리셋. 여기 없는 관계는 "직접 입력"으로 자유롭게 적는다 */
export const RELATION_OPTIONS = [
  "신랑 아버지",
  "신랑 어머니",
  "신랑측 형제",
  "신랑측 자매",
  "신부 아버지",
  "신부 어머니",
  "신부측 형제",
  "신부측 자매",
] as const

export const EXTRA_CONTACTS_KEY = "extra_contacts"

export const isExtraContactsKey = (fieldKey: string): boolean => fieldKey === EXTRA_CONTACTS_KEY

/** 값을 배열로 정규화한다. 임시저장 등에서 배열이 JSON 문자열로 굳어 들어오는 경로도 받아준다 */
export function parseContactList(value: unknown): ContactEntry[] | null {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
      .map((v) => ({
        relation: typeof v.relation === "string" ? v.relation : "",
        name: typeof v.name === "string" ? v.name : "",
        phone: typeof v.phone === "string" ? v.phone : "",
      }))
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parseContactList(parsed)
    } catch {
      /* 배열이 아닌 문자열 — null 반환 */
    }
  }
  return null
}

/** 전화번호가 없으면 전화·문자 버튼을 걸 곳이 없어 의미가 없다 */
export const isContactFilled = (c: ContactEntry) => !!c.phone.trim()

/** 하객 화면에 보여줄 한 줄 표기 — "신랑 아버지 홍아무개 010-1234-5678" */
export function composeContactText(c: ContactEntry): string {
  const label = [c.relation, c.name].map((s) => s?.trim()).filter(Boolean).join(" ")
  return [label, c.phone?.trim()].filter(Boolean).join(" ")
}
