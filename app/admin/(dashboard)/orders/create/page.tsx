'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { useAppStore, sampleThemes } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { useCreateInvitationMutation } from '@/hooks/queries/useInvitations'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function CreateOrderPage() {
  const router = useRouter()
  const { themes, fetchData } = useAppStore()
  const createInvitation = useCreateInvitationMutation()

  const [isLoading, setIsLoading] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [amount, setAmount] = useState('50000')
  const [status, setStatus] = useState<'registered' | 'form_sent' | 'form_completed' | 'in_production' | 'design_review' | 'published' | 'delivered'>('registered')
  const [notes, setNotes] = useState('')
  const [selectedThemeId, setSelectedThemeId] = useState('')

  // Ensure themes are loaded
  useEffect(() => {
    if (!themes || themes.length === 0) {
      fetchData()
    }
  }, [themes, fetchData])

  // Set default theme selection once themes load
  useEffect(() => {
    const availableThemes = (themes && themes.length > 0) ? themes : sampleThemes
    if (availableThemes.length > 0 && !selectedThemeId) {
      setSelectedThemeId(availableThemes[0].id)
    }
  }, [themes, selectedThemeId])

  const availableThemes = (themes && themes.length > 0) ? themes : sampleThemes

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName.trim()) {
      toast.error('주문자명을 입력해주세요.')
      return
    }
    if (!selectedThemeId) {
      toast.error('테마를 선택해주세요.')
      return
    }

    setIsLoading(true)
    try {
      // 청첩장 생성은 /admin/invitations 와 동일한 뮤테이션을 그대로 쓴다.
      //
      // 이 화면은 원래 invitations 에 직접 insert 했는데, groomName/weddingDate 같은
      // 레거시 키를 최상위 컬럼처럼 넣고(실제로는 content_data jsonb 안에 들어가야 한다)
      // customer_id/public_slug/dashboard_slug/dashboard_password/block_order/expires_at
      // (전부 NOT NULL)을 아예 채우지 않아 **항상 PGRST204 로 실패**했다.
      // 스키마를 아는 곳이 두 군데로 갈라져 있던 게 원인이라 한 곳으로 합친다.
      const publicSlug = `vow-${Math.random().toString(36).slice(2, 8)}`
      const invitation = await createInvitation.mutateAsync({
        customerId: 'mock', // 이 화면은 고객 레코드 없이 시작한다 — 임시 고객이 자동 생성된다
        themeId: selectedThemeId,
        publicSlug,
      })

      // 관리자가 입력한 주문자명은 참고용으로 external_order_ref 에 남긴다(§1-B).
      const { data: insertedOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          invitation_id: invitation.id,
          external_order_ref: customerName,
          product_type: 'mobile',
          amount: parseInt(amount) || 50000,
          status: status,
          notes: notes,
        })
        .select('id')
        .single()
      if (orderError) throw orderError

      toast.success('수동 주문 및 청첩장 초안이 정상 생성되었습니다!')
      router.push(`/admin/orders/${insertedOrder.id}`)
    } catch (err) {
      console.error('Error creating manual order:', err)
      toast.error(err instanceof Error ? err.message : '생성 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/orders">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">수동 청첩장 추가</h1>
          <p className="text-muted-foreground">고객의 의뢰 정보로 청첩장 및 주문을 수동 생성합니다.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="text-lg">기본 정보 설정</CardTitle>
            <CardDescription>주문 및 매핑할 디자인 템플릿 테마를 지정합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="customerName">주문자명 / 고객명</FieldLabel>
                <Input
                  id="customerName"
                  placeholder="예: 홍길동"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="amount">주문 결제 금액 (원)</FieldLabel>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="50000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isLoading}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="status">주문 상태</FieldLabel>
                  <Select value={status} onValueChange={(val: any) => setStatus(val)} disabled={isLoading}>
                    <SelectTrigger id="status">
                      <SelectValue placeholder="상태 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="registered">고객 등록</SelectItem>
                      <SelectItem value="form_sent">폼 발송</SelectItem>
                      <SelectItem value="form_completed">폼 작성완료</SelectItem>
                      <SelectItem value="in_production">제작중</SelectItem>
                      <SelectItem value="design_review">디자인 피드백중</SelectItem>
                      <SelectItem value="published">발행완료</SelectItem>
                      <SelectItem value="delivered">전달완료</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="theme">적용할 디자인 테마</FieldLabel>
                <Select value={selectedThemeId} onValueChange={setSelectedThemeId} disabled={isLoading}>
                  <SelectTrigger id="theme">
                    <SelectValue placeholder="테마 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableThemes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="notes">의뢰 내용 / 관리자 메모</FieldLabel>
                <Textarea
                  id="notes"
                  placeholder="고객 특별 요청사항 또는 제작 가이드를 적어주세요."
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isLoading}
                />
              </Field>
            </FieldGroup>

            <Button type="submit" className="w-full text-white bg-foreground hover:bg-foreground/90 mt-4" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  초안 생성 중...
                </>
              ) : (
                '초안 생성 및 편집하기'
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
