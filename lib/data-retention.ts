/**
 * 청첩장 데이터 자동 파기 정책 — 예식일 + 보관일수가 지나면 청첩장을 소프트 삭제한다.
 * 보관일수는 settings 테이블(key='data_retention')에 저장되어 관리자 설정 화면에서
 * 직접 바꿀 수 있다. 값이 없으면 DEFAULT_RETENTION_DAYS(30일)를 쓴다.
 *
 * 실제 파기는 app/api/cron/purge-expired-invitations 가 이 설정을 읽어 수행한다.
 */

export const DEFAULT_RETENTION_DAYS = 30
export const DATA_RETENTION_SETTINGS_KEY = "data_retention"

/**
 * 하객 RSVP·방명록·방문로그 파기 기준일 (예식일로부터 경과일). 고정값이며
 * 관리자 설정 대상이 아니다. 매일 도는 크론(§app/api/cron/purge-expired-invitations)이
 * 주력으로 수행하고, app/invitation/[id]/dashboard/page.tsx는 신랑신부가 크론보다
 * 먼저 들어오는 경우를 위한 안전망이다. 개인정보처리방침(app/privacy)과 동의 문구
 * (lib/privacy-consent.ts)가 이 값을 함께 참조해 실제 파기 주기와 문구가
 * 어긋나지 않도록 한다.
 */
export const GUEST_DATA_PURGE_DAYS = 14

/**
 * 소프트 삭제(deleted_at) 후 실제 DELETE(하드 삭제)까지의 유예기간. 오삭제 복구
 * 여지를 남기면서도 결국은 완전히 파기하기 위한 값이다 — 관리자 설정 대상이 아니고
 * 개인정보처리방침(app/privacy)에 고정값으로 안내한다.
 */
export const HARD_DELETE_GRACE_DAYS = 30

export interface DataRetentionSettings {
  /** 예식일로부터 며칠 뒤에 자동 삭제할지 */
  daysAfterWedding: number
}

/** settings.value(jsonb)를 안전하게 DataRetentionSettings 로 정규화 */
export function parseRetentionSettings(value: unknown): DataRetentionSettings {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>).daysAfterWedding : undefined
  const days = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_RETENTION_DAYS
  return { daysAfterWedding: days }
}

/** 예식일 + 보관일수로 만료 시각을 계산한다 */
export function computeExpiryDate(weddingDate: string | Date, days: number): Date {
  const wedding = typeof weddingDate === "string" ? new Date(weddingDate) : weddingDate
  return new Date(wedding.getTime() + days * 24 * 60 * 60 * 1000)
}

/**
 * QR·인쇄물 안내용 만료일 문구. 예식일이 없으면 null 을 준다 — 계산할 수 없는데
 * 그럴듯한 날짜를 지어내면, 그 종이가 언제까지 유효한지 잘못 약속하게 된다.
 *
 * 크론과 같은 계산(computeExpiryDate)을 써야 화면의 약속과 실제 파기 시점이
 * 어긋나지 않는다(§app/api/cron/purge-expired-invitations).
 */
export function formatExpiryNotice(
  weddingDate: string | null | undefined,
  days: number,
): { date: Date; label: string } | null {
  if (!weddingDate) return null
  const wedding = new Date(weddingDate)
  if (Number.isNaN(wedding.getTime())) return null

  const date = computeExpiryDate(wedding, days)
  return {
    date,
    label: `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`,
  }
}
