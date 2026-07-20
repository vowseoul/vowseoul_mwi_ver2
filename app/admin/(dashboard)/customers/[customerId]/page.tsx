'use client'

import React, { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { 
  useCustomerQuery, 
  useUpdateCustomerMutation, 
  useCustomerFormInstanceQuery,
  useCustomerInvitationQuery,
  useProfilesQuery 
} from '@/hooks/queries/useCustomers'
import { useThemesQuery } from '@/hooks/queries/useThemes'
import { useCreateInvitationMutation } from '@/hooks/queries/useInvitations'
import { useFormTemplateFieldsQuery } from '@/hooks/queries/useForms'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowLeft, Save, Copy, Check, ExternalLink, Loader2, Calendar, RefreshCw, FileCheck } from 'lucide-react'
import { toast } from 'sonner'

export default function CustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = use(params)
  const router = React.useRouter ? React.useRouter() : null // fallback in case useRouter isn't natively bound

  const { data: customer, isLoading, error } = useCustomerQuery(customerId)
  const updateMutation = useUpdateCustomerMutation()
  const { data: formInstance } = useCustomerFormInstanceQuery(customerId)
  const { data: invitation } = useCustomerInvitationQuery(customerId)
  const { data: profiles, isLoading: isLoadingProfiles } = useProfilesQuery()

  // Form version tracking & update logic
  const { data: latestFields } = useFormTemplateFieldsQuery(formInstance?.template_id || '')
  const queryClient = useQueryClient()
  const [isUpdatingVersion, setIsUpdatingVersion] = useState(false)

  const isNewVersionAvailable = React.useMemo(() => {
    if (!formInstance || !latestFields || latestFields.length === 0) return false
    
    const normalizeLatest = (f: any) => ({
      field_library_id: f.field_library_id || '',
      field_key: f.field_library?.field_key || '',
      label: f.label_override || f.field_library?.label || '',
      help_text: f.help_text_override || f.field_library?.help_text || '',
      field_type: f.field_library?.field_type || '',
      is_required: !!f.is_required,
      options: JSON.stringify(f.options || {})
    })

    const normalizeCurrent = (f: any) => ({
      field_library_id: f.field_library_id || '',
      field_key: f.field_key || '',
      label: f.label || '',
      help_text: f.help_text || '',
      field_type: f.field_type || '',
      is_required: !!f.is_required,
      options: JSON.stringify(f.options || {})
    })

    const latestNormalized = latestFields.map(normalizeLatest)
    const currentNormalized = (formInstance.fields_snapshot || []).map(normalizeCurrent)

    return JSON.stringify(latestNormalized) !== JSON.stringify(currentNormalized)
  }, [formInstance, latestFields])

  const handleUpdateFormVersion = async () => {
    if (!formInstance || !latestFields || latestFields.length === 0) return
    
    const ok = confirm('선택하신 템플릿의 최신 필드 구성으로 정보 수집 폼을 업데이트하시겠습니까? 고객이 이전에 입력했던 답변들은 그대로 유지되며, 신규 필드만 추가/조정됩니다.')
    if (!ok) return

    setIsUpdatingVersion(true)
    try {
      const newFieldsSnapshot = latestFields.map((tf: any) => ({
        field_library_id: tf.field_library_id,
        field_key: tf.field_library?.field_key,
        label: tf.label_override || tf.field_library?.label,
        help_text: tf.help_text_override || tf.field_library?.help_text,
        field_type: tf.field_library?.field_type,
        is_required: tf.is_required,
        sort_order: tf.sort_order,
        options: tf.options,
      }))

      const { error: updateError } = await supabase
        .from('form_instances')
        .update({ fields_snapshot: newFieldsSnapshot })
        .eq('id', formInstance.id)

      if (updateError) throw updateError

      toast.success('정보 수집 폼이 최신 양식 버전으로 성공적으로 업데이트되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['customer-form-instance', customerId] })
    } catch (err: any) {
      console.error(err)
      toast.error('양식 업데이트 중 오류가 발생했습니다.')
    } finally {
      setIsUpdatingVersion(false)
    }
  }

  // Form states
  const [groomName, setGroomName] = useState('')
  const [brideName, setBrideName] = useState('')
  const [phone, setPhone] = useState('')
  const [weddingDate, setWeddingDate] = useState('')
  const [venueName, setVenueName] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [assignedTo, setAssignedTo] = useState('none')
  const [status, setStatus] = useState('registered')
  const [memo, setMemo] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  const { data: themes } = useThemesQuery()
  const createInviteMutation = useCreateInvitationMutation()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedThemeId, setSelectedThemeId] = useState('')
  const [publicSlug, setPublicSlug] = useState('')
  const [isCreatingInvite, setIsCreatingInvite] = useState(false)

  // Populate publicSlug and selectedThemeId when modal opens
  useEffect(() => {
    if (isCreateModalOpen && customer) {
      const randomPart = Math.random().toString(36).substring(2, 8)
      setPublicSlug(`vow-${randomPart}`)
      if (themes && themes.length > 0) {
        setSelectedThemeId(themes[0].id)
      }
    }
  }, [isCreateModalOpen, customer, themes])

  // Copy helper
  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    setCopiedLink(type)
    toast.success('클립보드에 복사되었습니다.')
    setTimeout(() => setCopiedLink(null), 2000)
  }

  // Populate form when data loaded
  useEffect(() => {
    if (customer) {
      setGroomName(customer.groom_name)
      setBrideName(customer.bride_name)
      setPhone(customer.phone || '')
      setWeddingDate(customer.wedding_date)
      setVenueName(customer.venue_name)
      setVenueAddress(customer.venue_address)
      setAssignedTo(customer.assigned_to || 'none')
      setStatus(customer.status)
      setMemo(customer.memo || '')
    }
  }, [customer])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!groomName.trim() || !brideName.trim() || !weddingDate || !venueName.trim() || !venueAddress.trim()) {
      toast.error('필수 항목을 모두 입력해주세요.')
      return
    }

    setIsSubmitting(true)

    try {
      await updateMutation.mutateAsync({
        customerId,
        updates: {
          groom_name: groomName,
          bride_name: brideName,
          phone: phone || null,
          wedding_date: weddingDate,
          venue_name: venueName,
          venue_address: venueAddress,
          assigned_to: assignedTo === 'none' ? null : assignedTo,
          status: status as any,
          memo: memo || null,
        },
      })
      toast.success('고객 정보가 수정되었습니다.')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '정보 수정 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedThemeId || selectedThemeId === 'none') {
      toast.error('디자인 테마를 선택해주세요.')
      return
    }
    if (!publicSlug.trim()) {
      toast.error('접속 숏링크 주소(slug)를 입력해주세요.')
      return
    }

    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(publicSlug)) {
      toast.error('링크 주소는 영문 소문자, 숫자, 하이픈(-)만 허용됩니다.')
      return
    }

    setIsCreatingInvite(true)
    try {
      const created = await createInviteMutation.mutateAsync({
        customerId,
        themeId: selectedThemeId,
        publicSlug,
      })
      toast.success('모바일 청첩장 초안이 성공적으로 생성되었습니다.')
      setIsCreateModalOpen(false)
      window.location.href = `/admin/invitations/editor/${created.id}`
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '초안 생성에 실패했습니다.')
    } finally {
      setIsCreatingInvite(false)
    }
  }

  if (isLoading) {
    return (
      <div className="w-full h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm mt-4">고객 정보를 불러오는 중입니다...</p>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="w-full h-[60vh] flex flex-col items-center justify-center">
        <p className="text-destructive font-semibold">고객을 찾을 수 없거나 에러가 발생했습니다.</p>
        <Button className="mt-4" asChild>
          <Link href="/admin/customers">목록으로 돌아가기</Link>
        </Button>
      </div>
    )
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // Extract orderer details from memo if present
  let originalOrderer = ''
  let originalPhone = ''
  let paperType = ''
  let mobileYn = ''
  let displayMemo = customer?.memo || ''

  if (customer?.memo && customer.memo.startsWith('[')) {
    const headerEndIndex = customer.memo.indexOf(']')
    if (headerEndIndex > -1) {
      const headerContent = customer.memo.substring(1, headerEndIndex)
      displayMemo = customer.memo.substring(headerEndIndex + 1).replace(/^\s*[\/\-]?\s*메모:\s*/, '').trim()
      
      const parts = headerContent.split('|')
      parts.forEach(part => {
        const splitPart = part.split(':')
        if (splitPart.length >= 2) {
          const key = splitPart[0].trim()
          const val = splitPart.slice(1).join(':').trim()
          if (key === '주문자') originalOrderer = val
          else if (key === '연락처') originalPhone = val
          else if (key === '지류') paperType = val
          else if (key === '모바일') mobileYn = val
        }
      })
    }
  }

  const formSubmissionTime = formInstance?.form_submissions?.[0]?.updated_at

  return (
    <div className="space-y-6 font-sans max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/customers">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            고객 상세 정보 ({customer.groom_name} & {customer.bride_name})
          </h1>
          <p className="text-sm text-muted-foreground mt-1">고객 기본 정보 변경 및 연동된 폼과 청첩장 링크를 관리합니다</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form (2/3 width) */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium">기본 정보 수정</CardTitle>
                <CardDescription>
                  고객의 기본 예식 및 연락 정보를 변경합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="groomName">신랑 이름 *</FieldLabel>
                      <Input
                        id="groomName"
                        value={groomName}
                        onChange={(e) => setGroomName(e.target.value)}
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="brideName">신부 이름 *</FieldLabel>
                      <Input
                        id="brideName"
                        value={brideName}
                        onChange={(e) => setBrideName(e.target.value)}
                        required
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="phone">연락처</FieldLabel>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="assignedTo">담당자</FieldLabel>
                      <Select value={assignedTo} onValueChange={setAssignedTo}>
                        <SelectTrigger id="assignedTo">
                          <SelectValue placeholder="담당자 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">지정 안 됨</SelectItem>
                          {!isLoadingProfiles && profiles?.map((p) => {
                            const [namePart, phonePart] = (p.name || '').split('|').map((s: string) => s.trim())
                            return (
                              <SelectItem key={p.id} value={p.id}>
                                {namePart} {phonePart ? `(${phonePart})` : ''} ({p.role === 'ADMIN' ? '운영자' : '디자이너'})
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="weddingDate">예식 일자 *</FieldLabel>
                      <Input
                        id="weddingDate"
                        type="date"
                        value={weddingDate}
                        onChange={(e) => setWeddingDate(e.target.value)}
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="status">진행 단계 *</FieldLabel>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger id="status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="registered">신규 등록 (registered)</SelectItem>
                          <SelectItem value="form_sent">폼 전송 (form_sent)</SelectItem>
                          <SelectItem value="form_completed">폼 완료 (form_completed)</SelectItem>
                          <SelectItem value="draft">초안 작성 (draft)</SelectItem>
                          <SelectItem value="published">청첩장 발행 (published)</SelectItem>
                          <SelectItem value="expired">만료됨 (expired)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="venueName">예식장 *</FieldLabel>
                    <Input
                      id="venueName"
                      value={venueName}
                      onChange={(e) => setVenueName(e.target.value)}
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="venueAddress">도로명 주소 *</FieldLabel>
                    <Input
                      id="venueAddress"
                      value={venueAddress}
                      onChange={(e) => setVenueAddress(e.target.value)}
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="memo">상세 메모</FieldLabel>
                    <Textarea
                      id="memo"
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      rows={5}
                    />
                  </Field>
                </FieldGroup>

                <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-border">
                  <Button type="button" variant="outline" asChild disabled={isSubmitting}>
                    <Link href="/admin/customers">취소</Link>
                  </Button>
                  <Button type="submit" className="gap-2" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    저장하기
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>

          {/* Original Orderer & Form Submission Info Card (Request 2) */}
          <Card className="mt-6">
            <CardHeader className="bg-muted/10 border-b border-border py-3">
              <CardTitle className="text-sm font-semibold text-foreground">계약 및 정보 수집 기록 (원본)</CardTitle>
              <CardDescription className="text-[10px]">신규 고객 등록 시 기입한 원본 계약 데이터와 고객의 폼 제출 일시입니다.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 text-xs text-slate-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 bg-muted/20 p-2.5 rounded-lg border border-border/60">
                  <span className="text-[10px] text-muted-foreground block font-medium">원래 주문자 이름</span>
                  <span className="font-semibold text-sm">
                    {originalOrderer || (customer?.groom_name !== '미지정' ? customer?.groom_name : customer?.bride_name) || '기록 없음'}
                  </span>
                </div>
                <div className="space-y-1 bg-muted/20 p-2.5 rounded-lg border border-border/60">
                  <span className="text-[10px] text-muted-foreground block font-medium">원래 연락처</span>
                  <span className="font-semibold text-sm">{originalPhone || customer?.phone || '기록 없음'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1 bg-muted/10 p-2 border border-border/60 rounded">
                  <span className="text-[10px] text-muted-foreground block">선택한 지류 청첩장</span>
                  <span className="font-medium">{paperType || '기록 없음'}</span>
                </div>
                <div className="space-y-1 bg-muted/10 p-2 border border-border/60 rounded">
                  <span className="text-[10px] text-muted-foreground block">모바일 청첩장 계약 여부</span>
                  <span className="font-medium">{mobileYn ? `${mobileYn}` : '기록 없음'}</span>
                </div>
                <div className="space-y-1 bg-muted/10 p-2 border border-border/60 rounded">
                  <span className="text-[10px] text-muted-foreground block">고객 폼 제출 시간</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {formSubmissionTime ? new Date(formSubmissionTime).toLocaleString('ko-KR') : '미제출'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Info Panel (1/3 width) */}
        <div className="space-y-6">
          {/* Form Links Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">정보 수집 폼 상태</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formInstance ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">폼 발행 상태:</span>
                    <Badge variant={formInstance.status === 'completed' ? 'default' : 'secondary'}>
                      {formInstance.status === 'active' ? '작성중' : formInstance.status === 'completed' ? '제출 완료' : formInstance.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1.5 pt-2">
                    <span className="text-xs font-medium text-muted-foreground">고객 정보 수집 링크</span>
                    <div className="flex gap-2">
                      <Input
                        value={`${baseUrl}/form/${formInstance.unique_url_slug}`}
                        readOnly
                        className="text-xs h-9 bg-muted"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => handleCopy(`${baseUrl}/form/${formInstance.unique_url_slug}`, 'form')}
                      >
                        {copiedLink === 'form' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <Button variant="outline" className="w-full text-xs h-9 gap-1.5" asChild>
                    <a href={`/form/${formInstance.unique_url_slug}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" /> 폼 화면 열기
                    </a>
                  </Button>

                  {formInstance.status === 'completed' || formInstance.form_submissions?.[0] ? (
                    <Button variant="default" className="w-full text-xs h-9 gap-1.5" asChild>
                      <Link href={`/admin/forms/responses/${formInstance.id}`}>
                        <FileCheck className="w-3.5 h-3.5" /> 고객 제출 내용 보기 / 수정
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full text-xs h-9 gap-1.5" disabled>
                      고객 미제출
                    </Button>
                  )}

                  {isNewVersionAvailable && (
                    <div className="p-3 rounded-lg bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-2 mt-2">
                      <div>
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">새 양식 버전 감지됨</p>
                        <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
                          연동된 템플릿의 필드 구성이 변경되었습니다. 고객에게 새로운 필드 세트를 반영하시겠습니까?
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={handleUpdateFormVersion}
                        disabled={isUpdatingVersion}
                        className="w-full text-xs h-8 bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800 text-white gap-1.5"
                      >
                        {isUpdatingVersion ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        최신 양식 버전으로 업데이트
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 space-y-3">
                  <p className="text-sm text-muted-foreground">아직 발행된 정보 수집 폼이 없습니다.</p>
                  <Button variant="outline" className="w-full text-xs" asChild>
                    <Link href={`/admin/forms/publish?customerId=${customerId}`}>
                      정보 수집 폼 발행하기
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invitation Links Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">모바일 청첩장 발행 상태</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {invitation ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">청첩장 상태:</span>
                    <Badge variant={invitation.status === 'published' ? 'default' : 'secondary'}>
                      {invitation.status === 'published' ? '발행완료' : '작성중'}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs font-medium text-muted-foreground">하객용 모바일 청첩장 URL</span>
                    <div className="flex gap-2">
                      <Input
                        value={`${baseUrl}/w/${invitation.public_slug}`}
                        readOnly
                        className="text-xs h-9 bg-muted"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => handleCopy(`${baseUrl}/w/${invitation.public_slug}`, 'public')}
                      >
                        {copiedLink === 'public' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs font-medium text-muted-foreground">고객용 관리 대시보드 URL</span>
                    <div className="flex gap-2">
                      <Input
                        value={`${baseUrl}/dashboard/${invitation.dashboard_slug}`}
                        readOnly
                        className="text-xs h-9 bg-muted"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => handleCopy(`${baseUrl}/dashboard/${invitation.dashboard_slug}`, 'dashboard')}
                      >
                        {copiedLink === 'dashboard' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs bg-muted/50 p-2.5 rounded-lg">
                    <span className="text-muted-foreground">대시보드 패스워드:</span>
                    <span className="font-mono font-bold tracking-wider">{invitation.dashboard_password}</span>
                  </div>

                  <Button className="w-full text-xs h-9 gap-1.5" asChild>
                    <Link href={`/admin/invitations/editor/${invitation.id}`}>
                      <Save className="w-3.5 h-3.5" /> 청첩장 편집기 열기
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4 space-y-3 font-sans">
                  <p className="text-sm text-muted-foreground">발행되거나 제작 중인 모바일 청첩장이 없습니다.</p>
                  
                  <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-base font-semibold">신규 모바일 청첩장 초안 생성</DialogTitle>
                        <DialogDescription className="text-xs">
                          이 고객 전용 모바일 청첩장 초안을 생성하고 편집기를 엽니다.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleCreateInvitation} className="space-y-4 text-xs mt-2">
                        <Field>
                          <FieldLabel>디자인 테마 선택 *</FieldLabel>
                          <Select value={selectedThemeId} onValueChange={setSelectedThemeId}>
                            <SelectTrigger className="h-8 text-xs bg-muted/10">
                              <SelectValue placeholder="디자인 테마 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">테마 선택</SelectItem>
                              {themes?.map((t: any) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>

                        <Field>
                          <FieldLabel>접속 숏링크 주소 (slug) *</FieldLabel>
                          <Input
                            value={publicSlug}
                            onChange={(e) => setPublicSlug(e.target.value)}
                            placeholder="예: wedding-june"
                            className="h-8 text-xs"
                            required
                          />
                          <p className="text-[10px] text-muted-foreground">
                            영문 소문자, 숫자, 하이픈(-)만 입력 가능
                          </p>
                        </Field>

                        <DialogFooter className="pt-4 border-t border-border">
                          <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
                            취소
                          </Button>
                          <Button type="submit" size="sm" disabled={isCreatingInvite} className="gap-2">
                            {isCreatingInvite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                            제작하기 (편집기로 이동)
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <Button variant="outline" className="w-full text-xs" onClick={() => setIsCreateModalOpen(true)}>
                    초안 자동생성 / 제작하기
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
