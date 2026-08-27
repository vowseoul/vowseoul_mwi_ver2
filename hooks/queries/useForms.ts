import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface FieldLibraryItem {
  id: string
  field_key: string
  label: string
  help_text: string | null
  field_type: 'text' | 'date' | 'time' | 'select' | 'address' | 'phone' | 'image' | 'textarea' | 'number'
    | 'rselect' | 'toggle' | 'images' | 'music' | 'select_text' | 'timentext' | 'imageselect' | 'mselect' | 'slug'
  validation_rules: any
  category: '신랑 정보' | '신부 정보' | '예식 정보' | '혼주 정보' | '계좌 정보' | '이미지' | 'BGM' | 'RSVP 설정' | '카카오 공유' | '영상' | '지류 전용'
  is_system: boolean
  created_at: string
}

export interface FormTemplate {
  id: string
  name: string
  description: string | null
  category: string
  current_version: number
  is_active: boolean
  created_by: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface FormTemplateVersion {
  id: string
  template_id: string
  version_number: number
  fields_snapshot: any
  change_note: string | null
  created_by: string | null
  created_at: string
}

export interface FormInstance {
  id: string
  customer_id: string
  template_id: string | null
  fields_snapshot: any
  unique_url_slug: string
  status: 'draft' | 'active' | 'completed' | 'expired'
  expires_at?: string | null
  created_at: string
  has_password?: boolean
}

/**
 * form_instances 조회 시 쓰는 컬럼 목록.
 *
 * '*' 를 쓰면 안 된다 — access_password 는 anon/authenticated 양쪽에서 회수돼 있어
 * (§supabase/migrations/20260819000000) 행 전체를 요구하는 순간 권한 오류가 난다.
 * INSERT 후 .select() 도 RETURNING 이라 같은 제약을 받으므로 이 목록을 넘겨야 한다.
 */
/**
 * 폼 발행 시 보내는 형태.
 *
 * access_password 는 여기에만 있고 FormInstance 에는 없다 — 관리자는 이 값을
 * "쓸 수는 있지만 되읽을 수는 없다"(§20260819000000). 비대칭이 어색해 보이지만
 * invitations.dashboard_password 와 같은 원칙이고, 대조는 서버만 한다.
 * has_password 는 DB 생성 컬럼이라 넣어 보내면 안 된다.
 */
export type NewFormInstance = Omit<FormInstance, 'id' | 'created_at' | 'has_password'> & {
  access_password?: string | null
}

export const FORM_INSTANCE_COLUMNS =
  'id, customer_id, template_id, fields_snapshot, unique_url_slug, status, expires_at, created_at, has_password'

export interface FormSubmission {
  id: string
  form_instance_id: string
  customer_id: string
  data: any
  missing_fields: string[]
  is_complete: boolean
  submitted_at: string
  updated_at: string
}

// =========================================================================
// 1. Field Library Hooks
// =========================================================================
export function useFieldsQuery() {
  return useQuery({
    queryKey: ['fields'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_library')
        .select('*')
        .order('category', { ascending: true })
        .order('field_key', { ascending: true })

      if (error) throw error
      return data as FieldLibraryItem[]
    },
  })
}

export function useCreateFieldMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (newField: Omit<FieldLibraryItem, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('field_library')
        .insert([newField])
        .select()
        .single()

      if (error) throw error
      return data as FieldLibraryItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields'] })
    },
  })
}

export function useUpdateFieldMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      fieldId,
      updates,
    }: {
      fieldId: string
      updates: Partial<Omit<FieldLibraryItem, 'id' | 'created_at'>>
    }) => {
      const { data, error } = await supabase
        .from('field_library')
        .update(updates)
        .eq('id', fieldId)
        .select()
        .single()

      if (error) throw error
      return data as FieldLibraryItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields'] })
    },
  })
}

export function useDeleteFieldMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fieldId: string) => {
      const { error } = await supabase
        .from('field_library')
        .delete()
        .eq('id', fieldId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields'] })
    },
  })
}

// =========================================================================
// 2. Form Template Hooks
// =========================================================================
/**
 * 폼 템플릿 목록.
 *
 * activeOnly 는 "고객에게 발송할 양식을 고르는 화면"에서만 켠다. 폼 관리 화면(/admin/forms)은
 * 비활성 템플릿까지 보여야 한다 — 거기가 활성/비활성을 토글하는 곳이라, 끄는 순간 목록에서
 * 사라지면 다시 켤 수가 없다.
 *
 * 기본값을 false 로 둔 이유: is_active 를 무조건 걸면 관리 화면이 조용히 망가진다. 대신
 * 발행 화면이 명시적으로 켜서, "비활성으로 바꿨는데 발송 목록엔 그대로 남아 있는" 상태를 막는다.
 */
export function useFormTemplatesQuery(options: { activeOnly?: boolean } = {}) {
  const { activeOnly = false } = options
  return useQuery({
    queryKey: ['form-templates', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('form_templates')
        .select('*')
        .is('deleted_at', null)

      if (activeOnly) query = query.eq('is_active', true)

      // 이름순 — 목록에서도 발행 화면에서도 찾는 기준은 만든 날짜가 아니라 이름이다
      const { data, error } = await query.order('name')

      if (error) throw error
      return data as FormTemplate[]
    },
  })
}

export function useFormTemplateQuery(templateId: string) {
  return useQuery({
    queryKey: ['form-template', templateId],
    queryFn: async () => {
      if (!templateId) return null
      const { data, error } = await supabase
        .from('form_templates')
        .select('*')
        .eq('id', templateId)
        .is('deleted_at', null)
        .single()

      if (error) throw error
      return data as FormTemplate
    },
    enabled: !!templateId,
  })
}

export function useCreateFormTemplateMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (newTemplate: Omit<FormTemplate, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'current_version' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('form_templates')
        .insert([{ ...newTemplate, created_by: user?.id || null }])
        .select()
        .single()

      if (error) throw error
      return data as FormTemplate
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-templates'] })
    },
  })
}
export function useUpdateFormTemplateMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ templateId, updates }: { templateId: string; updates: Partial<FormTemplate> }) => {
      const { data, error } = await supabase
        .from('form_templates')
        .update(updates)
        .eq('id', templateId)
        .select()
        .single()

      if (error) throw error
      return data as FormTemplate
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-templates'] })
    },
  })
}

export function useDeleteFormTemplateMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('form_templates')
        .delete()
        .eq('id', templateId)

      if (error) throw error
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-templates'] })
    },
  })
}

// =========================================================================
// 3. Form Instance Hooks
// =========================================================================
export function useFormInstancesQuery() {
  return useQuery({
    queryKey: ['form-instances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_instances')
        .select(FORM_INSTANCE_COLUMNS)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as unknown as FormInstance[]
    },
  })
}

export function useCreateFormInstanceMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (newInstance: NewFormInstance) => {
      const { data, error } = await supabase
        .from('form_instances')
        .insert([newInstance])
        .select(FORM_INSTANCE_COLUMNS)
        .single()

      if (error) throw error
      return data as unknown as FormInstance
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-instances'] })
    },
  })
}

// =========================================================================
// 4. Form Template Fields Hooks
// =========================================================================
export function useFormTemplateFieldsQuery(templateId: string) {
  return useQuery({
    queryKey: ['form-template-fields', templateId],
    queryFn: async () => {
      if (!templateId) return []
      const { data, error } = await supabase
        .from('form_template_fields')
        .select(`
          id,
          template_id,
          field_library_id,
          label_override,
          help_text_override,
          is_required,
          sort_order,
          options,
          field_library:field_library_id (
            field_key,
            label,
            help_text,
            field_type,
            category
          )
        `)
        .eq('template_id', templateId)
        .order('sort_order', { ascending: true })

      if (error) throw error
      return data || []
    },
    enabled: !!templateId,
  })
}

export function useSaveTemplateFieldsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      templateId,
      fields,
    }: {
      templateId: string
      fields: {
        field_library_id: string
        label_override: string | null
        help_text_override: string | null
        is_required: boolean
        sort_order: number
        options: any
      }[]
    }) => {
      // 1. Delete all existing fields for this template
      const { error: deleteError } = await supabase
        .from('form_template_fields')
        .delete()
        .eq('template_id', templateId)

      if (deleteError) throw deleteError

      // 2. Insert new fields
      if (fields.length > 0) {
        const { error: insertError } = await supabase
          .from('form_template_fields')
          .insert(fields.map(f => ({ ...f, template_id: templateId })))

        if (insertError) throw insertError
      }

      // 3. Create a snapshot in form_template_versions
      const { data: currentTemplate } = await supabase
        .from('form_templates')
        .select('current_version')
        .eq('id', templateId)
        .single()

      const nextVersion = (currentTemplate?.current_version || 0) + 1

      const { error: versionError } = await supabase
        .from('form_template_versions')
        .insert([{
          template_id: templateId,
          version_number: nextVersion,
          fields_snapshot: fields,
          change_note: `필드 재구성 (v${nextVersion})`
        }])

      if (versionError) throw versionError

      // Update current template version
      const { error: templateUpdateError } = await supabase
        .from('form_templates')
        .update({ current_version: nextVersion })
        .eq('id', templateId)

      if (templateUpdateError) throw templateUpdateError

      return true
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['form-template-fields', variables.templateId] })
      queryClient.invalidateQueries({ queryKey: ['form-template', variables.templateId] })
    },
  })
}

// 5. Fetch form instance by slug (for public client use)
/**
 * 서버 라우트를 거쳐 읽는다 — anon 키로 form_instances 를 직접 조회하지 않는다.
 *
 * 예전에는 이 자리에서 form_submissions(답변 전체)와 customers(신랑신부 이름)를
 * 임베드로 함께 받아왔고, 그게 비밀번호 확인보다 먼저 도착했다. 이제 라우트가
 * 잠금해제 쿠키를 보고 답변을 줄지 말지 결정한다(§app/api/form-instance/route.ts).
 *
 * 잠긴 응답은 { locked: true } 와 잠금 화면에 필요한 최소 필드만 담고 있다.
 */
export function useFormInstanceBySlugQuery(slug: string) {
  return useQuery({
    queryKey: ['form-instance-by-slug', slug],
    queryFn: async () => {
      if (!slug) return null
      const res = await fetch(`/api/form-instance?slug=${encodeURIComponent(slug)}`)
      if (!res.ok) throw new Error('양식을 찾을 수 없습니다.')
      return (await res.json()) as any
    },
    enabled: !!slug,
  })
}

// 6. Submit public form response mutation
/**
 * 임시저장·제출 — anon 으로 DB 를 직접 건드리지 않고 서버 라우트를 거친다.
 *
 * 읽기만 서버로 옮기고 쓰기는 남기려 했지만 성립하지 않았다. PostgREST 의 upsert 는
 * 충돌 검사에, update 는 WHERE 절에 각각 SELECT 권한을 요구해서(둘 다 401 로 실제
 * 확인) 쓰기를 anon 에 남기려면 읽기도 함께 열어둬야 했다 — 그러면 닫으려던 답변
 * 유출이 그대로 남는다.
 *
 * instanceId/customerId 를 더 이상 클라이언트가 정하지 않는다. 슬러그로 서버가 찾은
 * 값을 되받아 뒤이은 /api/form-submit 호출에 쓴다.
 */
export function useSubmitFormMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      slug,
      data,
      isComplete,
      consentAgreedAt,
      consentVersion,
    }: {
      slug: string
      data: any
      isComplete: boolean
      /** 정보 수집 동의 시각/버전 — app/form/[slug]/page.tsx의 동의 화면 통과 시에만 전달된다 */
      consentAgreedAt?: string
      consentVersion?: string
    }) => {
      const res = await fetch('/api/form-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, data, isComplete, consentAgreedAt, consentVersion }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || '저장하지 못했습니다.')
      }
      const { instanceId, customerId } = await res.json()

      if (isComplete) {
        // customers 갱신·알림은 기존 라우트가 담당한다. 여기에 넘기는 id 는 서버가
        // 슬러그로 찾아 돌려준 값이다.
        const done = await fetch('/api/form-submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceId, customerId, data }),
        })
        if (!done.ok) {
          const body = await done.json().catch(() => ({}))
          throw new Error(body.error || '고객 정보를 갱신하지 못했습니다.')
        }
      }

      return true
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['form-instance-by-slug', variables.slug] })
    },
  })
}

// 7. Fetch form submission response by instanceId
export function useFormSubmissionQuery(instanceId: string) {
  return useQuery({
    queryKey: ['form-submission', instanceId],
    queryFn: async () => {
      if (!instanceId) return null
      const { data, error } = await supabase
        .from('form_submissions')
        .select(`
          *,
          form_instance:form_instance_id (
            id,
            fields_snapshot,
            customer:customer_id (
              id,
              groom_name,
              bride_name,
              wedding_date
            )
          )
        `)
        .eq('form_instance_id', instanceId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!instanceId,
  })
}

// 8. Update form submission data mutation
export function useUpdateSubmissionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      submissionId,
      data,
    }: {
      submissionId: string
      data: any
    }) => {
      const { data: updated, error } = await supabase
        .from('form_submissions')
        .update({ data: data })
        .eq('id', submissionId)
        .select()
        .single()

      if (error) throw error
      return updated
    },
    onSuccess: (data) => {
      if (data?.form_instance_id) {
        queryClient.invalidateQueries({ queryKey: ['form-submission', data.form_instance_id] })
      }
    },
  })
}
