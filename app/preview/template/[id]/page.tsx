'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Calendar as CalendarIcon,
  MapPin,
  Phone,
  Copy,
  Share2,
  Heart,
  Navigation,
  ChevronDown,
  Music,
  Pause,
  ArrowLeft
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { sampleThemes } from '@/lib/store'
import { cn, getLegibleColor } from '@/lib/utils'
import { Logo } from '@/components/logo'

export default function TemplatePreviewPage() {
  const params = useParams()
  const router = useRouter()
  const themeId = params.id as string

  const [theme, setTheme] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showRsvp, setShowRsvp] = useState(false)
  
  // Interactive mock states
  const [attendance, setAttendance] = useState('yes')
  const [guestCount, setGuestCount] = useState('2')
  const [mealType, setMealType] = useState('korean')
  const [rsvpName, setRsvpName] = useState('')
  const [rsvpMessage, setRsvpMessage] = useState('')
  
  const [guestbookMessages, setGuestbookMessages] = useState<any[]>([
    { id: 'm1', name: '김태희', message: '너무 잘 어울리는 한 쌍이에요! 결혼 축하드려요.', createdAt: '2026.06.01' },
    { id: 'm2', name: '이병헌', message: '두 분의 앞날에 늘 행복과 미소만 가득하기를 기원합니다.', createdAt: '2026.06.02' },
  ])
  const [newCommentName, setNewCommentName] = useState('')
  const [newCommentMessage, setNewCommentMessage] = useState('')
  const [showCommentModal, setShowCommentModal] = useState(false)

  // Audio Ref & State
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [bgmUrl, setBgmUrl] = useState<string | null>(null)
  const [customFonts, setCustomFonts] = useState<any[]>([])

  useEffect(() => {
    const loadFonts = async () => {
      try {
        const { data } = await supabase.from('settings').select('*').eq('key', 'fonts')
        if (data && data.length > 0 && data[0].value) {
          setCustomFonts(data[0].value)
        }
      } catch (err) {
        console.error('Error fetching fonts in TemplatePreviewPage:', err)
      }
    }
    loadFonts()
  }, [])

  useEffect(() => {
    if (!themeId) return

    const loadThemeData = async () => {
      try {
        const { data, error } = await supabase
          .from('themes')
          .select('*')
          .eq('id', themeId)
          .single()

        let selectedTheme = data
        if (error || !data) {
          // Fallback to sample themes
          selectedTheme = sampleThemes.find(t => t.id === themeId) || sampleThemes[0]
        }
        
        setTheme(selectedTheme)

        // Find BGM from DB or use fallback
        if (selectedTheme?.recommendedBgms && selectedTheme.recommendedBgms.length > 0) {
          const bgmId = selectedTheme.recommendedBgms[0]
          const { data: bgmData } = await supabase
            .from('bgms')
            .select('*')
            .eq('id', bgmId)
            .single()

          if (bgmData && bgmData.url) {
            setBgmUrl(bgmData.url)
          } else {
            setBgmUrl('/bgm/canon.mp3') // Fallback BGM
          }
        } else {
          setBgmUrl('/bgm/canon.mp3')
        }
      } catch (err) {
        console.error('Error loading theme:', err)
        toast.error('테마 디자인 정보를 불러오는데 실패했습니다.')
      } finally {
        setLoading(false)
      }
    }

    loadThemeData()
  }, [themeId])

  useEffect(() => {
    if (bgmUrl && isPlaying) {
      if (!audioRef.current) {
        audioRef.current = new Audio(bgmUrl)
        audioRef.current.loop = true
      } else if (audioRef.current.src !== bgmUrl) {
        audioRef.current.pause()
        audioRef.current = new Audio(bgmUrl)
        audioRef.current.loop = true
      }
      audioRef.current.play().catch(e => {
        console.error('Audio playback blocked by browser autocomplete policy:', e)
        setIsPlaying(false)
      })
    } else {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [bgmUrl, isPlaying])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('클립보드에 복사되었습니다.')
  }

  const handleRsvpSubmit = () => {
    if (!rsvpName) {
      toast.error('성함을 입력해주세요.')
      return
    }
    toast.success('참석 정보가 시뮬레이션되었습니다! (미리보기 화면입니다)')
    setShowRsvp(false)
    setRsvpName('')
    setRsvpMessage('')
  }

  const handleAddComment = () => {
    if (!newCommentName || !newCommentMessage) {
      toast.error('이름과 축하 메시지를 입력해주세요.')
      return
    }
    const formattedDate = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/ /g, '').slice(0, -1)

    const newComment = {
      id: 'msg-' + Math.random().toString(36).substring(2, 9),
      name: newCommentName,
      message: newCommentMessage,
      createdAt: formattedDate
    }

    setGuestbookMessages([newComment, ...guestbookMessages])
    setNewCommentName('')
    setNewCommentMessage('')
    setShowCommentModal(false)
    toast.success('축하 메시지가 미리보기용으로 추가되었습니다!')
  }

  const getCalendarDays = (dateStr: string) => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center">
        <Logo className="h-5 w-auto text-[#8b7355] animate-pulse" />
        <p className="text-xs text-gray-400 mt-2">샘플 미리보기를 준비하는 중입니다...</p>
      </div>
    )
  }

  if (!theme) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center p-8 text-center">
        <p className="text-base text-gray-500">존재하지 않거나 삭제된 테마입니다.</p>
        <Button className="mt-4 bg-[#c4a574] text-white" onClick={() => router.push('/templates')}>
          갤러리로 돌아가기
        </Button>
      </div>
    )
  }

  // Set mock invitation data
  const weddingDateStr = '2026-10-24'
  const { year: calYear, month: calMonth, day: calDay, days: calDays } = getCalendarDays(weddingDateStr)

  // Determine theme colors and fonts dynamically
  const colorSet = theme.colorSets?.[0]
  const fontSet = theme.fontSets?.[0]
  
  const bgColor = colorSet?.colors?.[0] || theme.styles?.backgroundColor || '#faf9f7'
  const rawAccentColor = colorSet?.colors?.[1] || theme.styles?.primaryColor || '#c4a574'
  const rawTextColor = colorSet?.colors?.[2] || theme.styles?.textColor || '#3d3d3d'
  const fontClass = fontSet?.id === 'serif' ? 'font-serif' : 'font-sans'

  // Dynamic style values
  const themeStyles = theme?.styles || {}
  const borderRadius = themeStyles.borderRadius || '8px'
  const sectionSpacing = themeStyles.sectionSpacing || 'py-16'
  const cardBg = themeStyles.cardBg || 'bg-white/40'
  const cardShadow = themeStyles.cardShadow || 'shadow-sm'
  const dividerType = themeStyles.dividerType || 'heart'
  const heroStyle = themeStyles.heroStyle || 'center'
  const rawSecondaryTextColor = themeStyles.secondaryTextColor || '#8a8a8a'

  const accentColor = getLegibleColor(bgColor, rawAccentColor, false)
  const textColor = getLegibleColor(bgColor, rawTextColor, true)
  const secondaryTextColor = getLegibleColor(bgColor, rawSecondaryTextColor, false)

  const fontKr = fontSet?.fonts?.[0] || themeStyles.fontKr || 'font-serif'
  const fontEn = fontSet?.fonts?.[1] || themeStyles.fontEn || 'font-serif'

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

  return (
    <div className={cn("min-h-screen", fontClass)} style={{ backgroundColor: bgColor, fontFamily: getFontFamily(fontKr, fontEn) }}>
      {/* Floating Control Bar: Back to Gallery & BGM */}
      <div className="fixed top-4 left-4 right-4 z-50 flex items-center justify-between pointer-events-none">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => router.push('/templates')}
          className="pointer-events-auto bg-white/80 backdrop-blur shadow-md text-xs h-9 gap-1 border-gray-200 hover:bg-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          갤러리 돌아가기
        </Button>

        {bgmUrl && (
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="pointer-events-auto w-10 h-10 rounded-full bg-white/80 backdrop-blur shadow-lg flex items-center justify-center border border-gray-200 hover:bg-white transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4 text-[#c4a574]" /> : <Music className="w-4 h-4 text-gray-500" />}
          </button>
        )}
      </div>

      {/* Floating Top Badge: "샘플 미리보기" */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-black/65 text-white/90 text-[10px] px-3 py-1 rounded-full backdrop-blur pointer-events-none tracking-wider uppercase font-semibold">
        샘플 미리보기 화면
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto relative shadow-md min-h-screen pb-12" style={{ backgroundColor: bgColor, color: textColor }}>
        {/* Dynamic Style injection for custom fonts */}
        <style dangerouslySetInnerHTML={{
          __html: (() => {
            const defaultGoogleFonts = `@import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300..700;1,300..700&family=Cinzel:wght@400..900&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Inter:wght@100..900&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400..700;1,400..700&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Nanum+Myeongjo:wght@400;700;800&family=Noto+Serif+KR:wght@200..900&family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Quicksand:wght@300..700&display=swap');`;
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

          const isEven = idx % 2 === 0
          const sectionBg = isMinimal ? 'bg-transparent' : (isEven ? 'bg-white/40 backdrop-blur-sm' : 'bg-black/5')
          const sectionBorderClass = isGrid ? 'border border-current/15 mx-2 my-2' : ''
          const effectiveCardBg = isMinimal ? 'bg-transparent' : cardBg
          const showDivider = idx > 0
          
          const renderDivider = () => {
            if (dividerType === 'line') {
              return <div className="mx-auto my-8 h-px w-32 bg-current opacity-20" />
            }
            if (dividerType === 'heart') {
              return <div className="text-center opacity-40 my-8 text-xs" style={{ color: accentColor }}>♥</div>
            }
            if (dividerType === 'space') {
              return <div className="my-8 h-6" />
            }
            return null
          }

          switch (sectionId) {
            case 'hero':
              return (
                <div key="hero" className="relative h-screen flex flex-col items-center justify-center text-center px-8 overflow-hidden">
                  <div className="absolute inset-0 z-0">
                    <img
                      src={theme.thumbnail || 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80'}
                      alt="Main Visual"
                      className="w-full h-full object-cover opacity-20"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t" style={{ backgroundImage: `linear-gradient(to top, ${bgColor}, transparent, ${bgColor}80)` }} />
                  </div>
                  
                  <div className="space-y-6 z-10 w-full max-w-[280px] mx-auto">
                    <p className="text-sm tracking-[0.3em] opacity-60">WEDDING INVITATION</p>
                    
                    {heroStyle === 'left' ? (
                      <div className="space-y-4 text-left px-4 w-full">
                        <div className="space-y-1">
                          <p className="text-xs opacity-75">홍판서 · 춘향덕의 장남</p>
                          <h1 className="text-3xl font-light tracking-wide">홍길동</h1>
                        </div>
                        <div className="text-xl font-light opacity-60" style={{ color: accentColor }}>&amp;</div>
                        <div className="space-y-1">
                          <p className="text-xs opacity-75">성참판 · 월매의 외동딸</p>
                          <h1 className="text-3xl font-light tracking-wide">성춘향</h1>
                        </div>
                      </div>
                    ) : heroStyle === 'classic' ? (
                      <div className="space-y-4 text-center w-full">
                        <h1 className="text-4xl font-light tracking-widest uppercase">
                          GILDONG
                          <span className="block text-base opacity-55 my-1" style={{ color: accentColor }}>&amp;</span>
                          CHUNHYANG
                        </h1>
                        <div className="w-12 h-px bg-current opacity-30 mx-auto" />
                        <p className="text-sm tracking-wide">홍길동 · 성춘향</p>
                      </div>
                    ) : (
                      // Center
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <p className="text-xs opacity-75">홍판서 · 춘향덕의 장남</p>
                          <h1 className="text-3xl font-light tracking-wide">홍길동</h1>
                        </div>
                        <div className="text-xl font-light opacity-60 font-light" style={{ color: accentColor }}>&amp;</div>
                        <div className="space-y-1">
                          <p className="text-xs opacity-75">성참판 · 월매의 외동딸</p>
                          <h1 className="text-3xl font-light tracking-wide">성춘향</h1>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1 opacity-80 text-sm pt-4 border-t border-current/10">
                      <p>2026년 10월 24일 (토요일)</p>
                      <p>오후 12:30</p>
                      <p>바우하우스 서울 라움홀 1층</p>
                    </div>
                  </div>
                  <div className="absolute bottom-8 animate-float z-10">
                    <ChevronDown className="w-6 h-6" style={{ color: accentColor }} />
                  </div>
                </div>
              )

            case 'greeting':
              return (
                <section key="greeting" className={cn(spacingClass, "px-8 text-center", sectionBg, sectionBorderClass)} style={isGrid ? borderStyle : undefined}>
                  {showDivider && renderDivider()}
                  <Heart className="w-6 h-6 mx-auto mb-6 opacity-60" style={{ color: accentColor }} />
                  <p className="leading-relaxed whitespace-pre-line text-sm opacity-80 mb-6">
                    평생을 같이하고 싶은 사람을 만났습니다.{"\n"}
                    서로 아끼고 돕고 살아가며{"\n"}
                    아름다운 가정을 꾸리도록 노력하겠습니다.{"\n"}{"\n"}
                    저희의 뜻깊은 시작을 함께하셔서{"\n"}
                    축복해 주시면 더없는 기쁨이 되겠습니다.
                  </p>
                </section>
              )

            case 'gallery':
              const isSlide = theme?.galleryViewType === 'slide' || theme?.styles?.galleryViewType === 'slide'
              const galleryAlign = theme?.styles?.galleryAlign || 'center'
              const mockImages = [
                'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80',
                'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=600&q=80',
                'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=600&q=80',
                'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80'
              ]
              return (
                <section key="gallery" className={cn(spacingClass, isSlide ? "px-0" : "px-8", sectionBg, sectionBorderClass)} style={isGrid ? borderStyle : undefined}>
                  {showDivider && renderDivider()}
                  <h2 className="text-center text-xs font-semibold tracking-wider mb-8 px-8">GALLERY</h2>
                  {isSlide ? (
                    <div className="flex gap-2 overflow-x-auto snap-x scrollbar-hide pb-2 px-8">
                      {mockImages.map((img: string, index: number) => (
                        <div key={index} className={cn("w-[280px] h-[350px] flex-shrink-0 snap-center overflow-hidden bg-black/5 flex justify-center", galleryAlign === 'bottom' ? 'items-end' : 'items-center', shadowClass)} style={borderStyle}>
                          <img src={img} alt={`Gallery ${index + 1}`} className="max-w-full max-h-full object-contain hover:scale-105 transition-transform duration-300" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={cn("grid gap-2", isTwoColumn ? "grid-cols-3" : "grid-cols-2")}>
                      {mockImages.map((img: string, index: number) => (
                        <div key={index} className={cn("aspect-square overflow-hidden bg-black/10", shadowClass)} style={borderStyle}>
                          <img src={img} alt={`Gallery ${index + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )

            case 'calendar':
              return (
                <section key="calendar" className={cn(spacingClass, "px-8", sectionBg, sectionBorderClass)} style={isGrid ? borderStyle : undefined}>
                  {showDivider && renderDivider()}
                  <h2 className="text-center text-xs font-semibold tracking-wider mb-8">CALENDAR</h2>
                  <Card className={cn("border-0 shadow-none", effectiveCardBg)} style={borderStyle}>
                    <CardContent className="p-6">
                      <div className="text-center mb-4">
                        <p className="text-2xl font-semibold" style={{ color: accentColor }}>{calMonth}</p>
                        <p className="text-sm opacity-40">{calYear}</p>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-center text-sm">
                        {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                          <div key={day} className="py-2 opacity-55 font-semibold text-xs">{day}</div>
                        ))}
                        {calDays.map((day, i) => {
                          if (day === null) return <div key={`empty-${i}`} />
                          return (
                            <div
                              key={i}
                              className={cn(
                                "py-1 text-xs flex items-center justify-center w-8 h-8 mx-auto rounded-full",
                                day === calDay && "text-white font-bold"
                              )}
                              style={day === calDay ? { backgroundColor: accentColor } : { color: secondaryTextColor }}
                            >
                              {day}
                            </div>
                          )
                        })}
                      </div>
                      <div className="mt-6 text-center text-xs opacity-80">
                        <p className="font-semibold text-sm" style={{ color: accentColor }}>
                          2026년 10월 24일 (토요일)
                        </p>
                        <p className="text-sm mt-1">오후 12:30</p>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              )

            case 'location':
              return (
                <section key="location" className={cn(spacingClass, "px-8", sectionBg, sectionBorderClass)} style={isGrid ? borderStyle : undefined}>
                  {showDivider && renderDivider()}
                  <h2 className="text-center text-xs font-semibold tracking-wider mb-8">LOCATION</h2>
                  <Card className={cn("border-0", effectiveCardBg, shadowClass)} style={borderStyle}>
                    <CardContent className="p-6 text-left space-y-4">
                      <div>
                        <h3 className="font-semibold text-base">바우하우스 서울</h3>
                        <p className="text-sm" style={{ color: accentColor }}>라움홀 1층</p>
                        <p className="text-xs mt-1" style={{ color: secondaryTextColor }}>서울특별시 용산구 한강대로 456</p>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-gray-100/10 text-xs">
                        <div>
                          <p className="font-semibold">교통 안내</p>
                          <p className="whitespace-pre-line mt-1 leading-relaxed" style={{ color: secondaryTextColor }}>
                            지하철: 1호선/4호선 서울역 10번 출구 도보 3분{"\n"}
                            버스: 서울역 정류장 하차
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold">주차 안내</p>
                          <p className="whitespace-pre-line mt-1 leading-relaxed" style={{ color: secondaryTextColor }}>
                            예식장 건물 내 500대 주차 가능 (하객 2시간 무료 주차)
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" className="flex-1" style={borderStyle} asChild>
                          <a href="https://map.naver.com" target="_blank" rel="noopener noreferrer">
                            <Navigation className="w-4 h-4 mr-2" />
                            네이버지도
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" style={borderStyle} asChild>
                          <a href="https://map.kakao.com" target="_blank" rel="noopener noreferrer">
                            <Navigation className="w-4 h-4 mr-2" />
                            카카오맵
                          </a>
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs opacity-60 hover:opacity-90"
                        style={borderStyle}
                        onClick={() => copyToClipboard('서울특별시 용산구 한강대로 456')}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        주소 복사
                      </Button>
                    </CardContent>
                  </Card>
                </section>
              )

            case 'contact':
              return (
                <section key="contact" className={cn(spacingClass, "px-8", sectionBg, sectionBorderClass)} style={isGrid ? borderStyle : undefined}>
                  {showDivider && renderDivider()}
                  <h2 className="text-center text-xs font-semibold tracking-wider mb-8">CONTACT</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: '1', name: '홍길동', phone: '010-1234-5678', relation: 'groom' },
                      { id: '2', name: '성춘향', phone: '010-8765-4321', relation: 'bride' }
                    ].map((contact: any) => (
                      <Card key={contact.id} className={cn("border-0", effectiveCardBg, shadowClass)} style={borderStyle}>
                        <CardContent className="p-4 text-center">
                          <p className="text-xs mb-1" style={{ color: secondaryTextColor }}>
                            {contact.relation === 'groom' ? '신랑' : '신부'}
                          </p>
                          <p className="font-semibold mb-3 text-sm truncate">{contact.name}</p>
                          <Button variant="outline" size="sm" className="w-full" style={borderStyle} asChild>
                            <a href={`tel:${contact.phone}`}>
                              <Phone className="w-4 h-4 mr-2" />
                              전화
                            </a>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )

            case 'sequence':
              return (
                <section key="sequence" className={cn(spacingClass, "px-8", sectionBg, sectionBorderClass)} style={isGrid ? borderStyle : undefined}>
                  {showDivider && renderDivider()}
                  <h2 className="text-center text-xs font-semibold tracking-wider mb-2">식순 안내</h2>
                  <p className="text-center text-sm opacity-40 mb-8">WEDDING ORDER</p>
                  
                  <div className="relative border-l border-current/15 ml-6 pl-8 space-y-6 text-left max-w-[280px] mx-auto">
                    {[
                      { id: '1', time: '12:00', title: '식전 영상 상영' },
                      { id: '2', time: '12:10', title: '개식 및 화촉점화' },
                      { id: '3', time: '12:20', title: '신랑 신부 입장' },
                      { id: '4', time: '12:30', title: '혼인서약 및 성혼선언' },
                      { id: '5', time: '12:45', title: '축가 및 하객 인사' },
                      { id: '6', time: '13:00', title: '신랑 신부 행진 및 폐식' }
                    ].map((event: any) => (
                      <div key={event.id} className="relative">
                        {/* Dot */}
                        <div className="absolute -left-[37.5px] top-1.5 w-3.5 h-3.5 rounded-full bg-current opacity-70 border-2 border-background" style={{ backgroundColor: accentColor }} />
                        <div>
                          <span className="font-mono text-sm font-semibold" style={{ color: accentColor }}>{event.time}</span>
                          <p className="text-sm font-medium mt-1">{event.title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )

            case 'account':
              return (
                <section key="account" className={cn(spacingClass, "px-8", sectionBg, sectionBorderClass)} style={isGrid ? borderStyle : undefined}>
                  {showDivider && renderDivider()}
                  <h2 className="text-center text-xs font-semibold tracking-wider mb-2">ACCOUNT</h2>
                  <p className="text-center text-sm opacity-40 mb-8">마음 전하실 곳</p>
                  <div className={cn("space-y-4", isTwoColumn && "grid grid-cols-2 gap-4 space-y-0")}>
                    {[
                      { id: '1', bank: '신한은행', accountNumber: '110-123-456789', accountHolder: '홍길동', relation: 'groom' },
                      { id: '2', bank: '국민은행', accountNumber: '123-456-789012', accountHolder: '성춘향', relation: 'bride' }
                    ].map((account: any) => (
                      <Card key={account.id} className={cn("border-0 shadow-sm", effectiveCardBg, shadowClass)} style={borderStyle}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="text-left">
                              <p className="text-xs" style={{ color: secondaryTextColor }}>
                                {account.relation === 'groom' ? '신랑' : '신부'}
                              </p>
                              <p className="font-semibold text-sm mt-1">{account.bank} {account.accountNumber}</p>
                              <p className="text-xs mt-0.5" style={{ color: secondaryTextColor }}>예금주: {account.accountHolder}</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              style={borderStyle}
                              onClick={() => copyToClipboard(`${account.bank} ${account.accountNumber}`)}
                              className="hover:bg-gray-50"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )

            case 'rsvp':
              return (
                <section key="rsvp" className={cn(spacingClass, "px-8", sectionBg, sectionBorderClass)} style={isGrid ? borderStyle : undefined}>
                  {showDivider && renderDivider()}
                  <h2 className="text-center text-xs font-semibold tracking-wider mb-2">RSVP</h2>
                  <p className="text-center text-sm opacity-40 mb-8">참석 여부를 알려주세요</p>
                  
                  <Dialog open={showRsvp} onOpenChange={setShowRsvp}>
                    <DialogTrigger asChild>
                      <Button className="w-full text-white" style={{ backgroundColor: accentColor, ...borderStyle }}>
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        참석 의사 전달하기
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle>참석 여부 전달 (미리보기)</DialogTitle>
                        <DialogDescription>참석 정보 시뮬레이션입니다.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-6 py-4">
                        <div className="space-y-3">
                          <Label htmlFor="rsvp-name">성함</Label>
                          <Input id="rsvp-name" placeholder="성함을 입력해주세요" value={rsvpName} onChange={(e) => setRsvpName(e.target.value)} />
                        </div>
                        <div className="space-y-3">
                          <Label>참석 여부</Label>
                          <RadioGroup value={attendance} onValueChange={setAttendance}>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="yes" id="yes" />
                              <Label htmlFor="yes" className="font-normal">참석</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="no" id="no" />
                              <Label htmlFor="no" className="font-normal">불참</Label>
                            </div>
                          </RadioGroup>
                        </div>
                        {attendance === 'yes' && (
                          <>
                            <div className="space-y-3">
                              <Label>참석 인원</Label>
                              <RadioGroup value={guestCount} onValueChange={setGuestCount}>
                                <div className="grid grid-cols-4 gap-2">
                                  {["1", "2", "3", "4+"].map((count) => (
                                    <div key={count} className="flex items-center space-x-2">
                                      <RadioGroupItem value={count} id={`count-${count}`} />
                                      <Label htmlFor={`count-${count}`} className="font-normal">{count}명</Label>
                                    </div>
                                  ))}
                                </div>
                              </RadioGroup>
                            </div>
                            <div className="space-y-3">
                              <Label>식사 선택</Label>
                              <RadioGroup value={mealType} onValueChange={setMealType}>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="korean" id="korean" />
                                  <Label htmlFor="korean" className="font-normal">한식</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="western" id="western" />
                                  <Label htmlFor="western" className="font-normal">양식</Label>
                                </div>
                              </RadioGroup>
                            </div>
                          </>
                        )}
                        <div className="space-y-3">
                          <Label htmlFor="rsvp-msg">축하 메시지 (선택)</Label>
                          <Textarea id="rsvp-msg" placeholder="축하 메시지를 남겨주세요" rows={3} value={rsvpMessage} onChange={(e) => setRsvpMessage(e.target.value)} />
                        </div>
                      </div>
                      <Button className="w-full text-white" style={{ backgroundColor: accentColor, ...borderStyle }} onClick={handleRsvpSubmit}>
                        전송하기
                      </Button>
                    </DialogContent>
                  </Dialog>
                </section>
              )

            case 'guestbook':
              return (
                <section key="guestbook" className={cn(spacingClass, "px-8", sectionBg, sectionBorderClass)} style={isGrid ? borderStyle : undefined}>
                  {showDivider && renderDivider()}
                  <h2 className="text-center text-xs font-semibold tracking-wider mb-8">GUESTBOOK</h2>
                  <div className="space-y-4 text-left">
                    {guestbookMessages.length === 0 ? (
                      <p className="text-center text-sm opacity-40 py-6">남겨진 축하 메시지가 없습니다. 첫 메시지를 남겨보세요!</p>
                    ) : (
                      guestbookMessages.map((comment) => (
                        <Card key={comment.id} className={cn("border-0 shadow-sm", effectiveCardBg, shadowClass)} style={borderStyle}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-sm">{comment.name}</span>
                              <span className="text-xs opacity-40">{comment.createdAt}</span>
                            </div>
                            <p className="text-sm opacity-80 leading-relaxed whitespace-pre-line">{comment.message}</p>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                  
                  <Dialog open={showCommentModal} onOpenChange={setShowCommentModal}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full mt-4 border-current/30" style={borderStyle}>
                        축하 메시지 남기기
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle>축하 메시지 남기기 (미리보기)</DialogTitle>
                        <DialogDescription>축하의 메시지를 남겨보세요.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="comment-name">성함</Label>
                          <Input id="comment-name" placeholder="이름을 입력해주세요" value={newCommentName} onChange={(e) => setNewCommentName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="comment-message">축하 메시지</Label>
                          <Textarea id="comment-message" placeholder="축하 메시지를 입력해주세요" rows={4} value={newCommentMessage} onChange={(e) => setNewCommentMessage(e.target.value)} />
                        </div>
                      </div>
                      <Button className="w-full text-white" style={{ backgroundColor: accentColor, ...borderStyle }} onClick={handleAddComment}>
                        축하글 등록
                      </Button>
                    </DialogContent>
                  </Dialog>
                </section>
              )

            default:
              return null
          }
        })}

        {/* Share Section */}
        <section className="py-8 px-6 bg-white/40 backdrop-blur-sm text-center">
          <Button 
            variant="outline" 
            className="gap-1.5 text-[10px] h-8 border-current/30"
            onClick={() => {
              copyToClipboard(window.location.href)
              toast.success('샘플 청첩장 주소가 복사되었습니다.')
            }}
          >
            <Share2 className="w-3.5 h-3.5" />
            청첩장 주소 복사하기
          </Button>
        </section>

        {/* Footer */}
        <footer className="py-6 px-6 text-center opacity-30 text-[9px] tracking-wider flex justify-center">
          <Logo className="h-3.5 w-auto text-current" />
        </footer>
      </div>
    </div>
  )
}
