import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Check if the current browser window is on a public page to avoid lock acquisition conflicts (Web Locks API error)
const isPublicPage = typeof window !== 'undefined' && (
  window.location.pathname.startsWith('/invitation/') ||
  window.location.pathname.startsWith('/preview/') ||
  window.location.pathname.startsWith('/w/') ||
  window.location.pathname.startsWith('/dashboard/')
)

/**
 * 쿠키 기반 세션 저장소(createBrowserClient)를 쓴다 — proxy.ts(서버)가 같은
 * 쿠키를 읽어 세션을 검증할 수 있어야 하기 때문. 이전의 createClient(로컬스토리지
 * 저장)는 서버에서 읽을 수 없어 미들웨어가 쿠키 유무만 확인하는 데 그쳤었다.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: !isPublicPage,
    autoRefreshToken: !isPublicPage,
    detectSessionInUrl: !isPublicPage,
  }
})

/**
 * supabase-js 는 실패 시 throw 하지 않고 { data: null, error } 를 반환한다.
 * `const { data } = await supabase...` 형태로 error 를 안 받으면 테이블 누락 등의
 * 실패가 조용히 "빈 값"으로 흘러간다 — 최소한 콘솔에 남기기 위한 헬퍼.
 */
export function logSupabaseError(context: string, error: { message: string; details?: string | null } | null) {
  if (error) console.error(`[supabase] ${context}:`, error.message, error.details || '')
}
