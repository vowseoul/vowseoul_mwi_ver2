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
import { ArrowLeft, Save, Copy, Check, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function CustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = use(params)
  const router = React.useRouter ? React.useRouter() : null // fallback in case useRouter isn't natively bound

  const { data: customer, isLoading, error } = useCustomerQuery(customerId)
  const updateMutation = useUpdateCustomerMutation()
  const { data: formInstance } = useCustomerFormInstanceQuery(customerId)
  const { data: invitation } = useCustomerInvitationQuery(customerId)
  const { data: profiles, isLoading: isLoadingProfiles } = useProfilesQuery()

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
                          {!isLoadingProfiles && profiles?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} ({p.role === 'ADMIN' ? '운영자' : '디자이너'})
                            </SelectItem>
                          ))}
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
                <div className="text-center py-4 space-y-3">
                  <p className="text-sm text-muted-foreground">발행되거나 제작 중인 모바일 청첩장이 없습니다.</p>
                  <Button variant="outline" className="w-full text-xs" asChild>
                    <Link href={`/admin/invitations/new/${customerId}`}>
                      초안 자동생성 / 제작하기
                    </Link>
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
