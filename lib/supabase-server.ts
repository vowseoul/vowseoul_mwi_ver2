import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * Server Component / Route Handler 에서 쓰는 Supabase 클라이언트.
 * lib/supabase.ts(브라우저용, createBrowserClient)와 짝을 이루며 같은
 * 쿠키에서 세션을 읽는다 — proxy.ts 의 세션 검증도 이 패턴을 따른다.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Component 에서 호출되면 쿠키를 쓸 수 없다 — proxy.ts 가 세션 갱신을
          // 담당하므로 여기서는 무시해도 된다.
        }
      },
    },
  })
}
