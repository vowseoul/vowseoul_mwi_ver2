import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * 주문(결제/제작 이행 기록) — 고객 상세 페이지에 통합된 이후로는 독립된 관리 화면이
 * 없다. customers 1건에 orders 는 스키마상 여러 건 가능하지만(§ 복사 기능), 고객
 * 상세 페이지는 항상 가장 최근 1건만 보여준다 — 예전 주문은 /admin/invitations
 * 목록에서 해당 청첩장을 통해 계속 접근 가능하다.
 */
export interface Order {
  id: string
  customer_id: string | null
  invitation_id: string | null
  product_type: 'mobile' | 'offline' | 'both'
  external_order_ref: string | null
  amount: number
  status: 'registered' | 'form_sent' | 'form_completed' | 'in_production' | 'design_review' | 'published' | 'delivered'
  notes: string | null
  created_at: string
  updated_at: string
}

export function useCustomerOrderQuery(customerId: string) {
  return useQuery({
    queryKey: ['customer-order', customerId],
    queryFn: async () => {
      if (!customerId) return null
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) return null
      return (data?.[0] as Order) ?? null
    },
    enabled: !!customerId,
  })
}

// 고객에게 아직 주문 레코드가 없을 때(신규 고객 관리 플로우로만 생성된 경우) 결제/메모
// 추적을 시작할 수 있도록 빈 주문 1건을 만든다.
export function useCreateOrderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ customerId, invitationId }: { customerId: string; invitationId: string | null }) => {
      const { data, error } = await supabase
        .from('orders')
        .insert({
          customer_id: customerId,
          invitation_id: invitationId,
          product_type: 'mobile',
          amount: 0,
          status: 'registered',
          notes: '',
        })
        .select()
        .single()

      if (error) throw error
      return data as Order
    },
    onSuccess: (data) => {
      if (data?.customer_id) queryClient.invalidateQueries({ queryKey: ['customer-order', data.customer_id] })
    },
  })
}

export function useSaveOrderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      orderId,
      updates,
    }: {
      orderId: string
      updates: Partial<Pick<Order, 'amount' | 'status' | 'notes'>>
    }) => {
      const { data, error } = await supabase.from('orders').update(updates).eq('id', orderId).select().single()
      if (error) throw error
      return data as Order
    },
    onSuccess: (data) => {
      if (data?.customer_id) queryClient.invalidateQueries({ queryKey: ['customer-order', data.customer_id] })
    },
  })
}

// 현재 주문+청첩장을 새 초안으로 복사한다(같은 고객에 두 번째 주문/청첩장이 생긴다).
// 원본은 사라지지 않고 /admin/invitations 목록에 그대로 남는다.
export function useDuplicateOrderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ order }: { order: Order }) => {
      if (!order.invitation_id) throw new Error('연결된 청첩장이 없어 복사할 수 없습니다.')

      const { data: invitation, error: inviteFetchError } = await supabase
        .from('invitations')
        .select('*')
        .eq('id', order.invitation_id)
        .single()
      if (inviteFetchError) throw inviteFetchError
      if (!invitation) throw new Error('청첩장을 찾을 수 없습니다.')

      const suffix = Date.now().toString(36)
      const newInvitation = {
        ...invitation,
        id: undefined,
        public_slug: `${invitation.public_slug}-copy-${suffix}`,
        dashboard_slug: `${invitation.dashboard_slug}-copy-${suffix}`,
        status: 'draft',
        published_at: null,
      }
      const { data: newInviteRow, error: inviteInsertError } = await supabase
        .from('invitations')
        .insert(newInvitation)
        .select('id')
        .single()
      if (inviteInsertError) throw inviteInsertError

      const { error: orderInsertError } = await supabase.from('orders').insert({
        customer_id: order.customer_id,
        invitation_id: newInviteRow.id,
        product_type: order.product_type,
        amount: order.amount,
        status: 'registered',
        notes: order.notes,
      })
      if (orderInsertError) throw orderInsertError

      return newInviteRow.id as string
    },
    onSuccess: (_data, variables) => {
      if (variables.order.customer_id) {
        queryClient.invalidateQueries({ queryKey: ['customer-order', variables.order.customer_id] })
        queryClient.invalidateQueries({ queryKey: ['customer-invitation', variables.order.customer_id] })
      }
    },
  })
}

export function useDeleteOrderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ orderId, invitationId, customerId }: { orderId: string; invitationId: string | null; customerId: string | null }) => {
      const { error: orderError } = await supabase.from('orders').delete().eq('id', orderId)
      if (orderError) throw orderError

      if (invitationId) {
        const { error: inviteError } = await supabase.from('invitations').delete().eq('id', invitationId)
        if (inviteError) throw inviteError
      }
      return { customerId }
    },
    onSuccess: (data) => {
      if (data.customerId) {
        queryClient.invalidateQueries({ queryKey: ['customer-order', data.customerId] })
        queryClient.invalidateQueries({ queryKey: ['customer-invitation', data.customerId] })
      }
    },
  })
}
