'use client'

import React, { useState, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppStore, sampleThemes } from '@/lib/store'
import { NaverMap } from '@/components/naver-map'
import { supabase } from '@/lib/supabase'
import { cn, getLegibleColor } from '@/lib/utils'
import { toast } from 'sonner'
import { Logo } from '@/components/logo'
import { 
  Calendar as CalendarIcon, 
  MapPin, 
  Phone, 
  Copy, 
  Share2, 
  Heart,
  Circle,
  Star,
  Navigation,
  ChevronDown,
  Image
} from "lucide-react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"

const getSvgMaskStyle = (url: string, color: string) => ({
  backgroundColor: color,
  WebkitMaskImage: `url(${url})`,
  maskImage: `url(${url})`,
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
})

const parseIndividualParents = (fullRelation: string) => {
  const result = { fatherName: '', motherName: '', relationText: '' }
  if (!fullRelation) return result

  // Pattern 1: "아버지 김철수, 어머니 이영희의 장남"
  const pattern1 = /아버지\s*([^\s,··]+)[,\s·]*어머니\s*([^\s의]+)의\s*(.*)/
  const match1 = fullRelation.match(pattern1)
  if (match1) {
    result.fatherName = match1[1].trim()
    result.motherName = match1[2].trim()
    result.relationText = `의 ${match1[3].trim()}`
    return result
  }

  // Pattern 2: "김태진 · 정혜선 의 아들"
  const pattern2 = /^([^\s의,·]+)[,\s·]+([^\s의,·]+)\s*의\s*(.*)/
  const match2 = fullRelation.match(pattern2)
  if (match2) {
    result.fatherName = match2[1].trim()
    result.motherName = match2[2].trim()
    result.relationText = `의 ${match2[3].trim()}`
    return result
  }

  // Pattern 3: "김태진 의 아들"
  const pattern3 = /^([^\s의]+)\s*의\s*(.*)/
  const match3 = fullRelation.match(pattern3)
  if (match3) {
    result.fatherName = match3[1].trim()
    result.relationText = `의 ${match3[2].trim()}`
    return result
  }

  return result
}

const formatParentRelation = (relationStr: string, parentNames?: string, relationText?: string) => {
  if (parentNames !== undefined && relationText !== undefined) {
    return (
      <span>
        <strong className="font-semibold">{parentNames}</strong>
        {relationText ? ` ${relationText}` : ''}
      </span>
    );
  }
  if (!relationStr) return '';
  const match = relationStr.match(/^(.*?)(의\s+아들|의\s+딸|의\s*\S*)$/);
  if (match) {
    return (
      <span>
        <strong className="font-semibold">{match[1]}</strong>{match[2]}
      </span>
    );
  }
  return <strong className="font-semibold">{relationStr}</strong>;
};

export function MobilePreview({ className, isSticky = true }: { className?: string; isSticky?: boolean }) {
  const { currentInvitation, themes, activeSection } = useAppStore()
  const [customFonts, setCustomFonts] = useState<any[]>([])
  const [activeImageModal, setActiveImageModal] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 })

  useEffect(() => {
    if (!currentInvitation?.weddingDate) return
    
    const getCountdown = (dateStr: string, timeStr?: string) => {
      if (!dateStr) return { days: 0, hours: 0, minutes: 0 }
      const timeVal = timeStr || '12:00'
      try {
        const target = new Date(`${dateStr}T${timeVal}:00`)
        const now = new Date()
        const diff = target.getTime() - now.getTime()
        if (diff <= 0) return { days: 0, hours: 0, minutes: 0 }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
        const minutes = Math.floor((diff / (1000 * 60)) % 60)
        
        return { days, hours, minutes }
      } catch (e) {
        return { days: 0, hours: 0, minutes: 0 }
      }
    }

    const updateTime = () => {
      const { days, hours, minutes } = getCountdown(currentInvitation.weddingDate!, currentInvitation.weddingTime)
      setTimeLeft({ days, hours, minutes })
    }
    
    updateTime()
    const timer = setInterval(updateTime, 60000) // update every minute
    return () => clearInterval(timer)
  }, [currentInvitation?.weddingDate, currentInvitation?.weddingTime])

  useEffect(() => {
    if (activeSection) {
      const element = document.getElementById(`preview-section-${activeSection}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [activeSection])

  useEffect(() => {
    const loadFonts = async () => {
      try {
        const { data } = await supabase.from('settings').select('*').eq('key', 'fonts')
        if (data && data.length > 0 && data[0].value) {
          setCustomFonts(data[0].value)
        }
      } catch (err) {
        console.error('Error fetching fonts in MobilePreview:', err)
      }
    }
    loadFonts()
  }, [])
  
  // Load themes from DB list, then fallback to sampleThemes
  const theme = themes.find(t => t.id === currentInvitation?.themeId) || sampleThemes.find(t => t.id === currentInvitation?.themeId) || sampleThemes[0]
  const colorSet = theme?.colorSets?.find(c => c.id === currentInvitation?.colorSet) || theme?.colorSets?.[0]
  const fontSet = theme?.fontSets?.find(f => f.id === currentInvitation?.fontSet) || theme?.fontSets?.[0]
  
  // Styles with fallbacks
  const themeStyles: any = {
    ...theme?.styles,
    ...(currentInvitation?.customStyles || {})
  }

  const isDuotone = theme?.id === 'duotone-contrast' || themeStyles.duotoneEnabled === true
  const isSereneBlue = theme?.id === 'serene-blue'
  const isConcept5 = theme?.id === 'concept5'
  
  let color1 = '#CCECFF'
  let color2 = '#361623'
  
  if (themeStyles.customColorsEnabled) {
    color1 = themeStyles.customBgColor || '#CCECFF'
    color2 = themeStyles.customPrimaryColor || '#361623'
  } else {
    // Read from selected colorSet
    const activeColorSet = theme?.colorSets?.find(c => c.id === currentInvitation?.colorSet) || theme?.colorSets?.[0]
    if (activeColorSet && activeColorSet.colors && activeColorSet.colors.length >= 2) {
      color1 = activeColorSet.colors[0]
      color2 = activeColorSet.colors[1]
    }
  }

  const bgColor = isDuotone ? color1 : (themeStyles.backgroundColor || colorSet?.colors?.[0] || '#faf9f7')
  const rawAccentColor = isDuotone ? color2 : (themeStyles.primaryColor || colorSet?.colors?.[1] || '#c4a574')
  const rawTextColor = isDuotone ? color2 : (themeStyles.textColor || colorSet?.colors?.[2] || '#3d3d3d')
  const rawSecondaryTextColor = themeStyles.secondaryTextColor || '#8a8a8a'

  const accentColor = getLegibleColor(bgColor, rawAccentColor, false)
  const textColor = getLegibleColor(bgColor, rawTextColor, true)
  const secondaryTextColor = getLegibleColor(bgColor, rawSecondaryTextColor, false)
  const fontClass = fontSet?.id === 'serif' ? 'font-serif' : 'font-sans'

  const borderRadius = themeStyles.borderRadius || '8px'
  const sectionSpacing = themeStyles.sectionSpacing || 'py-12'
  const cardBg = themeStyles.cardBg || 'bg-white/40'
  const cardShadow = themeStyles.cardShadow || 'shadow-sm'
  const dividerType = themeStyles.dividerType || 'heart'
  const heroStyle = themeStyles.heroStyle || 'center'
  const heroConnector = themeStyles.heroConnector === 'none_clear' ? '&' : (themeStyles.heroConnector || '&')
  const accountLayout = themeStyles.accountLayout || '1col'

  const fontKr = currentInvitation?.customStyles?.fontKr || fontSet?.fonts?.[0] || (theme?.styles as any)?.fontKr || 'font-serif'
  const fontEn = currentInvitation?.customStyles?.fontEn || fontSet?.fonts?.[1] || (theme?.styles as any)?.fontEn || 'font-serif'

  const getSectionColors = (sectionId: string, index: number) => {
    if (!isDuotone) {
      const isEven = index % 2 === 0
      const bg = theme.layout === 'minimal' ? 'bg-transparent' : (isEven ? 'bg-white/40 backdrop-blur-sm' : 'bg-black/5')
      return {
        bgStyle: theme.layout === 'minimal' ? { backgroundColor: 'transparent' } : {},
        textStyle: { color: textColor },
        accent: accentColor,
        isDark: false,
        bgColorVal: bgColor,
        textColorVal: textColor,
        secondaryTextColorVal: secondaryTextColor,
        cardBgVal: cardBg
      }
    }
    
    // Duotone alternating behavior
    const darkSections = ['hero', 'sequence', 'gallery', 'calendar', 'rsvp', 'guestbook', 'footer']
    const isDark = darkSections.includes(sectionId)
    
    const bgVal = isDark ? color2 : color1
    const textVal = isDark ? color1 : color2
    const accVal = isDark ? color1 : color2
    
    return {
      bgStyle: { backgroundColor: bgVal },
      textStyle: { color: textVal },
      accent: accVal,
      isDark,
      bgColorVal: bgVal,
      textColorVal: textVal,
      secondaryTextColorVal: isDark ? `${color1}cc` : `${color2}cc`,
      cardBgVal: isDark ? 'bg-white/10' : 'bg-black/5' // simple transparent card overlay for contrast
    }
  }

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

  const copyToClipboard = (text: string, type: 'address' | 'account' = 'account') => {
    navigator.clipboard.writeText(text)
    if (type === 'address') {
      toast.success("주소가 복사되었습니다.")
    } else {
      toast.success("계좌번호가 복사되었습니다.")
    }
  }

  const getDDayString = (dateStr: string) => {
    if (!dateStr) return null
    const wedding = new Date(dateStr + 'T00:00:00')
    const today = new Date()
    wedding.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    const diffTime = wedding.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'D-Day'
    if (diffDays > 0) return `D-${diffDays}`
    return `D+${Math.abs(diffDays)}`
  }

  
  // Default section order if missing
  const defaultOrder = ['hero', 'greeting', 'sequence', 'gallery', 'calendar', 'location', 'contact', 'account', 'rsvp', 'guestbook']
  const rawOrder = themeStyles.sectionOrder || defaultOrder
  const sectionOrder = rawOrder.includes('sequence')
    ? rawOrder
    : (() => {
        const idx = rawOrder.indexOf('greeting')
        const newOrder = [...rawOrder]
        newOrder.splice(idx !== -1 ? idx + 1 : 2, 0, 'sequence')
        return newOrder
      })()

  // Generate calendar days
  const getCalendarDays = (dateStr: string) => {
    if (!dateStr) return { year: 2025, month: 3, day: 15, days: [] }
    const date = new Date(dateStr + 'T00:00:00')
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const targetDay = date.getDate()
    
    const firstDay = new Date(year, month - 1, 1)
    const startOfWeek = firstDay.getDay()
    
    const totalDays = new Date(year, month, 0).getDate()
    
    const days = []
    for (let i = 0; i < startOfWeek; i++) {
      days.push(null)
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push(i)
    }
    
    return { year, month, day: targetDay, days }
  }

  const { year: calYear, month: calMonth, day: calDay, days: calDays } = getCalendarDays(currentInvitation?.weddingDate || '')

  const renderSectionHeader = (sectionId: string, defaultEn: string, defaultKr: string, extraMb = 'mb-6', px = '') => {
    const headerSettings = themeStyles.sectionHeaders?.[sectionId] || {}
    const show = headerSettings.show ?? true
    if (!show) return null

    const titleEn = headerSettings.titleEn !== undefined ? headerSettings.titleEn : defaultEn
    const titleKr = headerSettings.titleKr !== undefined ? headerSettings.titleKr : defaultKr
    const fontEnVal = headerSettings.fontEn || fontEn
    const fontKrVal = headerSettings.fontKr || fontKr
    const sizeEn = headerSettings.sizeEn ?? 20
    const sizeKr = headerSettings.sizeKr ?? 9
    const italicEn = headerSettings.italicEn ?? true
    const italicKr = headerSettings.italicKr ?? false
    const boldEn = headerSettings.boldEn ?? false
    const boldKr = headerSettings.boldKr ?? true
    const colorEn = headerSettings.colorEn || undefined
    const colorKr = headerSettings.colorKr || undefined

    return (
      <div className={cn("text-center", extraMb, px)}>
        <h2 
          className={cn(
            italicEn && "italic", 
            boldEn ? "font-bold" : "font-light",
            "leading-none tracking-wide"
          )}
          style={{ 
            fontFamily: getFontFamily(fontKrVal, fontEnVal),
            fontSize: `${sizeEn}px`,
            color: colorEn
          }}
        >
          {titleEn}
        </h2>
        <p 
          className={cn(
            "tracking-[0.2em] uppercase mt-1.5 font-sans",
            italicKr && "italic",
            boldKr ? "font-semibold" : "font-medium"
          )}
          style={{ 
            fontFamily: getFontFamily(fontKrVal, fontEnVal),
            fontSize: `${sizeKr}px`,
            color: colorKr,
            opacity: colorKr ? 1 : 0.55
          }}
        >
          {titleKr}
        </p>
      </div>
    )
  }

  return (
    <div className={cn(isSticky && "sticky top-24", className)}>
      <div 
        className="relative mx-auto overflow-hidden rounded-[40px] border-8 border-foreground/10 bg-foreground/5 shadow-2xl"
        style={{ width: '320px', height: '640px' }}
      >
        {/* Phone notch */}
        <div className="absolute left-1/2 top-2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-foreground/10" />
        
        {/* Screen content */}
        <ScrollArea className="h-full w-full rounded-[32px]" style={{ backgroundColor: bgColor }}>
          {/* Dynamic Style injection for custom fonts */}
          <style dangerouslySetInnerHTML={{
            __html: (() => {
              // Only load active fonts to minimize network bandwidth and prevent FOUC
              const fonts = new Set<string>()
              if (fontKr) fonts.add(fontKr)
              if (fontEn) fonts.add(fontEn)
              fonts.add('Covered By Your Grace')
              fonts.add('Nothing You Could Do')
              if (themeStyles.heroSubtitleFont) fonts.add(themeStyles.heroSubtitleFont)
              if (themeStyles.heroInfoFont) fonts.add(themeStyles.heroInfoFont)
              if (themeStyles.sectionHeaders) {
                Object.values(themeStyles.sectionHeaders).forEach((s: any) => {
                  if (s.fontEn) fonts.add(s.fontEn)
                  if (s.fontKr) fonts.add(s.fontKr)
                })
              }

              const googleFontsMap: Record<string, string[]> = {
                'Cormorant': ['Cormorant:ital,wght@0,300..700;1,300..700'],
                'Cinzel': ['Cinzel:wght@400..900'],
                'DM Sans': ['DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000'],
                'Inter': ['Inter:wght@100..900'],
                'Libre Baskerville': ['Libre+Baskerville:ital,wght@0,400;0,700;1,400'],
                'Lora': ['Lora:ital,wght@0,400..700;1,400..700'],
                'Montserrat': ['Montserrat:ital,wght@0,100..900;1,100..900'],
                'Nanum Myeongjo': ['Nanum+Myeongjo:wght@400;700;800'],
                'Noto Serif KR': ['Noto+Serif+KR:wght@200..900'],
                'Nunito': ['Nunito:ital,wght@0,200..1000;1,200..1000'],
                'Playfair Display': ['Playfair+Display:ital,wght@0,400..900;1,400..900'],
                'Quicksand': ['Quicksand:wght@300..700'],
                'Kaushan Script': ['Kaushan+Script'],
                'Radio Canada Big': ['Radio+Canada+Big:ital,wght@0,400..700;1,400..700'],
                'Source Serif Pro': ['Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900'],
                'Nothing You Could Do': ['Nothing+You+Could+Do'],
                'Covered By Your Grace': ['Covered+By+Your+Grace'],
                'font-serif': ['Noto+Serif+KR:wght@200..900', 'Nanum+Myeongjo:wght@400;700;800', 'Playfair+Display:ital,wght@0,400..900;1,400..900', 'Lora:ital,wght@0,400..700;1,400..700'],
                'font-sans': ['Inter:wght@100..900', 'Montserrat:ital,wght@0,100..900;1,100..900']
              }

              const families: string[] = []
              fonts.forEach(f => {
                const mapped = googleFontsMap[f]
                if (mapped) {
                  families.push(...mapped)
                } else {
                  const matchingKey = Object.keys(googleFontsMap).find(k => k.toLowerCase() === f.toLowerCase())
                  if (matchingKey && googleFontsMap[matchingKey]) {
                    families.push(...googleFontsMap[matchingKey])
                  }
                }
              })

              const uniqueFamilies = Array.from(new Set(families))
              const defaultGoogleFonts = uniqueFamilies.length > 0
                ? `@import url('https://fonts.googleapis.com/css2?${uniqueFamilies.map(q => `family=${q}`).join('&')}&display=swap');`
                : ''

              const imports = customFonts
                .filter(f => f.type === 'embed')
                .map(f => (f.embedCode || '').replace(/<\/?style>/gi, ''))
                .join('\n');
              const directImports = customFonts
                .filter(f => f.url)
                .map(f => `@import url('${f.url}');`)
                .join('\n');
              const fontFaces = customFonts
                .filter(f => f.type === 'file' && f.fileUrl)
                .map(f => `
                  @font-face {
                    font-family: '${f.family}';
                    src: url('/api/fonts?url=${encodeURIComponent(f.fileUrl)}') format('truetype');
                    font-display: swap;
                  }
                `)
                .join('\n');
              return `${defaultGoogleFonts}\n${imports}\n${directImports}\n${fontFaces}`;
            })()
          }} />

          <div className={cn("text-center select-none w-[304px] max-w-full overflow-x-hidden", fontClass, isDuotone ? "" : "pb-12")} style={{ color: textColor, fontFamily: getFontFamily(fontKr, fontEn) }}>
            
            {(sectionOrder as string[]).map((sectionId: string, idx: number) => {
              // Layout-specific styling rules
              const isMinimal = theme.layout === 'minimal'
              const isGrid = theme.layout === 'grid'
              const isTwoColumn = theme.layout === 'two-column'

              const borderStyle = { borderRadius: isGrid ? '0px' : borderRadius }
              const shadowClass = isMinimal ? 'shadow-none' : cardShadow
              
              let spacingClass = sectionSpacing // py-8, py-12, py-16, py-20
              if (isMinimal) {
                if (sectionSpacing === 'py-8') spacingClass = 'py-16'
                else if (sectionSpacing === 'py-12') spacingClass = 'py-24'
                else if (sectionSpacing === 'py-16') spacingClass = 'py-32'
                else if (sectionSpacing === 'py-20') spacingClass = 'py-40'
              }

              const sectColors = getSectionColors(sectionId, idx)
              const isEven = idx % 2 === 0
              const sectionBg = isDuotone ? '' : (isMinimal ? 'bg-transparent' : (isEven ? 'bg-white/40 backdrop-blur-sm' : 'bg-black/5'))
              const sectionBorderClass = isGrid ? 'border border-current/15 mx-2 my-2' : ''
              const effectiveCardBg = isDuotone ? sectColors.cardBgVal : (isMinimal ? 'bg-transparent' : cardBg)
              const showDivider = idx > 0 && !isDuotone
              
              const renderDivider = () => {
                if (dividerType === 'line') {
                  return <div className="mx-auto my-6 h-px w-24 bg-current opacity-20" />
                }
                if (dividerType === 'heart') {
                  return <div className="text-center opacity-40 my-6 text-[10px]" style={{ color: accentColor }}>♥</div>
                }
                if (dividerType === 'space') {
                  return <div className="my-6 h-4" />
                }
                return null
              }

              const sectionImages: { url: string; caption?: string }[] = (currentInvitation?.customStyles?.sectionImages?.[sectionId] || [])

              const sectionElement = (() => { switch (sectionId) {
                case 'hero':
                  const heroInfoFont = themeStyles.heroInfoFont || fontEn
                  const heroInfoGroomBrideSize = themeStyles.heroInfoGroomBrideSize ?? 16
                  const heroInfoDetailsSize = themeStyles.heroInfoDetailsSize ?? 11
                  if (isConcept5) {
                    let formattedDate = 'MAY 7, 2028'
                    if (currentInvitation?.weddingDate) {
                      try {
                        const d = new Date(currentInvitation.weddingDate + 'T00:00:00')
                        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
                        formattedDate = `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
                      } catch (e) {}
                    }

                    const timeStr = currentInvitation?.weddingTime || '11:00 AM'
                    const venueStr = currentInvitation?.venueName || 'VOW SEOUL GRAND HALL'
                    const groomEn = currentInvitation?.groomNameEn || 'Sunghoon'
                    const brideEn = currentInvitation?.brideNameEn || 'Jihye'

                    return (
                      <div 
                        key="hero" 
                        id="preview-section-hero" 
                        className="relative min-h-[640px] flex flex-col items-center justify-between text-center overflow-hidden pb-12 pt-28 bg-[#EFD0D0] text-black"
                        style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
                      >
                        {/* White bar at the top */}
                        <div className="absolute top-0 left-0 right-0 h-10 bg-white z-10" />
                        {/* Perfect semi-circle below the white bar */}
                        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-24 h-12 bg-white rounded-b-full z-10" />

                        {/* Title: You're Invited To Our Wedding! */}
                        <div className="z-10 mt-6 px-4">
                          <h1 className="text-[25px] font-normal leading-[1.2] text-[#1a1a1a]" style={{ fontFamily: "'Goudy Bookletter 1911', serif", textTransform: 'capitalize' }}>
                            You&apos;re Invited<br />To Our Wedding!
                          </h1>
                        </div>

                        {/* Polaroid Photo Card */}
                        <div className="z-10 my-12 bg-white p-4 pb-5 shadow-[5px_5px_15px_rgba(0,0,0,0.15)] flex flex-col items-center w-[250px] transition-transform hover:scale-[1.02] duration-300">
                          <div className="w-[218px] h-[260px] overflow-hidden bg-gray-100 flex items-center justify-center">
                            {currentInvitation?.mainImage ? (
                              <img
                                src={currentInvitation.mainImage}
                                alt="Polaroid Main Visual"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center opacity-40 text-xs gap-1">
                                <span className="font-serif">VOW SEOUL</span>
                                <span>사진을 등록해주세요</span>
                              </div>
                            )}
                          </div>
                          {/* Signature Names */}
                          <div className="mt-4 text-2xl font-normal text-black italic lowercase" style={{ fontFamily: "'Covered By Your Grace', cursive" }}>
                            {groomEn} &amp; {brideEn}
                          </div>
                        </div>

                        {/* Bottom Information */}
                        <div className="z-10 text-center space-y-1.5 px-4 font-serif text-[#686868] text-xs tracking-wider" style={{ fontFamily: "'Goudy Bookletter 1911', serif" }}>
                          <p className="uppercase font-semibold tracking-widest text-[#686868] text-xs">{venueStr}</p>
                          <p className="uppercase text-[#686868] text-xs">{formattedDate}. {timeStr}</p>
                        </div>
                      </div>
                    )
                  }

                  if (isSereneBlue) {
                    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
                    let dateStr = '2026. 09. 19 (토) 오후 5시'
                    if (currentInvitation?.weddingDate) {
                      try {
                        const d = new Date(currentInvitation.weddingDate + 'T00:00:00')
                        dateStr = format(d, 'yyyy. MM. dd (EEEE)', { locale: ko })
                      } catch (e) {}
                    }

                    const heroFont = themeStyles.heroSubtitleFont || 'Kaushan Script'
                    
                    return (
                      <div 
                        key="hero" 
                        id="preview-section-hero" 
                        className="relative h-[640px] flex flex-col justify-between text-center overflow-hidden pb-12"
                        style={{ backgroundColor: '#9EB7CE', color: '#FFFFFF' }}
                      >
                        {/* Background Visual */}
                        {currentInvitation?.mainImage ? (
                          <img
                            src={currentInvitation.mainImage}
                            alt="Main Visual"
                            className="absolute inset-0 w-full h-full object-cover z-0"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-[#9EB7CE] z-0">
                            <span className="text-[10px] opacity-40">사진을 등록해주세요</span>
                          </div>
                        )}
                        {/* Gradient Overlay */}
                        <div 
                          className="absolute inset-0 z-10" 
                          style={{ background: 'linear-gradient(to top, #9EB7CE 0%, rgba(158, 183, 206, 0) 70%, rgba(158, 183, 206, 0.3) 100%)' }} 
                        />

                        {/* Centered Main Text: SAVE the DATE */}
                        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none -mt-4">
                          <div className="relative w-[280px] h-[130px] select-none">
                            <span className="absolute left-4 top-4 text-5xl tracking-widest leading-none font-normal" style={{ fontFamily: getFontFamily(fontKr, heroFont) }}>SAVE</span>
                            <span className="absolute left-[105px] top-[72px] text-lg italic opacity-90" style={{ fontFamily: getFontFamily(fontKr, heroFont) }}>the</span>
                            <span className="absolute left-[145px] top-[60px] text-5xl tracking-widest leading-none font-normal" style={{ fontFamily: getFontFamily(fontKr, heroFont) }}>DATE</span>
                          </div>
                        </div>

                        {/* Top spacing placeholder to balance flex justify-between */}
                        <div className="h-10" />

                        {/* Bottom Information */}
                        <div className="relative z-20 space-y-6 px-6">
                          {/* Groom & Bride Name horizontally centered */}
                          <div 
                            className="text-base font-medium tracking-widest flex items-center justify-center gap-3"
                            style={{
                              fontFamily: getFontFamily(fontKr, heroInfoFont),
                              fontSize: `${heroInfoGroomBrideSize}px`
                            }}
                          >
                            <span>{currentInvitation?.groomName || '김혁'}</span>
                            <span className="opacity-60 text-xs italic font-serif">&amp;</span>
                            <span>{currentInvitation?.brideName || '김민주'}</span>
                          </div>
                          
                          {/* Date and Venue */}
                          <div 
                            className="text-[11px] leading-relaxed tracking-wider opacity-90" 
                            style={{ 
                              fontFamily: getFontFamily(fontKr, heroInfoFont),
                              fontSize: `${heroInfoDetailsSize}px`
                            }}
                          >
                            <p>{dateStr}</p>
                            <p className="mt-0.5">{currentInvitation?.weddingTime || '오후 5시'} | {currentInvitation?.venueName || '춘천 스카이컨벤션 4층 스카이홀'}</p>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  if (isDuotone) {
                    const subtitleText = themeStyles.heroSubtitleText || 'save the date'
                    const subtitleFont = themeStyles.heroSubtitleFont || fontEn
                    const subtitleSize = themeStyles.heroSubtitleSize || 20 // px
                    const subtitleStyle = {
                      fontFamily: getFontFamily(fontKr, subtitleFont),
                      fontSize: `${subtitleSize}px`,
                      letterSpacing: '0.2em'
                    }
                    
                    const getHeroDateString = () => {
                      if (!currentInvitation?.weddingDate) return 'MAY 7, 2026 11 AM'
                      try {
                        const d = new Date(currentInvitation.weddingDate + 'T' + (currentInvitation.weddingTime || '12:00') + ':00')
                        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
                        const month = months[d.getMonth()]
                        const day = d.getDate()
                        const year = d.getFullYear()
                        
                        let hours = d.getHours()
                        const ampm = hours >= 12 ? 'PM' : 'AM'
                        hours = hours % 12
                        hours = hours ? hours : 12
                        
                        return `${month} ${day}, ${year} ${hours} ${ampm}`
                      } catch (e) {
                        return currentInvitation.weddingDate
                      }
                    }

                    return (
                      <div 
                        key="hero" 
                        id="preview-section-hero" 
                        className="relative h-[560px] flex flex-col items-center justify-between text-center px-6 py-8 overflow-hidden"
                        style={{ ...sectColors.bgStyle, ...sectColors.textStyle }}
                      >
                        {/* Subtitle */}
                        <div style={subtitleStyle} className="mt-2 uppercase tracking-[0.2em] font-light">
                          {subtitleText}
                        </div>
                        
                        {/* Foreground Main Image */}
                        {currentInvitation?.mainImage ? (
                          <div className="w-[150px] h-[200px] my-3 overflow-hidden border border-current/10 shadow-md">
                            <img
                              src={currentInvitation.mainImage}
                              alt="Main Visual"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-[150px] h-[200px] my-3 flex items-center justify-center border border-dashed border-current/30 bg-current/5">
                            <span className="text-[10px] opacity-40">사진을 등록해주세요</span>
                          </div>
                        )}
                        
                        {/* Groom & Bride names */}
                        <div 
                          className="flex items-center justify-center gap-4 text-sm font-light tracking-wide mt-1"
                          style={{
                            fontFamily: getFontFamily(fontKr, heroInfoFont),
                            fontSize: `${heroInfoGroomBrideSize}px`
                          }}
                        >
                          <span>{currentInvitation?.groomName || '신랑'}</span>
                          <span className="opacity-60 text-xs font-serif">&amp;</span>
                          <span>{currentInvitation?.brideName || '신부'}</span>
                        </div>
                        
                        {/* Details */}
                        <div 
                          className="space-y-1 opacity-85 text-[10px] tracking-wide pt-3 border-t border-current/10 w-full max-w-[200px] mx-auto mb-2"
                          style={{
                            fontFamily: getFontFamily(fontKr, heroInfoFont),
                            fontSize: `${heroInfoDetailsSize}px`
                          }}
                        >
                          <p className="uppercase truncate">
                            {currentInvitation?.venueName || 'VOW SEOUL GRAND HALL'}
                          </p>
                          <p>
                            {getHeroDateString()}
                          </p>
                        </div>
                        
                        <div className="animate-bounce">
                          <ChevronDown className="w-4 h-4 opacity-55" style={{ color: sectColors.accent }} />
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key="hero" id="preview-section-hero" className="relative h-[560px] flex flex-col items-center justify-center text-center px-6 overflow-hidden" style={{ ...sectColors.bgStyle, ...sectColors.textStyle }}>
                      {currentInvitation?.mainImage && (
                        <div className="absolute inset-0 z-0">
                          <img
                            src={currentInvitation.mainImage}
                            alt="Main Visual"
                            className="w-full h-full object-cover opacity-20"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t" style={{ backgroundImage: `linear-gradient(to top, ${bgColor}, transparent, ${bgColor}80)` }} />
                        </div>
                      )}
                      <div className="space-y-6 z-10 w-full">
                        <p className="text-xs tracking-[0.3em] opacity-60">WEDDING INVITATION</p>
                        
                        {heroStyle === 'left' ? (
                          <div className="space-y-4 text-left px-4 w-full">
                            <div className="space-y-1">
                              {currentInvitation?.groomParentRelation && (
                                <p className="text-[10px] opacity-75">
                                  {formatParentRelation(
                                    currentInvitation.groomParentRelation,
                                    currentInvitation.customStyles?.groomParentNames,
                                    currentInvitation.customStyles?.groomParentRelationText
                                  )}
                                </p>
                              )}
                              <h1 
                                className="text-2xl font-light tracking-wide"
                                style={{
                                  fontFamily: getFontFamily(fontKr, heroInfoFont),
                                  fontSize: `${heroInfoGroomBrideSize}px`
                                }}
                              >
                                {currentInvitation?.groomName || '신랑'}
                              </h1>
                            </div>
                            {heroConnector !== 'none' && <div className="text-lg opacity-60 font-light" style={{ color: sectColors.accent }}>{heroConnector}</div>}
                            <div className="space-y-1">
                              {currentInvitation?.brideParentRelation && (
                                <p className="text-[10px] opacity-75">
                                  {formatParentRelation(
                                    currentInvitation.brideParentRelation,
                                    currentInvitation.customStyles?.brideParentNames,
                                    currentInvitation.customStyles?.brideParentRelationText
                                  )}
                                </p>
                              )}
                              <h1 
                                className="text-2xl font-light tracking-wide"
                                style={{
                                  fontFamily: getFontFamily(fontKr, heroInfoFont),
                                  fontSize: `${heroInfoGroomBrideSize}px`
                                }}
                              >
                                {currentInvitation?.brideName || '신부'}
                              </h1>
                            </div>
                          </div>
                        ) : heroStyle === 'classic' ? (
                          <div className="space-y-4 text-center w-full">
                            <h1 
                              className="text-3xl font-light tracking-widest uppercase"
                              style={{
                                  fontFamily: getFontFamily(fontKr, heroInfoFont),
                                  fontSize: `${heroInfoGroomBrideSize * 1.2}px`
                              }}
                            >
                              {currentInvitation?.groomNameEn || 'GROOM'}
                              {heroConnector !== 'none' && <span className="block text-sm opacity-55 my-1" style={{ color: sectColors.accent }}>{heroConnector}</span>}
                              {currentInvitation?.brideNameEn || 'BRIDE'}
                            </h1>
                            <div className="w-8 h-px bg-current opacity-30 mx-auto" />
                            <p 
                              className="text-sm tracking-wide"
                              style={{
                                  fontFamily: getFontFamily(fontKr, heroInfoFont),
                                  fontSize: `${heroInfoGroomBrideSize}px`
                              }}
                            >
                              {currentInvitation?.groomName || '신랑'} · {currentInvitation?.brideName || '신부'}
                            </p>
                          </div>
                        ) : (
                          // Default: Center
                          <div className="space-y-4">
                            <div className="space-y-1">
                              {currentInvitation?.groomParentRelation && (
                                <p className="text-[10px] opacity-75">
                                  {formatParentRelation(
                                    currentInvitation.groomParentRelation,
                                    currentInvitation.customStyles?.groomParentNames,
                                    currentInvitation.customStyles?.groomParentRelationText
                                  )}
                                </p>
                              )}
                              <h1 
                                className="text-2xl font-light tracking-wide"
                                style={{
                                  fontFamily: getFontFamily(fontKr, heroInfoFont),
                                  fontSize: `${heroInfoGroomBrideSize}px`
                                }}
                              >
                                {currentInvitation?.groomName || '신랑'}
                              </h1>
                            </div>
                            {heroConnector !== 'none' && <div className="text-lg opacity-60 font-light" style={{ color: sectColors.accent }}>{heroConnector}</div>}
                            <div className="space-y-1">
                              {currentInvitation?.brideParentRelation && (
                                <p className="text-[10px] opacity-75">
                                  {formatParentRelation(
                                    currentInvitation.brideParentRelation,
                                    currentInvitation.customStyles?.brideParentNames,
                                    currentInvitation.customStyles?.brideParentRelationText
                                  )}
                                </p>
                              )}
                              <h1 
                                className="text-2xl font-light tracking-wide"
                                style={{
                                  fontFamily: getFontFamily(fontKr, heroInfoFont),
                                  fontSize: `${heroInfoGroomBrideSize}px`
                                }}
                              >
                                {currentInvitation?.brideName || '신부'}
                              </h1>
                            </div>
                          </div>
                        )}

                        <div 
                          className="space-y-1 opacity-80 text-xs pt-4 border-t border-current/10 max-w-[180px] mx-auto"
                          style={{
                            fontFamily: getFontFamily(fontKr, heroInfoFont),
                            fontSize: `${heroInfoDetailsSize}px`
                          }}
                        >
                          <p>
                            {currentInvitation?.weddingDate ? (
                              format(new Date(currentInvitation.weddingDate + 'T00:00:00'), 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })
                            ) : '2025년 00월 00일'}
                          </p>
                          <p>{currentInvitation?.weddingTime || '오후 12:00'}</p>
                          <p className="truncate">{currentInvitation?.venueName || '예식장명'}{currentInvitation?.venueHall ? ' ' + currentInvitation.venueHall : ''}</p>
                        </div>
                      </div>
                      <div className="absolute bottom-6 animate-bounce z-10">
                        <ChevronDown className="w-4 h-4 opacity-55" style={{ color: sectColors.accent }} />
                      </div>
                    </div>
                  )
                
                case 'greeting':
                  if (isConcept5) {
                    const parsedGroom = parseIndividualParents(currentInvitation?.groomParentRelation || '')
                    const parsedBride = parseIndividualParents(currentInvitation?.brideParentRelation || '')

                    const groomFather = currentInvitation?.customStyles?.groomFatherName || parsedGroom.fatherName || '박태수'
                    const groomMother = currentInvitation?.customStyles?.groomMotherName || parsedGroom.motherName || '선우명희'
                    const brideFather = currentInvitation?.customStyles?.brideFatherName || parsedBride.fatherName || '이훈'
                    const brideMother = currentInvitation?.customStyles?.brideMotherName || parsedBride.motherName || '최현숙'

                    return (
                      <section 
                        key="greeting" 
                        id="preview-section-greeting" 
                        className="relative pb-16 pt-0 text-center overflow-hidden bg-[#EFD0D0] text-white"
                        style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
                      >
                        {/* Diagonal Slanted White Bar */}
                        <div 
                          className="w-full h-[100px] bg-white mb-12" 
                          style={{ 
                            clipPath: 'polygon(0 50px, 100% 0, 100% 48px, 0 98px)',
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.06))'
                          }}
                        />

                        {/* Invitation Text */}
                        <div className="px-6 max-w-[340px] mx-auto text-[15px] leading-[2.0] font-medium whitespace-pre-line text-white/90">
                          {currentInvitation?.invitationMessage || 
                           '사랑으로 하나 된 두 사람이\n서로를 이해하며 한 길을 걸어가려 합니다.\n귀한 발걸음으로 저희의 출발을\n함께 축복해 주시기 바랍니다.'}
                        </div>

                        {/* Profile Photos */}
                        <div className="flex gap-4 justify-center items-center my-10 px-4">
                          <div className="w-[110px] h-[110px] bg-white/20 overflow-hidden shadow-inner border border-white/10 rounded-sm">
                            {currentInvitation?.customStyles?.groomImage ? (
                              <img
                                src={currentInvitation.customStyles.groomImage}
                                alt="Groom Profile"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] opacity-60">신랑 사진</div>
                            )}
                          </div>
                          <div className="w-[110px] h-[110px] bg-white/20 overflow-hidden shadow-inner border border-white/10 rounded-sm">
                            {currentInvitation?.customStyles?.brideImage ? (
                              <img
                                src={currentInvitation.customStyles.brideImage}
                                alt="Bride Profile"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] opacity-60">신부 사진</div>
                            )}
                          </div>
                        </div>

                        {/* Spouses & Parents Info */}
                        <div className="grid grid-cols-2 gap-8 text-center text-white max-w-[300px] mx-auto mt-6">
                          {/* Groom side */}
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <span className="text-[13px] opacity-60 block">신랑</span>
                              <h3 className="text-[21px] font-medium">{currentInvitation?.groomName || '박성훈'}</h3>
                            </div>
                            <div className="h-px bg-white/20 w-8 mx-auto" />
                            <div className="space-y-1.5 text-[14px] opacity-90">
                              <span className="text-[11px] opacity-60 block">신랑 측 혼주</span>
                              <p><span className="text-[11px] opacity-50 mr-1">아버지</span>{groomFather}</p>
                              <p><span className="text-[11px] opacity-50 mr-1">어머니</span>{groomMother}</p>
                            </div>
                          </div>

                          {/* Bride side */}
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <span className="text-[13px] opacity-60 block">신부</span>
                              <h3 className="text-[21px] font-medium">{currentInvitation?.brideName || '이지혜'}</h3>
                            </div>
                            <div className="h-px bg-white/20 w-8 mx-auto" />
                            <div className="space-y-1.5 text-[14px] opacity-90">
                              <span className="text-[11px] opacity-60 block">신부 측 혼주</span>
                              <p><span className="text-[11px] opacity-50 mr-1">아버지</span>{brideFather}</p>
                              <p><span className="text-[11px] opacity-50 mr-1">어머니</span>{brideMother}</p>
                            </div>
                          </div>
                        </div>
                      </section>
                    )
                  }

                  if (isSereneBlue) {
                    return (
                      <section 
                        key="greeting" 
                        id="preview-section-greeting" 
                        className="py-16 px-6 text-center" 
                        style={{ backgroundColor: '#9EB7CE', color: '#FFFFFF' }}
                      >
                        {/* Parent Names Spaced */}
                        <div className="space-y-4 text-xs font-light max-w-[280px] mx-auto py-6 mb-8">
                          <div className="flex justify-between items-center">
                            <div className="text-left">
                              <span className="text-[9px] opacity-60 block tracking-widest font-mono">GROOM</span>
                              <span className="tracking-wide">
                                {formatParentRelation(
                                  currentInvitation?.groomParentRelation || '김태진 · 정혜선 의 아들',
                                  currentInvitation?.customStyles?.groomParentNames,
                                  currentInvitation?.customStyles?.groomParentRelationText
                                )}
                              </span>
                            </div>
                            <span className="text-base font-semibold tracking-wider w-16 text-left ml-4">{currentInvitation?.groomName || '혁'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="text-left">
                              <span className="text-[9px] opacity-60 block tracking-widest font-mono">BRIDE</span>
                              <span className="tracking-wide">
                                {formatParentRelation(
                                  currentInvitation?.brideParentRelation || '김필래 · 이수윤 의 딸',
                                  currentInvitation?.customStyles?.brideParentNames,
                                  currentInvitation?.customStyles?.brideParentRelationText
                                )}
                              </span>
                            </div>
                            <span className="text-base font-semibold tracking-wider w-16 text-left ml-4">{currentInvitation?.brideName || '민주'}</span>
                          </div>
                        </div>

                        {/* Divider */}
                        {renderDivider()}

                        {/* Greeting Message */}
                        <div className="leading-relaxed whitespace-pre-wrap text-xs tracking-wider font-light max-w-[300px] mx-auto opacity-95 mt-6">
                          {currentInvitation?.invitationMessage || (
                            "여보, 우리는 등불 하나 켜서 삽시다.\n바람에 흔들리는 심지 등불이라도 켜서\n기름 졸이듯 마음을 다하여\n사랑하며 삽시다. 오래도록."
                          )}
                        </div>
                      </section>
                    )
                  }

                  const greetingIconShape = currentInvitation?.customStyles?.greetingIconShape || 'heart'
                  const greetingIconColor = currentInvitation?.customStyles?.greetingIconColor || sectColors.accent
                  const greetingIconCustomUrl = currentInvitation?.customStyles?.greetingIconCustomUrl
                  const isGreetingCustomSvg = greetingIconCustomUrl?.toLowerCase().split('?')[0].endsWith('.svg') ?? false

                  const renderGreetingIcon = () => {
                    if (greetingIconShape === 'custom' && greetingIconCustomUrl) {
                      if (isGreetingCustomSvg) {
                        return (
                          <div 
                            className="w-5 h-5 mx-auto mb-4 opacity-60 pointer-events-none"
                            style={getSvgMaskStyle(greetingIconCustomUrl, greetingIconColor)}
                          />
                        )
                      } else {
                        return (
                          <img 
                            src={greetingIconCustomUrl} 
                            alt="custom greeting icon" 
                            className="w-5 h-5 mx-auto mb-4 object-contain opacity-80"
                          />
                        )
                      }
                    }

                    if (greetingIconShape === 'circle') {
                      return <Circle className="w-5 h-5 mx-auto mb-4 opacity-60" style={{ color: greetingIconColor }} />
                    }
                    if (greetingIconShape === 'star') {
                      return <Star className="w-5 h-5 mx-auto mb-4 opacity-60" style={{ color: greetingIconColor }} />
                    }
                    return <Heart className="w-5 h-5 mx-auto mb-4 opacity-60" style={{ color: greetingIconColor }} />
                  }

                  return (
                    <section key="greeting" id="preview-section-greeting" className={cn(spacingClass, "px-6 text-center", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                      {showDivider && renderDivider()}
                      {renderGreetingIcon()}
                      <p className="leading-relaxed whitespace-pre-line text-xs opacity-80 mb-6">
                        {currentInvitation?.invitationMessage || '초대의 말씀을 드립니다.\n이곳에 초대글이 표시됩니다.'}
                      </p>
                    </section>
                  )

                case 'sequence':
                  const sequenceEnabled = currentInvitation?.customStyles?.sequenceEnabled ?? false
                  if (!sequenceEnabled) return null
                  const sequenceTitle = currentInvitation?.customStyles?.sequenceTitle || '식순 안내'
                  const sequenceSubtitle = currentInvitation?.customStyles?.sequenceSubtitle || 'WEDDING ORDER'
                  const sequenceEvents = currentInvitation?.customStyles?.sequenceEvents || [
                    { id: '1', time: '12:00', title: '식전 영상 상영' },
                    { id: '2', time: '12:10', title: '개식 및 화촉점화' },
                    { id: '3', time: '12:20', title: '신랑 신부 입장' },
                    { id: '4', time: '12:30', title: '혼인서약 및 성혼선언' },
                    { id: '5', time: '12:45', title: '축가 및 하객 인사' },
                    { id: '6', time: '13:00', title: '신랑 신부 행진 및 폐식' }
                  ]

                  if (isConcept5) {
                    return (
                      <section 
                        key="sequence" 
                        id="preview-section-sequence" 
                        className="py-16 px-6 bg-[#EFD0D0] text-white text-center"
                        style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
                      >
                        <h4 className="text-[14px] uppercase tracking-widest text-white/80" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>WEDDING ORDER</h4>
                        <h3 className="text-lg font-bold mt-1 mb-8" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>식순 안내</h3>

                        <div className="max-w-[320px] mx-auto border-t border-b border-white/80">
                          {sequenceEvents.map((event: any, i: number) => (
                            <div 
                              key={event.id} 
                              className="flex border-b border-white/40 last:border-b-0 items-stretch"
                            >
                              {/* Time Column */}
                              <div className="w-[90px] py-3 text-center text-xs font-light text-white/90 border-r border-white/40 flex items-center justify-center font-mono">
                                {event.time}
                              </div>
                              {/* Event Title Column */}
                              <div className="flex-1 py-3 px-4 text-left text-xs text-white flex items-center">
                                {event.title}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )
                  }

                  if (isSereneBlue) {
                    return (
                      <section 
                        key="sequence" 
                        id="preview-section-sequence" 
                        className="py-16 px-6 bg-white" 
                        style={{ color: '#000000' }}
                      >
                        {renderSectionHeader('sequence', sequenceSubtitle, sequenceTitle, 'mb-8')}
                        
                        <div className="max-w-[280px] mx-auto border-t border-b border-black">
                          {sequenceEvents.map((event: any, i: number) => (
                            <div 
                              key={event.id} 
                              className={cn(
                                "flex items-center text-xs py-3.5 px-2", 
                                i < sequenceEvents.length - 1 && "border-b border-black"
                              )}
                            >
                              <div className="w-[60px] text-left tracking-wider font-semibold font-mono">{event.time}</div>
                              <div className="w-[1px] h-4 bg-black mx-4" />
                              <div className="flex-1 text-left tracking-wide font-medium">{event.title}</div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )
                  }

                  return (
                    <section key="sequence" id="preview-section-sequence" className={cn(spacingClass, "px-6", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                      {showDivider && renderDivider()}
                      {renderSectionHeader('sequence', sequenceTitle, '식순', 'mb-2')}
                      <p className="text-center text-[10px] opacity-40 mb-6">{sequenceSubtitle}</p>
                      
                      <div className="relative border-l border-current/15 ml-4 pl-6 space-y-4 text-left max-w-[200px] mx-auto">
                        {sequenceEvents.map((event: any) => (
                          <div key={event.id} className="relative">
                            {/* Dot */}
                            <div className="absolute -left-[29.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-current opacity-70 border border-background" style={{ backgroundColor: sectColors.accent }} />
                            <div>
                              <span className="font-mono text-[10px] font-semibold" style={{ color: sectColors.accent }}>{event.time}</span>
                              <p className="text-xs font-medium mt-0.5">{event.title}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )

                case 'gallery':
                  if (!currentInvitation?.galleryImages || currentInvitation.galleryImages.length === 0) return null

                  if (isConcept5) {
                    return (
                      <section 
                        key="gallery" 
                        id="preview-section-gallery" 
                        className="py-16 px-0 bg-[#EFD0D0] text-white text-center overflow-hidden"
                        style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
                      >
                        <h4 className="text-[18px] uppercase tracking-widest text-white/80" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>GALLERY</h4>
                        <h3 className="text-lg font-bold mt-1 mb-8" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>갤러리</h3>

                        <div className="w-full overflow-x-auto flex gap-4 snap-x scrollbar-hide pb-2 px-6">
                          {currentInvitation.galleryImages.map((img: string, idx: number) => (
                            <div 
                              key={idx} 
                              className="w-[164px] h-[218px] flex-shrink-0 snap-center overflow-hidden bg-white/20 border border-white/10 shadow-[5px_5px_15px_rgba(0,0,0,0.1)] rounded-sm"
                            >
                              <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      </section>
                    )
                  }

                  const isSlide = currentInvitation?.galleryViewType === 'slide'
                  const galleryAlign = currentInvitation?.customStyles?.galleryAlign || 'center'
                  return (
                    <section key="gallery" id="preview-section-gallery" className={cn("w-full overflow-hidden", spacingClass, isSlide ? "px-0" : "px-6", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                      {showDivider && renderDivider()}
                      {renderSectionHeader('gallery', 'Gallery', '사진첩', 'mb-6', 'px-6')}
                      {isSlide ? (
                        <div className="w-full overflow-x-auto flex gap-2 snap-x scrollbar-hide pb-2 px-6">
                          {currentInvitation.galleryImages.map((img: string, idx: number) => (
                            <div key={idx} className={cn("w-[240px] h-[300px] flex-shrink-0 snap-center overflow-hidden bg-black/5 flex justify-center", galleryAlign === 'bottom' ? 'items-end' : 'items-center', shadowClass)} style={borderStyle}>
                              <img src={img} alt={`Gallery ${idx + 1}`} className="max-w-full max-h-full object-contain" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={cn("grid gap-1.5", isTwoColumn ? "grid-cols-3" : "grid-cols-2")}>
                          {currentInvitation.galleryImages.map((img: string, idx: number) => (
                            <div key={idx} className={cn("aspect-square overflow-hidden bg-black/10", shadowClass)} style={borderStyle}>
                              <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )

                case 'calendar':
                  if (!currentInvitation?.weddingDate) return null
                  const ddayEnabled = currentInvitation.customStyles?.ddayEnabled ?? false

                  if (isConcept5) {
                    const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
                    const d = currentInvitation?.weddingDate ? new Date(currentInvitation.weddingDate + 'T00:00:00') : new Date()
                    const monthName = months[d.getMonth()]

                    return (
                      <section 
                        key="calendar" 
                        id="preview-section-calendar" 
                        className="py-16 px-6 bg-white text-[#D59B9B] text-center"
                        style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
                      >
                        <h4 className="text-[14px] uppercase tracking-widest text-[#D59B9B]/60 mb-2" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>Calendar</h4>
                        
                        <div className="max-w-[320px] mx-auto bg-white p-4">
                          {/* Month Heading */}
                          <div className="text-center mb-6">
                            <p className="text-xl font-medium tracking-widest text-[#D59B9B] uppercase font-serif">
                              {monthName}
                            </p>
                          </div>
                          
                          {/* Calendar Grid */}
                          <div className="grid grid-cols-7 gap-y-3 text-center text-xs font-medium text-[#D59B9B]/80">
                            {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                              <div key={day} className="py-1 opacity-50 font-semibold">{day}</div>
                            ))}
                            {calDays.map((day, i) => {
                              if (day === null) return <div key={`empty-${i}`} />
                              const isWeddingDay = day === calDay
                              
                              if (isWeddingDay) {
                                return (
                                  <div
                                    key={i}
                                    className="relative py-1 text-xs flex items-center justify-center w-7 h-7 mx-auto rounded-full font-bold text-white z-10 bg-[#D76C6C]"
                                  >
                                    {day}
                                  </div>
                                )
                              }
                              
                              return (
                                <div
                                  key={i}
                                  className="py-1 text-xs flex items-center justify-center w-7 h-7 mx-auto text-center"
                                >
                                  {day}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Concept 5 D-day Timer */}
                        {ddayEnabled && (
                          <div className="mt-12 pt-8 border-t border-[#EFD0D0] text-center space-y-5">
                            <p className="text-[14px] uppercase tracking-[0.1em] font-semibold text-[#D59B9B]">Days left</p>
                            <div className="flex justify-center items-center gap-10 max-w-[280px] mx-auto text-[#D59B9B]">
                              <div className="flex flex-col items-center">
                                <p className="text-[14px] tracking-wider opacity-60">DAYS</p>
                                <p className="text-[36px] font-normal mt-1 leading-none">{timeLeft.days}</p>
                              </div>
                              <div className="flex flex-col items-center">
                                <p className="text-[14px] tracking-wider opacity-60">HOURS</p>
                                <p className="text-[36px] font-normal mt-1 leading-none">{timeLeft.hours}</p>
                              </div>
                              <div className="flex flex-col items-center">
                                <p className="text-[14px] tracking-wider opacity-60">MINUTES</p>
                                <p className="text-[36px] font-normal mt-1 leading-none">{timeLeft.minutes}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </section>
                    )
                  }

                  if (isSereneBlue) {
                    return (
                      <section 
                        key="calendar" 
                        id="preview-section-calendar" 
                        className="py-16 px-6" 
                        style={{ backgroundColor: '#E8E8E8', color: '#000000' }}
                      >
                        {renderSectionHeader('calendar', 'Calendar', '소중한 날', 'mb-6')}
                        
                        <Card className="border-0 shadow-none bg-white rounded-none text-black">
                          <CardContent className="p-6">
                            <div className="text-center mb-6">
                              <p className="text-lg font-semibold text-[#62798E] font-mono tracking-widest uppercase">
                                {new Date(currentInvitation.weddingDate).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                              </p>
                            </div>
                            <div className="grid grid-cols-7 gap-y-3 text-center text-xs">
                              {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                                <div key={day} className="py-1 opacity-40 font-semibold">{day}</div>
                              ))}
                              {calDays.map((day, i) => {
                                if (day === null) return <div key={`empty-${i}`} />
                                const isWeddingDay = day === calDay
                                
                                if (isWeddingDay) {
                                  const shapeType = currentInvitation.customStyles?.calendarDayShape || 'circle'
                                  const customShapeUrl = currentInvitation.customStyles?.calendarDayCustomShapeUrl
                                  const highlightTextColor = currentInvitation.customStyles?.calendarDayTextColor || '#ffffff'
                                  
                                  if (shapeType === 'custom' && customShapeUrl) {
                                    const isSvg = customShapeUrl.toLowerCase().split('?')[0].endsWith('.svg')
                                    return (
                                      <div
                                        key={i}
                                        className="relative py-1 text-xs flex items-center justify-center w-7 h-7 mx-auto font-bold"
                                        style={{ color: highlightTextColor }}
                                      >
                                        {isSvg ? (
                                          <div 
                                            className="absolute inset-0 w-full h-full z-0 pointer-events-none"
                                            style={getSvgMaskStyle(customShapeUrl, currentInvitation.customStyles?.calendarDaySvgColor || '#526678')}
                                          />
                                        ) : (
                                          <img 
                                            src={customShapeUrl} 
                                            alt="wedding day mark" 
                                            className="absolute inset-0 w-full h-full object-contain z-0 pointer-events-none"
                                          />
                                        )}
                                        <span className="relative z-10">{day}</span>
                                      </div>
                                    )
                                  }
                                  
                                  if (shapeType === 'heart') {
                                    return (
                                      <div
                                        key={i}
                                        className="relative py-1 text-xs flex items-center justify-center w-7 h-7 mx-auto font-bold"
                                        style={{ color: highlightTextColor }}
                                      >
                                        <Heart className="absolute inset-0 w-full h-full text-red-400 fill-red-400 opacity-90 z-0 scale-110" style={{ color: '#526678', fill: '#526678' }} />
                                        <span className="relative z-10 text-[10px] -mt-0.5">{day}</span>
                                      </div>
                                    )
                                  }
                                  
                                  // Default circle
                                  return (
                                    <div
                                      key={i}
                                      className="relative py-1 text-xs flex items-center justify-center w-7 h-7 mx-auto rounded-full font-bold text-white z-10"
                                      style={{ backgroundColor: '#526678' }}
                                    >
                                      {day}
                                    </div>
                                  )
                                }
                                
                                return (
                                  <div
                                    key={i}
                                    className="py-1 text-xs flex items-center justify-center w-7 h-7 mx-auto text-center opacity-70"
                                  >
                                    {day}
                                  </div>
                                )
                              })}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Serene Blue Countdown Timer */}
                        {ddayEnabled && (
                          <div className="mt-8 text-center space-y-4">
                            <p className="text-[10px] uppercase tracking-[0.15em] opacity-60 font-semibold text-[#62798E]">Days left</p>
                            <div className="flex justify-center items-center gap-6 max-w-[280px] mx-auto text-[#62798E] font-mono">
                              <div className="flex flex-col items-center">
                                <p className="text-[9px] uppercase tracking-wider opacity-60">DAYS</p>
                                <p className="text-3xl font-light text-[#526678] mt-1">{timeLeft.days}</p>
                              </div>
                              <div className="flex flex-col items-center">
                                <p className="text-[9px] uppercase tracking-wider opacity-60">HOURS</p>
                                <p className="text-3xl font-light text-[#526678] mt-1">{timeLeft.hours}</p>
                              </div>
                              <div className="flex flex-col items-center">
                                <p className="text-[9px] uppercase tracking-wider opacity-60">MINUTES</p>
                                <p className="text-3xl font-light text-[#526678] mt-1">{timeLeft.minutes}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </section>
                    )
                  }

                  return (
                    <section key="calendar" id="preview-section-calendar" className={cn(spacingClass, "px-6", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                      {showDivider && renderDivider()}
                      {renderSectionHeader('calendar', 'Calendar', '소중한 날', ddayEnabled ? 'mb-1' : 'mb-6')}
                      {ddayEnabled && (
                        <div 
                          className="text-center text-[11px] font-bold tracking-wider mb-4 animate-pulse" 
                          style={{ color: sectColors.accent }}
                        >
                          {getDDayString(currentInvitation.weddingDate)}
                        </div>
                      )}
                      <Card className={cn("border-0 shadow-none", effectiveCardBg)} style={{ ...borderStyle, color: 'inherit' }}>
                        <CardContent className="p-4">
                          <div className="text-center mb-2">
                            <p className="text-sm font-medium" style={{ color: sectColors.accent }}>{calMonth}</p>
                            <p className="text-[10px] opacity-40">{calYear}</p>
                          </div>
                          <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
                            {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                              <div key={day} className="py-1 opacity-55 font-semibold">{day}</div>
                            ))}
                            {calDays.map((day, i) => {
                              if (day === null) return <div key={`empty-${i}`} />
                              const isWeddingDay = day === calDay
                              
                              if (isWeddingDay) {
                                const shapeType = currentInvitation.customStyles?.calendarDayShape || 'circle'
                                const customShapeUrl = currentInvitation.customStyles?.calendarDayCustomShapeUrl
                                const highlightTextColor = currentInvitation.customStyles?.calendarDayTextColor || '#ffffff'
                                
                                if (shapeType === 'custom' && customShapeUrl) {
                                  const isSvg = customShapeUrl.toLowerCase().split('?')[0].endsWith('.svg')
                                  return (
                                    <div
                                      key={i}
                                      className="relative py-1 text-[10px] flex items-center justify-center w-6 h-6 mx-auto font-bold"
                                      style={{ color: highlightTextColor }}
                                    >
                                      {isSvg ? (
                                        <div 
                                          className="absolute inset-0 w-full h-full z-0 pointer-events-none"
                                          style={getSvgMaskStyle(customShapeUrl, currentInvitation.customStyles?.calendarDaySvgColor || sectColors.accent)}
                                        />
                                      ) : (
                                        <img 
                                          src={customShapeUrl} 
                                          alt="wedding day mark" 
                                          className="absolute inset-0 w-full h-full object-contain z-0 pointer-events-none"
                                        />
                                      )}
                                      <span className="relative z-10">{day}</span>
                                    </div>
                                  )
                                }
                                
                                if (shapeType === 'heart') {
                                  return (
                                    <div
                                      key={i}
                                      className="relative py-1 text-[10px] flex items-center justify-center w-6 h-6 mx-auto font-bold"
                                      style={{ color: highlightTextColor }}
                                    >
                                      <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none fill-current" viewBox="0 0 24 24" style={{ color: sectColors.accent }}>
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                      </svg>
                                      <span className="relative z-10">{day}</span>
                                    </div>
                                  )
                                }
                                
                                return (
                                  <div
                                    key={i}
                                    className="relative py-1 text-[10px] flex items-center justify-center w-6 h-6 mx-auto rounded-full font-bold"
                                    style={{ backgroundColor: sectColors.accent, color: highlightTextColor }}
                                  >
                                    <span className="relative z-10">{day}</span>
                                  </div>
                                )
                              }
                              
                              return (
                                <div
                                  key={i}
                                  className="py-1 text-[10px] flex items-center justify-center w-6 h-6 mx-auto text-center"
                                  style={{ color: sectColors.secondaryTextColorVal }}
                                >
                                  {day}
                                </div>
                              )
                            })}
                          </div>
                          <div className="mt-4 text-center text-[10px] opacity-80">
                            <p className="font-medium" style={{ color: sectColors.accent }}>
                              {format(new Date(currentInvitation.weddingDate + 'T00:00:00'), 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })}
                            </p>
                            <p className="mt-0.5">{currentInvitation.weddingTime}</p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Duotone Countdown Timer */}
                      {isDuotone && (
                        <div className="mt-6 pt-6 border-t border-current/10 text-center space-y-3">
                          <p className="text-[10px] uppercase tracking-[0.15em] opacity-60">Days left</p>
                          <div className="flex items-center justify-center gap-6">
                            <div className="text-center">
                              <p className="text-[8px] uppercase tracking-wider opacity-50">Days</p>
                              <p className="text-xl font-light font-mono mt-1">{timeLeft.days}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[8px] uppercase tracking-wider opacity-50">Hours</p>
                              <p className="text-xl font-light font-mono mt-1">{timeLeft.hours}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[8px] uppercase tracking-wider opacity-50">Minutes</p>
                              <p className="text-xl font-light font-mono mt-1">{timeLeft.minutes}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>
                  )

                case 'location':
                  if (isConcept5) {
                    return (
                      <section 
                        key="location" 
                        id="preview-section-location" 
                        className="py-16 px-6 bg-[#EFD0D0] text-white"
                        style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
                      >
                        <h4 className="text-[18px] uppercase tracking-widest text-center text-white/80" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>LOCATION</h4>
                        <h3 className="text-lg font-bold text-center mt-1 mb-8" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>식장 위치</h3>

                        {/* White Address Card */}
                        <div 
                          className="bg-white p-6 text-center space-y-2 border border-white/10 shadow-[5px_5px_15px_rgba(0,0,0,0.05)] mb-6 cursor-pointer hover:bg-white/95 transition-colors"
                          onClick={() => {
                            if (currentInvitation?.venueAddress) {
                              copyToClipboard(currentInvitation.venueAddress, 'address')
                            }
                          }}
                        >
                          <h3 className="font-semibold text-base tracking-wide text-[#D76C6C]">{currentInvitation?.venueName || 'VOW SEOUL GRAND HALL'}</h3>
                          <p className="text-xs text-[#D76C6C]/80">{currentInvitation?.venueHall || '그랜드홀'}</p>
                          <p className="text-sm font-medium text-[#D76C6C] mt-2 whitespace-pre-line">{currentInvitation?.venueAddress || '서울 강남구 학동로 1212'}</p>
                          <p className="text-[10px] text-[#D76C6C]/60 mt-1">터치하여 주소 복사</p>
                        </div>

                        {/* Map View */}
                        {currentInvitation?.customStyles?.mapEnabled !== false && (
                          <div className="mb-6 px-0">
                            <NaverMap 
                              address={currentInvitation?.venueAddress || '서울 강남구 학동로 1212'} 
                              venueName={currentInvitation?.venueName || '웨딩홀'} 
                            />
                          </div>
                        )}

                        {/* Traffic & Parking Info */}
                        <div className="space-y-4 text-xs text-left text-white/90 leading-relaxed">
                          {currentInvitation?.trafficInfo && (
                            <div>
                              <p className="font-semibold text-white">대중교통 안내</p>
                              <p className="whitespace-pre-line mt-1">{currentInvitation.trafficInfo}</p>
                            </div>
                          )}
                          {currentInvitation?.parkingInfo && (
                            <div>
                              <p className="font-semibold text-white">주차 안내</p>
                              <p className="whitespace-pre-line mt-1">{currentInvitation.parkingInfo}</p>
                            </div>
                          )}
                        </div>
                      </section>
                    )
                  }

                  if (isSereneBlue) {
                    return (
                      <section 
                        key="location" 
                        id="preview-section-location" 
                        className="py-16 px-6" 
                        style={{ backgroundColor: '#F2F2F2', color: '#000000' }}
                      >
                        {renderSectionHeader('location', 'Location', '식장 위치', 'mb-6')}
                        
                        {/* White Address Card */}
                        <div 
                          className="bg-white p-6 text-center space-y-2 border border-black/5 shadow-sm mb-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                          onClick={() => {
                            if (currentInvitation?.venueAddress) {
                              copyToClipboard(currentInvitation.venueAddress, 'address')
                            }
                          }}
                        >
                          <h3 className="font-semibold text-base tracking-wide">{currentInvitation?.venueName || 'VOW SEOUL GRAND HALL'}</h3>
                          {currentInvitation?.venueHall && (
                            <p className="text-xs text-[#526678] font-medium">{currentInvitation.venueHall}</p>
                          )}
                          <p className="text-xs opacity-75 mt-1 whitespace-pre-line">{currentInvitation?.venueAddress || '강남구 학동로 1212'}</p>
                        </div>

                        {/* Interactive Map & Navigation App Buttons */}
                        {currentInvitation?.customStyles?.mapEnabled !== false && (
                          <div className="mb-6 px-4">
                            <NaverMap 
                              address={currentInvitation?.venueAddress || '서울 강남구 학동로 1212'} 
                              venueName={currentInvitation?.venueName || '웨딩홀'} 
                            />
                          </div>
                        )}

                        {/* Traffic & Parking guides */}
                        <div className="space-y-4 text-xs font-light text-left max-w-[280px] mx-auto">
                          {currentInvitation?.parkingInfo && (
                            <div className="space-y-1">
                              <span className="font-semibold block text-[#62798E]">주차안내</span>
                              <p className="opacity-80 leading-relaxed whitespace-pre-line">{currentInvitation.parkingInfo}</p>
                            </div>
                          )}
                          {currentInvitation?.trafficInfo && (
                            <div className="space-y-1">
                              <span className="font-semibold block text-[#62798E]">대중교통</span>
                              <p className="opacity-80 leading-relaxed whitespace-pre-line">{currentInvitation.trafficInfo}</p>
                            </div>
                          )}
                          {currentInvitation?.customStyles?.shuttleEnabled && currentInvitation?.customStyles?.shuttleInfo && (
                            <div className="space-y-1">
                              <span className="font-semibold block text-[#62798E]">셔틀버스</span>
                              <p className="opacity-80 leading-relaxed whitespace-pre-line">{currentInvitation.customStyles.shuttleInfo}</p>
                            </div>
                          )}
                        </div>
                      </section>
                    )
                  }

                  return (
                    <section key="location" id="preview-section-location" className={cn(spacingClass, "px-6", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                      {showDivider && renderDivider()}
                      {renderSectionHeader('location', 'Location', '오시는 길', 'mb-6')}
                      <Card 
                        className={cn("border-0", effectiveCardBg, shadowClass)} 
                        style={isDuotone ? { backgroundColor: color2, color: color1, borderRadius: borderStyle.borderRadius } : borderStyle}
                      >
                        <CardContent className="p-4 text-left space-y-3">
                          <div>
                            <h3 className="font-semibold text-xs">{currentInvitation?.venueName || '예식장명'}</h3>
                            {currentInvitation?.venueHall && <p className="text-[10px]" style={{ color: isDuotone ? color1 : sectColors.accent }}>{currentInvitation.venueHall}</p>}
                            <p className="text-[10px] mt-0.5 whitespace-pre-line" style={{ color: isDuotone ? `${color1}cc` : sectColors.secondaryTextColorVal }}>{currentInvitation?.venueAddress || '주소를 입력해주세요.'}</p>
                          </div>

                          {/* Traffic Info & Parking Info */}
                          {(currentInvitation?.trafficInfo || currentInvitation?.parkingInfo || currentInvitation?.customStyles?.subwayImage || currentInvitation?.customStyles?.parkingImage) && (
                            <div className="space-y-3 pt-3 border-t border-gray-100/10 text-[10px]">
                              {(currentInvitation?.trafficInfo || currentInvitation?.customStyles?.subwayImage) && (
                                <div>
                                  <p className="font-semibold">교통 안내</p>
                                  {currentInvitation?.trafficInfo && (
                                    <p className="whitespace-pre-line mt-0.5 leading-relaxed" style={{ color: isDuotone ? `${color1}b3` : sectColors.secondaryTextColorVal }}>{currentInvitation.trafficInfo}</p>
                                  )}
                                  {currentInvitation?.customStyles?.subwayImage && (
                                    currentInvitation?.customStyles?.subwayDisplayType === 'direct' ? (
                                      <div className="mt-1.5 rounded overflow-hidden bg-black/5 dark:bg-white/5 border border-border/50">
                                        <img 
                                          src={currentInvitation.customStyles.subwayImage} 
                                          className="w-full h-auto cursor-pointer" 
                                          onClick={() => setActiveImageModal(currentInvitation?.customStyles?.subwayImage!)}
                                        />
                                      </div>
                                    ) : (
                                      <button 
                                        type="button"
                                        onClick={() => setActiveImageModal(currentInvitation?.customStyles?.subwayImage!)}
                                        className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-black/5 dark:bg-white/5 border border-border/30 rounded-[4px] text-[8px] font-medium hover:bg-black/10 transition-colors"
                                        style={{ color: isDuotone ? color1 : sectColors.accent }}
                                      >
                                        <Image className="w-2.5 h-2.5" />
                                        <span>{currentInvitation.customStyles.subwayButtonText || '이미지 보기'}</span>
                                      </button>
                                    )
                                  )}
                                </div>
                              )}
                              {(currentInvitation?.parkingInfo || currentInvitation?.customStyles?.parkingImage) && (
                                <div>
                                  <p className="font-semibold">주차 안내</p>
                                  {currentInvitation?.parkingInfo && (
                                    <p className="whitespace-pre-line mt-0.5 leading-relaxed" style={{ color: isDuotone ? `${color1}b3` : sectColors.secondaryTextColorVal }}>{currentInvitation.parkingInfo}</p>
                                  )}
                                  {currentInvitation?.customStyles?.parkingImage && (
                                    currentInvitation?.customStyles?.parkingDisplayType === 'direct' ? (
                                      <div className="mt-1.5 rounded overflow-hidden bg-black/5 dark:bg-white/5 border border-border/50">
                                        <img 
                                          src={currentInvitation.customStyles.parkingImage} 
                                          className="w-full h-auto cursor-pointer" 
                                          onClick={() => setActiveImageModal(currentInvitation?.customStyles?.parkingImage!)}
                                        />
                                      </div>
                                    ) : (
                                      <button 
                                        type="button"
                                        onClick={() => setActiveImageModal(currentInvitation?.customStyles?.parkingImage!)}
                                        className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-black/5 dark:bg-white/5 border border-border/30 rounded-[4px] text-[8px] font-medium hover:bg-black/10 transition-colors"
                                        style={{ color: isDuotone ? color1 : sectColors.accent }}
                                      >
                                        <Image className="w-2.5 h-2.5" />
                                        <span>{currentInvitation.customStyles.parkingButtonText || '이미지 보기'}</span>
                                      </button>
                                    )
                                  )}
                                </div>
                              )}
                              {currentInvitation?.customStyles?.shuttleEnabled && currentInvitation?.customStyles?.shuttleInfo && (
                                <div>
                                  <p className="font-semibold">셔틀버스 안내</p>
                                  <p className="whitespace-pre-line mt-0.5 leading-relaxed" style={{ color: isDuotone ? `${color1}b3` : sectColors.secondaryTextColorVal }}>
                                    {currentInvitation.customStyles.shuttleInfo}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                        </CardContent>
                      </Card>

                      {currentInvitation?.customStyles?.mapEnabled !== false && (
                        <div className="mb-4 px-2">
                          <NaverMap 
                            address={currentInvitation?.venueAddress || '서울 강남구 학동로 1212'} 
                            venueName={currentInvitation?.venueName || '웨딩홀'} 
                          />
                        </div>
                      )}
                    </section>
                  )

                case 'contact':
                  if (!currentInvitation?.contacts || currentInvitation.contacts.length === 0) return null
                  return (
                    <section key="contact" id="preview-section-contact" className={cn(spacingClass, "px-6", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                      {showDivider && renderDivider()}
                      {renderSectionHeader('contact', 'Contact', '연락처', 'mb-6')}
                      <div className="grid grid-cols-2 gap-2">
                        {currentInvitation.contacts.map((contact: any) => (
                          <Card key={contact.id} className={cn("border-0", effectiveCardBg, shadowClass)} style={{ ...borderStyle, color: 'inherit' }}>
                            <CardContent className="p-3 text-center">
                              <p className="text-xs mb-0.5" style={{ color: sectColors.secondaryTextColorVal }}>
                                {contact.relation === 'groom' ? '신랑' :
                                 contact.relation === 'bride' ? '신부' :
                                 contact.relation === 'groomParent' ? '신랑 혼주' :
                                 contact.relation === 'brideParent' ? '신부 혼주' :
                                 contact.relation}
                              </p>
                              <p className="font-semibold text-sm mb-2 truncate">{contact.name}</p>
                              <Button variant="outline" size="sm" className="w-full text-xs h-7 px-0" style={isDuotone ? { borderColor: `${color2}33`, color: color2, backgroundColor: 'transparent', borderRadius: borderStyle.borderRadius } : borderStyle}>
                                <Phone className="w-3 h-3 mr-1" />
                                전화
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </section>
                  )

                case 'account':
                  if (!currentInvitation?.bankAccounts || currentInvitation.bankAccounts.length === 0) return null
                  const accountsList = currentInvitation.bankAccounts || []
                  const groomAccounts = accountsList.filter((acc: any) => acc.relation === 'groom' || acc.relation === 'groomParent')
                  const brideAccounts = accountsList.filter((acc: any) => acc.relation === 'bride' || acc.relation === 'brideParent')

                  if (isConcept5) {
                    return (
                      <section 
                        key="account" 
                        id="preview-section-account" 
                        className="py-16 px-6 bg-[#EFD0D0] text-white text-center"
                        style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
                      >
                        <h4 className="text-[18px] uppercase tracking-widest text-white/80" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>ACCOUNT</h4>
                        <h3 className="text-lg font-bold mt-1 mb-8" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>마음 전하실 곳</h3>

                        <div className="max-w-[320px] mx-auto border-t border-white/60 divide-y divide-white/40 text-left">
                          {accountsList.map((account: any) => {
                            const relationLabel = 
                              account.relation === 'groom' ? '신랑' :
                              account.relation === 'bride' ? '신부' :
                              account.relation === 'groomParent' ? '신랑 혼주' :
                              account.relation === 'brideParent' ? '신부 혼주' : '계좌';
                            
                            return (
                              <div 
                                key={account.id} 
                                className="py-4 px-2 flex justify-between items-start cursor-pointer hover:bg-white/10 transition-colors"
                                onClick={() => copyToClipboard(`${account.bank} ${account.accountNumber}`)}
                              >
                                <div className="space-y-1">
                                  <span className="text-[10px] uppercase tracking-wider text-white/70 block">{relationLabel}</span>
                                  <p className="text-sm font-semibold tracking-wide">{account.bank} {account.accountNumber}</p>
                                  <p className="text-[10px] text-white/50">터치하여 계좌번호 복사</p>
                                </div>
                                <div className="text-right flex flex-col justify-between h-full pt-1.5">
                                  <span className="text-sm font-bold">{account.accountHolder}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </section>
                    )
                  }

                  if (isSereneBlue) {
                    return (
                      <section 
                        key="account" 
                        id="preview-section-account" 
                        className="py-16 px-6 bg-white" 
                        style={{ color: '#000000' }}
                      >
                        {renderSectionHeader('account', 'Account', '마음 전하실 곳', 'mb-8')}
                        
                        <div className="max-w-[280px] mx-auto space-y-8">
                          {/* Groom Side Accounts */}
                          {groomAccounts.length > 0 && (
                            <div className="space-y-3">
                              <span className="text-xs text-[#62798E] font-semibold tracking-wider block text-left">Groom Side</span>
                              <div className="border-t border-black divide-y divide-black/10">
                                {groomAccounts.map((account: any) => (
                                  <div 
                                    key={account.id} 
                                    className="py-3 px-1 flex justify-between items-center text-sm cursor-pointer hover:bg-black/5"
                                    onClick={() => copyToClipboard(`${account.bank} ${account.accountNumber}`)}
                                  >
                                    <div className="text-left space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-black">{account.accountHolder}</span>
                                        <span className="text-xs opacity-60">
                                          {account.relation === 'groom' ? '신랑' : '신랑 혼주'}
                                        </span>
                                      </div>
                                      <div className="font-mono text-black/70 text-sm">{account.accountNumber}</div>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-xs text-[#838383] border border-[#838383] px-1.5 py-0.5 rounded-sm">
                                        {account.bank}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Bride Side Accounts */}
                          {brideAccounts.length > 0 && (
                            <div className="space-y-3">
                              <span className="text-xs text-[#62798E] font-semibold tracking-wider block text-left">Bride Side</span>
                              <div className="border-t border-black divide-y divide-black/10">
                                {brideAccounts.map((account: any) => (
                                  <div 
                                    key={account.id} 
                                    className="py-3 px-1 flex justify-between items-center text-sm cursor-pointer hover:bg-black/5"
                                    onClick={() => copyToClipboard(`${account.bank} ${account.accountNumber}`)}
                                  >
                                    <div className="text-left space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-black">{account.accountHolder}</span>
                                        <span className="text-xs opacity-60">
                                          {account.relation === 'bride' ? '신부' : '신부 혼주'}
                                        </span>
                                      </div>
                                      <div className="font-mono text-black/70 text-sm">{account.accountNumber}</div>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-xs text-[#838383] border border-[#838383] px-1.5 py-0.5 rounded-sm">
                                        {account.bank}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </section>
                    )
                  }

                  return (
                    <section key="account" id="preview-section-account" className={cn(spacingClass, "px-6", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                      {showDivider && renderDivider()}
                      {renderSectionHeader('account', 'Account', '마음 전하실 곳', 'mb-6')}
                      
                      {accountLayout === '2col' ? (
                        <div className="grid grid-cols-2 gap-2 text-left items-start">
                          {/* 신랑측 */}
                          <div className="space-y-1.5">
                            <div className="text-center text-[11px] font-semibold pb-1 border-b opacity-80" style={{ color: sectColors.accent, borderColor: `${sectColors.accent}20` }}>신랑측</div>
                            {groomAccounts.map((account: any) => (
                              <Card 
                                key={account.id} 
                                className={cn("border-0 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors", effectiveCardBg, shadowClass)} 
                                style={{ ...borderStyle, color: 'inherit' }}
                                onClick={() => copyToClipboard(`${account.bank} ${account.accountNumber}`)}
                              >
                                <CardContent className="p-1.5 px-2 text-left flex flex-col justify-center min-h-[38px] space-y-0">
                                  <div className="flex justify-between items-center w-full text-[10px] leading-tight">
                                    <span style={{ color: sectColors.secondaryTextColorVal }}>
                                      {account.relation === 'groom' ? '신랑' : '신랑 혼주'}
                                    </span>
                                    <span className="font-semibold truncate max-w-[55px]">{account.accountHolder}</span>
                                  </div>
                                  <div className="flex justify-between items-center w-full mt-0.5 text-[10px] leading-none">
                                    <span className="font-mono truncate max-w-[85px]">{account.accountNumber}</span>
                                    <span className="opacity-80 truncate max-w-[45px] text-[9.5px]" style={{ color: sectColors.secondaryTextColorVal }}>{account.bank}</span>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                            {groomAccounts.length === 0 && (
                              <p className="text-center text-[10px] opacity-30 py-3">등록 계좌 없음</p>
                            )}
                          </div>
                          {/* 신부측 */}
                          <div className="space-y-1.5">
                            <div className="text-center text-[11px] font-semibold pb-1 border-b opacity-80" style={{ color: sectColors.accent, borderColor: `${sectColors.accent}20` }}>신부측</div>
                            {brideAccounts.map((account: any) => (
                              <Card 
                                key={account.id} 
                                className={cn("border-0 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors", effectiveCardBg, shadowClass)} 
                                style={{ ...borderStyle, color: 'inherit' }}
                                onClick={() => copyToClipboard(`${account.bank} ${account.accountNumber}`)}
                              >
                                <CardContent className="p-1.5 px-2 text-left flex flex-col justify-center min-h-[38px] space-y-0">
                                  <div className="flex justify-between items-center w-full text-[10px] leading-tight">
                                    <span style={{ color: sectColors.secondaryTextColorVal }}>
                                      {account.relation === 'bride' ? '신부' : '신부 혼주'}
                                    </span>
                                    <span className="font-semibold truncate max-w-[55px]">{account.accountHolder}</span>
                                  </div>
                                  <div className="flex justify-between items-center w-full mt-0.5 text-[10px] leading-none">
                                    <span className="font-mono truncate max-w-[85px]">{account.accountNumber}</span>
                                    <span className="opacity-80 truncate max-w-[45px] text-[9.5px]" style={{ color: sectColors.secondaryTextColorVal }}>{account.bank}</span>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                            {brideAccounts.length === 0 && (
                              <p className="text-center text-[10px] opacity-30 py-3">등록 계좌 없음</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        // 1열 배치 (1col)
                        <div className="space-y-2">
                          {accountsList.map((account: any) => (
                            <Card 
                              key={account.id} 
                              className={cn("border-0 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors", effectiveCardBg, shadowClass)} 
                              style={{ ...borderStyle, color: 'inherit' }}
                              onClick={() => copyToClipboard(`${account.bank} ${account.accountNumber}`)}
                            >
                              <CardContent className="p-3 text-left">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs" style={{ color: sectColors.secondaryTextColorVal }}>
                                      {account.relation === 'groom' && '신랑'}
                                      {account.relation === 'bride' && '신부'}
                                      {account.relation === 'groomParent' && '신랑 혼주'}
                                      {account.relation === 'brideParent' && '신부 혼주'}
                                    </p>
                                    <p className="font-semibold text-sm mt-0.5">{account.bank} {account.accountNumber}</p>
                                    <p className="text-xs mt-0.5" style={{ color: sectColors.secondaryTextColorVal }}>예금주: {account.accountHolder}</p>
                                  </div>
                                  <div className="text-[11px] opacity-40 flex items-center justify-center">
                                    <Copy className="w-3.5 h-3.5 opacity-70" />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </section>
                  )

                case 'rsvp':
                  if (!currentInvitation?.rsvpEnabled) return null
                  return (
                    <section key="rsvp" id="preview-section-rsvp" className={cn(spacingClass, "px-6", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                      {showDivider && renderDivider()}
                      {renderSectionHeader('rsvp', 'RSVP', '참석 여부 알리기', 'mb-6')}
                      <Button className="w-full text-sm text-white animate-pulse" style={{ backgroundColor: sectColors.accent, color: isDuotone ? color2 : '#ffffff', ...borderStyle }}>
                        <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                        참석 의사 전달하기
                      </Button>
                    </section>
                  )

                case 'guestbook':
                  if (currentInvitation?.guestbookType === 'none' || currentInvitation?.guestbookType === undefined) return null
                  return (
                    <section key="guestbook" id="preview-section-guestbook" className={cn(spacingClass, "px-6", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                      {showDivider && renderDivider()}
                      {renderSectionHeader('guestbook', 'Guestbook', '방명록', 'mb-6')}
                      <div className="space-y-2 text-left">
                        <Card className={cn("border-0", effectiveCardBg, shadowClass)} style={{ ...borderStyle, color: 'inherit' }}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-xs">하객 성함</span>
                              <span className="text-[11px] opacity-40">2026.06.03</span>
                            </div>
                            <p className="text-xs opacity-70">결혼을 진심으로 축하드립니다!</p>
                          </CardContent>
                        </Card>
                      </div>
                      <Button variant="outline" className="w-full mt-3 text-xs h-8 border-current/30" style={isDuotone ? { borderColor: `${color1}33`, color: color1, backgroundColor: 'transparent', borderRadius: borderStyle.borderRadius } : borderStyle}>
                        축하 메시지 남기기
                      </Button>
                    </section>
                  )

                default:
                  return null
              }
              })();

              if (!sectionElement && sectionImages.length === 0) return null

              return (
                <React.Fragment key={sectionId}>
                  {sectionElement}
                  {sectionImages.length > 0 && (
                    <div className="w-full">
                      {sectionImages.map((img, imgIdx) => (
                        <div key={imgIdx} className={cn("w-full overflow-hidden", imgIdx > 0 ? 'pt-3' : '')}>
                          <img
                            src={img.url}
                            alt={img.caption || `section image ${imgIdx + 1}`}
                            className="w-full h-auto object-cover block"
                          />
                          {img.caption && (
                            <p className="text-center text-[9px] opacity-50 py-1 px-2">{img.caption}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </React.Fragment>
              )
            })}

            {/* Share Section */}
            <section className="py-6 px-6 text-center bg-transparent" style={isDuotone ? { backgroundColor: color2, color: color1 } : undefined}>
              <Button variant="ghost" className={cn("text-[10px] h-auto p-0 gap-1", isDuotone ? "text-current opacity-70 hover:opacity-100 hover:bg-transparent" : "text-muted-foreground opacity-60 hover:opacity-100 hover:bg-transparent")}>
                <Share2 className="w-3 h-3" />
                청첩장 주소 복사하기
              </Button>
            </section>

            {/* Footer */}
            <footer className="py-6 px-6 text-center text-[9px] tracking-wider flex justify-center" style={isDuotone ? { backgroundColor: color2, color: color1 } : undefined}>
              <Logo className={cn("h-3.5 w-auto text-current", isDuotone ? "opacity-60" : "opacity-30")} />
            </footer>
            
          </div>
        </ScrollArea>
      </div>
      {activeImageModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 pointer-events-auto cursor-pointer" 
          onClick={() => setActiveImageModal(null)}
        >
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <img src={activeImageModal} alt="Popup Image" className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl" />
            <button 
              className="absolute -top-10 right-0 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 w-8 h-8 flex items-center justify-center font-bold text-sm"
              onClick={() => setActiveImageModal(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
