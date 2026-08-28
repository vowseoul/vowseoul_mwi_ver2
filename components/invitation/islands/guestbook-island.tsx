"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { supabase } from "@/lib/supabase"
import { ConsentNotice } from "../consent-notice"
import { CONSENT_VERSION, GUESTBOOK_CONSENT_COPY } from "@/lib/privacy-consent"
import { hashPassword } from "@/lib/dashboard-password"
import { popupOverlay, popupCard, rsvpInput, RsvpField, useModalA11y, usePortalDocument, type SlotProps } from "./shared"

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
  const [open, setOpen] = useState(false)
  const modalRef = useModalA11y(open, () => setOpen(false))
  const [rootRef, portalDoc] = usePortalDocument<HTMLDivElement>()
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
      try {
        const res = await fetch(`/api/guestbook?invitationId=${encodeURIComponent(invitationId)}`)
        const json = await res.json()
        if (!active) return
        if (res.ok && Array.isArray(json.entries)) {
          setEntries(json.entries.map((r: { id: string; author_name: string; message: string }) => ({ id: r.id, name: r.author_name, msg: r.message })))
        }
      } catch {
        // 조용히 실패 — 방명록 목록만 비어 보인다
      }
      if (active) setLoading(false)
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
      setName(""); setMsg(""); setComposePassword(""); setOpen(false)
      return
    }

    setSaving(true)
    const passwordHash = await hashPassword(composePassword.trim())
    // INSERT 뒤 .select()로 값을 되받으면 PostgREST가 RETURNING을 위해 SELECT 권한도
    // 요구한다 — 방명록은 RLS상 anon에게 SELECT를 열어두지 않아(§app/api/guestbook,
    // 전 청첩장 실명 노출 방지) 그 즉시 INSERT 전체가 롤백되고 있었다. id를 미리
    // 클라이언트에서 만들어 넘기면 INSERT만으로 끝나 이 문제를 피할 수 있다
    // (§app/admin/(dashboard)/assets/page.tsx 의 BGM 등록과 동일한 패턴).
    const id = crypto.randomUUID()
    const authorName = name.trim()
    const message = msg.trim()
    const { error: err } = await supabase.from("guestbook_entries").insert({
      id,
      invitation_id: invitationId,
      author_name: authorName,
      message,
      password_hash: passwordHash,
      consent_agreed_at: new Date().toISOString(),
      consent_version: CONSENT_VERSION,
    })
    setSaving(false)

    if (err) {
      setError("등록에 실패했습니다. 잠시 후 다시 시도해주세요.")
      return
    }
    setEntries((e) => [{ id, name: authorName, msg: message }, ...e])
    setName(""); setMsg(""); setComposePassword(""); setOpen(false)
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
    <div ref={rootRef} style={{ textAlign: "left", maxWidth: 320, margin: "0 auto", fontSize: 13 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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

      <button
        onClick={() => setOpen(true)}
        style={{
          // 섹션 배경 위에 바로 놓이는 버튼이라 accent 를 직접 쓰면 배경이 --accent 로 교대되는
          // 테마(color-atelier vs-alt-a)에서 버튼이 통째로 사라진다 — currentColor 로 조상 섹션의
          // 실제 글자색을 따라간다. (팝업 안 버튼은 항상 흰 배경이라 accent 를 그대로 쓴다)
          width: "100%", marginTop: 12, padding: "12px 0", borderRadius: 6, cursor: "pointer",
          border: "1px solid currentColor", background: "transparent", color: "inherit", fontSize: 13.5,
        }}
      >
        축하 메시지 남기기
      </button>

      {open && portalDoc && createPortal(
        <div onClick={() => setOpen(false)} style={popupOverlay}>
          <div
            ref={modalRef}
            className="vs-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vs-guestbook-title"
            onClick={(e) => e.stopPropagation()}
            style={popupCard}
          >
            <h3 id="vs-guestbook-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>축하 메시지 남기기</h3>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>신랑 신부에게 축하의 메시지를 남겨주세요</p>

            <RsvpField label="이름">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름을 입력해주세요" disabled={saving} style={rsvpInput} />
            </RsvpField>
            <RsvpField label="삭제용 비밀번호">
              <input value={composePassword} onChange={(e) => setComposePassword(e.target.value)} placeholder="나중에 글을 지울 때 필요해요" type="password" disabled={saving} style={rsvpInput} />
            </RsvpField>
            <RsvpField label="축하 메시지">
              <textarea
                value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="축하 메시지를 남겨주세요" rows={4} disabled={saving}
                style={{ ...rsvpInput, resize: "vertical", fontFamily: "inherit" }}
              />
            </RsvpField>

            <ConsentNotice copy={GUESTBOOK_CONSENT_COPY} checked={consentAgreed} onChange={setConsentAgreed} accent={accent} />

            {error && <p style={{ fontSize: 12, color: "#dc2626", marginBottom: 10 }}>{error}</p>}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={() => setOpen(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", cursor: "pointer", fontSize: 14 }}>
                취소
              </button>
              <button onClick={add} disabled={saving || !consentAgreed} style={{ flex: 2, padding: "11px 0", borderRadius: 8, border: "none", background: accent, color: "#fff", cursor: saving || !consentAgreed ? "not-allowed" : "pointer", fontSize: 14, opacity: saving || !consentAgreed ? 0.5 : 1 }}>
                {saving ? "등록 중…" : "등록하기"}
              </button>
            </div>
          </div>
        </div>,
        portalDoc.body,
      )}
    </div>
  )
}

/* ------------------------------- Share ------------------------------
 * 청첩장 링크 공유. 지금까지 발행된 청첩장 어디에도 공유 버튼이 없어 하객이 주소를
 * 직접 긴 URL을 복사해야 했다. navigator.share 를 지원하는 모바일 브라우저에서는
 * OS 공유 시트(카카오톡 포함, 별도 SDK/API 키 없이도 뜬다)를 그대로 띄우고,
 * 지원하지 않는 환경(대부분의 데스크톱 브라우저)에서는 클립보드 복사로 대체한다.
 * ------------------------------------------------------------------ */
export { GuestbookIsland }
