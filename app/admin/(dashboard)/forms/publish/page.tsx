'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  useCustomersQuery, 
  useCustomerQuery, 
  useUpdateCustomerMutation 
} from '@/hooks/queries/useCustomers'
import { 
  useFormTemplatesQuery, 
  useFormTemplateFieldsQuery, 
  useCreateFormInstanceMutation 
} from '@/hooks/queries/useForms'
import { ArrowLeft, Send, Copy, Check, ExternalLink, Loader2, Link as LinkIcon, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'

function FormPublishContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const customerIdParam = searchParams.get('customerId') || ''
  const templateIdParam = searchParams.get('templateId') || ''

  // Queries
  const { data: customerData } = useCustomersQuery({ status: 'registered' }, 1, 100)
  const { data: selectedCustomer } = useCustomerQuery(customerIdParam)
  const { data: templates } = useFormTemplatesQuery()
  const createInstanceMutation = useCreateFormInstanceMutation()
  const updateCustomerMutation = useUpdateCustomerMutation()

  // Form States
  const [customerId, setCustomerId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [accessPassword, setAccessPassword] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Publish Output State
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Fetch the fields snapshot for the selected template
  const { data: templateFields, isLoading: isLoadingFields } = useFormTemplateFieldsQuery(templateId)

  useEffect(() => {
    if (customerIdParam) setCustomerId(customerIdParam)
    if (templateIdParam) setTemplateId(templateIdParam)
  }, [customerIdParam, templateIdParam])

  // Auto-set expires_at to wedding_date + 7 days
  useEffect(() => {
    if (selectedCustomer?.wedding_date) {
      const wedding = new Date(selectedCustomer.wedding_date)
      const targetDate = new Date(wedding.getTime() + 7 * 24 * 60 * 60 * 1000)
      setExpiresAt(targetDate.toISOString().slice(0, 10))
    }
  }, [selectedCustomer])

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!customerId || customerId === 'none') {
      toast.error('고객을 선택해주세요.')
      return
    }
    if (!templateId || templateId === 'none') {
      toast.error('폼 템플릿을 선택해주세요.')
      return
    }
    if (!templateFields || templateFields.length === 0) {
      toast.error('선택한 템플릿에 배치된 필드가 없습니다. 먼저 폼 빌더에서 필드를 구성해주세요.')
      return
    }

    setIsSubmitting(true)

    try {
      // 1. Generate unique slug
      const slug = uuidv4().slice(0, 8) // Generate short slug

      // 2. Prepare fields snapshot
      const fieldsSnapshot = templateFields.map((tf: any) => ({
        field_library_id: tf.field_library_id,
        field_key: tf.field_library?.field_key,
        label: tf.label_override || tf.field_library?.label,
        help_text: tf.help_text_override || tf.field_library?.help_text,
        field_type: tf.field_library?.field_type,
        is_required: tf.is_required,
        sort_order: tf.sort_order,
        options: tf.options,
      }))

      // 3. Create Form Instance
      await createInstanceMutation.mutateAsync({
        customer_id: customerId,
        template_id: templateId,
        fields_snapshot: fieldsSnapshot,
        unique_url_slug: slug,
        status: 'active',
        access_password: accessPassword.trim() || null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      })

      // 4. Update Customer Status to 'form_sent'
      await updateCustomerMutation.mutateAsync({
        customerId: customerId,
        updates: { status: 'form_sent' },
      })

      toast.success('정보 수집 폼 링크가 성공적으로 발행되었습니다.')
      setPublishedSlug(slug)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '폼 발행 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const formUrl = publishedSlug ? `${baseUrl}/form/${publishedSlug}` : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(formUrl)
    setCopied(true)
    toast.success('폼 주소가 복사되었습니다. 고객에게 메신저나 이메일로 전송하세요.')
    setTimeout(() => setCopied(false), 2000)
  }

  // If already published
  if (publishedSlug) {
    return (
      <div className="space-y-6 font-sans max-w-xl mx-auto py-8">
        <Card className="border-green-200 bg-green-50/10">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 mb-2">
              <Check className="w-6 h-6" />
            </div>
            <CardTitle className="text-green-900 text-lg">발행 성공!</CardTitle>
            <CardDescription className="text-green-700">
              고객용 정보 수집 폼이 성공적으로 활성화되었습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">정보 수집 폼 공유 주소</label>
              <div className="flex gap-2">
                <Input value={formUrl} readOnly className="bg-white border-green-200 text-sm h-10" />
                <Button onClick={handleCopy} className="h-10 px-4 shrink-0 bg-green-600 hover:bg-green-700">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-4">
              <Button asChild className="w-full bg-green-600 hover:bg-green-700">
                <a href={`/form/${publishedSlug}`} target="_blank" rel="noreferrer" className="gap-2">
                  <ExternalLink className="w-4 h-4" /> 폼 작동 테스트
                </a>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href={`/admin/customers/${customerId}`}>
                  고객 상세정보로 가기
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const registeredCustomers = customerData?.data || []
  const availableTemplates = templates || []

  return (
    <div className="space-y-6 font-sans max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/forms">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">정보 수집 폼 링크 발행</h1>
          <p className="text-sm text-muted-foreground mt-1">
            고객 정보 수집을 위한 고유 링크를 생성하고 전송 단계를 활성화합니다
          </p>
        </div>
      </div>

      <form onSubmit={handlePublish}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">폼 발행 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldGroup className="space-y-4">
              {/* Customer Select */}
              <Field>
                <FieldLabel htmlFor="customerSelect">고객 선택 *</FieldLabel>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/20 text-sm">
                    <div>
                      <span className="font-semibold">{selectedCustomer.groom_name} & {selectedCustomer.bride_name}</span>
                      <span className="text-xs text-muted-foreground ml-2">예식일: {selectedCustomer.wedding_date}</span>
                    </div>
                    {customerIdParam ? null : (
                      <Button variant="link" onClick={() => setCustomerId('')} className="h-auto p-0 text-xs">
                        변경
                      </Button>
                    )}
                  </div>
                ) : (
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger id="customerSelect">
                      <SelectValue placeholder="폼을 발송할 고객 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">고객 선택</SelectItem>
                      {registeredCustomers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.groom_name} & {c.bride_name} (예식일: {c.wedding_date})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              {/* Template Select */}
              <Field>
                <FieldLabel htmlFor="templateSelect">양식 템플릿 선택 *</FieldLabel>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger id="templateSelect">
                    <SelectValue placeholder="수집 필드 구성 템플릿 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">템플릿 선택</SelectItem>
                    {availableTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} (v{t.current_version}) - {t.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* Fields Preview */}
              {templateId && templateId !== 'none' && (
                <div className="bg-muted/10 border border-border rounded-xl p-4 space-y-2.5">
                  <span className="text-xs font-semibold text-slate-700 block">수집할 정보 필드 목록 미리보기</span>
                  {isLoadingFields ? (
                    <div className="flex items-center text-xs text-muted-foreground py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> 불러오는 중...
                    </div>
                  ) : !templateFields || templateFields.length === 0 ? (
                    <div className="flex items-center text-xs text-destructive py-2 gap-1">
                      <ShieldAlert className="w-4 h-4" /> 템플릿에 구성된 필드가 없습니다. 먼저 필드를 추가하세요.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {templateFields.map((tf: any) => (
                        <Badge key={tf.id} variant="outline" className="text-[11px] font-normal">
                          {tf.label_override || tf.field_library?.label}
                          {tf.is_required && <span className="text-red-500 ml-0.5">*</span>}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Access Password */}
              <Field>
                <FieldLabel htmlFor="accessPassword">폼 접속 비밀번호 (선택)</FieldLabel>
                <Input
                  id="accessPassword"
                  value={accessPassword}
                  onChange={(e) => setAccessPassword(e.target.value)}
                  placeholder="비밀번호 설정 시 고객은 비밀번호 입력 후 로그인/접근 가능"
                />
              </Field>

              {/* Expires At */}
              <Field>
                <FieldLabel htmlFor="expiresAt">링크 만료일자</FieldLabel>
                <Input
                  id="expiresAt"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  만료일 이후에는 고객이 폼을 수정하거나 응답할 수 없습니다. (기본값: 예식일 + 7일)
                </p>
              </Field>
            </FieldGroup>

            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-border">
              <Button type="button" variant="outline" asChild disabled={isSubmitting}>
                <Link href="/admin/forms">취소</Link>
              </Button>
              <Button type="submit" className="gap-2" disabled={isSubmitting || (templateId && templateFields?.length === 0)}>
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                폼 링크 발행 및 활성화
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}

export default function FormPublishPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm mt-4">데이터 로딩 중...</p>
      </div>
    }>
      <FormPublishContent />
    </Suspense>
  )
}
