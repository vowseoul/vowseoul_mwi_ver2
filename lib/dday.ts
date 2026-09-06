/**
 * 예식일까지 며칠 남았는지 — 관리자 목록에서 날짜 옆에 붙는 표시.
 *
 * 밀리초 차이를 24시간으로 나누면 안 된다. 예식일이 오늘이어도 지금이 오후면
 * 남은 시간이 하루가 안 되어 "D-0"이 아니라 "D+1"로 뒤집힌다 — 달력상 며칠인지를
 * 물어야 하므로 양쪽을 그날 자정으로 맞춰 놓고 센다.
 *
 * wedding_date 는 "YYYY-MM-DD" 문자열이다. new Date("2026-12-13") 은 UTC 자정으로
 * 읽혀 한국(UTC+9)에서는 전날로 밀린다. 그래서 직접 쪼개 로컬 자정으로 만든다.
 */

export function daysUntil(weddingDate: string | null | undefined, now: Date = new Date()): number | null {
  if (!weddingDate) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(weddingDate.trim())
  if (!m) return null

  const wedding = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(wedding.getTime())) return null

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((wedding.getTime() - today.getTime()) / 86_400_000)
}

/** "D-42" · "D-DAY" · "D+3". 날짜가 없거나 형식이 깨졌으면 null */
export function formatDday(weddingDate: string | null | undefined, now: Date = new Date()): string | null {
  const days = daysUntil(weddingDate, now)
  if (days === null) return null
  if (days === 0) return "D-DAY"
  return days > 0 ? `D-${days}` : `D+${-days}`
}
