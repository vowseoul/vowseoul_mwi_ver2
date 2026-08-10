"use client"

import { useEffect, useRef, useState } from "react"
import type { FieldData, BlockOverrideMap } from "./invitation-frame"
import type { RawInvitationData } from "@/lib/invitation-data"
import { supabase } from "@/lib/supabase"
import { ConsentNotice } from "./consent-notice"
import { CONSENT_VERSION, RSVP_CONSENT_COPY, GUESTBOOK_CONSENT_COPY } from "@/lib/privacy-consent"
import { hashPassword } from "@/lib/dashboard-password"

/**
 * 슬롯 레지스트리 — "기능 조합"의 핵심.
 *
 * 테마 템플릿이 [data-slot="키"] 로 필요한 기능만 선언하면,
 * 이 레지스트리가 해당 키에 맞는 React 인터랙션 컴포넌트를 자동 마운트한다.
 * → 테마마다 다른 기능 조합을 데이터로 선택 가능.
 * → 인터랙션 로직은 이곳 한 곳에서만 관리되어 발행/미리보기 간 드리프트가 없다.
 *
 * 각 아일랜드는 iframe 내부(별도 realm)에 portal로 렌더되므로 인라인 스타일을 사용하고,
 * 색은 테마에 자연스럽게 녹아들도록 accent + currentColor 를 조합한다.
 *
 * ※ 훅은 반드시 컴포넌트 최상단에서 조건 없이 선언한다 (React error #310 방지).
 */

export interface SlotProps {
  accent: string
  data: FieldData
  /** 배열/객체(gallery_images, sequence_events 등)를 포함한 원본 데이터 */
  raw?: RawInvitationData
  /** 실제 청첩장 렌더 시 전달. 있으면 RSVP가 DB에 저장된다(없으면 미리보기 모드) */
  invitationId?: string
  /** 블럭별 오버라이드 (§rsvp 블럭의 mealEnabled/shuttleEnabled 서브옵션에 사용) */
  blockOverrides?: BlockOverrideMap
}

/** currentColor 기반 반투명 색 (테마 색을 그대로 따라감) */
const soft = (pct: number) => `color-mix(in srgb, currentColor ${pct}%, transparent)`

/* ------------------------------- BGM ------------------------------- *
 * 이전 버전에서 안정적으로 동작하던 로직을 그대로 이식.
 * 자동재생을 시도하고, 브라우저 정책으로 막히면 첫 클릭/터치에 재생한다.
 * iframe 내부에 렌더되므로 이벤트는 iframe 문서에도 함께 등록한다.
 * ------------------------------------------------------------------ */
/** 모든 BgmIsland 인스턴스가 공유하는 "현재 재생 중인 오디오" 싱글턴.
 * 테마 전환 시 iframe이 다시 write()되며 포탈 대상이 바뀌는 타이밍에 따라 이전 인스턴스의
 * cleanup이 새 인스턴스의 재생 시작보다 늦게(또는 아예 누락되어) 실행되는 경우가 있어,
 * 인스턴스별 ref만으로는 두 음원이 겹쳐 재생되거나 화면에서 사라진 이전 음원을 끌 방법이
 * 없어지는 문제가 있었다. 새 오디오를 재생하기 전 항상 이 싱글턴부터 정지시켜 "동시에
 * 최대 한 개만 재생된다"를 인스턴스 생명주기와 무관하게 구조적으로 보장한다. */
let currentBgmAudio: HTMLAudioElement | null = null
function stopCurrentBgm() {
  currentBgmAudio?.pause()
  currentBgmAudio = null
}

function BgmIsland({ accent, data, raw }: SlotProps) {
  const bgmUrl = (typeof raw?.bgm_url === "string" ? raw.bgm_url : undefined) || data.bgm_url || ""
  const [isPlaying, setIsPlaying] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const anchorRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    let playOnInteraction: (() => void) | null = null
    // 아일랜드가 속한 문서(iframe) + 부모 문서 모두에 폴백 리스너 등록
    const docs: Document[] = []
    const own = anchorRef.current?.ownerDocument
    if (own) docs.push(own)
    if (typeof document !== "undefined" && own !== document) docs.push(document)

    if (bgmUrl && isPlaying) {
      if (!audioRef.current || audioRef.current.src !== bgmUrl) {
        stopCurrentBgm()
        audioRef.current = new Audio(bgmUrl)
        audioRef.current.loop = true
      }
      currentBgmAudio = audioRef.current

      audioRef.current.play().catch(() => {
        // 자동재생 차단 → 첫 사용자 상호작용에 재생
        playOnInteraction = () => {
          audioRef.current?.play().then(() => {
            if (playOnInteraction) {
              docs.forEach((d) => {
                d.removeEventListener("click", playOnInteraction!)
                d.removeEventListener("touchstart", playOnInteraction!)
              })
            }
          }).catch(() => { /* 재시도 실패는 무시 */ })
        }
        docs.forEach((d) => {
          d.addEventListener("click", playOnInteraction!)
          d.addEventListener("touchstart", playOnInteraction!)
        })
      })
    } else if (audioRef.current) {
      audioRef.current.pause()
      if (currentBgmAudio === audioRef.current) currentBgmAudio = null
    }

    return () => {
      audioRef.current?.pause()
      if (currentBgmAudio === audioRef.current) currentBgmAudio = null
      if (playOnInteraction) {
        docs.forEach((d) => {
          d.removeEventListener("click", playOnInteraction!)
          d.removeEventListener("touchstart", playOnInteraction!)
        })
      }
    }
  }, [bgmUrl, isPlaying])

  if (!bgmUrl) return <button ref={anchorRef} style={{ display: "none" }} aria-hidden />

  return (
    <button
      ref={anchorRef}
      onClick={() => setIsPlaying((p) => !p)}
      aria-label={isPlaying ? "배경음악 일시정지" : "배경음악 재생"}
      style={{
        position: "fixed", top: 16, right: 16, zIndex: 50,
        width: 40, height: 40, borderRadius: "50%", cursor: "pointer",
        background: "rgba(255,255,255,.8)", backdropFilter: "blur(4px)",
        border: "1px solid rgba(0,0,0,.08)", boxShadow: "0 4px 12px rgba(0,0,0,.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: isPlaying ? accent : "#9ca3af", fontSize: 13, lineHeight: 1,
      }}
    >
      {isPlaying ? "❚❚" : "♪"}
    </button>
  )
}

/* ----------------------------- Sequence ---------------------------- *
 * 식순 안내. 이전 버전 Pink Envelope 표 디자인(시간 열 + 구분선)을 이식하고,
 * 데이터는 raw.sequence_events 에서 동적으로 받는다.
 * ------------------------------------------------------------------ */
type SequenceEvent = { time: string; title: string }

/** 다양한 입력 형태를 {time,title} 로 정규화 (timentext "12:00 | 입장" 포함) */
function normalizeSequence(value: unknown): SequenceEvent[] {
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

const DEFAULT_SEQUENCE: SequenceEvent[] = [
  { time: "11:00", title: "하객 맞이 및 로비 안내" },
  { time: "11:30", title: "개식사 및 화촉점화" },
  { time: "11:35", title: "신랑 신부 입장" },
  { time: "11:45", title: "혼인서약 및 성혼선언문 낭독" },
  { time: "12:00", title: "축가 및 하객 인사" },
  { time: "12:15", title: "신랑 신부 행진 및 피로연" },
]

/** 토글 필드 값 판정 ('예'/'아니오' 문자열 또는 boolean) */
function isToggledOff(value: unknown): boolean {
  if (value == null) return false // 미설정은 '표시'로 간주
  // 폼 필드 카탈로그의 토글 선택지가 "아니오"/"아니요"로 통일돼 있지 않아 둘 다 받는다
  // (예: show_direction 필드는 "아니요"로 등록돼 있음).
  return value === false || value === "false" || value === "아니오" || value === "아니요" || value === "off"
}

function SequenceIsland({ raw }: SlotProps) {
  // show_wedding_program 토글이 '아니오'면 식순 섹션을 렌더하지 않는다
  if (isToggledOff(raw?.show_wedding_program)) return null

  // 실제 필드키: wedding_programs (timentext → [{time, text}])
  const events = normalizeSequence(raw?.wedding_programs ?? raw?.sequence_events)
  const list = events.length > 0 ? events : DEFAULT_SEQUENCE

  return (
    <div style={{ maxWidth: 320, margin: "0 auto", borderTop: `1px solid ${soft(80)}`, borderBottom: `1px solid ${soft(80)}` }}>
      {list.map((e, i) => (
        <div key={i} style={{ display: "flex", alignItems: "stretch", borderBottom: i === list.length - 1 ? "none" : `1px solid ${soft(40)}` }}>
          <div style={{
            width: 90, padding: "12px 0", textAlign: "center", fontSize: 14, fontWeight: 300,
            borderRight: `1px solid ${soft(40)}`, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-en, ui-monospace, monospace)", opacity: 0.9,
          }}>
            {e.time}
          </div>
          <div style={{ flex: 1, padding: "12px 16px", textAlign: "left", fontSize: 14, display: "flex", alignItems: "center" }}>
            {e.title}
          </div>
        </div>
      ))}
    </div>
  )
}

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

function CalendarIsland({ accent, data, raw, blockOverrides }: SlotProps) {
  const dateStr = (typeof raw?.wedding_date === "string" ? raw.wedding_date : data.wedding_date) || ""
  const timeStr = (typeof raw?.wedding_time === "string" ? raw.wedding_time : data.wedding_time) || ""
  const ddayEnabled = blockOverrides?.calendar?.ddayEnabled !== false
  const [now, setNow] = useState(() => new Date())

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
            return (
              <div
                key={i}
                style={{
                  padding: "4px 0", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, margin: "0 auto",
                  ...(isWeddingDay ? { borderRadius: "50%", fontWeight: 700, color: "#fff", background: accent } : null),
                }}
              >
                {day}
              </div>
            )
          })}
        </div>
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
                <p style={{ fontSize: 36, marginTop: 4, lineHeight: 1 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ----------------------------- Gallery -----------------------------
 * 뷰 타입 2종(이전 버전 invitation-client.tsx 구조 참고):
 *  - slide: 가로 스크롤 스냅 스트립. 감싸는 박스 여백/모서리 없이 object-fit:cover 로
 *    사진 형태와 무관하게 꽉 채워 배치하고, gallery_align('center'|'bottom')으로
 *    세로 크롭 기준점을 고른다(인물 전신 사진 등에서 하단을 살리고 싶을 때 사용).
 *  - grid : 2열 그리드, object-cover (정방형 썸네일)
 * raw.gallery_view_type ('slide' | 'grid', 기본 slide) 로 선택.
 * 모서리 둥글기(border-radius)는 두 방식 모두 사용하지 않는다.
 * ------------------------------------------------------------------ */
const SAMPLE_GALLERY = [
  "https://images.unsplash.com/photo-1519741497674-611481863552?w=500&q=80",
  "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=500&q=80",
  "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=500&q=80",
  "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=500&q=80",
]
function GalleryIsland({ raw }: SlotProps) {
  const rawImages = raw?.gallery_images
  const images = Array.isArray(rawImages) && rawImages.length > 0
    ? rawImages.filter((u): u is string => typeof u === "string")
    : SAMPLE_GALLERY
  const isGrid = raw?.gallery_view_type === "grid"
  const objectPosition = raw?.gallery_align === "bottom" ? "center bottom" : "center center"

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const prev = () => setLightboxIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length))
  const next = () => setLightboxIndex((i) => (i === null ? null : (i + 1) % images.length))

  // 라이트박스가 열려있을 때 ESC/방향키 조작 — iframe(별도 realm)에 포탈되므로
  // BgmIsland 와 동일하게 이 아일랜드가 속한 문서에 직접 리스너를 건다.
  useEffect(() => {
    if (lightboxIndex === null) return
    const doc = rootRef.current?.ownerDocument
    if (!doc) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null)
      else if (e.key === "ArrowLeft") prev()
      else if (e.key === "ArrowRight") next()
    }
    doc.addEventListener("keydown", onKeyDown)
    return () => doc.removeEventListener("keydown", onKeyDown)
  }, [lightboxIndex, images.length])

  const thumbnails = isGrid ? (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, width: "100%" }}>
      {images.map((src, i) => (
        <div key={i} onClick={() => setLightboxIndex(i)} style={{ aspectRatio: "1/1", overflow: "hidden", cursor: "pointer" }}>
          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition }} />
        </div>
      ))}
    </div>
  ) : (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", width: "100%", paddingBottom: 8, scrollSnapType: "x mandatory" }}>
      {images.map((src, i) => (
        <div
          key={i}
          onClick={() => setLightboxIndex(i)}
          style={{ width: 220, height: 280, flexShrink: 0, scrollSnapAlign: "center", overflow: "hidden", cursor: "pointer" }}
        >
          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition }} />
        </div>
      ))}
    </div>
  )

  const navBtnStyle: React.CSSProperties = {
    position: "absolute", top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%",
    border: "none", background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 22, lineHeight: 1, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  }

  return (
    <div ref={rootRef}>
      {thumbnails}
      {lightboxIndex !== null && (
        <div
          onClick={() => setLightboxIndex(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,.92)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null) }}
            style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 16, cursor: "pointer" }}
            aria-label="닫기"
          >
            ✕
          </button>
          {images.length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); prev() }} style={{ ...navBtnStyle, left: 12 }} aria-label="이전 사진">‹</button>
          )}
          <img
            src={images[lightboxIndex]}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "100%", maxHeight: "85vh", objectFit: "contain" }}
          />
          {images.length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); next() }} style={{ ...navBtnStyle, right: 12 }} aria-label="다음 사진">›</button>
          )}
          {images.length > 1 && (
            <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", color: "#fff", fontSize: 12, opacity: 0.8 }}>
              {lightboxIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ----------------------------- Account ----------------------------- */
function composeAccount(bank?: string, number?: string, holder?: string): string {
  return [bank, number, holder].filter(Boolean).join(" ")
}
function AccountRow({ label, value, accent }: { label: string; value: string; accent: string }) {
  const [copied, setCopied] = useState(false)
  const numericValue = value.replace(/[^0-9]/g, "")
  const copy = () => {
    navigator.clipboard?.writeText(numericValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  // 계좌번호만 복사해두고 카카오페이/토스 앱을 열어준다 — 은행마다 다른 공식 송금 API 없이도
  // 이 딥링크들로 앱이 열리므로, 사용자가 그 안에서 붙여넣기만 하면 된다. 계좌번호+금액을
  // 앱에 바로 채워 넣는 방식(예: supertoss://send?bank=..&accountNo=..)은 은행명을 각 앱의
  // 비공식 은행 코드로 정확히 매핑해야 해서 은행별로 조용히 틀린 화면이 열릴 위험이 있다 —
  // "복사 + 앱 열기"가 덜 매끄럽지만 모든 은행에서 항상 정확하게 동작한다.
  // 데스크톱처럼 해당 앱이 없는 환경에서는 딥링크가 그냥 무시되고 복사만 남는다(항상 안전한 폴백).
  const sendViaKakaoPay = () => {
    navigator.clipboard?.writeText(numericValue)
    window.location.href = "kakaotalk://kakaopay/home"
  }
  const sendViaToss = () => {
    navigator.clipboard?.writeText(numericValue)
    window.location.href = "supertoss://send"
  }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${soft(25)}`, gap: 8 }}>
      <div style={{ textAlign: "left", minWidth: 0 }}>
        <div style={{ fontSize: 11, opacity: 0.6 }}>{label}</div>
        <div style={{ fontSize: 13.5 }}>{value}</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button onClick={sendViaKakaoPay} style={{
          padding: "6px 10px", borderRadius: 7, cursor: "pointer", whiteSpace: "nowrap",
          border: "1px solid #FFE300", background: "#FFE300", color: "#3C1E1E", fontSize: 11.5, fontWeight: 600,
        }}>
          카카오페이
        </button>
        <button onClick={sendViaToss} style={{
          padding: "6px 10px", borderRadius: 7, cursor: "pointer", whiteSpace: "nowrap",
          border: "1px solid #0064FF", background: "#0064FF", color: "#fff", fontSize: 11.5, fontWeight: 600,
        }}>
          토스
        </button>
        <button onClick={copy} style={{
          padding: "6px 12px", borderRadius: 7, cursor: "pointer", whiteSpace: "nowrap",
          border: `1px solid ${accent}`, background: copied ? accent : "transparent",
          color: copied ? "#fff" : accent, fontSize: 12,
        }}>
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
    </div>
  )
}
/** 혼주(부모) 계좌 — 은행/번호/예금주를 나눠 받는 본인 계좌와 달리, 부모 쪽은 계좌 수가
 * 정해져 있지 않아(아버지·어머니 각각 또는 한쪽만) 관리자가 자유 형식 텍스트로 입력한다.
 * 숫자만 추출하는 기존 복사 방식은 여러 줄/여러 계좌가 섞인 텍스트에 맞지 않아 원문 그대로 복사한다.
 */
function ExtraAccountRow({ label, value, accent }: { label: string; value: string; accent: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${soft(25)}`, gap: 8 }}>
      <div style={{ textAlign: "left", minWidth: 0 }}>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13.5, whiteSpace: "pre-line" }}>{value}</div>
      </div>
      <button onClick={copy} style={{
        padding: "6px 12px", borderRadius: 7, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
        border: `1px solid ${accent}`, background: copied ? accent : "transparent",
        color: copied ? "#fff" : accent, fontSize: 12,
      }}>
        {copied ? "복사됨" : "복사"}
      </button>
    </div>
  )
}
function AccountIsland({ accent, data }: SlotProps) {
  const groom = composeAccount(data.account_groom_bank, data.account_groom_number, data.account_groom_holder)
  const bride = composeAccount(data.account_bride_bank, data.account_bride_number, data.account_bride_holder)
  const extraGroom = data.extra_account_groom
  const extraBride = data.extra_account_bride
  const hasAny = groom || bride || extraGroom || extraBride
  return (
    <div style={{ textAlign: "left", maxWidth: 320, margin: "0 auto" }}>
      {groom && <AccountRow label="신랑측" value={groom} accent={accent} />}
      {bride && <AccountRow label="신부측" value={bride} accent={accent} />}
      {extraGroom && <ExtraAccountRow label="신랑측 혼주" value={extraGroom} accent={accent} />}
      {extraBride && <ExtraAccountRow label="신부측 혼주" value={extraBride} accent={accent} />}
      {!hasAny && <div style={{ fontSize: 12, opacity: 0.6, padding: "8px 0" }}>등록된 계좌 정보가 없습니다.</div>}
    </div>
  )
}

/* ----------------------------- Contact ------------------------------
 * 신랑·신부·혼주 연락처. 폼에서 이미 수집되던 phone_expose·전화번호 필드들이
 * 지금까지 렌더 경로가 없어 아무 데도 표시되지 않았다 — 이 슬롯이 그 값을 받는다.
 * phone_expose 가 '아니오'/false 로 꺼져있으면(미설정은 표시로 간주) 섹션 자체를 숨긴다.
 * ------------------------------------------------------------------ */
/** 폼에 "@" 포함/미포함, 전체 URL 등 여러 형태로 들어올 수 있는 인스타그램 값을 핸들만 남겨 정리한다 */
function normalizeInstagramHandle(raw?: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const afterUrl = trimmed.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
  const handle = afterUrl.replace(/^@/, "").replace(/\/$/, "")
  return handle || null
}

function ContactRow({ label, name, phone, instagram, accent }: { label: string; name?: string; phone: string; instagram?: string; accent: string }) {
  const linkStyle: React.CSSProperties = {
    padding: "6px 12px", borderRadius: 7, whiteSpace: "nowrap", textDecoration: "none",
    border: `1px solid ${accent}`, color: accent, fontSize: 12, display: "inline-flex", alignItems: "center",
  }
  const handle = normalizeInstagramHandle(instagram)
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${soft(25)}`, gap: 8 }}>
      <div style={{ textAlign: "left", minWidth: 0 }}>
        <div style={{ fontSize: 11, opacity: 0.6 }}>{name ? `${label} · ${name}` : label}</div>
        <div style={{ fontSize: 13.5 }}>{phone}</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <a href={`tel:${phone}`} style={linkStyle}>전화</a>
        <a href={`sms:${phone}`} style={linkStyle}>문자</a>
        {handle && <a href={`https://instagram.com/${handle}`} target="_blank" rel="noreferrer" style={linkStyle}>인스타</a>}
      </div>
    </div>
  )
}
function ContactIsland({ accent, data }: SlotProps) {
  if (isToggledOff(data.phone_expose)) return null
  const rows = [
    // 신랑·신부 본인은 전체 스위치가 켜져 있어도 개별로 더 숨길 수 있다(groom_show_phone/bride_show_phone).
    // 혼주(부모) 연락처는 개별 토글이 없어 전체 스위치만 따른다.
    { label: "신랑", name: data.groom_name, phone: isToggledOff(data.groom_show_phone) ? "" : data.groom_phone, instagram: data.groom_sns_instagram },
    { label: "신부", name: data.bride_name, phone: isToggledOff(data.bride_show_phone) ? "" : data.bride_phone, instagram: data.bride_sns_instagram },
    { label: "신랑 아버지", name: data.groom_father_name, phone: data.groom_father_phone },
    { label: "신랑 어머니", name: data.groom_mother_name, phone: data.groom_mother_phone },
    { label: "신부 아버지", name: data.bride_father_name, phone: data.bride_father_phone },
    { label: "신부 어머니", name: data.bride_mother_name, phone: data.bride_mother_phone },
  ].filter((r) => !!r.phone)

  if (rows.length === 0) return null
  return (
    <div style={{ textAlign: "left", maxWidth: 320, margin: "0 auto" }}>
      {rows.map((r) => (
        <ContactRow key={r.label} label={r.label} name={r.name} phone={r.phone} instagram={r.instagram} accent={accent} />
      ))}
    </div>
  )
}

/* ------------------------------- Map --------------------------------
 * 네이버 지도(NCP Maps) 연동. iframe(별도 realm) 안에 렌더되므로
 * 지도 스크립트도 iframe 자신의 문서(mapRef.current.ownerDocument)에 로드해야
 * 그 문서의 window.naver 에서 접근할 수 있다. 지오코딩은 서버의 /api/geocode
 * 라우트(NCP 인증키를 감추는 프록시)를 통해 top realm에서 그대로 fetch한다.
 * ------------------------------------------------------------------ */
const NAVER_MAPS_SCRIPT_ID = "naver-maps-script"
const NAVER_CLIENT_ID = "od370yq3ix"

function MapIsland({ accent, data }: SlotProps) {
  const address = data.venue_address || ""
  const venueName = data.venue_name || ""
  const mapRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    if (!address || !mapRef.current) return
    const ownerDoc = mapRef.current.ownerDocument
    const ownerWin = ownerDoc?.defaultView as (Window & { naver?: any }) | null | undefined
    if (!ownerDoc || !ownerWin) return

    let cancelled = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null

    const ensureScript = () => new Promise<void>((resolve) => {
      if (ownerWin.naver?.maps) { resolve(); return }
      const existing = ownerDoc.getElementById(NAVER_MAPS_SCRIPT_ID) as HTMLScriptElement | null
      if (existing) {
        existing.addEventListener("load", () => resolve())
        return
      }
      const script = ownerDoc.createElement("script")
      script.id = NAVER_MAPS_SCRIPT_ID
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_CLIENT_ID}`
      script.async = true
      script.onload = () => resolve()
      ownerDoc.head.appendChild(script)
    })

    const waitForNaver = () => new Promise<void>((resolve) => {
      const check = () => {
        if (ownerWin.naver?.maps?.LatLng) { resolve(); return }
        pollTimer = setTimeout(check, 150)
      }
      check()
    })

    ;(async () => {
      await ensureScript()
      if (cancelled) return
      await waitForNaver()
      if (cancelled) return

      try {
        const res = await fetch(`/api/geocode?query=${encodeURIComponent(address)}`)
        if (!res.ok) { if (!cancelled) setMapError(true); return }
        const json = await res.json()
        const item = json?.addresses?.[0]
        if (!item || cancelled || !mapRef.current) { if (!cancelled) setMapError(true); return }

        const lat = parseFloat(item.y)
        const lng = parseFloat(item.x)
        const naver = ownerWin.naver
        const center = new naver.maps.LatLng(lat, lng)
        const map = new naver.maps.Map(mapRef.current, { center, zoom: 16, zoomControl: false })
        new naver.maps.Marker({ position: center, map, title: venueName })
        setCoords({ lat, lng })
        setMapError(false)
      } catch {
        if (!cancelled) setMapError(true)
      }
    })()

    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [address, venueName])

  const copy = () => {
    navigator.clipboard?.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const openNaver = () => window.open(`https://map.naver.com/v5/search/${encodeURIComponent(address)}`, "_blank")
  const openKakao = () => {
    const url = coords
      ? `https://map.kakao.com/link/to/${encodeURIComponent(venueName)},${coords.lat},${coords.lng}`
      : `https://map.kakao.com/?q=${encodeURIComponent(address)}`
    window.open(url, "_blank")
  }
  const openTmap = () => {
    if (!coords) return
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile) {
      window.location.href = `tmap://route?goalx=${coords.lng}&goaly=${coords.lat}&goalname=${encodeURIComponent(venueName)}`
      setTimeout(openNaver, 1500)
    } else {
      openNaver()
    }
  }

  const navBtn: React.CSSProperties = {
    flex: 1, padding: "9px 0", borderRadius: 6, cursor: "pointer", textAlign: "center",
    border: `1px solid ${soft(60)}`, background: "transparent", color: "inherit", fontSize: 12,
  }

  return (
    <div style={{ width: "100%", maxWidth: 320, margin: "0 auto" }}>
      {!address || mapError ? (
        <div style={{
          aspectRatio: "16/10", borderRadius: 4, overflow: "hidden",
          background: "repeating-linear-gradient(45deg, #efe7e2, #efe7e2 10px, #e7ddd6 10px, #e7ddd6 20px)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#9a8f88", fontSize: 12,
        }}>
          {address ? "지도를 불러올 수 없습니다" : "주소가 등록되지 않았습니다"}
        </div>
      ) : (
        <div ref={mapRef} style={{ width: "100%", aspectRatio: "16/10", borderRadius: 4, overflow: "hidden", background: "#eee" }} />
      )}

      {address && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button onClick={openNaver} style={navBtn}>네이버지도</button>
          <button onClick={openKakao} style={navBtn}>카카오맵</button>
          <button onClick={openTmap} style={navBtn}>티맵</button>
        </div>
      )}

      {address && (
        <button onClick={copy} style={{
          marginTop: 8, width: "100%", padding: "10px 0", borderRadius: 6, cursor: "pointer",
          border: `1px solid ${accent}`, background: copied ? accent : "transparent",
          color: copied ? "#fff" : accent, fontSize: 13,
        }}>
          {copied ? "주소가 복사되었습니다" : "주소 복사하기"}
        </button>
      )}
    </div>
  )
}

/** 관리자가 rsvp_meal_menu에 입력한 자유 텍스트("한식, 양식, 어린이 메뉴" 등)를
 * 콤마/세미콜론/줄바꿈 기준으로 나눠 커스텀 식사 옵션 목록을 만든다.
 * 입력이 없으면 null을 반환해 호출부가 기존 기본값(한식/양식)을 쓰도록 한다. */
function parseMealMenu(raw?: string): string[] | null {
  if (!raw) return null
  const items = raw.split(/[,;\n、]/).map((s) => s.trim()).filter(Boolean)
  return items.length > 0 ? items : null
}

const MEAL_NONE = "__meal_none__"

/* ------------------------------- RSVP ------------------------------ *
 * 이전 버전 UX(트리거 버튼 → 모달 폼)를 이식하되, 저장은 새 스키마
 * rsvp_responses 테이블에 맞춰 구현. invitationId 가 없으면 미리보기 모드.
 * ------------------------------------------------------------------ */
function RsvpIsland({ accent, data, invitationId, blockOverrides }: SlotProps) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 관리자가 콘텐츠 편집기에서 식사 종류를 직접 입력했으면 그 목록을, 아니면
  // 기존 기본값(한식/양식)을 쓴다 — "안함"은 항상 마지막에 별도로 붙는다.
  const mealMenu = parseMealMenu(data.rsvp_meal_menu) ?? ["한식", "양식"]

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [attending, setAttending] = useState<"yes" | "no">("yes")
  const [side, setSide] = useState<"groom" | "bride">("groom")
  const [partySize, setPartySize] = useState(1)
  const [mealChoice, setMealChoice] = useState<string>(mealMenu[0])
  const [shuttleUsed, setShuttleUsed] = useState(false)
  const [consentAgreed, setConsentAgreed] = useState(false)

  // 응답 취소(삭제) — 개인정보 보호법 제36조 대응. cancelPhone은 전용 입력칸이지만
  // done 화면에서는 방금 제출한 phone을 그대로 재사용해 다시 입력할 필요가 없게 한다.
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelPhone, setCancelPhone] = useState("")
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelDone, setCancelDone] = useState(false)

  // rsvp_responses.meal_choice/shuttle_required 컬럼은 이미 있었지만 이 폼이 값을
  // 채운 적이 없어 신랑신부 대시보드의 식사·셔틀 집계가 항상 비어 있었다 — 여기서 채운다.
  // 관리자가 편집기 "블럭" 카드에서 청첩장별로 끌 수 있다(§customize-client.tsx) — 미설정 시 노출.
  const rsvpOverride = blockOverrides?.rsvp
  const mealEnabled = rsvpOverride?.mealEnabled !== false
  const shuttleEnabled = rsvpOverride?.shuttleEnabled !== false

  // 마감일은 "그날 자정까지"로 취급한다 — 하객이 마감일 당일에도 자정 전까지는 응답할 수 있어야 한다.
  const deadline = rsvpOverride?.rsvpDeadline ? new Date(`${rsvpOverride.rsvpDeadline}T23:59:59`) : null
  const isPastDeadline = !!deadline && deadline.getTime() < Date.now()
  const daysUntilDeadline = deadline ? Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
  const deadlineLabel = deadline ? `${deadline.getMonth() + 1}월 ${deadline.getDate()}일` : null

  const submit = async () => {
    if (!name.trim()) { setError("성함을 입력해주세요."); return }
    if (!phone.trim()) { setError("연락처를 입력해주세요."); return }
    if (!consentAgreed) { setError("개인정보 수집·이용에 동의해주세요."); return }
    setError(null); setSaving(true)

    if (invitationId) {
      const isAttending = attending === "yes"
      const wantsMeal = isAttending && mealEnabled && mealChoice !== MEAL_NONE
      // 같은 사람이 여러 번 제출하면(재확인, 답 변경 등) 새 행을 쌓지 않고 기존 응답을
      // 덮어쓴다 — invitation_id + 전화번호 조합으로 판별한다(§DB의 upsert_rsvp_response,
      // rsvp_responses_invitation_phone_key 유니크 인덱스). rsvp_responses는 RLS상 anon이
      // INSERT만 가능해 클라이언트가 직접 "이미 있으면 UPDATE"를 판단할 수 없으므로 RPC로 위임한다.
      const { error: err } = await supabase.rpc("upsert_rsvp_response", {
        p_invitation_id: invitationId,
        p_guest_name: name.trim(),
        p_phone: phone.trim(),
        p_side: side,
        p_is_attending: isAttending,
        p_party_size: isAttending ? partySize : 0,
        p_meal_required: wantsMeal,
        p_meal_choice: wantsMeal ? mealChoice : null,
        p_shuttle_required: isAttending && shuttleEnabled ? shuttleUsed : false,
        p_consent_version: CONSENT_VERSION,
      })
      if (err) { setSaving(false); setError("전송에 실패했습니다. 잠시 후 다시 시도해주세요."); return }
    }
    setSaving(false); setDone(true); setOpen(false)
  }

  // 응답 취소 — invitation_id + 전화번호로 본인 응답을 찾아 삭제한다(§app/api/rsvp-cancel/route.ts).
  const cancelRsvp = async (targetPhone: string) => {
    if (!targetPhone.trim()) { setCancelError("연락처를 입력해주세요."); return }
    if (!invitationId) return
    setCancelBusy(true); setCancelError(null)
    try {
      const res = await fetch("/api/rsvp-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, phone: targetPhone.trim() }),
      })
      if (res.ok) {
        setCancelDone(true)
        setCancelOpen(false)
      } else {
        setCancelError("해당 연락처로 제출된 참석 응답을 찾을 수 없습니다.")
      }
    } catch {
      setCancelError("취소 처리 중 오류가 발생했습니다.")
    } finally {
      setCancelBusy(false)
    }
  }

  if (done) {
    return (
      <div style={{ maxWidth: 320, margin: "0 auto", padding: "14px 0", fontSize: 14, lineHeight: 1.7, color: accent, textAlign: "center" }}>
        {cancelDone ? (
          <>참석 응답이 취소되었습니다.</>
        ) : (
          <>
            {name || "하객"}님, 참석 의사가 전달되었습니다. 감사합니다 ♥
            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => cancelRsvp(phone)}
                disabled={cancelBusy}
                style={{ background: "none", border: "none", cursor: cancelBusy ? "wait" : "pointer", fontSize: 12, color: "#9ca3af", textDecoration: "underline", padding: 0 }}
              >
                {cancelBusy ? "취소 처리 중…" : "응답 취소하기"}
              </button>
              {cancelError && <p style={{ fontSize: 11.5, color: "#dc2626", marginTop: 6 }}>{cancelError}</p>}
            </div>
          </>
        )}
      </div>
    )
  }

  if (isPastDeadline) {
    return (
      <div style={{ maxWidth: 320, margin: "0 auto", padding: "14px 0", fontSize: 13.5, lineHeight: 1.6, color: "#9ca3af", textAlign: "center" }}>
        참석 의사 접수가 마감되었습니다.
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 320, margin: "0 auto" }}>
      <button onClick={() => setOpen(true)} style={{
        width: "100%", padding: "13px 0", borderRadius: 6, border: "none", cursor: "pointer",
        background: accent, color: "#fff", fontSize: 14, letterSpacing: ".03em",
      }}>
        참석 의사 전달하기
      </button>
      {deadlineLabel && (
        <p style={{ marginTop: 8, textAlign: "center", fontSize: 11.5, color: daysUntilDeadline !== null && daysUntilDeadline <= 3 ? "#dc2626" : "inherit", opacity: daysUntilDeadline !== null && daysUntilDeadline <= 3 ? 1 : 0.6 }}>
          {deadlineLabel}까지 회신 부탁드립니다{daysUntilDeadline !== null && daysUntilDeadline <= 3 ? ` (마감 ${daysUntilDeadline}일 전)` : ""}
        </p>
      )}

      {invitationId && !cancelDone && (
        <div style={{ marginTop: 10, textAlign: "center" }}>
          <button
            onClick={() => { setCancelOpen((v) => !v); setCancelError(null) }}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: "#9ca3af", textDecoration: "underline", padding: 0 }}
          >
            이미 제출한 참석 응답을 취소할래요
          </button>
          {cancelOpen && (
            <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
              <input
                value={cancelPhone}
                onChange={(e) => setCancelPhone(e.target.value)}
                placeholder="제출 시 입력한 연락처"
                disabled={cancelBusy}
                style={{ ...rsvpInput, flex: 1, fontSize: 13, padding: "8px 10px" }}
              />
              <button
                onClick={() => cancelRsvp(cancelPhone)}
                disabled={cancelBusy}
                style={{ flexShrink: 0, padding: "0 14px", borderRadius: 8, border: "none", cursor: cancelBusy ? "wait" : "pointer", background: "#dc2626", color: "#fff", fontSize: 13, opacity: cancelBusy ? 0.7 : 1 }}
              >
                {cancelBusy ? "확인 중…" : "취소"}
              </button>
            </div>
          )}
          {cancelError && <p style={{ fontSize: 11.5, color: "#dc2626", marginTop: 6 }}>{cancelError}</p>}
        </div>
      )}
      {cancelDone && (
        <p style={{ marginTop: 10, textAlign: "center", fontSize: 12.5, color: accent }}>참석 응답이 취소되었습니다.</p>
      )}

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.45)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 320, maxHeight: "85%", overflowY: "auto",
              background: "#fff", color: "#333", borderRadius: 10, padding: 20, textAlign: "left",
              boxShadow: "0 12px 40px rgba(0,0,0,.25)",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>참석 여부 전달</h3>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>참석 여부와 인원을 알려주세요</p>

            <RsvpField label="성함">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="성함을 입력해주세요" style={rsvpInput} />
            </RsvpField>
            <RsvpField label="연락처">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="예: 010-0000-0000" style={rsvpInput} />
            </RsvpField>
            <RsvpField label="참석 여부">
              <Segmented
                options={[["yes", "참석"], ["no", "불참"]]}
                value={attending}
                onChange={(v) => setAttending(v as "yes" | "no")}
                accent={accent}
              />
            </RsvpField>

            {attending === "yes" && (
              <>
                <RsvpField label="참여 구분">
                  <Segmented
                    options={[["groom", "신랑측"], ["bride", "신부측"]]}
                    value={side}
                    onChange={(v) => setSide(v as "groom" | "bride")}
                    accent={accent}
                  />
                </RsvpField>
                <RsvpField label="참석 인원">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={() => setPartySize((n) => Math.max(1, n - 1))} style={stepBtn}>−</button>
                    <span style={{ fontSize: 15, minWidth: 24, textAlign: "center" }}>{partySize}</span>
                    <button onClick={() => setPartySize((n) => Math.min(20, n + 1))} style={stepBtn}>＋</button>
                  </div>
                </RsvpField>
                {mealEnabled && (
                  <RsvpField label="식사 여부">
                    <Segmented
                      options={[...mealMenu.map((m): [string, string] => [m, m]), [MEAL_NONE, "안함"]]}
                      value={mealChoice}
                      onChange={(v) => setMealChoice(v)}
                      accent={accent}
                    />
                  </RsvpField>
                )}
                {shuttleEnabled && (
                  <RsvpField label="셔틀버스 이용">
                    <Segmented
                      options={[["no", "이용안함"], ["yes", "이용함"]]}
                      value={shuttleUsed ? "yes" : "no"}
                      onChange={(v) => setShuttleUsed(v === "yes")}
                      accent={accent}
                    />
                  </RsvpField>
                )}
              </>
            )}

            <ConsentNotice copy={RSVP_CONSENT_COPY} checked={consentAgreed} onChange={setConsentAgreed} accent={accent} />

            {error && <p style={{ fontSize: 12, color: "#dc2626", marginBottom: 10 }}>{error}</p>}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={() => setOpen(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", cursor: "pointer", fontSize: 14 }}>
                취소
              </button>
              <button onClick={submit} disabled={saving || !consentAgreed} style={{ flex: 2, padding: "11px 0", borderRadius: 8, border: "none", background: accent, color: "#fff", cursor: saving || !consentAgreed ? "not-allowed" : "pointer", fontSize: 14, opacity: saving || !consentAgreed ? 0.5 : 1 }}>
                {saving ? "전송 중…" : "전달하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RsvpField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>{label}</label>
      {children}
    </div>
  )
}
function Segmented({ options, value, onChange, accent }: {
  options: [string, string][]; value: string; onChange: (v: string) => void; accent: string
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {options.map(([val, label]) => {
        const active = value === val
        return (
          <button key={val} onClick={() => onChange(val)} style={{
            flex: 1, padding: "10px 0", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500,
            border: `1px solid ${active ? accent : "#d1d5db"}`,
            background: active ? `color-mix(in srgb, ${accent} 8%, #ffffff)` : "#fff",
            color: active ? accent : "#6b7280",
          }}>
            {label}
          </button>
        )
      })}
    </div>
  )
}
const rsvpInput: React.CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, outline: "none", fontSize: 14,
}
const stepBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 16, color: "#374151",
}

/* ---------------------------- Guestbook ---------------------------- */
/**
 * guestbook_entries 테이블에 맞춰 구현. invitationId 가 없으면 미리보기 모드
 * (로컬 state만 사용, 저장 없음) — RsvpIsland 와 동일한 규칙.
 * password_hash 는 자기 글 삭제 UI가 없어 실질적으로 쓰이지 않는 자리표시자다
 * (NOT NULL 제약만 만족시키는 빈 문자열). 노출 여부는 관리자 대시보드에서 관리한다.
 */
function GuestbookIsland({ accent, invitationId }: SlotProps) {
  const [entries, setEntries] = useState<{ id: string; name: string; msg: string }[]>([])
  const [loading, setLoading] = useState(!!invitationId)
  const [name, setName] = useState("")
  const [msg, setMsg] = useState("")
  const [composePassword, setComposePassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consentAgreed, setConsentAgreed] = useState(false)

  // 본인 삭제 — 어떤 글의 삭제 비밀번호 입력창이 열려 있는지 id로 추적한다.
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    if (!invitationId) { setLoading(false); return }
    let active = true
    ;(async () => {
      const { data, error: err } = await supabase
        .from("guestbook_entries")
        .select("id, author_name, message")
        .eq("invitation_id", invitationId)
        .eq("is_visible", true)
        .order("created_at", { ascending: false })
        .limit(50)
      if (!active) return
      if (!err && data) {
        setEntries(data.map((r) => ({ id: r.id, name: r.author_name, msg: r.message })))
      }
      setLoading(false)
    })()
    return () => { active = false }
  }, [invitationId])

  const add = async () => {
    if (!name.trim() || !msg.trim()) return
    if (!composePassword.trim()) { setError("나중에 글을 지울 때 필요한 비밀번호를 입력해주세요."); return }
    if (!consentAgreed) { setError("개인정보 수집·이용에 동의해주세요."); return }
    setError(null)

    if (!invitationId) {
      // 미리보기 모드: 저장 없이 화면에만 반영
      setEntries((e) => [{ id: "preview-" + Date.now(), name, msg }, ...e])
      setName(""); setMsg(""); setComposePassword("")
      return
    }

    setSaving(true)
    const passwordHash = await hashPassword(composePassword.trim())
    const { data, error: err } = await supabase
      .from("guestbook_entries")
      .insert({
        invitation_id: invitationId,
        author_name: name.trim(),
        message: msg.trim(),
        password_hash: passwordHash,
        consent_agreed_at: new Date().toISOString(),
        consent_version: CONSENT_VERSION,
      })
      .select("id, author_name, message")
      .single()
    setSaving(false)

    if (err || !data) {
      setError("등록에 실패했습니다. 잠시 후 다시 시도해주세요.")
      return
    }
    setEntries((e) => [{ id: data.id, name: data.author_name, msg: data.message }, ...e])
    setName(""); setMsg(""); setComposePassword("")
  }

  const confirmDelete = async (id: string) => {
    if (!deletePassword.trim()) { setDeleteError("비밀번호를 입력해주세요."); return }
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      const res = await fetch("/api/guestbook-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: id, password: deletePassword.trim() }),
      })
      if (res.ok) {
        setEntries((es) => es.filter((e) => e.id !== id))
        setDeletingId(null)
        setDeletePassword("")
      } else {
        setDeleteError("비밀번호가 일치하지 않습니다.")
      }
    } catch {
      setDeleteError("삭제 중 오류가 발생했습니다.")
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div style={{ textAlign: "left", maxWidth: 320, margin: "0 auto", fontSize: 13 }}>
      <ConsentNotice copy={GUESTBOOK_CONSENT_COPY} checked={consentAgreed} onChange={setConsentAgreed} accent={accent} />
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름"
          disabled={saving}
          style={{ width: 80, flexShrink: 0, padding: "8px 10px", border: "1px solid #e2ddd6", borderRadius: 8, outline: "none", fontSize: 13 }} />
        <input value={composePassword} onChange={(e) => setComposePassword(e.target.value)} placeholder="삭제용 비밀번호" type="password"
          disabled={saving}
          style={{ width: 96, flexShrink: 0, padding: "8px 10px", border: "1px solid #e2ddd6", borderRadius: 8, outline: "none", fontSize: 13 }} />
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="축하 메시지"
          disabled={saving}
          style={{ flex: 1, minWidth: 0, padding: "8px 10px", border: "1px solid #e2ddd6", borderRadius: 8, outline: "none", fontSize: 13 }} />
        <button onClick={add} disabled={saving || !consentAgreed} style={{ flexShrink: 0, whiteSpace: "nowrap", padding: "0 14px", borderRadius: 8, border: "none", cursor: saving || !consentAgreed ? "not-allowed" : "pointer", background: accent, color: "#fff", fontSize: 13, opacity: saving || !consentAgreed ? 0.5 : 1 }}>
          {saving ? "등록 중…" : "등록"}
        </button>
      </div>
      {error && <p style={{ fontSize: 12, color: "#dc2626", margin: "4px 0" }}>{error}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
        {loading ? (
          <div style={{ padding: "10px 12px", opacity: 0.6 }}>불러오는 중…</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: "10px 12px", opacity: 0.6 }}>아직 등록된 축하 메시지가 없습니다.</div>
        ) : (
          entries.map((e) => (
            <div key={e.id} style={{ padding: "10px 12px", background: "rgba(255,255,255,.5)", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <span style={{ color: accent, marginRight: 8 }}>{e.name}</span>
                  <span>{e.msg}</span>
                </div>
                {invitationId && (
                  <button
                    onClick={() => { setDeletingId(deletingId === e.id ? null : e.id); setDeletePassword(""); setDeleteError(null) }}
                    style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#9ca3af", padding: 0 }}
                  >
                    삭제
                  </button>
                )}
              </div>
              {deletingId === e.id && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,.08)", display: "flex", gap: 6 }}>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(ev) => setDeletePassword(ev.target.value)}
                    placeholder="작성 시 입력한 비밀번호"
                    disabled={deleteBusy}
                    style={{ flex: 1, minWidth: 0, padding: "7px 10px", border: "1px solid #e2ddd6", borderRadius: 8, outline: "none", fontSize: 12 }}
                  />
                  <button
                    onClick={() => confirmDelete(e.id)}
                    disabled={deleteBusy}
                    style={{ flexShrink: 0, padding: "0 12px", borderRadius: 8, border: "none", cursor: deleteBusy ? "wait" : "pointer", background: "#dc2626", color: "#fff", fontSize: 12, opacity: deleteBusy ? 0.7 : 1 }}
                  >
                    {deleteBusy ? "삭제 중…" : "삭제"}
                  </button>
                </div>
              )}
              {deletingId === e.id && deleteError && (
                <p style={{ fontSize: 11, color: "#dc2626", margin: "6px 0 0" }}>{deleteError}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/* ------------------------------- Share ------------------------------
 * 청첩장 링크 공유. 지금까지 발행된 청첩장 어디에도 공유 버튼이 없어 하객이 주소를
 * 직접 긴 URL을 복사해야 했다. navigator.share 를 지원하는 모바일 브라우저에서는
 * OS 공유 시트(카카오톡 포함, 별도 SDK/API 키 없이도 뜬다)를 그대로 띄우고,
 * 지원하지 않는 환경(대부분의 데스크톱 브라우저)에서는 클립보드 복사로 대체한다.
 * ------------------------------------------------------------------ */
/** 카카오 JS SDK의 Kakao.Share.sendDefault 호출부만 타입으로 선언 — 나머지는 안 쓴다 */
interface KakaoGlobal {
  init: (key: string) => void
  isInitialized: () => boolean
  Share: { sendDefault: (options: Record<string, unknown>) => void }
}

/** NEXT_PUBLIC_KAKAO_JS_KEY가 설정된 경우에만 SDK를 로드해 초기화한다 — 키가 없으면
 * 아예 로드를 시도하지 않고 카카오 공유 버튼도 노출하지 않는다(무료 카카오 개발자
 * 콘솔에서 JS 앱 키를 발급받아야 한다 — 비즈메시지 파트너사 계약과는 무관하다). */
function useKakaoShare(): KakaoGlobal | null {
  const [kakao, setKakao] = useState<KakaoGlobal | null>(null)
  const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY

  useEffect(() => {
    if (!kakaoKey || typeof window === "undefined") return
    const w = window as typeof window & { Kakao?: KakaoGlobal }
    if (w.Kakao) {
      if (!w.Kakao.isInitialized()) w.Kakao.init(kakaoKey)
      setKakao(w.Kakao)
      return
    }
    const script = document.createElement("script")
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.5/kakao.min.js"
    script.async = true
    script.onload = () => {
      if (w.Kakao && !w.Kakao.isInitialized()) w.Kakao.init(kakaoKey)
      if (w.Kakao) setKakao(w.Kakao)
    }
    document.head.appendChild(script)
  }, [kakaoKey])

  return kakao
}

function ShareIsland({ accent, data }: SlotProps) {
  const [copied, setCopied] = useState(false)
  const kakao = useKakaoShare()
  const title = data.kakao_share_title || [data.groom_name, data.bride_name].filter(Boolean).join(" ♥ ") || "모바일 청첩장"

  const handleShare = () => {
    if (typeof window === "undefined") return
    const url = window.location.href
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
    if (nav.share) {
      nav.share({ title, url }).catch(() => { /* 사용자가 공유 시트를 취소한 경우 등 - 무시 */ })
      return
    }
    navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const shareViaKakao = () => {
    if (!kakao || typeof window === "undefined") return
    const url = window.location.href
    kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title,
        description: data.kakao_share_text || "저희 결혼식에 초대합니다",
        imageUrl: data.kakao_share_img || data.main_image || "",
        link: { mobileWebUrl: url, webUrl: url },
      },
      buttons: [{ title: "청첩장 보기", link: { mobileWebUrl: url, webUrl: url } }],
    })
  }

  const btnStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px", borderRadius: 20,
    border: `1px solid ${soft(40)}`, background: "transparent", color: "inherit", fontSize: 12.5,
    cursor: "pointer", opacity: 0.85,
  }

  return (
    <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
      {kakao && (
        <button onClick={shareViaKakao} style={{ ...btnStyle, border: "1px solid #FFE300", background: "#FFE300", color: "#3C1E1E", opacity: 1 }}>
          카카오톡 공유
        </button>
      )}
      <button onClick={handleShare} style={btnStyle}>
        {copied ? "청첩장 주소가 복사되었습니다" : "청첩장 주소 공유하기"}
      </button>
    </div>
  )
}

/* ----------------------------- Registry ---------------------------- */
export const SLOT_REGISTRY: Record<string, React.ComponentType<SlotProps>> = {
  bgm: BgmIsland,
  gallery: GalleryIsland,
  account: AccountIsland,
  contact: ContactIsland,
  map: MapIsland,
  rsvp: RsvpIsland,
  sequence: SequenceIsland,
  calendar: CalendarIsland,
  guestbook: GuestbookIsland,
  share: ShareIsland,
}

/** 테마가 선언한 슬롯 키 목록을 실제 React 노드 맵으로 변환한다. */
export function buildSlots(slotKeys: string[], props: SlotProps): Record<string, React.ReactNode> {
  const map: Record<string, React.ReactNode> = {}
  for (const key of slotKeys) {
    const Comp = SLOT_REGISTRY[key]
    if (Comp) map[key] = <Comp {...props} />
  }
  return map
}
