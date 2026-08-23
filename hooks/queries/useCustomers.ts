import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { FORM_INSTANCE_COLUMNS } from '@/hooks/queries/useForms'

export interface Customer {
  id: string
  created_by: string | null
  assigned_to: string | null
  groom_name: string
  bride_name: string
  phone: string | null
  /** 주문 접수 시점엔 모르는 경우가 많아 비어 있을 수 있다 — 고객이 폼에 입력하면 채워진다 */
  wedding_date: string | null
  venue_name: string
  venue_address: string
  venue_coordinates: any
  transportation_info: string | null
  status: 'registered' | 'form_sent' | 'form_completed' | 'draft' | 'published' | 'expired'
  /**
   * 내부 테스트용 고객 표시. 직접 켜는 값이 아니라 주문의 제작 진행 상태를 '샘플/테스트'로
   * 두면 DB 트리거가 채워준다(§supabase/migrations/20260816000000_sample_customer_flag.sql).
   * 고객 목록·통계가 orders 를 조인하지 않아서 여기에 비정규화해 둔 사본이다.
   */
  is_sample: boolean
  memo: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface CustomerFilters {
  search?: string
  status?: string
  assignedTo?: string
  startDate?: string
  endDate?: string
  /** 샘플/테스트 고객 취급. 기본은 'exclude' — 목록·집계 어디서도 섞이면 안 된다 */
  sampleMode?: 'exclude' | 'only'
}

// 1. Fetch all customers (excluding soft-deleted ones)
export function useCustomersQuery(filters: CustomerFilters = {}, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['customers', filters, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)

      // 샘플/테스트 고객은 기본 뷰에서 뺀다. count 도 같은 쿼리에서 나오므로
      // 상단 "총 고객 수" 카드가 자동으로 함께 보정된다.
      query = query.eq('is_sample', filters.sampleMode === 'only')

      // Apply search (on groom_name, bride_name, or phone)
      if (filters.search) {
        query = query.or(
          `groom_name.ilike.%${filters.search}%,bride_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
        )
      }

      // Apply status filter
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      // Apply assigned_to filter
      if (filters.assignedTo && filters.assignedTo !== 'all') {
        query = query.eq('assigned_to', filters.assignedTo)
      }

      // Apply date range filters
      if (filters.startDate) {
        query = query.gte('wedding_date', filters.startDate)
      }
      if (filters.endDate) {
        query = query.lte('wedding_date', filters.endDate)
      }

      // Pagination & Ordering
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query
        .order('created_at', { ascending: false })
        .range(from, to)

      const { data, error, count } = await query

      if (error) throw error
      return { data: (data as Customer[]) || [], count: count || 0 }
    },
  })
}

// 2. Fetch single customer
export function useCustomerQuery(customerId: string) {
  return useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      if (!customerId) return null
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .is('deleted_at', null)
        .single()

      if (error) throw error
      return data as Customer
    },
    enabled: !!customerId,
  })
}

// 3. Create customer mutation
export function useCreateCustomerMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    // is_sample 은 주문 상태에서 트리거가 채우는 값이라 생성 시 받지 않는다
    mutationFn: async (newCustomer: Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'is_sample'>) => {
      // Get current logged-in user to map created_by
      const { data: { user } } = await supabase.auth.getUser()
      const created_by = user?.id || null

      const { data, error } = await supabase
        .from('customers')
        .insert([{ ...newCustomer, created_by }])
        .select()
        .single()

      if (error) throw error
      return data as Customer
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

// 4. Update customer mutation
export function useUpdateCustomerMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ customerId, updates }: { customerId: string; updates: Partial<Customer> }) => {
      const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', customerId)
        .select()
        .single()

      if (error) throw error
      return data as Customer
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['customer', data.id] })
      }
    },
  })
}

// 5. Delete customer mutation (soft delete)
/**
 * 삭제 대기(소프트 삭제) 고객 목록.
 *
 * 기본 목록은 deleted_at 이 없는 것만 보여주므로, 지운 고객은 화면 어디에도 나타나지
 * 않는다 — 되돌릴 수도, 완전히 지울 수도 없는 상태로 계속 쌓였다. 고객 관리 화면
 * 아래에서 이 목록을 열어 골라 지운다.
 */
export function useDeletedCustomersQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['customers', 'deleted'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: true })
      if (error) throw error
      return data as Customer[]
    },
  })
}

/** 완전 삭제 — 되돌릴 수 없다. 여러 표를 가로지르므로 서버 라우트가 처리한다 */
export function usePurgeCustomersMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (customerIds: string[]) => {
      const res = await fetch('/api/admin/purge-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '완전 삭제에 실패했습니다.')
      return json as { purged: number }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useDeleteCustomerMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (customerId: string) => {
      const { data, error } = await supabase
        .from('customers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', customerId)
        .select()
        .single()

      if (error) throw error
      return data as Customer
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

// 6. Fetch profiles (admins/designers)
export function useProfilesQuery() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      return data as { id: string; email: string; role: string; name: string }[]
    },
  })
}

// 7. Fetch customer form instance
export function useCustomerFormInstanceQuery(customerId: string) {
  return useQuery({
    queryKey: ['customer-form-instance', customerId],
    queryFn: async () => {
      if (!customerId) return null
      const { data, error } = await supabase
        .from('form_instances')
        .select(`
          ${FORM_INSTANCE_COLUMNS},
          form_submissions(updated_at, is_complete)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) return null
      return data[0] || null
    },
    enabled: !!customerId,
  })
}

// 8. Fetch customer invitation
export function useCustomerInvitationQuery(customerId: string) {
  return useQuery({
    queryKey: ['customer-invitation', customerId],
    queryFn: async () => {
      if (!customerId) return null
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) return null
      return data[0] || null
    },
    enabled: !!customerId,
  })
}
