import { createSupabaseServerClient } from "@/lib/supabase-server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"

/**
 * 직원이 함께 쓰는 설정값을 서버에서 대신 읽고 쓴다.
 *
 * settings 쓰기는 RLS 상 운영자(ADMIN)만 되지만, 도구(모바일감사장 배경·문구 등)는 직원
 * 누구나 쓴다. 그래서 브라우저가 직접 쓰지 않고 API 라우트가 직원 확인을 거쳐 service_role
 * 로 대신 쓴다(§app/api/admin/qr-link 와 같은 방식).
 */

/** 로그인한 사용자가 등록된 직원(profiles.role 있음)인가 */
export async function requireStaff(): Promise<boolean> {
  const session = await createSupabaseServerClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return false
  const { data: profile } = await createSupabaseAdminClient()
    .from("profiles").select("role").eq("id", user.id).maybeSingle()
  return !!profile?.role
}

export async function readSetting(key: string): Promise<unknown> {
  const { data } = await createSupabaseAdminClient().from("settings").select("value").eq("key", key).maybeSingle()
  return (data as { value?: unknown } | null)?.value
}

export async function writeSetting(key: string, value: unknown): Promise<void> {
  const { error } = await createSupabaseAdminClient().from("settings").upsert({ key, value })
  if (error) throw error
}
