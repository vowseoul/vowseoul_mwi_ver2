/**
 * 신랑신부 셀프 편집 기능 on/off — settings 테이블(key='self_edit_enabled')에 저장되는
 * 전역 스위치. 관리자가 시스템 설정 > 일반에서 켜고 끈다. 기본값은 꺼짐이다 —
 * 새 기능이 조용히 모든 청첩장에 열려 있는 것보다, 관리자가 의식적으로 켜는 쪽이 안전하다.
 *
 * 편집 가능 범위(인사말/이름/연락처/계좌/갤러리)는 이 설정과 무관하게 항상
 * app/api/self-edit/route.ts의 화이트리스트로 고정되어 있다 — 이 스위치는
 * "기능 자체를 여닫는" 용도이지 편집 범위를 조절하는 용도가 아니다.
 */

export const SELF_EDIT_SETTINGS_KEY = "self_edit_enabled"

export interface SelfEditSettings {
  enabled: boolean
}

export function parseSelfEditSettings(value: unknown): SelfEditSettings {
  const enabled = value && typeof value === "object" ? (value as Record<string, unknown>).enabled : undefined
  return { enabled: enabled === true }
}

/**
 * 셀프 편집으로 건드릴 수 있는 필드 정의 — 서버 컴포넌트(page.tsx), 클라이언트 폼
 * (edit-client.tsx), 저장 API(app/api/self-edit/route.ts) 세 곳이 전부 이 목록을
 * 공유한다. 순수 데이터라 "use client" 컴포넌트 파일이 아니라 여기(lib)에 둔다 —
 * 서버 컴포넌트가 "use client" 파일의 값 export를 직접 import하면 Next.js RSC 클라이언트
 * 레퍼런스 경계 때문에 런타임에 깨진다(교차 검증 중 실제로 재현됨).
 *
 * 디자인 토큰(색·폰트)·테마·블록순서는 이 목록에 아예 없으므로 셀프 편집으로 손댈
 * 방법이 없다 — "수정 불가"를 화이트리스트 부재로 강제한다.
 */
export interface SelfEditFieldDef {
  key: string
  label: string
  type: "text" | "textarea" | "tel"
}

export const SELF_EDIT_PROFILE_FIELDS: SelfEditFieldDef[] = [
  { key: "groom_name", label: "신랑 이름", type: "text" },
  { key: "bride_name", label: "신부 이름", type: "text" },
  { key: "groom_phone", label: "신랑 연락처", type: "tel" },
  { key: "bride_phone", label: "신부 연락처", type: "tel" },
]
export const SELF_EDIT_GREETING_FIELD: SelfEditFieldDef = { key: "greeting_message", label: "인사말", type: "textarea" }
export const SELF_EDIT_ACCOUNT_FIELDS: SelfEditFieldDef[] = [
  { key: "account_groom_bank", label: "신랑측 은행", type: "text" },
  { key: "account_groom_number", label: "신랑측 계좌번호", type: "text" },
  { key: "account_groom_holder", label: "신랑측 예금주", type: "text" },
  { key: "account_bride_bank", label: "신부측 은행", type: "text" },
  { key: "account_bride_number", label: "신부측 계좌번호", type: "text" },
  { key: "account_bride_holder", label: "신부측 예금주", type: "text" },
]

export const SELF_EDIT_FIELD_KEYS: string[] = [
  ...SELF_EDIT_PROFILE_FIELDS.map((f) => f.key),
  SELF_EDIT_GREETING_FIELD.key,
  ...SELF_EDIT_ACCOUNT_FIELDS.map((f) => f.key),
]
