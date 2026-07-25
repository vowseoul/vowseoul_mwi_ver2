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

/** 등록 폰트를 --font-kr/--font-en 토큰에 넣을 CSS font-family 스택 문자열로 변환 */
export function buildFontStack(font: RegisteredFont, tokenName: string): string {
  const fallback = tokenName === "--font-en" ? "sans-serif" : "serif"
  return `'${font.family}', ${fallback}`
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
