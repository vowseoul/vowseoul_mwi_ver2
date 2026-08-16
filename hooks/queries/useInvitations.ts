import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { DATA_RETENTION_SETTINGS_KEY, computeExpiryDate, parseRetentionSettings } from '@/lib/data-retention'
import { buildContentDataFromForm, deriveOgMetaFromForm, deriveOverridesFromForm, resolveBgmUrlFromSnapshot } from '@/lib/invitation-data'
import { hashDashboardPassword } from '@/lib/dashboard-password'

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
  /** true 면 데이터 자동 파기 대상에서 제외된다 (예: 데모/샘플용 청첩장) */
  is_sample: boolean
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
      // Get the latest version of the theme to set as theme_version_id.
      // 결과가 0건일 수 있으므로 .single() 대신 .maybeSingle() 사용 (0건이면 HTTP 406)
      let { data: latestVersion } = await supabase
        .from('theme_versions')
        .select('id, default_block_order')
        .eq('theme_id', themeId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      // 버전이 아직 없는 테마(예: 새로 등록한 템플릿 테마)는 v1을 자동 생성해
      // 청첩장이 항상 유효한 theme_version_id 를 갖도록 한다.
      if (!latestVersion) {
        const { data: createdVersion, error: versionErr } = await supabase
          .from('theme_versions')
          .insert({
            theme_id: themeId,
            version_number: 1,
            design_tokens: {},
            block_variant_selections: {},
            default_block_order: [],
            status: 'active',
            change_note: '청첩장 생성 시 자동 생성된 초기 버전',
          })
          .select('id, default_block_order')
          .single()

        if (versionErr) throw versionErr
        latestVersion = createdVersion
      }

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
          .select('groom_name, bride_name, phone, wedding_date, venue_name, venue_address, is_sample')
          .eq('id', targetCustomerId)
          .single()
          
        if (fetchErr) throw fetchErr
        customer = fetchedCustomer
      }

      const phoneStr = customer?.phone || '0000'
      // 실제 값(연락처 뒷 4자리)은 해시로만 저장한다 — 평문은 어디에도 남기지 않는다.
      // 안내는 "연락처 뒷 4자리입니다"라는 고정 규칙 문구로 대신한다(§lib/dashboard-password.ts).
      const dashboardPassword = phoneStr.slice(-4)
      const dashboardPasswordHash = await hashDashboardPassword(dashboardPassword)
      const dashboardSlug = `dash-${publicSlug}`

      const weddingDate = customer?.wedding_date
        ? new Date(customer.wedding_date)
        : new Date()
      // 만료일 = 예식일 + 보관일수(관리자 설정, 기본 30일 — lib/data-retention.ts)
      const { data: retentionRow } = await supabase
        .from('settings')
        .select('value')
        .eq('key', DATA_RETENTION_SETTINGS_KEY)
        .maybeSingle()
      const { daysAfterWedding } = parseRetentionSettings(retentionRow?.value)
      const expiresAt = computeExpiryDate(weddingDate, daysAfterWedding)

      // 테마 버전에 기본 순서가 없으면 null로 둔다 — 렌더러가 테마 template.html의 DOM
      // 순서를 그대로 쓴다(§extractBlockOrder). 예전엔 여기서 실제 BLOCK_KEYS와 다른
      // 키("cover"/"couple-info" 등)로 채워 넣어, 렌더링 시 전부 걸러지고 결국 테마
      // 기본 순서로 대체되긴 했지만 DB엔 무의미한 값이 영구히 쌓이는 상태였다.
      const blockOrder = latestVersion?.default_block_order || null

      // '미지정'/빈값 정리 헬퍼
      const clean = (v?: string | null) => (v && v !== '미지정' ? v : '')
      const invitationMessageDefault =
        '서로가 마주 보며 다져온 사랑을 이제 함께 한곳을 바라보며 걸어가고자 합니다. 저희의 뜻깊은 출발에 축복과 격려로 함께해 주시면 더없는 기쁨으로 간직하겠습니다.'

      const contentData = {
        // ── 필드키 (정식 소스, 새 템플릿 렌더러가 사용) ─────────────────
        // 폼 수집 필드키와 동일한 snake_case. 이후 폼 동기화가 이 위에 덮어쓴다.
        groom_name: clean(customer?.groom_name),
        bride_name: clean(customer?.bride_name),
        wedding_date: customer?.wedding_date || '',
        wedding_time: '',
        venue_name: clean(customer?.venue_name),
        venue_address: clean(customer?.venue_address),
        greeting_message: invitationMessageDefault,

        // ── 레거시 camelCase (기존 invitation-client 렌더러 호환) ───────
        // 필드키와 이름이 겹치지 않아 공존한다.
        groomName: clean(customer?.groom_name),
        brideName: clean(customer?.bride_name),
        weddingDate: customer?.wedding_date || '',
        venueName: clean(customer?.venue_name),
        venueAddress: clean(customer?.venue_address),
        groomNameEn: '',
        groomParentRelation: '장남',
        brideNameEn: '',
        brideParentRelation: '장녀',
        weddingTime: '12:00',
        venueHall: '1층 단독홀',
        invitationMessage: invitationMessageDefault,
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

      // 고객이 이미 폼을 제출했다면 그 값(계좌 정보, 메인 이미지, 갤러리 이미지 등)을 초안에
      // 바로 반영한다 — 예전엔 이 단계에서 customers 컬럼만 썼고, 폼 제출값은 어드민이
      // "최신 폼 제출 내용으로 업데이트" 버튼을 별도로 눌러야만 들어갔다(청첩장 생성 직후엔
      // 계좌/사진이 전부 비어 있었다).
      const { data: latestSubmission } = await supabase
        .from('form_submissions')
        .select('data, form_instances(fields_snapshot)')
        .eq('customer_id', targetCustomerId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const submittedData = (latestSubmission?.data && typeof latestSubmission.data === 'object')
        ? latestSubmission.data as Record<string, unknown>
        : null

      // bgm 필드는 고른 음원의 URL이 아니라 파일명만 저장하므로(§lib/invitation-data.ts
      // resolveBgmUrlFromSnapshot), 폼 발행 시점에 고정된 fields_snapshot과 함께 봐야 실제
      // 재생 URL을 찾을 수 있다.
      const fieldsSnapshot = (latestSubmission as { form_instances?: { fields_snapshot?: unknown } } | null)?.form_instances?.fields_snapshot ?? null
      const resolvedBgmUrl = submittedData ? resolveBgmUrlFromSnapshot(fieldsSnapshot, submittedData.bgm) : null

      const mergedContentData = submittedData
        ? { ...contentData, ...buildContentDataFromForm(submittedData) }
        : contentData

      const ogMeta = submittedData ? deriveOgMetaFromForm(submittedData) : null

      // 고객이 폼에서 "RSVP/방명록/계좌/오시는 길 넣을지" 등을 답했으면 초안 생성 시점부터
      // 해당 블럭이 켜진/꺼진 상태로 시작하고, "식사·셔틀 질문", "D-day 표시" 여부도 함께 반영한다.
      const formOverrides = submittedData ? deriveOverridesFromForm(submittedData) : null
      const overrides = formOverrides && (formOverrides.disabledSlotsAdd.length > 0 || Object.keys(formOverrides.blockPatches).length > 0)
        ? { disabled_slots: formOverrides.disabledSlotsAdd, blocks: formOverrides.blockPatches }
        : {}

      const newInvite = {
        customer_id: targetCustomerId,
        theme_version_id: latestVersion?.id || null,
        public_slug: publicSlug,
        dashboard_slug: dashboardSlug,
        dashboard_password: dashboardPasswordHash,
        block_order: blockOrder,
        content_data: mergedContentData,
        customization_overrides: overrides,
        og_meta: ogMeta || {},
        bgm_url: resolvedBgmUrl,
        status: 'draft',
        // 샘플/테스트 고객의 청첩장은 처음부터 SAMPLE로 만든다 — 자동 파기 대상에서
        // 빠지고(§app/api/cron/purge-expired-invitations) 목록에서도 구분된다.
        is_sample: customer?.is_sample === true,
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

// 4. Update invitation public slug (하객 접속 링크 주소 변경 — 예: 기존 청첩장을 샘플용 링크로 재사용)
export function useUpdateInvitationSlugMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      invitationId,
      publicSlug,
    }: {
      invitationId: string
      publicSlug: string
    }) => {
      const { data, error } = await supabase
        .from('invitations')
        .update({ public_slug: publicSlug })
        .eq('id', invitationId)
        .select()
        .single()

      if (error) {
        // public_slug 는 DB 에 UNIQUE 제약이 걸려 있다 (23505 = unique_violation)
        if (error.code === '23505') throw new Error('이미 사용 중인 링크 주소입니다.')
        throw error
      }
      return data as Invitation
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations-list'] })
    },
  })
}

// 5. Toggle "샘플용" 플래그 — 켜두면 데이터 자동 파기(예식일+보관일수 경과 삭제) 대상에서 제외된다
export function useUpdateInvitationSampleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      invitationId,
      isSample,
    }: {
      invitationId: string
      isSample: boolean
    }) => {
      const { data, error } = await supabase
        .from('invitations')
        .update({ is_sample: isSample })
        .eq('id', invitationId)
        .select()
        .single()

      if (error) throw error
      return data as Invitation
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations-list'] })
    },
  })
}

// 6. Delete invitation mutation
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
