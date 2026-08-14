"use client"

import { useEffect, useRef, useState } from "react"
import { soft, type SlotProps } from "./shared"

/* ----------------------------- Calendar ---------------------------- *
 * 달력 + D-day. 이전 버전 디자인(흰 카드 / 예식일 원형 강조 / DAYS·HOURS·MINUTES)을
 * 이식하고, wedding_date 에서 월 그리드를 동적으로 생성한다.
 * ------------------------------------------------------------------ */
const MONTHS_FULL = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"]

function getCalendarDays(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00")
  if (isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = date.getMonth() // 0-based
  const targetDay = date.getDate()
  const startOfWeek = new Date(year, month, 1).getDay()
  const totalDays = new Date(year, month + 1, 0).getDate()
  const days: (number | null)[] = []
  for (let i = 0; i < startOfWeek; i++) days.push(null)
  for (let i = 1; i <= totalDays; i++) days.push(i)
  return { year, month, targetDay, days, date }
}

/** RFC5545 텍스트 이스케이프 (콤마/세미콜론/개행) */
function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

/** "YYYY-MM-DD" + "HH:MM"(없으면 낮 12시로 폴백)을 캘린더 링크에 쓸 날짜/시각 부품으로 분해 */
function parseWeddingDateTime(dateStr: string, timeStr?: string) {
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!dateMatch) return null
  const timeMatch = (timeStr || "").match(/^(\d{2}):(\d{2})/)
  return {
    y: Number(dateMatch[1]), mo: Number(dateMatch[2]), d: Number(dateMatch[3]),
    h: timeMatch ? Number(timeMatch[1]) : 12, mi: timeMatch ? Number(timeMatch[2]) : 0,
  }
}

/** iOS/macOS 캘린더 앱이 여는 .ics 데이터 URI. 예식 소요시간은 관례상 2시간으로 고정한다
 * (실제 종료 시각을 입력받는 필드가 없다 — 굳이 새 필드를 만들 만큼 중요하지 않다). */
function buildIcsHref(opts: { title: string; location: string; dateStr: string; timeStr?: string }): string | null {
  const t = parseWeddingDateTime(opts.dateStr, opts.timeStr)
  if (!t) return null
  const pad = (n: number) => String(n).padStart(2, "0")
  const stamp = (h: number) => `${t.y}${pad(t.mo)}${pad(t.d)}T${pad(h)}${pad(t.mi)}00`
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT",
    `DTSTART;TZID=Asia/Seoul:${stamp(t.h)}`,
    `DTEND;TZID=Asia/Seoul:${stamp((t.h + 2) % 24)}`,
    `SUMMARY:${escapeIcsText(opts.title)}`,
    `LOCATION:${escapeIcsText(opts.location)}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n")
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`
}

/** 구글 캘린더 "일정 추가" 템플릿 링크 (안드로이드/데스크톱에서 .ics보다 UX가 매끄럽다) */
function buildGoogleCalendarHref(opts: { title: string; location: string; dateStr: string; timeStr?: string }): string | null {
  const t = parseWeddingDateTime(opts.dateStr, opts.timeStr)
  if (!t) return null
  const pad = (n: number) => String(n).padStart(2, "0")
  const stamp = (h: number) => `${t.y}${pad(t.mo)}${pad(t.d)}T${pad(h)}${pad(t.mi)}00`
  const params = new URLSearchParams({
    action: "TEMPLATE", text: opts.title, dates: `${stamp(t.h)}/${stamp((t.h + 2) % 24)}`,
    location: opts.location, ctz: "Asia/Seoul",
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** D-day 숫자가 처음 나타날 때 0에서 실제 값까지 한 번 굴러 올라간다. 그 이후(매분 자동
 * 갱신)는 애니메이션 없이 실제 값을 그대로 반영한다 — 매번 다시 구르면 산만해진다.
 * OS "동작 줄이기" 설정을 켠 하객에게는 애니메이션 없이 바로 최종 값을 보여준다. */
function RollingNumber({ value, enabled }: { value: number; enabled: boolean }) {
  const [display, setDisplay] = useState(value)
  const rolledRef = useRef(false)

  useEffect(() => {
    if (rolledRef.current) {
      setDisplay(value)
      return
    }
    rolledRef.current = true
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (!enabled || reduced) {
      setDisplay(value)
      return
    }
    let raf: number
    const duration = 700
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(value * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return <>{display}</>
}

/** 예식일 강조 표시 — 동그라미/하트/직접 업로드 중 선택 (ver1 기능 이식).
 * custom 이미지가 svg면 CSS mask로 색을 입히고, 그 외(png 등)는 이미지를 그대로 얹는다. */
function CalendarDayMarker({ day, accent, shape, size, textColor, svgColor, customUrl }: {
  day: number; accent: string; shape: "circle" | "heart" | "custom"; size: number
  textColor: string; svgColor: string; customUrl?: string
}) {
  const numberStyle: React.CSSProperties = { position: "relative", zIndex: 1, fontWeight: 700, color: textColor, fontSize: 12 }

  if (shape === "custom" && customUrl) {
    const isSvg = customUrl.toLowerCase().split("?")[0].endsWith(".svg")
    return (
      <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {isSvg ? (
          <div style={{
            position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", backgroundColor: svgColor,
            WebkitMaskImage: `url(${customUrl})`, maskImage: `url(${customUrl})`,
            WebkitMaskSize: "contain", maskSize: "contain",
            WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
            WebkitMaskPosition: "center", maskPosition: "center",
          } as React.CSSProperties} />
        ) : (
          <img src={customUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", zIndex: 0, pointerEvents: "none" }} />
        )}
        <span style={numberStyle}>{day}</span>
      </div>
    )
  }

  if (shape === "heart") {
    return (
      <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg viewBox="0 0 24 24" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none", fill: accent }}>
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
        <span style={numberStyle}>{day}</span>
      </div>
    )
  }

  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={numberStyle}>{day}</span>
    </div>
  )
}
function CalendarIsland({ accent, data, raw, blockOverrides }: SlotProps) {
  const dateStr = (typeof raw?.wedding_date === "string" ? raw.wedding_date : data.wedding_date) || ""
  const timeStr = (typeof raw?.wedding_time === "string" ? raw.wedding_time : data.wedding_time) || ""
  const ddayEnabled = blockOverrides?.calendar?.ddayEnabled !== false
  const ddayRollingEnabled = blockOverrides?.calendar?.ddayRollingEnabled === true
  const dayShape = blockOverrides?.calendar?.calendarDayShape || "circle"
  const dayShapeSize = blockOverrides?.calendar?.calendarDayShapeSize ?? 32
  const dayTextColor = blockOverrides?.calendar?.calendarDayTextColor || "#ffffff"
  const daySvgColor = blockOverrides?.calendar?.calendarDaySvgColor || accent
  const dayCustomUrl = blockOverrides?.calendar?.calendarDayCustomShapeUrl
  const [now, setNow] = useState(() => new Date())
  // 폼 입력값(wedding_date/wedding_time) 기준 기본값 — 관리자가 편집기 "블럭" 카드에서 직접 문구로
  // 덮어쓸 수 있다(§customize-client.tsx calendarDateText/calendarTimeText).
  const defaultDateText = dateStr ? `${dateStr.slice(0, 4)}년 ${dateStr.slice(5, 7)}월 ${dateStr.slice(8, 10)}일` : ""
  const defaultTimeText = [data.wedding_weekday, timeStr].filter(Boolean).join(" ")
  const dateText = blockOverrides?.calendar?.calendarDateText || defaultDateText
  const timeText = blockOverrides?.calendar?.calendarTimeText || defaultTimeText

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000) // 분 단위 갱신
    return () => clearInterval(t)
  }, [])

  const cal = dateStr ? getCalendarDays(dateStr) : null
  if (!cal) return null

  const diffMs = cal.date.getTime() - now.getTime()
  const totalMinutes = Math.max(0, Math.floor(diffMs / 60000))
  const daysLeft = Math.floor(totalMinutes / (60 * 24))
  const hoursLeft = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutesLeft = totalMinutes % 60

  return (
    <div>
      <div style={{ maxWidth: 320, margin: "0 auto", background: "#fff", padding: 16, color: "#000", borderRadius: 2, boxShadow: "0 4px 10px rgba(0,0,0,.05)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p style={{ fontSize: 20, fontWeight: 500, letterSpacing: ".15em", textTransform: "uppercase", color: accent, fontFamily: "var(--font-en, inherit)" }}>
            {MONTHS_FULL[cal.month]}
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: 12, textAlign: "center", fontSize: 12, fontWeight: 500, color: `color-mix(in srgb, ${accent} 55%, #ffffff)` }}>
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <div key={d} style={{ padding: "4px 0", opacity: 0.55, fontWeight: 600 }}>{d}</div>
          ))}
          {cal.days.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} />
            const isWeddingDay = day === cal.targetDay
            if (isWeddingDay) {
              return (
                <div key={i} style={{ margin: "0 auto" }}>
                  <CalendarDayMarker day={day} accent={accent} shape={dayShape} size={dayShapeSize} textColor={dayTextColor} svgColor={daySvgColor} customUrl={dayCustomUrl} />
                </div>
              )
            }
            return (
              <div key={i} style={{ padding: "4px 0", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, margin: "0 auto" }}>
                {day}
              </div>
            )
          })}
        </div>
        {(dateText || timeText) && (
          <div style={{ marginTop: 20, textAlign: "center" }}>
            {dateText && <p style={{ fontSize: 13, fontWeight: 600 }}>{dateText}</p>}
            {timeText && <p style={{ fontSize: 13, marginTop: 2, opacity: 0.7 }}>{timeText}</p>}
          </div>
        )}
      </div>

      {/* 캘린더 앱에 일정 추가 — iOS/macOS는 .ics 다운로드, 그 외엔 구글 캘린더 링크가 UX가 더 낫다.
          관리자가 편집기 "블럭" 카드에서 둘을 각각 켜고 끌 수 있다(§customize-client.tsx) — 미설정 시 둘 다 노출. */}
      {(() => {
        const title = [data.groom_name, data.bride_name].filter(Boolean).join(" ♥ ") + " 결혼식"
        const location = [data.venue_name, data.venue_address].filter(Boolean).join(" ")
        const icsEnabled = blockOverrides?.calendar?.icsButtonEnabled !== false
        const googleEnabled = blockOverrides?.calendar?.googleCalendarButtonEnabled !== false
        const icsHref = icsEnabled ? buildIcsHref({ title, location, dateStr, timeStr }) : null
        const googleHref = googleEnabled ? buildGoogleCalendarHref({ title, location, dateStr, timeStr }) : null
        if (!icsHref && !googleHref) return null
        const btnStyle: React.CSSProperties = {
          flex: 1, padding: "9px 0", borderRadius: 6, cursor: "pointer", textAlign: "center",
          border: `1px solid ${soft(60)}`, background: "transparent", color: "inherit", fontSize: 12,
          textDecoration: "none", display: "block",
        }
        return (
          <div style={{ display: "flex", gap: 6, marginTop: 10, maxWidth: 320, margin: "10px auto 0" }}>
            {icsHref && <a href={icsHref} download="wedding.ics" style={btnStyle}>캘린더 앱에 추가</a>}
            {googleHref && <a href={googleHref} target="_blank" rel="noopener noreferrer" style={btnStyle}>구글 캘린더</a>}
          </div>
        )
      })()}

      {/* D-day 카운트다운 */}
      {ddayEnabled && (
        <div style={{ marginTop: 48, paddingTop: 32, textAlign: "center", borderTop: `1px solid ${accent}` }}>
          <p style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 600, color: accent, marginBottom: 20, fontFamily: "var(--font-en, inherit)" }}>
            Days left
          </p>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 40, maxWidth: 280, margin: "0 auto", color: accent, fontFamily: "var(--font-en, inherit)" }}>
            {[["DAYS", daysLeft], ["HOURS", hoursLeft], ["MINUTES", minutesLeft]].map(([label, value]) => (
              <div key={String(label)} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <p style={{ fontSize: 14, letterSpacing: ".05em", opacity: 0.6 }}>{label}</p>
                <p style={{ fontSize: 36, marginTop: 4, lineHeight: 1 }}><RollingNumber value={value as number} enabled={ddayRollingEnabled} /></p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
export { CalendarIsland }
