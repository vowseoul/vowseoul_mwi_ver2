import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AuditLog {
  id: string
  invitation_id: string
  actor_type: 'admin' | 'customer' | 'system'
  actor_label: string | null
  action: string
  summary: string
  created_at: string
}

/** 편집기 "이력" 탭용 — 최근 50건 */
export function useAuditLogsQuery(invitationId: string) {
  return useQuery({
    queryKey: ['audit-logs', invitationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('invitation_id', invitationId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data as AuditLog[]) || []
    },
    enabled: !!invitationId,
  })
}
