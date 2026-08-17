"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { uploadImage } from "@/lib/image-upload"
import { InvitationFrame, type TokenMap } from "@/components/invitation/invitation-frame"
import { ScaledPreview } from "@/components/ui/scaled-preview"
import { buildSlots } from "@/components/invitation/slot-registry"
import { buildFieldData, mergeInvitationRaw, normalizeSequence, isToggledOff, isToggledOn, type SequenceEvent } from "@/lib/invitation-data"
import { useUnsavedChangesWarning } from "@/lib/use-unsaved-changes-warning"
import {
  REVIEW_STATUS_LABEL,
  CONTENT_FIELD_DEFS,
  ACCOUNT_FIELD_DEFS,
  DECEASED_KEY_BY_NAME_FIELD,
  DECEASED_KEYS,
  CONTACT_FIELD_DEFS,
  SLOT_LABELS,
  ALL_TEXT_FIELD_DEFS,
  MANAGED_CONTENT_KEYS,
  moveArrayItem,
  extractTokenDefault,
  type FieldDef,
} from "./field-defs"
import { SortableBlockRow, DragHandle, SizeSliderField, BlockColorField, TextField, ImageField, GalleryUploadButton } from "./fields"
import {
  BLOCK_KEYS,
  BLOCK_LABEL_FALLBACK,
  buildThemeTokens,
  extractBlockOrder,
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
import { extractScrollMotion, type ScrollMotionSettings } from "@/lib/scroll-motion"
import { extractIntroSettings, DEFAULT_INTRO_SETTINGS, INTRO_MODES, INTRO_ALIGNS, INTRO_FONT_SIZE_MIN, INTRO_FONT_SIZE_MAX, type IntroSettings } from "@/lib/intro-settings"
import { ScrollMotionField } from "@/components/invitation/scroll-motion-field"
import { buildFontStack, fetchRegisteredFonts, fontPreviewStyle, resolveFontFaces, type RegisteredFont } from "@/lib/fonts"
import { useInjectFontFaces } from "@/lib/use-font-faces"
import { useInvitationRevisionsQuery, useResolveRevisionMutation } from "@/hooks/queries/useInvitationRevisions"
import { useAuditLogsQuery } from "@/hooks/queries/useAuditLogs"
import { logAuditEvent } from "@/lib/audit-log"
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
import { SaveButton } from "@/components/ui/save-button"
import { QrCodeDialog } from "@/components/admin/qr-code-dialog"
import { ExtraAccountEditor } from "@/components/account-fields"
import { isAccountFilled, parseAccountList, type AccountEntry } from "@/lib/account-fields"
import { ContactListField } from "@/components/contact-fields"
import { isContactFilled, parseContactList, type ContactEntry } from "@/lib/contact-fields"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Slider } from "@/components/ui/slider"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Copy, ExternalLink, Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable"

/**
 * 템플릿 청첩장 커스터마이즈 편집기.
 * 실제 청첩장 데이터로 미리보기하고, 색/폰트 오버라이드뿐 아니라
 * 필드키에 연결된 텍스트/이미지, 갤러리, 식순, 계좌, 배경음악 등
 * 발행되는 청첩장에 들어가는 모든 콘텐츠를 이 화면에서 직접 관리한다.
 * 발행 경로와 동일한 mergeInvitationRaw / buildFieldData / InvitationFrame 을 쓰므로
 * "여기서 보이는 것 = 발행 결과" 가 보장된다.
 */

// FieldType/FieldDef 및 필드 정의·라벨 상수, moveArrayItem/extractTokenDefault 헬퍼는
// ./field-defs.ts 로 이동했다(아래 import). 로직 변경 없음.

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
  // 마지막으로 이 화면이 읽은 updated_at — save()가 그 사이 다른 관리자가 먼저
  // 저장했는지 판별하는 기준선. 저장 성공 시마다 갱신한다(§save 함수 하단).
  const lastKnownUpdatedAtRef = useRef<string | null>(
    typeof invitation.updated_at === "string" ? invitation.updated_at : null
  )
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

  /** 스크롤 모션 — 고객 셀프편집 화면(edit-client.tsx)에서도 동일 값을 바꿀 수 있다 */
  const [scrollMotion, setScrollMotion] = useState<ScrollMotionSettings>(
    () => extractScrollMotion(invitation.customization_overrides)
  )
  /** 오프닝 인트로 — 진입 시 잠깐 보여줄 내용(이름/문구/이미지)과 서체·크기·정렬. 기본 꺼짐 */
  const [intro, setIntro] = useState<IntroSettings>(
    () => extractIntroSettings(invitation.customization_overrides)
  )
  const setIntroField = <K extends keyof IntroSettings>(key: K, value: IntroSettings[K]) =>
    setIntro((cur) => ({ ...cur, [key]: value }))
  const [uploadingIntroImage, setUploadingIntroImage] = useState(false)
  const uploadIntroImage = async (file: File) => {
    setUploadingIntroImage(true)
    try {
      setIntroField("imageUrl", await uploadImage(file, "invitations/intro"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.")
    } finally {
      setUploadingIntroImage(false)
    }
  }
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

  // 혼주 계좌는 값이 배열이라 문자열 맵인 content 에 담기지 않는다 — 갤러리 이미지처럼
  // 별도 state 로 들고 저장 시 합친다. null 이면 "배열 값이 없음"이고, 이 경우 예전
  // 자유 입력 문자열(content 에 그대로 실려 있다)을 계속 쓴다.
  const [extraGroomList, setExtraGroomList] = useState<AccountEntry[] | null>(() =>
    parseAccountList(initialRaw.extra_account_groom)
  )
  const [extraBrideList, setExtraBrideList] = useState<AccountEntry[] | null>(() =>
    parseAccountList(initialRaw.extra_account_bride)
  )
  // 그 외 연락처(혼주 등)도 같은 이유로 같은 방식이다 — extra_contacts 는 legacy 자유 입력이
  // 있던 적이 없어(신규 필드) 문자열 마이그레이션 분기가 필요 없다.
  const [extraContactsList, setExtraContactsList] = useState<ContactEntry[] | null>(() =>
    parseContactList(initialRaw.extra_contacts)
  )

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
  const [greetingImageRatio, setGreetingImageRatio] = useState<"natural" | "fill">(
    () => (initialRaw.greeting_image_ratio === "fill" ? "fill" : "natural")
  )
  const [sequenceRows, setSequenceRows] = useState<SequenceEvent[]>(() => normalizeSequence(initialRaw.wedding_programs))
  const [showProgram, setShowProgram] = useState(() => !isToggledOff(initialRaw.show_wedding_program))
  const [phoneExpose, setPhoneExpose] = useState(() => !isToggledOff(initialRaw.phone_expose))
  // 연락처 표시가 켜져 있어도 신랑/신부 본인만 개별로 숨길 수 있다 (혼주 연락처는 전체 스위치만 따른다)
  const [groomShowPhone, setGroomShowPhone] = useState(() => !isToggledOff(initialRaw.groom_show_phone))
  const [brideShowPhone, setBrideShowPhone] = useState(() => !isToggledOff(initialRaw.bride_show_phone))
  // 나중에 추가된 옵트인 설정 3종 — 미설정(기존 청첩장)은 모두 꺼짐이어야 하므로
  // isToggledOff(미설정=켜짐) 가 아니라 isToggledOn(미설정=꺼짐) 으로 읽는다.
  const [galleryZoomBlock, setGalleryZoomBlock] = useState(() => isToggledOn(initialRaw.gallery_zoom_block))
  const [accountCollapsed, setAccountCollapsed] = useState(() => isToggledOn(initialRaw.account_collapsed))
  const [bgmAutoplay, setBgmAutoplay] = useState(() => isToggledOn(initialRaw.bgm_autoplay))
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

  useEffect(() => {
    if (!showBgm) return
    supabase.from("bgms").select("id,name,url").then(({ data }) => { if (data) setBgms(data) })
  }, [showBgm])

  useEffect(() => {
    fetchRegisteredFonts().then(setFonts)
  }, [])
  // 폰트 선택 드롭다운에서 이름만으로는 어떤 폰트인지 알기 어려우므로 그 폰트로 직접 렌더해 보여준다
  useInjectFontFaces(fonts)

  // 배열이 있을 때만 덮어쓴다 — null 이면 계좌는 예전 자유 입력 문자열을 content 가 그대로
  // 들고 있고, 연락처는 애초에 값 자체가 없다는 뜻이다.
  const extraArrayFieldsPayload = useMemo(() => {
    const out: Record<string, unknown> = {}
    if (extraGroomList !== null) out.extra_account_groom = extraGroomList.filter(isAccountFilled)
    if (extraBrideList !== null) out.extra_account_bride = extraBrideList.filter(isAccountFilled)
    if (extraContactsList !== null) out.extra_contacts = extraContactsList.filter(isContactFilled)
    return out
  }, [extraGroomList, extraBrideList, extraContactsList])

  // 미리보기용 raw: 저장된 값 위에 현재 편집 중인 값을 얹는다 (발행 파이프라인과 동일 함수로 렌더)
  const liveRaw = useMemo(() => ({
    ...initialRaw,
    ...content,
    wedding_date: weddingDate,
    wedding_time: weddingTime,
    gallery_images: galleryImages,
    ...extraArrayFieldsPayload,
    gallery_view_type: galleryViewType,
    gallery_align: galleryAlign,
    greeting_image_ratio: greetingImageRatio,
    wedding_programs: sequenceRows,
    show_wedding_program: showProgram ? "예" : "아니오",
    phone_expose: phoneExpose ? "예" : "아니오",
    groom_show_phone: groomShowPhone ? "예" : "아니오",
    bride_show_phone: brideShowPhone ? "예" : "아니오",
    gallery_zoom_block: galleryZoomBlock ? "예" : "아니오",
    account_collapsed: accountCollapsed ? "예" : "아니오",
    bgm_autoplay: bgmAutoplay ? "예" : "아니오",
    bgm_url: bgmUrl,
  }), [initialRaw, content, extraArrayFieldsPayload, weddingDate, weddingTime, galleryImages, galleryViewType, galleryAlign, greetingImageRatio, sequenceRows, showProgram, phoneExpose, groomShowPhone, brideShowPhone, galleryZoomBlock, accountCollapsed, bgmAutoplay, bgmUrl])

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

  /** 블럭 순서 — hero(항상 맨 앞)와 share(항상 맨 뒤, §요구사항)를 뺀 "드래그 가능한" 블럭 키만 담는다.
   * 저장된 순서에 없는 키는 정렬 시 자동으로 원래(테마 기본) 위치를 유지한다(Array.sort는 안정 정렬). */
  const [blockOrder, setBlockOrder] = useState<string[]>(
    () => (extractBlockOrder(invitation.block_order) ?? []).filter((k) => k !== "hero" && k !== "share")
  )
  const shareBlock = useMemo(() => editableBlocks.find((b) => b.key === "share"), [editableBlocks])
  const draggableBlocks = useMemo(() => {
    const rest = editableBlocks.filter((b) => b.key !== "share" && b.key !== "hero")
    const pos = new Map(blockOrder.map((k, i) => [k, i]))
    return [...rest].sort((a, b) => {
      const ai = pos.has(a.key) ? pos.get(a.key)! : Infinity
      const bi = pos.has(b.key) ? pos.get(b.key)! : Infinity
      return ai - bi
    })
  }, [editableBlocks, blockOrder])
  /** 실제 렌더링(미리보기·저장)에 쓰는 전체 순서 — hero를 맨 앞에, share를 맨 뒤에 명시적으로 고정한다 */
  const fullBlockOrder = useMemo(
    () => ["hero", ...draggableBlocks.map((b) => b.key), "share"],
    [draggableBlocks]
  )
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const handleBlockDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const keys = draggableBlocks.map((b) => b.key)
    const oldIndex = keys.indexOf(String(active.id))
    const newIndex = keys.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    setBlockOrder(arrayMove(keys, oldIndex, newIndex))
  }

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

  const uploadCalendarDayShape = async (blockKey: string, file: File) => {
    setUploadingKey("calendarDayCustomShapeUrl")
    try {
      const url = await uploadImage(file, "invitations/content")
      setBlockOverride(blockKey, { calendarDayCustomShapeUrl: url })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "강조 이미지 업로드에 실패했습니다.")
    } finally {
      setUploadingKey(null)
    }
  }

  const uploadGreetingIcon = async (blockKey: string, file: File) => {
    setUploadingKey("greetingIconCustomUrl")
    try {
      const url = await uploadImage(file, "invitations/content")
      setBlockOverride(blockKey, { greetingIconCustomUrl: url })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "아이콘 이미지 업로드에 실패했습니다.")
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

  // 이탈 경고 — save()가 실제로 보내는 값들과 같은 필드 집합의 지문을 비교해 저장 안 한
  // 변경사항이 있으면 새로고침/탭 닫기 시 브라우저 확인을 받는다(§useUnsavedChangesWarning).
  const dirtyFingerprint = JSON.stringify({
    overrides, disabledSlots, blockOverrides, sectionImages, scrollMotion, intro,
    content, weddingDate, weddingTime, galleryImages, galleryViewType, galleryAlign,
    greetingImageRatio, sequenceRows, showProgram, phoneExpose, groomShowPhone, brideShowPhone,
    galleryZoomBlock, accountCollapsed, bgmAutoplay, extraGroomList, extraBrideList, extraContactsList,
    bgmUrl, themeVersionId, blockOrder, ogTitle, ogDescription, ogImage,
  })
  const [initialFingerprint, setInitialFingerprint] = useState(dirtyFingerprint)
  const isDirty = dirtyFingerprint !== initialFingerprint
  useUnsavedChangesWarning(isDirty)

  const save = async (): Promise<boolean> => {
    // 동시 편집 충돌 감지 — 이 화면이 마지막으로 읽은 updated_at 이후 다른 관리자가
    // 먼저 저장했다면 그대로 덮어쓰지 않고 먼저 확인을 받는다(last-write-wins 방지).
    if (lastKnownUpdatedAtRef.current) {
      const { data: current } = await supabase
        .from("invitations")
        .select("updated_at")
        .eq("id", invitationId)
        .maybeSingle()
      if (current && current.updated_at !== lastKnownUpdatedAtRef.current) {
        const overwrite = await confirmDialog({
          title: "다른 관리자가 먼저 저장한 변경사항이 있습니다",
          description: "계속 저장하면 그 변경사항이 덮어써집니다. 계속하시겠습니까?",
          destructive: true,
          confirmText: "덮어쓰고 저장",
        })
        if (!overwrite) return false
      }
    }

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
    // PLAN_DESIGN_CONTROLS.md §5.3. scrollMotion/introEnabled도 아래에서 명시적으로 다시 채워
    // 넣으므로 동일하게 제외한다.
    const MANAGED_OVERRIDE_KEYS = new Set(["disabled_slots", "blocks", "sectionImages", "scrollMotion", "introEnabled", "intro"])
    for (const [k, v] of Object.entries(existingOverrides)) if (!k.startsWith("--") && !MANAGED_OVERRIDE_KEYS.has(k)) preservedOverrideKeys[k] = v

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
      ...extraArrayFieldsPayload,
      gallery_view_type: galleryViewType,
      gallery_align: galleryAlign,
      greeting_image_ratio: greetingImageRatio,
      wedding_programs: sequenceRows,
      show_wedding_program: showProgram ? "예" : "아니오",
      phone_expose: phoneExpose ? "예" : "아니오",
      groom_show_phone: groomShowPhone ? "예" : "아니오",
      bride_show_phone: brideShowPhone ? "예" : "아니오",
      gallery_zoom_block: galleryZoomBlock ? "예" : "아니오",
      account_collapsed: accountCollapsed ? "예" : "아니오",
      bgm_autoplay: bgmAutoplay ? "예" : "아니오",
    }

    const existingOgMeta = (invitation.og_meta && typeof invitation.og_meta === "object")
      ? invitation.og_meta as Record<string, unknown>
      : {}

    const nextUpdatedAt = new Date().toISOString()
    const { error } = await supabase
      .from("invitations")
      .update({
        content_data: contentPayload,
        customization_overrides: { ...preservedOverrideKeys, ...cleanTokens, disabled_slots: disabledSlots, blocks: blockOverrides, sectionImages, scrollMotion, intro, introEnabled: intro.enabled },
        block_order: fullBlockOrder,
        bgm_url: bgmUrl || null,
        theme_version_id: themeVersionId,
        og_meta: { ...existingOgMeta, title: ogTitle || null, description: ogDescription || null, image: ogImage || null },
        updated_at: nextUpdatedAt,
      })
      .eq("id", invitationId)
    if (error) {
      toast.error(`저장 실패: ${error.message}`)
      return false
    }
    lastKnownUpdatedAtRef.current = nextUpdatedAt
    setInitialFingerprint(dirtyFingerprint)
    toast.success("저장되었습니다.")
    const { data: userData } = await supabase.auth.getUser()
    logAuditEvent(supabase, {
      invitationId,
      actorType: "admin",
      actorLabel: userData.user?.email ?? null,
      action: "invitation.save",
      summary: "청첩장 내용/디자인을 저장했습니다.",
    })
    return true
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
    // dashboard_password는 이제 해시로 저장되어 관리자도 실제 값을 알 수 없다
    // (§lib/dashboard-password.ts). 대신 값이 만들어지는 고정 규칙을 안내한다.
    const text = `${window.location.origin}/dashboard/${publicSlug}\n비밀번호: 등록된 고객 연락처 뒷 4자리`
    try {
      await navigator.clipboard.writeText(text)
      toast.success("고객용 대시보드 링크가 복사되었습니다. (비밀번호는 등록된 고객 연락처 뒷 4자리입니다)")
    } catch {
      toast.error("링크 복사에 실패했습니다.")
    }
  }

  const [reviewStatus, setReviewStatus] = useState<string>(String(invitation.review_status ?? "none"))
  const [reviewRound, setReviewRound] = useState<number>(Number(invitation.review_round ?? 0))
  const [sendingReview, setSendingReview] = useState(false)
  const revisionsQuery = useInvitationRevisionsQuery(invitationId)
  const resolveRevision = useResolveRevisionMutation(invitationId)
  const auditLogsQuery = useAuditLogsQuery(invitationId)

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

      const text = `${window.location.origin}/review/${publicSlug}\n비밀번호: 등록된 고객 연락처 뒷 4자리`
      await navigator.clipboard.writeText(text)
      toast.success("검수 링크가 복사되었습니다. (비밀번호는 등록된 고객 연락처 뒷 4자리입니다) 고객에게 전달해주세요.")
      const { data: userData } = await supabase.auth.getUser()
      logAuditEvent(supabase, {
        invitationId,
        actorType: "admin",
        actorLabel: userData.user?.email ?? null,
        action: "review.requested",
        summary: `검수 요청을 보냈습니다 (${nextRound}차).`,
      })
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
    <div className="mx-auto grid max-w-[1280px] gap-6 font-sans xl:h-[calc(100vh-100px)] xl:grid-cols-[minmax(0,1fr)_420px]">
      {/* 편집 */}
      <div className="order-2 min-w-0 pb-24 xl:order-1 xl:h-full xl:max-w-3xl xl:overflow-y-auto xl:pb-0 xl:pr-1">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">청첩장 커스터마이즈</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {groom && bride ? `${groom} ♥ ${bride}` : "청첩장"}
          </p>
        </div>

        <Tabs defaultValue="content" className="gap-6">
          <TabsList className="grid w-full grid-cols-4">
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
            <TabsTrigger value="history">이력</TabsTrigger>
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
                  {visibleContentFields.some((f) => f.key === "greeting_image") && (
                    <Field className="mt-4">
                      <FieldLabel>인사말 이미지 비율</FieldLabel>
                      <RadioGroup
                        value={greetingImageRatio}
                        onValueChange={(v) => setGreetingImageRatio(v as "natural" | "fill")}
                        className="flex flex-row gap-6"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="natural" id="greeting-ratio-natural" />
                          <Label htmlFor="greeting-ratio-natural" className="font-normal cursor-pointer">현재 비율</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="fill" id="greeting-ratio-fill" />
                          <Label htmlFor="greeting-ratio-fill" className="font-normal cursor-pointer">좌우로 꽉 채우기</Label>
                        </div>
                      </RadioGroup>
                    </Field>
                  )}
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
                      <div className="flex items-center gap-3">
                        <Switch id="galleryZoomBlock" checked={galleryZoomBlock} onCheckedChange={setGalleryZoomBlock} />
                        <Label htmlFor="galleryZoomBlock" className="font-normal cursor-pointer">사진 확대 방지</Label>
                      </div>
                      <FieldDescription>
                        켜면 하객이 갤러리 사진을 크게 볼 수 없습니다 — 사진을 눌러 확대(라이트박스)하는 기능이 꺼지고,
                        모바일 핀치줌·더블탭과 PC 우클릭·드래그·Ctrl+휠 확대가 모두 차단됩니다.
                      </FieldDescription>
                    </Field>

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
                  <CardDescription>혼주 계좌는 필요한 만큼 추가·삭제할 수 있습니다. 계좌마다 따로 넣어야 하객 화면에서 계좌번호만 정확히 복사됩니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Field>
                    <div className="flex items-center gap-3">
                      <Switch id="accountCollapsed" checked={accountCollapsed} onCheckedChange={setAccountCollapsed} />
                      <Label htmlFor="accountCollapsed" className="font-normal cursor-pointer">계좌 정보 접어두기</Label>
                    </div>
                    <FieldDescription>
                      켜면 청첩장에서 계좌 정보가 바로 보이지 않고 &ldquo;마음 전하실 곳 보기&rdquo; 버튼을 눌러야 펼쳐집니다.
                    </FieldDescription>
                  </Field>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <FieldGroup className="space-y-4">
                      <p className="text-sm font-medium text-muted-foreground">신랑측</p>
                      {ACCOUNT_FIELD_DEFS.slice(0, 3).map((f) => (
                        <TextField key={f.key} def={f} value={content[f.key] || ""} onChange={(v) => setField(f.key, v)} />
                      ))}
                      <ExtraAccountEditor
                        label="신랑측 혼주 계좌"
                        legacyText={content.extra_account_groom || ""}
                        list={extraGroomList}
                        onChangeList={setExtraGroomList}
                        onChangeLegacy={(v) => setField("extra_account_groom", v)}
                      />
                    </FieldGroup>
                    <FieldGroup className="space-y-4">
                      <p className="text-sm font-medium text-muted-foreground">신부측</p>
                      {ACCOUNT_FIELD_DEFS.slice(3, 6).map((f) => (
                        <TextField key={f.key} def={f} value={content[f.key] || ""} onChange={(v) => setField(f.key, v)} />
                      ))}
                      <ExtraAccountEditor
                        label="신부측 혼주 계좌"
                        legacyText={content.extra_account_bride || ""}
                        list={extraBrideList}
                        onChangeList={setExtraBrideList}
                        onChangeLegacy={(v) => setField("extra_account_bride", v)}
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
                    {phoneExpose && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">그 외 연락처 (혼주 등)</p>
                        <ContactListField
                          idPrefix="extra-contacts"
                          items={extraContactsList ?? []}
                          onChange={setExtraContactsList}
                          addLabel="연락처 추가"
                        />
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
                    <Field>
                      <div className="flex items-center gap-3">
                        <Switch id="bgmAutoplay" checked={bgmAutoplay} onCheckedChange={setBgmAutoplay} />
                        <Label htmlFor="bgmAutoplay" className="font-normal cursor-pointer">자동 재생</Label>
                      </div>
                      <FieldDescription>
                        꺼두면 청첩장을 열자마자 음악이 나오지 않고, 하객이 우측 상단 ♪ 버튼을 눌렀을 때만 재생됩니다.
                        (조용한 자리에서 열어본 하객이 당황하지 않도록 기본값은 꺼짐입니다)
                      </FieldDescription>
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
                <CardTitle className="text-base font-medium">스크롤 모션</CardTitle>
                <CardDescription>
                  하객이 스크롤할 때 각 섹션이 나타나는 방식입니다. 신랑신부도 대시보드에서
                  직접 바꿀 수 있는 항목입니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollMotionField value={scrollMotion} onChange={setScrollMotion} idPrefix="admin-scroll-motion" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">청첩장 열기 연출</CardTitle>
                <CardDescription>
                  하객이 링크에 처음 들어왔을 때 잠깐 나타났다 사라지는 연출입니다. 재방문 시에도
                  매번 보이므로 취향이 갈릴 수 있어 기본은 꺼짐입니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm">오프닝 인트로 사용</span>
                  <Switch checked={intro.enabled} onCheckedChange={(v) => setIntroField("enabled", v)} />
                </div>

                {intro.enabled && (
                  <FieldGroup className="space-y-4 border-t pt-5">
                    <Field>
                      <FieldLabel>보여줄 내용</FieldLabel>
                      <RadioGroup
                        value={intro.mode}
                        onValueChange={(v) => setIntroField("mode", v as IntroSettings["mode"])}
                        className="flex flex-col gap-2"
                      >
                        {INTRO_MODES.map((m) => (
                          <div key={m.value} className="flex items-center gap-2">
                            <RadioGroupItem value={m.value} id={`intro-mode-${m.value}`} />
                            <Label htmlFor={`intro-mode-${m.value}`} className="font-normal cursor-pointer">
                              {m.label}
                              <span className="ml-1.5 text-xs text-muted-foreground">{m.description}</span>
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </Field>

                    {intro.mode === "text" && (
                      <Field>
                        <FieldLabel htmlFor="introText">문구</FieldLabel>
                        <Textarea
                          id="introText"
                          value={intro.text}
                          onChange={(e) => setIntroField("text", e.target.value)}
                          placeholder={"예: 저희 두 사람\n결혼합니다"}
                          rows={3}
                        />
                        <FieldDescription>줄바꿈은 입력한 그대로 표시됩니다.</FieldDescription>
                      </Field>
                    )}

                    {intro.mode === "image" && (
                      <ImageField
                        def={{ key: "intro_image", label: "인트로 이미지", type: "image" }}
                        value={intro.imageUrl}
                        uploading={uploadingIntroImage}
                        onUpload={uploadIntroImage}
                        onClear={() => setIntroField("imageUrl", "")}
                      />
                    )}

                    {/* 서체·크기는 글자를 보여줄 때만 의미가 있다 (이미지 모드에서는 감춘다) */}
                    {intro.mode !== "image" && (
                      <>
                        <Field>
                          <FieldLabel>서체</FieldLabel>
                          <div className="flex items-start gap-2">
                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                              {fonts.length > 0 && (
                                <Select
                                  value={fonts.map((f) => buildFontStack(f, "--font-kr")).find((s) => s === intro.fontFamily) || ""}
                                  onValueChange={(v) => { if (v) setIntroField("fontFamily", v) }}
                                >
                                  <SelectTrigger className="w-full" style={intro.fontFamily ? { fontFamily: intro.fontFamily } : undefined}>
                                    <SelectValue placeholder="에셋에 등록된 폰트 선택…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {fonts.map((f) => (
                                      <SelectItem key={f.id} value={buildFontStack(f, "--font-kr")} style={fontPreviewStyle(f)}>{f.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              <Input
                                value={intro.fontFamily}
                                onChange={(e) => setIntroField("fontFamily", e.target.value)}
                                placeholder="비워두면 테마 한글 폰트"
                              />
                            </div>
                            {intro.fontFamily && (
                              <Button type="button" variant="ghost" size="icon-sm" title="테마 기본 폰트로" onClick={() => setIntroField("fontFamily", "")}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </Field>

                        <SizeSliderField
                          label="글자 크기"
                          value={intro.fontSize}
                          defaultValue={DEFAULT_INTRO_SETTINGS.fontSize}
                          min={INTRO_FONT_SIZE_MIN}
                          max={INTRO_FONT_SIZE_MAX}
                          onChange={(v) => setIntroField("fontSize", v)}
                          onReset={() => setIntroField("fontSize", DEFAULT_INTRO_SETTINGS.fontSize)}
                        />
                      </>
                    )}

                    <Field>
                      <FieldLabel>정렬</FieldLabel>
                      <RadioGroup
                        value={intro.align}
                        onValueChange={(v) => setIntroField("align", v as IntroSettings["align"])}
                        className="flex flex-row gap-6"
                      >
                        {INTRO_ALIGNS.map((a) => (
                          <div key={a.value} className="flex items-center gap-2">
                            <RadioGroupItem value={a.value} id={`intro-align-${a.value}`} />
                            <Label htmlFor={`intro-align-${a.value}`} className="font-normal cursor-pointer">{a.label}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </Field>
                  </FieldGroup>
                )}
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
                  <p className="mb-2 text-xs text-muted-foreground">왼쪽 손잡이를 드래그해서 블럭 순서를 바꿀 수 있습니다.</p>
                  <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleBlockDragEnd}>
                    <SortableContext items={draggableBlocks.map((b) => b.key)} strategy={verticalListSortingStrategy}>
                      <Accordion
                        type="single"
                        collapsible
                        value={focusBlock ?? ""}
                        onValueChange={(v) => setFocusBlock(v || null)}
                      >
                        {draggableBlocks.map((b) => {
                      const hasToggle = slots.includes(b.key)
                      const hasExpandable = b.title || b.padding
                      const isOn = !disabledSlots.includes(b.key)
                      const override = blockOverrides[b.key]

                      if (!hasExpandable) {
                        return (
                          <SortableBlockRow key={b.key} id={b.key}>
                            {(drag) => (
                              <div className="flex items-center justify-between border-b py-4 last:border-b-0">
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <DragHandle {...drag} />
                                  <span className={cn("text-sm font-medium", !isOn && "text-muted-foreground")}>{b.label}</span>
                                </div>
                                {hasToggle && <Switch checked={isOn} onCheckedChange={(c) => toggleSlot(b.key, c)} />}
                              </div>
                            )}
                          </SortableBlockRow>
                        )
                      }

                      return (
                        <SortableBlockRow key={b.key} id={b.key}>
                          {(drag) => (
                        <AccordionItem value={b.key}>
                          <div className="flex items-center gap-2">
                            <DragHandle {...drag} />
                            <AccordionTrigger className="flex-1 text-[15px] font-semibold">
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
                          <AccordionContent className="space-y-4 [&_[data-slot=field-label]]:text-xs [&_[data-slot=field-label]]:font-normal [&_[data-slot=field-label]]:text-muted-foreground">
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
                              <>
                                <div className="flex items-center justify-between border-t pt-4">
                                  <span className="text-sm">D-day 카운트다운 표시</span>
                                  <Switch
                                    checked={override?.ddayEnabled !== false}
                                    onCheckedChange={(c) => setBlockOverride(b.key, { ddayEnabled: c })}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">&ldquo;캘린더 앱에 추가&rdquo; 버튼</span>
                                  <Switch
                                    checked={override?.icsButtonEnabled !== false}
                                    onCheckedChange={(c) => setBlockOverride(b.key, { icsButtonEnabled: c })}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">&ldquo;구글 캘린더&rdquo; 버튼</span>
                                  <Switch
                                    checked={override?.googleCalendarButtonEnabled !== false}
                                    onCheckedChange={(c) => setBlockOverride(b.key, { googleCalendarButtonEnabled: c })}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">D-day 숫자 굴러 올라오는 연출</span>
                                  <Switch
                                    checked={override?.ddayRollingEnabled === true}
                                    onCheckedChange={(c) => setBlockOverride(b.key, { ddayRollingEnabled: c })}
                                  />
                                </div>

                                <Field className="border-t pt-4">
                                  <FieldLabel>달력 아래 날짜 문구</FieldLabel>
                                  <Input
                                    value={override?.calendarDateText ?? ""}
                                    onChange={(e) => setBlockOverride(b.key, { calendarDateText: e.target.value })}
                                    placeholder="비워두면 예식일로 자동 표시"
                                  />
                                </Field>
                                <Field>
                                  <FieldLabel>달력 아래 시간 문구</FieldLabel>
                                  <Input
                                    value={override?.calendarTimeText ?? ""}
                                    onChange={(e) => setBlockOverride(b.key, { calendarTimeText: e.target.value })}
                                    placeholder="비워두면 요일·예식 시간으로 자동 표시"
                                  />
                                </Field>

                                <Field className="border-t pt-4">
                                  <FieldLabel>예식일 강조 표시 모양</FieldLabel>
                                  <RadioGroup
                                    value={override?.calendarDayShape || "circle"}
                                    onValueChange={(v) => setBlockOverride(b.key, { calendarDayShape: v as "circle" | "heart" | "custom" })}
                                    className="flex flex-row gap-6"
                                  >
                                    <div className="flex items-center gap-2">
                                      <RadioGroupItem value="circle" id={`${b.key}-shape-circle`} />
                                      <Label htmlFor={`${b.key}-shape-circle`} className="font-normal cursor-pointer">동그라미</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <RadioGroupItem value="heart" id={`${b.key}-shape-heart`} />
                                      <Label htmlFor={`${b.key}-shape-heart`} className="font-normal cursor-pointer">하트</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <RadioGroupItem value="custom" id={`${b.key}-shape-custom`} />
                                      <Label htmlFor={`${b.key}-shape-custom`} className="font-normal cursor-pointer">직접 업로드</Label>
                                    </div>
                                  </RadioGroup>
                                </Field>

                                {override?.calendarDayShape === "custom" && (
                                  <>
                                    <ImageField
                                      def={{ key: "calendarDayCustomShapeUrl", label: "강조 이미지", type: "image" }}
                                      value={override?.calendarDayCustomShapeUrl || ""}
                                      uploading={uploadingKey === "calendarDayCustomShapeUrl"}
                                      onUpload={(file) => uploadCalendarDayShape(b.key, file)}
                                      onClear={() => setBlockOverride(b.key, { calendarDayCustomShapeUrl: undefined })}
                                    />
                                    {override?.calendarDayCustomShapeUrl?.toLowerCase().split("?")[0].endsWith(".svg") && (
                                      <BlockColorField
                                        label="업로드 이미지 색상 (SVG 전용)"
                                        value={override?.calendarDaySvgColor}
                                        defaultValue={accent}
                                        onChange={(v) => setBlockOverride(b.key, { calendarDaySvgColor: v })}
                                        onReset={() => setBlockOverride(b.key, { calendarDaySvgColor: undefined })}
                                      />
                                    )}
                                  </>
                                )}

                                <SizeSliderField
                                  label="강조 표시 크기"
                                  value={override?.calendarDayShapeSize}
                                  defaultValue={32}
                                  min={20}
                                  max={48}
                                  onChange={(v) => setBlockOverride(b.key, { calendarDayShapeSize: v })}
                                  onReset={() => setBlockOverride(b.key, { calendarDayShapeSize: undefined })}
                                />

                                <BlockColorField
                                  label="강조일자 텍스트 색상"
                                  value={override?.calendarDayTextColor}
                                  defaultValue="#ffffff"
                                  onChange={(v) => setBlockOverride(b.key, { calendarDayTextColor: v })}
                                  onReset={() => setBlockOverride(b.key, { calendarDayTextColor: undefined })}
                                />
                              </>
                            )}
                            {b.key === "greeting" && (
                              <>
                                <Field className="border-t pt-4">
                                  <FieldLabel>인사말 아이콘 모양</FieldLabel>
                                  <RadioGroup
                                    value={override?.greetingIconShape || "heart"}
                                    onValueChange={(v) => setBlockOverride(b.key, { greetingIconShape: v as "heart" | "custom" })}
                                    className="flex flex-row gap-6"
                                  >
                                    <div className="flex items-center gap-2">
                                      <RadioGroupItem value="heart" id={`${b.key}-icon-heart`} />
                                      <Label htmlFor={`${b.key}-icon-heart`} className="font-normal cursor-pointer">하트</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <RadioGroupItem value="custom" id={`${b.key}-icon-custom`} />
                                      <Label htmlFor={`${b.key}-icon-custom`} className="font-normal cursor-pointer">직접 업로드</Label>
                                    </div>
                                  </RadioGroup>
                                </Field>

                                {override?.greetingIconShape === "custom" && (
                                  <ImageField
                                    def={{ key: "greetingIconCustomUrl", label: "아이콘 이미지", type: "image" }}
                                    value={override?.greetingIconCustomUrl || ""}
                                    uploading={uploadingKey === "greetingIconCustomUrl"}
                                    onUpload={(file) => uploadGreetingIcon(b.key, file)}
                                    onClear={() => setBlockOverride(b.key, { greetingIconCustomUrl: undefined })}
                                  />
                                )}

                                <SizeSliderField
                                  label="아이콘 크기"
                                  value={override?.greetingIconSize}
                                  defaultValue={24}
                                  min={12}
                                  max={64}
                                  onChange={(v) => setBlockOverride(b.key, { greetingIconSize: v })}
                                  onReset={() => setBlockOverride(b.key, { greetingIconSize: undefined })}
                                />

                                <BlockColorField
                                  label="아이콘 색상"
                                  value={override?.greetingIconColor}
                                  defaultValue={accent}
                                  onChange={(v) => setBlockOverride(b.key, { greetingIconColor: v })}
                                  onReset={() => setBlockOverride(b.key, { greetingIconColor: undefined })}
                                />
                              </>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                          )}
                        </SortableBlockRow>
                      )
                    })}
                      </Accordion>
                    </SortableContext>
                  </DndContext>

                  {shareBlock && (
                    <div className="flex items-center justify-between border-t py-4">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-medium", disabledSlots.includes("share") && "text-muted-foreground")}>{shareBlock.label}</span>
                        <span className="text-xs text-muted-foreground">항상 맨 아래에 위치합니다</span>
                      </div>
                      {slots.includes("share") && (
                        <Switch
                          checked={!disabledSlots.includes("share")}
                          onCheckedChange={(c) => toggleSlot("share", c)}
                        />
                      )}
                    </div>
                  )}

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

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">변경 이력</CardTitle>
                <CardDescription>이 청첩장에 대한 관리자·신랑신부의 변경 기록입니다.</CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">불러오는 중…</p>
                ) : !auditLogsQuery.data || auditLogsQuery.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground">아직 기록된 변경 이력이 없습니다.</p>
                ) : (
                  <ol className="space-y-3">
                    {auditLogsQuery.data.map((log) => (
                      <li key={log.id} className="flex gap-3 border-l-2 border-muted pl-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                log.actor_type === "admin" && "bg-primary/10 text-primary",
                                log.actor_type === "customer" && "bg-amber-500/10 text-amber-600",
                                log.actor_type === "system" && "bg-muted text-muted-foreground"
                              )}
                            >
                              {log.actor_type === "admin" ? "관리자" : log.actor_type === "customer" ? "신랑신부" : "시스템"}
                            </span>
                            {log.actor_label && <span className="text-xs text-muted-foreground">{log.actor_label}</span>}
                            <span className="text-[11px] text-muted-foreground/70">
                              {new Date(log.created_at).toLocaleString("ko-KR")}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm text-foreground">{log.summary}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* xl 미만(1단 레이아웃)에서는 실제 스크롤이 main이 아니라 html에서 일어나(admin 레이아웃의
            고질적인 문제) sticky가 기준을 잃으므로 fixed로 뷰포트 하단에 고정하고(사이드바 폭만큼
            lg:left-64 로 비켜준다), xl 이상에서는 원래의(검증된) 컬럼 내부 sticky로 되돌린다. */}
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t bg-background px-4 py-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] lg:left-64 lg:px-6 xl:sticky xl:inset-x-auto xl:left-auto xl:z-auto xl:mt-6 xl:px-0 xl:shadow-none">
          <SaveButton onSave={save} className="gap-2" />
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
          {publicSlug && <QrCodeDialog path={`/w/${publicSlug}`} fileBaseName={publicSlug} />}
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
        <div className="relative rounded-2xl bg-muted/40 py-5 px-3">
          <ScaledPreview width={380} height={680}>
            <InvitationFrame
              template={template}
              data={data}
              tokens={tokens}
              slots={previewSlots}
              fontFaces={fontFaces}
              blockOverrides={blockOverrides}
              blockOrder={fullBlockOrder}
              hiddenBlocks={hiddenBlocks}
              sectionImages={sectionImages}
              scrollMotion={scrollMotion}
              intro={intro}
              focusBlock={focusBlock}
              width={380}
              height={680}
            />
          </ScaledPreview>
          {/* 테마 전환 중 — "지금 다시 그리는 중"임을 보여주는 shimmer. Visibility 원칙:
              흰 화면만 보이면 로딩인지 깨진 것인지 구분이 안 된다. */}
          {switchingTheme && (
            <div className="absolute inset-3 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm">
              <div className="h-full w-full animate-pulse rounded-xl bg-muted/70" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// SortableBlockRow, DragHandle, SizeSliderField, BlockColorField, TextField, ImageField,
// GalleryUploadButton — 프레젠테이션 전용 하위 컴포넌트는 ./fields.tsx 로 이동했다.
