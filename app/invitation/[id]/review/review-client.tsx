"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { MessageSquarePlus, X, ListChecks, Check } from "lucide-react"
import { InvitationFrame, type BlockOverrideMap, type FontFace, type SectionImage, type TokenMap } from "@/components/invitation/invitation-frame"
import { buildSlots } from "@/components/invitation/slot-registry"
import { buildFieldData, normalizeLegacyKeys, type RawInvitationData } from "@/lib/invitation-data"
import { toThemeTemplate, getBlockManifest, BLOCK_LABEL_FALLBACK, type ThemeRow } from "@/lib/theme-template"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface Revision {
  id: string
  blockKey: string | null
  note: string
  status: "open" | "resolved"
  createdAt: string
}

export default function ReviewClient({
  invitationId,
  themeRow,
  raw,
  tokens = {},
  fontFaces = [],
  disabledSlots = [],
  blockOverrides = {},
  hiddenBlocks = [],
  sectionImages = [],
  reviewStatus,
  initialRevisions,
}: {
  invitationId: string
  themeRow: ThemeRow
  raw: RawInvitationData
  tokens?: TokenMap
  fontFaces?: FontFace[]
  disabledSlots?: string[]
  blockOverrides?: BlockOverrideMap
  hiddenBlocks?: string[]
  sectionImages?: SectionImage[]
  reviewStatus: string
  initialRevisions: Revision[]
}) {
  const template = toThemeTemplate(themeRow)
  const [size, setSize] = useState({ w: 390, h: 780 })
  const [commentMode, setCommentMode] = useState(false)
  const [activeBlock, setActiveBlock] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [revisions, setRevisions] = useState(initialRevisions)
  const [showList, setShowList] = useState(false)
  const [approved, setApproved] = useState(reviewStatus === "approved")

  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const blockLabels = useMemo(() => {
    const labels: Record<string, string> = { ...BLOCK_LABEL_FALLBACK }
    for (const entry of getBlockManifest(themeRow)) labels[entry.key] = entry.label
    return labels
  }, [themeRow])

  if (!template) return null

  const normalizedRaw = normalizeLegacyKeys(raw)
  const data = buildFieldData(normalizedRaw)
  const accent = (tokens["--accent"] as string) || "#D76C6C"
  const activeSlots = (template.slots ?? []).filter((s) => !disabledSlots.includes(s))
  const slots = buildSlots(activeSlots, { accent, data, raw: normalizedRaw, blockOverrides })
  const openCount = revisions.filter((r) => r.status === "open").length

  const submitNote = async () => {
    if (!note.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/review-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addRevision", invitationId, blockKey: activeBlock, note: note.trim() }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result?.error || "요청을 저장하지 못했습니다.")
      setRevisions((cur) => [
        { id: result.revision.id, blockKey: activeBlock, note: note.trim(), status: "open", createdAt: new Date().toISOString() },
        ...cur,
      ])
      setNote("")
      setActiveBlock(null)
      toast.success("수정 요청을 전달했습니다.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "요청을 저장하지 못했습니다.")
    } finally {
      setSubmitting(false)
    }
  }

  const confirmApprove = async () => {
    if (!confirm("이 상태로 청첩장 제작을 확정하시겠습니까?")) return
    try {
      const res = await fetch("/api/review-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", invitationId }),
      })
      if (!res.ok) throw new Error()
      setApproved(true)
      toast.success("확정되었습니다. 감사합니다!")
    } catch {
      toast.error("처리하지 못했습니다. 잠시 후 다시 시도해주세요.")
    }
  }

  return (
    <div style={{ margin: 0, padding: 0, background: "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255,255,255,.92)", backdropFilter: "blur(6px)", borderBottom: "1px solid #eee" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>
          {commentMode ? "청첩장에서 수정할 부분을 눌러주세요" : "청첩장 시안 확인"}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setShowList(true)} style={pillBtn(false)}>
            <ListChecks size={13} /> 요청 {revisions.length > 0 ? `(${openCount})` : ""}
          </button>
          <button onClick={() => { setCommentMode((v) => !v); setActiveBlock(null) }} style={pillBtn(commentMode)}>
            {commentMode ? <X size={13} /> : <MessageSquarePlus size={13} />}
            {commentMode ? "종료" : "수정 요청"}
          </button>
        </div>
      </div>

      <div style={{ paddingTop: 44, display: "flex", justifyContent: "center" }}>
        <InvitationFrame
          template={template}
          data={data}
          tokens={tokens}
          slots={slots}
          fontFaces={fontFaces}
          blockOverrides={blockOverrides}
          hiddenBlocks={hiddenBlocks}
          sectionImages={sectionImages}
          width={Math.min(size.w, 480)}
          height={size.h - 44 - 60}
          onBlockClick={commentMode ? (key) => setActiveBlock(key) : undefined}
        />
      </div>

      {/* 하단 확정 바 */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 70, padding: 12, background: "rgba(255,255,255,.95)", backdropFilter: "blur(6px)", borderTop: "1px solid #eee", display: "flex", gap: 8, alignItems: "center" }}>
        {approved ? (
          <div style={{ flex: 1, textAlign: "center", fontSize: 13, color: "#16a34a", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <Check size={15} /> 확정 완료 — 곧 제작이 진행됩니다
          </div>
        ) : (
          <>
            <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>
              {openCount > 0 ? `처리 대기 중인 요청 ${openCount}건` : "수정 요청이 없으면 확정해주세요"}
            </span>
            <Button onClick={confirmApprove} className="ml-auto">이대로 확정합니다</Button>
          </>
        )}
      </div>

      {/* 블록 클릭 → 요청 작성 시트 */}
      {activeBlock && (
        <div onClick={() => setActiveBlock(null)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={sheetStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
              {blockLabels[activeBlock] || activeBlock} 수정 요청
            </h3>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>어떻게 바꾸고 싶으신지 적어주세요.</p>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 사진을 다른 걸로 바꿔주세요" rows={4} autoFocus />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Button variant="outline" className="flex-1" onClick={() => setActiveBlock(null)}>취소</Button>
              <Button className="flex-[2]" disabled={submitting || !note.trim()} onClick={submitNote}>
                {submitting ? "전송 중…" : "요청 보내기"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 요청 목록 */}
      {showList && (
        <div onClick={() => setShowList(false)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...sheetStyle, maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>보낸 요청 ({revisions.length})</h3>
              <button onClick={() => setShowList(false)} style={{ border: "none", background: "none", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {revisions.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "24px 0" }}>아직 보낸 요청이 없습니다.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {revisions.map((r) => (
                  <div key={r.id} style={{ padding: 10, borderRadius: 8, border: "1px solid #eee", background: r.status === "resolved" ? "#f9fafb" : "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: accent }}>
                        {r.blockKey ? (blockLabels[r.blockKey] || r.blockKey) : "전체"}
                      </span>
                      <span style={{ fontSize: 10.5, color: r.status === "resolved" ? "#16a34a" : "#f59e0b" }}>
                        {r.status === "resolved" ? "반영 완료" : "확인 중"}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-wrap" }}>{r.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function pillBtn(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 20,
    border: `1px solid ${active ? "#111" : "#ddd"}`, background: active ? "#111" : "#fff",
    color: active ? "#fff" : "#333", fontSize: 12, cursor: "pointer",
  }
}

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.45)",
  display: "flex", alignItems: "flex-end", justifyContent: "center",
}

const sheetStyle: React.CSSProperties = {
  width: "100%", maxWidth: 480, background: "#fff", color: "#333", borderRadius: "16px 16px 0 0",
  padding: 20, boxShadow: "0 -8px 30px rgba(0,0,0,.15)",
}
