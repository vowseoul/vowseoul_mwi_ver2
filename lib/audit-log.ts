import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * 청첩장 단위 변경 이력 기록. 관리자 화면은 브라우저 세션(authenticated)으로 직접
 * 쓰고, 고객 쪽(셀프 편집·검수)은 서버 API 라우트가 service_role로 대신 쓴다 — 둘 다
 * 같은 audit_logs RLS 정책(authenticated 전체 허용, service_role은 우회) 아래에서
 * 동작하므로 클라이언트 종류를 가리지 않는 시그니처로 둔다.
 *
 * 실패해도 원래 하려던 작업(저장/처리 등)을 막지 않는다 — 로그가 부가 기능이지
 * 핵심 흐름의 필수 조건이 되면 안 된다.
 */
export async function logAuditEvent(
  client: SupabaseClient,
  opts: {
    invitationId: string
    actorType: "admin" | "customer" | "system"
    actorLabel?: string | null
    action: string
    summary: string
  }
) {
  const { error } = await client.from("audit_logs").insert({
    invitation_id: opts.invitationId,
    actor_type: opts.actorType,
    actor_label: opts.actorLabel ?? null,
    action: opts.action,
    summary: opts.summary,
  })
  if (error) console.error("audit log insert failed:", error.message)
}
