import type { ThemeTemplate, TokenMap } from "@/components/invitation/invitation-frame"

/**
 * DB(themes 행) ↔ 렌더러(InvitationFrame) 사이의 브릿지.
 *
 * themes 테이블에 저장된 template_html / template_css / slot_manifest 를
 * InvitationFrame 이 요구하는 ThemeTemplate 형태로 변환한다.
 * render_engine 플래그로 신/구 렌더러를 구분한다.
 *
 * 관련 마이그레이션: supabase/migrations/20260724000000_theme_template_engine.sql
 */

export type RenderEngine = "legacy" | "template"

/** themes 테이블 행 중 템플릿 렌더링에 필요한 필드만 추린 부분 타입 */
export interface ThemeRow {
  id: string
  name?: string | null
  render_engine?: RenderEngine | null
  template_html?: string | null
  template_css?: string | null
  slot_manifest?: unknown
  field_manifest?: unknown
  /** 이 테마가 지원하는 블럭과 블럭별 편집 가능 범위 선언 (§BlockManifestEntry) */
  block_manifest?: unknown
  /** 디자인 토큰 저장소 (CSS 변수 키 또는 레거시 스타일 키) */
  styles?: unknown
  [key: string]: unknown
}

/** 문자열 배열이 아닌 값이 와도 안전하게 문자열 배열로 정규화 */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string")
  return []
}

/** 이 테마가 새 템플릿(iframe) 엔진을 쓰는가 */
export function isTemplateTheme(row: ThemeRow | null | undefined): boolean {
  return !!row && row.render_engine === "template" && typeof row.template_html === "string" && row.template_html.length > 0
}

/**
 * themes 행을 렌더러용 ThemeTemplate 으로 변환한다.
 * 템플릿 엔진 테마가 아니거나 HTML 이 없으면 null 을 반환한다.
 * (호출부는 null 이면 기존 legacy 렌더러로 폴백)
 */
export function toThemeTemplate(row: ThemeRow | null | undefined): ThemeTemplate | null {
  if (!isTemplateTheme(row) || !row) return null
  return {
    key: row.id,
    name: row.name ?? "테마",
    html: row.template_html ?? "",
    css: row.template_css ?? "",
    slots: toStringArray(row.slot_manifest),
  }
}

/** 템플릿이 참조하는 필드키 목록 (폼-테마 매핑 검증용) */
export function getFieldManifest(row: ThemeRow | null | undefined): string[] {
  return toStringArray(row?.field_manifest)
}

/* ===================================================================== *
 * 디자인 토큰 (에셋 설정 → CSS 변수)
 *
 * 저장 위치는 기존 themes.styles(jsonb) 를 그대로 재사용한다.
 *  - 템플릿 테마: "--accent" 처럼 CSS 변수명을 키로 저장 (권장)
 *  - 레거시 테마: primaryColor / fontKr 등 기존 키 → 아래 표로 매핑
 * 두 형식을 모두 해석하므로 별도 마이그레이션이 필요 없다.
 * ===================================================================== */

/** 레거시 styles 키 → CSS 변수명 */
const LEGACY_STYLE_TO_TOKEN: Record<string, string> = {
  primaryColor: "--accent",
  backgroundColor: "--bg",
  textColor: "--ink",
  secondaryColor: "--accent-2",
  secondaryTextColor: "--ink-2",
  fontKr: "--font-kr",
  fontEn: "--font-en",
}

/** 편집 UI 에서 노출하는 토큰 정의 (순서 = 표시 순서) */
export const TOKEN_FIELDS: { name: string; label: string; type: "color" | "font" }[] = [
  { name: "--accent", label: "포인트 색상", type: "color" },
  { name: "--bg", label: "배경색", type: "color" },
  { name: "--ink", label: "본문 텍스트 색", type: "color" },
  { name: "--accent-2", label: "보조 색상", type: "color" },
  { name: "--ink-2", label: "보조 텍스트 색", type: "color" },
  { name: "--font-kr", label: "한글 폰트", type: "font" },
  { name: "--font-en", label: "영문 폰트", type: "font" },
]

/**
 * 슬라이더로 노출하는 숫자형 토큰 정의.
 * 값은 customization_overrides 에 숫자로 저장되고(extractOverrideTokens 가 'px' 단위를 붙인다),
 * 테마 CSS 는 항상 폴백을 동반한 var() 로 이 토큰을 참조한다 — 토큰이 없으면 원래 값 그대로 렌더된다.
 * 편집기는 이 목록을 그대로 순회하되, 테마 template_css 가 실제로 참조하지 않는 토큰은 슬라이더를 숨긴다.
 */
export const SIZE_TOKEN_FIELDS: { name: string; label: string; group: "typography" | "layout"; min: number; max: number }[] = [
  { name: "--text-display", label: "대표 문구 · 이름 크기", group: "typography", min: 16, max: 48 },
  { name: "--text-title", label: "섹션 제목 크기", group: "typography", min: 12, max: 32 },
  { name: "--text-label", label: "섹션 영문 소제목 크기", group: "typography", min: 10, max: 24 },
  { name: "--text-body", label: "본문 크기", group: "typography", min: 12, max: 22 },
  { name: "--text-caption", label: "작은 글씨 크기", group: "typography", min: 10, max: 18 },
  { name: "--section-py", label: "섹션 세로 여백", group: "layout", min: 16, max: 120 },
  { name: "--section-px", label: "섹션 가로 여백", group: "layout", min: 8, max: 48 },
  { name: "--content-gap", label: "요소 간 기본 간격", group: "layout", min: 8, max: 64 },
  { name: "--radius", label: "모서리 곡률", group: "layout", min: 0, max: 24 },
]

/**
 * 블럭 키 — 테마 독립적인 청첩장 섹션 식별자. slot_manifest 의 상위집합이다
 * (hero/greeting 은 슬롯이 없는 블럭). themes.block_manifest 는 이 중 테마가
 * 실제로 지원하는(=data-block 이 붙은) 키만 선언한다.
 */
export const BLOCK_KEYS = [
  "hero", "greeting", "gallery", "sequence", "calendar",
  "location", "account", "contact", "rsvp", "share", "guestbook",
] as const
export type BlockKey = (typeof BLOCK_KEYS)[number]

/** themes.block_manifest 한 항목 — "이 테마가 이 블럭에 대해 무엇을 지원하는가" 선언 */
export interface BlockManifestEntry {
  key: string
  label: string
  /** 블럭 제목/영문 소제목 입력란을 보여줄지. false 면 이 블럭에 편집 가능한 타이틀 마커가 없다는 뜻 */
  title: boolean
  /** 블럭 위/아래 여백 슬라이더를 보여줄지. false 면 이 블럭의 여백이 디자인상 고정이어야 한다는 뜻 */
  padding: boolean
}

/** themes.block_manifest(jsonb) 를 안전하게 배열로 정규화 */
export function getBlockManifest(row: ThemeRow | null | undefined): BlockManifestEntry[] {
  const value = row?.block_manifest
  if (!Array.isArray(value)) return []
  return value.filter((v): v is BlockManifestEntry =>
    !!v && typeof v === "object" && typeof (v as Record<string, unknown>).key === "string"
  )
}

/** 블럭 하나에 대한 개별 오버라이드 — customization_overrides.blocks[key] */
export interface BlockOverride {
  /** 위/아래 여백(px). 없으면 테마 기본값 */
  py?: number
  /** 한글 타이틀. 빈 문자열/미설정이면 템플릿 기본 텍스트를 그대로 둔다 */
  title?: string
  /** 영문 소제목. 빈 문자열/미설정이면 템플릿 기본 텍스트를 그대로 둔다 */
  label?: string
  /** rsvp 블럭 전용: false 면 식사 여부 질문을 숨긴다 (미설정 시 노출) */
  mealEnabled?: boolean
  /** rsvp 블럭 전용: false 면 셔틀버스 이용 질문을 숨긴다 (미설정 시 노출) */
  shuttleEnabled?: boolean
  /** calendar 블럭 전용: false 면 D-day 카운트다운을 숨긴다 (미설정 시 노출) */
  ddayEnabled?: boolean
}

/**
 * customization_overrides(jsonb) 에서 blocks(블럭별 오버라이드 맵)를 추출한다.
 * disabled_slots/'--' 토큰과 같은 customization_overrides 컬럼을 공유하되 별도 키라 서로 간섭하지 않는다.
 */
export function extractBlockOverrides(overrides: unknown): Record<string, BlockOverride> {
  const out: Record<string, BlockOverride> = {}
  if (!overrides || typeof overrides !== "object") return out
  const blocks = (overrides as Record<string, unknown>).blocks
  if (!blocks || typeof blocks !== "object") return out
  for (const [key, raw] of Object.entries(blocks as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue
    const r = raw as Record<string, unknown>
    const entry: BlockOverride = {}
    if (typeof r.py === "number" && Number.isFinite(r.py)) entry.py = r.py
    if (typeof r.title === "string") entry.title = r.title
    if (typeof r.label === "string") entry.label = r.label
    if (typeof r.mealEnabled === "boolean") entry.mealEnabled = r.mealEnabled
    if (typeof r.shuttleEnabled === "boolean") entry.shuttleEnabled = r.shuttleEnabled
    if (typeof r.ddayEnabled === "boolean") entry.ddayEnabled = r.ddayEnabled
    if (Object.keys(entry).length > 0) out[key] = entry
  }
  return out
}

/**
 * 섹션(블럭) 사이에 끼워 넣는 이미지 — customization_overrides.sectionImages.
 * 배열 순서가 렌더 순서다. 같은 afterBlock 을 가리키는 항목이 여러 개면 배열 순서대로
 * 연속 배치된다. 삭제 후 재업로드 없이 afterBlock 드롭다운만 바꾸면 위치를 옮길 수 있고,
 * 배열 순서는 위/아래 버튼으로 바꾼다 (편집기 UI, §customize-client.tsx).
 */
export interface SectionImage {
  /** 클라이언트에서 생성하는 안정적인 key (React key 및 DOM 매칭용) */
  id: string
  url: string
  /** 이 블럭 키의 섹션 바로 뒤에 삽입된다 */
  afterBlock: string
  caption?: string
}

/** customization_overrides.sectionImages 를 안전하게 SectionImage[] 로 정규화 */
export function extractSectionImages(overrides: unknown): SectionImage[] {
  if (!overrides || typeof overrides !== "object") return []
  const raw = (overrides as Record<string, unknown>).sectionImages
  if (!Array.isArray(raw)) return []
  const out: SectionImage[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const r = item as Record<string, unknown>
    if (typeof r.id !== "string" || typeof r.url !== "string" || typeof r.afterBlock !== "string") continue
    if (!r.url) continue
    const entry: SectionImage = { id: r.id, url: r.url, afterBlock: r.afterBlock }
    if (typeof r.caption === "string" && r.caption) entry.caption = r.caption
    out.push(entry)
  }
  return out
}

/** 'font-serif' 같은 유틸 값도 실제 font-family 스택으로 변환 */
function toFontStack(value: string): string {
  if (value === "font-serif") return "'Noto Serif KR', serif"
  if (value === "font-sans") return "'Inter', sans-serif"
  // 이미 스택 형태(쉼표 포함)면 그대로, 단일 패밀리면 따옴표 + 폴백
  if (value.includes(",")) return value
  return `'${value}', serif`
}

/**
 * themes.styles 를 CSS 변수 토큰맵으로 변환한다.
 * '--' 로 시작하는 키가 우선하고, 없으면 레거시 키에서 매핑한다.
 */
export function buildThemeTokens(row: ThemeRow | null | undefined): TokenMap {
  const styles = row?.styles
  const tokens: TokenMap = {}
  if (!styles || typeof styles !== "object") return tokens

  const entries = Object.entries(styles as Record<string, unknown>)

  // 1) 레거시 키 매핑 (먼저 채움)
  for (const [key, value] of entries) {
    const tokenName = LEGACY_STYLE_TO_TOKEN[key]
    if (!tokenName || typeof value !== "string" || !value) continue
    tokens[tokenName] = tokenName.startsWith("--font") ? toFontStack(value) : value
  }

  // 2) '--' 직접 지정 키가 있으면 덮어씀 (템플릿 테마의 정식 형식)
  for (const [key, value] of entries) {
    if (!key.startsWith("--") || typeof value !== "string" || !value) continue
    tokens[key] = key.startsWith("--font") ? toFontStack(value) : value
  }

  return tokens
}

/** admin/templates, admin/assets 목록 카드가 쓰는 레거시 테마 카드 표시용 색상 */
export interface ThemeSwatchInput {
  colorSets?: { colors?: string[] }[] | null
  styles?: { backgroundColor?: string; textColor?: string; primaryColor?: string } | null
}

/**
 * 테마 목록 카드의 대표 배경/텍스트/포인트 색상을 뽑는다.
 * colorSets[0] 을 우선하고, 없으면 레거시 styles 키로 폴백한다.
 * 3개 화면(admin/assets, admin/assets/themes/[id], templates)에 흩어져 있던 걸 통합.
 */
export function resolveThemeSwatch(theme: ThemeSwatchInput | null | undefined) {
  return {
    bg: theme?.colorSets?.[0]?.colors?.[0] || theme?.styles?.backgroundColor || '#FFF8F0',
    text: theme?.colorSets?.[0]?.colors?.[2] || theme?.styles?.textColor || '#3A3A3A',
    primary: theme?.colorSets?.[0]?.colors?.[1] || theme?.styles?.primaryColor || '#E8A87C',
  }
}

/**
 * customization_overrides(jsonb) 에서 '--' CSS 변수만 추출한다.
 * 색/폰트 토큰은 문자열로, 사이즈 토큰(SIZE_TOKEN_FIELDS)은 숫자로 저장되므로
 * 숫자 값은 여기서 'px' 단위를 붙여 문자열 CSS 값으로 정규화한다.
 */
export function extractOverrideTokens(overrides: unknown): TokenMap {
  const tokens: TokenMap = {}
  if (overrides && typeof overrides === "object") {
    for (const [k, v] of Object.entries(overrides as Record<string, unknown>)) {
      if (!k.startsWith("--")) continue
      if (typeof v === "string" && v) tokens[k] = v
      else if (typeof v === "number" && Number.isFinite(v)) tokens[k] = `${v}px`
    }
  }
  return tokens
}

/**
 * 최종 토큰 = 테마 기본(themes.styles) + 청첩장 개별 오버라이드.
 * 발행 경로와 편집기가 공유한다.
 */
export function buildInvitationTokens(
  themeRow: ThemeRow | null | undefined,
  overrides: unknown,
): TokenMap {
  return { ...buildThemeTokens(themeRow), ...extractOverrideTokens(overrides) }
}

/**
 * customization_overrides(jsonb) 에서 disabled_slots(문자열 배열)를 추출한다.
 * 테마의 slot_manifest 는 "이 테마가 지원하는 기능"을, 이 값은 "그중 이 청첩장 하나만
 * 꺼둔 기능"을 나타낸다 — 예: 이 커플만 RSVP를 빼달라는 요청. '--' 토큰 오버라이드와
 * 같은 customization_overrides 컬럼을 공유하되 CSS 변수가 아닌 별도 키라 서로 간섭하지 않는다.
 */
export function extractDisabledSlots(overrides: unknown): string[] {
  if (!overrides || typeof overrides !== "object") return []
  const value = (overrides as Record<string, unknown>).disabled_slots
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

/**
 * disabled_slots 중 "블럭 전체가 그 슬롯 하나로만 이루어진" 키만 골라 블럭 표시 제거 대상으로 반환한다.
 * 예) gallery/sequence/rsvp 등은 슬롯을 끄면 섹션 안에 남는 게 없어 빈 껍데기가 되므로 블럭째 숨긴다.
 * 반면 'map'은 location 블럭 안의 일부일 뿐이라(주소 카드가 별도로 있음) 슬롯만 빠지고
 * 블럭은 유지해야 한다. 'bgm'은 아예 블럭이 아닌 플로팅 위젯이라 대상이 아니다.
 * BLOCK_KEYS 에 속하는 슬롯만 남기면 이 구분이 자동으로 맞아떨어진다.
 */
export function getHiddenBlocks(disabledSlots: string[]): string[] {
  return disabledSlots.filter((s): s is BlockKey => (BLOCK_KEYS as readonly string[]).includes(s))
}
