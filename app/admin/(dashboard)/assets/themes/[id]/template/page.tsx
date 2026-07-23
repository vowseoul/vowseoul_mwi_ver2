"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { InvitationFrame, type ThemeTemplate, type TokenMap } from "@/components/invitation/invitation-frame"
import { buildSlots } from "@/components/invitation/slot-registry"
import { buildFieldData } from "@/lib/invitation-data"
import { SAMPLE_RAW } from "@/lib/sample-invitation"
import { buildThemeTokens, TOKEN_FIELDS, type ThemeRow } from "@/lib/theme-template"

/**
 * 템플릿(B+iframe) 테마 편집기.
 * themes 행의 template_html / template_css / slot_manifest / field_manifest / render_engine 를
 * 편집·저장하고, 우측에서 InvitationFrame 실시간 미리보기를 제공한다.
 * (레거시 스타일 에디터(../page.tsx)와 분리 — 서로 간섭 없음)
 */

const KNOWN_SLOTS = ["bgm", "gallery", "account", "map", "rsvp", "guestbook"]

/** HTML 문자열에서 data-field / data-slot 키를 추출 */
function extractMarkers(html: string): { fields: string[]; slots: string[] } {
  if (typeof window === "undefined") return { fields: [], slots: [] }
  const doc = new DOMParser().parseFromString(html, "text/html")
  const uniq = (arr: (string | null)[]) => Array.from(new Set(arr.filter((v): v is string => !!v)))
  return {
    fields: uniq([...doc.querySelectorAll("[data-field]")].map((el) => el.getAttribute("data-field"))),
    slots: uniq([...doc.querySelectorAll("[data-slot]")].map((el) => el.getAttribute("data-slot"))),
  }
}

export default function TemplateThemeEditor() {
  const params = useParams()
  const id = String(params.id)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [renderEngine, setRenderEngine] = useState<"legacy" | "template">("template")
  const [html, setHtml] = useState("")
  const [css, setCss] = useState("")
  const [slotManifest, setSlotManifest] = useState<string[]>([])
  const [fieldManifest, setFieldManifest] = useState<string[]>([])
  /** 디자인 토큰 (에셋 설정) — themes.styles 에 '--' 키로 저장 */
  const [tokenValues, setTokenValues] = useState<Record<string, string>>({})
  /** 저장 시 보존해야 하는 기존 styles 의 나머지 키 */
  const [otherStyles, setOtherStyles] = useState<Record<string, unknown>>({})

  // 미리보기에 반영된 값 (적용 버튼으로 갱신 → 키입력마다 iframe 재작성 방지)
  const [applied, setApplied] = useState<{ html: string; css: string; slots: string[] }>({ html: "", css: "", slots: [] })

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase.from("themes").select("*").eq("id", id).maybeSingle()
      if (!active) return
      if (data) {
        setName(data.name || "")
        setRenderEngine(data.render_engine === "template" ? "template" : "legacy")
        setHtml(data.template_html || "")
        setCss(data.template_css || "")
        setSlotManifest(Array.isArray(data.slot_manifest) ? data.slot_manifest : [])
        setFieldManifest(Array.isArray(data.field_manifest) ? data.field_manifest : [])

        // 토큰: 레거시 키까지 해석해 초기값을 채우고, styles 의 나머지 키는 보존
        const resolved = buildThemeTokens(data as ThemeRow)
        setTokenValues(resolved)
        const styles = (data.styles && typeof data.styles === "object") ? data.styles as Record<string, unknown> : {}
        const rest: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(styles)) {
          if (!k.startsWith("--")) rest[k] = v
        }
        setOtherStyles(rest)
        setApplied({
          html: data.template_html || "",
          css: data.template_css || "",
          slots: Array.isArray(data.slot_manifest) ? data.slot_manifest : [],
        })
      }
      setLoading(false)
    })()
    return () => { active = false }
  }, [id])

  const applyPreview = () => setApplied({ html, css, slots: slotManifest })

  const autoExtract = () => {
    const { fields, slots } = extractMarkers(html)
    setFieldManifest(fields)
    // 알려진 슬롯만 매니페스트에 반영
    setSlotManifest(slots.filter((s) => KNOWN_SLOTS.includes(s)))
    setMessage(`추출 완료 · 필드 ${fields.length}개 / 슬롯 ${slots.length}개`)
  }

  const save = async () => {
    setSaving(true); setMessage(null)
    // 토큰은 themes.styles 에 '--' 키로 저장 (레거시 키는 그대로 보존)
    const cleanTokens: Record<string, string> = {}
    for (const [k, v] of Object.entries(tokenValues)) {
      if (v) cleanTokens[k] = v
    }

    const { error } = await supabase.from("themes").update({
      name,
      render_engine: renderEngine,
      template_html: html,
      template_css: css,
      slot_manifest: slotManifest,
      field_manifest: fieldManifest,
      styles: { ...otherStyles, ...cleanTokens },
    }).eq("id", id)
    setSaving(false)
    setMessage(error ? `저장 실패: ${error.message}` : "저장되었습니다.")
  }

  const previewTemplate: ThemeTemplate = useMemo(
    () => ({ key: id, name, html: applied.html, css: applied.css, slots: applied.slots }),
    [id, name, applied]
  )
  const previewData = useMemo(() => buildFieldData(SAMPLE_RAW), [])
  // 토큰은 입력 즉시 미리보기에 반영된다 (iframe 재작성 없이 CSS 변수만 갱신)
  const tokens: TokenMap = useMemo(() => {
    const t: TokenMap = {}
    for (const [k, v] of Object.entries(tokenValues)) if (v) t[k] = v
    return t
  }, [tokenValues])
  const previewAccent = tokens["--accent"] || "#D76C6C"
  const previewSlots = useMemo(
    () => buildSlots(applied.slots, { accent: previewAccent, data: previewData, raw: SAMPLE_RAW }),
    [applied.slots, previewData, previewAccent]
  )

  if (loading) {
    return <div style={{ padding: 40, fontFamily: "system-ui" }}>불러오는 중…</div>
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 420px", gap: 24, padding: 24, fontFamily: "system-ui, sans-serif" }}>
      {/* 편집 폼 */}
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>템플릿 테마 편집</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
          디자이너가 추출한 HTML/CSS를 붙여넣고, 자동 추출로 필드·슬롯을 채운 뒤 저장하세요.
        </p>

        <Field label="테마 이름">
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="렌더 엔진">
          <div style={{ display: "flex", gap: 12 }}>
            {(["template", "legacy"] as const).map((v) => (
              <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
                <input type="radio" name="engine" checked={renderEngine === v} onChange={() => setRenderEngine(v)} />
                {v === "template" ? "template (새 iframe 렌더러)" : "legacy (기존 렌더러)"}
              </label>
            ))}
          </div>
        </Field>

        <Field label="TEMPLATE_HTML">
          <textarea value={html} onChange={(e) => setHtml(e.target.value)} spellCheck={false} style={{ ...textareaStyle, height: 200 }} />
        </Field>

        <Field label="TEMPLATE_CSS">
          <textarea value={css} onChange={(e) => setCss(e.target.value)} spellCheck={false} style={{ ...textareaStyle, height: 200 }} />
        </Field>

        <div style={{ display: "flex", gap: 8, margin: "8px 0 20px" }}>
          <button onClick={autoExtract} style={btn("#111827")}>필드·슬롯 자동 추출</button>
          <button onClick={applyPreview} style={btn("#374151")}>미리보기 적용</button>
        </div>

        <Field label={`슬롯 매니페스트 (${slotManifest.length})`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {KNOWN_SLOTS.map((s) => (
              <label key={s} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={slotManifest.includes(s)}
                  onChange={(e) => setSlotManifest((cur) => e.target.checked ? [...cur, s] : cur.filter((x) => x !== s))}
                />
                {s}
              </label>
            ))}
          </div>
        </Field>

        <Field label="디자인 토큰 (에셋 설정)">
          <p style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 10, lineHeight: 1.6 }}>
            테마 CSS의 <code>var(--토큰, 기본값)</code> 을 덮어씁니다. 비워두면 템플릿 원본 색/폰트가 그대로 유지됩니다.
            변경 시 우측 미리보기에 즉시 반영되며, 저장하면 발행 청첩장에도 동일하게 적용됩니다.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {TOKEN_FIELDS.map((t) => {
              const value = tokenValues[t.name] || ""
              const setValue = (v: string) => setTokenValues((cur) => ({ ...cur, [t.name]: v }))
              return (
                <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ fontSize: 12, color: "#374151", width: 92, flexShrink: 0 }}>{t.label}</label>
                  {t.type === "color" ? (
                    <>
                      <input
                        type="color"
                        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff"}
                        onChange={(e) => setValue(e.target.value)}
                        style={{ width: 34, height: 30, padding: 0, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", background: "#fff" }}
                      />
                      <input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="미지정"
                        style={{ ...inputStyle, flex: 1, fontSize: 12, padding: "6px 8px" }}
                      />
                    </>
                  ) : (
                    <input
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="예: 'Noto Serif KR', serif"
                      style={{ ...inputStyle, flex: 1, fontSize: 12, padding: "6px 8px" }}
                    />
                  )}
                  {value && (
                    <button
                      onClick={() => setValue("")}
                      title="초기화"
                      style={{ border: "none", background: "transparent", cursor: "pointer", color: "#9ca3af", fontSize: 14, padding: "0 2px" }}
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </Field>

        <Field label={`필드 매니페스트 (${fieldManifest.length})`}>
          <div style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.7, wordBreak: "break-all", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px" }}>
            {fieldManifest.length ? fieldManifest.join(", ") : "— (자동 추출을 실행하세요)"}
          </div>
        </Field>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
          <button onClick={save} disabled={saving} style={{ ...btn("#D76C6C"), opacity: saving ? 0.6 : 1 }}>
            {saving ? "저장 중…" : "저장"}
          </button>
          <a href={`/preview/theme/${id}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#2563eb" }}>
            새 탭에서 미리보기 →
          </a>
          {message && <span style={{ fontSize: 13, color: "#059669" }}>{message}</span>}
        </div>
      </div>

      {/* 실시간 미리보기 */}
      <div style={{ position: "sticky", top: 24, alignSelf: "start" }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>실시간 미리보기</div>
        <div style={{ display: "flex", justifyContent: "center", background: "#f3f4f6", borderRadius: 14, padding: "20px 0" }}>
          {applied.html
            ? <InvitationFrame template={previewTemplate} data={previewData} tokens={tokens} slots={previewSlots} width={380} height={680} />
            : <div style={{ fontSize: 13, color: "#9ca3af", padding: 40 }}>HTML을 입력하고 &lsquo;미리보기 적용&rsquo;을 누르세요.</div>}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, outline: "none", fontSize: 14,
}
const textareaStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, outline: "none",
  fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, lineHeight: 1.6, resize: "vertical",
}
function btn(bg: string): React.CSSProperties {
  return { padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: bg, color: "#fff", fontSize: 13 }
}
