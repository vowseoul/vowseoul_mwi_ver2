'use client'

import React, { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { useFormSubmissionQuery, useUpdateSubmissionMutation } from '@/hooks/queries/useForms'
import { ArrowLeft, Save, Loader2, FileCheck } from 'lucide-react'
import { toast } from 'sonner'

export default function FormResponsePage({ params }: { params: Promise<{ instanceId: string }> }) {
  const { instanceId } = use(params)
  const router = useRouter()

  const { data: submission, isLoading, error } = useFormSubmissionQuery(instanceId)
  const updateMutation = useUpdateSubmissionMutation()

  // Local state to manage editable form data
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Populate data
  useEffect(() => {
    if (submission?.data) {
      setFormData(submission.data)
    }
  }, [submission])

  const handleInputChange = (key: string, val: any) => {
    setFormData((prev) => ({ ...prev, [key]: val }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      await updateMutation.mutateAsync({
        submissionId: submission.id,
        data: formData,
      })
      toast.success('고객 제출 정보가 성공적으로 수정되었습니다.')
      router.push(`/admin/customers/${submission.form_instance?.customer?.id}`)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="w-full h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm mt-4">고객 제출 내용을 불러오는 중입니다...</p>
      </div>
    )
  }

  if (error || !submission) {
    return (
      <div className="w-full h-[60vh] flex flex-col items-center justify-center">
        <p className="text-destructive font-semibold">제출 응답을 찾을 수 없거나 에러가 발생했습니다.</p>
        <Button className="mt-4" onClick={() => router.back()}>
          이전 화면으로 돌아가기
        </Button>
      </div>
    )
  }

  const customer = submission.form_instance?.customer
  const fields = submission.form_instance?.fields_snapshot || []

  const renderInputField = (field: any) => {
    const value = formData[field.field_key] || ''

    switch (field.field_type) {
      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleInputChange(field.field_key, e.target.value)}
            rows={3}
            className="text-xs bg-muted/10"
          />
        )
      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleInputChange(field.field_key, e.target.value)}
            className="h-8 text-xs bg-muted/10"
          />
        )
      case 'time':
        return (
          <Input
            type="time"
            value={value}
            onChange={(e) => handleInputChange(field.field_key, e.target.value)}
            className="h-8 text-xs bg-muted/10"
          />
        )
      case 'select':
        return (
          <Select 
            value={value} 
            onValueChange={(val) => handleInputChange(field.field_key, val)}
          >
            <SelectTrigger className="h-8 text-xs bg-muted/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt: string) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              )) || (
                <>
                  <SelectItem value="선택 A">선택 A</SelectItem>
                  <SelectItem value="선택 B">선택 B</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        )
      case 'image':
        return (
          <div className="space-y-2">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onloadend = () => {
                    handleInputChange(field.field_key, reader.result)
                  }
                  reader.readAsDataURL(file)
                }
              }}
              className="text-xs"
            />
            {value && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="Preview" className="h-24 object-cover rounded-lg border border-border" />
            )}
          </div>
        )
      default:
        return (
          <Input
            type={field.field_type === 'number' ? 'number' : 'text'}
            value={value}
            onChange={(e) => handleInputChange(field.field_key, e.target.value)}
            className="h-8 text-xs bg-muted/10"
          />
        )
    }
  }

  return (
    <div className="space-y-6 font-sans max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              폼 응답 확인 및 수정 ({customer?.groom_name} & {customer?.bride_name})
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              고객이 직접 제출한 설문 원본 정보를 확인하고, 필요 시 관리자가 강제 수정/정규화합니다
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader className="bg-muted/10 border-b border-border pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-green-600" /> 제출 응답 상세 데이터
            </CardTitle>
            <CardDescription className="text-xs">
              예식 및 지류 연동에 누락된 필드가 없는지 확인 후 변경 사항을 저장하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <FieldGroup className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map((field: any) => (
                <div key={field.field_key} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-semibold text-slate-700">
                      {field.label}
                      {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {field.field_key}
                    </span>
                  </div>
                  {renderInputField(field)}
                </div>
              ))}
            </FieldGroup>

            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-border">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>
                취소
              </Button>
              <Button type="submit" className="gap-2" disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                저장 후 업데이트
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
