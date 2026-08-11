import { supabase } from "@/lib/supabase"
import type { TokenMap } from "@/components/invitation/invitation-frame"

/**
 * 에셋 관리(app/admin/(dashboard)/assets)에서 등록한 커스텀 폰트.
 * settings 테이블의 key='fonts' 행(value: RegisteredFont[])에 저장된다.
 */
export interface RegisteredFont {
  id: string
  name: string
  family: string
  type: "embed" | "file"
  embedCode?: string
  fileUrl?: string
}

/** 등록된 커스텀 폰트 목록을 가져온다. */
export async function fetchRegisteredFonts(): Promise<RegisteredFont[]> {
  const { data } = await supabase.from("settings").select("value").eq("key", "fonts").maybeSingle()
  const value = (data as { value?: unknown } | null)?.value
  return Array.isArray(value) ? (value as RegisteredFont[]) : []
}

/** font-family CSS 스택 문자열에서 맨 앞 폰트명만 뽑는다 (따옴표 제거) */
function firstFontName(stack: string): string {
  const first = stack.split(",")[0]?.trim() ?? ""
  return first.replace(/^['"]|['"]$/g, "")
}

/**
 * 구글 폰트 @import 임베드 코드에서 실제로 로드되는 font-family 이름을 추출한다.
 * (예: "...family=Nanum+Myeongjo&display=swap" → "Nanum Myeongjo")
 * 등록 폰트의 family 필드가 이 값과 다르면, --font-kr 등에 그 family를 넣어도 브라우저가
 * 로드된 폰트를 찾지 못해 조용히 fallback으로 렌더된다 — "선택해도 적용 안 되는" 버그의 원인.
 */
export function extractGoogleFontFamily(embedCode: string): string | null {
  const match = embedCode.match(/family=([^&:'"]+)/)
  if (!match) return null
  return decodeURIComponent(match[1].replace(/\+/g, " "))
}

/** 등록 폰트를 --font-kr/--font-en 토큰에 넣을 CSS font-family 스택 문자열로 변환 */
export function buildFontStack(font: RegisteredFont, tokenName: string): string {
  const fallback = tokenName === "--font-en" ? "sans-serif" : "serif"
  return `'${font.family}', ${fallback}`
}

/**
 * 업로드된 TTF/WOFF 파일로 @font-face 규칙을 만든다.
 * Supabase Storage 공개 URL은 앱과 다른 오리진이라 폰트 파일 요청이 CORS 대상이 되고,
 * 업로드 시 Content-Type이 정확히 세팅되지 않으면 일부 브라우저가 파싱을 거부한다.
 * /api/fonts 프록시를 거쳐 헤더를 정규화하고(app/api/fonts/route.ts), 확장자로 format() 힌트를 붙인다.
 * (원래 invitation-frame.tsx 안에만 있던 걸 여기로 옮겨 에셋 관리·편집기 폰트 미리보기에서도 재사용한다.)
 */
export function buildFontFaceRule(family: string, fileUrl: string): string {
  const proxiedUrl = `/api/fonts?url=${encodeURIComponent(fileUrl)}`
  const lower = fileUrl.toLowerCase()
  let format = ""
  if (lower.includes(".woff2")) format = " format('woff2')"
  else if (lower.includes(".woff")) format = " format('woff')"
  else if (lower.includes(".otf")) format = " format('opentype')"
  else if (lower.includes(".ttf")) format = " format('truetype')"
  return `@font-face { font-family: '${family}'; src: url('${proxiedUrl}')${format}; font-display: swap; }`
}

/** 업로드된 폰트 파일의 확장자로 에셋 관리 목록에 보여줄 형식 배지 라벨을 만든다 */
export function fontFileFormatLabel(fileUrl?: string): string {
  const lower = (fileUrl || "").toLowerCase()
  if (lower.includes(".woff2")) return "WOFF2 파일"
  if (lower.includes(".woff")) return "WOFF 파일"
  if (lower.includes(".otf")) return "OTF 파일"
  if (lower.includes(".ttf")) return "TTF 파일"
  return "폰트 파일"
}

/** 등록 폰트 하나를 실제 로드하는 CSS(임베드 코드 또는 @font-face)로 변환 */
export function buildFontFaceCss(font: RegisteredFont): string {
  if (font.embedCode) return font.embedCode
  if (font.fileUrl) return buildFontFaceRule(font.family, font.fileUrl)
  return ""
}

/**
 * 여러 폰트의 CSS 조각을 하나의 스타일시트로 합친다.
 * @import 는 CSS 스펙상 스타일시트 맨 앞(다른 규칙보다 먼저)에 와야만 유효하다.
 * 관리자가 "임베드 코드(@import)" 폰트와 "파일 업로드(@font-face)" 폰트를 섞어 등록하면,
 * 원래 등록 순서대로 이어붙일 때 @font-face 가 @import 보다 앞에 오는 경우가 생겨
 * 뒤따르는 @import 전체가 브라우저에서 조용히 무시된다 — 등록은 됐는데 그 폰트만
 * 적용 안 되는 버그로 나타난다. @import 조각을 항상 먼저 배치해 이를 막는다.
 */
export function joinFontFaceCss(cssList: string[]): string {
  const imports = cssList.filter((css) => css.trimStart().startsWith("@import"))
  const rest = cssList.filter((css) => !css.trimStart().startsWith("@import"))
  return [...imports, ...rest].join("\n")
}

/** 목록/드롭다운에서 폰트 이름을 그 폰트로 미리 보여줄 때 쓰는 인라인 스타일 */
export function fontPreviewStyle(font: RegisteredFont): { fontFamily: string } {
  return { fontFamily: `'${font.family}', sans-serif` }
}

/**
 * 최종 토큰(--font-kr/--font-en)이 등록된 커스텀 폰트를 가리키면
 * 그 로딩 정보(embed 코드 또는 TTF 파일 URL)를 뽑아 InvitationFrame 에 전달할 형태로 만든다.
 * iframe 안에는 이 정보가 없으면 폰트 자체가 로드되지 않아 브라우저 기본 글꼴로 표시된다.
 */
export function resolveFontFaces(
  tokens: TokenMap,
  fonts: RegisteredFont[]
): { family: string; embedCode?: string; fileUrl?: string }[] {
  const wanted = new Set<string>()
  for (const key of ["--font-kr", "--font-en"]) {
    const v = tokens[key]
    if (typeof v === "string" && v) wanted.add(firstFontName(v))
  }
  if (wanted.size === 0) return []

  const out: { family: string; embedCode?: string; fileUrl?: string }[] = []
  const seen = new Set<string>()
  for (const font of fonts) {
    if (wanted.has(font.family) && !seen.has(font.family)) {
      seen.add(font.family)
      out.push({ family: font.family, embedCode: font.embedCode, fileUrl: font.fileUrl })
    }
  }
  return out
}
