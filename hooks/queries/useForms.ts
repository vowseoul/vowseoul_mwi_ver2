import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface FieldLibraryItem {
  id: string
  field_key: string
  label: string
  help_text: string | null
  field_type: 'text' | 'date' | 'time' | 'select' | 'address' | 'phone' | 'image' | 'textarea' | 'number'
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
  access_password?: string | null
  expires_at?: string | null
  created_at: string
}

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
    mutationFn: async (newField: Omit<FieldLibraryItem, 'id' | 'created_at' | 'is_system'>) => {
      const { data, error } = await supabase
        .from('field_library')
        .insert([{ ...newField, is_system: false }])
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

// =========================================================================
// 2. Form Template Hooks
// =========================================================================
export function useFormTemplatesQuery() {
  return useQuery({
    queryKey: ['form-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_templates')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

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
    mutationFn: async (newTemplate: Omit<FormTemplate, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'current_version'>) => {
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

// =========================================================================
// 3. Form Instance Hooks
// =========================================================================
export function useFormInstancesQuery() {
  return useQuery({
    queryKey: ['form-instances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_instances')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as FormInstance[]
    },
  })
}

export function useCreateFormInstanceMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (newInstance: Omit<FormInstance, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('form_instances')
        .insert([newInstance])
        .select()
        .single()

      if (error) throw error
      return data as FormInstance
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
export function useFormInstanceBySlugQuery(slug: string) {
  return useQuery({
    queryKey: ['form-instance-by-slug', slug],
    queryFn: async () => {
      if (!slug) return null
      const { data, error } = await supabase
        .from('form_instances')
        .select(`
          *,
          customer:customer_id (
            id,
            groom_name,
            bride_name,
            wedding_date
          )
        `)
        .eq('unique_url_slug', slug)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!slug,
  })
}

// 6. Submit public form response mutation
export function useSubmitFormMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      instanceId,
      customerId,
      data,
      isComplete,
    }: {
      instanceId: string
      customerId: string
      data: any
      isComplete: boolean
    }) => {
      // 1. Upsert form_submissions
      const { error: submissionError } = await supabase
        .from('form_submissions')
        .upsert([{
          form_instance_id: instanceId,
          customer_id: customerId,
          data: data,
          is_complete: isComplete,
          missing_fields: []
        }], { onConflict: 'form_instance_id' })

      if (submissionError) throw submissionError

      // 2. Update form_instances status to 'completed'
      if (isComplete) {
        const { error: instanceError } = await supabase
          .from('form_instances')
          .update({ status: 'completed' })
          .eq('id', instanceId)

        if (instanceError) throw instanceError

        // 3. Update customer status to 'form_completed'
        const { error: customerError } = await supabase
          .from('customers')
          .update({ status: 'form_completed' })
          .eq('id', customerId)

        if (customerError) throw customerError
      }

      return true
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['form-instance-by-slug', variables.instanceId] })
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
