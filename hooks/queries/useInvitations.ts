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

      let targetCustomerId = customerId
      let customer = null

      if (!targetCustomerId || targetCustomerId === 'none' || targetCustomerId === 'mock') {
        const mockCustomer = {
          groom_name: '신랑(임시)',
          bride_name: '신부(임시)',
          phone: '010-0000-0000',
          wedding_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          venue_name: '바우서울 가든',
          venue_address: '서울특별시 종로구 가회동 1-1',
          status: 'form_completed',
          memo: '고객 지정 없이 생성된 임시 초안입니다.',
        }
        
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert([mockCustomer])
          .select()
          .single()
          
        if (custErr) throw custErr
        targetCustomerId = newCust.id
        customer = newCust
      } else {
        const { data: fetchedCustomer, error: fetchErr } = await supabase
          .from('customers')
          .select('groom_name, bride_name, phone, wedding_date, venue_name, venue_address')
          .eq('id', targetCustomerId)
          .single()
          
        if (fetchErr) throw fetchErr
        customer = fetchedCustomer
      }

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

      const contentData = {
        groomName: customer?.groom_name && customer.groom_name !== '미지정' ? customer.groom_name : '',
        brideName: customer?.bride_name && customer.bride_name !== '미지정' ? customer.bride_name : '',
        weddingDate: customer?.wedding_date || '',
        venueName: customer?.venue_name && customer.venue_name !== '미지정' ? customer.venue_name : '',
        venueAddress: customer?.venue_address && customer.venue_address !== '미지정' ? customer.venue_address : '',
        groomNameEn: '',
        groomParentRelation: '장남',
        brideNameEn: '',
        brideParentRelation: '장녀',
        weddingTime: '12:00',
        venueHall: '1층 단독홀',
        invitationMessage: '서로가 마주 보며 다져온 사랑을 이제 함께 한곳을 바라보며 걸어가고자 합니다. 저희의 뜻깊은 출발에 축복과 격려로 함께해 주시면 더없는 기쁨으로 간직하겠습니다.',
        galleryImages: [],
        galleryViewType: 'slide',
        trafficInfo: '지하철 역 도보 5분 거리',
        parkingInfo: '식장 내 무료 주차 지원',
        rsvpEnabled: true,
        rsvpMealEnabled: true,
        rsvpCommentEnabled: true,
        guestbookType: 'text',
        bgmId: null,
        kakaoThumbnail: null,
        kakaoTitle: '저희 결혼합니다',
        kakaoDescription: '소중한 분들을 초대합니다. 오셔서 축하해 주세요.',
        bankAccounts: [],
        contacts: [
          { id: 'c1', name: (customer?.groom_name !== '미지정' ? customer?.groom_name : '신랑') || '신랑', phone: customer?.phone || '', relation: 'groom' }
        ],
        customStyles: {}
      }

      const newInvite = {
        customer_id: targetCustomerId,
        theme_version_id: latestVersion?.id || null,
        public_slug: publicSlug,
        dashboard_slug: dashboardSlug,
        dashboard_password: dashboardPassword,
        block_order: blockOrder,
        content_data: contentData,
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
        .eq('id', targetCustomerId)

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

// 4. Delete invitation mutation
export function useDeleteInvitationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (invitationId: string) => {
      // Hard delete or soft-delete invitation
      const { error: hardDeleteErr } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId)

      if (hardDeleteErr) {
        // Fallback to soft delete if hard delete restricted
        const { error: softErr } = await supabase
          .from('invitations')
          .update({ deleted_at: new Date().toISOString(), status: 'expired' })
          .eq('id', invitationId)

        if (softErr) throw hardDeleteErr
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations-list'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer-invitation'] })
    },
  })
}
