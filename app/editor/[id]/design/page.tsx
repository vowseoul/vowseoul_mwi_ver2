'use client'

import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore, sampleThemes, Theme } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'

const getFontFamily = (krFont: string, enFont: string) => {
  let enFamily = '';
  if (enFont.startsWith('font-')) {
    enFamily = enFont === 'font-serif' ? "'Playfair Display', Lora, Georgia" : "Inter, Montserrat, Arial";
  } else {
    enFamily = `'${enFont}'`;
  }

  let krFamily = '';
  if (krFont.startsWith('font-')) {
    krFamily = krFont === 'font-serif' ? "'Noto Serif KR', 'Nanum Myeongjo'" : "'Pretendard', 'Noto Sans KR'";
  } else {
    krFamily = `'${krFont}'`;
  }

  const isSerif = enFont.toLowerCase().includes('serif') || 
                  krFont.toLowerCase().includes('serif') || 
                  krFont.toLowerCase().includes('myeongjo') || 
                  enFont.toLowerCase().includes('playfair') || 
                  enFont.toLowerCase().includes('lora') ||
                  enFont.toLowerCase().includes('cormorant') ||
                  enFont.toLowerCase().includes('baskerville') ||
                  krFont === 'font-serif' || 
                  enFont === 'font-serif';
  const genericFallback = isSerif ? 'serif' : 'sans-serif';
  return `${enFamily}, ${krFamily}, ${genericFallback}`;
}

export default function DesignPage() {
  const router = useRouter()
  const params = useParams()
  const { currentInvitation, updateCurrentInvitation, saveInvitation } = useAppStore()
  const invitationId = params.id as string

  const [themes, setThemes] = useState<Theme[]>([])
  const [customFonts, setCustomFonts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeHeaderSection, setActiveHeaderSection] = useState('gallery')

  useEffect(() => {
    const fetchThemesAndFonts = async () => {
      const { data: themeData } = await supabase.from('themes').select('*')
      if (themeData && themeData.length > 0) {
        setThemes(themeData as any)
      } else {
        setThemes(sampleThemes)
      }
      
      try {
        const { data: fontData } = await supabase.from('settings').select('*').eq('key', 'fonts')
        if (fontData && fontData.length > 0 && fontData[0].value) {
          setCustomFonts(fontData[0].value)
        }
      } catch (err) {
        console.error('Error fetching fonts in DesignPage:', err)
      }
      
      setIsLoading(false)
    }
    fetchThemesAndFonts()
  }, [])

  const selectedTheme = themes.find(t => t.id === currentInvitation?.themeId) || themes[0]

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
  }

  const handleNext = async () => {
    const savedId = await saveInvitation()
    const targetId = savedId || invitationId
    router.push(`/editor/${targetId}/content`)
  }

  const handleBack = () => {
    router.push(`/editor/${invitationId}`)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">디자인/테마</h1>
        <p className="mt-1 text-muted-foreground">
          청첩장의 테마와 스타일을 선택해주세요.
        </p>
      </div>

      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">테마 선택</CardTitle>
          <CardDescription>원하는 분위기의 테마를 선택해주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {themes.map((theme) => {
              const isSelected = currentInvitation?.themeId === theme.id
              const defaultBg = theme.colorSets?.[0]?.colors?.[0] || theme.styles?.backgroundColor || '#FFF8F0';
              const defaultText = theme.colorSets?.[0]?.colors?.[2] || theme.styles?.textColor || '#3A3A3A';
              const defaultPrimary = theme.colorSets?.[0]?.colors?.[1] || theme.styles?.primaryColor || '#E8A87C';

              return (
                <button
                  key={theme.id}
                  onClick={() => updateCurrentInvitation({ 
                    themeId: theme.id,
                    colorSet: theme.colorSets?.[0]?.id || 'default',
                    fontSet: theme.fontSets?.[0]?.id || 'default',
                  })}
                  className={cn(
                    'group relative overflow-hidden rounded-lg border-2 text-left transition-all',
                    isSelected ? 'border-foreground' : 'border-border hover:border-foreground/50'
                  )}
                >
                  {/* Theme Preview */}
                  <div 
                    className="aspect-[3/4] p-4"
                    style={{ backgroundColor: defaultBg }}
                  >
                    <div 
                      className="flex h-full flex-col items-center justify-center text-center"
                      style={{ color: defaultText }}
                    >
                      <p className="text-[8px] tracking-[0.2em] opacity-60">WEDDING</p>
                      <p className="mt-1 font-serif text-sm">Groom</p>
                      <p className="text-xs opacity-60">&amp;</p>
                      <p className="font-serif text-sm">Bride</p>
                      <div 
                        className="mt-3 h-12 w-10 rounded-sm"
                        style={{ backgroundColor: defaultPrimary }}
                      />
                    </div>
                  </div>

                  {/* Theme Info */}
                  <div className="border-t border-border bg-background p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{theme.name}</span>
                      {isSelected && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground">
                          <Check className="h-3 w-3 text-background" />
                        </div>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {(Array.isArray(theme.tags) ? theme.tags : []).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Color Set Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">컬러셋</CardTitle>
          <CardDescription>테마에 어울리는 색상 조합을 선택해주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={currentInvitation?.colorSet || selectedTheme?.colorSets?.[0]?.id || 'default'}
            onValueChange={(value) => updateCurrentInvitation({ colorSet: value })}
            className="grid gap-4 sm:grid-cols-2"
          >
            {selectedTheme?.colorSets?.map((colorSet) => (
              <div key={colorSet.id}>
                <RadioGroupItem
                  value={colorSet.id}
                  id={`color-${colorSet.id}`}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={`color-${colorSet.id}`}
                  className={cn(
                    'flex cursor-pointer items-center gap-4 rounded-lg border-2 p-4 transition-all',
                    'peer-data-[state=checked]:border-foreground peer-data-[state=unchecked]:border-border',
                    'hover:border-foreground/50'
                  )}
                >
                  <div className="flex gap-1">
                    {colorSet.colors.map((color, idx) => (
                      <div
                        key={idx}
                        className="h-8 w-8 rounded-full border border-border"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span className="font-medium">{colorSet.name}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>

          {/* 직접 설정하기 Toggle */}
          <div className="mt-6 pt-6 border-t border-border space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="custom-colors-toggle" className="text-sm font-medium">직접 설정하기 (커스텀 듀오톤)</Label>
                <p className="text-xs text-muted-foreground">테마 프리셋 대신 내가 원하는 두 가지 색상 조합으로 청첩장을 꾸밉니다.</p>
              </div>
              <Switch 
                id="custom-colors-toggle"
                checked={currentInvitation?.customStyles?.customColorsEnabled || false}
                onCheckedChange={(checked) => {
                  updateCurrentInvitation({
                    customStyles: {
                      ...(currentInvitation?.customStyles || {}),
                      customColorsEnabled: checked,
                      duotoneEnabled: checked // automatically enable duotone alternating if custom colors are used
                    }
                  })
                }}
              />
            </div>

            {currentInvitation?.customStyles?.customColorsEnabled && (
              <div className="grid gap-4 sm:grid-cols-2 pt-2 animate-in fade-in duration-200">
                <div className="space-y-2">
                  <Label className="text-xs">배경 색상 (Color 1 - 밝은색 권장)</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="color" 
                      className="w-10 h-10 p-1 cursor-pointer border" 
                      value={currentInvitation?.customStyles?.customBgColor || '#CCECFF'} 
                      onChange={(e) => {
                        updateCurrentInvitation({
                          customStyles: {
                            ...(currentInvitation?.customStyles || {}),
                            customBgColor: e.target.value
                          }
                        })
                      }}
                    />
                    <Input 
                      className="flex-1 uppercase font-mono text-sm" 
                      value={currentInvitation?.customStyles?.customBgColor || '#CCECFF'} 
                      onChange={(e) => {
                        updateCurrentInvitation({
                          customStyles: {
                            ...(currentInvitation?.customStyles || {}),
                            customBgColor: e.target.value
                          }
                        })
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">주요 색상 (Color 2 - 어두운색 권장)</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="color" 
                      className="w-10 h-10 p-1 cursor-pointer border" 
                      value={currentInvitation?.customStyles?.customPrimaryColor || '#361623'} 
                      onChange={(e) => {
                        updateCurrentInvitation({
                          customStyles: {
                            ...(currentInvitation?.customStyles || {}),
                            customPrimaryColor: e.target.value
                          }
                        })
                      }}
                    />
                    <Input 
                      className="flex-1 uppercase font-mono text-sm" 
                      value={currentInvitation?.customStyles?.customPrimaryColor || '#361623'} 
                      onChange={(e) => {
                        updateCurrentInvitation({
                          customStyles: {
                            ...(currentInvitation?.customStyles || {}),
                            customPrimaryColor: e.target.value
                          }
                        })
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Font Set Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">폰트 조합</CardTitle>
          <CardDescription>청첩장에 사용될 폰트 스타일을 선택해주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={currentInvitation?.fontSet || selectedTheme?.fontSets?.[0]?.id || 'default'}
            onValueChange={(value) => {
              const updatedStyles = { ...(currentInvitation?.customStyles || {}) }
              delete updatedStyles.fontKr
              delete updatedStyles.fontEn
              updateCurrentInvitation({ 
                fontSet: value,
                customStyles: updatedStyles
              })
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            {selectedTheme?.fontSets?.map((fontSet) => {
              const krFont = fontSet.fonts[0] || 'font-sans'
              const enFont = fontSet.fonts[1] || 'font-sans'
              const fontFamilyVal = getFontFamily(krFont, enFont)

              return (
                <div key={fontSet.id}>
                  <RadioGroupItem
                    value={fontSet.id}
                    id={`font-${fontSet.id}`}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={`font-${fontSet.id}`}
                    className={cn(
                      'flex cursor-pointer flex-col gap-2 rounded-lg border-2 p-4 transition-all',
                      'peer-data-[state=checked]:border-foreground peer-data-[state=unchecked]:border-border',
                      'hover:border-foreground/50'
                    )}
                    style={{ fontFamily: fontFamilyVal }}
                  >
                    <span className="font-semibold text-base">{fontSet.name}</span>
                    <span className="text-sm opacity-85 py-1">
                      신랑 신부 결혼합니다. Groom & Bride
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono mt-1 pt-1 border-t border-muted/20">
                      {fontSet.fonts.join(' + ')}
                    </span>
                  </Label>
                </div>
              )
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Detailed Body Font Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">본문 서체 상세 설정 (개별 서체 선택)</CardTitle>
          <CardDescription>청첩장의 기본 본문 내용(국문/영문)에 적용될 서체를 개별적으로 세밀하게 지정합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm">국문 본문 서체</Label>
              <Select
                value={currentInvitation?.customStyles?.fontKr || 'none_clear'}
                onValueChange={(val) => {
                  updateCurrentInvitation({
                    customStyles: {
                      ...(currentInvitation?.customStyles || {}),
                      fontKr: val === 'none_clear' ? undefined : val
                    }
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="기본 조합 서체 사용" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none_clear">기본 조합 서체 사용</SelectItem>
                  <SelectItem value="font-serif">기본 명조체 (Noto Serif)</SelectItem>
                  <SelectItem value="font-sans">기본 고딕체 (Pretendard)</SelectItem>
                  {customFonts.map((font) => (
                    <SelectItem key={font.id} value={font.family || font.name}>{font.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">영문 본문 서체</Label>
              <Select
                value={currentInvitation?.customStyles?.fontEn || 'none_clear'}
                onValueChange={(val) => {
                  updateCurrentInvitation({
                    customStyles: {
                      ...(currentInvitation?.customStyles || {}),
                      fontEn: val === 'none_clear' ? undefined : val
                    }
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="기본 조합 서체 사용" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none_clear">기본 조합 서체 사용</SelectItem>
                  <SelectItem value="font-serif">기본 명조체 (Playfair)</SelectItem>
                  <SelectItem value="font-sans">기본 고딕체 (Inter)</SelectItem>
                  {customFonts.map((font) => (
                    <SelectItem key={font.id} value={font.family || font.name}>{font.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hero Subtitle settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">히어로 서브타이틀 설정 (대문 이미지 문구)</CardTitle>
          <CardDescription>청첩장 최상단 대문 섹션에 표시될 영어 서브타이틀의 문구와 스타일을 수정합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-sm">타이틀 문구</Label>
              <Input 
                value={currentInvitation?.customStyles?.heroSubtitleText ?? 'save the date'} 
                placeholder="save the date" 
                onChange={(e) => {
                  updateCurrentInvitation({
                    customStyles: {
                      ...(currentInvitation?.customStyles || {}),
                      heroSubtitleText: e.target.value
                    }
                  })
                }}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm">폰트 선택</Label>
              <Select
                value={currentInvitation?.customStyles?.heroSubtitleFont || 'font-serif'}
                onValueChange={(val) => {
                  updateCurrentInvitation({
                    customStyles: {
                      ...(currentInvitation?.customStyles || {}),
                      heroSubtitleFont: val
                    }
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="font-serif">기본 명조체 (Playfair / Lora)</SelectItem>
                  <SelectItem value="font-sans">기본 고딕체 (Inter)</SelectItem>
                  {customFonts.map((font) => (
                    <SelectItem key={font.id} value={font.family}>{font.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">폰트 크기</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  min="10" 
                  max="60" 
                  value={currentInvitation?.customStyles?.heroSubtitleSize ?? 20} 
                  onChange={(e) => {
                    updateCurrentInvitation({
                      customStyles: {
                        ...(currentInvitation?.customStyles || {}),
                        heroSubtitleSize: parseInt(e.target.value) || 20
                      }
                    })
                  }}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">px</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 대문 예식정보 및 인사말 세부 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">대문 예식정보 & 인사말 스타일 설정</CardTitle>
          <CardDescription>대문 이미지 하단의 예식 정보(이름, 시간, 장소) 서체와 크기를 조정하고, 인사말 섹션 내 혼주 이름 스타일을 변경합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 대문 예식정보 서체 및 크기 */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">대문 예식정보 스타일</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs">서체 선택</Label>
                <Select
                  value={currentInvitation?.customStyles?.heroInfoFont || 'font-sans'}
                  onValueChange={(val) => {
                    updateCurrentInvitation({
                      customStyles: {
                        ...(currentInvitation?.customStyles || {}),
                        heroInfoFont: val
                      }
                    })
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="font-serif">기본 명조체</SelectItem>
                    <SelectItem value="font-sans">기본 고딕체</SelectItem>
                    {customFonts.map((font) => (
                      <SelectItem key={font.id} value={font.family}>{font.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">신랑 신부 이름 크기</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    min="10" 
                    max="40" 
                    value={currentInvitation?.customStyles?.heroInfoGroomBrideSize ?? 14} 
                    onChange={(e) => {
                      updateCurrentInvitation({
                        customStyles: {
                          ...(currentInvitation?.customStyles || {}),
                          heroInfoGroomBrideSize: parseInt(e.target.value) || 14
                        }
                      })
                    }}
                    className="h-9"
                  />
                  <span className="text-xs text-muted-foreground">px</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">예식 일시/장소 크기</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    min="8" 
                    max="30" 
                    value={currentInvitation?.customStyles?.heroInfoDetailsSize ?? 10} 
                    onChange={(e) => {
                      updateCurrentInvitation({
                        customStyles: {
                          ...(currentInvitation?.customStyles || {}),
                          heroInfoDetailsSize: parseInt(e.target.value) || 10
                        }
                      })
                    }}
                    className="h-9"
                  />
                  <span className="text-xs text-muted-foreground">px</span>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-muted/50" />


        </CardContent>
      </Card>

      {/* Section Header Customization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">섹션 타이틀 상세 설정</CardTitle>
          <CardDescription>
            각 섹션별 영어/한국어 제목의 노출 여부, 문구 수정 및 텍스트 레이아웃(서체, 크기, 스타일)을 변경합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-sm">편집할 섹션 선택</Label>
            <Select
              value={activeHeaderSection}
              onValueChange={(val) => setActiveHeaderSection(val)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequence">식순 안내 (Sequence)</SelectItem>
                <SelectItem value="gallery">사진첩 (Gallery)</SelectItem>
                <SelectItem value="calendar">소중한 날 (Calendar)</SelectItem>
                <SelectItem value="location">식장 위치 (Location)</SelectItem>
                <SelectItem value="contact">연락처 (Contact)</SelectItem>
                <SelectItem value="account">마음 전하실 곳 (Account)</SelectItem>
                <SelectItem value="rsvp">참석 의사 알리기 (RSVP)</SelectItem>
                <SelectItem value="guestbook">방명록 (Guestbook)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(() => {
            const sectionId = activeHeaderSection
            const headers = currentInvitation?.customStyles?.sectionHeaders || {}
            const settings = headers[sectionId] || {}
            
            const isShow = settings.show ?? true
            const titleEn = settings.titleEn ?? (
              sectionId === 'sequence' ? 'WEDDING ORDER' :
              sectionId === 'gallery' ? 'Gallery' :
              sectionId === 'calendar' ? 'Calendar' :
              sectionId === 'location' ? 'Location' :
              sectionId === 'contact' ? 'Contact' :
              sectionId === 'account' ? 'Account' :
              sectionId === 'rsvp' ? 'RSVP' : 'Guestbook'
            )
            const titleKr = settings.titleKr ?? (
              sectionId === 'sequence' ? '식순 안내' :
              sectionId === 'gallery' ? '사진첩' :
              sectionId === 'calendar' ? '소중한 날' :
              sectionId === 'location' ? '식장 위치' :
              sectionId === 'contact' ? '연락처' :
              sectionId === 'account' ? '마음 전하실 곳' :
              sectionId === 'rsvp' ? '참석 의사 알리기' : '방명록'
            )
            const fontEnVal = settings.fontEn || 'font-serif'
            const fontKrVal = settings.fontKr || 'font-serif'
            const sizeEn = settings.sizeEn ?? (sectionId === 'sequence' ? 24 : 20)
            const sizeKr = settings.sizeKr ?? (sectionId === 'sequence' ? 10 : 9)
            const italicEn = settings.italicEn ?? true
            const italicKr = settings.italicKr ?? false
            const boldEn = settings.boldEn ?? false
            const boldKr = settings.boldKr ?? true
            const colorEn = settings.colorEn || '#000000'
            const colorKr = settings.colorKr || '#000000'

            const updateSetting = (key: string, value: any) => {
              updateCurrentInvitation({
                customStyles: {
                  ...(currentInvitation?.customStyles || {}),
                  sectionHeaders: {
                    ...headers,
                    [sectionId]: {
                      ...settings,
                      [key]: value
                    }
                  }
                }
              })
            }

            return (
              <div className="space-y-4 pt-4 border-t border-muted/50">
                {/* 1. Show/Hide Switch */}
                <div className="flex items-center justify-between pb-2">
                  <Label htmlFor="header-show-toggle" className="text-sm font-medium">섹션 타이틀 노출 여부</Label>
                  <Switch
                    id="header-show-toggle"
                    checked={isShow}
                    onCheckedChange={(checked) => updateSetting('show', checked)}
                  />
                </div>

                {isShow && (
                  <div className="space-y-4 pt-2">
                    {/* 2. Text Inputs */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs">영문 타이틀 문구</Label>
                        <Input
                          value={titleEn}
                          onChange={(e) => updateSetting('titleEn', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">국문 타이틀 문구</Label>
                        <Input
                          value={titleKr}
                          onChange={(e) => updateSetting('titleKr', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* 3. Typography Styles */}
                    <div className="border border-muted/30 p-4 rounded-lg space-y-4 bg-muted/5">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">영문 타이틀 레이아웃</h4>
                      <div className="grid gap-4 sm:grid-cols-4 items-end">
                        <div className="space-y-2">
                          <Label className="text-[11px]">서체 선택</Label>
                          <Select
                            value={fontEnVal}
                            onValueChange={(val) => updateSetting('fontEn', val)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="font-serif">기본 명조체 (Playfair)</SelectItem>
                              <SelectItem value="font-sans">기본 고딕체 (Inter)</SelectItem>
                              {customFonts.map((f) => (
                                <SelectItem key={f.id} value={f.family}>{f.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[11px]">크기</Label>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              className="h-8 text-xs w-20"
                              value={sizeEn}
                              onChange={(e) => updateSetting('sizeEn', parseInt(e.target.value) || 20)}
                            />
                            <span className="text-[10px] text-muted-foreground">px</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[11px]">글씨 색상</Label>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="color"
                              className="h-8 w-12 p-0.5 border cursor-pointer"
                              value={colorEn}
                              onChange={(e) => updateSetting('colorEn', e.target.value)}
                            />
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">{colorEn}</span>
                          </div>
                        </div>
                        <div className="flex gap-4 pb-2">
                          <div className="flex items-center space-x-1.5">
                            <Checkbox
                              id="italic-en-toggle"
                              checked={italicEn}
                              onCheckedChange={(checked) => updateSetting('italicEn', !!checked)}
                            />
                            <Label htmlFor="italic-en-toggle" className="text-xs select-none">이탤릭</Label>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <Checkbox
                              id="bold-en-toggle"
                              checked={boldEn}
                              onCheckedChange={(checked) => updateSetting('boldEn', !!checked)}
                            />
                            <Label htmlFor="bold-en-toggle" className="text-xs select-none">굵게</Label>
                          </div>
                        </div>
                      </div>

                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2 border-t border-muted/20">국문 타이틀 레이아웃</h4>
                      <div className="grid gap-4 sm:grid-cols-4 items-end">
                        <div className="space-y-2">
                          <Label className="text-[11px]">서체 선택</Label>
                          <Select
                            value={fontKrVal}
                            onValueChange={(val) => updateSetting('fontKr', val)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="font-serif">기본 명조체 (Noto Serif)</SelectItem>
                              <SelectItem value="font-sans">기본 고딕체 (Pretendard)</SelectItem>
                              {customFonts.map((f) => (
                                <SelectItem key={f.id} value={f.family}>{f.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[11px]">크기</Label>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              className="h-8 text-xs w-20"
                              value={sizeKr}
                              onChange={(e) => updateSetting('sizeKr', parseInt(e.target.value) || 9)}
                            />
                            <span className="text-[10px] text-muted-foreground">px</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[11px]">글씨 색상</Label>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="color"
                              className="h-8 w-12 p-0.5 border cursor-pointer"
                              value={colorKr}
                              onChange={(e) => updateSetting('colorKr', e.target.value)}
                            />
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">{colorKr}</span>
                          </div>
                        </div>
                        <div className="flex gap-4 pb-2">
                          <div className="flex items-center space-x-1.5">
                            <Checkbox
                              id="italic-kr-toggle"
                              checked={italicKr}
                              onCheckedChange={(checked) => updateSetting('italicKr', !!checked)}
                            />
                            <Label htmlFor="italic-kr-toggle" className="text-xs select-none">이탤릭</Label>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <Checkbox
                              id="bold-kr-toggle"
                              checked={boldKr}
                              onCheckedChange={(checked) => updateSetting('boldKr', !!checked)}
                            />
                            <Label htmlFor="bold-kr-toggle" className="text-xs select-none">굵게</Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
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
