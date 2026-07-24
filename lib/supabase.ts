import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Check if the current browser window is on a public page to avoid lock acquisition conflicts (Web Locks API error)
const isPublicPage = typeof window !== 'undefined' && (
  window.location.pathname.startsWith('/invitation/') ||
  window.location.pathname.startsWith('/preview/') ||
  window.location.pathname.startsWith('/w/') ||
  window.location.pathname.startsWith('/dashboard/')
)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
