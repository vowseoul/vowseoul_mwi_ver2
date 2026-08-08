'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { useAppStore, type Order } from '@/lib/store'
import { supabase, logSupabaseError } from '@/lib/supabase'
import { ChevronLeft, Save, Loader2, ExternalLink, Copy, Pencil } from 'lucide-react'
import { toast } from 'sonner'

interface InvitationRef {
  id: string
  public_slug: string | null
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [invitation, setInvitation] = useState<InvitationRef | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadOrderAndInvitation()
  }, [orderId])

  const loadOrderAndInvitation = async () => {
    setIsLoading(true)
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()
      if (orderError) throw orderError

      // orders 는 고객/청첩장 정보를 중복 보관하지 않으므로 customer_id 로 표시용 정보를 채운다.
      let customer: any = null
      if (orderData.customer_id) {
        const { data: custData, error: custError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', orderData.customer_id)
          .maybeSingle()
        logSupabaseError('order detail: customer', custError)
        customer = custData
      }

      setOrder({
        id: orderData.id,
        invitationId: orderData.invitation_id,
        customerName: customer ? `${customer.groom_name} & ${customer.bride_name}` : (orderData.external_order_ref || '고객 미지정'),
        groomName: customer?.groom_name || '',
        brideName: customer?.bride_name || '',
        weddingDate: customer?.wedding_date || '',
        theme: '',
        amount: orderData.amount,
        status: orderData.status,
        notes: orderData.notes || '',
        createdAt: orderData.created_at ? orderData.created_at.split('T')[0] : '',
      })

      if (orderData.invitation_id) {
        const { data: inviteData, error: inviteError } = await supabase
          .from('invitations')
          .select('id, public_slug')
          .eq('id', orderData.invitation_id)
          .maybeSingle()
        logSupabaseError('order detail: invitation', inviteError)
        if (inviteData) setInvitation({ id: inviteData.id, public_slug: inviteData.public_slug })
      }
    } catch (err: any) {
      console.error('Error loading order or invitation:', err)
      toast.error('주문 정보를 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!order) return
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          amount: order.amount,
          status: order.status,
          notes: order.notes,
        })
        .eq('id', orderId)
      if (error) throw error

      useAppStore.setState((state) => ({
        orders: state.orders.map((o) => (o.id === orderId ? order : o)),
      }))
      toast.success('주문 내역이 저장되었습니다.')
    } catch (err: any) {
      console.error('Error saving order:', err)
      toast.error(err.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || !order) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 -mt-2">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/orders">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">주문 상세</h1>
            <p className="text-muted-foreground">
              주문 번호: <span className="font-semibold">{order.id}</span> · 고객명:{' '}
              <span className="font-semibold">{order.customerName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {invitation?.id && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!invitation.public_slug) {
                    toast.error('발행 슬러그가 없어 대시보드 링크를 만들 수 없습니다.')
                    return
                  }
                  const url = `${window.location.origin}/dashboard/${invitation.public_slug}`
                  navigator.clipboard.writeText(url)
                  toast.success('고객용 대시보드 링크가 복사되었습니다.')
                }}
                className="flex items-center gap-1.5"
              >
                <Copy className="h-4 w-4" />
                대시보드 링크 복사
              </Button>
              <Button variant="outline" size="sm" asChild disabled={!invitation.public_slug}>
                <Link href={invitation.public_slug ? `/w/${invitation.public_slug}` : '#'} target="_blank" className="flex items-center gap-1.5">
                  <ExternalLink className="h-4 w-4" />
                  배포된 화면 보기
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={`/admin/invitations/editor/${invitation.id}`} className="flex items-center gap-1.5">
                  <Pencil className="h-4 w-4" />
                  청첩장 편집기 열기
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">주문 내역 제어</CardTitle>
          <CardDescription>수동 등록된 개인 의뢰 주문 내역을 편집합니다. 청첩장의 문구·사진·디자인은 청첩장 편집기에서 수정하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="custName">고객 / 주문자명</FieldLabel>
              <Input
                id="custName"
                value={order.customerName}
                onChange={(e) => setOrder({ ...order, customerName: e.target.value })}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="ordAmount">결제 금액 (원)</FieldLabel>
                <Input
                  id="ordAmount"
                  type="number"
                  value={order.amount}
                  onChange={(e) => setOrder({ ...order, amount: parseInt(e.target.value) || 0 })}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="ordStatus">주문 상태</FieldLabel>
                <Select
                  value={order.status}
                  onValueChange={(val: Order['status']) => setOrder({ ...order, status: val })}
                >
                  <SelectTrigger id="ordStatus">
                    <SelectValue />
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
              <FieldLabel htmlFor="ordNotes">관리 메모 / 특이사항</FieldLabel>
              <Textarea
                id="ordNotes"
                rows={6}
                placeholder="이곳에 제작 관련 의뢰 파일 링크나 가이드를 입력하세요."
                value={order.notes}
                onChange={(e) => setOrder({ ...order, notes: e.target.value })}
              />
            </Field>
          </FieldGroup>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} className="text-white bg-foreground hover:bg-foreground/90">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              저장하기
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
