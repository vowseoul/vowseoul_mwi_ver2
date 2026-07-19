'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { useCreateCustomerMutation, useProfilesQuery } from '@/hooks/queries/useCustomers'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function NewCustomerPage() {
  const router = useRouter()
  const createMutation = useCreateCustomerMutation()
  const { data: profiles, isLoading: isLoadingProfiles } = useProfilesQuery()

  // Form State
  const [orderer, setOrderer] = useState('')
  const [ordererType, setOrdererType] = useState<'groom' | 'bride'>('groom')
  const [phone, setPhone] = useState('')
  const [assignedTo, setAssignedTo] = useState('none')
  const [paperType, setPaperType] = useState('클래식 화이트')
  const [mobileYn, setMobileYn] = useState('O')
  const [memo, setMemo] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!orderer.trim()) {
      toast.error('주문자 이름을 입력해주세요.')
      return
    }

    setIsSubmitting(true)

    try {
      // Calculate dummy wedding date (90 days from now)
      const dummyDate = new Date()
      dummyDate.setDate(dummyDate.getDate() + 90)
      const weddingDateString = dummyDate.toISOString().slice(0, 10)

      const isGroom = ordererType === 'groom'
      const formattedMemo = `[주문자: ${orderer} (${isGroom ? '신랑' : '신부'}) | 연락처: ${phone} | 지류: ${paperType} | 모바일: ${mobileYn}]${memo ? ` / 메모: ${memo}` : ''}`

      await createMutation.mutateAsync({
        groom_name: isGroom ? orderer.trim() : '미지정',
        bride_name: isGroom ? '미지정' : orderer.trim(),
        phone: phone.trim() || null,
        wedding_date: weddingDateString,
        venue_name: '미지정',
        venue_address: '미지정',
        venue_coordinates: null,
        transportation_info: null,
        status: 'registered',
        memo: formattedMemo,
        assigned_to: assignedTo === 'none' ? null : assignedTo,
      })

      toast.success('신규 고객이 성공적으로 등록되었습니다.')
      router.push('/admin/customers')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '고객 등록 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 font-sans max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/customers">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">신규 고객 등록</h1>
          <p className="text-sm text-muted-foreground mt-1">지류 및 모바일 청첩장 계약 내용에 맞춰 신규 고객을 등록합니다.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">고객 기본 정보</CardTitle>
            <CardDescription>
              *는 필수 입력 항목입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field>
                  <FieldLabel htmlFor="orderer">주문자 이름 *</FieldLabel>
                  <Input
                    id="orderer"
                    value={orderer}
                    onChange={(e) => setOrderer(e.target.value)}
                    placeholder="주문자 이름 입력"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ordererType">주문자 구분 *</FieldLabel>
                  <Select value={ordererType} onValueChange={(val: any) => setOrdererType(val)}>
                    <SelectTrigger id="ordererType">
                      <SelectValue placeholder="구분 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="groom">신랑</SelectItem>
                      <SelectItem value="bride">신부</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="phone">연락처</FieldLabel>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="010-XXXX-XXXX"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field>
                  <FieldLabel htmlFor="assignedTo">담당자 지정</FieldLabel>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger id="assignedTo">
                      <SelectValue placeholder="담당자 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">없음</SelectItem>
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

                <Field>
                  <FieldLabel htmlFor="paperType">지류 청첩장</FieldLabel>
                  <Select value={paperType} onValueChange={setPaperType}>
                    <SelectTrigger id="paperType">
                      <SelectValue placeholder="지류 종류 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="클래식 화이트">클래식 화이트</SelectItem>
                      <SelectItem value="시그니처 레더">시그니처 레더</SelectItem>
                      <SelectItem value="럭스 골드">럭스 골드</SelectItem>
                      <SelectItem value="오가닉 린넨">오가닉 린넨</SelectItem>
                      <SelectItem value="선택 안 함 (지류 없음)">선택 안 함 (지류 없음)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="mobileYn">모바일 청첩장 여부</FieldLabel>
                  <Select value={mobileYn} onValueChange={setMobileYn}>
                    <SelectTrigger id="mobileYn">
                      <SelectValue placeholder="모바일 여부 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="O">O (예)</SelectItem>
                      <SelectItem value="X">X (아니오)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="memo">상세 메모</FieldLabel>
                <Textarea
                  id="memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="특이사항이나 추가 요청 사항을 기입하세요."
                  rows={4}
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
                등록하기
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
