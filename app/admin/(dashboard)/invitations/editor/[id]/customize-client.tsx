"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { ExternalLink, Image as ImageIcon, Loader2, Plus, Save, X } from "lucide-react"
import { toast } from "sonner"

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
  { key: "account_groom_bank", label: "은행", type: "text" },
  { key: "account_groom_number", label: "계좌번호", type: "text" },
  { key: "account_groom_holder", label: "예금주", type: "text" },
  { key: "account_bride_bank", label: "은행", type: "text" },
  { key: "account_bride_number", label: "계좌번호", type: "text" },
  { key: "account_bride_holder", label: "예금주", type: "text" },
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
    try {
      const { data: newTheme, error: themeError } = await supabase
        .from("themes").select("*").eq("id", newThemeId).single()
      if (themeError || !newTheme) {
        toast.error("테마를 불러오지 못했습니다.")
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
          toast.error("테마 버전 생성에 실패했습니다.")
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
      toast.error("이미지 업로드에 실패했습니다.")
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
      toast.error("갤러리 이미지 업로드에 실패했습니다.")
    } finally {
      setUploadingKey(null)
    }
  }

  const save = async () => {
    setSaving(true)

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
    if (error) {
      toast.error(`저장 실패: ${error.message}`)
    } else {
      toast.success("저장되었습니다.")
    }
  }

  const groom = String(data.groom_name ?? "")
  const bride = String(data.bride_name ?? "")

  if (!template) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        템플릿 테마를 불러올 수 없습니다.
      </div>
    )
  }

  return (
    // 바깥 레이아웃(admin main)에 overflow-auto 가 있어도 flex 자식 높이가 콘텐츠에 맞춰 늘어나는 바람에
    // 실제로는 브라우저 창(window)이 스크롤되는 문제가 있다 — position:sticky 는 "가장 가까운
    // 스크롤 컨테이너"를 기준으로 계산되므로 그 컨테이너가 window 인지 main 인지 어긋나면 어디에도
    // 제대로 붙지 않는다. 그래서 sticky 대신, 높이를 뷰포트 기준으로 고정하고 왼쪽 패널만 자체
    // 스크롤시키는 방식(assets/themes/[id] 페이지와 동일 패턴)으로 우측 미리보기를 항상 고정한다.
    <div className="grid h-[calc(100vh-100px)] grid-cols-[minmax(0,1fr)_420px] gap-6 font-sans">
      {/* 편집 */}
      <div className="min-w-0 max-w-3xl h-full overflow-y-auto pr-1">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">청첩장 커스터마이즈</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {groom && bride ? `${groom} ♥ ${bride}` : "청첩장"}
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">테마</CardTitle>
              <CardDescription>
                테마를 바꾸면 이 청첩장의 색·폰트 오버라이드는 초기화됩니다. 저장을 눌러야 최종 반영됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Field>
                <Select value={activeThemeRow.id} onValueChange={handleThemeChange} disabled={switchingTheme}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableThemes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {switchingTheme && <FieldDescription>테마를 불러오는 중…</FieldDescription>}
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">예식 일시 · 장소</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="weddingDate">예식일</FieldLabel>
                    <Input id="weddingDate" type="date" value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="weddingTime">예식 시간</FieldLabel>
                    <Input id="weddingTime" value={weddingTime} onChange={(e) => setWeddingTime(e.target.value)} placeholder="예: 낮 12시" />
                  </Field>
                </div>
                {visibleContentFields.filter((f) => ["venue_name", "venue_hall", "venue_address"].includes(f.key)).map((f) => (
                  <TextField key={f.key} def={f} value={content[f.key] || ""} onChange={(v) => setField(f.key, v)} />
                ))}
                {visibleContentFields.filter((f) => ["traffic_info", "parking_info"].includes(f.key)).map((f) => (
                  <TextField key={f.key} def={f} value={content[f.key] || ""} onChange={(v) => setField(f.key, v)} />
                ))}
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">신랑 · 신부 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {visibleContentFields
                  .filter((f) => !["venue_name", "venue_hall", "venue_address", "traffic_info", "parking_info", "greeting_message", "main_image", "groom_photo", "bride_photo"].includes(f.key))
                  .map((f) => (
                    <TextField key={f.key} def={f} value={content[f.key] || ""} onChange={(v) => setField(f.key, v)} />
                  ))}
              </FieldGroup>
            </CardContent>
          </Card>

          {visibleContentFields.some((f) => f.key === "greeting_message") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">인사말</CardTitle>
              </CardHeader>
              <CardContent>
                <TextField
                  def={{ key: "greeting_message", label: "인사말", type: "textarea" }}
                  value={content.greeting_message || ""}
                  onChange={(v) => setField("greeting_message", v)}
                />
              </CardContent>
            </Card>
          )}

          {visibleContentFields.some((f) => f.type === "image") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">사진</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                </FieldGroup>
              </CardContent>
            </Card>
          )}

          {showGallery && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">갤러리</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup className="space-y-4">
                  <Field>
                    <FieldLabel>갤러리 형태</FieldLabel>
                    <RadioGroup
                      value={galleryViewType}
                      onValueChange={(v) => setGalleryViewType(v as "slide" | "grid")}
                      className="flex flex-row gap-6"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="slide" id="gallery-view-slide" />
                        <Label htmlFor="gallery-view-slide" className="font-normal cursor-pointer">슬라이드형</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="grid" id="gallery-view-grid" />
                        <Label htmlFor="gallery-view-grid" className="font-normal cursor-pointer">그리드형</Label>
                      </div>
                    </RadioGroup>
                  </Field>

                  {galleryViewType === "slide" && (
                    <Field>
                      <FieldLabel>사진 정렬 (슬라이드형)</FieldLabel>
                      <RadioGroup
                        value={galleryAlign}
                        onValueChange={(v) => setGalleryAlign(v as "center" | "bottom")}
                        className="flex flex-row gap-6"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="center" id="gallery-align-center" />
                          <Label htmlFor="gallery-align-center" className="font-normal cursor-pointer">중앙정렬</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="bottom" id="gallery-align-bottom" />
                          <Label htmlFor="gallery-align-bottom" className="font-normal cursor-pointer">하단정렬</Label>
                        </div>
                      </RadioGroup>
                    </Field>
                  )}

                  <Field>
                    <FieldLabel>사진 목록</FieldLabel>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2">
                      {galleryImages.map((url, i) => (
                        <div key={i} className="relative aspect-square overflow-hidden rounded-md border">
                          <img src={url} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setGalleryImages((cur) => cur.filter((_, idx) => idx !== i))}
                            title="삭제"
                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <GalleryUploadButton uploading={uploadingKey === "gallery_images"} onSelect={addGalleryImages} />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>
          )}

          {showSequence && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">식순</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch id="showProgram" checked={showProgram} onCheckedChange={setShowProgram} />
                    <Label htmlFor="showProgram" className="font-normal cursor-pointer">식순 섹션 노출</Label>
                  </div>
                  {showProgram && (
                    <div className="space-y-2">
                      {sequenceRows.map((row, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            value={row.time}
                            onChange={(e) => setSequenceRows((cur) => cur.map((r, idx) => idx === i ? { ...r, time: e.target.value } : r))}
                            placeholder="12:00"
                            className="w-24 shrink-0"
                          />
                          <Input
                            value={row.title}
                            onChange={(e) => setSequenceRows((cur) => cur.map((r, idx) => idx === i ? { ...r, title: e.target.value } : r))}
                            placeholder="신랑 신부 입장"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setSequenceRows((cur) => cur.filter((_, idx) => idx !== i))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setSequenceRows((cur) => [...cur, { time: "", title: "" }])}
                      >
                        <Plus className="h-3.5 w-3.5" /> 순서 추가
                      </Button>
                    </div>
                  )}
                </FieldGroup>
              </CardContent>
            </Card>
          )}

          {showAccountFields && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">마음 전하실 곳 (계좌)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <FieldGroup className="space-y-4">
                    <p className="text-sm font-medium text-muted-foreground">신랑측</p>
                    {ACCOUNT_FIELD_DEFS.slice(0, 3).map((f) => (
                      <TextField key={f.key} def={f} value={content[f.key] || ""} onChange={(v) => setField(f.key, v)} />
                    ))}
                  </FieldGroup>
                  <FieldGroup className="space-y-4">
                    <p className="text-sm font-medium text-muted-foreground">신부측</p>
                    {ACCOUNT_FIELD_DEFS.slice(3, 6).map((f) => (
                      <TextField key={f.key} def={f} value={content[f.key] || ""} onChange={(v) => setField(f.key, v)} />
                    ))}
                  </FieldGroup>
                </div>
              </CardContent>
            </Card>
          )}

          {showBgm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">배경음악</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup className="space-y-3">
                  <Field>
                    <Select
                      value={bgms.some((b) => b.url === bgmUrl) ? bgmUrl : "custom"}
                      onValueChange={(v) => { if (v !== "custom") setBgmUrl(v) }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">직접 입력 (아래)</SelectItem>
                        {bgms.map((b) => (
                          <SelectItem key={b.id} value={b.url}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <Input value={bgmUrl} onChange={(e) => setBgmUrl(e.target.value)} placeholder="BGM 파일 URL" />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">디자인 토큰 (색 · 폰트)</CardTitle>
              <CardDescription>비워두면 테마 기본값이 사용됩니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {TOKEN_FIELDS.map((t) => {
                  const value = overrides[t.name] || ""
                  const placeholder = themeTokens[t.name] || "테마 기본값"
                  const setValue = (v: string) => setOverrides((cur) => ({ ...cur, [t.name]: v }))
                  const matchedFontStack = t.type === "font"
                    ? fonts.map((f) => buildFontStack(f, t.name)).find((stack) => stack === value)
                    : undefined
                  return (
                    <Field key={t.name}>
                      <FieldLabel>{t.label}</FieldLabel>
                      <div className="flex items-start gap-2">
                        {t.type === "color" && (
                          <input
                            type="color"
                            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : (/^#[0-9a-fA-F]{6}$/.test(placeholder) ? placeholder : "#ffffff")}
                            onChange={(e) => setValue(e.target.value)}
                            className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
                          />
                        )}
                        {t.type === "font" ? (
                          <div className="flex min-w-0 flex-1 flex-col gap-2">
                            {fonts.length > 0 && (
                              <Select
                                value={matchedFontStack || ""}
                                onValueChange={(v) => { if (v) setValue(v) }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="에셋에 등록된 폰트 선택…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {fonts.map((f) => (
                                    <SelectItem key={f.id} value={buildFontStack(f, t.name)}>{f.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
                          </div>
                        ) : t.type !== "color" ? (
                          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="flex-1" />
                        ) : (
                          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1" />
                        )}
                        {value && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="테마 기본값으로"
                            onClick={() => setValue("")}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </Field>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="sticky bottom-0 mt-6 flex items-center gap-3 border-t bg-background py-4">
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "저장 중…" : "저장"}
          </Button>
          {publicSlug && (
            <Button variant="outline" asChild>
              <a href={`/w/${publicSlug}`} target="_blank" rel="noreferrer" className="gap-2">
                발행 청첩장 열기 <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* 미리보기 — 이 컬럼 자체는 스크롤되지 않으므로(왼쪽만 overflow-y-auto) 항상 화면에 고정된다 */}
      <div className="h-full overflow-hidden">
        <div className="mb-2.5 text-xs text-muted-foreground">실시간 미리보기 (실제 데이터)</div>
        <div className="flex justify-center rounded-2xl bg-muted/40 py-5">
          <InvitationFrame template={template} data={data} tokens={tokens} slots={previewSlots} fontFaces={fontFaces} width={380} height={680} />
        </div>
      </div>
    </div>
  )
}

function TextField({ def, value, onChange }: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  return (
    <Field>
      <FieldLabel htmlFor={def.key}>{def.label}</FieldLabel>
      {def.type === "textarea" ? (
        <Textarea id={def.key} value={value} onChange={(e) => onChange(e.target.value)} rows={4} />
      ) : (
        <Input id={def.key} type={def.type === "tel" ? "tel" : "text"} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  )
}

function ImageField({ def, value, uploading, onUpload, onClear }: {
  def: FieldDef; value: string; uploading: boolean; onUpload: (file: File) => void; onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <Field>
      <FieldLabel>{def.label}</FieldLabel>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="gap-1.5"
          >
            {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {uploading ? "업로드 중…" : "이미지 선택"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear} className="h-auto px-1 py-0 text-xs text-muted-foreground">
              제거
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = "" }}
      />
    </Field>
  )
}

function GalleryUploadButton({ uploading, onSelect }: { uploading: boolean; onSelect: (files: FileList) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="gap-1.5"
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        {uploading ? "업로드 중…" : "이미지 추가"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={uploading}
        onChange={(e) => { if (e.target.files?.length) onSelect(e.target.files); e.target.value = "" }}
      />
    </div>
  )
}
