'use client'

import React, { useState, useEffect, use, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { SaveButton } from '@/components/ui/save-button'
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
import { pickFormSubmission } from '@/lib/form-submission'
import { useBgmLibraryQuery } from '@/hooks/queries/useBgms'
import { mergeMusicChoices } from '@/lib/bgm-choices'
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
  Maximize2,
  Trash2,
  Plus
} from 'lucide-react'
import { toast } from 'sonner'
import { uploadImage } from '@/lib/image-upload'
import { Logo } from '@/components/logo'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase'
import { DATA_RETENTION_SETTINGS_KEY, DEFAULT_RETENTION_DAYS, parseRetentionSettings } from '@/lib/data-retention'
import { BUSINESS_INFO_SETTINGS_KEY, parseBusinessInfo } from '@/lib/business-info'
import { AddressSearchField } from '@/components/address-search-field'
import { AccountBlock, AccountListField } from '@/components/account-fields'
import {
  ACCOUNT_GROUPS,
  EMPTY_ACCOUNT,
  accountGroupKeys,
  accountGroupOf,
  composeAccountText,
  isAccountFilled,
  isExtraAccountKey,
  parseAccountList,
} from '@/lib/account-fields'
import { ContactListField } from '@/components/contact-fields'
import { composeContactText, isContactFilled, isExtraContactsKey, parseContactList } from '@/lib/contact-fields'
import { CONSENT_VERSION, getFormConsentCopy } from '@/lib/privacy-consent'

const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return undefined
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * 값이 비었는지 판정. 사진 항목은 값이 배열이라 `!val` 로는 걸러지지 않는다 —
 * 사진을 넣었다 전부 지우면 빈 배열([])이 남는데 JS 에서 []는 truthy 라
 * "첨부됨"으로 보이면서 제출 검증은 누락으로 잡는 모순이 생긴다.
 */
const isBlank = (val: any) => {
  if (val === null || val === undefined) return true
  if (Array.isArray(val)) return val.length === 0
  return val.toString().trim() === ''
}

/** 임시저장 시각을 "3분 전"처럼 읽기 쉬운 상대 시간으로. 하루가 넘으면 날짜로 보여준다 */
const formatSavedAt = (iso: string) => {
  const saved = new Date(iso)
  if (Number.isNaN(saved.getTime())) return ''
  const minutes = Math.floor((Date.now() - saved.getTime()) / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`
  return format(saved, 'M월 d일 a h:mm', { locale: ko })
}

/**
 * 링크가 잘못됐거나 만료됐을 때 보여주는 문의 안내. 예전에는 "메인 화면으로 이동"
 * 버튼이었는데 그 경로(/)가 관리자 페이지로 리다이렉트돼(§app/page.tsx) 고객이
 * 관리자 로그인 화면에 떨어지는 막다른 길이었다.
 */
function SupportContact({ email }: { email: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3 text-sm">
      <p className="font-medium text-foreground">문의하기</p>
      <p className="mt-1 text-muted-foreground">
        카카오채널 <span className="font-medium text-foreground">바우서울</span>
        {email && (
          <>
            {' 또는 '}
            <a href={`mailto:${email}`} className="font-medium text-foreground underline underline-offset-2">
              {email}
            </a>
          </>
        )}
      </p>
    </div>
  )
}

function PublicFormContent({ slug }: { slug: string }) {
  const { data: instance, isLoading, error } = useFormInstanceBySlugQuery(slug)
  const submitMutation = useSubmitFormMutation()
  const { data: bgmLibrary } = useBgmLibraryQuery()

  // Password Lock state
  const [password, setPassword] = useState('')
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [verifyingPassword, setVerifyingPassword] = useState(false)

  // 개인정보 수집·이용 동의 state — 비밀번호 게이트 통과 직후, 위저드 진입 전에 받는다
  // (§lib/privacy-consent.ts). 임시저장이 이미 서버에 저장을 시작하므로 최종 확인
  // 단계가 아니라 여기서 받아야 동의 없이 수집되는 구간이 생기지 않는다.
  const [consentChecked, setConsentChecked] = useState(false)
  const [consentConfirmed, setConsentConfirmed] = useState(false)
  const [consentAgreedAt, setConsentAgreedAt] = useState<string | null>(null)
  const [retentionDays, setRetentionDays] = useState(DEFAULT_RETENTION_DAYS)
  // 링크가 잘못됐거나 만료됐을 때 고객이 연락할 곳. 예전엔 '메인 화면으로 이동' 버튼을
  // 뒀는데 그 경로(/)가 관리자 페이지로 리다이렉트돼 고객이 로그인 화면에 떨어졌다.
  const [supportEmail, setSupportEmail] = useState('')

  useEffect(() => {
    supabase
      .from('settings')
      .select('key, value')
      .in('key', [DATA_RETENTION_SETTINGS_KEY, BUSINESS_INFO_SETTINGS_KEY])
      .then(({ data }) => {
        const byKey = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
        setRetentionDays(parseRetentionSettings(byKey[DATA_RETENTION_SETTINGS_KEY]).daysAfterWedding)
        setSupportEmail(parseBusinessInfo(byKey[BUSINESS_INFO_SETTINGS_KEY]).supportEmail)
      })
  }, [])

  // Form Value state { field_key: value }
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  // 다음/제출을 눌렀을 때 비어 있던 필수 항목들. 해당 입력칸에 오류 표시를 띄우는 데 쓴다
  const [missingKeys, setMissingKeys] = useState<string[]>([])
  // 이전에 쓰던 내용을 되살렸을 때의 저장 시각. 긴 폼이라 "내가 쓴 게 남아있나"를
  // 알려주지 않으면 고객이 처음부터 다시 쓰게 된다. null 이면 새로 시작하는 것.
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [customSelectTexts, setCustomSelectTexts] = useState<Record<string, boolean>>({})
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const [uploadingFields, setUploadingFields] = useState<string[]>([])

  /**
   * 사진은 Storage 에 올리고 URL 만 폼 값으로 들고 있는다.
   *
   * 예전에는 FileReader 로 base64 를 만들어 그대로 폼 값에 넣었다. 그 값이
   * form_submissions.data(jsonb) → content_data → 발행 페이지 HTML 까지 그대로
   * 실려나가면서, 실제로 한 청첩장이 26MB / 15.6초짜리 페이지가 되어 있었다.
   * 게다가 매 입력마다 localStorage 에 폼 전체를 저장하는 임시저장 로직이
   * 사진 한 장만 들어와도 쿼터(5~10MB)를 넘겨 조용히 죽어버렸다.
   */
  const uploadFormImages = async (fieldKey: string, files: File[]): Promise<string[]> => {
    setUploadingFields((prev) => [...prev, fieldKey])
    try {
      const results = await Promise.all(
        files.map(async (file) => {
          try {
            return await uploadImage(file, 'forms/submissions')
          } catch (err) {
            toast.error(err instanceof Error ? err.message : `'${file.name}' 업로드에 실패했습니다.`)
            return null
          }
        }),
      )
      return results.filter((url): url is string => !!url)
    } finally {
      setUploadingFields((prev) => prev.filter((k) => k !== fieldKey))
    }
  }

  const uploadFormImage = async (fieldKey: string, file: File): Promise<string | null> => {
    const [url] = await uploadFormImages(fieldKey, [file])
    return url ?? null
  }

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
      if (!instance.has_password) {
        setIsUnlocked(true)
      }
      
      // Initialize default empty values for each field
      const defaults: Record<string, any> = {}
      instance.fields_snapshot?.forEach((f: any) => {
        defaults[f.field_key] = ''
      })
      setFormValues((prev) => Object.keys(prev).length === 0 ? defaults : prev)
    }
  }, [instance])

  // 1. Load draft from Supabase & localStorage on init
  useEffect(() => {
    if (!instance?.id) return
    const draftKey = `vowseoul_draft_${instance.slug || instance.id}`

    let initialValues: Record<string, any> = {}
    let savedAt: string | null = null

    const serverSubmission = pickFormSubmission<any>(instance.form_submissions)
    if (serverSubmission?.data) {
      initialValues = { ...serverSubmission.data }
      savedAt = serverSubmission.updated_at ?? null
    }

    // 이미 이번 버전 방침에 동의한 기록이 서버에 있으면 다시 묻지 않는다. 방침이
    // 개정돼 버전이 올라가면 값이 달라지므로 그때는 자동으로 다시 받게 된다.
    if (serverSubmission?.consent_agreed_at && serverSubmission.consent_version === CONSENT_VERSION) {
      setConsentAgreedAt(serverSubmission.consent_agreed_at)
      setConsentChecked(true)
      setConsentConfirmed(true)
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
          // 이 기기에 남은 게 서버 기록보다 최신이다
          if (typeof parsed.updatedAt === 'string') savedAt = parsed.updatedAt
        }
      }
    } catch (e) {
      console.error('Error reading localStorage draft:', e)
    }

    // 값이 실제로 들어있을 때만 "이어쓰기"로 본다 — 빈 문자열로 초기화된 기본값
    // 뭉치까지 복원으로 치면 처음 여는 고객에게도 안내가 뜬다.
    if (Object.keys(initialValues).length > 0) {
      setFormValues((prev) => ({ ...prev, ...initialValues }))
      if (Object.values(initialValues).some((v) => !isBlank(v))) setDraftSavedAt(savedAt)
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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!instance) return
    setVerifyingPassword(true)
    try {
      const res = await fetch('/api/form-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, password }),
      })
      if (res.ok) {
        setIsUnlocked(true)
        setPasswordError('')
      } else {
        setPasswordError('비밀번호가 올바르지 않습니다. 다시 확인해주세요.')
        toast.error('비밀번호 불일치')
      }
    } catch {
      setPasswordError('확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setVerifyingPassword(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm font-light">정보 수집 양식을 불러오고 있습니다...</p>
        </div>
      </div>
    )
  }

  if (error || !instance) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center font-sans p-4">
        <Card className="w-full max-w-md text-center py-8">
          <CardContent className="space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">찾을 수 없는 양식</h2>
              <p className="text-sm text-muted-foreground">
                입력 양식이 만료되었거나, 주소가 잘못되었습니다.
              </p>
            </div>
            <SupportContact email={supportEmail} />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check if form is expired
  if (instance.status === 'expired' || (instance.expires_at && new Date() > new Date(instance.expires_at))) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center font-sans p-4">
        <Card className="w-full max-w-md text-center py-8">
          <CardContent className="space-y-4">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">만료된 입력 링크</h2>
              <p className="text-sm text-muted-foreground">
                이 정보 수집 링크는 만료기한이 지나 비활성화되었습니다.
                새 링크를 받으시려면 아래로 문의해주세요.
              </p>
            </div>
            <SupportContact email={supportEmail} />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Password Lock Screen
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center font-sans px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex justify-center">
              <Logo className="h-6 w-auto" />
            </div>
            <CardTitle className="text-xl font-bold flex items-center justify-center gap-2">
              <Lock className="w-5 h-5 text-muted-foreground" /> 정보 수집 폼 접속
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

              <Button type="submit" className="w-full h-10" disabled={verifyingPassword}>
                {verifyingPassword ? '확인 중...' : '입력 페이지 열기'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 정보 수집 동의 화면 — 비밀번호 게이트 통과 직후, 위저드 진입 전
  if (!consentConfirmed) {
    const consentCopy = getFormConsentCopy(retentionDays)
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center font-sans px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex justify-center">
              <Logo className="h-6 w-auto" />
            </div>
            <CardTitle className="text-xl font-bold">정보 수집 안내</CardTitle>
            <CardDescription className="text-xs">
              청첩장 제작을 위해 아래 정보를 수집합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-xs leading-relaxed">
              <p>
                <span className="font-semibold text-foreground">목적</span> {consentCopy.purpose}
              </p>
              <p>
                <span className="font-semibold text-foreground">항목</span> {consentCopy.items}
              </p>
              <p>
                <span className="font-semibold text-foreground">보유</span> {consentCopy.retention}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">{consentCopy.refusalNotice}</p>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-muted-foreground underline underline-offset-2"
            >
              개인정보처리방침 전문 보기 →
            </a>
            <div className="flex items-start gap-2 pt-1">
              <Checkbox
                id="form-consent"
                checked={consentChecked}
                onCheckedChange={(v) => setConsentChecked(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="form-consent" className="cursor-pointer text-sm font-medium">
                위 내용에 동의합니다 (필수)
              </label>
            </div>
            <Button
              className="w-full h-10"
              disabled={!consentChecked}
              onClick={() => {
                setConsentAgreedAt(new Date().toISOString())
                setConsentConfirmed(true)
              }}
            >
              동의하고 시작하기
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Submitted Screen
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center font-sans px-4">
        <Card className="w-full max-w-md text-center py-8">
          <CardContent className="space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">제출 완료!</h2>
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
    // 입력을 시작하면 그 항목의 누락 표시는 바로 걷어준다
    setMissingKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : prev))
  }

  /** 계좌 블럭처럼 여러 키를 한 번에 바꾸는 입력용 */
  const handleInputPatch = (patch: Record<string, any>) => {
    setFormValues((prev) => ({ ...prev, ...patch }))
    setMissingKeys((prev) => prev.filter((k) => !(k in patch) || isBlank(patch[k])))
  }

  /** 부모 항목의 답에 따라 지금 이 항목을 실제로 물어보고 있는지 */
  const isFieldActive = (f: any) => {
    const opts = parseOptions(f)
    if (!opts.parent_field_key) return true
    let parentVal = (formValues[opts.parent_field_key] || '').toString().trim()
    if (parentVal === 'true') parentVal = '예'
    if (parentVal === 'false') parentVal = '아니오'
    return parentVal === (opts.parent_trigger_option || '').toString().trim()
  }

  /** 화면에 떠 있는 필수 항목 중 아직 안 채운 것들 */
  const collectMissing = (fields: any[]) =>
    fields.filter((f) => f.is_required && isFieldActive(f) && isBlank(formValues[f.field_key]))

  /**
   * 누락 항목을 표시하고 첫 번째 항목으로 스크롤한다. 한 단계가 3,000px 이 넘어서
   * 토스트로 이름만 나열하면 고객이 긴 폼을 직접 뒤져야 한다.
   */
  const focusMissing = (missing: any[]) => {
    setMissingKeys(missing.map((f) => f.field_key))
    const first = document.getElementById(`formfield-${missing[0].field_key}`)
    if (first) {
      // smooth 가 아니라 즉시 이동이다 — 오류를 고치러 가는 길이라 1초짜리 애니메이션이
      // 도움이 안 되고, 애니메이션 프레임이 안 도는 환경에서는 조용히 아무 일도 안 일어난다.
      first.scrollIntoView({ behavior: 'auto', block: 'center' })
      first.querySelector<HTMLElement>('input, textarea, select, button')?.focus({ preventScroll: true })
    }
  }

  // 3. Manual Draft Save Handler
  const handleSaveDraft = async (): Promise<boolean> => {
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
        consentAgreedAt: consentAgreedAt ?? undefined,
        consentVersion: CONSENT_VERSION,
      })
      toast.success('입력하신 내용이 임시 저장되었습니다! (이 기기 및 서버에 안전하게 보관됨)')
    } catch (err: any) {
      console.warn('Server draft save failed, saved locally:', err)
      toast.success('이 기기에 입력 내용이 임시 저장되었습니다!')
    }
    return true
  }

  const handleNext = () => {
    const missingFields = collectMissing(currentFields)

    if (missingFields.length > 0) {
      toast.error(
        missingFields.length === 1
          ? `'${missingFields[0].label}' 항목을 입력해주세요.`
          : `입력하지 않은 필수 항목이 ${missingFields.length}개 있습니다. 표시된 항목을 확인해주세요.`
      )
      focusMissing(missingFields)
      return
    }

    setMissingKeys([])
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
    const allMissing = collectMissing(instance.fields_snapshot)

    if (allMissing.length > 0) {
      toast.error(
        allMissing.length === 1
          ? `'${allMissing[0].label}' 항목을 입력해주세요.`
          : `입력하지 않은 필수 항목이 ${allMissing.length}개 있습니다. 표시된 항목을 확인해주세요.`
      )
      // 최종 확인 화면에서 눌렀으므로 누락된 항목은 다른 단계에 있다. 그 단계로 옮긴 뒤
      // 실제로 그려지고 나서 스크롤해야 해서 다음 프레임까지 기다린다.
      const targetStep = fieldStepKeys.findIndex((key) =>
        (stepsMap[key] || []).some((f: any) => f.field_key === allMissing[0].field_key)
      )
      if (targetStep >= 0 && targetStep !== currentStep) setCurrentStep(targetStep)
      requestAnimationFrame(() => focusMissing(allMissing))
      return
    }

    setMissingKeys([])
    setSubmitting(true)
    try {
      await submitMutation.mutateAsync({
        instanceId: instance.id,
        customerId: instance.customer_id,
        data: formValues,
        isComplete: true,
        consentAgreedAt: consentAgreedAt ?? undefined,
        consentVersion: CONSENT_VERSION,
      })
      setIsSubmitted(true)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '제출 중 문제가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  /** 누락으로 표시된 항목의 입력칸에 붙일 속성. Input 이 aria-invalid 를 빨간 테두리로 그린다 */
  const errorProps = (field: any) =>
    missingKeys.includes(field.field_key) ? { 'aria-invalid': true as const } : {}

  const renderInputField = (field: any) => {
    const value = formValues[field.field_key] || ''

    // 계좌 필드는 field_type 이 아니라 키로 판정한다(§lib/account-fields.ts).
    // 신랑·신부 본인 계좌: 예금주/은행명/계좌번호 3개 필드를 한 블럭으로 묶어 보여주되
    // 저장은 기존 키 그대로다.
    const groupPrefix = accountGroupOf(field.field_key)
    if (groupPrefix) {
      const k = accountGroupKeys(groupPrefix)
      return (
        <AccountBlock
          idPrefix={groupPrefix}
          value={{
            holder: formValues[k.holder] || '',
            bank: formValues[k.bank] || '',
            number: formValues[k.number] || '',
          }}
          onChange={(next) =>
            handleInputPatch({ [k.holder]: next.holder, [k.bank]: next.bank, [k.number]: next.number })
          }
          invalid={[k.holder, k.bank, k.number].some((key) => missingKeys.includes(key))}
        />
      )
    }

    // 혼주 계좌: 개수가 정해져 있지 않아 값 하나에 배열로 담는다.
    if (isExtraAccountKey(field.field_key)) {
      const parsed = parseAccountList(formValues[field.field_key])
      if (parsed === null && typeof value === 'string' && value.trim()) {
        // 예전 자유 입력으로 이미 채워진 폼 — 값을 임의로 쪼개면 잘못 나눌 수 있어
        // 원문을 그대로 두고 고칠 수만 있게 한다.
        return (
          <div className="space-y-2">
            <Textarea
              value={value}
              onChange={(e) => handleInputChange(field.field_key, e.target.value)}
              rows={3}
            />
            <p className="text-[11px] text-muted-foreground">
              예전 방식(자유 입력)으로 저장된 내용입니다. 아래 버튼을 누르면 계좌별로 나눠 입력하는
              방식으로 바꿀 수 있습니다.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleInputChange(field.field_key, [{ ...EMPTY_ACCOUNT }])}
            >
              계좌별로 나눠 입력하기
            </Button>
          </div>
        )
      }
      return (
        <AccountListField
          idPrefix={field.field_key}
          items={parsed ?? []}
          onChange={(next) => handleInputChange(field.field_key, next)}
          addLabel="혼주 계좌 추가"
        />
      )
    }

    // 축하 연락처: 신랑·신부 본인은 고정 필드로 남고, 그 외(혼주 등)는 값 하나에
    // 배열로 담아 필요한 만큼 추가한다.
    if (isExtraContactsKey(field.field_key)) {
      return (
        <ContactListField
          idPrefix={field.field_key}
          items={parseContactList(formValues[field.field_key]) ?? []}
          onChange={(next) => handleInputChange(field.field_key, next)}
          addLabel="연락처 추가"
        />
      )
    }

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

        // 예식 시간은 대부분 11~13시대인데 시(hour) 목록이 00시부터 시작해, 열 때마다 한참
        // 스크롤을 내려야 예식 시간대가 보였다. 팝오버가 열리는 순간(=이 ref 콜백이 붙는 순간)
        // 선택값(없으면 12시)이 목록 한가운데 오도록 스크롤 뷰포트만 움직인다.
        // scrollIntoView 는 조상 스크롤 컨테이너(=폼 페이지 전체)까지 같이 스크롤해 화면이
        // 튀므로 쓰지 않고, 뷰포트의 scrollTop 을 직접 계산해 넣는다.
        const focusHour = h || '12'
        const centerHourInView = (el: HTMLButtonElement | null) => {
          if (!el) return
          const viewport = el.closest('[data-slot="scroll-area-viewport"]') as HTMLElement | null
          if (!viewport) return
          const vRect = viewport.getBoundingClientRect()
          const eRect = el.getBoundingClientRect()
          viewport.scrollTop += (eRect.top - vRect.top) - (vRect.height - eRect.height) / 2
        }

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
                          ref={hr === focusHour ? centerHourInView : undefined}
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
        const musicFiles = mergeMusicChoices(field.options?.music_files, bgmLibrary)
        if (musicFiles.length === 0) {
          return <div className="text-xs text-muted-foreground italic">업로드된 음원이 없습니다.</div>
        }
        return (
          <div className="space-y-3">
            <div className="bg-muted border border-border/50 p-3.5 rounded-2xl flex items-start gap-2.5">
              <span className="text-lg">🎵</span>
              <div>
                <p className="text-xs font-bold text-foreground">배경음악(BGM) 선택</p>
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
                        : "bg-white border-border hover:border-muted-foreground/40 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <audio id={audioId} src={file.url} preload="auto" playsInline className="hidden" />
                      <button
                        type="button"
                        onClick={() => handlePlayPause(audioId, file.url)}
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 shadow-xs",
                          isPlaying ? "bg-primary text-white" : "bg-muted hover:bg-accent text-muted-foreground"
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
                          <span className="text-xs font-bold text-foreground truncate">{displayTitle}</span>
                          {isPlaying && (
                            <span className="text-[9px] font-bold text-primary animate-pulse shrink-0 bg-primary/10 px-1.5 py-0.5 rounded">
                              재생 중
                            </span>
                          )}
                        </div>
                        {tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {tags.map((tag: string, tIdx: number) => (
                              <span key={tIdx} className="bg-muted text-muted-foreground border border-border/60 text-[9px] font-medium px-1.5 py-0.2 rounded-full">
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
      case 'timentext': {
        let items: Array<{ time: string; text: string }> = []
        if (Array.isArray(value)) {
          items = value
        } else if (typeof value === 'string' && value.trim()) {
          try {
            const parsed = JSON.parse(value)
            if (Array.isArray(parsed)) items = parsed
          } catch {
            items = value.split(',').map((part) => {
              const [t, ...txt] = part.split('|')
              return { time: (t || '').trim(), text: txt.join('|').trim() }
            })
          }
        }

        if (items.length === 0) {
          items = [
            { time: '', text: '' },
            { time: '', text: '' },
            { time: '', text: '' },
          ]
        }

        const updateRow = (idx: number, key: 'time' | 'text', val: string) => {
          const newItems = items.map((row, i) => (i === idx ? { ...row, [key]: val } : row))
          handleInputChange(field.field_key, newItems)
        }

        const addRow = () => {
          const newItems = [...items, { time: '', text: '' }]
          handleInputChange(field.field_key, newItems)
        }

        const removeRow = (idx: number) => {
          const newItems = items.filter((_, i) => i !== idx)
          handleInputChange(field.field_key, newItems)
        }

        return (
          <div className="space-y-3">
            <div className="space-y-2">
              {items.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-muted/60 p-2 rounded-xl border border-border/80">
                  <div className="shrink-0 w-28 sm:w-32">
                    <Input
                      type="time"
                      value={row.time}
                      onChange={(e) => updateRow(idx, 'time', e.target.value)}
                      className="h-10 text-xs sm:text-sm font-mono text-center bg-white border-border focus:border-ring"
                    />
                  </div>
                  <span className="text-muted-foreground font-bold px-0.5">|</span>
                  <Input
                    type="text"
                    value={row.text}
                    placeholder={`식순 ${idx + 1} 내용 (예: ${idx === 0 ? '개식선언 및 입장' : idx === 1 ? '성혼선언문 낭독' : '축가 및 하객 식사 안내'})`}
                    onChange={(e) => updateRow(idx, 'text', e.target.value)}
                    className="flex-1 h-10 text-xs sm:text-sm bg-white border-border focus:border-ring"
                  />
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-muted-foreground hover:text-red-500 hover:bg-red-50 shrink-0 rounded-lg"
                      onClick={() => removeRow(idx)}
                      title="삭제"
                      aria-label="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={addRow}
              className="w-full h-10 text-xs sm:text-sm gap-1.5 border-dashed border-input bg-white text-muted-foreground hover:border-foreground hover:bg-muted font-medium rounded-xl shadow-2xs"
            >
              <Plus className="w-4 h-4 text-primary" /> 식순 항목 추가하기 (+)
            </Button>
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
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input"
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
                  isCustomActive ? "border-primary bg-primary text-primary-foreground" : "border-input"
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
                      : "border-border bg-white hover:border-muted-foreground/40 hover:scale-[1.01]"
                  )}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-muted relative">
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
                  <div className="p-3 text-center border-t border-border bg-muted/50">
                    <span className={cn(
                      "text-xs font-bold transition-colors",
                      isSelected ? "text-primary font-black" : "text-muted-foreground"
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
                    className="w-4 h-4 text-primary focus:ring-primary border-input rounded"
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
                    className="w-4 h-4 text-primary focus:ring-primary border-input"
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
      case 'image': {
        const isUploading = uploadingFields.includes(field.field_key)
        return (
          <div className="space-y-2">
            <Input
              type="file"
              accept="image/*"
              disabled={isUploading}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const url = await uploadFormImage(field.field_key, file)
                if (url) handleInputChange(field.field_key, url)
                e.target.value = ''
              }}
              required={field.is_required && !value}
            />
            {isUploading && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> 사진을 올리는 중입니다...
              </p>
            )}
            {value && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="Preview" className="h-32 object-cover rounded-lg border border-border" />
            )}
          </div>
        )
      }
      case 'toggle': {
        const isToggled = value === true || value === 'true' || value === 'on' || value === '예'
        return (
          <div className="flex items-center gap-3 pt-1">
            <Switch
              checked={isToggled}
              onCheckedChange={(checked) => handleInputChange(field.field_key, checked ? '예' : '아니오')}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {isToggled ? '예' : '아니오'}
            </span>
          </div>
        )
      }
      case 'images': {
        const imageArray = Array.isArray(value) ? value : (value ? [value] : [])
        const isUploading = uploadingFields.includes(field.field_key)

        const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
          const files = e.target.files
          if (!files || files.length === 0) return
          const urls = await uploadFormImages(field.field_key, Array.from(files))
          if (urls.length > 0) handleInputChange(field.field_key, [...imageArray, ...urls])
          e.target.value = ''
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
              disabled={isUploading}
              onChange={handleFileChange}
              required={field.is_required && imageArray.length === 0}
            />
            {isUploading && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> 사진을 올리는 중입니다...
              </p>
            )}
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
      case 'slug':
        return (
          <div className="space-y-1">
            <Input
              type="text"
              value={value}
              onChange={(e) => {
                const sanitized = e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, '-')
                  .replace(/-+/g, '-')
                handleInputChange(field.field_key, sanitized)
              }}
              placeholder={field.help_text || '예: our-wedding-2026'}
              required={field.is_required}
            />
            <p className="text-[11px] text-muted-foreground">영문 소문자, 숫자, 하이픈(-)만 입력 가능합니다.</p>
          </div>
        )
      case 'address':
        return (
          <AddressSearchField
            id={field.field_key}
            value={value}
            onChange={(addr) => handleInputChange(field.field_key, addr)}
            placeholder={field.help_text}
            required={field.is_required}
            invalid={missingKeys.includes(field.field_key)}
          />
        )
      default: {
        // phone 은 전용 분기가 없어 여기로 떨어진다. 그냥 text 로 두면 휴대폰에서
        // 숫자 키패드 대신 일반 자판이 올라와 연락처 6개를 전부 그렇게 입력해야 한다.
        const isPhone = field.field_type === 'phone'
        return (
          <Input
            type={field.field_type === 'number' ? 'number' : isPhone ? 'tel' : 'text'}
            inputMode={isPhone ? 'numeric' : undefined}
            autoComplete={isPhone ? 'tel' : undefined}
            value={value}
            onChange={(e) => handleInputChange(field.field_key, e.target.value)}
            placeholder={field.help_text || '내용을 입력하세요.'}
            required={field.is_required}
            {...errorProps(field)}
          />
        )
      }
    }
  }

  const progressPercent = Math.round(((currentStep + 1) / allStepKeys.length) * 100)

  return (
    <div className="min-h-screen bg-muted/50 flex flex-col font-sans">
      {/* Public Header - Mobile Optimized */}
      <header className="bg-white/95 backdrop-blur-md border-b border-border py-2.5 px-3.5 sm:px-6 flex justify-between items-center shadow-2xs sticky top-0 z-50">
        <div className="flex items-center gap-2 shrink-0">
          <Logo className="h-4 sm:h-5 w-auto" />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <SaveButton
            variant="ghost"
            size="sm"
            onSave={handleSaveDraft}
            className="h-7 sm:h-8 text-[11px] sm:text-xs text-muted-foreground hover:text-foreground px-2 sm:px-3 font-medium border border-border/80 sm:border-none rounded-lg shrink-0"
            idleLabel={<><span className="hidden sm:inline">나중에 이어쓰기 (임시저장)</span><span className="sm:hidden">임시저장</span></>}
            successLabel="저장됨"
          />

          {(instance.customer?.groom_name || instance.customer?.bride_name) && (
            <div className="text-right border-l border-border pl-2 sm:pl-3 shrink-0">
              <span className="text-[11px] sm:text-xs font-bold text-primary block truncate max-w-[100px] sm:max-w-[200px]">
                {instance.customer?.groom_name || '신랑'} & {instance.customer?.bride_name || '신부'}
              </span>
              <span className="text-[9px] text-muted-foreground hidden sm:block">
                결혼식 정보 입력 양식
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 space-y-6">
        {draftSavedAt !== null && (
          <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
            <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-primary" />
            <p className="text-foreground">
              이전에 입력하신 내용을 그대로 불러왔습니다. 이어서 작성해주세요.
              {draftSavedAt && (
                <span className="mt-0.5 block text-muted-foreground">
                  마지막 저장 {formatSavedAt(draftSavedAt)}
                </span>
              )}
            </p>
          </div>
        )}

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
                    "h-[1px] flex-1 min-w-[12px] bg-border",
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
            <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
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
                const filledFields = stepFields.filter(isFieldActive)

                if (filledFields.length === 0) return null

                return (
                  <div key={stepKey} className="space-y-2 border-b border-border pb-4 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
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

                    <div className="grid grid-cols-1 gap-1.5 text-xs bg-muted/50 p-2.5 rounded-lg border border-border">
                      {filledFields.map(f => {
                        const val = formValues[f.field_key]
                        // isBlank 로 판정해야 사진을 넣었다 전부 지운 경우([])도 '없음'으로 잡힌다
                        const blank = isBlank(val)
                        let displayVal = blank ? '' : val.toString()
                        if (displayVal === 'true') displayVal = '예'
                        if (displayVal === 'false') displayVal = '아니오'
                        if (f.field_type === 'image' || f.field_type === 'images') {
                          const count = Array.isArray(val) ? val.length : 1
                          displayVal = blank ? '' : `사진 ${count}장 첨부됨`
                        }
                        // 계좌·연락처는 값이 객체 배열이라 val.toString() 이 "[object Object]"를
                        // 만든다 — 계좌·연락처별로 한 줄씩 풀어서 보여준다.
                        if (isExtraAccountKey(f.field_key)) {
                          const list = parseAccountList(val)
                          if (list) displayVal = list.filter(isAccountFilled).map(composeAccountText).join('\n')
                        }
                        if (isExtraContactsKey(f.field_key)) {
                          const list = parseContactList(val)
                          if (list) displayVal = list.filter(isContactFilled).map(composeContactText).join('\n')
                        }

                        return (
                          <div key={f.field_key} className="flex justify-between items-start gap-4">
                            <span className="text-muted-foreground font-medium shrink-0">{f.label}:</span>
                            {/* 오탈자를 확인하라고 만든 화면이라 값을 자르면 안 된다. 인사말처럼
                                줄바꿈이 들어간 긴 글도 그대로 보이도록 접어서 전부 표시한다. */}
                            <span className={cn(
                              "min-w-0 text-right whitespace-pre-wrap break-words",
                              displayVal ? "text-foreground font-semibold" : "text-amber-500 italic font-medium"
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
                  disabled={submitting || uploadingFields.length > 0}
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
                            className="relative group cursor-pointer overflow-hidden rounded-xl border border-border shadow-2xs bg-muted transition-all duration-200 hover:shadow-md hover:border-primary/50"
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
                        <div className="pt-6 pb-2.5 border-b-2 border-border mt-8 first:mt-0 mb-4 flex items-center gap-2">
                          <div className="w-2.5 h-5 bg-foreground rounded-sm shrink-0" />
                          <h3 className="text-base font-extrabold text-foreground tracking-tight">
                            {sec.title}
                          </h3>
                        </div>
                      )}
                      
                      {sec.fields.map((field) => {
                        const children = currentFields.filter(
                          (c) => parseOptions(c).parent_field_key === field.field_key
                        )

                        // 계좌 그룹은 대표 필드(예금주) 하나에서 블럭 전체를 그리므로
                        // 나머지 두 필드(은행명·계좌번호)는 따로 카드를 만들지 않는다.
                        const groupPrefix = accountGroupOf(field.field_key)
                        if (groupPrefix && field.field_key !== accountGroupKeys(groupPrefix).holder) return null
                        const groupLabel = groupPrefix
                          ? ACCOUNT_GROUPS.find((g) => g.prefix === groupPrefix)?.label
                          : null

                        const isMissing = missingKeys.includes(field.field_key)

                        return (
                          <div
                            key={field.field_key}
                            id={`formfield-${field.field_key}`}
                            className={cn(
                              'p-4 sm:p-5 rounded-2xl border bg-card shadow-2xs space-y-3',
                              isMissing ? 'border-destructive ring-2 ring-destructive/20' : 'border-border'
                            )}
                          >
                            <Field>
                              <FieldLabel htmlFor={field.field_key} className="text-sm font-extrabold text-foreground tracking-tight flex items-center gap-1">
                                <span>{groupLabel ?? field.label}</span>
                                {field.is_required && (
                                  <span className="text-rose-500 font-bold text-sm ml-0.5" title="필수 입력 항목">*</span>
                                )}
                              </FieldLabel>

                              {renderAttachedImages(parseOptions(field).attached_images)}
                              {renderInputField(field)}
                              {isMissing && (
                                <p role="alert" className="text-xs font-medium text-destructive">
                                  이 항목은 필수입니다.
                                </p>
                              )}
                            </Field>

                            {/* Child fields accordion wrapper */}
                            {children.map((childField) => {
                              const childOpts = parseOptions(childField)
                              let parentVal = (formValues[field.field_key] || '').toString().trim()
                              if (parentVal === 'true') parentVal = '예'
                              if (parentVal === 'false') parentVal = '아니오'
                              const triggerVal = (childOpts.parent_trigger_option || '').toString().trim()
                              const isTriggered = parentVal === triggerVal && parentVal !== ''

                              // 계좌 3필드는 대표 필드(예금주)에서 블럭 하나로 그린다 —
                              // 계좌 항목들은 토글의 하위 항목이라 여기로 들어온다.
                              const childGroup = accountGroupOf(childField.field_key)
                              if (childGroup && childField.field_key !== accountGroupKeys(childGroup).holder) return null
                              const childGroupLabel = childGroup
                                ? ACCOUNT_GROUPS.find((g) => g.prefix === childGroup)?.label
                                : null

                              // 별도 표식(라벨·테두리) 없이 부모를 켜면 그냥 자연스럽게 펼쳐지는
                              // 아코디언으로만 동작한다 — grid-template-rows 0fr/1fr 전환은
                              // max-height 를 고정값으로 잡아두는 방식과 달리 내용이 길어져도
                              // (계좌를 여러 개 추가하는 경우 등) 잘리지 않는다.
                              return (
                                <div
                                  key={childField.field_key}
                                  className={`grid transition-[grid-template-rows,opacity,margin-top] duration-300 ease-in-out ${
                                    isTriggered
                                      ? 'grid-rows-[1fr] opacity-100 mt-3'
                                      : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
                                  }`}
                                >
                                  <div className="overflow-hidden">
                                    <Field>
                                      <FieldLabel htmlFor={childField.field_key} className="text-sm font-extrabold text-foreground tracking-tight flex items-center gap-1">
                                        <span>{childGroupLabel ?? childField.label}</span>
                                        {childField.is_required && (
                                          <span className="text-rose-500 font-bold text-sm ml-0.5">*</span>
                                        )}
                                      </FieldLabel>
                                      {renderAttachedImages(childOpts.attached_images)}
                                      {renderInputField(childField)}
                                    </Field>
                                  </div>
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

        <div className="pt-2 pb-6 text-center">
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground underline underline-offset-2">
            개인정보처리방침
          </a>
        </div>
      </main>
    </div>
  )
}

export default function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <PublicFormContent slug={slug} />
    </Suspense>
  )
}
