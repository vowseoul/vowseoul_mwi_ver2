import type { SupabaseClient } from "@supabase/supabase-js"

const PURGE_TABLES = ["rsvp_responses", "guestbook_entries", "visit_logs", "visit_daily_stats"] as const

export type GuestDataPurgeCounts = Record<(typeof PURGE_TABLES)[number], number>

/**
 * 하객 RSVP·방명록·방문로그(원본+집계) 하드 삭제. 이미 비어 있어도 안전(멱등) —
 * 매일 도는 크론(§app/api/cron/purge-expired-invitations)이 예식일+14일이 지난
 * 모든 청첩장에 매번 호출해도 문제없다.
 *
 * app/invitation/[id]/dashboard/page.tsx도 이 함수를 그대로 쓴다 — 크론이
 * 주기적으로 지워주지만, 신랑신부가 대시보드에 먼저 들어오는 경우를 위한
 * 안전망(이중화)으로 남겨둔다.
 *
 * 되돌릴 수 없는 삭제인데 지금까지 아무 흔적도 남지 않아서, 나중에 "하객 명단이
 * 왜 없어졌는지" 확인할 방법이 없었다. 표별 삭제 건수를 돌려주고, 호출부가 그걸
 * audit_logs 에 남긴다(§lib/audit-log.ts). count: 'exact' 는 삭제된 행을 실제로
 * 내려받지 않고 개수만 받아오므로 visit_logs 가 수천 건이어도 부담이 없다.
 */
export async function purgeGuestData(
  supabase: SupabaseClient,
  invitationId: string,
): Promise<GuestDataPurgeCounts> {
  const counts = {} as GuestDataPurgeCounts
  for (const table of PURGE_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq("invitation_id", invitationId)
    if (error) console.error(`purgeGuestData: ${table} 삭제 실패 (${invitationId}):`, error.message)
    counts[table] = count ?? 0
  }
  return counts
}

/** 감사 로그 문구용 — "RSVP 12건, 방명록 3건, 방문로그 480건" (0건인 표는 생략) */
export function describePurgeCounts(counts: GuestDataPurgeCounts): string {
  const parts: string[] = []
  if (counts.rsvp_responses > 0) parts.push(`RSVP ${counts.rsvp_responses}건`)
  if (counts.guestbook_entries > 0) parts.push(`방명록 ${counts.guestbook_entries}건`)
  if (counts.visit_logs > 0) parts.push(`방문로그 ${counts.visit_logs}건`)
  if (counts.visit_daily_stats > 0) parts.push(`방문집계 ${counts.visit_daily_stats}건`)
  return parts.length > 0 ? parts.join(", ") : "삭제 대상 없음"
}
