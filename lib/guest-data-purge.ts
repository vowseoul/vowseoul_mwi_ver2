import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * 하객 RSVP·방명록·방문로그(원본+집계) 하드 삭제. 이미 비어 있어도 안전(멱등) —
 * 매일 도는 크론(§app/api/cron/purge-expired-invitations)이 예식일+14일이 지난
 * 모든 청첩장에 매번 호출해도 문제없다.
 *
 * app/invitation/[id]/dashboard/page.tsx도 이 함수를 그대로 쓴다 — 크론이
 * 주기적으로 지워주지만, 신랑신부가 대시보드에 먼저 들어오는 경우를 위한
 * 안전망(이중화)으로 남겨둔다.
 */
export async function purgeGuestData(supabase: SupabaseClient, invitationId: string): Promise<void> {
  for (const table of ["rsvp_responses", "guestbook_entries", "visit_logs", "visit_daily_stats"] as const) {
    const { error } = await supabase.from(table).delete().eq("invitation_id", invitationId)
    if (error) console.error(`purgeGuestData: ${table} 삭제 실패 (${invitationId}):`, error.message)
  }
}
