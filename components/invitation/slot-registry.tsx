"use client"

import { useEffect, useRef, useState } from "react"
import type { FieldData } from "./invitation-frame"
import type { RawInvitationData } from "@/lib/invitation-data"
import { supabase } from "@/lib/supabase"

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
}

/** currentColor 기반 반투명 색 (테마 색을 그대로 따라감) */
const soft = (pct: number) => `color-mix(in srgb, currentColor ${pct}%, transparent)`

/* ------------------------------- BGM ------------------------------- *
 * 이전 버전에서 안정적으로 동작하던 로직을 그대로 이식.
 * 자동재생을 시도하고, 브라우저 정책으로 막히면 첫 클릭/터치에 재생한다.
 * iframe 내부에 렌더되므로 이벤트는 iframe 문서에도 함께 등록한다.
 * ------------------------------------------------------------------ */
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
      if (!audioRef.current) {
        audioRef.current = new Audio(bgmUrl)
        audioRef.current.loop = true
      } else if (audioRef.current.src !== bgmUrl) {
        audioRef.current.pause()
        audioRef.current = new Audio(bgmUrl)
        audioRef.current.loop = true
      }

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
    }

    return () => {
      audioRef.current?.pause()
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
  return value === false || value === "false" || value === "아니오" || value === "off"
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
            fontFamily: "ui-monospace, monospace", opacity: 0.9,
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

function CalendarIsland({ accent, data, raw }: SlotProps) {
  const dateStr = (typeof raw?.wedding_date === "string" ? raw.wedding_date : data.wedding_date) || ""
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
          <p style={{ fontSize: 20, fontWeight: 500, letterSpacing: ".15em", textTransform: "uppercase", color: accent }}>
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

      {/* D-day 카운트다운 */}
      <div style={{ marginTop: 48, paddingTop: 32, textAlign: "center", borderTop: `1px solid ${accent}` }}>
        <p style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 600, color: accent, marginBottom: 20 }}>
          Days left
        </p>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 40, maxWidth: 280, margin: "0 auto", color: accent }}>
          {[["DAYS", daysLeft], ["HOURS", hoursLeft], ["MINUTES", minutesLeft]].map(([label, value]) => (
            <div key={String(label)} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <p style={{ fontSize: 14, letterSpacing: ".05em", opacity: 0.6 }}>{label}</p>
              <p style={{ fontSize: 36, marginTop: 4, lineHeight: 1 }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ----------------------------- Gallery ----------------------------- */
const SAMPLE_GALLERY = [
  "https://images.unsplash.com/photo-1519741497674-611481863552?w=500&q=80",
  "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=500&q=80",
  "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=500&q=80",
  "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=500&q=80",
]
function GalleryIsland({ accent, raw }: SlotProps) {
  const rawImages = raw?.gallery_images
  const images = Array.isArray(rawImages) && rawImages.length > 0
    ? rawImages.filter((u): u is string => typeof u === "string")
    : SAMPLE_GALLERY
  const [idx, setIdx] = useState(0)
  const go = (d: number) => setIdx((i) => (i + d + images.length) % images.length)
  return (
    <div style={{ width: "100%" }}>
      <div style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden", borderRadius: 8, background: "#eee" }}>
        <img src={images[idx]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <button onClick={() => go(-1)} style={navBtn("left", accent)}>‹</button>
        <button onClick={() => go(1)} style={navBtn("right", accent)}>›</button>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
        {images.map((_, i) => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === idx ? accent : "#d5cec7" }} />
        ))}
      </div>
    </div>
  )
}
function navBtn(side: "left" | "right", accent: string): React.CSSProperties {
  return {
    position: "absolute", top: "50%", [side]: 8, transform: "translateY(-50%)",
    width: 30, height: 30, borderRadius: "50%", border: "none", cursor: "pointer",
    background: "rgba(255,255,255,.85)", color: accent, fontSize: 18, lineHeight: "30px",
  }
}

/* ----------------------------- Account ----------------------------- */
function composeAccount(bank?: string, number?: string, holder?: string): string {
  return [bank, number, holder].filter(Boolean).join(" ")
}
function AccountRow({ label, value, accent }: { label: string; value: string; accent: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(value.replace(/[^0-9]/g, ""))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${soft(25)}` }}>
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 11, opacity: 0.6 }}>{label}</div>
        <div style={{ fontSize: 13.5 }}>{value}</div>
      </div>
      <button onClick={copy} style={{
        padding: "6px 12px", borderRadius: 7, cursor: "pointer", whiteSpace: "nowrap",
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
  return (
    <div style={{ textAlign: "left", maxWidth: 320, margin: "0 auto" }}>
      {groom && <AccountRow label="신랑측" value={groom} accent={accent} />}
      {bride && <AccountRow label="신부측" value={bride} accent={accent} />}
      {!groom && !bride && <div style={{ fontSize: 12, opacity: 0.6, padding: "8px 0" }}>등록된 계좌 정보가 없습니다.</div>}
    </div>
  )
}

/* ------------------------------- Map ------------------------------- */
function MapIsland({ accent, data }: SlotProps) {
  const address = data.venue_address || ""
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div style={{ width: "100%", maxWidth: 320, margin: "0 auto" }}>
      <div style={{
        aspectRatio: "16/10", borderRadius: 4, overflow: "hidden",
        background: "repeating-linear-gradient(45deg, #efe7e2, #efe7e2 10px, #e7ddd6 10px, #e7ddd6 20px)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "#9a8f88", fontSize: 12,
      }}>
        지도 영역 (카카오맵 연동 예정)
      </div>
      {address && (
        <button onClick={copy} style={{
          marginTop: 10, width: "100%", padding: "10px 0", borderRadius: 6, cursor: "pointer",
          border: `1px solid ${accent}`, background: copied ? accent : "transparent",
          color: copied ? "#fff" : accent, fontSize: 13,
        }}>
          {copied ? "주소가 복사되었습니다" : "주소 복사하기"}
        </button>
      )}
    </div>
  )
}

/* ------------------------------- RSVP ------------------------------ *
 * 이전 버전 UX(트리거 버튼 → 모달 폼)를 이식하되, 저장은 새 스키마
 * rsvp_responses 테이블에 맞춰 구현. invitationId 가 없으면 미리보기 모드.
 * ------------------------------------------------------------------ */
function RsvpIsland({ accent, invitationId }: SlotProps) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [attending, setAttending] = useState<"yes" | "no">("yes")
  const [side, setSide] = useState<"groom" | "bride">("groom")
  const [partySize, setPartySize] = useState(1)

  const submit = async () => {
    if (!name.trim()) { setError("성함을 입력해주세요."); return }
    if (!phone.trim()) { setError("연락처를 입력해주세요."); return }
    setError(null); setSaving(true)

    if (invitationId) {
      const { error: err } = await supabase.from("rsvp_responses").insert({
        invitation_id: invitationId,
        guest_name: name.trim(),
        phone: phone.trim(),
        side,
        is_attending: attending === "yes",
        party_size: attending === "yes" ? partySize : 0,
      })
      if (err) { setSaving(false); setError("전송에 실패했습니다. 잠시 후 다시 시도해주세요."); return }
    }
    setSaving(false); setDone(true); setOpen(false)
  }

  if (done) {
    return (
      <div style={{ maxWidth: 320, margin: "0 auto", padding: "14px 0", fontSize: 14, lineHeight: 1.7, color: accent }}>
        {name || "하객"}님, 참석 의사가 전달되었습니다. 감사합니다 ♥
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
              </>
            )}

            {error && <p style={{ fontSize: 12, color: "#dc2626", marginBottom: 10 }}>{error}</p>}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={() => setOpen(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", cursor: "pointer", fontSize: 14 }}>
                취소
              </button>
              <button onClick={submit} disabled={saving} style={{ flex: 2, padding: "11px 0", borderRadius: 8, border: "none", background: accent, color: "#fff", cursor: saving ? "wait" : "pointer", fontSize: 14, opacity: saving ? 0.7 : 1 }}>
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
function GuestbookIsland({ accent }: SlotProps) {
  const [entries, setEntries] = useState<{ name: string; msg: string }[]>([
    { name: "정우", msg: "두 사람 결혼 진심으로 축하해!" },
  ])
  const [name, setName] = useState("")
  const [msg, setMsg] = useState("")
  const add = () => {
    if (!name || !msg) return
    setEntries((e) => [{ name, msg }, ...e])
    setName(""); setMsg("")
  }
  return (
    <div style={{ textAlign: "left", maxWidth: 320, margin: "0 auto", fontSize: 13 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름"
          style={{ width: 80, padding: "8px 10px", border: "1px solid #e2ddd6", borderRadius: 8, outline: "none", fontSize: 13 }} />
        <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="축하 메시지"
          style={{ flex: 1, padding: "8px 10px", border: "1px solid #e2ddd6", borderRadius: 8, outline: "none", fontSize: 13 }} />
        <button onClick={add} style={{ padding: "0 14px", borderRadius: 8, border: "none", cursor: "pointer", background: accent, color: "#fff", fontSize: 13 }}>등록</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
        {entries.map((e, i) => (
          <div key={i} style={{ padding: "10px 12px", background: "rgba(255,255,255,.5)", borderRadius: 8 }}>
            <span style={{ color: accent, marginRight: 8 }}>{e.name}</span>
            <span>{e.msg}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ----------------------------- Registry ---------------------------- */
export const SLOT_REGISTRY: Record<string, React.ComponentType<SlotProps>> = {
  bgm: BgmIsland,
  gallery: GalleryIsland,
  account: AccountIsland,
  map: MapIsland,
  rsvp: RsvpIsland,
  sequence: SequenceIsland,
  calendar: CalendarIsland,
  guestbook: GuestbookIsland,
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
