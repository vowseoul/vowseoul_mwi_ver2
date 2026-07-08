import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Invitation {
  id: string
  customer_id: string
  theme_version_id: string | null
  public_slug: string
  dashboard_slug: string
  dashboard_password: string
  content_data: any
  customization_overrides: any
  block_order: string[]
  status: 'draft' | 'published' | 'paused' | 'expired'
  og_meta: any
  bgm_url: string | null
  published_at: string | null
  expires_at: string
  created_at: string
  updated_at: string
  customer?: {
    id: string
    groom_name: string
    bride_name: string
    wedding_date: string
  }
}

// 1. Fetch all invitations (admin)
export function useInvitationsQuery() {
  return useQuery({
    queryKey: ['invitations-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select(`
          *,
          customer:customer_id (
            id,
            groom_name,
            bride_name,
            wedding_date
          )
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Invitation[]
    },
  })
}

// 2. Create invitation
export function useCreateInvitationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      customerId,
      themeId,
      publicSlug,
    }: {
      customerId: string
      themeId: string
      publicSlug: string
    }) => {
      // Get the latest version of the theme to set as theme_version_id
      const { data: latestVersion } = await supabase
        .from('theme_versions')
        .select('id, default_block_order')
        .eq('theme_id', themeId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single()

      // Fetch customer phone number to use back 4 digits as password
      const { data: customer } = await supabase
        .from('customers')
        .select('phone, wedding_date')
        .eq('id', customerId)
        .single()

      const phoneStr = customer?.phone || '0000'
      const dashboardPassword = phoneStr.slice(-4)
      const dashboardSlug = `dash-${publicSlug}`

      const weddingDate = customer?.wedding_date 
        ? new Date(customer.wedding_date)
        : new Date()
      // Expiration: wedding date + 30 days
      const expiresAt = new Date(weddingDate.getTime() + 30 * 24 * 60 * 60 * 1000)

      const blockOrder = latestVersion?.default_block_order || [
        "cover", "greeting", "couple-info", "event-info", "gallery", "map", "account", "rsvp", "guestbook"
      ]

      const newInvite = {
        customer_id: customerId,
        theme_version_id: latestVersion?.id || null,
        public_slug: publicSlug,
        dashboard_slug: dashboardSlug,
        dashboard_password: dashboardPassword,
        block_order: blockOrder,
        content_data: {},
        customization_overrides: {},
        status: 'draft',
        expires_at: expiresAt.toISOString(),
      }

      const { data, error } = await supabase
        .from('invitations')
        .insert([newInvite])
        .select()
        .single()

      if (error) throw error

      // Update customer status to 'draft' (making the mobile invitation in draft)
      const { error: customerError } = await supabase
        .from('customers')
        .update({ status: 'draft' })
        .eq('id', customerId)

      if (customerError) throw customerError

      return data as Invitation
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations-list'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

// 3. Update invitation status
export function useUpdateInvitationStatusMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      invitationId,
      status,
    }: {
      invitationId: string
      status: 'draft' | 'published' | 'paused' | 'expired'
    }) => {
      const updates: any = { status }
      if (status === 'published') {
        updates.published_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('invitations')
        .update(updates)
        .eq('id', invitationId)
        .select()
        .single()

      if (error) throw error

      // Also sync customer status
      const customerStatus = status === 'published' ? 'published' : 'draft'
      await supabase
        .from('customers')
        .update({ status: customerStatus })
        .eq('id', data.customer_id)

      return data as Invitation
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations-list'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}
