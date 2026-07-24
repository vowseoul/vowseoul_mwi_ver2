import type { ThemeTemplate, TokenMap } from "@/components/invitation/invitation-frame"

/**
 * DB(themes 행) ↔ 렌더러(InvitationFrame) 사이의 브릿지.
 *
 * themes 테이블에 저장된 template_html / template_css / slot_manifest 를
 * InvitationFrame 이 요구하는 ThemeTemplate 형태로 변환한다.
 * render_engine 플래그로 신/구 렌더러를 구분한다.
 *
 * 관련 마이그레이션: theme_template_schema.sql
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

/** customization_overrides(jsonb) 에서 '--' CSS 변수만 추출 */
export function extractOverrideTokens(overrides: unknown): TokenMap {
  const tokens: TokenMap = {}
  if (overrides && typeof overrides === "object") {
    for (const [k, v] of Object.entries(overrides as Record<string, unknown>)) {
      if (k.startsWith("--") && typeof v === "string" && v) tokens[k] = v
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
