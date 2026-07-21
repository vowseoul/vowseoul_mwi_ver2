'use client'

import React, { useState, useEffect, use, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { useFormInstanceBySlugQuery, useSubmitFormMutation } from '@/hooks/queries/useForms'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Calendar as CalendarIcon, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Lock, 
  Send, 
  CheckCircle2, 
  Loader2, 
  ChevronRight, 
  ChevronLeft, 
  Home,
  AlertCircle,
  ZoomIn,
  Maximize2
} from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/logo'

const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return undefined
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

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
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [customSelectTexts, setCustomSelectTexts] = useState<Record<string, boolean>>({})
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)

  const handlePlayPause = (audioId: string, fileUrl: string) => {
    let aud = document.getElementById(audioId) as HTMLAudioElement
    if (!aud) {
      aud = document.createElement('audio')
      aud.id = audioId
      aud.src = fileUrl
      aud.preload = 'auto'
      aud.setAttribute('playsinline', 'true')
      document.body.appendChild(aud)
    }

    if (playingAudioId === audioId) {
      aud.pause()
      setPlayingAudioId(null)
    } else {
      if (playingAudioId) {
        const prevAud = document.getElementById(playingAudioId) as HTMLAudioElement
        if (prevAud) {
          prevAud.pause()
          prevAud.currentTime = 0
        }
      }

      aud.currentTime = 0
      aud.onended = () => setPlayingAudioId(null)
      aud.onerror = () => {
        setPlayingAudioId(null)
        toast.error('음원을 재생할 수 없습니다. 파일 링크를 확인해 주세요.')
      }

      const playPromise = aud.play()
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setPlayingAudioId(audioId)
          })
          .catch((err) => {
            console.error('Audio play error:', err)
            setPlayingAudioId(null)
            toast.error('모바일 미디어 재생 제한으로 실패했습니다. 다시 재생 버튼을 눌러주세요.')
          })
      } else {
        setPlayingAudioId(audioId)
      }
    }
  }

  useEffect(() => {
    if (playingAudioId) {
      const aud = document.getElementById(playingAudioId) as HTMLAudioElement
      if (aud) aud.pause()
      setPlayingAudioId(null)
    }
  }, [currentStep])

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

  // Helper to parse options
  const parseOptions = (field: any) => {
    if (!field.options) return {}
    if (typeof field.options === 'string') {
      try {
        return JSON.parse(field.options)
      } catch {
        return {}
      }
    }
    return field.options
  }

  // Organize fields by custom page_title or category steps
  // Organize fields by custom page_title or category steps
  const stepsMap: Record<string, any[]> = {}
  instance.fields_snapshot.forEach((field: any) => {
    const opts = parseOptions(field)
    const pageName = opts.page_title?.trim() || field.category || '기타 정보'
    if (!stepsMap[pageName]) {
      stepsMap[pageName] = []
    }
    stepsMap[pageName].push(field)
  })

  const fieldStepKeys = Object.keys(stepsMap)
  const allStepKeys = [...fieldStepKeys, '최종 확인']
  const currentStepKey = allStepKeys[currentStep]
  const currentFields = stepsMap[currentStepKey] || []

  const handleInputChange = (key: string, val: any) => {
    setFormValues((prev) => ({ ...prev, [key]: val }))
  }

  // 1. Load draft from Supabase & localStorage on init
  useEffect(() => {
    if (!instance?.id) return
    const draftKey = `vowseoul_draft_${instance.slug || instance.id}`

    let initialValues: Record<string, any> = {}

    const serverSubmission = instance.form_submissions?.[0]
    if (serverSubmission?.data) {
      initialValues = { ...serverSubmission.data }
    }

    try {
      const localData = localStorage.getItem(draftKey)
      if (localData) {
        const parsed = JSON.parse(localData)
        if (parsed.values && typeof parsed.values === 'object') {
          initialValues = { ...initialValues, ...parsed.values }
          if (typeof parsed.currentStep === 'number') {
            setCurrentStep(parsed.currentStep)
          }
        }
      }
    } catch (e) {
      console.error('Error reading localStorage draft:', e)
    }

    if (Object.keys(initialValues).length > 0) {
      setFormValues(initialValues)
    }
  }, [instance])

  // 2. Auto-save to localStorage as user types
  useEffect(() => {
    if (!instance?.id || Object.keys(formValues).length === 0) return
    const draftKey = `vowseoul_draft_${instance.slug || instance.id}`
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          values: formValues,
          currentStep,
          updatedAt: new Date().toISOString(),
        })
      )
    } catch (e) {
      // Ignore quota errors
    }
  }, [formValues, instance, currentStep])

  // 3. Manual Draft Save Handler
  const handleSaveDraft = async () => {
    setSavingDraft(true)
    const draftKey = `vowseoul_draft_${instance.slug || instance.id}`

    // Immediate Local Storage write
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          values: formValues,
          currentStep,
          updatedAt: new Date().toISOString(),
        })
      )
    } catch (e) {
      console.error('Failed to write to localStorage:', e)
    }

    // Server DB save
    try {
      await submitMutation.mutateAsync({
        instanceId: instance.id,
        customerId: instance.customer_id,
        data: formValues,
        isComplete: false,
      })
      toast.success('입력하신 내용이 임시 저장되었습니다! (이 기기 및 서버에 안전하게 보관됨)')
    } catch (err: any) {
      console.warn('Server draft save failed, saved locally:', err)
      toast.success('이 기기에 입력 내용이 임시 저장되었습니다!')
    } finally {
      setSavingDraft(false)
    }
  }

  const handleNext = () => {
    // Validate current step fields
    const missingFields = currentFields.filter((f) => {
      if (!f.is_required) return false
      
      // If it is a child field, check if its parent is triggered. If not triggered, ignore it.
      const opts = parseOptions(f)
      if (opts.parent_field_key) {
        let parentVal = (formValues[opts.parent_field_key] || '').toString().trim()
        if (parentVal === 'true') parentVal = '예'
        if (parentVal === 'false') parentVal = '아니오'
        const triggerVal = (opts.parent_trigger_option || '').toString().trim()
        if (parentVal !== triggerVal) {
          return false // Not triggered, ignore
        }
      }
      
      return !formValues[f.field_key] || formValues[f.field_key].toString().trim() === ''
    })

    if (missingFields.length > 0) {
      toast.error(`필수 항목을 입력해주세요: ${missingFields.map((f) => f.label).join(', ')}`)
      return
    }

    if (currentStep < allStepKeys.length - 1) {
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
      if (!f.is_required) return
      
      const opts = parseOptions(f)
      if (opts.parent_field_key) {
        let parentVal = (formValues[opts.parent_field_key] || '').toString().trim()
        if (parentVal === 'true') parentVal = '예'
        if (parentVal === 'false') parentVal = '아니오'
        const triggerVal = (opts.parent_trigger_option || '').toString().trim()
        if (parentVal !== triggerVal) {
          return // Parent is not triggered, skip
        }
      }
      
      if (!formValues[f.field_key] || formValues[f.field_key].toString().trim() === '') {
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
      case 'date': {
        const localDate = parseLocalDate(value)
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-10 px-3",
                  !value && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                {value && localDate ? format(localDate, 'yyyy년 MM월 dd일') : (field.help_text || '날짜를 선택하세요.')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={localDate}
                onSelect={(date) => {
                  handleInputChange(field.field_key, date ? format(date, 'yyyy-MM-dd') : '')
                }}
                locale={ko}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )
      }
      case 'time': {
        const [h, m] = value ? value.split(':') : ['', '']
        const hoursList = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
        const minutesList = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-10 px-3",
                  !value && "text-muted-foreground"
                )}
              >
                <Clock className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                {value ? `${h}시 ${m}분` : (field.help_text || '시간을 선택하세요.')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="start">
              <div className="flex gap-3 justify-center">
                <div className="flex flex-col text-center flex-1">
                  <span className="text-[10px] font-semibold text-muted-foreground mb-1">시</span>
                  <ScrollArea className="h-44 border rounded-md">
                    <div className="flex flex-col divide-y divide-border/40">
                      {hoursList.map(hr => (
                        <button
                          key={hr}
                          type="button"
                          className={cn(
                            "w-full py-1.5 text-xs hover:bg-muted text-center transition-colors",
                            h === hr && "bg-primary text-primary-foreground font-semibold hover:bg-primary"
                          )}
                          onClick={() => handleInputChange(field.field_key, `${hr}:${m || '00'}`)}
                        >
                          {hr}시
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                <div className="flex flex-col text-center flex-1">
                  <span className="text-[10px] font-semibold text-muted-foreground mb-1">분</span>
                  <ScrollArea className="h-44 border rounded-md">
                    <div className="flex flex-col divide-y divide-border/40">
                      {minutesList.map(min => (
                        <button
                          key={min}
                          type="button"
                          className={cn(
                            "w-full py-1.5 text-xs hover:bg-muted text-center transition-colors",
                            m === min && "bg-primary text-primary-foreground font-semibold hover:bg-primary"
                          )}
                          onClick={() => handleInputChange(field.field_key, `${h || '12'}:${min}`)}
                        >
                          {min}분
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )
      }
      case 'music': {
        const musicFiles = field.options?.music_files || []
        if (musicFiles.length === 0) {
          return <div className="text-xs text-muted-foreground italic">업로드된 음원이 없습니다.</div>
        }
        return (
          <div className="space-y-3">
            <div className="bg-slate-50 border border-slate-200/50 p-3.5 rounded-2xl flex items-start gap-2.5">
              <span className="text-lg">🎵</span>
              <div>
                <p className="text-xs font-bold text-slate-800">배경음악(BGM) 선택</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                  모바일 청첩장에 감성을 더해줄 BGM 곡을 선택해 주세요. 각 음원을 재생해보고 마음에 드는 음악을 고르실 수 있습니다.
                </p>
              </div>
            </div>
            
            <div className="space-y-2.5">
              {musicFiles.map((file: any, idx: number) => {
                const audioId = `audio-${field.field_key}-${idx}`
                const isSelected = value === file.name
                const isPlaying = playingAudioId === audioId
                const displayTitle = file.title || file.name.replace(/\.[^/.]+$/, "")
                const tags = file.tags ? file.tags.split(/\s+/).filter(Boolean) : []

                return (
                  <div 
                    key={idx} 
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-300 select-none",
                      isSelected 
                        ? "bg-primary/5 border-primary shadow-sm scale-[1.01]" 
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                    )}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <audio id={audioId} src={file.url} preload="auto" playsInline className="hidden" />
                      <button
                        type="button"
                        onClick={() => handlePlayPause(audioId, file.url)}
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 shadow-xs",
                          isPlaying ? "bg-primary text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        )}
                      >
                        {isPlaying ? (
                          <div className="flex items-end gap-0.5 h-3">
                            <span className="w-0.5 bg-current rounded-full animate-bounce h-2" style={{ animationDelay: '0.1s', animationDuration: '0.6s' }} />
                            <span className="w-0.5 bg-current rounded-full animate-bounce h-3" style={{ animationDelay: '0.3s', animationDuration: '0.5s' }} />
                            <span className="w-0.5 bg-current rounded-full animate-bounce h-1.5" style={{ animationDelay: '0.5s', animationDuration: '0.7s' }} />
                          </div>
                        ) : (
                          <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 truncate">{displayTitle}</span>
                          {isPlaying && (
                            <span className="text-[9px] font-bold text-primary animate-pulse shrink-0 bg-primary/10 px-1.5 py-0.5 rounded">
                              재생 중
                            </span>
                          )}
                        </div>
                        {tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {tags.map((tag: string, tIdx: number) => (
                              <span key={tIdx} className="bg-slate-100 text-slate-500 border border-slate-200/60 text-[9px] font-medium px-1.5 py-0.2 rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[9px] text-muted-foreground mt-0.5">클래식 연주곡 BGM</p>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleInputChange(field.field_key, file.name)}
                      className="h-8 text-xs font-bold px-4 shrink-0 rounded-full"
                    >
                      {isSelected ? "선택됨" : "선택"}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      }
      case 'select_text': {
        const choices: string[] = field.options?.choices || []
        const isCustomActive = customSelectTexts[field.field_key] || (value && !choices.includes(value))

        return (
          <div className="space-y-3">
            {/* List of preset choice cards */}
            {choices.map((choiceOpt: string, idx: number) => {
              const isSelected = !isCustomActive && value === choiceOpt
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setCustomSelectTexts(prev => ({ ...prev, [field.field_key]: false }))
                    handleInputChange(field.field_key, choiceOpt)
                  }}
                  className={cn(
                    "relative p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 select-none bg-background",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-2xs"
                      : "border-border/60 hover:border-border hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap flex-1">
                      {choiceOpt}
                    </p>
                    <div className={cn(
                      "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-slate-300"
                    )}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Direct Input Card */}
            <div
              onClick={() => {
                if (!isCustomActive) {
                  setCustomSelectTexts(prev => ({ ...prev, [field.field_key]: true }))
                  handleInputChange(field.field_key, '')
                }
              }}
              className={cn(
                "relative p-3.5 rounded-xl border-2 transition-all duration-200 bg-background",
                isCustomActive
                  ? "border-primary bg-primary/5 shadow-2xs"
                  : "border-border/60 hover:border-border hover:bg-muted/30 cursor-pointer"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span>✏️</span> 직접 입력하기
                </span>
                <div className={cn(
                  "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                  isCustomActive ? "border-primary bg-primary text-primary-foreground" : "border-slate-300"
                )}>
                  {isCustomActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </div>

              {isCustomActive && (
                <Textarea
                  value={value || ''}
                  onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                  placeholder="원하시는 인사말이나 문구를 직접 작성해 주세요."
                  rows={3}
                  className="text-xs mt-3 bg-background resize-y"
                  required={field.is_required}
                />
              )}
            </div>
          </div>
        )
      }
      case 'imageselect': {
        const choices = field.options?.image_choices || []
        if (choices.length === 0) {
          return <div className="text-xs text-muted-foreground italic">설정된 이미지 선택지가 없습니다.</div>
        }
        return (
          <div className="grid grid-cols-2 gap-3.5 pt-1.5">
            {choices.map((choice: any, idx: number) => {
              const isSelected = value === choice.text
              return (
                <div
                  key={idx}
                  onClick={() => handleInputChange(field.field_key, choice.text)}
                  className={cn(
                    "relative flex flex-col rounded-2xl border-2 overflow-hidden cursor-pointer transition-all duration-300 select-none group",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-md scale-[1.02]"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:scale-[1.01]"
                  )}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={choice.image}
                      alt={choice.text}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-primary text-white w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                        <svg className="w-3 h-3 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-3 text-center border-t border-slate-100 bg-slate-50/50">
                    <span className={cn(
                      "text-xs font-bold transition-colors",
                      isSelected ? "text-primary font-black" : "text-slate-700"
                    )}>
                      {choice.text}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
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
              {field.options?.choices?.map((opt: string) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              )) || (Array.isArray(field.options) ? field.options.map((opt: string) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              )) : null) || (
                <>
                  <SelectItem value="선택 A">선택 A</SelectItem>
                  <SelectItem value="선택 B">선택 B</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        )
      case 'mselect': {
        const choices = field.options?.choices || []
        const currentValues = Array.isArray(value) ? value : (value ? value.split(',').map((s: string) => s.trim()) : [])
        
        const handleCheckboxChange = (opt: string, checked: boolean) => {
          let updated: string[] = [...currentValues]
          if (checked) {
            if (!updated.includes(opt)) {
              updated.push(opt)
            }
          } else {
            updated = updated.filter(val => val !== opt)
          }
          handleInputChange(field.field_key, updated.join(', '))
        }

        return (
          <div className="flex flex-col gap-2 pt-1.5">
            {choices.map((opt: string) => {
              const id = `${field.field_key}-${opt}`
              const isChecked = currentValues.includes(opt)
              return (
                <label
                  key={opt}
                  htmlFor={id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                    isChecked
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-card hover:bg-muted/10'
                  }`}
                >
                  <input
                    type="checkbox"
                    id={id}
                    checked={isChecked}
                    onChange={(e) => handleCheckboxChange(opt, e.target.checked)}
                    className="w-4 h-4 text-primary focus:ring-primary border-slate-300 rounded"
                  />
                  <span>{opt}</span>
                </label>
              )
            })}
            {choices.length === 0 && (
              <p className="text-xs text-muted-foreground italic">선택할 수 있는 항목이 없습니다.</p>
            )}
          </div>
        )
      }
      case 'rselect': {
        const choices = field.options?.choices || []
        return (
          <div className="flex flex-col gap-2 pt-1.5">
            {choices.map((opt: string) => {
              const id = `${field.field_key}-${opt}`
              const isChecked = value === opt
              return (
                <label
                  key={opt}
                  htmlFor={id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                    isChecked
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-card hover:bg-muted/10'
                  }`}
                >
                  <input
                    type="radio"
                    id={id}
                    name={field.field_key}
                    value={opt}
                    checked={isChecked}
                    onChange={() => handleInputChange(field.field_key, opt)}
                    className="w-4 h-4 text-primary focus:ring-primary border-slate-300"
                  />
                  <span>{opt}</span>
                </label>
              )
            })}
            {choices.length === 0 && (
              <p className="text-xs text-muted-foreground italic">선택할 수 있는 항목이 없습니다.</p>
            )}
          </div>
        )
      }
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
      case 'toggle': {
        const isToggled = value === true || value === 'true' || value === 'on' || value === '예'
        return (
          <div className="flex items-center gap-3 pt-1">
            <Switch
              checked={isToggled}
              onCheckedChange={(checked) => handleInputChange(field.field_key, checked ? '예' : '아니오')}
            />
            <span className="text-xs font-medium text-slate-700">
              {isToggled ? '예' : '아니오'}
            </span>
          </div>
        )
      }
      case 'images': {
        const imageArray = Array.isArray(value) ? value : (value ? [value] : [])
        
        const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const files = e.target.files
          if (!files) return
          
          const newImages = [...imageArray]
          let loadedCount = 0
          
          Array.from(files).forEach((file) => {
            const reader = new FileReader()
            reader.onloadend = () => {
              newImages.push(reader.result as string)
              loadedCount++
              if (loadedCount === files.length) {
                handleInputChange(field.field_key, newImages)
              }
            }
            reader.readAsDataURL(file)
          })
        }

        const handleRemoveImage = (index: number) => {
          const updated = imageArray.filter((_, i) => i !== index)
          handleInputChange(field.field_key, updated)
        }

        return (
          <div className="space-y-3">
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              required={field.is_required && imageArray.length === 0}
            />
            {imageArray.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {imageArray.map((imgUrl: string, idx: number) => (
                  <div key={idx} className="relative aspect-square border border-border rounded-lg overflow-hidden group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgUrl} alt={`Uploaded ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] shadow opacity-80 hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      }
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

  const progressPercent = Math.round(((currentStep + 1) / allStepKeys.length) * 100)

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      {/* Public Header - Mobile Optimized */}
      <header className="bg-white/95 backdrop-blur-md border-b border-border py-2.5 px-3.5 sm:px-6 flex justify-between items-center shadow-2xs sticky top-0 z-50">
        <div className="flex items-center gap-2 shrink-0">
          <Logo className="h-4 sm:h-5 w-auto" />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="h-7 sm:h-8 text-[11px] sm:text-xs text-slate-600 hover:text-slate-900 px-2 sm:px-3 font-medium border border-slate-200/80 sm:border-none rounded-lg shrink-0"
          >
            {savingDraft ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            <span className="hidden sm:inline">나중에 이어쓰기 (임시저장)</span>
            <span className="sm:hidden">임시저장</span>
          </Button>

          {(instance.customer?.groom_name || instance.customer?.bride_name) && (
            <div className="text-right border-l border-slate-200 pl-2 sm:pl-3 shrink-0">
              <span className="text-[11px] sm:text-xs font-bold text-primary block truncate max-w-[100px] sm:max-w-[200px]">
                {instance.customer?.groom_name || '신랑'} & {instance.customer?.bride_name || '신부'}
              </span>
              <span className="text-[9px] text-slate-400 hidden sm:block">
                결혼식 정보 입력 양식
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 space-y-6">
        {/* Step Indicator Map */}
        <div className="bg-white border border-border rounded-xl p-3.5 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-1 select-none overflow-x-auto py-1 scrollbar-hide">
            {allStepKeys.map((stepKey, idx) => (
              <React.Fragment key={stepKey}>
                <button
                  type="button"
                  disabled={idx > currentStep}
                  onClick={() => setCurrentStep(idx)}
                  className="flex flex-col items-center gap-1 shrink-0"
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border",
                    idx === currentStep ? "bg-primary border-primary text-white scale-110 shadow-xs" :
                    idx < currentStep ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted/30 border-muted text-muted-foreground"
                  )}>
                    {idx === allStepKeys.length - 1 ? '✓' : idx + 1}
                  </div>
                  <span className={cn(
                    "text-[9px] font-semibold tracking-tight transition-colors",
                    idx === currentStep ? "text-primary" : "text-muted-foreground"
                  )}>
                    {stepKey}
                  </span>
                </button>
                {idx < allStepKeys.length - 1 && (
                  <div className={cn(
                    "h-[1px] flex-1 min-w-[12px] bg-slate-200",
                    idx < currentStep && "bg-primary/30"
                  )} />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
              <span>진행단계: {currentStepKey}</span>
              <span>{progressPercent}% 완료</span>
            </div>
            <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
              <div className="bg-primary h-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>

        {/* Summary (Review Step) OR Fields Form Card */}
        {currentStepKey === '최종 확인' ? (
          <Card className="shadow-lg border-border">
            <CardHeader className="bg-muted/10 border-b border-border pb-4">
              <CardTitle className="text-base font-semibold">입력 내용 최종 확인</CardTitle>
              <CardDescription className="text-xs">
                제출하시기 전에 입력하신 정보가 정확한지 확인해주세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              {fieldStepKeys.map((stepKey, sIdx) => {
                const stepFields = stepsMap[stepKey] || []
                const filledFields = stepFields.filter(f => {
                  const opts = parseOptions(f)
                  if (opts.parent_field_key) {
                    let parentVal = (formValues[opts.parent_field_key] || '').toString().trim()
                    if (parentVal === 'true') parentVal = '예'
                    if (parentVal === 'false') parentVal = '아니오'
                    const triggerVal = (opts.parent_trigger_option || '').toString().trim()
                    if (parentVal !== triggerVal) {
                      return false
                    }
                  }
                  return true
                })

                if (filledFields.length === 0) return null

                return (
                  <div key={stepKey} className="space-y-2 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-1.5 h-3 bg-primary rounded-full" />
                        {stepKey}
                      </h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentStep(sIdx)}
                        className="h-6 text-[10px] text-primary"
                      >
                        수정
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 text-xs bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                      {filledFields.map(f => {
                        const val = formValues[f.field_key]
                        let displayVal = val ? val.toString() : ''
                        if (displayVal === 'true') displayVal = '예'
                        if (displayVal === 'false') displayVal = '아니오'
                        if (f.field_type === 'image' || f.field_type === 'images') {
                          displayVal = val ? '이미지 첨부됨' : ''
                        }
                        
                        return (
                          <div key={f.field_key} className="flex justify-between items-start gap-4">
                            <span className="text-muted-foreground font-medium shrink-0">{f.label}:</span>
                            <span className={cn(
                              "text-right truncate max-w-[250px]",
                              displayVal ? "text-slate-800 font-semibold" : "text-amber-500 italic font-medium"
                            )}>
                              {displayVal || (f.is_required ? "필수 입력 누락" : "선택 안 함")}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Navigation Buttons for Review Page */}
              <div className="flex justify-between items-center gap-3 mt-8 pt-6 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrev}
                  className="gap-1.5 text-xs h-9 px-3.5"
                >
                  <ChevronLeft className="w-4 h-4" /> 이전
                </Button>

                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="gap-1.5 text-xs h-9 px-4 bg-primary hover:bg-primary/90"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  제출 완료하기
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-lg border-border">
            <CardHeader className="bg-muted/10 border-b border-border pb-4">
              <CardTitle className="text-base font-semibold">{currentStepKey} 작성</CardTitle>
              <CardDescription className="text-xs">
                결혼식 및 초대장 제작에 필요한 세부 내용을 입력해주세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <FieldGroup className="space-y-5">
                {(() => {
                  // 1. Group fields by section dynamically to prevent duplication & ordering bugs
                  const sections: { title: string; fields: any[] }[] = []
                  const rootFields = currentFields.filter((f) => !parseOptions(f).parent_field_key)

                  rootFields.forEach((field) => {
                    let currentSection = ''
                    if (field.options) {
                      if (typeof field.options === 'string') {
                        try {
                          const parsed = JSON.parse(field.options)
                          currentSection = parsed.section_title || ''
                        } catch {
                          currentSection = ''
                        }
                      } else {
                        currentSection = field.options.section_title || ''
                      }
                    }
                    currentSection = currentSection.trim()

                    let sec = sections.find(s => s.title === currentSection)
                    if (!sec) {
                      sec = { title: currentSection, fields: [] }
                      sections.push(sec)
                    }
                    sec.fields.push(field)
                  })

                  const renderAttachedImages = (images: string[]) => {
                    if (!images || images.length === 0) return null
                    return (
                      <div className="space-y-3 my-3">
                        {images.map((img: string, idx: number) => (
                          <div
                            key={idx}
                            onClick={() => setZoomImage(img)}
                            className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs bg-slate-50 dark:bg-slate-900 transition-all duration-200 hover:shadow-md hover:border-primary/50"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img}
                              alt="안내 가이드 이미지"
                              className="w-full h-auto max-h-[480px] object-contain mx-auto transition-transform duration-300 group-hover:scale-[1.01]"
                            />
                            <div className="absolute bottom-2.5 right-2.5 bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm opacity-90 group-hover:opacity-100 transition-opacity">
                              <ZoomIn className="w-3.5 h-3.5 text-primary-foreground" />
                              <span>확대 보기</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  }

                  // 2. Render grouped sections and fields
                  return sections.map((sec, secIdx) => (
                    <div key={`section-${secIdx}`} className="space-y-4">
                      {sec.title && (
                        <div className="pt-6 pb-2.5 border-b-2 border-slate-800 dark:border-slate-200 mt-8 first:mt-0 mb-4 flex items-center gap-2">
                          <div className="w-2.5 h-5 bg-slate-900 dark:bg-slate-100 rounded-sm shrink-0" />
                          <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                            {sec.title}
                          </h3>
                        </div>
                      )}
                      
                      {sec.fields.map((field) => {
                        const children = currentFields.filter(
                          (c) => parseOptions(c).parent_field_key === field.field_key
                        )

                        return (
                          <div key={field.field_key} className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
                            <Field>
                              <FieldLabel htmlFor={field.field_key} className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1">
                                <span>{field.label}</span>
                                {field.is_required && (
                                  <span className="text-rose-500 font-bold text-sm ml-0.5" title="필수 입력 항목">*</span>
                                )}
                              </FieldLabel>

                              {renderAttachedImages(parseOptions(field).attached_images)}
                              {renderInputField(field)}
                            </Field>

                            {/* Child fields accordion wrapper */}
                            {children.map((childField) => {
                              const childOpts = parseOptions(childField)
                              let parentVal = (formValues[field.field_key] || '').toString().trim()
                              if (parentVal === 'true') parentVal = '예'
                              if (parentVal === 'false') parentVal = '아니오'
                              const triggerVal = (childOpts.parent_trigger_option || '').toString().trim()
                              const isTriggered = parentVal === triggerVal && parentVal !== ''

                              return (
                                <div
                                  key={childField.field_key}
                                  className={`transition-all duration-300 ease-in-out overflow-hidden border-l-2 border-primary pl-4 ml-1 mt-3 bg-slate-50/80 dark:bg-slate-800/40 p-3.5 rounded-r-xl border-y border-r border-slate-200/60 dark:border-slate-800 ${
                                    isTriggered 
                                      ? 'max-h-[600px] opacity-100 py-3' 
                                      : 'max-h-0 opacity-0 py-0 pointer-events-none'
                                  }`}
                                >
                                   <div className="text-[11px] font-bold text-primary flex items-center gap-1 mb-2">
                                     <span>↳</span> 하위 세부 입력 항목
                                   </div>
                                   <Field>
                                     <FieldLabel htmlFor={childField.field_key} className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                       {childField.label}
                                       {childField.is_required && <span className="text-rose-500 font-bold text-xs ml-0.5">*</span>}
                                     </FieldLabel>
                                     {renderAttachedImages(childOpts.attached_images)}
                                     {renderInputField(childField)}
                                   </Field>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  ))
                })()}
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

                <Button
                  type="button"
                  onClick={handleNext}
                  className="gap-1.5 text-xs h-9 px-3.5 animate-pulse"
                >
                  다음 <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
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
