/**
 * .ics(iCalendar) 파일 생성 — app/api/ics/route.ts(서버, 실제 다운로드 응답)와
 * calendar-island.tsx(클라이언트, 링크 쿼리스트링 구성)가 공유한다.
 */

/** RFC5545 텍스트 이스케이프 (콤마/세미콜론/개행) */
export function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

/** "YYYY-MM-DD" + "HH:MM"(없으면 낮 12시로 폴백)을 캘린더 링크에 쓸 날짜/시각 부품으로 분해 */
export function parseWeddingDateTime(dateStr: string, timeStr?: string) {
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!dateMatch) return null
  const timeMatch = (timeStr || "").match(/^(\d{2}):(\d{2})/)
  return {
    y: Number(dateMatch[1]), mo: Number(dateMatch[2]), d: Number(dateMatch[3]),
    h: timeMatch ? Number(timeMatch[1]) : 12, mi: timeMatch ? Number(timeMatch[2]) : 0,
  }
}

/** 예식 소요시간은 관례상 2시간으로 고정한다(실제 종료 시각을 입력받는 필드가 없다 —
 * 굳이 새 필드를 만들 만큼 중요하지 않다). */
export function buildIcsText(opts: { title: string; location: string; dateStr: string; timeStr?: string }): string | null {
  const t = parseWeddingDateTime(opts.dateStr, opts.timeStr)
  if (!t) return null
  const pad = (n: number) => String(n).padStart(2, "0")
  const stamp = (h: number) => `${t.y}${pad(t.mo)}${pad(t.d)}T${pad(h)}${pad(t.mi)}00`
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT",
    `DTSTART;TZID=Asia/Seoul:${stamp(t.h)}`,
    `DTEND;TZID=Asia/Seoul:${stamp((t.h + 2) % 24)}`,
    `SUMMARY:${escapeIcsText(opts.title)}`,
    `LOCATION:${escapeIcsText(opts.location)}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n")
}
