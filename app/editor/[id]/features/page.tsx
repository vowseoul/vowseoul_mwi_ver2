'use client'

import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { useAppStore, sampleBGMs, sampleThemes } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, ArrowRight, Play, Pause, Upload, Star, Loader2, Image } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { uploadFile } from '@/lib/storage'

export default function FeaturesPage() {
  const router = useRouter()
  const params = useParams()
  const { currentInvitation, updateCurrentInvitation, saveInvitation, setActiveSection, themes } = useAppStore()

  const theme = (themes && themes.length > 0) 
    ? (themes.find(t => t.id === currentInvitation?.themeId) || themes[0])
    : (sampleThemes.find(t => t.id === currentInvitation?.themeId) || sampleThemes[0])
  const colorSet = theme?.colorSets?.find(c => c.id === currentInvitation?.colorSet) || theme?.colorSets?.[0]
  const defaultAccentColor = colorSet?.colors?.[1] || '#c4a574'

  const isCustomSvg = currentInvitation?.customStyles?.calendarDayCustomShapeUrl?.toLowerCase().split('?')[0].endsWith('.svg') ?? false
  const invitationId = params.id as string
  const [playingBgm, setPlayingBgm] = useState<string | null>(null)
  const [paperTexture, setPaperTexture] = useState(false)
  const [isUploadingKakao, setIsUploadingKakao] = useState(false)
  const [isUploadingShape, setIsUploadingShape] = useState(false)
  const calendarShapeInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingGreetingIcon, setIsUploadingGreetingIcon] = useState(false)
  const greetingIconInputRef = useRef<HTMLInputElement>(null)

  const handleCalendarShapeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsUploadingShape(true)
    try {
      const url = await uploadFile(e.target.files[0], 'calendar-shapes')
      const prevStyles = currentInvitation?.customStyles || {}
      updateCurrentInvitation({
        customStyles: {
          ...prevStyles,
          calendarDayCustomShapeUrl: url
        }
      })
      setActiveSection('calendar')
    } catch (err) {
      alert('강조 이미지 업로드에 실패했습니다.')
    } finally {
      setIsUploadingShape(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleGreetingIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsUploadingGreetingIcon(true)
    try {
      const url = await uploadFile(e.target.files[0], 'greeting-icons')
      const prevStyles = currentInvitation?.customStyles || {}
      updateCurrentInvitation({
        customStyles: {
          ...prevStyles,
          greetingIconCustomUrl: url
        }
      })
      setActiveSection('greeting')
    } catch (err) {
      alert('아이콘 이미지 업로드에 실패했습니다.')
    } finally {
      setIsUploadingGreetingIcon(false)
      if (e.target) e.target.value = ''
    }
  }
  
  const [bgms, setBgms] = useState<any[]>([])
  const [themeRecommendedBgms, setThemeRecommendedBgms] = useState<string[]>([])
  const [isLoadingBgms, setIsLoadingBgms] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const fetchBgmsAndTheme = async () => {
      const { data: bgmData } = await supabase.from('bgms').select('*')
      if (bgmData && bgmData.length > 0) {
        setBgms(bgmData)
      } else {
        setBgms(sampleBGMs)
      }

      if (currentInvitation?.themeId) {
        const { data: themeData } = await supabase.from('themes').select('recommendedBgms').eq('id', currentInvitation.themeId).single()
        if (themeData && themeData.recommendedBgms) {
          setThemeRecommendedBgms(themeData.recommendedBgms)
        }
      }

      setIsLoadingBgms(false)
    }
    fetchBgmsAndTheme()

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])
  
  const kakaoImageInputRef = useRef<HTMLInputElement>(null)

  const handleKakaoImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsUploadingKakao(true)
    try {
      const url = await uploadFile(e.target.files[0], 'kakao-thumbnails')
      updateCurrentInvitation({ kakaoThumbnail: url })
    } catch (err) {
      alert('카카오톡 썸네일 업로드에 실패했습니다.')
    } finally {
      setIsUploadingKakao(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleNext = async () => {
    const savedId = await saveInvitation()
    const targetId = savedId || invitationId
    router.push(`/editor/${targetId}/payment`)
  }

  const handleBack = () => {
    router.push(`/editor/${invitationId}/content`)
  }

  const togglePlay = (bgmId: string, bgmUrl?: string) => {
    if (playingBgm === bgmId) {
      if (audioRef.current) audioRef.current.pause()
      setPlayingBgm(null)
    } else {
      if (audioRef.current) audioRef.current.pause()
      
      const url = bgmUrl || bgms.find(b => b.id === bgmId)?.url
      if (url) {
        audioRef.current = new Audio(url)
        audioRef.current.play().catch(e => console.error('Audio play error:', e))
        audioRef.current.onended = () => setPlayingBgm(null)
        setPlayingBgm(bgmId)
      }
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">부가 기능</h1>
        <p className="mt-1 text-muted-foreground">
          청첩장에 추가할 기능을 설정해주세요.
        </p>
      </div>

      {/* Guestbook Type */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg">방명록</CardTitle>
            <CardDescription>하객들이 축하 메시지를 남길 수 있습니다.</CardDescription>
          </div>
          <Switch
            checked={currentInvitation?.guestbookType !== 'none'}
            onCheckedChange={(checked) => {
              updateCurrentInvitation({ guestbookType: checked ? 'text' : 'none' })
              setActiveSection('guestbook')
            }}
          />
        </CardHeader>
        {currentInvitation?.guestbookType !== 'none' && (
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>방명록 유형</FieldLabel>
                <Select
                  value={currentInvitation?.guestbookType === 'audio' ? 'audio' : 'text'}
                  onValueChange={(value: 'text' | 'audio') => {
                    updateCurrentInvitation({ guestbookType: value })
                    setActiveSection('guestbook')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">텍스트 방명록</SelectItem>
                    <SelectItem value="audio">오디오 방명록</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  오디오 방명록은 하객이 음성 메시지를 녹음하여 남길 수 있습니다.
                </FieldDescription>
              </Field>
            </FieldGroup>
            {currentInvitation?.guestbookType === 'audio' && (
              <div className="mt-4 rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  오디오 방명록 예시: 하객이 버튼을 누르고 축하 메시지를 녹음할 수 있습니다.
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Calendar Detail Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">달력 상세 설정</CardTitle>
          <CardDescription>달력의 디데이 표시 및 예식일 강조 디자인을 설정합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* D-Day Toggle */}
          <div className="flex items-center justify-between pb-4 border-b">
            <div>
              <p className="font-medium text-sm">달력 디데이 (D-Day) 표시</p>
              <p className="text-xs text-muted-foreground">
                달력 섹션 제목 아래에 결혼일자까지 남은 일수(예: D-30)를 표시합니다.
              </p>
            </div>
            <Switch
              checked={currentInvitation?.customStyles?.ddayEnabled ?? false}
              onCheckedChange={(checked) => {
                const prevStyles = currentInvitation?.customStyles || {}
                updateCurrentInvitation({
                  customStyles: {
                    ...prevStyles,
                    ddayEnabled: checked
                  }
                })
                setActiveSection('calendar')
              }}
            />
          </div>

          {/* Wedding Date Highlight Shape */}
          <div className="space-y-4">
            <div>
              <p className="font-medium text-sm">예식일 강조 표시 모양</p>
              <p className="text-xs text-muted-foreground">달력에서 결혼식 날짜를 강조할 도형을 선택합니다.</p>
            </div>
            <RadioGroup
              value={currentInvitation?.customStyles?.calendarDayShape || 'circle'}
              onValueChange={(val) => {
                const prevStyles = currentInvitation?.customStyles || {}
                updateCurrentInvitation({
                  customStyles: {
                    ...prevStyles,
                    calendarDayShape: val
                  }
                })
                setActiveSection('calendar')
              }}
              className="grid grid-cols-3 gap-2"
            >
              <div>
                <RadioGroupItem value="circle" id="shape-circle" className="peer sr-only" />
                <Label
                  htmlFor="shape-circle"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer text-xs"
                >
                  <div className="h-5 w-5 rounded-full bg-primary/20 border border-primary mb-1" />
                  동그라미
                </Label>
              </div>
              <div>
                <RadioGroupItem value="heart" id="shape-heart" className="peer sr-only" />
                <Label
                  htmlFor="shape-heart"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer text-xs"
                >
                  <span className="text-primary text-base leading-none mb-1">♥</span>
                  하트
                </Label>
              </div>
              <div>
                <RadioGroupItem value="custom" id="shape-custom" className="peer sr-only" />
                <Label
                  htmlFor="shape-custom"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer text-xs"
                >
                  <Upload className="h-4 w-4 text-primary mb-1.5" />
                  직접 업로드
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Custom Shape Upload */}
          {currentInvitation?.customStyles?.calendarDayShape === 'custom' && (
            <div className="space-y-2 pt-2 border-t">
              <span className="text-xs font-semibold block">강조 이미지 업로드 (PNG/SVG 권장)</span>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded border bg-muted flex items-center justify-center overflow-hidden">
                  {currentInvitation.customStyles?.calendarDayCustomShapeUrl ? (
                    <img src={currentInvitation.customStyles.calendarDayCustomShapeUrl} className="h-full w-full object-contain" />
                  ) : (
                    <Image className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs"
                    onClick={() => calendarShapeInputRef.current?.click()}
                    disabled={isUploadingShape}
                  >
                    {isUploadingShape ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                    이미지 추가
                  </Button>
                  <input 
                    type="file" 
                    ref={calendarShapeInputRef} 
                    onChange={handleCalendarShapeUpload} 
                    accept="image/*" 
                    className="hidden" 
                    disabled={isUploadingShape}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Highlight Date Text Color */}
          <div className="space-y-2 pt-2 border-t">
            <div>
              <p className="font-medium text-sm">강조일자 텍스트 색상</p>
              <p className="text-xs text-muted-foreground">강조 도형 위의 날짜 숫자 텍스트 색상을 설정합니다.</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={currentInvitation?.customStyles?.calendarDayTextColor || '#ffffff'}
                onChange={(e) => {
                  const prevStyles = currentInvitation?.customStyles || {}
                  updateCurrentInvitation({
                    customStyles: {
                      ...prevStyles,
                      calendarDayTextColor: e.target.value
                    }
                  })
                  setActiveSection('calendar')
                }}
                className="h-8 w-14 rounded border cursor-pointer p-0 bg-transparent"
              />
              <span className="text-xs font-mono">{currentInvitation?.customStyles?.calendarDayTextColor || '#ffffff'}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[10px]"
                onClick={() => {
                  const prevStyles = currentInvitation?.customStyles || {}
                  updateCurrentInvitation({
                    customStyles: {
                      ...prevStyles,
                      calendarDayTextColor: '#ffffff'
                    }
                  })
                  setActiveSection('calendar')
                }}
              >
                기본값(흰색) 복원
              </Button>
            </div>
          </div>

          {/* Custom Shape SVG Color Picker */}
          {currentInvitation?.customStyles?.calendarDayShape === 'custom' && isCustomSvg && (
            <div className="space-y-2 pt-2 border-t">
              <div>
                <p className="font-medium text-sm">업로드된 SVG 강조 이미지 색상</p>
                <p className="text-xs text-muted-foreground">업로드한 SVG 이미지의 색상을 변경합니다. (기본값: 청첩장 포인트 색상)</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={currentInvitation?.customStyles?.calendarDaySvgColor || defaultAccentColor}
                  onChange={(e) => {
                    const prevStyles = currentInvitation?.customStyles || {}
                    updateCurrentInvitation({
                      customStyles: {
                        ...prevStyles,
                        calendarDaySvgColor: e.target.value
                      }
                    })
                    setActiveSection('calendar')
                  }}
                  className="h-8 w-14 rounded border cursor-pointer p-0 bg-transparent"
                />
                <span className="text-xs font-mono">{currentInvitation?.customStyles?.calendarDaySvgColor || defaultAccentColor}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={() => {
                    const prevStyles = currentInvitation?.customStyles || {}
                    updateCurrentInvitation({
                      customStyles: {
                        ...prevStyles,
                        calendarDaySvgColor: defaultAccentColor
                      }
                    })
                    setActiveSection('calendar')
                  }}
                >
                  기본 포인트색상 복원
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Greeting Icon Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">초대 인사말 아이콘 설정</CardTitle>
          <CardDescription>초대 인사말 위의 아이콘 모양과 디자인을 설정합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Greeting Icon Shape Selector */}
          <div className="space-y-4">
            <div>
              <p className="font-medium text-sm">아이콘 표시 모양</p>
              <p className="text-xs text-muted-foreground">인사말 위에 노출할 아이콘 모양을 선택합니다.</p>
            </div>
            <RadioGroup
              value={currentInvitation?.customStyles?.greetingIconShape || 'heart'}
              onValueChange={(val) => {
                const prevStyles = currentInvitation?.customStyles || {}
                updateCurrentInvitation({
                  customStyles: {
                    ...prevStyles,
                    greetingIconShape: val
                  }
                })
                setActiveSection('greeting')
              }}
              className="grid grid-cols-4 gap-2"
            >
              <div>
                <RadioGroupItem value="heart" id="icon-heart" className="peer sr-only" />
                <Label
                  htmlFor="icon-heart"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer text-xs"
                >
                  <span className="text-primary text-base leading-none mb-1">♥</span>
                  하트
                </Label>
              </div>
              <div>
                <RadioGroupItem value="circle" id="icon-circle" className="peer sr-only" />
                <Label
                  htmlFor="icon-circle"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer text-xs"
                >
                  <div className="h-4 w-4 rounded-full border border-primary mb-1" />
                  동그라미
                </Label>
              </div>
              <div>
                <RadioGroupItem value="star" id="icon-star" className="peer sr-only" />
                <Label
                  htmlFor="icon-star"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer text-xs"
                >
                  <span className="text-primary text-base leading-none mb-1">★</span>
                  별
                </Label>
              </div>
              <div>
                <RadioGroupItem value="custom" id="icon-custom" className="peer sr-only" />
                <Label
                  htmlFor="icon-custom"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer text-xs"
                >
                  <Upload className="h-4 w-4 text-primary mb-1.5" />
                  직접 업로드
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Custom Greeting Icon Upload */}
          {currentInvitation?.customStyles?.greetingIconShape === 'custom' && (
            <div className="space-y-2 pt-2 border-t">
              <span className="text-xs font-semibold block">커스텀 아이콘 업로드 (PNG/SVG 권장)</span>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded border bg-muted flex items-center justify-center overflow-hidden">
                  {currentInvitation.customStyles?.greetingIconCustomUrl ? (
                    <img src={currentInvitation.customStyles.greetingIconCustomUrl} className="h-full w-full object-contain" />
                  ) : (
                    <Image className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs"
                    onClick={() => greetingIconInputRef.current?.click()}
                    disabled={isUploadingGreetingIcon}
                  >
                    {isUploadingGreetingIcon ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                    이미지 추가
                  </Button>
                  <input 
                    type="file" 
                    ref={greetingIconInputRef} 
                    onChange={handleGreetingIconUpload} 
                    accept="image/*" 
                    className="hidden" 
                    disabled={isUploadingGreetingIcon}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Greeting Icon Color */}
          <div className="space-y-2 pt-2 border-t">
            <div>
              <p className="font-medium text-sm">아이콘 색상 설정</p>
              <p className="text-xs text-muted-foreground">아이콘의 렌더링 색상을 지정합니다. (직접 업로드한 SVG에도 적용됩니다)</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={currentInvitation?.customStyles?.greetingIconColor || defaultAccentColor}
                onChange={(e) => {
                  const prevStyles = currentInvitation?.customStyles || {}
                  updateCurrentInvitation({
                    customStyles: {
                      ...prevStyles,
                      greetingIconColor: e.target.value
                    }
                  })
                  setActiveSection('greeting')
                }}
                className="h-8 w-14 rounded border cursor-pointer p-0 bg-transparent"
              />
              <span className="text-xs font-mono">{currentInvitation?.customStyles?.greetingIconColor || defaultAccentColor}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[10px]"
                onClick={() => {
                  const prevStyles = currentInvitation?.customStyles || {}
                  updateCurrentInvitation({
                    customStyles: {
                      ...prevStyles,
                      greetingIconColor: defaultAccentColor
                    }
                  })
                  setActiveSection('greeting')
                }}
              >
                기본 포인트색상 복원
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Digital Stationery */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">디지털 스테이셔너리</CardTitle>
          <CardDescription>청첩장에 종이 질감 효과를 추가합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">종이 질감 효과</p>
              <p className="text-sm text-muted-foreground">
                청첩장에 고급스러운 종이 질감을 추가합니다.
              </p>
            </div>
            <Switch
              checked={paperTexture}
              onCheckedChange={setPaperTexture}
            />
          </div>
        </CardContent>
      </Card>

      {/* BGM */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">배경음악 (BGM)</CardTitle>
          <CardDescription>청첩장에 어울리는 배경음악을 선택해주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingBgms ? (
            <div className="flex justify-center items-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <RadioGroup
              value={currentInvitation?.bgmId || ''}
              onValueChange={(value) => {
                updateCurrentInvitation({ bgmId: value })
                setActiveSection('hero')
              }}
              className="space-y-2"
            >
              {bgms.map((bgm) => (
                <div 
                  key={bgm.id}
                  className={cn(
                    'flex items-center gap-4 rounded-lg border border-border p-4 transition-colors',
                    currentInvitation?.bgmId === bgm.id && 'border-foreground bg-muted/30'
                  )}
                >
                  <RadioGroupItem value={bgm.id} id={bgm.id} />
                  <button
                    type="button"
                    onClick={() => togglePlay(bgm.id, bgm.url)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
                  >
                  {playingBgm === bgm.id ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="ml-0.5 h-4 w-4" />
                  )}
                </button>
                <Label htmlFor={bgm.id} className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{bgm.name}</span>
                    {themeRecommendedBgms.includes(bgm.id) && (
                      <span className="flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                        <Star className="h-3 w-3 fill-current" />
                        테마 추천
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {bgm.artist} · {bgm.duration}
                  </p>
                </Label>
                </div>
              ))}
            </RadioGroup>
          )}
          <Button 
            variant="ghost" 
            className="mt-4 w-full"
            onClick={() => updateCurrentInvitation({ bgmId: null })}
          >
            BGM 사용 안함
          </Button>
        </CardContent>
      </Card>

      {/* Kakao Share Thumbnail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">카카오톡 공유 썸네일</CardTitle>
          <CardDescription>카카오톡으로 공유할 때 표시될 이미지와 내용을 설정합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>썸네일 이미지</FieldLabel>
              <div className="flex aspect-video w-full max-w-xs items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 cursor-pointer" onClick={() => kakaoImageInputRef.current?.click()}>
                {currentInvitation?.kakaoThumbnail ? (
                  <img 
                    src={currentInvitation.kakaoThumbnail} 
                    alt="카카오 썸네일" 
                    className="h-full w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="text-center">
                    {isUploadingKakao ? (
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isUploadingKakao ? '업로드 중...' : '이미지 업로드'}
                    </p>
                  </div>
                )}
              </div>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={kakaoImageInputRef}
                onChange={handleKakaoImageUpload}
                disabled={isUploadingKakao}
              />
              <Button variant="outline" size="sm" className="mt-2" onClick={() => kakaoImageInputRef.current?.click()} disabled={isUploadingKakao}>
                {isUploadingKakao ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                이미지 업로드
              </Button>
            </Field>
            <Field>
              <FieldLabel htmlFor="kakaoTitle">제목</FieldLabel>
              <Input
                id="kakaoTitle"
                placeholder="철수 ♥ 영희 결혼합니다"
                value={currentInvitation?.kakaoTitle || ''}
                onChange={(e) => updateCurrentInvitation({ kakaoTitle: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="kakaoDescription">설명</FieldLabel>
              <Input
                id="kakaoDescription"
                placeholder="2025년 3월 15일 오후 2시"
                value={currentInvitation?.kakaoDescription || ''}
                onChange={(e) => updateCurrentInvitation({ kakaoDescription: e.target.value })}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          이전 단계
        </Button>
        <Button onClick={handleNext}>
          다음 단계
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
