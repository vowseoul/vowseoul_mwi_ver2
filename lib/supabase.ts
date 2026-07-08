import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Check if the current browser window is on a public page to avoid lock acquisition conflicts (Web Locks API error)
const isPublicPage = typeof window !== 'undefined' && (
  window.location.pathname.startsWith('/invitation/') ||
  window.location.pathname.startsWith('/preview/')
)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: !isPublicPage,
    autoRefreshToken: !isPublicPage,
    detectSessionInUrl: !isPublicPage,
  }
})
