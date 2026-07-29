/**
 * 청첩장 데이터 자동 파기 정책 — 예식일 + 보관일수가 지나면 청첩장을 소프트 삭제한다.
 * 보관일수는 settings 테이블(key='data_retention')에 저장되어 관리자 설정 화면에서
 * 직접 바꿀 수 있다. 값이 없으면 DEFAULT_RETENTION_DAYS(30일)를 쓴다.
 *
 * 실제 파기는 app/api/cron/purge-expired-invitations 가 이 설정을 읽어 수행한다.
 */

export const DEFAULT_RETENTION_DAYS = 30
export const DATA_RETENTION_SETTINGS_KEY = "data_retention"

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
