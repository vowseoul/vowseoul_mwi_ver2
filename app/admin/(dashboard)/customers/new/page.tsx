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
import { usePaperTypesQuery, DEFAULT_PAPER_TYPES, NO_PAPER_OPTION } from '@/hooks/queries/usePaperTypes'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function NewCustomerPage() {
  const router = useRouter()
  const createMutation = useCreateCustomerMutation()
  const { data: profiles, isLoading: isLoadingProfiles } = useProfilesQuery()
  const { data: paperTypes } = usePaperTypesQuery()

  // Form State
  const [orderer, setOrderer] = useState('')
  const [ordererType, setOrdererType] = useState<'groom' | 'bride'>('groom')
  const [phone, setPhone] = useState('')
  const [weddingDate, setWeddingDate] = useState('')
  const [assignedTo, setAssignedTo] = useState('none')
  // 초기값은 아래에서 실제 라인업의 첫 항목으로 해석한다 (setState-in-effect 회피)
  const [paperType, setPaperType] = useState('')
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
      const isGroom = ordererType === 'groom'
      // Select 가 미선택 상태면 화면에 보이는 첫 항목이 곧 선택값이다
      const resolvedPaperType = paperType || (paperTypes ?? DEFAULT_PAPER_TYPES)[0]
      const formattedMemo = `[주문자: ${orderer} (${isGroom ? '신랑' : '신부'}) | 연락처: ${phone} | 지류: ${resolvedPaperType} | 모바일: ${mobileYn}]${memo ? ` / 메모: ${memo}` : ''}`

      await createMutation.mutateAsync({
        groom_name: isGroom ? orderer.trim() : '미지정',
        bride_name: isGroom ? '미지정' : orderer.trim(),
        phone: phone.trim() || null,
        wedding_date: weddingDate || null,
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
        <Button variant="ghost" size="icon" asChild aria-label="뒤로가기">
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                {/* 예전엔 이 입력이 없어서 등록일+90일을 예식일로 넣었다. 그 값이 고객 목록의
                    "예식일시"와 폼 발행 화면에 진짜 날짜처럼 표시되고, 링크 만료일(예식일+7일)과
                    보관기간 파기 판정까지 그 가짜 날짜를 기준으로 계산돼 실제 예식보다 먼저
                    폼이 닫히는 문제가 있었다. 주문 접수 시점엔 예식일을 모르는 경우가 많으므로
                    (스마트스토어 주문 → 주문자명으로 고객 생성 → 폼 발급 순서) 비워둘 수 있고,
                    비면 NULL로 저장한 뒤 고객이 폼에 입력하면 그때 채워진다. */}
                <Field>
                  <FieldLabel htmlFor="weddingDate">예식일</FieldLabel>
                  <Input
                    id="weddingDate"
                    type="date"
                    value={weddingDate}
                    onChange={(e) => setWeddingDate(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    모르면 비워두세요. 고객이 폼에 입력하면 자동으로 채워집니다.
                  </p>
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
                  <Select
                    value={paperType || (paperTypes ?? DEFAULT_PAPER_TYPES)[0]}
                    onValueChange={setPaperType}
                  >
                    <SelectTrigger id="paperType">
                      <SelectValue placeholder="지류 종류 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* 라인업은 시스템 설정 > 일반 에서 관리한다 (settings.paper_types) */}
                      {(paperTypes ?? DEFAULT_PAPER_TYPES).map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                      <SelectItem value={NO_PAPER_OPTION}>{NO_PAPER_OPTION}</SelectItem>
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
