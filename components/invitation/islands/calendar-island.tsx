"use client"

import { useEffect, useRef, useState } from "react"
import { soft, type SlotProps } from "./shared"
import { parseWeddingDateTime } from "@/lib/ics"
import { CALENDAR_BOX_DEFAULT } from "@/lib/theme-template"

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

/** 서버 라우트(§app/api/ics/route.ts)가 실제 .ics 파일을 Content-Disposition: attachment로
 * 내려준다 — data: URI를 <a download>로 직접 열던 예전 방식은 iOS Safari/Chrome이 top-level
 * data: 다운로드를 막아 상당수 하객에게 무반응이었다. */
function buildIcsDownloadHref(opts: { title: string; location: string; dateStr: string; timeStr?: string }): string | null {
  if (!parseWeddingDateTime(opts.dateStr, opts.timeStr)) return null
  const params = new URLSearchParams({ title: opts.title, location: opts.location, date: opts.dateStr })
  if (opts.timeStr) params.set("time", opts.timeStr)
  return `/api/ics?${params.toString()}`
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
/**
 * "#bebebe" + 76 → "rgba(190, 190, 190, 0.76)".
 * 3자리 축약형(#abc)도 받는다. 해석할 수 없으면 원문을 그대로 돌려준다 —
 * 색을 못 읽었다고 배경을 투명하게 만들면 달력 글자가 배경에 묻힌다.
 */
function hexToRgba(hex: string, opacityPct: number): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1]
  const n = parseInt(h, 16)
  const a = Math.min(100, Math.max(0, opacityPct)) / 100
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
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
  const boxColor = blockOverrides?.calendar?.calendarBoxColor || CALENDAR_BOX_DEFAULT.color
  const boxOpacity = blockOverrides?.calendar?.calendarBoxOpacity ?? CALENDAR_BOX_DEFAULT.opacity
  // 배경에만 알파를 먹인다 — 박스에 CSS opacity 를 주면 날짜 숫자와 강조 표시까지 흐려진다
  const boxBackground = hexToRgba(boxColor, boxOpacity)
  /**
   * 달력 글자색을 테마가 가로챌 수 있게 하는 두 토큰.
   *
   * 이 아일랜드는 모든 테마가 함께 쓰므로 색을 여기서 못 박으면 어느 한 테마에는
   * 반드시 안 맞는다. 예전에는 박스 안이 #000 으로 고정돼 있어, 섹션 배경을 두 색으로
   * 번갈아 칠하는 테마에서 배치별 글자색을 지정해도 달력만 검정으로 남았다.
   *
   * 값이 없으면 예전 그대로다 — 토큰을 선언하지 않은 테마는 아무것도 변하지 않는다.
   * color-atelier 는 두 토큰을 currentColor 로 선언해 섹션 글자색을 따라가게 한다.
   */
  const INK = "var(--calendar-ink, #000)"
  const accentInk = `var(--calendar-accent-ink, ${accent})`
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
      {/* 글자색을 테마가 가로챌 수 있게 토큰으로 연다(§calendar-island 상단 주석).
          값이 없으면 예전 그대로 검정이라 다른 테마는 변하지 않는다. */}
      <div style={{ maxWidth: 320, margin: "0 auto", background: boxBackground, padding: 16, color: INK, borderRadius: 2, boxShadow: "0 4px 10px rgba(0,0,0,.05)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p style={{ fontSize: 20, fontWeight: 500, letterSpacing: ".15em", textTransform: "uppercase", color: accentInk, fontFamily: "var(--font-en, inherit)" }}>
            {MONTHS_FULL[cal.month]}
          </p>
        </div>
        {/* 격자에 색을 주지 않는다 — 날짜 숫자는 박스 글자색을 그대로 쓰고,
            흐리게 할 것은 아래 요일 라벨뿐이다(자체 opacity 0.55). */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: 12, textAlign: "center", fontSize: 12, fontWeight: 500 }}>
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
        const icsHref = icsEnabled ? buildIcsDownloadHref({ title, location, dateStr, timeStr }) : null
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
        <div style={{ marginTop: 48, paddingTop: 32, textAlign: "center", borderTop: `1px solid ${accentInk}` }}>
          <p style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 600, color: accentInk, marginBottom: 20, fontFamily: "var(--font-en, inherit)" }}>
            Days left
          </p>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 40, maxWidth: 280, margin: "0 auto", color: accentInk, fontFamily: "var(--font-en, inherit)" }}>
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
