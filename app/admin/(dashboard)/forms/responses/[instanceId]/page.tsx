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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Calendar as CalendarIcon, Clock, ArrowLeft, Save, Loader2, FileCheck, Edit2, Download, X } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return undefined
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export default function FormResponsePage({ params }: { params: Promise<{ instanceId: string }> }) {
  const { instanceId } = use(params)
  const router = useRouter()

  const { data: submission, isLoading, error } = useFormSubmissionQuery(instanceId)
  const updateMutation = useUpdateSubmissionMutation()

  // Local state to manage editable form data
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [customSelectTexts, setCustomSelectTexts] = useState<Record<string, boolean>>({})
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)

  const handlePlayPause = (audioId: string) => {
    const aud = document.getElementById(audioId) as HTMLAudioElement
    if (!aud) return

    if (playingAudioId === audioId) {
      aud.pause()
      setPlayingAudioId(null)
    } else {
      if (playingAudioId) {
        const prevAud = document.getElementById(playingAudioId) as HTMLAudioElement
        if (prevAud) prevAud.pause()
      }
      aud.play()
      setPlayingAudioId(audioId)
      aud.onended = () => {
        setPlayingAudioId(null)
      }
    }
  }

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

  const downloadOriginalImage = async (imgUrl: string, fileName: string) => {
    try {
      const response = await fetch(imgUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || `vowseoul_attached_image_${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('원본 화질 이미지를 다운로드하였습니다.')
    } catch (err) {
      console.error(err)
      window.open(imgUrl, '_blank')
    }
  }

  const renderResponseView = (field: any) => {
    const rawVal = formData[field.field_key]
    let displayVal = rawVal !== undefined && rawVal !== null ? rawVal.toString() : ''
    if (displayVal === 'true') displayVal = '예'
    if (displayVal === 'false') displayVal = '아니오'

    if (field.field_type === 'image' || field.field_type === 'images' || Array.isArray(rawVal)) {
      const imageList: string[] = Array.isArray(rawVal) ? rawVal : (typeof rawVal === 'string' && rawVal.startsWith('http') ? [rawVal] : (rawVal ? [rawVal] : []))
      
      if (imageList.length === 0) {
        return <div className="text-xs text-muted-foreground italic bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">(첨부된 이미지 없음)</div>
      }

      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {imageList.map((imgUrl, idx) => (
              <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-2xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgUrl} alt={`첨부 이미지 ${idx + 1}`} className="w-full h-32 object-cover" />
                <button
                  type="button"
                  onClick={() => downloadOriginalImage(imgUrl, `${field.label}_${idx + 1}.png`)}
                  className="absolute bottom-1.5 right-1.5 bg-slate-900/85 hover:bg-slate-950 text-white text-[10px] font-medium px-2 py-1 rounded-md flex items-center gap-1 shadow-sm transition-opacity"
                >
                  <Download className="w-3 h-3 text-primary-foreground" /> 원본 다운로드
                </button>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (field.field_type === 'timentext') {
      const formatted = formatTimeTextValue(rawVal)
      return (
        <div className="text-xs font-semibold text-slate-800 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 whitespace-pre-wrap select-text cursor-text">
          {formatted || '(미입력 항목)'}
        </div>
      )
    }

    if (!displayVal) {
      return (
        <div className="text-xs text-slate-400 italic bg-slate-50/60 p-2.5 rounded-lg border border-slate-200/50">
          (미입력 항목)
        </div>
      )
    }

    return (
      <div className="text-xs font-semibold text-slate-800 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 whitespace-pre-wrap select-text cursor-text">
        {displayVal}
      </div>
    )
  }

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
      case 'date': {
        const localDate = parseLocalDate(value)
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-8 text-xs px-3 bg-muted/10",
                  !value && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {value && localDate ? format(localDate, 'yyyy년 MM월 dd일') : '날짜 선택'}
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
                  "w-full justify-start text-left font-normal h-8 text-xs px-3 bg-muted/10",
                  !value && "text-muted-foreground"
                )}
              >
                <Clock className="mr-2 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {value ? `${h}시 ${m}분` : '시간 선택'}
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
                            "w-full py-1 text-[11px] hover:bg-muted text-center transition-colors",
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
                            "w-full py-1 text-[11px] hover:bg-muted text-center transition-colors",
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
          <div className="space-y-2 flex-1">
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
                    "flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs",
                    isSelected 
                      ? "bg-primary/5 border-primary shadow-xs font-semibold" 
                      : "bg-white border-border hover:bg-slate-50/50"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <audio id={audioId} src={file.url} className="hidden" />
                    <button
                      type="button"
                      onClick={() => handlePlayPause(audioId)}
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0",
                        isPlaying ? "bg-primary text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      )}
                    >
                      {isPlaying ? (
                        <div className="flex items-end gap-0.5 h-2.5">
                          <span className="w-0.5 bg-current rounded-full animate-bounce h-1.5" style={{ animationDelay: '0.1s', animationDuration: '0.6s' }} />
                          <span className="w-0.5 bg-current rounded-full animate-bounce h-2.5" style={{ animationDelay: '0.3s', animationDuration: '0.5s' }} />
                          <span className="w-0.5 bg-current rounded-full animate-bounce h-1" style={{ animationDelay: '0.5s', animationDuration: '0.7s' }} />
                        </div>
                      ) : (
                        <svg className="w-2.5 h-2.5 fill-current ml-0.5" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-700 truncate">{displayTitle}</span>
                        {isPlaying && (
                          <span className="text-[8px] font-bold text-primary animate-pulse shrink-0 bg-primary/10 px-1 rounded">
                            재생 중
                          </span>
                        )}
                      </div>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {tags.map((tag: string, tIdx: number) => (
                            <span key={tIdx} className="bg-slate-100 text-slate-500 border border-slate-200/60 text-[8px] font-medium px-1 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleInputChange(field.field_key, file.name)}
                    className="h-7 text-[10px] px-3 shrink-0 rounded-full"
                  >
                    {isSelected ? "선택됨" : "선택"}
                  </Button>
                </div>
              )
            })}
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
          items = [{ time: '', text: '' }, { time: '', text: '' }, { time: '', text: '' }]
        }

        return (
          <div className="space-y-2 flex-1">
            {items.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  type="time"
                  value={row.time}
                  onChange={(e) => {
                    const newItems = [...items]
                    newItems[idx] = { ...newItems[idx], time: e.target.value }
                    handleInputChange(field.field_key, newItems)
                  }}
                  className="w-28 font-mono text-center h-8 text-xs bg-muted/10"
                />
                <span className="text-muted-foreground font-bold">|</span>
                <Input
                  type="text"
                  value={row.text}
                  placeholder="식순 내용"
                  onChange={(e) => {
                    const newItems = [...items]
                    newItems[idx] = { ...newItems[idx], text: e.target.value }
                    handleInputChange(field.field_key, newItems)
                  }}
                  className="flex-1 h-8 text-xs bg-muted/10"
                />
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => {
                      const newItems = items.filter((_, i) => i !== idx)
                      handleInputChange(field.field_key, newItems)
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const newItems = [...items, { time: '', text: '' }]
                handleInputChange(field.field_key, newItems)
              }}
              className="w-full mt-1 h-7 text-xs gap-1 border-dashed text-muted-foreground hover:text-foreground"
            >
              <Edit2 className="w-3 h-3" /> 식순 항목 추가
            </Button>
          </div>
        )
      }
      case 'select_text': {
        const choices = field.options?.choices || []
        const isCustomActive = customSelectTexts[field.field_key] || (value && !choices.includes(value))
        
        return (
          <div className="space-y-2 flex-1">
            <Select 
              value={isCustomActive ? '__direct_input__' : value} 
              onValueChange={(selectedVal) => {
                if (selectedVal === '__direct_input__') {
                  setCustomSelectTexts(prev => ({ ...prev, [field.field_key]: true }))
                  handleInputChange(field.field_key, '')
                } else {
                  setCustomSelectTexts(prev => ({ ...prev, [field.field_key]: false }))
                  handleInputChange(field.field_key, selectedVal)
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-muted/10">
                <SelectValue placeholder="선택하거나 직접 입력 선택" />
              </SelectTrigger>
              <SelectContent>
                {choices.map((opt: string) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
                <SelectItem value="__direct_input__" className="text-primary font-semibold">
                  + 직접 입력
                </SelectItem>
              </SelectContent>
            </Select>

            {isCustomActive && (
              <Input
                value={value}
                onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                placeholder="직접 내용을 입력하세요."
                className="h-8 text-xs mt-1 bg-muted/10"
              />
            )}
          </div>
        )
      }
      case 'imageselect': {
        const choices = field.options?.image_choices || []
        if (choices.length === 0) {
          return <div className="text-xs text-muted-foreground italic">설정된 이미지 선택지가 없습니다.</div>
        }
        return (
          <div className="grid grid-cols-2 gap-3 pt-1.5 flex-1">
            {choices.map((choice: any, idx: number) => {
              const isSelected = value === choice.text
              return (
                <div
                  key={idx}
                  onClick={() => handleInputChange(field.field_key, choice.text)}
                  className={cn(
                    "relative flex flex-col rounded-xl border overflow-hidden cursor-pointer transition-all text-xs group",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-xs font-semibold"
                      : "border-border bg-white hover:border-slate-300"
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
                      <div className="absolute top-1.5 right-1.5 bg-primary text-white w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-xs">
                        <svg className="w-2.5 h-2.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-2 text-center border-t border-slate-100 bg-slate-50/50">
                    <span className={cn(
                      "text-[11px] transition-colors",
                      isSelected ? "text-primary font-bold" : "text-slate-600"
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
              고객 제출 응답 상세 ({customer?.groom_name || '신랑'} & {customer?.bride_name || '신부'})
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              드래그하여 텍스트를 자유롭게 복사할 수 있으며, 필요 시 [수정하기] 버튼을 눌러 수정합니다.
            </p>
          </div>
        </div>

        <div>
          {!isEditing ? (
            <Button
              type="button"
              onClick={() => setIsEditing(true)}
              className="gap-2 bg-primary hover:bg-primary/90 text-white text-xs px-4 h-9 shadow-sm"
            >
              <Edit2 className="w-3.5 h-3.5" /> 수정하기
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(false)}
              className="gap-1.5 text-xs h-9 px-3.5"
            >
              <X className="w-3.5 h-3.5" /> 수정 취소
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader className="bg-muted/10 border-b border-border pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-green-600" /> 제출 응답 상세 데이터 {isEditing ? '(수정 모드)' : '(조회 및 복사 모드)'}
              </CardTitle>
              <CardDescription className="text-xs">
                {isEditing ? '필요한 정보를 수정 후 하단의 저장하기 버튼을 누르세요.' : '텍스트 드래그 및 원본 이미지 다운로드가 가능합니다.'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <FieldGroup className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(() => {
                let lastSectionTitle = ''
                return fields.map((field: any) => {
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

                  const showSectionHeader = currentSection && currentSection !== lastSectionTitle
                  if (showSectionHeader) {
                    lastSectionTitle = currentSection
                  }

                  return (
                    <React.Fragment key={field.field_key}>
                      {showSectionHeader && (
                        <div className="col-span-1 md:col-span-2 pt-4 pb-1 border-b border-border mt-3 first:mt-0">
                          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-1.5 h-3 bg-primary rounded-full" />
                            {currentSection}
                          </h3>
                        </div>
                      )}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-semibold text-slate-700">
                            {field.label_override || field.label}
                            {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {field.field_key}
                          </span>
                        </div>
                        {isEditing ? renderInputField(field) : renderResponseView(field)}
                      </div>
                    </React.Fragment>
                  )
                })
              })()}
            </FieldGroup>

            {isEditing && (
              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-border animate-in fade-in-0 duration-200">
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                  수정 취소
                </Button>
                <Button type="submit" className="gap-2 bg-primary hover:bg-primary/90" disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  수정 내용 저장하기
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
