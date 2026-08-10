"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { uploadImage } from "@/lib/image-upload"
import { InvitationFrame, type TokenMap } from "@/components/invitation/invitation-frame"
import { ScaledPreview } from "@/components/ui/scaled-preview"
import { buildSlots } from "@/components/invitation/slot-registry"
import { buildFieldData, mergeInvitationRaw } from "@/lib/invitation-data"
import {
  BLOCK_KEYS,
  BLOCK_LABEL_FALLBACK,
  buildThemeTokens,
  extractBlockOverrides,
  extractDisabledSlots,
  extractSectionImages,
  getBlockManifest,
  getFieldManifest,
  getHiddenBlocks,
  SIZE_TOKEN_FIELDS,
  TOKEN_FIELDS,
  toThemeTemplate,
  type BlockOverride,
  type SectionImage,
  type ThemeRow,
} from "@/lib/theme-template"
import { buildFontStack, fetchRegisteredFonts, fontPreviewStyle, resolveFontFaces, type RegisteredFont } from "@/lib/fonts"
import { useInjectFontFaces } from "@/lib/use-font-faces"
import { useInvitationRevisionsQuery, useResolveRevisionMutation } from "@/hooks/queries/useInvitationRevisions"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Slider } from "@/components/ui/slider"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Copy, ExternalLink, Image as ImageIcon, Loader2, Plus, Save, X } from "lucide-react"
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

const REVIEW_STATUS_LABEL: Record<string, string> = {
  none: "검수 전",
  in_review: "검수 요청됨",
  changes_requested: "수정 요청 있음",
  approved: "확정됨",
}

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
  { key: "groom_sns_instagram", label: "신랑 인스타그램", type: "text" },
  { key: "bride_sns_instagram", label: "신부 인스타그램", type: "text" },
  { key: "venue_name", label: "예식장명", type: "text" },
  { key: "venue_hall", label: "홀 이름", type: "text" },
  { key: "venue_address", label: "예식장 주소", type: "text" },
  { key: "traffic_info", label: "교통 안내", type: "textarea" },
  { key: "parking_info", label: "주차 안내", type: "textarea" },
  { key: "shuttle_info", label: "셔틀버스 안내", type: "textarea" },
  { key: "greeting_message", label: "인사말", type: "textarea" },
  { key: "main_image", label: "메인 이미지", type: "image" },
  { key: "groom_photo", label: "신랑 사진", type: "image" },
  { key: "bride_photo", label: "신부 사진", type: "image" },
  { key: "greeting_image", label: "인사말 이미지 (선택)", type: "image" },
  { key: "rsvp_meal_menu", label: "식사 종류 (쉼표로 구분, 비우면 한식/양식 기본)", type: "text" },
]

/** slot_manifest 에 'account' 가 있을 때만 노출 (필드키 마커가 아니라 슬롯 데이터라 field_manifest 에 없음) */
const ACCOUNT_FIELD_DEFS: FieldDef[] = [
  { key: "account_groom_bank", label: "은행", type: "text" },
  { key: "account_groom_number", label: "계좌번호", type: "text" },
  { key: "account_groom_holder", label: "예금주", type: "text" },
  { key: "account_bride_bank", label: "은행", type: "text" },
  { key: "account_bride_number", label: "계좌번호", type: "text" },
  { key: "account_bride_holder", label: "예금주", type: "text" },
  { key: "extra_account_groom", label: "신랑측 혼주 계좌 (자유 입력)", type: "textarea" },
  { key: "extra_account_bride", label: "신부측 혼주 계좌 (자유 입력)", type: "textarea" },
]

/** 부모 이름 필드 → 고인(故) 표시 플래그 필드키. buildFieldData 가 이 값을 보고 이름 앞에 '故 '를 붙인다 */
const DECEASED_KEY_BY_NAME_FIELD: Record<string, string> = {
  groom_father_name: "groom_father_deceased",
  groom_mother_name: "groom_mother_deceased",
  bride_father_name: "bride_father_deceased",
  bride_mother_name: "bride_mother_deceased",
}
const DECEASED_KEYS = Object.values(DECEASED_KEY_BY_NAME_FIELD)

/** slot_manifest 에 'contact' 가 있을 때만 노출 (연락처 표시 여부 토글에 쓰는 이름 라벨용) */
const CONTACT_FIELD_DEFS: FieldDef[] = [
  { key: "groom_phone", label: "신랑 연락처", type: "tel" },
  { key: "groom_father_phone", label: "신랑 아버지 연락처", type: "tel" },
  { key: "groom_mother_phone", label: "신랑 어머니 연락처", type: "tel" },
  { key: "bride_phone", label: "신부 연락처", type: "tel" },
  { key: "bride_father_phone", label: "신부 아버지 연락처", type: "tel" },
  { key: "bride_mother_phone", label: "신부 어머니 연락처", type: "tel" },
]

/** 슬롯 키 → 관리 화면에 보여줄 한글 이름. 테마가 지원하는 기능 중 이 청첩장만 끄고 싶을 때 쓴다 */
const SLOT_LABELS: Record<string, string> = {
  bgm: "배경음악",
  gallery: "갤러리",
  sequence: "식순",
  calendar: "캘린더 · D-day",
  account: "마음 전하실 곳 (계좌)",
  contact: "연락처",
  map: "오시는 길 (지도)",
  rsvp: "참석 의사 전달",
  guestbook: "방명록",
  share: "청첩장 공유",
}

const ALL_TEXT_FIELD_DEFS = [...CONTENT_FIELD_DEFS, ...ACCOUNT_FIELD_DEFS]
const MANAGED_CONTENT_KEYS = new Set([
  ...ALL_TEXT_FIELD_DEFS.map((f) => f.key),
  "wedding_date", "wedding_time", "gallery_images", "gallery_view_type", "gallery_align", "wedding_programs", "show_wedding_program",
  "phone_expose", "groom_show_phone", "bride_show_phone",
  ...DECEASED_KEYS,
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

/** '아니오'/false/'off' 가 아니면 표시로 간주 (미설정은 항상 표시) — 식순 노출, 연락처 노출 토글에 공용으로 쓴다 */
function isShown(value: unknown): boolean {
  return !(value === false || value === "false" || value === "아니오" || value === "아니요" || value === "off")
}

/** 목록 항목을 인접한 위치와 맞바꾼다 — 갤러리 사진 순서, 섹션 삽입 이미지 순서 재정렬에 공용으로 쓴다 */
function moveArrayItem<T>(arr: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (index < 0 || target < 0 || target >= arr.length) return arr
  const next = [...arr]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/**
 * 테마 CSS에서 사이즈 토큰의 실제 폴백 값을 읽는다 (예: `var(--text-title, 18px)` → 18).
 * 사이즈 토큰은 themes.styles 에 기본값을 따로 저장하지 않고 CSS 폴백을 유일한 기본값 출처로
 * 삼기로 했으므로(THEME_TOKEN_GUIDE.md §1.2), 슬라이더에 보여줄 "테마 기본값"은 여기서 파싱한다.
 */
function extractTokenDefault(css: string, tokenName: string): number | null {
  const escaped = tokenName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
  const match = new RegExp(`var\\(${escaped}\\s*,\\s*(\\d+(?:\\.\\d+)?)px\\)`).exec(css)
  return match ? Number(match[1]) : null
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
      setOverrides({}) // 이전 테마의 색/폰트/크기 오버라이드는 새 테마에 그대로 적용하면 어색하므로 초기화
      setDisabledSlots([]) // 새 테마는 슬롯 구성이 다를 수 있으므로 기능 끄기 상태도 함께 초기화
      setBlockOverrides({}) // 블럭 여백/타이틀 오버라이드도 동일한 이유로 초기화
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
  const showContact = slots.includes("contact")
  const showGallery = slots.includes("gallery")
  const showSequence = slots.includes("sequence")
  const showBgm = slots.includes("bgm")

  const initialRaw = useMemo(() => mergeInvitationRaw(invitation, customer), [invitation, customer])

  const themeTokens = useMemo(() => buildThemeTokens(activeThemeRow), [activeThemeRow])

  /** 색/폰트 토큰은 문자열로, 사이즈 토큰(SIZE_TOKEN_FIELDS)은 숫자로 보관한다 — extractOverrideTokens 와
   * 동일 저장 규칙이지만 여긴 편집 중 상태라 숫자를 'px' 문자열로 정규화하기 전 원본 타입을 유지해야
   * 슬라이더에 그대로 바인딩할 수 있다. */
  const [overrides, setOverrides] = useState<Record<string, string | number>>(() => {
    const out: Record<string, string | number> = {}
    const raw = invitation.customization_overrides
    if (raw && typeof raw === "object") {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (!k.startsWith("--")) continue
        if (typeof v === "string" && v) out[k] = v
        else if (typeof v === "number" && Number.isFinite(v)) out[k] = v
      }
    }
    return out
  })
  const setOverride = (name: string, value: string | number) => setOverrides((cur) => ({ ...cur, [name]: value }))
  const clearOverride = (name: string) => setOverrides((cur) => { const next = { ...cur }; delete next[name]; return next })

  const [disabledSlots, setDisabledSlots] = useState<string[]>(
    () => extractDisabledSlots(invitation.customization_overrides)
  )
  const toggleSlot = (key: string, enabled: boolean) =>
    setDisabledSlots((cur) => enabled ? cur.filter((s) => s !== key) : Array.from(new Set([...cur, key])))

  /** 블럭별 여백/타이틀 오버라이드. 값이 없는 필드는 저장 시 undefined 라 JSON 직렬화에서 자동으로 빠진다 */
  const [blockOverrides, setBlockOverrides] = useState<Record<string, BlockOverride>>(
    () => extractBlockOverrides(invitation.customization_overrides)
  )
  const setBlockOverride = (key: string, patch: Partial<BlockOverride>) =>
    setBlockOverrides((cur) => ({ ...cur, [key]: { ...cur[key], ...patch } }))
  /** 블럭 아코디언에서 펼친 블럭 — 미리보기가 이 블럭으로 스크롤한다 */
  const [focusBlock, setFocusBlock] = useState<string | null>(null)

  /** 섹션 사이 삽입 이미지. 배열 순서 = 렌더 순서 (같은 afterBlock 안에서). 위치는 afterBlock
   * 드롭다운으로, 순서는 위/아래 버튼으로 바꾼다 — 삭제 후 재업로드가 필요 없다. */
  const [sectionImages, setSectionImages] = useState<SectionImage[]>(
    () => extractSectionImages(invitation.customization_overrides)
  )
  const [isUploadingSectionImage, setIsUploadingSectionImage] = useState(false)
  const addSectionImage = async (file: File) => {
    setIsUploadingSectionImage(true)
    try {
      const url = await uploadImage(file, "invitations/section-images")
      setSectionImages((cur) => [
        ...cur,
        { id: `si_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, url, afterBlock: editableBlocks[0]?.key ?? "" },
      ])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.")
    } finally {
      setIsUploadingSectionImage(false)
    }
  }
  const updateSectionImage = (id: string, patch: Partial<SectionImage>) =>
    setSectionImages((cur) => cur.map((img) => (img.id === id ? { ...img, ...patch } : img)))
  const removeSectionImage = (id: string) =>
    setSectionImages((cur) => cur.filter((img) => img.id !== id))
  const moveSectionImage = (id: string, direction: -1 | 1) =>
    setSectionImages((cur) => moveArrayItem(cur, cur.findIndex((img) => img.id === id), direction))

  const [content, setContent] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const f of ALL_TEXT_FIELD_DEFS) {
      const v = initialRaw[f.key]
      if (typeof v === "string") out[f.key] = v
    }
    for (const key of DECEASED_KEYS) {
      const v = initialRaw[key]
      if (typeof v === "string") out[key] = v
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
  const [showProgram, setShowProgram] = useState(() => isShown(initialRaw.show_wedding_program))
  const [phoneExpose, setPhoneExpose] = useState(() => isShown(initialRaw.phone_expose))
  // 연락처 표시가 켜져 있어도 신랑/신부 본인만 개별로 숨길 수 있다 (혼주 연락처는 전체 스위치만 따른다)
  const [groomShowPhone, setGroomShowPhone] = useState(() => isShown(initialRaw.groom_show_phone))
  const [brideShowPhone, setBrideShowPhone] = useState(() => isShown(initialRaw.bride_show_phone))
  const [bgmUrl, setBgmUrl] = useState(String(invitation.bgm_url ?? ""))
  const [bgms, setBgms] = useState<{ id: string; name: string; url: string }[]>([])
  const [fonts, setFonts] = useState<RegisteredFont[]>([])

  /** 카카오톡 등 공유 시 링크 미리보기에 쓰이는 값 — content_data 가 아니라
   * invitations.og_meta 컬럼에 저장된다 (app/w/[slug]/page.tsx의 generateMetadata가 읽는 값과 동일). */
  const ogMetaInitial = (invitation.og_meta && typeof invitation.og_meta === "object")
    ? invitation.og_meta as Record<string, unknown>
    : {}
  const [ogTitle, setOgTitle] = useState(String(ogMetaInitial.title ?? ""))
  const [ogDescription, setOgDescription] = useState(String(ogMetaInitial.description ?? ""))
  const [ogImage, setOgImage] = useState(String(ogMetaInitial.image ?? ""))
  const [uploadingOgImage, setUploadingOgImage] = useState(false)

  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!showBgm) return
    supabase.from("bgms").select("id,name,url").then(({ data }) => { if (data) setBgms(data) })
  }, [showBgm])

  useEffect(() => {
    fetchRegisteredFonts().then(setFonts)
  }, [])
  // 폰트 선택 드롭다운에서 이름만으로는 어떤 폰트인지 알기 어려우므로 그 폰트로 직접 렌더해 보여준다
  useInjectFontFaces(fonts)

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
    phone_expose: phoneExpose ? "예" : "아니오",
    groom_show_phone: groomShowPhone ? "예" : "아니오",
    bride_show_phone: brideShowPhone ? "예" : "아니오",
    bgm_url: bgmUrl,
  }), [initialRaw, content, weddingDate, weddingTime, galleryImages, galleryViewType, galleryAlign, sequenceRows, showProgram, phoneExpose, groomShowPhone, brideShowPhone, bgmUrl])

  const data = useMemo(() => buildFieldData(liveRaw), [liveRaw])

  const tokens: TokenMap = useMemo(() => {
    const t: TokenMap = { ...themeTokens }
    for (const [k, v] of Object.entries(overrides)) {
      if (typeof v === "number") t[k] = `${v}px`
      else if (v) t[k] = v
    }
    return t
  }, [themeTokens, overrides])

  const fontFaces = useMemo(() => resolveFontFaces(tokens, fonts), [tokens, fonts])

  const accent = tokens["--accent"] || "#D76C6C"
  const activeSlots = useMemo(() => slots.filter((s) => !disabledSlots.includes(s)), [slots, disabledSlots])
  const previewSlots = useMemo(
    () => buildSlots(activeSlots, { accent, data, raw: liveRaw, invitationId, blockOverrides }),
    [activeSlots, accent, data, liveRaw, invitationId, blockOverrides]
  )
  const hiddenBlocks = useMemo(() => getHiddenBlocks(disabledSlots), [disabledSlots])

  /** 테마 CSS가 실제로 참조하는 사이즈 토큰만 슬라이더로 노출한다 — 아무 효과 없는 컨트롤은 버그로 인식된다 */
  const visibleSizeTokens = useMemo(() => {
    const css = activeThemeRow.template_css || ""
    return SIZE_TOKEN_FIELDS.filter((t) => typeof css === "string" && css.includes(`var(${t.name}`))
  }, [activeThemeRow])
  /** 색 토큰은 사이즈 토큰과 동일한 규칙으로 걸러낸다 — 테마 CSS가 참조하지 않는 토큰의
   * 피커를 보여주면 바꿔도 아무 효과가 없다. 폰트 토큰(--font-kr/--font-en)은 예외다 —
   * InvitationFrame의 기본 리셋 스타일시트(테마 template_css가 아님)가 body 기본 폰트로
   * --font-kr을 항상 참조하므로, 테마 CSS 안에 이 토큰이 없어도 항상 실제 효과가 있다. */
  const visibleTokenFields = useMemo(() => {
    const css = activeThemeRow.template_css || ""
    return TOKEN_FIELDS.filter(
      (t) => t.type === "font" || (typeof css === "string" && css.includes(`var(${t.name}`))
    )
  }, [activeThemeRow])
  const typographySizeTokens = useMemo(() => visibleSizeTokens.filter((t) => t.group === "typography"), [visibleSizeTokens])
  const layoutSizeTokens = useMemo(() => visibleSizeTokens.filter((t) => t.group === "layout"), [visibleSizeTokens])
  const sizeTokenDefaults = useMemo(() => {
    const css = activeThemeRow.template_css
    const out: Record<string, number> = {}
    if (typeof css === "string") {
      for (const t of SIZE_TOKEN_FIELDS) {
        const d = extractTokenDefault(css, t.name)
        if (d != null) out[t.name] = d
      }
    }
    return out
  }, [activeThemeRow])

  /** 이 테마가 지원하는 블럭 중 실제로 편집 가능한(제목/여백 편집 or 표시-끄기 토글) 것만 아코디언에 노출 */
  const blockManifest = useMemo(() => getBlockManifest(activeThemeRow), [activeThemeRow])
  const editableBlocks = useMemo(
    () => blockManifest.filter((b) => (b.title || b.padding || slots.includes(b.key)) && (BLOCK_KEYS as readonly string[]).includes(b.key)),
    [blockManifest, slots]
  )
  /** 블럭 여백 슬라이더가 아직 오버라이드되지 않았을 때 보여줄 시작 위치 — 전역 --section-py 오버라이드가 있으면 그 값을, 없으면 테마 통상값(64)을 기준으로 삼는다 */
  const globalSectionPy = typeof overrides["--section-py"] === "number" ? (overrides["--section-py"] as number) : 64
  /** 'bgm'/'map'처럼 블럭에 속하지 않는 슬롯(독립 위젯이거나 다른 블럭에 얹혀 있음)은 아코디언이 아니라
   * 단순 켜기/끄기 스위치로 노출한다 — block_manifest 에 없다고 토글 자체를 잃으면 안 된다 */
  const standaloneToggleSlots = useMemo(
    () => slots.filter((s) => !blockManifest.some((b) => b.key === s)),
    [slots, blockManifest]
  )

  const uploadImageField = async (key: string, file: File) => {
    setUploadingKey(key)
    try {
      const url = await uploadImage(file, "invitations/content")
      setField(key, url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.")
    } finally {
      setUploadingKey(null)
    }
  }

  const uploadOgImage = async (file: File) => {
    setUploadingOgImage(true)
    try {
      const url = await uploadImage(file, "invitations/kakao-share")
      setOgImage(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.")
    } finally {
      setUploadingOgImage(false)
    }
  }

  const addGalleryImages = async (files: FileList) => {
    setUploadingKey("gallery_images")
    try {
      const urls = await Promise.all(Array.from(files).map((f) => uploadImage(f, "invitations/gallery")))
      setGalleryImages((cur) => [...cur, ...urls])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "갤러리 이미지 업로드에 실패했습니다.")
    } finally {
      setUploadingKey(null)
    }
  }

  const moveGalleryImage = (index: number, direction: -1 | 1) =>
    setGalleryImages((cur) => moveArrayItem(cur, index, direction))

  const save = async () => {
    setSaving(true)

    const cleanTokens: Record<string, string | number> = {}
    for (const [k, v] of Object.entries(overrides)) {
      if (typeof v === "number") cleanTokens[k] = v
      else if (v) cleanTokens[k] = v
    }
    const existingOverrides = (invitation.customization_overrides && typeof invitation.customization_overrides === "object")
      ? invitation.customization_overrides as Record<string, unknown>
      : {}
    const preservedOverrideKeys: Record<string, unknown> = {}
    // "blocks" 를 여기서 빠뜨리면 매번 옛 값이 되살아난다 — disabled_slots 때 겪은 실수의 반복,
    // PLAN_DESIGN_CONTROLS.md §5.3
    for (const [k, v] of Object.entries(existingOverrides)) if (!k.startsWith("--") && k !== "disabled_slots" && k !== "blocks" && k !== "sectionImages") preservedOverrideKeys[k] = v

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
      phone_expose: phoneExpose ? "예" : "아니오",
      groom_show_phone: groomShowPhone ? "예" : "아니오",
      bride_show_phone: brideShowPhone ? "예" : "아니오",
    }

    const existingOgMeta = (invitation.og_meta && typeof invitation.og_meta === "object")
      ? invitation.og_meta as Record<string, unknown>
      : {}

    const { error } = await supabase
      .from("invitations")
      .update({
        content_data: contentPayload,
        customization_overrides: { ...preservedOverrideKeys, ...cleanTokens, disabled_slots: disabledSlots, blocks: blockOverrides, sectionImages },
        bgm_url: bgmUrl || null,
        theme_version_id: themeVersionId,
        og_meta: { ...existingOgMeta, title: ogTitle || null, description: ogDescription || null, image: ogImage || null },
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

  const copyInvitationLink = async () => {
    if (!publicSlug) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/w/${publicSlug}`)
      toast.success("청첩장 주소가 클립보드에 복사되었습니다.")
    } catch {
      toast.error("링크 복사에 실패했습니다.")
    }
  }

  const copyDashboardLink = async () => {
    if (!publicSlug) return
    const password = String(invitation.dashboard_password ?? "")
    // 대시보드는 /dashboard/[slug] 가 public_slug 로 조회한다(dashboard_slug 컬럼은 쓰지 않음).
    const text = password
      ? `${window.location.origin}/dashboard/${publicSlug}\n비밀번호: ${password}`
      : `${window.location.origin}/dashboard/${publicSlug}`
    try {
      await navigator.clipboard.writeText(text)
      toast.success("고객용 대시보드 링크가 클립보드에 복사되었습니다.")
    } catch {
      toast.error("링크 복사에 실패했습니다.")
    }
  }

  const [reviewStatus, setReviewStatus] = useState<string>(String(invitation.review_status ?? "none"))
  const [reviewRound, setReviewRound] = useState<number>(Number(invitation.review_round ?? 0))
  const [sendingReview, setSendingReview] = useState(false)
  const revisionsQuery = useInvitationRevisionsQuery(invitationId)
  const resolveRevision = useResolveRevisionMutation(invitationId)

  // "검수 요청 보내기" — 알림톡 자동발송은 아직 없어서(§FEATURE_ROADMAP.md §9, 별도 비용 발생)
  // 이번 라운드에는 링크+비밀번호를 클립보드에 복사해 관리자가 직접 전달하는 방식으로 시작한다.
  const sendReviewRequest = async () => {
    if (!publicSlug) return
    setSendingReview(true)
    try {
      const nextRound = reviewRound + 1
      const { error } = await supabase
        .from("invitations")
        .update({ review_status: "in_review", review_round: nextRound })
        .eq("id", invitationId)
      if (error) throw error
      setReviewStatus("in_review")
      setReviewRound(nextRound)

      const password = String(invitation.dashboard_password ?? "")
      const text = password
        ? `${window.location.origin}/review/${publicSlug}\n비밀번호: ${password}`
        : `${window.location.origin}/review/${publicSlug}`
      await navigator.clipboard.writeText(text)
      toast.success("검수 링크가 클립보드에 복사되었습니다. 고객에게 전달해주세요.")
    } catch {
      toast.error("검수 요청 처리에 실패했습니다.")
    } finally {
      setSendingReview(false)
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
    // 이 2단 고정 레이아웃은 미리보기 420px를 뺀 나머지가 편집 폭이 되므로 좁은 화면(노트북/태블릿)에서
    // 찌그러진다 — xl(1280px) 미만에서는 1단으로 쌓고(미리보기를 위로), 위에서만 2단 고정을 적용한다.
    <div className="grid gap-6 font-sans xl:h-[calc(100vh-100px)] xl:grid-cols-[minmax(0,1fr)_420px]">
      {/* 편집 */}
      <div className="order-2 min-w-0 pb-24 xl:order-1 xl:h-full xl:max-w-3xl xl:overflow-y-auto xl:pb-0 xl:pr-1">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">청첩장 커스터마이즈</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {groom && bride ? `${groom} ♥ ${bride}` : "청첩장"}
          </p>
        </div>

        <Tabs defaultValue="content" className="gap-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content">내용</TabsTrigger>
            <TabsTrigger value="design">디자인</TabsTrigger>
            <TabsTrigger value="review" className="gap-1.5">
              검수
              {revisionsQuery.data && revisionsQuery.data.filter((r) => r.status === "open").length > 0 && (
                <span className="rounded-full bg-destructive px-1.5 text-[10px] font-medium text-destructive-foreground">
                  {revisionsQuery.data.filter((r) => r.status === "open").length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6">
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
                  {visibleContentFields.filter((f) => ["traffic_info", "parking_info", "shuttle_info"].includes(f.key)).map((f) => (
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
                    .filter((f) => !["venue_name", "venue_hall", "venue_address", "traffic_info", "parking_info", "shuttle_info", "greeting_message", "main_image", "groom_photo", "bride_photo", "greeting_image", ...CONTACT_FIELD_DEFS.map((c) => c.key)].includes(f.key))
                    .map((f) => {
                      const deceasedKey = DECEASED_KEY_BY_NAME_FIELD[f.key]
                      return (
                        <div key={f.key} className="space-y-1.5">
                          <TextField def={f} value={content[f.key] || ""} onChange={(v) => setField(f.key, v)} />
                          {deceasedKey && (
                            <label className="flex items-center gap-1.5 pl-0.5 text-xs text-muted-foreground cursor-pointer">
                              <Checkbox
                                checked={content[deceasedKey] === "예"}
                                onCheckedChange={(checked) => setField(deceasedKey, checked ? "예" : "아니오")}
                              />
                              故 (고인)
                            </label>
                          )}
                        </div>
                      )
                    })}
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
                          <div key={url} className="group relative aspect-square overflow-hidden rounded-md border">
                            <img src={url} alt="" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setGalleryImages((cur) => cur.filter((_, idx) => idx !== i))}
                              title="삭제"
                              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/50 px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => moveGalleryImage(i, -1)}
                                disabled={i === 0}
                                title="앞으로 이동"
                                aria-label="앞으로 이동"
                                className="flex h-5 w-5 items-center justify-center rounded text-white hover:bg-white/20 disabled:opacity-30"
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </button>
                              <span className="text-[10px] text-white/80">{i + 1}</span>
                              <button
                                type="button"
                                onClick={() => moveGalleryImage(i, 1)}
                                disabled={i === galleryImages.length - 1}
                                title="뒤로 이동"
                                aria-label="뒤로 이동"
                                className="flex h-5 w-5 items-center justify-center rounded text-white hover:bg-white/20 disabled:opacity-30"
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
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
                  <CardDescription>혼주 계좌는 아버지·어머니 계좌를 함께 적는 등 형식이 자유로워 텍스트로 직접 입력합니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <FieldGroup className="space-y-4">
                      <p className="text-sm font-medium text-muted-foreground">신랑측</p>
                      {ACCOUNT_FIELD_DEFS.slice(0, 3).map((f) => (
                        <TextField key={f.key} def={f} value={content[f.key] || ""} onChange={(v) => setField(f.key, v)} />
                      ))}
                      <TextField
                        def={ACCOUNT_FIELD_DEFS.find((f) => f.key === "extra_account_groom")!}
                        value={content.extra_account_groom || ""}
                        onChange={(v) => setField("extra_account_groom", v)}
                      />
                    </FieldGroup>
                    <FieldGroup className="space-y-4">
                      <p className="text-sm font-medium text-muted-foreground">신부측</p>
                      {ACCOUNT_FIELD_DEFS.slice(3, 6).map((f) => (
                        <TextField key={f.key} def={f} value={content[f.key] || ""} onChange={(v) => setField(f.key, v)} />
                      ))}
                      <TextField
                        def={ACCOUNT_FIELD_DEFS.find((f) => f.key === "extra_account_bride")!}
                        value={content.extra_account_bride || ""}
                        onChange={(v) => setField("extra_account_bride", v)}
                      />
                    </FieldGroup>
                  </div>
                </CardContent>
              </Card>
            )}

            {showContact && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">연락처</CardTitle>
                  <CardDescription>신랑·신부 및 혼주 연락처를 청첩장에 노출합니다. 비워둔 항목은 표시되지 않습니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Switch id="phoneExpose" checked={phoneExpose} onCheckedChange={setPhoneExpose} />
                      <Label htmlFor="phoneExpose" className="font-normal cursor-pointer">연락처 표시</Label>
                    </div>
                    {phoneExpose && (
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <FieldGroup className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-muted-foreground">신랑측</p>
                            <div className="flex items-center gap-2">
                              <Label htmlFor="groomShowPhone" className="text-xs font-normal text-muted-foreground cursor-pointer">신랑 연락처 노출</Label>
                              <Switch id="groomShowPhone" checked={groomShowPhone} onCheckedChange={setGroomShowPhone} />
                            </div>
                          </div>
                          {CONTACT_FIELD_DEFS.slice(0, 3).map((f) => (
                            <TextField key={f.key} def={f} value={content[f.key] || ""} onChange={(v) => setField(f.key, v)} />
                          ))}
                          <TextField
                            def={CONTENT_FIELD_DEFS.find((f) => f.key === "groom_sns_instagram")!}
                            value={content.groom_sns_instagram || ""}
                            onChange={(v) => setField("groom_sns_instagram", v)}
                          />
                        </FieldGroup>
                        <FieldGroup className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-muted-foreground">신부측</p>
                            <div className="flex items-center gap-2">
                              <Label htmlFor="brideShowPhone" className="text-xs font-normal text-muted-foreground cursor-pointer">신부 연락처 노출</Label>
                              <Switch id="brideShowPhone" checked={brideShowPhone} onCheckedChange={setBrideShowPhone} />
                            </div>
                          </div>
                          {CONTACT_FIELD_DEFS.slice(3, 6).map((f) => (
                            <TextField key={f.key} def={f} value={content[f.key] || ""} onChange={(v) => setField(f.key, v)} />
                          ))}
                          <TextField
                            def={CONTENT_FIELD_DEFS.find((f) => f.key === "bride_sns_instagram")!}
                            value={content.bride_sns_instagram || ""}
                            onChange={(v) => setField("bride_sns_instagram", v)}
                          />
                        </FieldGroup>
                      </div>
                    )}
                  </FieldGroup>
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
                <CardTitle className="text-base font-medium">카카오톡 공유</CardTitle>
                <CardDescription>
                  청첩장 링크를 카카오톡 등에 공유할 때 보여줄 썸네일·제목·설명입니다. 비워두면 신랑·신부 이름과 예식 정보로 자동 채워집니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="space-y-4">
                  <ImageField
                    def={{ key: "og_image", label: "썸네일 이미지", type: "image" }}
                    value={ogImage}
                    uploading={uploadingOgImage}
                    onUpload={uploadOgImage}
                    onClear={() => setOgImage("")}
                  />
                  <Field>
                    <FieldLabel htmlFor="ogTitle">제목</FieldLabel>
                    <Input
                      id="ogTitle"
                      value={ogTitle}
                      onChange={(e) => setOgTitle(e.target.value)}
                      placeholder={groom && bride ? `${groom} ♥ ${bride} 결혼합니다` : "철수 ♥ 영희 결혼합니다"}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ogDescription">설명</FieldLabel>
                    <Input
                      id="ogDescription"
                      value={ogDescription}
                      onChange={(e) => setOgDescription(e.target.value)}
                      placeholder="2026년 5월 7일 낮 12시"
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="design" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">테마</CardTitle>
                <CardDescription>
                  테마를 바꾸면 이 청첩장의 색·폰트·크기·블럭 오버라이드는 초기화됩니다. 저장을 눌러야 최종 반영됩니다.
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
                <CardTitle className="text-base font-medium">색상</CardTitle>
                <CardDescription>비워두면 테마 기본값이 사용됩니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {visibleTokenFields.filter((t) => t.type === "color").map((t) => {
                    const hasOverride = typeof overrides[t.name] === "string"
                    const overrideValue = hasOverride ? (overrides[t.name] as string) : ""
                    const themeDefault = themeTokens[t.name] || ""
                    // 오버라이드가 없으면(=테마 기본값을 그대로 쓰는 중) 입력칸을 비워두지 않고
                    // 현재 실제로 적용 중인 테마 기본 색을 그대로 채워 보여준다 — 빈 칸은 "색이
                    // 없다"처럼 보이지만 실제로는 테마 기본색이 적용되어 있는 상태였다.
                    const displayValue = overrideValue || themeDefault
                    return (
                      <Field key={t.name}>
                        <FieldLabel>{t.label}</FieldLabel>
                        <div className="flex items-start gap-2">
                          <input
                            type="color"
                            value={/^#[0-9a-fA-F]{6}$/.test(displayValue) ? displayValue : "#ffffff"}
                            onChange={(e) => setOverride(t.name, e.target.value)}
                            className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
                          />
                          <Input value={displayValue} onChange={(e) => setOverride(t.name, e.target.value)} placeholder="테마 기본값" className="min-w-0 flex-1" />
                          {overrideValue && (
                            <Button type="button" variant="ghost" size="icon-sm" title="테마 기본값으로" onClick={() => clearOverride(t.name)}>
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">타이포그래피</CardTitle>
                <CardDescription>비워두면 테마 기본값이 사용됩니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {visibleTokenFields.filter((t) => t.type === "font").map((t) => {
                    const value = typeof overrides[t.name] === "string" ? (overrides[t.name] as string) : ""
                    const placeholder = themeTokens[t.name] || "테마 기본값"
                    const matchedFontStack = fonts.map((f) => buildFontStack(f, t.name)).find((stack) => stack === value)
                    return (
                      <Field key={t.name}>
                        <FieldLabel>{t.label}</FieldLabel>
                        <div className="flex items-start gap-2">
                          <div className="flex min-w-0 flex-1 flex-col gap-2">
                            {fonts.length > 0 && (
                              <Select
                                value={matchedFontStack || ""}
                                onValueChange={(v) => { if (v) setOverride(t.name, v) }}
                              >
                                <SelectTrigger className="w-full" style={matchedFontStack ? { fontFamily: matchedFontStack } : undefined}>
                                  <SelectValue placeholder="에셋에 등록된 폰트 선택…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {fonts.map((f) => (
                                    <SelectItem key={f.id} value={buildFontStack(f, t.name)} style={fontPreviewStyle(f)}>{f.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <Input value={value} onChange={(e) => setOverride(t.name, e.target.value)} placeholder={placeholder} />
                          </div>
                          {value && (
                            <Button type="button" variant="ghost" size="icon-sm" title="테마 기본값으로" onClick={() => clearOverride(t.name)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </Field>
                    )
                  })}
                </div>

                {typographySizeTokens.length > 0 && (
                  <div className="grid grid-cols-1 gap-5 border-t pt-5 sm:grid-cols-2">
                    {typographySizeTokens.map((t) => (
                      <SizeSliderField
                        key={t.name}
                        label={t.label}
                        value={typeof overrides[t.name] === "number" ? (overrides[t.name] as number) : undefined}
                        defaultValue={sizeTokenDefaults[t.name] ?? t.min}
                        min={t.min}
                        max={t.max}
                        onChange={(v) => setOverride(t.name, v)}
                        onReset={() => clearOverride(t.name)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {layoutSizeTokens.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">여백</CardTitle>
                  <CardDescription>
                    청첩장 전체에 적용되는 기본 여백입니다. 특정 섹션만 다르게 하려면 아래 블럭에서 설정하세요.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {layoutSizeTokens.map((t) => (
                      <SizeSliderField
                        key={t.name}
                        label={t.label}
                        value={typeof overrides[t.name] === "number" ? (overrides[t.name] as number) : undefined}
                        defaultValue={sizeTokenDefaults[t.name] ?? t.min}
                        min={t.min}
                        max={t.max}
                        onChange={(v) => setOverride(t.name, v)}
                        onReset={() => clearOverride(t.name)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {(editableBlocks.length > 0 || standaloneToggleSlots.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">블럭</CardTitle>
                  <CardDescription>
                    펼쳐서 제목·여백을 바꾸거나, 이 청첩장에서만 이 블럭을 꺼보세요. 끈 블럭은 발행된 청첩장에서 완전히 사라집니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion
                    type="single"
                    collapsible
                    value={focusBlock ?? ""}
                    onValueChange={(v) => setFocusBlock(v || null)}
                  >
                    {editableBlocks.map((b) => {
                      const hasToggle = slots.includes(b.key)
                      const hasExpandable = b.title || b.padding
                      const isOn = !disabledSlots.includes(b.key)
                      const override = blockOverrides[b.key]

                      if (!hasExpandable) {
                        return (
                          <div key={b.key} className="flex items-center justify-between border-b py-4 last:border-b-0">
                            <span className={cn("text-sm font-medium", !isOn && "text-muted-foreground")}>{b.label}</span>
                            {hasToggle && <Switch checked={isOn} onCheckedChange={(c) => toggleSlot(b.key, c)} />}
                          </div>
                        )
                      }

                      return (
                        <AccordionItem key={b.key} value={b.key}>
                          <div className="flex items-center gap-2">
                            <AccordionTrigger className="flex-1">
                              <span className={cn(!isOn && "text-muted-foreground")}>{b.label}</span>
                            </AccordionTrigger>
                            {hasToggle && (
                              <Switch
                                checked={isOn}
                                onCheckedChange={(c) => toggleSlot(b.key, c)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                          </div>
                          <AccordionContent className="space-y-4">
                            {b.title && (
                              <>
                                <Field>
                                  <FieldLabel>제목</FieldLabel>
                                  <Input
                                    value={override?.title ?? ""}
                                    onChange={(e) => setBlockOverride(b.key, { title: e.target.value })}
                                    placeholder="테마 기본값"
                                  />
                                </Field>
                                <Field>
                                  <FieldLabel>영문 소제목</FieldLabel>
                                  <Input
                                    value={override?.label ?? ""}
                                    onChange={(e) => setBlockOverride(b.key, { label: e.target.value })}
                                    placeholder="테마 기본값"
                                  />
                                </Field>
                              </>
                            )}
                            {b.padding && (
                              <SizeSliderField
                                label="위·아래 여백"
                                value={override?.py}
                                defaultValue={globalSectionPy}
                                min={16}
                                max={120}
                                onChange={(v) => setBlockOverride(b.key, { py: v })}
                                onReset={() => setBlockOverride(b.key, { py: undefined })}
                              />
                            )}
                            {b.key === "rsvp" && (
                              <>
                                <div className="flex items-center justify-between border-t pt-4">
                                  <span className="text-sm">식사 여부 질문</span>
                                  <Switch
                                    checked={override?.mealEnabled !== false}
                                    onCheckedChange={(c) => setBlockOverride(b.key, { mealEnabled: c })}
                                  />
                                </div>
                                {override?.mealEnabled !== false && (
                                  <TextField
                                    def={ALL_TEXT_FIELD_DEFS.find((f) => f.key === "rsvp_meal_menu")!}
                                    value={content.rsvp_meal_menu || ""}
                                    onChange={(v) => setField("rsvp_meal_menu", v)}
                                  />
                                )}
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">셔틀버스 이용 질문</span>
                                  <Switch
                                    checked={override?.shuttleEnabled !== false}
                                    onCheckedChange={(c) => setBlockOverride(b.key, { shuttleEnabled: c })}
                                  />
                                </div>
                                <Field>
                                  <FieldLabel>응답 마감일</FieldLabel>
                                  <Input
                                    type="date"
                                    value={override?.rsvpDeadline ?? ""}
                                    onChange={(e) => setBlockOverride(b.key, { rsvpDeadline: e.target.value || undefined })}
                                  />
                                  <FieldDescription>비워두면 마감 없이 상시 접수됩니다.</FieldDescription>
                                </Field>
                              </>
                            )}
                            {b.key === "calendar" && (
                              <div className="flex items-center justify-between border-t pt-4">
                                <span className="text-sm">D-day 카운트다운 표시</span>
                                <Switch
                                  checked={override?.ddayEnabled !== false}
                                  onCheckedChange={(c) => setBlockOverride(b.key, { ddayEnabled: c })}
                                />
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      )
                    })}
                  </Accordion>

                  {standaloneToggleSlots.length > 0 && (
                    <div className={cn("space-y-1", editableBlocks.length > 0 && "mt-2 border-t pt-3")}>
                      {standaloneToggleSlots.map((s) => {
                        const isOn = !disabledSlots.includes(s)
                        return (
                          <div key={s} className="flex items-center justify-between py-2">
                            <span className={cn("text-sm", !isOn && "text-muted-foreground")}>{SLOT_LABELS[s] || s}</span>
                            <Switch checked={isOn} onCheckedChange={(c) => toggleSlot(s, c)} />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">섹션 사이 사진</CardTitle>
                <CardDescription>
                  원하는 섹션 바로 아래에 사진을 끼워 넣습니다. 위치는 드롭다운으로, 순서는 위/아래 버튼으로
                  바로 바꿀 수 있어 다시 업로드할 필요가 없습니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sectionImages.map((img, i) => (
                  <div key={img.id} className="flex gap-3 rounded-lg border p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <FieldLabel className="w-10 shrink-0 text-xs font-normal text-muted-foreground">위치</FieldLabel>
                        <Select value={img.afterBlock} onValueChange={(v) => updateSectionImage(img.id, { afterBlock: v })}>
                          <SelectTrigger className="h-8 flex-1">
                            <SelectValue placeholder="섹션 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {blockManifest.map((b) => (
                              <SelectItem key={b.key} value={b.key}>{b.label} 다음</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        value={img.caption ?? ""}
                        onChange={(e) => updateSectionImage(img.id, { caption: e.target.value })}
                        placeholder="캡션 (선택)"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex shrink-0 flex-col items-center justify-between">
                      <div className="flex flex-col">
                        <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => moveSectionImage(img.id, -1)}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" disabled={i === sectionImages.length - 1} onClick={() => moveSectionImage(img.id, 1)}>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => removeSectionImage(img.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}

                <div>
                  <Button variant="outline" size="sm" className="relative overflow-hidden" disabled={isUploadingSectionImage}>
                    {isUploadingSectionImage ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 업로드 중...</>
                    ) : (
                      <><Plus className="mr-2 h-4 w-4" /> 사진 추가</>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 cursor-pointer opacity-0"
                      disabled={isUploadingSectionImage}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) addSectionImage(file)
                        e.target.value = ""
                      }}
                    />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="review" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">시안 검수 현황</CardTitle>
                <CardDescription>
                  {REVIEW_STATUS_LABEL[reviewStatus] ?? reviewStatus}
                  {reviewRound > 0 && ` · ${reviewRound}차 검수`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {revisionsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">불러오는 중…</p>
                ) : !revisionsQuery.data || revisionsQuery.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    아직 고객이 남긴 수정 요청이 없습니다. 왼쪽 하단 &ldquo;검수 요청 보내기&rdquo;로 검수 링크를 전달해보세요.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {[...revisionsQuery.data]
                      .sort((a, b) => (a.status === b.status ? 0 : a.status === "open" ? -1 : 1))
                      .map((r) => {
                        const label = (r.block_key && (blockManifest.find((b) => b.key === r.block_key)?.label ?? BLOCK_LABEL_FALLBACK[r.block_key as keyof typeof BLOCK_LABEL_FALLBACK])) || r.block_key || "전체"
                        return (
                          <div
                            key={r.id}
                            className={cn(
                              "rounded-lg border p-3 text-sm",
                              r.status === "resolved" ? "bg-muted/40 opacity-70" : "bg-background"
                            )}
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                className="text-xs font-semibold text-primary hover:underline"
                                onClick={() => r.block_key && setFocusBlock(r.block_key)}
                              >
                                {label}
                              </button>
                              {r.status === "open" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 gap-1 px-2 text-[11px]"
                                  disabled={resolveRevision.isPending}
                                  onClick={() => resolveRevision.mutate(r.id)}
                                >
                                  처리 완료
                                </Button>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">처리 완료됨</span>
                              )}
                            </div>
                            <p className="whitespace-pre-wrap text-foreground">{r.note}</p>
                          </div>
                        )
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* xl 미만(1단 레이아웃)에서는 실제 스크롤이 main이 아니라 html에서 일어나(admin 레이아웃의
            고질적인 문제) sticky가 기준을 잃으므로 fixed로 뷰포트 하단에 고정하고(사이드바 폭만큼
            lg:left-64 로 비켜준다), xl 이상에서는 원래의(검증된) 컬럼 내부 sticky로 되돌린다. */}
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t bg-background px-4 py-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] lg:left-64 lg:px-6 xl:sticky xl:inset-x-auto xl:left-auto xl:z-auto xl:mt-6 xl:px-0 xl:shadow-none">
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
          {publicSlug && (
            <Button variant="outline" className="gap-2" onClick={copyInvitationLink}>
              <Copy className="h-3.5 w-3.5" /> 청첩장 주소 복사하기
            </Button>
          )}
          {publicSlug && (
            <Button variant="outline" className="gap-2" onClick={copyDashboardLink}>
              <Copy className="h-3.5 w-3.5" /> 고객용 대시보드 복사하기
            </Button>
          )}
          {publicSlug && (
            <Button variant="outline" className="gap-2" onClick={sendReviewRequest} disabled={sendingReview}>
              {sendingReview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
              검수 요청 보내기
            </Button>
          )}
        </div>
      </div>

      {/* 미리보기 — xl 이상에서는 이 컬럼 자체가 스크롤되지 않아(왼쪽만 overflow-y-auto) 항상 화면에 고정되고,
          그 아래 좁은 화면에서는 편집 영역 위에 쌓여 보인다(order-1) */}
      <div className="order-1 xl:order-2 xl:h-full xl:overflow-hidden">
        <div className="mb-2.5 text-xs text-muted-foreground">실시간 미리보기 (실제 데이터)</div>
        {/* 좁은 화면(패널 폭이 380px 미만인 태블릿·모바일)에서는 가로 스크롤 대신 비율을 유지한 채 축소한다 */}
        <div className="rounded-2xl bg-muted/40 py-5 px-3">
          <ScaledPreview width={380} height={680}>
            <InvitationFrame
              template={template}
              data={data}
              tokens={tokens}
              slots={previewSlots}
              fontFaces={fontFaces}
              blockOverrides={blockOverrides}
              hiddenBlocks={hiddenBlocks}
              sectionImages={sectionImages}
              focusBlock={focusBlock}
              width={380}
              height={680}
            />
          </ScaledPreview>
        </div>
      </div>
    </div>
  )
}

/** 사이즈 토큰 슬라이더 — 색 토큰 UI와 동일한 "미설정=테마 기본값, 값 있으면 되돌리기 버튼" 규칙을 따른다 */
function SizeSliderField({ label, value, defaultValue, min, max, onChange, onReset }: {
  label: string
  value: number | undefined
  defaultValue: number
  min: number
  max: number
  onChange: (v: number) => void
  onReset: () => void
}) {
  const isSet = value != null
  const current = value ?? defaultValue
  return (
    <Field>
      <div className="flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <span className={cn("text-xs tabular-nums", isSet ? "text-foreground" : "text-muted-foreground")}>
          {current}px{!isSet && " · 기본값"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Slider value={[current]} min={min} max={max} step={1} onValueChange={([v]) => onChange(v)} className="flex-1" />
        {isSet && (
          <Button type="button" variant="ghost" size="icon-sm" title="테마 기본값으로" onClick={onReset}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </Field>
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
