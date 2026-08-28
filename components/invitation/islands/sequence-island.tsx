"use client"

import { normalizeSequence, isToggledOff, type SequenceEvent } from "@/lib/invitation-data"
import { soft, type SlotProps } from "./shared"

/* ----------------------------- Sequence ---------------------------- *
 * 식순 안내. 이전 버전 Pink Envelope 표 디자인(시간 열 + 구분선)을 이식하고,
 * 데이터는 raw.sequence_events 에서 동적으로 받는다.
 * ------------------------------------------------------------------ */
const DEFAULT_SEQUENCE: SequenceEvent[] = [
  { time: "11:00", title: "하객 맞이 및 로비 안내" },
  { time: "11:30", title: "개식사 및 화촉점화" },
  { time: "11:35", title: "신랑 신부 입장" },
  { time: "11:45", title: "혼인서약 및 성혼선언문 낭독" },
  { time: "12:00", title: "축가 및 하객 인사" },
  { time: "12:15", title: "신랑 신부 행진 및 피로연" },
]

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

export { SequenceIsland }
