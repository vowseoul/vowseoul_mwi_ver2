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
  const [groomName, setGroomName] = useState('')
  const [brideName, setBrideName] = useState('')
  const [phone, setPhone] = useState('')
  const [weddingDate, setWeddingDate] = useState('')
  const [weddingTime, setWeddingTime] = useState('')
  const [venueName, setVenueName] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [assignedTo, setAssignedTo] = useState('none')
  const [memo, setMemo] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!groomName.trim() || !brideName.trim() || !weddingDate || !venueName.trim() || !venueAddress.trim()) {
      toast.error('필수 항목을 모두 입력해주세요.')
      return
    }

    setIsSubmitting(true)

    try {
      await createMutation.mutateAsync({
        groom_name: groomName,
        bride_name: brideName,
        phone: phone || null,
        wedding_date: weddingDate,
        venue_name: venueName,
        venue_address: venueAddress,
        venue_coordinates: null,
        transportation_info: null,
        status: 'registered',
        memo: memo || null,
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
          <p className="text-sm text-muted-foreground mt-1">지류 및 모바일 청첩장 제작을 위한 기본 정보를 수집할 고객을 등록합니다</p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="groomName">신랑 이름 *</FieldLabel>
                  <Input
                    id="groomName"
                    value={groomName}
                    onChange={(e) => setGroomName(e.target.value)}
                    placeholder="신랑 이름 입력"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="brideName">신부 이름 *</FieldLabel>
                  <Input
                    id="brideName"
                    value={brideName}
                    onChange={(e) => setBrideName(e.target.value)}
                    placeholder="신부 이름 입력"
                    required
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="phone">연락처</FieldLabel>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="010-XXXX-XXXX"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="assignedTo">담당자 지정</FieldLabel>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger id="assignedTo">
                      <SelectValue placeholder="담당자 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">없음</SelectItem>
                      {!isLoadingProfiles && profiles?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.role === 'ADMIN' ? '운영자' : '디자이너'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <FieldLabel htmlFor="weddingTime">예식 시간</FieldLabel>
                  <Input
                    id="weddingTime"
                    type="time"
                    value={weddingTime}
                    onChange={(e) => setWeddingTime(e.target.value)}
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="venueName">예식장 이름 (식장/홀) *</FieldLabel>
                <Input
                  id="venueName"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="예: 더채플앳청담 3층 커스티 홀"
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="venueAddress">도로명 주소 *</FieldLabel>
                <Input
                  id="venueAddress"
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  placeholder="예: 서울특별시 강남구 학동로 1212"
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="memo">상세 메모</FieldLabel>
                <Textarea
                  id="memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="지류 청첩장 수량, 특이사항 등을 기록합니다."
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
