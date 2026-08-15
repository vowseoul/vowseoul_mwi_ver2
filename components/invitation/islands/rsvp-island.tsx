"use client"

import { useEffect, useState } from "react"
import { Calendar as CalendarIcon } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { ConsentNotice } from "../consent-notice"
import { CONSENT_VERSION, RSVP_CONSENT_COPY } from "@/lib/privacy-consent"
import { popupOverlay, popupCard, rsvpInput, RsvpField, useModalA11y, type SlotProps } from "./shared"

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
/** 제출 성공 시 그려지는 체크마크 — stroke-dashoffset을 마운트 직후 0으로 옮겨 "그려지는" 느낌을 준다.
 * OS "동작 줄이기" 설정을 켠 하객에게는 애니메이션 없이 바로 완성된 상태로 보여준다. */
function CheckmarkDraw({ color }: { color: string }) {
  const [drawn, setDrawn] = useState(false)
  const prefersReduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  useEffect(() => {
    if (prefersReduced) { setDrawn(true); return }
    const raf = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(raf)
  }, [prefersReduced])
  const pathLength = 34
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" style={{ display: "block", margin: "0 auto 8px" }}>
      <circle cx="22" cy="22" r="20" fill="none" stroke={color} strokeWidth="2" opacity="0.25" />
      <path
        d="M12 22 L19 29 L32 15"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: pathLength,
          strokeDashoffset: drawn ? 0 : pathLength,
          transition: prefersReduced ? "none" : "stroke-dashoffset 500ms ease-out",
        }}
      />
    </svg>
  )
}
function RsvpIsland({ accent, data, invitationId, blockOverrides }: SlotProps) {
  const [open, setOpen] = useState(false)
  const modalRef = useModalA11y(open, () => setOpen(false))
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

  // Date.now()를 렌더 중 직접 읽으면 리렌더마다 값이 달라져 순수성 규칙을 어긴다
  // (§CalendarIsland의 D-day 카운트다운과 동일한 처방 — 마운트 시 한 번만 고정한다).
  const [nowMs] = useState(() => Date.now())
  // 마감일은 "그날 자정까지"로 취급한다 — 하객이 마감일 당일에도 자정 전까지는 응답할 수 있어야 한다.
  const deadline = rsvpOverride?.rsvpDeadline ? new Date(`${rsvpOverride.rsvpDeadline}T23:59:59`) : null
  const isPastDeadline = !!deadline && deadline.getTime() < nowMs
  const daysUntilDeadline = deadline ? Math.ceil((deadline.getTime() - nowMs) / (1000 * 60 * 60 * 24)) : null
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
      // accent 를 직접 쓰지 않는다 — 섹션 배경이 --accent 로 교대되는 테마(color-atelier
      // vs-alt-a)에서 글자·체크마크가 배경과 같은 색이 되어 안 보인다. currentColor(inherit)
      // 는 조상 섹션이 그 순간 실제로 쓰는 글자색을 따라가 항상 대비가 보장된다.
      <div style={{ maxWidth: 320, margin: "0 auto", padding: "14px 0", fontSize: 14, lineHeight: 1.7, color: "inherit", textAlign: "center" }}>
        {cancelDone ? (
          <>참석 응답이 취소되었습니다.</>
        ) : (
          <>
            <CheckmarkDraw color="currentColor" />
            {name || "하객"}님, 참석 의사가 전달되었습니다. 감사합니다 ♥
            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => cancelRsvp(phone)}
                disabled={cancelBusy}
                style={{ background: "none", border: "none", cursor: cancelBusy ? "wait" : "pointer", fontSize: 12, color: "inherit", opacity: 0.6, textDecoration: "underline", padding: 0 }}
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
      {/* 채워진 배경(background: accent)은 색을 직접 지정해야 해서 섹션 배경이 --accent 로
          교대되는 테마에서 버튼이 배경에 파묻힐 위험이 있다 — guestbook의 "축하 메시지
          남기기" 버튼과 같은 톤(테두리+투명 배경, currentColor)으로 맞춰 항상 대비를 보장한다. */}
      <button onClick={() => setOpen(true)} style={{
        width: "100%", padding: "10px 0", borderRadius: 6, cursor: "pointer",
        border: "1px solid currentColor", background: "transparent", color: "inherit", fontSize: 14, letterSpacing: ".03em",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}>
        <CalendarIcon size={16} />
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
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: "inherit", opacity: 0.6, textDecoration: "underline", padding: 0 }}
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
        <p style={{ marginTop: 10, textAlign: "center", fontSize: 12.5, color: "inherit" }}>참석 응답이 취소되었습니다.</p>
      )}

      {open && (
        <div onClick={() => setOpen(false)} style={popupOverlay}>
          <div
            ref={modalRef}
            className="vs-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vs-rsvp-title"
            onClick={(e) => e.stopPropagation()}
            style={popupCard}
          >
            <h3 id="vs-rsvp-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>참석 여부 전달</h3>
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

const stepBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 16, color: "#374151",
}
export { RsvpIsland }
