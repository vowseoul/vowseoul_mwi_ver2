import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Customer {
  id: string
  created_by: string | null
  assigned_to: string | null
  groom_name: string
  bride_name: string
  phone: string | null
  wedding_date: string
  venue_name: string
  venue_address: string
  venue_coordinates: any
  transportation_info: string | null
  status: 'registered' | 'form_sent' | 'form_completed' | 'draft' | 'published' | 'expired'
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
    mutationFn: async (newCustomer: Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) => {
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
