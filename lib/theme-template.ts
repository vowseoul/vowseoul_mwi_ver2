import type { ThemeTemplate, TokenMap } from "@/components/invitation/invitation-frame"
import { z } from "zod"

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
  // 아래 셋은 예전에 테마 CSS 에 px 로 박혀 있어 편집기에서 손댈 수 없던 텍스트들을
  // 성격별로 묶은 것이다. 요소마다 토큰을 만들면 슬라이더가 테마당 열 개 넘게 쌓인다.
  { name: "--text-number", label: "큰 숫자 · 강조 크기", group: "typography", min: 16, max: 56 },
  { name: "--text-card-title", label: "카드 · 항목 제목 크기", group: "typography", min: 10, max: 28 },
  { name: "--text-micro", label: "아주 작은 라벨 크기", group: "typography", min: 7, max: 16 },
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

/** BLOCK_KEYS 고정 한글 라벨 — 테마별 block_manifest에 라벨이 있으면 그쪽이 우선이고
 * (getBlockManifest), 제목 편집이 없어 manifest에 안 실리는 블럭(rsvp/share/guestbook 등)의
 * 폴백으로 쓴다. 시안 검수 화면(고객)과 수정요청 패널(관리자) 양쪽에서 공유한다. */
export const BLOCK_LABEL_FALLBACK: Record<BlockKey, string> = {
  hero: "메인", greeting: "인사말", gallery: "갤러리", sequence: "예식 순서",
  calendar: "캘린더 · D-day", location: "오시는 길", account: "마음 전하실 곳",
  contact: "연락처", rsvp: "참석 여부", share: "공유하기", guestbook: "방명록",
}

/** themes.block_manifest 한 항목 — "이 테마가 이 블럭에 대해 무엇을 지원하는가" 선언 */
export interface BlockManifestEntry {
  key: string
  label: string
  /** 블럭 제목/영문 소제목 입력란을 보여줄지. false 면 이 블럭에 편집 가능한 타이틀 마커가 없다는 뜻 */
  title: boolean
  /** 블럭 위/아래 여백 슬라이더를 보여줄지. false 면 이 블럭의 여백이 디자인상 고정이어야 한다는 뜻 */
  padding: boolean
}

/** invitations.block_order(jsonb) 를 안전한 블럭 키 배열로 정규화. 알 수 없는 키(레거시
 * 흔적 등)는 버리고, 유효한 키가 하나도 없으면 undefined를 돌려줘 호출부가 테마의 기본
 * 순서(template.html의 DOM 순서)를 그대로 쓰게 한다. share는 항상 맨 마지막에 고정되는
 * 블럭이라 여기서 걸러내지 않아도 되지만(§invitation-frame.tsx 재정렬 이펙트가 강제),
 * 순서 배열 자체에는 포함시켜 저장/복원 왕복이 정확하게 유지되도록 한다. */
export function extractBlockOrder(raw: unknown): BlockKey[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const seen = new Set<string>()
  const out: BlockKey[] = []
  for (const v of raw) {
    if (typeof v !== "string") continue
    if (!(BLOCK_KEYS as readonly string[]).includes(v)) continue
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v as BlockKey)
  }
  return out.length > 0 ? out : undefined
}

/** themes.block_manifest(jsonb) 를 안전하게 배열로 정규화 */
export function getBlockManifest(row: ThemeRow | null | undefined): BlockManifestEntry[] {
  const value = row?.block_manifest
  if (!Array.isArray(value)) return []
  return value.filter((v): v is BlockManifestEntry =>
    !!v && typeof v === "object" && typeof (v as Record<string, unknown>).key === "string"
  )
}

const nonEmptyString = z.string().min(1)
const finiteNumber = z.number().finite()

/**
 * 블럭 하나에 대한 개별 오버라이드 — customization_overrides.blocks[key].
 * 스키마 하나가 타입(BlockOverride)과 런타임 검증(extractBlockOverrides) 양쪽의
 * 단일 출처다 — 필드를 여기 하나에만 추가하면 타입과 가드가 함께 따라온다.
 */
const BlockOverrideSchema = z.object({
  /** 위/아래 여백(px). 없으면 테마 기본값 */
  py: finiteNumber,
  /** 한글 타이틀. 빈 문자열/미설정이면 템플릿 기본 텍스트를 그대로 둔다 */
  title: z.string(),
  /** 영문 소제목. 빈 문자열/미설정이면 템플릿 기본 텍스트를 그대로 둔다 */
  label: z.string(),
  /** rsvp 블럭 전용: false 면 식사 여부 질문을 숨긴다 (미설정 시 노출) */
  mealEnabled: z.boolean(),
  /** rsvp 블럭 전용: false 면 셔틀버스 이용 질문을 숨긴다 (미설정 시 노출) */
  shuttleEnabled: z.boolean(),
  /** rsvp 블럭 전용: 응답 마감일("YYYY-MM-DD"). 없으면 마감 없이 상시 접수 */
  rsvpDeadline: nonEmptyString,
  /** calendar 블럭 전용: false 면 D-day 카운트다운을 숨긴다 (미설정 시 노출) */
  ddayEnabled: z.boolean(),
  /** calendar 블럭 전용: false 면 ".ics 캘린더 앱에 추가" 버튼을 숨긴다 (미설정 시 노출) */
  icsButtonEnabled: z.boolean(),
  /** calendar 블럭 전용: false 면 "구글 캘린더" 버튼을 숨긴다 (미설정 시 노출) */
  googleCalendarButtonEnabled: z.boolean(),
  /** calendar 블럭 전용: true 면 D-day 숫자가 처음 나타날 때 0에서 실제 값까지 굴러 올라간다 (미설정 시 꺼짐) */
  ddayRollingEnabled: z.boolean(),
  /** calendar 블럭 전용: 예식일 강조 표시 모양 (미설정 시 원형) */
  calendarDayShape: z.enum(["circle", "heart", "custom"]),
  /** calendar 블럭 전용: calendarDayShape가 'custom'일 때 사용할 업로드 이미지 URL */
  calendarDayCustomShapeUrl: nonEmptyString,
  /** calendar 블럭 전용: 강조 표시 크기(px). 미설정 시 32 */
  calendarDayShapeSize: finiteNumber,
  /** calendar 블럭 전용: 강조된 날짜 숫자의 텍스트 색상(hex). 미설정 시 흰색 */
  calendarDayTextColor: nonEmptyString,
  /** calendar 블럭 전용: 업로드한 SVG 모양에 입힐 색상(hex). 미설정 시 테마 accent 색 */
  calendarDaySvgColor: nonEmptyString,
  /** calendar 블럭 전용: 달력 박스 배경색(hex). 미설정 시 CALENDAR_BOX_DEFAULT.color */
  calendarBoxColor: nonEmptyString,
  /** calendar 블럭 전용: 달력 박스 배경 불투명도(0~100). 미설정 시 CALENDAR_BOX_DEFAULT.opacity.
   *  배경에만 적용한다 — CSS opacity 로 주면 날짜 숫자까지 함께 흐려진다 */
  calendarBoxOpacity: finiteNumber,
  /** calendar 블럭 전용: 달력 그리드 아래 날짜 줄 텍스트. 미설정 시 wedding_date에서 "YYYY년 MM월 DD일"로 자동 계산 */
  calendarDateText: nonEmptyString,
  /** calendar 블럭 전용: 달력 그리드 아래 시간 줄 텍스트. 미설정 시 "요일 wedding_time"으로 자동 계산 */
  calendarTimeText: nonEmptyString,
  /** account 블럭 전용: 계좌 표시 방식. 미설정 시 기존 목록형("list") */
  accountLayout: z.enum(["list", "card"]),
  /** account 카드형 전용: 카드 배경을 무엇에서 가져올지.
   *  auto  — 그 섹션이 실제로 쓰는 글자색(currentColor)에 맞춘다. 어느 배경 위에서도 보인다.
   *  accent/bg — 테마 토큰을 따라가므로 테마를 바꿔도 어울리는 색이 유지되지만, 섹션 배경과
   *              같은 토큰이면 카드가 보이지 않는다(color-atelier 의 계좌 섹션 배경이 --accent 다).
   *  custom — accountCardBgColor 의 고정 hex.
   *  미설정 시 ACCOUNT_CARD_BG_DEFAULT.source */
  accountCardBg: z.enum(["auto", "accent", "bg", "custom"]),
  /** account 카드형 전용: accountCardBg 가 'custom' 일 때 쓸 색(hex) */
  accountCardBgColor: nonEmptyString,
  /** account 카드형 전용: 카드 배경 불투명도(0~100). 미설정 시 ACCOUNT_CARD_BG_DEFAULT.opacity */
  accountCardBgOpacity: finiteNumber,
  /** greeting 블럭 전용: 인사말 아이콘 모양 (미설정 시 하트) */
  greetingIconShape: z.enum(["heart", "custom"]),
  /** greeting 블럭 전용: greetingIconShape가 'custom'일 때 사용할 업로드 이미지 URL */
  greetingIconCustomUrl: nonEmptyString,
  /** greeting 블럭 전용: 아이콘 크기(px). 미설정 시 24 */
  greetingIconSize: finiteNumber,
  /** greeting 블럭 전용: 아이콘 색상(hex). 하트/커스텀 SVG 모두 적용. 미설정 시 테마 accent 색 */
  greetingIconColor: nonEmptyString,
}).partial()

export type BlockOverride = z.infer<typeof BlockOverrideSchema>

/** 달력 박스 배경 기본값 — 렌더러(calendar-island)와 편집기 슬라이더가 공유한다 */
export const CALENDAR_BOX_DEFAULT = { color: "#bebebe", opacity: 76 } as const

/**
 * 블럭별 배경 농담(濃淡) — customization_overrides.blockTint.
 *
 * 테마의 메인 배경색은 그대로 두고, 섹션마다 흰색/검정을 옅게 덮어 경계를 만든다.
 * 배경색을 바꾸는 게 아니라 위에 한 겹 얹는 방식이라(background-image 오버레이)
 * 테마가 어떤 색을 쓰든, 섹션이 이미지든 그라데이션이든 그대로 통한다.
 *
 *   A  덮지 않음 (테마 기본 배경)
 *   B  + #ffffff 40%
 *   C  + #000000 5%
 *
 * color-atelier 는 이미 --accent 로 섹션 배경을 교대하므로(vs-alt-a/b) 대상이 아니다.
 * 그런 테마에서는 편집기가 이 설정을 아예 보여주지 않는다 — 겹쳐 칠하면 의도한
 * 교대가 뭉개지고, 무엇보다 효과 없는 컨트롤은 버그로 읽힌다.
 */
/**
 * 각 단계가 덮을 색. 농도는 관리자가 조절하고 색은 고정한다 — 색까지 열면 "블럭별
 * 배경 농담"이 아니라 섹션마다 배경색을 따로 칠하는 기능이 되고, 그건 테마가 할 일이다.
 *
 * A 도 흰색을 쓰되 기본 농도가 0 이라 아무것도 덮지 않는다(= 테마 기본 배경 그대로).
 * 0 일 때는 오버레이 자체를 얹지 않아 흔적이 남지 않는다.
 */
export const BLOCK_TINT_STEP_COLORS = { A: "255,255,255", B: "255,255,255", C: "0,0,0" } as const

export type BlockTintStep = keyof typeof BLOCK_TINT_STEP_COLORS

export const BLOCK_TINT_DEFAULT_OPACITY: Record<BlockTintStep, number> = { A: 0, B: 40, C: 5 }

export const BLOCK_TINT_STEP_LABELS: Record<BlockTintStep, string> = {
  A: "A · 기본 배경",
  B: "B · 밝게",
  C: "C · 어둡게",
}

export const BLOCK_TINT_PATTERNS: { value: string; label: string; steps: BlockTintStep[] }[] = [
  { value: "none", label: "기본 배경색 (통일)", steps: ["A"] },
  { value: "abac", label: "A-B-A-C 반복", steps: ["A", "B", "A", "C"] },
  { value: "abab", label: "A-B-A-B 반복", steps: ["A", "B", "A", "B"] },
  { value: "acac", label: "A-C-A-C 반복", steps: ["A", "C", "A", "C"] },
]

/** customization_overrides.blockTint 를 안전하게 읽는다 (모르는 값은 'none') */
export function extractBlockTint(overrides: unknown): string {
  if (!overrides || typeof overrides !== "object") return "none"
  const v = (overrides as Record<string, unknown>).blockTint
  return typeof v === "string" && BLOCK_TINT_PATTERNS.some((p) => p.value === v) ? v : "none"
}

/** customization_overrides.blockTintOpacity 를 안전하게 읽는다 (없거나 범위를 벗어나면 기본값) */
export function extractBlockTintOpacity(overrides: unknown): Record<BlockTintStep, number> {
  const out = { ...BLOCK_TINT_DEFAULT_OPACITY }
  const raw = (overrides && typeof overrides === "object")
    ? (overrides as Record<string, unknown>).blockTintOpacity
    : null
  if (raw && typeof raw === "object") {
    for (const step of Object.keys(out) as BlockTintStep[]) {
      const v = (raw as Record<string, unknown>)[step]
      if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100) out[step] = v
    }
  }
  return out
}

/** 패턴 이름 → 보이는 섹션 순서대로 적용할 오버레이 목록 (null 이면 덮지 않음) */
export function blockTintOverlays(
  pattern: string,
  opacity: Record<BlockTintStep, number> = BLOCK_TINT_DEFAULT_OPACITY,
): (string | null)[] {
  const found = BLOCK_TINT_PATTERNS.find((p) => p.value === pattern) ?? BLOCK_TINT_PATTERNS[0]
  return found.steps.map((step) => {
    const pct = Math.min(100, Math.max(0, opacity[step] ?? BLOCK_TINT_DEFAULT_OPACITY[step]))
    if (pct <= 0) return null
    const rgb = BLOCK_TINT_STEP_COLORS[step]
    const a = (pct / 100).toFixed(3)
    return `linear-gradient(rgba(${rgb},${a}), rgba(${rgb},${a}))`
  })
}

/** 계좌 카드 배경 기본값 — 렌더러(account-island)와 편집기가 공유한다 */
export const ACCOUNT_CARD_BG_DEFAULT = { source: "auto", color: "#bebebe", opacity: 12 } as const

/**
 * customization_overrides(jsonb) 에서 blocks(블럭별 오버라이드 맵)를 추출한다.
 * 필드 단위로 개별 검증한다(객체 전체를 한 번에 parse하지 않음) — 한 필드가
 * 깨져 있어도 나머지 정상 필드는 그대로 살리는 기존 관용 동작을 유지하기 위함.
 * disabled_slots/'--' 토큰과 같은 customization_overrides 컬럼을 공유하되 별도 키라 서로 간섭하지 않는다.
 */
export function extractBlockOverrides(overrides: unknown): Record<string, BlockOverride> {
  const out: Record<string, BlockOverride> = {}
  if (!overrides || typeof overrides !== "object") return out
  const blocks = (overrides as Record<string, unknown>).blocks
  if (!blocks || typeof blocks !== "object") return out
  const fieldSchemas = BlockOverrideSchema.shape
  for (const [key, raw] of Object.entries(blocks as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue
    const r = raw as Record<string, unknown>
    const entry: Record<string, unknown> = {}
    for (const field of Object.keys(fieldSchemas) as (keyof typeof fieldSchemas)[]) {
      if (r[field] === undefined) continue
      const parsed = fieldSchemas[field].safeParse(r[field])
      if (parsed.success) entry[field] = parsed.data
    }
    if (Object.keys(entry).length > 0) out[key] = entry as BlockOverride
  }
  return out
}

/**
 * 섹션(블럭) 사이에 끼워 넣는 이미지 — customization_overrides.sectionImages.
 * 배열 순서가 렌더 순서다. 같은 afterBlock 을 가리키는 항목이 여러 개면 배열 순서대로
 * 연속 배치된다. 삭제 후 재업로드 없이 afterBlock 드롭다운만 바꾸면 위치를 옮길 수 있고,
 * 배열 순서는 위/아래 버튼으로 바꾼다 (편집기 UI, §customize-client.tsx).
 */
const SectionImageSchema = z.object({
  /** 클라이언트에서 생성하는 안정적인 key (React key 및 DOM 매칭용) */
  id: z.string(),
  url: nonEmptyString,
  /** 이 블럭 키의 섹션 바로 뒤에 삽입된다 */
  afterBlock: z.string(),
  caption: z.string().optional(),
})

export type SectionImage = z.infer<typeof SectionImageSchema>

/** customization_overrides.sectionImages 를 안전하게 SectionImage[] 로 정규화 */
export function extractSectionImages(overrides: unknown): SectionImage[] {
  if (!overrides || typeof overrides !== "object") return []
  const raw = (overrides as Record<string, unknown>).sectionImages
  if (!Array.isArray(raw)) return []
  const out: SectionImage[] = []
  for (const item of raw) {
    const parsed = SectionImageSchema.safeParse(item)
    if (!parsed.success) continue
    // 빈 문자열 caption은 "설정 안 함"과 동일하게 취급한다(기존 관용 동작 유지).
    out.push(parsed.data.caption ? parsed.data : { ...parsed.data, caption: undefined })
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
/**
 * customization_overrides(jsonb)에서 introEnabled(오프닝 인트로 연출 여부)를 추출한다.
 * 다른 boolean 최상위 키(scrollMotion 등)와 마찬가지로 별도 키를 써서 서로 간섭하지 않는다.
 * 기본값은 false — 취향이 크게 갈리는 연출이라 담당자가 의식적으로 켜야 한다.
 */
export function extractIntroEnabled(overrides: unknown): boolean {
  if (!overrides || typeof overrides !== "object") return false
  return (overrides as Record<string, unknown>).introEnabled === true
}

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
