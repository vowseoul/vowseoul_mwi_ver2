"use client"

import { useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { InvitationFrame, type TokenMap } from "@/components/invitation/invitation-frame"
import { buildSlots } from "@/components/invitation/slot-registry"
import { buildFieldData, mergeInvitationRaw } from "@/lib/invitation-data"
import {
  buildThemeTokens,
  extractOverrideTokens,
  TOKEN_FIELDS,
  toThemeTemplate,
  type ThemeRow,
} from "@/lib/theme-template"

/**
 * 템플릿 청첩장 커스터마이즈 편집기.
 * 실제 청첩장 데이터로 미리보기하고, 이 청첩장에만 적용되는 색/폰트 오버라이드를
 * invitations.customization_overrides 에 저장한다. (테마 기본값은 건드리지 않음)
 * 발행 경로와 동일한 mergeInvitationRaw / buildFieldData / InvitationFrame 을 쓰므로
 * "여기서 보이는 것 = 발행 결과" 가 보장된다.
 */
export default function CustomizeClient({
  invitationId,
  publicSlug,
  themeRow,
  invitation,
  customer,
}: {
  invitationId: string
  publicSlug: string
  themeRow: ThemeRow
  invitation: Record<string, unknown>
  customer: Record<string, unknown> | null
}) {
  const template = toThemeTemplate(themeRow)

  const themeTokens = useMemo(() => buildThemeTokens(themeRow), [themeRow])
  const [overrides, setOverrides] = useState<Record<string, string>>(
    () => extractOverrideTokens(invitation.customization_overrides)
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const raw = useMemo(() => mergeInvitationRaw(invitation, customer), [invitation, customer])
  const data = useMemo(() => buildFieldData(raw), [raw])

  // 최종 토큰 = 테마 기본 + 이 청첩장 오버라이드
  const tokens: TokenMap = useMemo(() => {
    const t: TokenMap = { ...themeTokens }
    for (const [k, v] of Object.entries(overrides)) if (v) t[k] = v
    return t
  }, [themeTokens, overrides])

  const accent = tokens["--accent"] || "#D76C6C"
  const slots = useMemo(
    () => buildSlots(template?.slots ?? [], { accent, data, raw, invitationId }),
    [template, accent, data, raw, invitationId]
  )

  const save = async () => {
    setSaving(true); setMessage(null)
    const clean: Record<string, string> = {}
    for (const [k, v] of Object.entries(overrides)) if (v) clean[k] = v

    // customization_overrides 의 다른(비-토큰) 키는 보존
    const existing = (invitation.customization_overrides && typeof invitation.customization_overrides === "object")
      ? invitation.customization_overrides as Record<string, unknown>
      : {}
    const preserved: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(existing)) if (!k.startsWith("--")) preserved[k] = v

    const { error } = await supabase
      .from("invitations")
      .update({ customization_overrides: { ...preserved, ...clean }, updated_at: new Date().toISOString() })
      .eq("id", invitationId)
    setSaving(false)
    setMessage(error ? `저장 실패: ${error.message}` : "저장되었습니다.")
  }

  const groom = String(data.groom_name ?? "")
  const bride = String(data.bride_name ?? "")

  if (!template) {
    return <div style={{ padding: 40, fontFamily: "system-ui" }}>템플릿 테마를 불러올 수 없습니다.</div>
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 420px", gap: 24, padding: 24, fontFamily: "system-ui, sans-serif" }}>
      {/* 편집 */}
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>청첩장 커스터마이즈</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
          {groom && bride ? `${groom} ♥ ${bride}` : "청첩장"} · 테마: {themeRow.name}
        </p>
        <p style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
          이 청첩장에만 적용되는 색/폰트입니다. 비워두면 테마 기본값이 사용됩니다.
          변경은 미리보기에 즉시 반영되고, 저장하면 발행 청첩장에도 적용됩니다.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 620 }}>
          {TOKEN_FIELDS.map((t) => {
            const value = overrides[t.name] || ""
            const placeholder = themeTokens[t.name] || "테마 기본값"
            const setValue = (v: string) => setOverrides((cur) => ({ ...cur, [t.name]: v }))
            return (
              <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 12, color: "#374151", width: 92, flexShrink: 0 }}>{t.label}</label>
                {t.type === "color" ? (
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : (/^#[0-9a-fA-F]{6}$/.test(placeholder) ? placeholder : "#ffffff")}
                    onChange={(e) => setValue(e.target.value)}
                    style={{ width: 34, height: 30, padding: 0, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", background: "#fff" }}
                  />
                ) : null}
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={placeholder}
                  style={{ flex: 1, minWidth: 0, padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 8, outline: "none", fontSize: 12 }}
                />
                {value && (
                  <button onClick={() => setValue("")} title="테마 기본값으로" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#9ca3af", fontSize: 14 }}>×</button>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24 }}>
          <button onClick={save} disabled={saving} style={{ padding: "10px 20px", borderRadius: 8, border: "none", cursor: saving ? "wait" : "pointer", background: "#D76C6C", color: "#fff", fontSize: 14, opacity: saving ? 0.6 : 1 }}>
            {saving ? "저장 중…" : "저장"}
          </button>
          <a href={`/editor/${invitationId}`} style={{ fontSize: 13, color: "#2563eb" }}>
            콘텐츠·디자인 편집기 열기 →
          </a>
          {publicSlug && (
            <a href={`/w/${publicSlug}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#2563eb" }}>
              발행 청첩장 열기 →
            </a>
          )}
          {message && <span style={{ fontSize: 13, color: message.startsWith("저장되") ? "#059669" : "#dc2626" }}>{message}</span>}
        </div>
      </div>

      {/* 미리보기 */}
      <div style={{ position: "sticky", top: 24, alignSelf: "start" }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>실시간 미리보기 (실제 데이터)</div>
        <div style={{ display: "flex", justifyContent: "center", background: "#f3f4f6", borderRadius: 14, padding: "20px 0" }}>
          <InvitationFrame template={template} data={data} tokens={tokens} slots={slots} width={380} height={680} />
        </div>
      </div>
    </div>
  )
}
