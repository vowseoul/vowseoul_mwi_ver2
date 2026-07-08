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
import { ChevronLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function CreateOrderPage() {
  const router = useRouter()
  const { themes, fetchData } = useAppStore()
  
  const [isLoading, setIsLoading] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [amount, setAmount] = useState('50000')
  const [status, setStatus] = useState<'pending' | 'paid' | 'deployed'>('paid')
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
      const themeObj = availableThemes.find(t => t.id === selectedThemeId) || availableThemes[0]
      
      // 1. Generate invitation ID
      const randId = typeof window !== 'undefined' && window.crypto?.randomUUID 
        ? window.crypto.randomUUID() 
        : 'inv-admin-' + Math.random().toString(36).substring(2, 15)
      const invitationId = `custom__${randId}`

      // Default wedding date is 3 months from now
      const defaultDate = new Date()
      defaultDate.setMonth(defaultDate.getMonth() + 3)
      const defaultDateStr = defaultDate.toISOString().split('T')[0]

      // 2. Create Default Invitation Data
      const defaultInvitation = {
        id: invitationId,
        groomName: '신랑',
        groomNameEn: 'Groom',
        groomParentRelation: '의 장남',
        brideName: '신부',
        brideNameEn: 'Bride',
        brideParentRelation: '의 장녀',
        weddingDate: defaultDateStr,
        weddingTime: '12:00',
        venueName: '아름다운 웨딩홀',
        venueHall: '그랜드홀',
        venueAddress: '서울특별시 중구 태평로1가 31',
        themeId: selectedThemeId,
        colorSet: themeObj.colorSets?.[0]?.id || 'default',
        fontSet: themeObj.fontSets?.[0]?.id || 'default',
        mainImage: null,
        invitationMessage: '서로 다른 길을 걸어온 저희 두 사람이\n이제 하나의 길을 함께 걸어가려 합니다.\n귀한 걸음으로 축복해 주시면 감사하겠습니다.',
        galleryImages: [],
        galleryViewType: 'slide',
        trafficInfo: '지하철 시청역 5번 출구 바로 앞',
        parkingInfo: '하객 전용 주차장 2시간 무료 이용 가능',
        rsvpEnabled: true,
        rsvpMealEnabled: true,
        rsvpCommentEnabled: true,
        guestbookType: 'text',
        bgmId: (themeObj as any).recommendedBgms?.[0] || 'bgm1',
        kakaoThumbnail: null,
        kakaoTitle: '신랑 ❤️ 신부 결혼합니다!',
        kakaoDescription: `${defaultDate.getFullYear()}년 ${defaultDate.getMonth() + 1}월 ${defaultDate.getDate()}일`,
        bankAccounts: [],
        contacts: [],
        status: 'draft',
        createdAt: new Date().toISOString(),
        publishedUrl: null,
        customStyles: {}
      }

      const { error: inviteError } = await supabase.from('invitations').insert(defaultInvitation)
      if (inviteError) throw inviteError

      // 3. Create Default Order Data
      const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000)
      const newOrder = {
        id: orderId,
        invitationId: invitationId,
        customerName: customerName,
        groomName: '신랑',
        brideName: '신부',
        weddingDate: defaultDateStr,
        theme: themeObj.name,
        amount: parseInt(amount) || 50000,
        status: status,
        createdAt: new Date().toISOString().split('T')[0],
        notes: notes
      }

      const { error: orderError } = await supabase.from('orders').insert(newOrder)
      if (orderError) throw orderError

      toast.success('수동 주문 및 청첩장 초안이 정상 생성되었습니다!')
      router.push(`/admin/orders/${orderId}`)
    } catch (err: any) {
      console.error('Error creating manual order:', err)
      
      const isMissingColumn = err.code === 'PGRST204' || 
                              (err.message && (err.message.includes('customStyles') || err.message.includes('column')));
      
      if (isMissingColumn) {
        toast.error(
          'Supabase 테이블에 "customStyles" 컬럼이 없거나 캐시되지 않았습니다. Supabase SQL Editor에서 ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS "customStyles" jsonb; 를 실행해주세요.',
          { duration: 8000 }
        )
      } else {
        toast.error(err.message || '생성 중 오류가 발생했습니다.')
      }
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
                      <SelectItem value="pending">결제대기 (Pending)</SelectItem>
                      <SelectItem value="paid">결제완료 (Paid)</SelectItem>
                      <SelectItem value="deployed">배포중 (Deployed)</SelectItem>
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
