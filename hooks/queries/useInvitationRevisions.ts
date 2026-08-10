import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logAuditEvent } from '@/lib/audit-log'

export interface InvitationRevision {
  id: string
  invitation_id: string
  round: number
  block_key: string | null
  note: string
  status: 'open' | 'resolved'
  resolved_by: string | null
  created_at: string
  resolved_at: string | null
}

export function useInvitationRevisionsQuery(invitationId: string) {
  return useQuery({
    queryKey: ['invitation-revisions', invitationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitation_revisions')
        .select('*')
        .eq('invitation_id', invitationId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as InvitationRevision[]) || []
    },
    enabled: !!invitationId,
  })
}

export function useResolveRevisionMutation(invitationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('invitation_revisions')
        .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: userData.user?.id ?? null })
        .eq('id', id)
      if (error) throw error
      logAuditEvent(supabase, {
        invitationId,
        actorType: 'admin',
        actorLabel: userData.user?.email ?? null,
        action: 'revision.resolved',
        summary: '고객의 수정 요청을 처리 완료로 표시했습니다.',
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitation-revisions', invitationId] }),
  })
}
