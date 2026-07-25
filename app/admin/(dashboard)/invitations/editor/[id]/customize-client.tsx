"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { uploadFile } from "@/lib/storage"
import { InvitationFrame, type TokenMap } from "@/components/invitation/invitation-frame"
import { buildSlots } from "@/components/invitation/slot-registry"
import { buildFieldData, mergeInvitationRaw } from "@/lib/invitation-data"
import {
  buildThemeTokens,
  extractOverrideTokens,
  getFieldManifest,
  TOKEN_FIELDS,
  toThemeTemplate,
  type ThemeRow,
} from "@/lib/theme-template"
import { buildFontStack, fetchRegisteredFonts, resolveFontFaces, type RegisteredFont } from "@/lib/fonts"

/**
 * 템플릿 청첩장 커스터마이즈 편집기.
 * 실제 청첩장 데이터로 미리보기하고, 색/폰트 오버라이드뿐 아니라
 * 필드키에 연결된 텍스트/이미지, 갤러리, 식순, 계좌, 배경음악 등
 * 발행되는 청첩장에 들어가는 모든 콘텐츠를 이 화면에서 직접 관리한다.
 * 발행 경로와 동일한 mergeInvitationRaw / buildFieldData / InvitationFrame 을 쓰므로
 * "여기서 보이는 것 = 발행 결과" 가 보장된다.
 */

type FieldType = "text" | "textarea" | "tel" | "image"
interface FieldDef { key: string; label: string; type: FieldType }

/** field_manifest 에 있을 때만 노출되는 필드 (테마가 실제로 쓰는 것만 보여준다) */
const CONTENT_FIELD_DEFS: FieldDef[] = [
  { key: "groom_name", label: "신랑 이름", type: "text" },
  { key: "bride_name", label: "신부 이름", type: "text" },
  { key: "groom_name_en", label: "신랑 영문 이름", type: "text" },
  { key: "bride_name_en", label: "신부 영문 이름", type: "text" },
  { key: "groom_relationship", label: "신랑측 호칭", type: "text" },
  { key: "bride_relationship", label: "신부측 호칭", type: "text" },
  { key: "groom_father_name", label: "신랑 아버지 성함", type: "text" },
  { key: "groom_mother_name", label: "신랑 어머니 성함", type: "text" },
  { key: "bride_father_name", label: "신부 아버지 성함", type: "text" },
  { key: "bride_mother_name", label: "신부 어머니 성함", type: "text" },
  { key: "groom_phone", label: "신랑 연락처", type: "tel" },
  { key: "bride_phone", label: "신부 연락처", type: "tel" },
  { key: "groom_father_phone", label: "신랑 아버지 연락처", type: "tel" },
  { key: "groom_mother_phone", label: "신랑 어머니 연락처", type: "tel" },
  { key: "bride_father_phone", label: "신부 아버지 연락처", type: "tel" },
  { key: "bride_mother_phone", label: "신부 어머니 연락처", type: "tel" },
  { key: "venue_name", label: "예식장명", type: "text" },
  { key: "venue_hall", label: "홀 이름", type: "text" },
  { key: "venue_address", label: "예식장 주소", type: "text" },
  { key: "traffic_info", label: "교통 안내", type: "textarea" },
  { key: "parking_info", label: "주차 안내", type: "textarea" },
  { key: "greeting_message", label: "인사말", type: "textarea" },
  { key: "main_image", label: "메인 이미지", type: "image" },
  { key: "groom_photo", label: "신랑 사진", type: "image" },
  { key: "bride_photo", label: "신부 사진", type: "image" },
]

/** slot_manifest 에 'account' 가 있을 때만 노출 (필드키 마커가 아니라 슬롯 데이터라 field_manifest 에 없음) */
const ACCOUNT_FIELD_DEFS: FieldDef[] = [
  { key: "account_groom_bank", label: "신랑측 은행", type: "text" },
  { key: "account_groom_number", label: "신랑측 계좌번호", type: "text" },
  { key: "account_groom_holder", label: "신랑측 예금주", type: "text" },
  { key: "account_bride_bank", label: "신부측 은행", type: "text" },
  { key: "account_bride_number", label: "신부측 계좌번호", type: "text" },
  { key: "account_bride_holder", label: "신부측 예금주", type: "text" },
]

const ALL_TEXT_FIELD_DEFS = [...CONTENT_FIELD_DEFS, ...ACCOUNT_FIELD_DEFS]
const MANAGED_CONTENT_KEYS = new Set([
  ...ALL_TEXT_FIELD_DEFS.map((f) => f.key),
  "wedding_date", "wedding_time", "gallery_images", "gallery_view_type", "gallery_align", "wedding_programs", "show_wedding_program",
])

type SequenceRow = { time: string; title: string }

/** raw.wedding_programs 를 편집 가능한 {time,title}[] 로 정규화 (slot-registry 의 normalizeSequence 와 동일 규칙) */
function normalizeSequenceRows(value: unknown): SequenceRow[] {
  if (!Array.isArray(value)) return []
  const out: SequenceRow[] = []
  for (const item of value) {
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>
      const time = typeof o.time === "string" ? o.time : ""
      const title = typeof o.title === "string" ? o.title : typeof o.text === "string" ? o.text : ""
      out.push({ time, title })
    }
  }
  return out
}

function isProgramShown(value: unknown): boolean {
  return !(value === false || value === "false" || value === "아니오" || value === "off")
}

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
  const [activeThemeRow, setActiveThemeRow] = useState<ThemeRow>(themeRow)
  const [themeVersionId, setThemeVersionId] = useState<string | null>(
    typeof invitation.theme_version_id === "string" ? invitation.theme_version_id : null
  )
  const [availableThemes, setAvailableThemes] = useState<{ id: string; name: string }[]>(
    () => [{ id: themeRow.id, name: themeRow.name ?? "테마" }]
  )
  const [switchingTheme, setSwitchingTheme] = useState(false)

  useEffect(() => {
    supabase
      .from("themes")
      .select("id,name")
      .eq("render_engine", "template")
      .order("name")
      .then(({ data }) => {
        if (data && data.length > 0) setAvailableThemes(data as { id: string; name: string }[])
      })
  }, [])

  const handleThemeChange = async (newThemeId: string) => {
    if (newThemeId === activeThemeRow.id) return
    setSwitchingTheme(true)
    setMessage(null)
    try {
      const { data: newTheme, error: themeError } = await supabase
        .from("themes").select("*").eq("id", newThemeId).single()
      if (themeError || !newTheme) {
        setMessage("테마를 불러오지 못했습니다.")
        return
      }

      const { data: version } = await supabase
        .from("theme_versions").select("id")
        .eq("theme_id", newThemeId)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle()

      let versionId = version?.id ?? null
      if (!versionId) {
        // 이 테마에 버전 행이 아직 없으면(등록 직후 등) 최초 버전을 만들어준다
        const { data: created, error: createError } = await supabase
          .from("theme_versions")
          .insert({
            theme_id: newThemeId, version_number: 1,
            design_tokens: {}, block_variant_selections: {}, default_block_order: [],
            status: "active", change_note: "청첩장 편집기 테마 변경 시 자동 생성된 초기 버전",
          })
          .select("id").single()
        if (createError) {
          setMessage("테마 버전 생성에 실패했습니다.")
          return
        }
        versionId = created?.id ?? null
      }

      setActiveThemeRow(newTheme as ThemeRow)
      setThemeVersionId(versionId)
      setOverrides({}) // 이전 테마의 색/폰트 오버라이드는 새 테마에 그대로 적용하면 어색하므로 초기화
    } finally {
      setSwitchingTheme(false)
    }
  }

  const template = toThemeTemplate(activeThemeRow)
  const fieldManifest = useMemo(() => getFieldManifest(activeThemeRow), [activeThemeRow])
  const slots = template?.slots ?? []

  const visibleContentFields = useMemo(
    () => CONTENT_FIELD_DEFS.filter((f) => fieldManifest.includes(f.key)),
    [fieldManifest]
  )
  const showAccountFields = slots.includes("account")
  const showGallery = slots.includes("gallery")
  const showSequence = slots.includes("sequence")
  const showBgm = slots.includes("bgm")

  const initialRaw = useMemo(() => mergeInvitationRaw(invitation, customer), [invitation, customer])

  const themeTokens = useMemo(() => buildThemeTokens(activeThemeRow), [activeThemeRow])
  const [overrides, setOverrides] = useState<Record<string, string>>(
    () => extractOverrideTokens(invitation.customization_overrides)
  )

  const [content, setContent] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const f of ALL_TEXT_FIELD_DEFS) {
      const v = initialRaw[f.key]
      if (typeof v === "string") out[f.key] = v
    }
    return out
  })
  const setField = (key: string, value: string) => setContent((cur) => ({ ...cur, [key]: value }))

  const [weddingDate, setWeddingDate] = useState(String(initialRaw.wedding_date ?? ""))
  const [weddingTime, setWeddingTime] = useState(String(initialRaw.wedding_time ?? ""))

  const [galleryImages, setGalleryImages] = useState<string[]>(() =>
    Array.isArray(initialRaw.gallery_images)
      ? initialRaw.gallery_images.filter((v): v is string => typeof v === "string")
      : []
  )
  const [galleryViewType, setGalleryViewType] = useState<"slide" | "grid">(
    () => (initialRaw.gallery_view_type === "grid" ? "grid" : "slide")
  )
  const [galleryAlign, setGalleryAlign] = useState<"center" | "bottom">(
    () => (initialRaw.gallery_align === "bottom" ? "bottom" : "center")
  )
  const [sequenceRows, setSequenceRows] = useState<SequenceRow[]>(() => normalizeSequenceRows(initialRaw.wedding_programs))
  const [showProgram, setShowProgram] = useState(() => isProgramShown(initialRaw.show_wedding_program))
  const [bgmUrl, setBgmUrl] = useState(String(invitation.bgm_url ?? ""))
  const [bgms, setBgms] = useState<{ id: string; name: string; url: string }[]>([])
  const [fonts, setFonts] = useState<RegisteredFont[]>([])

  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!showBgm) return
    supabase.from("bgms").select("id,name,url").then(({ data }) => { if (data) setBgms(data) })
  }, [showBgm])

  useEffect(() => {
    fetchRegisteredFonts().then(setFonts)
  }, [])

  // 미리보기용 raw: 저장된 값 위에 현재 편집 중인 값을 얹는다 (발행 파이프라인과 동일 함수로 렌더)
  const liveRaw = useMemo(() => ({
    ...initialRaw,
    ...content,
    wedding_date: weddingDate,
    wedding_time: weddingTime,
    gallery_images: galleryImages,
    gallery_view_type: galleryViewType,
    gallery_align: galleryAlign,
    wedding_programs: sequenceRows,
    show_wedding_program: showProgram ? "예" : "아니오",
    bgm_url: bgmUrl,
  }), [initialRaw, content, weddingDate, weddingTime, galleryImages, galleryViewType, galleryAlign, sequenceRows, showProgram, bgmUrl])

  const data = useMemo(() => buildFieldData(liveRaw), [liveRaw])

  const tokens: TokenMap = useMemo(() => {
    const t: TokenMap = { ...themeTokens }
    for (const [k, v] of Object.entries(overrides)) if (v) t[k] = v
    return t
  }, [themeTokens, overrides])

  const fontFaces = useMemo(() => resolveFontFaces(tokens, fonts), [tokens, fonts])

  const accent = tokens["--accent"] || "#D76C6C"
  const previewSlots = useMemo(
    () => buildSlots(slots, { accent, data, raw: liveRaw, invitationId }),
    [slots, accent, data, liveRaw, invitationId]
  )

  const uploadImageField = async (key: string, file: File) => {
    setUploadingKey(key)
    try {
      const url = await uploadFile(file, "invitations/content")
      setField(key, url)
    } catch {
      setMessage("이미지 업로드에 실패했습니다.")
    } finally {
      setUploadingKey(null)
    }
  }

  const addGalleryImages = async (files: FileList) => {
    setUploadingKey("gallery_images")
    try {
      const urls = await Promise.all(Array.from(files).map((f) => uploadFile(f, "invitations/gallery")))
      setGalleryImages((cur) => [...cur, ...urls])
    } catch {
      setMessage("갤러리 이미지 업로드에 실패했습니다.")
    } finally {
      setUploadingKey(null)
    }
  }

  const save = async () => {
    setSaving(true); setMessage(null)

    const cleanTokens: Record<string, string> = {}
    for (const [k, v] of Object.entries(overrides)) if (v) cleanTokens[k] = v
    const existingOverrides = (invitation.customization_overrides && typeof invitation.customization_overrides === "object")
      ? invitation.customization_overrides as Record<string, unknown>
      : {}
    const preservedOverrideKeys: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(existingOverrides)) if (!k.startsWith("--")) preservedOverrideKeys[k] = v

    const existingContentData = (invitation.content_data && typeof invitation.content_data === "object")
      ? invitation.content_data as Record<string, unknown>
      : {}
    const preservedContentKeys: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(existingContentData)) if (!MANAGED_CONTENT_KEYS.has(k)) preservedContentKeys[k] = v

    const contentPayload: Record<string, unknown> = {
      ...preservedContentKeys,
      ...content,
      wedding_date: weddingDate,
      wedding_time: weddingTime,
      gallery_images: galleryImages,
      gallery_view_type: galleryViewType,
      gallery_align: galleryAlign,
      wedding_programs: sequenceRows,
      show_wedding_program: showProgram ? "예" : "아니오",
    }

    const { error } = await supabase
      .from("invitations")
      .update({
        content_data: contentPayload,
        customization_overrides: { ...preservedOverrideKeys, ...cleanTokens },
        bgm_url: bgmUrl || null,
        theme_version_id: themeVersionId,
        updated_at: new Date().toISOString(),
      })
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
    // 바깥 레이아웃(admin main)에 overflow-auto 가 있어도 flex 자식 높이가 콘텐츠에 맞춰 늘어나는 바람에
    // 실제로는 브라우저 창(window)이 스크롤되는 문제가 있다 — position:sticky 는 "가장 가까운
    // 스크롤 컨테이너"를 기준으로 계산되므로 그 컨테이너가 window 인지 main 인지 어긋나면 어디에도
    // 제대로 붙지 않는다. 그래서 sticky 대신, 높이를 뷰포트 기준으로 고정하고 왼쪽 패널만 자체
    // 스크롤시키는 방식(assets/themes/[id] 페이지와 동일 패턴)으로 우측 미리보기를 항상 고정한다.
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 420px", gap: 24, padding: 24, height: "calc(100vh - 100px)", fontFamily: "system-ui, sans-serif" }}>
      {/* 편집 */}
      <div style={{ minWidth: 0, maxWidth: 720, height: "100%", overflowY: "auto" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>청첩장 커스터마이즈</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
          {groom && bride ? `${groom} ♥ ${bride}` : "청첩장"}
        </p>

        <Section title="테마">
          <select
            value={activeThemeRow.id}
            onChange={(e) => handleThemeChange(e.target.value)}
            disabled={switchingTheme}
            style={inputStyle}
          >
            {availableThemes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {switchingTheme && (
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>테마를 불러오는 중…</p>
          )}
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
            테마를 바꾸면 이 청첩장의 색·폰트 오버라이드는 초기화됩니다. 저장을 눌러야 최종 반영됩니다.
          </p>
        </Section>

        <Section title="예식 일시 · 장소">
          <Row>
            <Field label="예식일">
              <input type="date" value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="예식 시간">
              <input value={weddingTime} onChange={(e) => setWeddingTime(e.target.value)} placeholder="예: 낮 12시" style={inputStyle} />
            </Field>
          </Row>
          {visibleContentFields.filter((f) => ["venue_name", "venue_hall", "venue_address"].includes(f.key)).map((f) => (
            <TextField key={f.key} def={f} value={content[f.key] || ""} onChange={(v) => setField(f.key, v)} />
          ))}
          {visibleContentFields.filter((f) => ["traffic_info", "parking_info"].includes(f.key)).map((f) => (
            <TextField key={f.key} def={f} value={content[f.key] || ""} onChange={(v) => setField(f.key, v)} />
          ))}
        </Section>

        <Section title="신랑 · 신부 정보">
          {visibleContentFields
            .filter((f) => !["venue_name", "venue_hall", "venue_address", "traffic_info", "parking_info", "greeting_message", "main_image", "groom_photo", "bride_photo"].includes(f.key))
            .map((f) => (
              <TextField key={f.key} def={f} value={content[f.key] || ""} onChange={(v) => setField(f.key, v)} />
            ))}
        </Section>

        {visibleContentFields.some((f) => f.key === "greeting_message") && (
          <Section title="인사말">
            <TextField
              def={{ key: "greeting_message", label: "인사말", type: "textarea" }}
              value={content.greeting_message || ""}
              onChange={(v) => setField("greeting_message", v)}
            />
          </Section>
        )}

        {visibleContentFields.some((f) => f.type === "image") && (
          <Section title="사진">
            {visibleContentFields.filter((f) => f.type === "image").map((f) => (
              <ImageField
                key={f.key}
                def={f}
                value={content[f.key] || ""}
                uploading={uploadingKey === f.key}
                onUpload={(file) => uploadImageField(f.key, file)}
                onClear={() => setField(f.key, "")}
              />
            ))}
          </Section>
        )}

        {showGallery && (
          <Section title="갤러리">
            <Field label="갤러리 형태">
              <div style={{ display: "flex", gap: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="radio" name="galleryViewType" checked={galleryViewType === "slide"}
                    onChange={() => setGalleryViewType("slide")}
                  />
                  슬라이드형
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="radio" name="galleryViewType" checked={galleryViewType === "grid"}
                    onChange={() => setGalleryViewType("grid")}
                  />
                  그리드형
                </label>
              </div>
            </Field>
            {galleryViewType === "slide" && (
              <Field label="사진 정렬 (슬라이드형)">
                <div style={{ display: "flex", gap: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="radio" name="galleryAlign" checked={galleryAlign === "center"}
                      onChange={() => setGalleryAlign("center")}
                    />
                    중앙정렬
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="radio" name="galleryAlign" checked={galleryAlign === "bottom"}
                      onChange={() => setGalleryAlign("bottom")}
                    />
                    하단정렬
                  </label>
                </div>
              </Field>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8, marginBottom: 10 }}>
              {galleryImages.map((url, i) => (
                <div key={i} style={{ position: "relative", aspectRatio: "1/1", borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb" }}>
                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button
                    onClick={() => setGalleryImages((cur) => cur.filter((_, idx) => idx !== i))}
                    title="삭제"
                    style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.6)", color: "#fff", fontSize: 12, cursor: "pointer" }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <label style={{ fontSize: 12.5, color: "#2563eb", cursor: "pointer" }}>
              {uploadingKey === "gallery_images" ? "업로드 중…" : "+ 이미지 추가"}
              <input
                type="file" accept="image/*" multiple style={{ display: "none" }}
                disabled={uploadingKey === "gallery_images"}
                onChange={(e) => { if (e.target.files?.length) addGalleryImages(e.target.files); e.target.value = "" }}
              />
            </label>
          </Section>
        )}

        {showSequence && (
          <Section title="식순">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={showProgram} onChange={(e) => setShowProgram(e.target.checked)} />
              식순 섹션 노출
            </label>
            {showProgram && (
              <>
                {sequenceRows.map((row, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <input
                      value={row.time}
                      onChange={(e) => setSequenceRows((cur) => cur.map((r, idx) => idx === i ? { ...r, time: e.target.value } : r))}
                      placeholder="12:00" style={{ ...inputStyle, width: 90 }}
                    />
                    <input
                      value={row.title}
                      onChange={(e) => setSequenceRows((cur) => cur.map((r, idx) => idx === i ? { ...r, title: e.target.value } : r))}
                      placeholder="신랑 신부 입장" style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      onClick={() => setSequenceRows((cur) => cur.filter((_, idx) => idx !== i))}
                      style={{ border: "none", background: "transparent", color: "#9ca3af", cursor: "pointer", fontSize: 16 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setSequenceRows((cur) => [...cur, { time: "", title: "" }])}
                  style={{ fontSize: 12.5, color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  + 순서 추가
                </button>
              </>
            )}
          </Section>
        )}

        {showAccountFields && (
          <Section title="마음 전하실 곳 (계좌)">
            {ACCOUNT_FIELD_DEFS.map((f) => (
              <TextField key={f.key} def={f} value={content[f.key] || ""} onChange={(v) => setField(f.key, v)} />
            ))}
          </Section>
        )}

        {showBgm && (
          <Section title="배경음악">
            <select
              value={bgms.some((b) => b.url === bgmUrl) ? bgmUrl : ""}
              onChange={(e) => { if (e.target.value) setBgmUrl(e.target.value) }}
              style={{ ...inputStyle, marginBottom: 8 }}
            >
              <option value="">직접 입력 (아래)</option>
              {bgms.map((b) => (
                <option key={b.id} value={b.url}>{b.name}</option>
              ))}
            </select>
            <input value={bgmUrl} onChange={(e) => setBgmUrl(e.target.value)} placeholder="BGM 파일 URL" style={inputStyle} />
          </Section>
        )}

        <Section title="디자인 토큰 (색 · 폰트)">
          <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>비워두면 테마 기본값이 사용됩니다.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {TOKEN_FIELDS.map((t) => {
              const value = overrides[t.name] || ""
              const placeholder = themeTokens[t.name] || "테마 기본값"
              const setValue = (v: string) => setOverrides((cur) => ({ ...cur, [t.name]: v }))
              const matchedFontStack = t.type === "font"
                ? fonts.map((f) => buildFontStack(f, t.name)).find((stack) => stack === value)
                : undefined
              return (
                <div key={t.name} style={{ display: "flex", alignItems: t.type === "font" ? "flex-start" : "center", gap: 8 }}>
                  <label style={{ fontSize: 12, color: "#374151", width: 92, flexShrink: 0, paddingTop: t.type === "font" ? 6 : 0 }}>{t.label}</label>
                  {t.type === "color" ? (
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : (/^#[0-9a-fA-F]{6}$/.test(placeholder) ? placeholder : "#ffffff")}
                      onChange={(e) => setValue(e.target.value)}
                      style={{ width: 34, height: 30, padding: 0, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", background: "#fff" }}
                    />
                  ) : null}
                  {t.type === "font" ? (
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      {fonts.length > 0 && (
                        <select
                          value={matchedFontStack || ""}
                          onChange={(e) => { if (e.target.value) setValue(e.target.value) }}
                          style={{ padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 8, outline: "none", fontSize: 12 }}
                        >
                          <option value="">에셋에 등록된 폰트 선택…</option>
                          {fonts.map((f) => (
                            <option key={f.id} value={buildFontStack(f, t.name)}>{f.name}</option>
                          ))}
                        </select>
                      )}
                      <input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={placeholder}
                        style={{ padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 8, outline: "none", fontSize: 12 }}
                      />
                    </div>
                  ) : (
                    <input
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={placeholder}
                      style={{ flex: 1, minWidth: 0, padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 8, outline: "none", fontSize: 12 }}
                    />
                  )}
                  {value && (
                    <button onClick={() => setValue("")} title="테마 기본값으로" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#9ca3af", fontSize: 14, alignSelf: t.type === "font" ? "flex-start" : "center", marginTop: t.type === "font" ? 4 : 0 }}>×</button>
                  )}
                </div>
              )
            })}
          </div>
        </Section>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24, position: "sticky", bottom: 0, background: "#fff", padding: "12px 0" }}>
          <button onClick={save} disabled={saving} style={{ padding: "10px 20px", borderRadius: 8, border: "none", cursor: saving ? "wait" : "pointer", background: "#D76C6C", color: "#fff", fontSize: 14, opacity: saving ? 0.6 : 1 }}>
            {saving ? "저장 중…" : "저장"}
          </button>
          {publicSlug && (
            <a href={`/w/${publicSlug}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#2563eb" }}>
              발행 청첩장 열기 →
            </a>
          )}
          {message && <span style={{ fontSize: 13, color: message.startsWith("저장되") ? "#059669" : "#dc2626" }}>{message}</span>}
        </div>
      </div>

      {/* 미리보기 — 이 컬럼 자체는 스크롤되지 않으므로(왼쪽만 overflowY:auto) 항상 화면에 고정된다 */}
      <div style={{ height: "100%", overflow: "hidden" }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>실시간 미리보기 (실제 데이터)</div>
        <div style={{ display: "flex", justifyContent: "center", background: "#f3f4f6", borderRadius: 14, padding: "20px 0" }}>
          <InvitationFrame template={template} data={data} tokens={tokens} slots={previewSlots} fontFaces={fontFaces} width={380} height={680} />
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #e5e7eb" }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

function TextField({ def, value, onChange }: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={def.label}>
      {def.type === "textarea" ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
      ) : (
        <input
          type={def.type === "tel" ? "tel" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      )}
    </Field>
  )
}

function ImageField({ def, value, uploading, onUpload, onClear }: {
  def: FieldDef; value: string; uploading: boolean; onUpload: (file: File) => void; onClear: () => void
}) {
  return (
    <Field label={def.label}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 64, height: 64, borderRadius: 8, overflow: "hidden", background: "#f3f4f6", border: "1px solid #e5e7eb", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {value ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 10, color: "#9ca3af" }}>없음</span>}
        </div>
        <label style={{ fontSize: 12.5, color: "#2563eb", cursor: uploading ? "wait" : "pointer" }}>
          {uploading ? "업로드 중…" : "이미지 선택"}
          <input
            type="file" accept="image/*" style={{ display: "none" }} disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = "" }}
          />
        </label>
        {value && (
          <button onClick={onClear} style={{ border: "none", background: "transparent", color: "#9ca3af", cursor: "pointer", fontSize: 12 }}>제거</button>
        )}
      </div>
    </Field>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, outline: "none", fontSize: 13,
}
