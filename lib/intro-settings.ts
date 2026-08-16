/**
 * 청첩장 열기 연출(오프닝 인트로) 설정.
 *
 * 저장 위치는 scrollMotion·blocks·sectionImages와 동일하게 invitations.customization_overrides(jsonb)를
 * 공유하되 'intro' 라는 별도 키를 쓴다.
 *
 * 이전에는 같은 컬럼의 `introEnabled` boolean 하나만 있었고 내용은 "신랑 & 신부" 이름으로 고정이었다.
 * 이 모듈은 그 레거시 값을 그대로 읽어 들여(enabled 로 승격) 기존 청첩장이 설정을 잃지 않게 한다 —
 * 마이그레이션 없이 읽는 쪽에서 흡수하는 방식(§extractIntroSettings).
 */

export const INTRO_MODES = [
  { value: "names", label: "신랑·신부 이름", description: "입력된 이름을 그대로 보여줍니다." },
  { value: "text", label: "직접 입력", description: "원하는 문구를 직접 적습니다." },
  { value: "image", label: "이미지", description: "업로드한 이미지 한 장을 보여줍니다." },
] as const

export type IntroMode = (typeof INTRO_MODES)[number]["value"]

export const INTRO_ALIGNS = [
  { value: "left", label: "왼쪽" },
  { value: "center", label: "가운데" },
  { value: "right", label: "오른쪽" },
] as const

export type IntroAlign = (typeof INTRO_ALIGNS)[number]["value"]

export interface IntroSettings {
  enabled: boolean
  mode: IntroMode
  /** mode === "text" 일 때 보여줄 문구. 줄바꿈을 그대로 유지한다. */
  text: string
  /** mode === "image" 일 때 보여줄 이미지 URL (§lib/image-upload.ts 로 업로드된 것) */
  imageUrl: string
  /** 빈 문자열이면 테마의 한글 폰트(--font-kr)를 그대로 쓴다. 그 외에는 font-family 스택 문자열 */
  fontFamily: string
  /** px. names/text 모드에만 적용된다 */
  fontSize: number
  align: IntroAlign
}

export const DEFAULT_INTRO_SETTINGS: IntroSettings = {
  enabled: false,
  mode: "names",
  text: "",
  imageUrl: "",
  fontFamily: "",
  fontSize: 22,
  align: "center",
}

/** 너무 작아 안 보이거나 화면을 넘길 만큼 큰 값이 저장되지 않도록 잡아두는 범위 */
export const INTRO_FONT_SIZE_MIN = 12
export const INTRO_FONT_SIZE_MAX = 80

const MODE_VALUES: string[] = INTRO_MODES.map((m) => m.value)
const ALIGN_VALUES: string[] = INTRO_ALIGNS.map((a) => a.value)

function clampFontSize(value: number): number {
  return Math.min(INTRO_FONT_SIZE_MAX, Math.max(INTRO_FONT_SIZE_MIN, Math.round(value)))
}

/**
 * customization_overrides(jsonb)에서 인트로 설정을 안전하게 추출한다.
 * 알 수 없는 값은 기본값으로 되돌리고, 신규 키(intro)가 없으면 레거시 introEnabled 를 읽는다.
 */
export function extractIntroSettings(overrides: unknown): IntroSettings {
  if (!overrides || typeof overrides !== "object") return { ...DEFAULT_INTRO_SETTINGS }
  const root = overrides as Record<string, unknown>

  const raw = root.intro
  if (!raw || typeof raw !== "object") {
    // 레거시: intro 키가 아직 없는 청첩장은 introEnabled 만 승계하고 나머지는 기본값
    return { ...DEFAULT_INTRO_SETTINGS, enabled: root.introEnabled === true }
  }

  const r = raw as Record<string, unknown>
  return {
    // intro.enabled 가 명시돼 있지 않으면 레거시 introEnabled 로 폴백한다
    enabled: typeof r.enabled === "boolean" ? r.enabled : root.introEnabled === true,
    mode: typeof r.mode === "string" && MODE_VALUES.includes(r.mode) ? (r.mode as IntroMode) : DEFAULT_INTRO_SETTINGS.mode,
    text: typeof r.text === "string" ? r.text : DEFAULT_INTRO_SETTINGS.text,
    imageUrl: typeof r.imageUrl === "string" ? r.imageUrl : DEFAULT_INTRO_SETTINGS.imageUrl,
    fontFamily: typeof r.fontFamily === "string" ? r.fontFamily : DEFAULT_INTRO_SETTINGS.fontFamily,
    fontSize: typeof r.fontSize === "number" && Number.isFinite(r.fontSize) ? clampFontSize(r.fontSize) : DEFAULT_INTRO_SETTINGS.fontSize,
    align: typeof r.align === "string" && ALIGN_VALUES.includes(r.align) ? (r.align as IntroAlign) : DEFAULT_INTRO_SETTINGS.align,
  }
}

/** 클라이언트가 보낸 값이 유효한 IntroSettings 형태인지 검증 (self-edit API 화이트리스트용) */
export function isValidIntroSettings(value: unknown): value is IntroSettings {
  if (!value || typeof value !== "object") return false
  const r = value as Record<string, unknown>
  return (
    typeof r.enabled === "boolean" &&
    typeof r.mode === "string" && MODE_VALUES.includes(r.mode) &&
    typeof r.text === "string" &&
    typeof r.imageUrl === "string" &&
    typeof r.fontFamily === "string" &&
    typeof r.fontSize === "number" && Number.isFinite(r.fontSize) &&
    typeof r.align === "string" && ALIGN_VALUES.includes(r.align)
  )
}

/**
 * 인트로가 실제로 보여줄 내용이 있는지 — 켜져 있어도 보여줄 게 없으면(이미지 미업로드,
 * 문구 미입력, 이름 미입력) 오버레이를 아예 띄우지 않는다.
 */
export function hasIntroContent(intro: IntroSettings, groomName: string, brideName: string): boolean {
  if (!intro.enabled) return false
  if (intro.mode === "image") return !!intro.imageUrl
  if (intro.mode === "text") return !!intro.text.trim()
  return !!(groomName || brideName)
}
