'use client'

import React, { useState, useEffect, use, Suspense } from 'react'
import { useRouter } from 'next/navigation'
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
import { useFormInstanceBySlugQuery, useSubmitFormMutation } from '@/hooks/queries/useForms'
import { 
  Lock, 
  Send, 
  CheckCircle2, 
  Loader2, 
  ChevronRight, 
  ChevronLeft, 
  Home,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/logo'

function PublicFormContent({ slug }: { slug: string }) {
  const router = useRouter()
  const { data: instance, isLoading, error } = useFormInstanceBySlugQuery(slug)
  const submitMutation = useSubmitFormMutation()

  // Password Lock state
  const [password, setPassword] = useState('')
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  // Form Value state { field_key: value }
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Initialize password lock & form values
  useEffect(() => {
    if (instance) {
      if (!instance.access_password) {
        setIsUnlocked(true)
      }
      
      // Initialize default empty values for each field
      const defaults: Record<string, any> = {}
      instance.fields_snapshot.forEach((f: any) => {
        defaults[f.field_key] = ''
      })
      setFormValues(defaults)
    }
  }, [instance])

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (instance && password === instance.access_password) {
      setIsUnlocked(true)
      setPasswordError('')
    } else {
      setPasswordError('비밀번호가 올바르지 않습니다. 다시 확인해주세요.')
      toast.error('비밀번호 불일치')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm font-light">정보 수집 양식을 불러오고 있습니다...</p>
        </div>
      </div>
    )
  }

  if (error || !instance) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans p-4">
        <Card className="w-full max-w-md text-center py-8">
          <CardContent className="space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">찾을 수 없는 양식</h2>
              <p className="text-sm text-muted-foreground">
                입력 양식이 만료되었거나, 주소가 잘못되었습니다. 운영팀에 문의해주세요.
              </p>
            </div>
            <Button className="w-full" onClick={() => router.push('/')}>
              메인 화면으로 이동
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check if form is expired
  if (instance.status === 'expired' || (instance.expires_at && new Date() > new Date(instance.expires_at))) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans p-4">
        <Card className="w-full max-w-md text-center py-8">
          <CardContent className="space-y-4">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">만료된 입력 링크</h2>
              <p className="text-sm text-muted-foreground">
                이 정보 수집 링크는 만료기한이 지나 비활성화되었습니다.
              </p>
            </div>
            <Button className="w-full" onClick={() => router.push('/')}>
              메인 화면으로 이동
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Password Lock Screen
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex justify-center">
              <Logo className="h-6 w-auto" />
            </div>
            <CardTitle className="text-xl font-bold flex items-center justify-center gap-2">
              <Lock className="w-5 h-5 text-slate-500" /> 정보 수집 폼 접속
            </CardTitle>
            <CardDescription className="text-xs">
              본 양식은 비밀번호로 보안 설정되어 있습니다.<br />
              지정된 비밀번호를 입력해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Field>
                <FieldLabel htmlFor="passwordInput">접속 비밀번호</FieldLabel>
                <Input
                  id="passwordInput"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  required
                  className="h-10"
                />
              </Field>

              {passwordError && (
                <p className="text-xs text-destructive">{passwordError}</p>
              )}

              <Button type="submit" className="w-full h-10">
                입력 페이지 열기
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Submitted Screen
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans px-4">
        <Card className="w-full max-w-md text-center py-8">
          <CardContent className="space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">제출 완료!</h2>
              <p className="text-sm text-muted-foreground px-4">
                축하드립니다! 모바일 청첩장 제작을 위한 예식 기본 정보 수집이 완료되었습니다.<br /><br />
                운영진이 보내주신 세부 내용을 확인하여 신속하게 초안 작업을 진행하겠습니다.
              </p>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                수정 사항이 있는 경우, 기존 전송받은 폼 주소로 다시 접속하여 정보를 업데이트 하실 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Organize fields by category steps
  const stepsMap: Record<string, any[]> = {}
  instance.fields_snapshot.forEach((field: any) => {
    const cat = field.category || '기타 정보'
    if (!stepsMap[cat]) {
      stepsMap[cat] = []
    }
    stepsMap[cat].push(field)
  })

  const stepKeys = Object.keys(stepsMap)
  const currentStepKey = stepKeys[currentStep]
  const currentFields = stepsMap[currentStepKey] || []

  const handleInputChange = (key: string, val: any) => {
    setFormValues((prev) => ({ ...prev, [key]: val }))
  }

  const handleNext = () => {
    // Validate current step fields
    const missingFields = currentFields.filter(
      (f) => f.is_required && (!formValues[f.field_key] || formValues[f.field_key].toString().trim() === '')
    )

    if (missingFields.length > 0) {
      toast.error(`필수 항목을 입력해주세요: ${missingFields.map((f) => f.label).join(', ')}`)
      return
    }

    if (currentStep < stepKeys.length - 1) {
      setCurrentStep((c) => c + 1)
      window.scrollTo(0, 0)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((c) => c - 1)
      window.scrollTo(0, 0)
    }
  }

  const handleSubmit = async () => {
    // Final check for all fields
    const allMissing: string[] = []
    instance.fields_snapshot.forEach((f: any) => {
      if (f.is_required && (!formValues[f.field_key] || formValues[f.field_key].toString().trim() === '')) {
        allMissing.push(f.label)
      }
    })

    if (allMissing.length > 0) {
      toast.error(`입력하지 않은 필수 항목이 있습니다: ${allMissing.join(', ')}`)
      return
    }

    setSubmitting(true)
    try {
      await submitMutation.mutateAsync({
        instanceId: instance.id,
        customerId: instance.customer_id,
        data: formValues,
        isComplete: true,
      })
      setIsSubmitted(true)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '제출 중 문제가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const renderInputField = (field: any) => {
    const value = formValues[field.field_key] || ''

    switch (field.field_type) {
      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleInputChange(field.field_key, e.target.value)}
            placeholder={field.help_text || '내용을 입력하세요.'}
            rows={4}
            required={field.is_required}
          />
        )
      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleInputChange(field.field_key, e.target.value)}
            required={field.is_required}
          />
        )
      case 'time':
        return (
          <Input
            type="time"
            value={value}
            onChange={(e) => handleInputChange(field.field_key, e.target.value)}
            required={field.is_required}
          />
        )
      case 'select':
        return (
          <Select 
            value={value} 
            onValueChange={(val) => handleInputChange(field.field_key, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="선택하세요" />
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
              required={field.is_required}
            />
            {value && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="Preview" className="h-32 object-cover rounded-lg border border-border" />
            )}
          </div>
        )
      default:
        return (
          <Input
            type={field.field_type === 'number' ? 'number' : 'text'}
            value={value}
            onChange={(e) => handleInputChange(field.field_key, e.target.value)}
            placeholder={field.help_text || '내용을 입력하세요.'}
            required={field.is_required}
          />
        )
    }
  }

  const progressPercent = Math.round(((currentStep + 1) / stepKeys.length) * 100)

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      {/* Public Header */}
      <header className="bg-white border-b border-border py-4 px-6 flex justify-between items-center shadow-sm">
        <Logo className="h-5 w-auto" />
        <div className="text-right">
          <span className="text-xs font-semibold text-primary block">
            {instance.customer?.groom_name} & {instance.customer?.bride_name}
          </span>
          <span className="text-[10px] text-muted-foreground block">
            결혼식 정보 입력 양식
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 space-y-6">
        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>단계 {currentStep + 1} / {stepKeys.length} ({currentStepKey})</span>
            <span>{progressPercent}% 완료</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {/* Card for Current Step Fields */}
        <Card className="shadow-lg border-border">
          <CardHeader className="bg-muted/10 border-b border-border pb-4">
            <CardTitle className="text-base font-semibold">{currentStepKey} 작성</CardTitle>
            <CardDescription className="text-xs">
              결혼식 및 초대장 제작에 필요한 세부 내용을 입력해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <FieldGroup className="space-y-5">
              {currentFields.map((field) => (
                <Field key={field.field_key}>
                  <FieldLabel htmlFor={field.field_key}>
                    {field.label}
                    {field.is_required && <span className="text-red-500 ml-1">*</span>}
                  </FieldLabel>
                  {renderInputField(field)}
                </Field>
              ))}
            </FieldGroup>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center gap-3 mt-8 pt-6 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="gap-1.5 text-xs h-9 px-3.5"
              >
                <ChevronLeft className="w-4 h-4" /> 이전
              </Button>

              {currentStep === stepKeys.length - 1 ? (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="gap-1.5 text-xs h-9 px-4 bg-primary hover:bg-primary/90"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  제출 완료하기
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="gap-1.5 text-xs h-9 px-3.5"
                >
                  다음 <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <PublicFormContent slug={slug} />
    </Suspense>
  )
}
