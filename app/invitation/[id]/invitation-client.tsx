"use client"

import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
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
  ChevronLeft,
  ChevronRight,
  Music,
  Pause,
  Image
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { NaverMap } from "@/components/naver-map"
import { toast } from "sonner"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { sampleThemes } from "@/lib/store"
import { cn, getLegibleColor } from "@/lib/utils"
import { Logo } from "@/components/logo"

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

export default function InvitationClient({ 
  id, 
  initialInvitation,
  initialThemes,
  initialFonts
}: { 
  id: string; 
  initialInvitation?: any;
  initialThemes?: any[];
  initialFonts?: any[];
}) {
  const [invitation, setInvitation] = useState<any>(initialInvitation || null)
  const [themes, setThemes] = useState<any[]>(initialThemes || [])
  const [customFonts, setCustomFonts] = useState<any[]>(initialFonts || [])
  const [loading, setLoading] = useState(!initialInvitation)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showRsvp, setShowRsvp] = useState(false)
  const [attendance, setAttendance] = useState("yes")
  const [guestCount, setGuestCount] = useState<number>(1)
  const [mealType, setMealType] = useState("korean")
  const [rsvpName, setRsvpName] = useState("")
  const [rsvpPhone, setRsvpPhone] = useState("")
  const [rsvpSide, setRsvpSide] = useState("groom") // "groom" | "bride"
  const [rsvpShuttleUsed, setRsvpShuttleUsed] = useState("no") // "yes" | "no"
  const [rsvpMealInfo, setRsvpMealInfo] = useState<Record<string, number>>({})
  const [rsvpMessage, setRsvpMessage] = useState("")
  const [isSubmittingRsvp, setIsSubmittingRsvp] = useState(false)

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

  // Guestbook states
  const [guestbookMessages, setGuestbookMessages] = useState<any[]>([])
  const [guestbookPage, setGuestbookPage] = useState(0)
  const [newCommentName, setNewCommentName] = useState("")
  const [newCommentMessage, setNewCommentMessage] = useState("")
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [showCommentModal, setShowCommentModal] = useState(false)

  // Audio Ref & State
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [bgmUrl, setBgmUrl] = useState<string | null>(null)

  const [activeImageModal, setActiveImageModal] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 })

  useEffect(() => {
    if (!invitation?.weddingDate) return
    
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
      const { days, hours, minutes } = getCountdown(invitation.weddingDate!, invitation.weddingTime)
      setTimeLeft({ days, hours, minutes })
    }
    
    updateTime()
    const timer = setInterval(updateTime, 60000) // update every minute
    return () => clearInterval(timer)
  }, [invitation?.weddingDate, invitation?.weddingTime])

  useEffect(() => {
    const loadFonts = async () => {
      if (initialFonts && initialFonts.length > 0) return
      try {
        const { data } = await supabase.from('settings').select('*').eq('key', 'fonts')
        if (data && data.length > 0 && data[0].value) {
          setCustomFonts(data[0].value)
        }
      } catch (err) {
        console.error('Error fetching fonts in InvitationClient:', err)
      }
    }
    loadFonts()
  }, [initialFonts])

  useEffect(() => {
    if (!id) return

    const loadData = async () => {
      // 0. Log visitor count
      try {
        await supabase.from('visitor_logs').insert({ invitationId: id })
      } catch (err) {
        console.warn('Logging visitor count to DB failed. Recording locally:', err)
        const visitorLogsKey = `visitor_logs_${id}`
        const localLogs = JSON.parse(localStorage.getItem(visitorLogsKey) || '[]')
        localLogs.push({
          id: 'vlog-' + Math.random().toString(36).substring(2, 9),
          invitationId: id,
          visitedDate: new Date().toISOString().split('T')[0],
          visitedAt: new Date().toISOString()
        })
        localStorage.setItem(visitorLogsKey, JSON.stringify(localLogs))
      }

      try {
        // Fetch themes (Skip if pre-fetched)
        if (!initialThemes || initialThemes.length === 0) {
          const { data: themesData } = await supabase.from('themes').select('*')
          if (themesData) setThemes(themesData)
        }

        // 1. Fetch invitation to ensure fresh data
        const { data: inviteData, error: inviteError } = await supabase
          .from('invitations')
          .select('*')
          .eq('id', id)
          .single()

        if (inviteError) throw inviteError
        let currentInvite = inviteData
        if (inviteData) {
          setInvitation(inviteData)
        }

        if (currentInvite) {
          // 2. Fetch guestbook comments
          if (currentInvite.guestbookType !== 'none') {
            const { data: comments, error: commentsError } = await supabase
              .from('guestbook')
              .select('*')
              .eq('invitationId', id)
              .order('createdAt', { ascending: false })

            if (!commentsError && comments) {
              setGuestbookMessages(comments)
            } else {
              // Fallback to local storage if table doesn't exist
              const localComments = JSON.parse(localStorage.getItem(`guestbook_comments_${id}`) || '[]')
              setGuestbookMessages(localComments)
            }
          }

          // 3. Set BGM URL
          if (currentInvite.bgmId) {
            const { data: bgmData } = await supabase
              .from('bgms')
              .select('*')
              .eq('id', currentInvite.bgmId)
              .single()

            if (bgmData && bgmData.url) {
              setBgmUrl(bgmData.url)
            } else {
              const sampleBgm = [
                { id: 'bgm1', url: '/bgm/canon.mp3' },
                { id: 'bgm2', url: '/bgm/thousand.mp3' },
                { id: 'bgm3', url: '/bgm/river.mp3' },
                { id: 'bgm4', url: '/bgm/wedding.mp3' },
                { id: 'bgm5', url: '/bgm/perfect.mp3' },
              ].find(b => b.id === currentInvite.bgmId)
              if (sampleBgm) {
                setBgmUrl(sampleBgm.url)
              }
            }
          }
        }
      } catch (err) {
        console.error("Error loading invitation data:", err)
        toast.error("청첩장을 불러오는데 실패했습니다.")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [id])

  useEffect(() => {
    let playOnInteraction: (() => void) | null = null;

    if (bgmUrl && isPlaying) {
      if (!audioRef.current) {
        audioRef.current = new Audio(bgmUrl)
        audioRef.current.loop = true
      } else if (audioRef.current.src !== bgmUrl) {
        audioRef.current.pause()
        audioRef.current = new Audio(bgmUrl)
        audioRef.current.loop = true
      }
      
      const playAudio = () => {
        audioRef.current?.play().catch(e => {
          console.log("Audio play postponed until user interaction:", e)
          
          playOnInteraction = () => {
            audioRef.current?.play().then(() => {
              if (playOnInteraction) {
                document.removeEventListener('click', playOnInteraction)
                document.removeEventListener('touchstart', playOnInteraction)
              }
            }).catch(err => console.log('Autoplay retry failed:', err))
          }
          document.addEventListener('click', playOnInteraction)
          document.addEventListener('touchstart', playOnInteraction)
        })
      }

      playAudio()
    } else {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      if (playOnInteraction) {
        document.removeEventListener('click', playOnInteraction)
        document.removeEventListener('touchstart', playOnInteraction)
      }
    }
  }, [bgmUrl, isPlaying])

  const copyToClipboard = (text: string, type: 'address' | 'account' = 'account') => {
    navigator.clipboard.writeText(text)
    if (type === 'address') {
      toast.success("주소가 복사되었습니다.")
    } else {
      toast.success("계좌번호가 복사되었습니다.")
    }
  }

  const handleRsvpSubmit = async () => {
    if (!rsvpName) {
      toast.error("성함을 입력해주세요.")
      return
    }
    if (!rsvpPhone) {
      toast.error("연락처를 입력해주세요.")
      return
    }
    setIsSubmittingRsvp(true)

    const isMealSurvey = invitation.customStyles?.rsvpMealSurvey ?? (invitation.rsvpMealEnabled !== false);
    const mealOptions = invitation.customStyles?.rsvpMealOptions || ['한식', '양식'];
    let totalMeals = 0;
    if (attendance === 'yes' && isMealSurvey) {
      mealOptions.forEach((opt: string) => {
        totalMeals += rsvpMealInfo[opt] || 0;
      });
      if (totalMeals > guestCount) {
        toast.error(`식사 선택 수량 합(${totalMeals}개)이 동행인 수(${guestCount}명)를 초과할 수 없습니다.`);
        setIsSubmittingRsvp(false);
        return;
      }
    }

    const newRsvp = {
      id: 'rsvp-' + Math.random().toString(36).substring(2, 9),
      invitationId: id,
      name: rsvpName,
      phone: rsvpPhone,
      attendance: attendance,
      side: rsvpSide,
      guestCount: attendance === 'yes' ? guestCount : 0,
      mealType: (attendance === 'yes' && isMealSurvey) ? (mealType || 'korean') : 'none',
      shuttleUsed: attendance === 'yes' && invitation.customStyles?.rsvpShuttleSurvey ? (rsvpShuttleUsed === 'yes') : false,
      mealInfo: (attendance === 'yes' && isMealSurvey) ? rsvpMealInfo : {},
      message: (invitation.customStyles?.rsvpMessageSurvey ?? (invitation.rsvpCommentEnabled !== false)) ? rsvpMessage : '',
      createdAt: new Date().toISOString()
    }

    try {
      const { error } = await supabase.from('rsvps').insert(newRsvp)
      if (error) throw error

      toast.success("참석 의사가 정상적으로 전달되었습니다.")
      setShowRsvp(false)
      setRsvpName("")
      setRsvpPhone("")
      setRsvpMessage("")
      setRsvpMealInfo({})
    } catch (err: any) {
      console.error("RSVP insert error:", err)
      const localRsvpsKey = `rsvps_${id}`
      const existingLocal = JSON.parse(localStorage.getItem(localRsvpsKey) || '[]')
      localStorage.setItem(localRsvpsKey, JSON.stringify([newRsvp, ...existingLocal]))
      
      toast.success("참석 의사가 전달되었습니다. (로컬 저장)")
      setShowRsvp(false)
      setRsvpName("")
      setRsvpPhone("")
      setRsvpMessage("")
      setRsvpMealInfo({})
    } finally {
      setIsSubmittingRsvp(false)
    }
  }

  const handleAddComment = async () => {
    if (!newCommentName || !newCommentMessage) {
      toast.error("이름과 축하 메시지를 입력해주세요.")
      return
    }
    setIsSubmittingComment(true)
    const formattedDate = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/ /g, '').slice(0, -1) // e.g. 2026.06.03

    const newComment = {
      id: 'msg-' + Math.random().toString(36).substring(2, 9),
      invitationId: id,
      name: newCommentName,
      message: newCommentMessage,
      createdAt: formattedDate
    }

    try {
      const { error } = await supabase.from('guestbook').insert(newComment)
      if (error) throw error

      setGuestbookMessages([newComment, ...guestbookMessages])
      setGuestbookPage(0)
      setNewCommentName("")
      setNewCommentMessage("")
      setShowCommentModal(false)
      toast.success("축하 메시지가 등록되었습니다!")
    } catch (err: any) {
      console.error("Guestbook insert error:", err)
      if (err.code === 'PGRST205' || err.message?.includes('relation') || err.message?.includes('not exist')) {
        const localCommentsKey = `guestbook_comments_${id}`
        const localComment = {
          ...newComment,
          id: 'msg-local-' + Math.random().toString(36).substring(2, 9),
        }
        const existingLocal = JSON.parse(localStorage.getItem(localCommentsKey) || '[]')
        const updatedLocal = [localComment, ...existingLocal]
        localStorage.setItem(localCommentsKey, JSON.stringify(updatedLocal))
        
        setGuestbookMessages(updatedLocal)
        setGuestbookPage(0)
        setNewCommentName("")
        setNewCommentMessage("")
        setShowCommentModal(false)
        toast.success("축하 메시지가 등록되었습니다! (로컬 저장)")
      } else {
        toast.error("방명록 등록에 실패했습니다.")
      }
    } finally {
      setIsSubmittingComment(false)
    }
  }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center">
        <Logo className="h-5 w-auto text-[#8b7355] animate-pulse" />
        <p className="text-xs text-gray-400 mt-2">청첩장을 불러오는 중입니다...</p>
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center p-8 text-center">
        <p className="text-base text-gray-500">존재하지 않거나 삭제된 청첩장입니다.</p>
        <Button className="mt-4 bg-[#c4a574] text-white" onClick={() => window.close()}>
          닫기
        </Button>
      </div>
    )
  }

  const { year: calYear, month: calMonth, day: calDay, days: calDays } = getCalendarDays(invitation.weddingDate)

  // Determine theme colors and fonts dynamically
  const theme = themes.find(t => t.id === invitation?.themeId) || sampleThemes.find(t => t.id === invitation?.themeId) || sampleThemes[0]
  const colorSet = theme?.colorSets?.find((c: any) => c.id === invitation?.colorSet) || theme?.colorSets?.[0]
  const fontSet = theme?.fontSets?.find((f: any) => f.id === invitation?.fontSet) || theme?.fontSets?.[0]
  
  const themeStyles: any = {
    ...theme?.styles,
    ...(invitation?.customStyles || {})
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
    const activeColorSet = theme?.colorSets?.find((c: any) => c.id === invitation?.colorSet) || theme?.colorSets?.[0]
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

  // Dynamic style values
  const borderRadius = themeStyles.borderRadius || '8px'
  const sectionSpacing = themeStyles.sectionSpacing || 'py-16'
  const cardBg = themeStyles.cardBg || 'bg-white/40'
  const cardShadow = themeStyles.cardShadow || 'shadow-sm'
  const dividerType = themeStyles.dividerType || 'heart'
  const heroStyle = themeStyles.heroStyle || 'center'
  const heroConnector = themeStyles.heroConnector === 'none_clear' ? '&' : (themeStyles.heroConnector || '&')
  const accountLayout = themeStyles.accountLayout || '1col'

  const fontKr = invitation?.customStyles?.fontKr || fontSet?.fonts?.[0] || theme?.styles?.fontKr || 'font-serif'
  const fontEn = invitation?.customStyles?.fontEn || fontSet?.fonts?.[1] || theme?.styles?.fontEn || 'font-serif'

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

  const renderSectionHeader = (sectionId: string, defaultEn: string, defaultKr: string, extraMb = 'mb-8', px = '') => {
    const headerSettings = themeStyles.sectionHeaders?.[sectionId] || {}
    const show = headerSettings.show ?? true
    if (!show) return null

    const titleEn = headerSettings.titleEn !== undefined ? headerSettings.titleEn : defaultEn
    const titleKr = headerSettings.titleKr !== undefined ? headerSettings.titleKr : defaultKr
    const fontEnVal = headerSettings.fontEn || fontEn
    const fontKrVal = headerSettings.fontKr || fontKr
    const sizeEn = headerSettings.sizeEn ?? 24
    const sizeKr = headerSettings.sizeKr ?? 10
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
            "tracking-[0.2em] uppercase mt-2 font-sans",
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
    <div className={cn("min-h-screen", fontClass)} style={{ backgroundColor: bgColor, fontFamily: getFontFamily(fontKr, fontEn) }}>
      {/* Music Toggle */}
      {bgmUrl && (
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/80 backdrop-blur shadow-lg flex items-center justify-center border border-gray-200 hover:bg-white transition-colors"
        >
          {isPlaying ? <Pause className="w-4 h-4 text-[#c4a574]" /> : <Music className="w-4 h-4 text-gray-500" />}
        </button>
      )}

      {/* Main Content */}
      <div className={cn("max-w-md mx-auto relative shadow-md min-h-screen", isDuotone ? "" : "pb-12")} style={{ backgroundColor: bgColor, color: textColor }}>
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

        {(sectionOrder as string[]).map((sectionId: string, idx: number) => {
          const isMinimal = theme.layout === 'minimal'
          const isGrid = theme.layout === 'grid'
          const isTwoColumn = theme.layout === 'two-column'

          const borderStyle = { borderRadius: isGrid ? '0px' : borderRadius }
          const shadowClass = isMinimal ? 'shadow-none' : cardShadow
          
          let spacingClass = sectionSpacing
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

          const sectionImages: { url: string; caption?: string }[] = (invitation?.customStyles?.sectionImages?.[sectionId] || [])

          const sectionElement = (() => { switch (sectionId) {
            case 'hero':
              const heroInfoFont = themeStyles.heroInfoFont || fontEn
              const heroInfoGroomBrideSize = parseInt(themeStyles.heroInfoGroomBrideSize?.toString() || '16')
              const heroInfoDetailsSize = parseInt(themeStyles.heroInfoDetailsSize?.toString() || '11')
              if (isConcept5) {
                let formattedDate = 'MAY 7, 2028'
                if (invitation?.weddingDate) {
                  try {
                    const d = new Date(invitation.weddingDate + 'T00:00:00')
                    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
                    formattedDate = `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
                  } catch (e) {}
                }

                const timeStr = invitation?.weddingTime || '11:00 AM'
                const venueStr = invitation?.venueName || 'VOW SEOUL GRAND HALL'
                const groomEn = invitation?.groomNameEn || 'Sunghoon'
                const brideEn = invitation?.brideNameEn || 'Jihye'

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
                        {invitation?.mainImage ? (
                          <img
                            src={invitation.mainImage}
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
                if (invitation?.weddingDate) {
                  try {
                    const d = new Date(invitation.weddingDate + 'T00:00:00')
                    dateStr = format(d, 'yyyy. MM. dd (EEEE)', { locale: ko })
                  } catch (e) {}
                }

                const heroFont = themeStyles.heroSubtitleFont || 'Kaushan Script'
                
                return (
                  <div 
                    key="hero" 
                    className="relative h-[640px] flex flex-col justify-between text-center overflow-hidden pb-12"
                    style={{ backgroundColor: '#9EB7CE', color: '#FFFFFF' }}
                  >
                    {/* Background Visual */}
                    {invitation?.mainImage ? (
                      <img
                        src={invitation.mainImage}
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
                        <span>{invitation?.groomName || '김혁'}</span>
                        <span className="opacity-60 text-xs italic font-serif">&amp;</span>
                        <span>{invitation?.brideName || '김민주'}</span>
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
                        <p className="mt-0.5">{invitation?.weddingTime || '오후 5시'} | {invitation?.venueName || '춘천 스카이컨벤션 4층 스카이홀'}</p>
                      </div>
                    </div>
                  </div>
                )
              }

              if (isDuotone) {
                const subtitleText = themeStyles.heroSubtitleText || 'save the date'
                const subtitleFont = themeStyles.heroSubtitleFont || fontEn
                const subtitleSize = themeStyles.heroSubtitleSize || 24 // slightly larger for full screen
                const subtitleStyle = {
                  fontFamily: getFontFamily(fontKr, subtitleFont),
                  fontSize: `${subtitleSize}px`,
                  letterSpacing: '0.2em'
                }
                
                const getHeroDateString = () => {
                  if (!invitation?.weddingDate) return 'MAY 7, 2026 11 AM'
                  try {
                    const d = new Date(invitation.weddingDate + 'T' + (invitation.weddingTime || '12:00') + ':00')
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
                    return invitation.weddingDate
                  }
                }

                return (
                  <div 
                    key="hero" 
                    className="relative h-screen flex flex-col items-center justify-between text-center px-8 py-16 overflow-hidden"
                    style={{ ...sectColors.bgStyle, ...sectColors.textStyle }}
                  >
                    {/* Subtitle */}
                    <div style={subtitleStyle} className="mt-4 uppercase tracking-[0.2em] font-light">
                      {subtitleText}
                    </div>
                    
                    {/* Foreground Main Image */}
                    {invitation?.mainImage ? (
                      <div className="w-[220px] h-[300px] my-6 overflow-hidden border border-current/10 shadow-md animate-fade-in">
                        <img
                          src={invitation.mainImage}
                          alt="Main Visual"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-[220px] h-[300px] my-6 flex items-center justify-center border border-dashed border-current/30 bg-current/5">
                        <span className="text-xs opacity-40">사진을 등록해주세요</span>
                      </div>
                    )}
                    
                    {/* Groom & Bride names */}
                    <div 
                      className="flex items-center justify-center gap-6 text-lg font-light tracking-wide mt-2"
                      style={{
                        fontFamily: getFontFamily(fontKr, heroInfoFont),
                        fontSize: `${heroInfoGroomBrideSize}px`
                      }}
                    >
                      <span>{invitation?.groomName || '신랑'}</span>
                      <span className="opacity-60 text-sm font-serif">&amp;</span>
                      <span>{invitation?.brideName || '신부'}</span>
                    </div>
                    
                    {/* Details */}
                    <div 
                      className="space-y-1 opacity-85 text-xs tracking-wide pt-4 border-t border-current/10 w-full max-w-[240px] mx-auto mb-4"
                      style={{
                        fontFamily: getFontFamily(fontKr, heroInfoFont),
                        fontSize: `${heroInfoDetailsSize}px`
                      }}
                    >
                      <p className="uppercase truncate">
                        {invitation?.venueName || 'VOW SEOUL GRAND HALL'}
                      </p>
                      <p>
                        {getHeroDateString()}
                      </p>
                    </div>
                    
                    <div className="animate-float">
                      <ChevronDown className="w-6 h-6 opacity-55" style={{ color: sectColors.accent }} />
                    </div>
                  </div>
                )
              }

              return (
                <div key="hero" className="relative h-screen flex flex-col items-center justify-center text-center px-8 overflow-hidden" style={{ ...sectColors.bgStyle, ...sectColors.textStyle }}>
                  {invitation.mainImage && (
                    <div className="absolute inset-0 z-0">
                      <img
                        src={invitation.mainImage}
                        alt="Main Visual"
                        className="w-full h-full object-cover opacity-20"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t" style={{ backgroundImage: `linear-gradient(to top, ${bgColor}, transparent, ${bgColor}80)` }} />
                    </div>
                  )}
                  <div className="space-y-6 z-10 w-full max-w-[280px] mx-auto">
                    <p className="text-sm tracking-[0.3em] opacity-60">WEDDING INVITATION</p>
                    
                    {heroStyle === 'left' ? (
                      <div className="space-y-4 text-left px-4 w-full">
                        <div className="space-y-1">
                          {invitation.groomParentRelation && (
                            <p className="text-xs opacity-75">
                              {formatParentRelation(
                                invitation.groomParentRelation,
                                invitation.customStyles?.groomParentNames,
                                invitation.customStyles?.groomParentRelationText
                              )}
                            </p>
                          )}
                          <h1 
                            className="text-3xl font-light tracking-wide"
                            style={{
                              fontFamily: getFontFamily(fontKr, heroInfoFont),
                              fontSize: `${heroInfoGroomBrideSize}px`
                            }}
                          >
                            {invitation.groomName}
                          </h1>
                        </div>
                        {heroConnector !== 'none' && <div className="text-xl font-light opacity-60" style={{ color: accentColor }}>{heroConnector}</div>}
                        <div className="space-y-1">
                          {invitation.brideParentRelation && (
                            <p className="text-xs opacity-75">
                              {formatParentRelation(
                                invitation.brideParentRelation,
                                invitation.customStyles?.brideParentNames,
                                invitation.customStyles?.brideParentRelationText
                              )}
                            </p>
                          )}
                          <h1 
                            className="text-3xl font-light tracking-wide"
                            style={{
                              fontFamily: getFontFamily(fontKr, heroInfoFont),
                              fontSize: `${heroInfoGroomBrideSize}px`
                            }}
                          >
                            {invitation.brideName}
                          </h1>
                        </div>
                      </div>
                    ) : heroStyle === 'classic' ? (
                      <div className="space-y-4 text-center w-full">
                        <h1 
                          className="text-4xl font-light tracking-widest uppercase"
                          style={{
                            fontFamily: getFontFamily(fontKr, heroInfoFont),
                            fontSize: `${heroInfoGroomBrideSize * 1.2}px`
                          }}
                        >
                          {invitation.groomNameEn || 'GROOM'}
                          {heroConnector !== 'none' && <span className="block text-base opacity-55 my-1" style={{ color: accentColor }}>{heroConnector}</span>}
                          {invitation.brideNameEn || 'BRIDE'}
                        </h1>
                        <div className="w-12 h-px bg-current opacity-30 mx-auto" />
                        <p 
                          className="text-sm tracking-wide"
                          style={{
                            fontFamily: getFontFamily(fontKr, heroInfoFont),
                            fontSize: `${heroInfoGroomBrideSize}px`
                          }}
                        >
                          {invitation.groomName} · {invitation.brideName}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          {invitation.groomParentRelation && (
                            <p className="text-xs opacity-75">
                              {formatParentRelation(
                                invitation.groomParentRelation,
                                invitation.customStyles?.groomParentNames,
                                invitation.customStyles?.groomParentRelationText
                              )}
                            </p>
                          )}
                          <h1 
                            className="text-3xl font-light tracking-wide"
                            style={{
                              fontFamily: getFontFamily(fontKr, heroInfoFont),
                              fontSize: `${heroInfoGroomBrideSize}px`
                            }}
                          >
                            {invitation.groomName}
                          </h1>
                        </div>
                        {heroConnector !== 'none' && <div className="text-xl font-light opacity-60 font-light" style={{ color: accentColor }}>{heroConnector}</div>}
                        <div className="space-y-1">
                          {invitation.brideParentRelation && (
                            <p className="text-xs opacity-75">
                              {formatParentRelation(
                                invitation.brideParentRelation,
                                invitation.customStyles?.brideParentNames,
                                invitation.customStyles?.brideParentRelationText
                              )}
                            </p>
                          )}
                          <h1 
                            className="text-3xl font-light tracking-wide"
                            style={{
                              fontFamily: getFontFamily(fontKr, heroInfoFont),
                              fontSize: `${heroInfoGroomBrideSize}px`
                            }}
                          >
                            {invitation.brideName}
                          </h1>
                        </div>
                      </div>
                    )}

                    <div 
                      className="space-y-1 opacity-80 text-sm pt-4 border-t border-current/10"
                      style={{
                        fontFamily: getFontFamily(fontKr, heroInfoFont),
                        fontSize: `${heroInfoDetailsSize}px`
                      }}
                    >
                      <p>
                        {invitation.weddingDate ? (
                          format(new Date(invitation.weddingDate + 'T00:00:00'), 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })
                        ) : ''}
                      </p>
                      <p>{invitation.weddingTime}</p>
                      <p>{invitation.venueName}{invitation.venueHall ? ' ' + invitation.venueHall : ''}</p>
                    </div>
                  </div>
                  <div className="absolute bottom-8 animate-float z-10">
                    <ChevronDown className="w-6 h-6" style={{ color: accentColor }} />
                  </div>
                </div>
              )

            case 'greeting':
              if (isConcept5) {
                const parsedGroom = parseIndividualParents(invitation?.groomParentRelation || '')
                const parsedBride = parseIndividualParents(invitation?.brideParentRelation || '')

                const groomFather = invitation?.customStyles?.groomFatherName || parsedGroom.fatherName || '박태수'
                const groomMother = invitation?.customStyles?.groomMotherName || parsedGroom.motherName || '선우명희'
                const brideFather = invitation?.customStyles?.brideFatherName || parsedBride.fatherName || '이훈'
                const brideMother = invitation?.customStyles?.brideMotherName || parsedBride.motherName || '최현숙'

                return (
                  <section 
                    key="greeting" 
                    className="relative pb-16 pt-0 text-center overflow-hidden bg-[#EFD0D0] text-white animate-fade-in"
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
                      {invitation?.invitationMessage || 
                       '사랑으로 하나 된 두 사람이\n서로를 이해하며 한 길을 걸어가려 합니다.\n귀한 발걸음으로 저희의 출발을\n함께 축복해 주시기 바랍니다.'}
                    </div>

                    {/* Profile Photos */}
                    <div className="flex gap-4 justify-center items-center my-10 px-4">
                      <div className="w-[140px] h-[140px] bg-white/20 overflow-hidden shadow-inner border border-white/10 rounded-sm">
                        {invitation?.customStyles?.groomImage ? (
                          <img
                            src={invitation.customStyles.groomImage}
                            alt="Groom Profile"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] opacity-60">신랑 사진</div>
                        )}
                      </div>
                      <div className="w-[140px] h-[140px] bg-white/20 overflow-hidden shadow-inner border border-white/10 rounded-sm">
                        {invitation?.customStyles?.brideImage ? (
                          <img
                            src={invitation.customStyles.brideImage}
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
                          <h3 className="text-[21px] font-medium">{invitation?.groomName || '박성훈'}</h3>
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
                          <h3 className="text-[21px] font-medium">{invitation?.brideName || '이지혜'}</h3>
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
                    className="py-16 px-6 text-center animate-fade-in" 
                    style={{ backgroundColor: '#9EB7CE', color: '#FFFFFF' }}
                  >
                    {/* Parent Names Spaced */}
                    <div className="space-y-4 text-xs font-light max-w-[280px] mx-auto py-6 mb-8">
                      <div className="flex justify-between items-center">
                        <div className="text-left">
                          <span className="text-[9px] opacity-60 block tracking-widest font-mono">GROOM</span>
                          <span className="tracking-wide">
                            {formatParentRelation(
                              invitation?.groomParentRelation || '김태진 · 정혜선 의 아들',
                              invitation?.customStyles?.groomParentNames,
                              invitation?.customStyles?.groomParentRelationText
                            )}
                          </span>
                        </div>
                        <span className="text-base font-semibold tracking-wider w-16 text-left ml-4">{invitation?.groomName || '혁'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-left">
                          <span className="text-[9px] opacity-60 block tracking-widest font-mono">BRIDE</span>
                          <span className="tracking-wide">
                            {formatParentRelation(
                              invitation?.brideParentRelation || '김필래 · 이수윤 의 딸',
                              invitation?.customStyles?.brideParentNames,
                              invitation?.customStyles?.brideParentRelationText
                            )}
                          </span>
                        </div>
                        <span className="text-base font-semibold tracking-wider w-16 text-left ml-4">{invitation?.brideName || '민주'}</span>
                      </div>
                    </div>

                    {/* Divider */}
                    {renderDivider()}

                    {/* Greeting Message */}
                    <div className="leading-relaxed whitespace-pre-wrap text-sm tracking-wider font-light max-w-[300px] mx-auto opacity-95 mt-6">
                      {invitation?.invitationMessage || (
                        "여보, 우리는 등불 하나 켜서 삽시다.\n바람에 흔들리는 심지 등불이라도 켜서\n기름 졸이듯 마음을 다하여\n사랑하며 삽시다. 오래도록."
                      )}
                    </div>
                  </section>
                )
              }

              const greetingIconShape = invitation.customStyles?.greetingIconShape || 'heart'
              const greetingIconColor = invitation.customStyles?.greetingIconColor || accentColor
              const greetingIconCustomUrl = invitation.customStyles?.greetingIconCustomUrl
              const isGreetingCustomSvg = greetingIconCustomUrl?.toLowerCase().split('?')[0].endsWith('.svg') ?? false

              const renderGreetingIcon = () => {
                if (greetingIconShape === 'custom' && greetingIconCustomUrl) {
                  if (isGreetingCustomSvg) {
                    return (
                      <div 
                        className="w-6 h-6 mx-auto mb-6 opacity-60 pointer-events-none"
                        style={getSvgMaskStyle(greetingIconCustomUrl, greetingIconColor)}
                      />
                    )
                  } else {
                    return (
                      <img 
                        src={greetingIconCustomUrl} 
                        alt="custom greeting icon" 
                        className="w-6 h-6 mx-auto mb-6 object-contain opacity-80"
                      />
                    )
                  }
                }

                if (greetingIconShape === 'circle') {
                  return <Circle className="w-6 h-6 mx-auto mb-6 opacity-60" style={{ color: greetingIconColor }} />
                }
                if (greetingIconShape === 'star') {
                  return <Star className="w-6 h-6 mx-auto mb-6 opacity-60" style={{ color: greetingIconColor }} />
                }
                return <Heart className="w-6 h-6 mx-auto mb-6 opacity-60" style={{ color: greetingIconColor }} />
              }

              return (
                <section key="greeting" className={cn(spacingClass, "px-8 text-center", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                  {showDivider && renderDivider()}
                  {renderGreetingIcon()}
                  <p className="leading-relaxed whitespace-pre-line text-sm opacity-80 mb-6">
                    {invitation.invitationMessage || '초대의 말씀을 드립니다.'}
                  </p>
                </section>
              )

            case 'sequence':
              const sequenceEnabled = invitation?.customStyles?.sequenceEnabled ?? false
              if (!sequenceEnabled) return null
              const sequenceTitle = invitation?.customStyles?.sequenceTitle || '식순 안내'
              const sequenceSubtitle = invitation?.customStyles?.sequenceSubtitle || 'WEDDING ORDER'
              const sequenceEvents = invitation?.customStyles?.sequenceEvents || [
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
                    className="py-16 px-6 bg-[#EFD0D0] text-white text-center animate-fade-in"
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
                          <div className="w-[90px] py-3 text-center text-sm font-light text-white/90 border-r border-white/40 flex items-center justify-center font-mono">
                            {event.time}
                          </div>
                          {/* Event Title Column */}
                          <div className="flex-1 py-3 px-4 text-left text-sm text-white flex items-center">
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
                    className="py-16 px-6 bg-white animate-fade-in" 
                    style={{ color: '#000000' }}
                  >
                    {renderSectionHeader('sequence', sequenceSubtitle, sequenceTitle, 'mb-8')}
                    
                    <div className="max-w-[280px] mx-auto border-t border-b border-black">
                      {sequenceEvents.map((event: any, i: number) => (
                        <div 
                          key={event.id} 
                          className={cn(
                            "flex items-center text-sm py-3.5 px-2", 
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
                <section key="sequence" className={cn(spacingClass, "px-8", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                  {showDivider && renderDivider()}
                  {renderSectionHeader('sequence', sequenceTitle, '식순', 'mb-2')}
                  <p className="text-center text-sm opacity-40 mb-8">{sequenceSubtitle}</p>
                  
                  <div className="relative border-l border-current/15 ml-6 pl-8 space-y-6 text-left max-w-[280px] mx-auto">
                    {sequenceEvents.map((event: any) => (
                      <div key={event.id} className="relative">
                        <div className="absolute -left-[37.5px] top-1.5 w-3.5 h-3.5 rounded-full bg-current opacity-70 border-2 border-background" style={{ backgroundColor: sectColors.accent }} />
                        <div>
                          <span className="font-mono text-sm font-semibold" style={{ color: sectColors.accent }}>{event.time}</span>
                          <p className="text-sm font-medium mt-1">{event.title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )

            case 'gallery':
              if (isConcept5) {
                return (
                  <section 
                    key="gallery" 
                    className="py-16 px-0 bg-[#EFD0D0] text-white text-center overflow-hidden animate-fade-in"
                    style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
                  >
                    <h4 className="text-[18px] uppercase tracking-widest text-white/80" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>GALLERY</h4>
                    <h3 className="text-lg font-bold mt-1 mb-8" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>갤러리</h3>

                    <div className="w-full overflow-x-auto flex gap-4 snap-x scrollbar-hide pb-2 px-6">
                      {invitation.galleryImages.map((img: string, idx: number) => (
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

              if (!invitation.galleryImages || invitation.galleryImages.length === 0) return null
              const isSlide = invitation?.galleryViewType === 'slide'
              const galleryAlign = invitation?.customStyles?.galleryAlign || 'center'
              return (
                <section key="gallery" className={cn("w-full overflow-hidden", spacingClass, isSlide ? "px-0" : "px-8", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                  {showDivider && renderDivider()}
                  {renderSectionHeader('gallery', 'Gallery', '사진첩', 'mb-8', 'px-8')}
                  {isSlide ? (
                    <div className="flex gap-2 overflow-x-auto snap-x scrollbar-hide pb-2 px-8">
                      {invitation.galleryImages.map((img: string, idx: number) => (
                        <div key={idx} className={cn("w-[280px] h-[350px] flex-shrink-0 snap-center overflow-hidden bg-black/5 flex justify-center", galleryAlign === 'bottom' ? 'items-end' : 'items-center', shadowClass)} style={borderStyle}>
                          <img src={img} alt={`Gallery ${idx + 1}`} className="max-w-full max-h-full object-contain hover:scale-105 transition-transform duration-300" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={cn("grid gap-2", isTwoColumn ? "grid-cols-3" : "grid-cols-2")}>
                      {invitation.galleryImages.map((img: string, idx: number) => (
                        <div key={idx} className={cn("aspect-square overflow-hidden bg-black/10", shadowClass)} style={borderStyle}>
                          <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )

            case 'calendar':
              if (!invitation.weddingDate) return null
              const ddayEnabled = invitation.customStyles?.ddayEnabled ?? false

              if (isConcept5) {
                const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
                const d = invitation?.weddingDate ? new Date(invitation.weddingDate + 'T00:00:00') : new Date()
                const monthName = months[d.getMonth()]

                return (
                  <section 
                    key="calendar" 
                    className="py-16 px-6 bg-white text-[#D59B9B] text-center animate-fade-in"
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
                    className="py-16 px-6 animate-fade-in" 
                    style={{ backgroundColor: '#E8E8E8', color: '#000000' }}
                  >
                    {renderSectionHeader('calendar', 'Calendar', '소중한 날', 'mb-6')}
                    
                    <Card className="border-0 shadow-none bg-white rounded-none text-black">
                      <CardContent className="p-6">
                        <div className="text-center mb-6">
                          <p className="text-lg font-semibold text-[#62798E] font-mono tracking-widest uppercase">
                            {new Date(invitation.weddingDate).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
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
                              const shapeType = invitation.customStyles?.calendarDayShape || 'circle'
                              const customShapeUrl = invitation.customStyles?.calendarDayCustomShapeUrl
                              const highlightTextColor = invitation.customStyles?.calendarDayTextColor || '#ffffff'
                              
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
                                        style={getSvgMaskStyle(customShapeUrl, invitation.customStyles?.calendarDaySvgColor || '#526678')}
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
                <section key="calendar" className={cn(spacingClass, "px-8", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                  {showDivider && renderDivider()}
                  {renderSectionHeader('calendar', 'Calendar', '소중한 날', ddayEnabled ? 'mb-2' : 'mb-8')}
                  {ddayEnabled && (
                    <div 
                      className="text-center text-sm font-bold tracking-wider mb-6 animate-pulse" 
                      style={{ color: sectColors.accent }}
                    >
                      {getDDayString(invitation.weddingDate)}
                    </div>
                  )}
                  <Card className={cn("border-0 shadow-none", effectiveCardBg)} style={{ ...borderStyle, color: 'inherit' }}>
                    <CardContent className="p-6">
                      <div className="text-center mb-4">
                        <p className="text-2xl font-semibold" style={{ color: sectColors.accent }}>{calMonth}</p>
                        <p className="text-sm opacity-40">{calYear}</p>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-center text-sm">
                        {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                          <div key={day} className="py-2 opacity-55 font-semibold text-xs">{day}</div>
                        ))}
                        {calDays.map((day, i) => {
                          if (day === null) return <div key={`empty-${i}`} />
                          const isWeddingDay = day === calDay
                          
                          if (isWeddingDay) {
                            const shapeType = invitation.customStyles?.calendarDayShape || 'circle'
                            const customShapeUrl = invitation.customStyles?.calendarDayCustomShapeUrl
                            const highlightTextColor = invitation.customStyles?.calendarDayTextColor || '#ffffff'
                            
                            if (shapeType === 'custom' && customShapeUrl) {
                              const isSvg = customShapeUrl.toLowerCase().split('?')[0].endsWith('.svg')
                              return (
                                <div
                                  key={i}
                                  className="relative py-1 text-xs flex items-center justify-center w-8 h-8 mx-auto font-bold"
                                  style={{ color: highlightTextColor }}
                                >
                                  {isSvg ? (
                                    <div 
                                      className="absolute inset-0 w-full h-full z-0 pointer-events-none"
                                      style={getSvgMaskStyle(customShapeUrl, invitation.customStyles?.calendarDaySvgColor || sectColors.accent)}
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
                                  className="relative py-1 text-xs flex items-center justify-center w-8 h-8 mx-auto font-bold"
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
                                className="relative py-1 text-xs flex items-center justify-center w-8 h-8 mx-auto rounded-full font-bold"
                                style={{ backgroundColor: sectColors.accent, color: highlightTextColor }}
                              >
                                <span className="relative z-10">{day}</span>
                              </div>
                            )
                          }
                          
                          return (
                            <div
                              key={i}
                              className="py-1 text-xs flex items-center justify-center w-8 h-8 mx-auto text-center"
                              style={{ color: sectColors.secondaryTextColorVal }}
                            >
                              {day}
                            </div>
                          )
                        })}
                      </div>
                      <div className="mt-6 text-center text-xs opacity-80">
                        <p className="font-semibold text-sm" style={{ color: sectColors.accent }}>
                          {format(new Date(invitation.weddingDate + 'T00:00:00'), 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })}
                        </p>
                        <p className="text-sm mt-1">{invitation.weddingTime}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Duotone Countdown Timer */}
                  {isDuotone && (
                    <div className="mt-8 pt-8 border-t border-current/10 text-center space-y-4">
                      <p className="text-xs uppercase tracking-[0.15em] opacity-60">Days left</p>
                      <div className="flex items-center justify-center gap-8">
                        <div className="text-center">
                          <p className="text-[10px] uppercase tracking-wider opacity-50">Days</p>
                          <p className="text-2xl font-light font-mono mt-1">{timeLeft.days}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] uppercase tracking-wider opacity-50">Hours</p>
                          <p className="text-2xl font-light font-mono mt-1">{timeLeft.hours}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] uppercase tracking-wider opacity-50">Minutes</p>
                          <p className="text-2xl font-light font-mono mt-1">{timeLeft.minutes}</p>
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
                    className="py-16 px-6 bg-[#EFD0D0] text-white animate-fade-in"
                    style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
                  >
                    <h4 className="text-[18px] uppercase tracking-widest text-center text-white/80" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>LOCATION</h4>
                    <h3 className="text-lg font-bold text-center mt-1 mb-8" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>식장 위치</h3>

                    {/* White Address Card */}
                    <div 
                      className="bg-white p-6 text-center space-y-2 border border-white/10 shadow-[5px_5px_15px_rgba(0,0,0,0.05)] mb-6 cursor-pointer hover:bg-white/95 transition-colors"
                      onClick={() => {
                        if (invitation?.venueAddress) {
                          copyToClipboard(invitation.venueAddress, 'address')
                        }
                      }}
                    >
                      <h3 className="font-semibold text-base tracking-wide text-[#D76C6C]">{invitation?.venueName || 'VOW SEOUL GRAND HALL'}</h3>
                      <p className="text-xs text-[#D76C6C]/80">{invitation?.venueHall || '그랜드홀'}</p>
                      <p className="text-sm font-medium text-[#D76C6C] mt-2 whitespace-pre-line">{invitation?.venueAddress || '서울 강남구 학동로 1212'}</p>
                      <p className="text-[10px] text-[#D76C6C]/60 mt-1">터치하여 주소 복사</p>
                    </div>

                    {/* Map View */}
                    {invitation?.customStyles?.mapEnabled !== false && (
                      <div className="mb-6 px-0">
                        <NaverMap 
                          address={invitation?.venueAddress || '서울 강남구 학동로 1212'} 
                          venueName={invitation?.venueName || '웨딩홀'} 
                        />
                      </div>
                    )}

                    {/* Traffic & Parking Info */}
                    <div className="space-y-4 text-xs text-left text-white/90 leading-relaxed">
                      {invitation?.trafficInfo && (
                        <div>
                          <p className="font-semibold text-white">대중교통 안내</p>
                          <p className="whitespace-pre-line mt-1">{invitation.trafficInfo}</p>
                        </div>
                      )}
                      {invitation?.parkingInfo && (
                        <div>
                          <p className="font-semibold text-white">주차 안내</p>
                          <p className="whitespace-pre-line mt-1">{invitation.parkingInfo}</p>
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
                    className="py-16 px-6 animate-fade-in" 
                    style={{ backgroundColor: '#F2F2F2', color: '#000000' }}
                  >
                    {renderSectionHeader('location', 'Location', '식장 위치', 'mb-6')}
                    
                    {/* White Address Card */}
                    <div 
                      className="bg-white p-6 text-center space-y-2 border border-black/5 shadow-sm mb-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => {
                        if (invitation?.venueAddress) {
                          copyToClipboard(invitation.venueAddress, 'address')
                        }
                      }}
                    >
                      <h3 className="font-semibold text-lg tracking-wide">{invitation?.venueName || 'VOW SEOUL GRAND HALL'}</h3>
                      {invitation?.venueHall && (
                        <p className="text-sm text-[#526678] font-medium">{invitation.venueHall}</p>
                      )}
                      <p className="text-sm opacity-75 mt-1 whitespace-pre-line">{invitation?.venueAddress || '강남구 학동로 1212'}</p>
                    </div>

                    {/* Interactive Map & Navigation App Buttons */}
                    {invitation?.customStyles?.mapEnabled !== false && (
                      <div className="mb-6 px-4">
                        <NaverMap 
                          address={invitation?.venueAddress || '서울 강남구 학동로 1212'} 
                          venueName={invitation?.venueName || '웨딩홀'} 
                        />
                      </div>
                    )}

                    {/* Traffic & Parking guides */}
                    <div className="space-y-4 text-sm font-light text-left max-w-[280px] mx-auto">
                      {invitation?.parkingInfo && (
                        <div className="space-y-1">
                          <span className="font-semibold block text-[#62798E]">주차안내</span>
                          <p className="opacity-80 leading-relaxed whitespace-pre-line">{invitation.parkingInfo}</p>
                        </div>
                      )}
                      {invitation?.trafficInfo && (
                        <div className="space-y-1">
                          <span className="font-semibold block text-[#62798E]">대중교통</span>
                          <p className="opacity-80 leading-relaxed whitespace-pre-line">{invitation.trafficInfo}</p>
                        </div>
                      )}
                      {invitation?.customStyles?.shuttleEnabled && invitation?.customStyles?.shuttleInfo && (
                        <div className="space-y-1">
                          <span className="font-semibold block text-[#62798E]">셔틀버스</span>
                          <p className="opacity-80 leading-relaxed whitespace-pre-line">{invitation.customStyles.shuttleInfo}</p>
                        </div>
                      )}
                    </div>
                  </section>
                )
              }

              return (
                <section key="location" className={cn(spacingClass, "px-8", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                  {showDivider && renderDivider()}
                  {renderSectionHeader('location', 'Location', '오시는 길', 'mb-8')}
                  <Card 
                    className={cn("border-0", effectiveCardBg, shadowClass)} 
                    style={isDuotone ? { backgroundColor: color2, color: color1, borderRadius: borderStyle.borderRadius } : borderStyle}
                  >
                    <CardContent className="p-6 text-left space-y-4">
                      <div>
                        <h3 className="font-semibold text-base">{invitation.venueName}</h3>
                        {invitation.venueHall && <p className="text-base" style={{ color: isDuotone ? color1 : sectColors.accent }}>{invitation.venueHall}</p>}
                        <p className="text-sm mt-1 whitespace-pre-line" style={{ color: isDuotone ? `${color1}cc` : sectColors.secondaryTextColorVal }}>{invitation.venueAddress}</p>
                      </div>

                      {(invitation.trafficInfo || invitation.parkingInfo || invitation.customStyles?.subwayImage || invitation.customStyles?.parkingImage) && (
                        <div className="space-y-4 pt-4 border-t border-gray-100/10 text-sm">
                          {(invitation.trafficInfo || invitation.customStyles?.subwayImage) && (
                            <div>
                              <p className="font-semibold">교통 안내</p>
                              {invitation.trafficInfo && (
                                <p className="whitespace-pre-line mt-1 leading-relaxed" style={{ color: isDuotone ? `${color1}b3` : sectColors.secondaryTextColorVal }}>{invitation.trafficInfo}</p>
                              )}
                              {invitation.customStyles?.subwayImage && (
                                invitation.customStyles.subwayDisplayType === 'direct' ? (
                                  <div className="mt-2 rounded overflow-hidden bg-black/5 dark:bg-white/5 border border-border/50">
                                    <img 
                                      src={invitation.customStyles.subwayImage} 
                                      className="w-full h-auto cursor-pointer" 
                                      onClick={() => setActiveImageModal(invitation.customStyles.subwayImage)}
                                    />
                                  </div>
                                ) : (
                                  <button 
                                    type="button"
                                    onClick={() => setActiveImageModal(invitation.customStyles.subwayImage)}
                                    className="inline-flex items-center gap-1 mt-1 px-2.5 py-1 bg-black/5 dark:bg-white/5 border border-border/30 rounded text-sm font-medium hover:bg-black/10 transition-colors"
                                    style={{ color: isDuotone ? color1 : sectColors.accent }}
                                  >
                                    <Image className="w-3.5 h-3.5" />
                                    <span>{invitation.customStyles.subwayButtonText || '이미지 보기'}</span>
                                  </button>
                                )
                              )}
                            </div>
                          )}
                          {(invitation.parkingInfo || invitation.customStyles?.parkingImage) && (
                            <div>
                              <p className="font-semibold">주차 안내</p>
                              {invitation.parkingInfo && (
                                <p className="whitespace-pre-line mt-1 leading-relaxed" style={{ color: isDuotone ? `${color1}b3` : sectColors.secondaryTextColorVal }}>{invitation.parkingInfo}</p>
                              )}
                              {invitation.customStyles?.parkingImage && (
                                invitation.customStyles.parkingDisplayType === 'direct' ? (
                                  <div className="mt-2 rounded overflow-hidden bg-black/5 dark:bg-white/5 border border-border/50">
                                    <img 
                                      src={invitation.customStyles.parkingImage} 
                                      className="w-full h-auto cursor-pointer" 
                                      onClick={() => setActiveImageModal(invitation.customStyles.parkingImage)}
                                    />
                                  </div>
                                ) : (
                                  <button 
                                    type="button"
                                    onClick={() => setActiveImageModal(invitation.customStyles.parkingImage)}
                                    className="inline-flex items-center gap-1 mt-1 px-2.5 py-1 bg-black/5 dark:bg-white/5 border border-border/30 rounded text-xs font-medium hover:bg-black/10 transition-colors"
                                    style={{ color: isDuotone ? color1 : sectColors.accent }}
                                  >
                                    <Image className="w-3.5 h-3.5" />
                                    <span>{invitation.customStyles.parkingButtonText || '이미지 보기'}</span>
                                  </button>
                                )
                              )}
                            </div>
                          )}
                          {invitation?.customStyles?.shuttleEnabled && invitation?.customStyles?.shuttleInfo && (
                            <div className="pt-2">
                              <p className="font-semibold text-sm">셔틀버스 안내</p>
                              <p className="whitespace-pre-line mt-1 leading-relaxed text-sm" style={{ color: isDuotone ? `${color1}b3` : sectColors.secondaryTextColorVal }}>
                                {invitation.customStyles.shuttleInfo}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs opacity-60 hover:opacity-90"
                        style={isDuotone ? { color: color1, backgroundColor: 'transparent', borderRadius: borderStyle.borderRadius } : borderStyle}
                        onClick={() => copyToClipboard(invitation.venueAddress, 'address')}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        주소 복사
                      </Button>
                    </CardContent>
                  </Card>

                  {invitation?.customStyles?.mapEnabled !== false && (
                    <div className="mb-4 px-2">
                      <NaverMap 
                        address={invitation?.venueAddress || '서울 강남구 학동로 1212'} 
                        venueName={invitation?.venueName || '웨딩홀'} 
                      />
                    </div>
                  )}
                </section>
              )

            case 'contact':
              if (!invitation.contacts || invitation.contacts.length === 0) return null
              return (
                <section key="contact" className={cn(spacingClass, "px-8", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                  {showDivider && renderDivider()}
                  {renderSectionHeader('contact', 'Contact', '연락처', 'mb-8')}
                  <div className="grid grid-cols-2 gap-4">
                    {invitation.contacts.map((contact: any) => (
                      <Card key={contact.id} className={cn("border-0", effectiveCardBg, shadowClass)} style={{ ...borderStyle, color: 'inherit' }}>
                        <CardContent className="p-4 text-center">
                          <p className="text-xs mb-1" style={{ color: sectColors.secondaryTextColorVal }}>
                            {contact.relation === 'groom' ? '신랑' :
                             contact.relation === 'bride' ? '신부' :
                             contact.relation === 'groomParent' ? '신랑 혼주' :
                             contact.relation === 'brideParent' ? '신부 혼주' :
                             contact.relation}
                          </p>
                          <p className="font-semibold mb-3 text-sm truncate">{contact.name}</p>
                          <Button variant="outline" size="sm" className="w-full text-sm h-9" style={isDuotone ? { borderColor: `${color2}33`, color: color2, backgroundColor: 'transparent', borderRadius: borderStyle.borderRadius } : borderStyle} asChild>
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
            case 'account':
              if (!invitation.bankAccounts || invitation.bankAccounts.length === 0) return null
              const accountsList = invitation.bankAccounts || []
              const groomAccounts = accountsList.filter((acc: any) => acc.relation === 'groom' || acc.relation === 'groomParent')
              const brideAccounts = accountsList.filter((acc: any) => acc.relation === 'bride' || acc.relation === 'brideParent')

              if (isConcept5) {
                return (
                  <section 
                    key="account" 
                    className="py-16 px-6 bg-[#EFD0D0] text-white text-center animate-fade-in"
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
                            onClick={() => copyToClipboard(`${account.bank} ${account.accountNumber}`, 'account')}
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
                    className="py-16 px-6 bg-white animate-fade-in" 
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
                <section key="account" className={cn(spacingClass, "px-8", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                  {showDivider && renderDivider()}
                  {renderSectionHeader('account', 'Account', '마음 전하실 곳', 'mb-8')}
                  
                  {accountLayout === '2col' ? (
                    <div className="grid grid-cols-2 gap-3 text-left items-start">
                      <div className="space-y-2">
                        <div className="text-center text-[11px] font-semibold pb-1.5 border-b opacity-85" style={{ color: sectColors.accent, borderColor: `${sectColors.accent}20` }}>신랑측</div>
                        {groomAccounts.map((account: any) => (
                          <Card 
                            key={account.id} 
                            className={cn("border-0 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors shadow-sm", effectiveCardBg, shadowClass)} 
                            style={{ ...borderStyle, color: 'inherit' }}
                            onClick={() => copyToClipboard(`${account.bank} ${account.accountNumber}`)}
                          >
                            <CardContent className="p-2 px-2.5 text-left flex flex-col justify-center min-h-[44px] space-y-0.5">
                              <div className="flex justify-between items-center w-full text-[10px] leading-tight">
                                <span style={{ color: sectColors.secondaryTextColorVal }}>
                                  {account.relation === 'groom' ? '신랑' : '신랑 혼주'}
                                </span>
                                <span className="font-semibold truncate max-w-[65px]">{account.accountHolder}</span>
                              </div>
                              <div className="flex justify-between items-center w-full mt-0.5 text-[10px] leading-none">
                                <span className="font-mono truncate max-w-[95px]">{account.accountNumber}</span>
                                <span className="opacity-80 truncate max-w-[50px] text-[9.5px]" style={{ color: sectColors.secondaryTextColorVal }}>{account.bank}</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        {groomAccounts.length === 0 && (
                          <p className="text-center text-[10px] opacity-30 py-4">등록된 계좌 없음</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="text-center text-[11px] font-semibold pb-1.5 border-b opacity-85" style={{ color: sectColors.accent, borderColor: `${sectColors.accent}20` }}>신부측</div>
                        {brideAccounts.map((account: any) => (
                          <Card 
                            key={account.id} 
                            className={cn("border-0 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors shadow-sm", effectiveCardBg, shadowClass)} 
                            style={{ ...borderStyle, color: 'inherit' }}
                            onClick={() => copyToClipboard(`${account.bank} ${account.accountNumber}`)}
                          >
                            <CardContent className="p-2 px-2.5 text-left flex flex-col justify-center min-h-[44px] space-y-0.5">
                              <div className="flex justify-between items-center w-full text-[10px] leading-tight">
                                <span style={{ color: sectColors.secondaryTextColorVal }}>
                                  {account.relation === 'bride' ? '신부' : '신부 혼주'}
                                </span>
                                <span className="font-semibold truncate max-w-[65px]">{account.accountHolder}</span>
                              </div>
                              <div className="flex justify-between items-center w-full mt-0.5 text-[10px] leading-none">
                                <span className="font-mono truncate max-w-[95px]">{account.accountNumber}</span>
                                <span className="opacity-80 truncate max-w-[50px] text-[9.5px]" style={{ color: sectColors.secondaryTextColorVal }}>{account.bank}</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        {brideAccounts.length === 0 && (
                          <p className="text-center text-[10px] opacity-30 py-4">등록된 계좌 없음</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {accountsList.map((account: any) => (
                        <Card 
                          key={account.id} 
                          className={cn("border-0 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors shadow-sm", effectiveCardBg, shadowClass)} 
                          style={{ ...borderStyle, color: 'inherit' }}
                          onClick={() => copyToClipboard(`${account.bank} ${account.accountNumber}`)}
                        >
                          <CardContent className="p-4 text-left">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs" style={{ color: sectColors.secondaryTextColorVal }}>
                                  {account.relation === 'groom' && '신랑'}
                                  {account.relation === 'bride' && '신부'}
                                  {account.relation === 'groomParent' && '신랑 혼주'}
                                  {account.relation === 'brideParent' && '신부 혼주'}
                                </p>
                                <p className="font-semibold text-sm mt-1">{account.bank} {account.accountNumber}</p>
                                <p className="text-xs mt-0.5" style={{ color: sectColors.secondaryTextColorVal }}>예금주: {account.accountHolder}</p>
                              </div>
                              <div className="text-[11px] opacity-40 flex items-center justify-center">
                                <Copy className="w-4 h-4 opacity-70" />
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
              if (!invitation.rsvpEnabled) return null
              const isMealSurvey = invitation.customStyles?.rsvpMealSurvey ?? (invitation.rsvpMealEnabled !== false);
              const mealOptions = invitation.customStyles?.rsvpMealOptions || ['한식', '양식'];
              const totalSelectedMeals = Object.values(rsvpMealInfo).reduce((a, b) => a + b, 0);

              return (
                <section key="rsvp" className={cn(spacingClass, "px-8", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                  {showDivider && renderDivider()}
                  {renderSectionHeader('rsvp', 'RSVP', '참석 여부 알리기', 'mb-8')}
                  
                  <Dialog open={showRsvp} onOpenChange={setShowRsvp}>
                    <DialogTrigger asChild>
                      <Button className="w-full text-sm text-white animate-pulse" style={{ backgroundColor: sectColors.accent, color: isDuotone ? color2 : '#ffffff', ...borderStyle }}>
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        참석 의사 전달하기
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm bg-background border border-border p-6 rounded-lg shadow-lg max-h-[85vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>참석 여부 전달</DialogTitle>
                        <DialogDescription>참석 여부와 인원을 알려주세요</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-5 py-4 text-foreground">
                        {/* 1. 성함 */}
                        <div className="space-y-2">
                          <Label htmlFor="rsvp-name" className="text-sm font-semibold">성함</Label>
                          <Input id="rsvp-name" placeholder="성함을 입력해주세요" value={rsvpName} onChange={(e) => setRsvpName(e.target.value)} />
                        </div>

                        {/* 2. 연락처 */}
                        <div className="space-y-2">
                          <Label htmlFor="rsvp-phone" className="text-sm font-semibold">연락처</Label>
                          <Input id="rsvp-phone" placeholder="예: 010-0000-0000" value={rsvpPhone} onChange={(e) => setRsvpPhone(e.target.value)} />
                        </div>

                        {/* 3. 참석여부 */}
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">참석 여부</Label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className={cn(
                                "flex-1 py-2.5 text-center border rounded-lg text-sm transition-all font-medium",
                                attendance === "yes" 
                                  ? "border-primary bg-primary/5 text-primary" 
                                  : "border-border hover:bg-muted/50 text-muted-foreground"
                              )}
                              onClick={() => setAttendance("yes")}
                            >
                              참석
                            </button>
                            <button
                              type="button"
                              className={cn(
                                "flex-1 py-2.5 text-center border rounded-lg text-sm transition-all font-medium",
                                attendance === "no" 
                                  ? "border-primary bg-primary/5 text-primary" 
                                  : "border-border hover:bg-muted/50 text-muted-foreground"
                              )}
                              onClick={() => setAttendance("no")}
                            >
                              불참
                            </button>
                          </div>
                        </div>

                        {/* 참석인 경우에만 추가 문항들을 부드럽게 노출 */}
                        {attendance === "yes" && (
                          <div className="space-y-5 pt-3 border-t border-border/40 animate-fade-in">
                            {/* 4. 참여 구분 */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold">참여 구분</Label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className={cn(
                                    "flex-1 py-2.5 text-center border rounded-lg text-sm transition-all font-medium",
                                    rsvpSide === "groom" 
                                      ? "border-primary bg-primary/5 text-primary" 
                                      : "border-border hover:bg-muted/50 text-muted-foreground"
                                  )}
                                  onClick={() => setRsvpSide("groom")}
                                >
                                  신랑측
                                </button>
                                <button
                                  type="button"
                                  className={cn(
                                    "flex-1 py-2.5 text-center border rounded-lg text-sm transition-all font-medium",
                                    rsvpSide === "bride" 
                                      ? "border-primary bg-primary/5 text-primary" 
                                      : "border-border hover:bg-muted/50 text-muted-foreground"
                                  )}
                                  onClick={() => setRsvpSide("bride")}
                                >
                                  신부측
                                </button>
                              </div>
                            </div>

                            {/* 5. 동행인 수 */}
                            <div className="flex items-center justify-between border border-border/80 rounded-lg p-2.5 bg-muted/20">
                              <span className="text-xs font-semibold text-muted-foreground">동행인 수 (본인 포함)</span>
                              <div className="flex items-center gap-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="w-7 h-7 rounded-full text-foreground"
                                  disabled={guestCount <= 1}
                                  onClick={() => setGuestCount(prev => Math.max(1, prev - 1))}
                                >
                                  -
                                </Button>
                                <span className="text-sm font-bold w-6 text-center">{guestCount}명</span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="w-7 h-7 rounded-full text-foreground"
                                  disabled={guestCount >= 10}
                                  onClick={() => setGuestCount(prev => Math.min(10, prev + 1))}
                                >
                                  +
                                </Button>
                              </div>
                            </div>

                            {/* 6. 식사 여부 */}
                            {isMealSurvey && (
                              <div className="space-y-2">
                                <Label className="text-sm font-semibold">식사 여부</Label>
                                <div className="space-y-2 bg-muted/20 rounded-lg p-3 border border-border/50">
                                  {mealOptions.map((opt: string) => {
                                    const currentQty = rsvpMealInfo[opt] || 0;
                                    return (
                                      <div key={opt} className="flex items-center justify-between py-1">
                                        <span className="text-xs font-medium text-muted-foreground">{opt}</span>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="w-6 h-6 rounded-md text-foreground"
                                            disabled={currentQty <= 0}
                                            onClick={() => {
                                              setRsvpMealInfo(prev => ({
                                                ...prev,
                                                [opt]: Math.max(0, currentQty - 1)
                                              }));
                                            }}
                                          >
                                            -
                                          </Button>
                                          <span className="text-xs font-semibold w-5 text-center">{currentQty}개</span>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="w-6 h-6 rounded-md text-foreground"
                                            disabled={totalSelectedMeals >= guestCount}
                                            onClick={() => {
                                              setRsvpMealInfo(prev => ({
                                                ...prev,
                                                [opt]: (prev[opt] || 0) + 1
                                              }));
                                            }}
                                          >
                                            +
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  <div className="text-[10px] text-muted-foreground mt-1 text-right">
                                    선택 수량: {totalSelectedMeals} / {guestCount} 개
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 7. 셔틀 사용 여부 */}
                            {invitation.customStyles?.rsvpShuttleSurvey && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-semibold">셔틀 버스 사용</Label>
                                </div>
                                {invitation.customStyles?.rsvpShuttleInfo && (
                                  <p className="text-[10px] text-muted-foreground bg-secondary/50 p-2 rounded-md leading-relaxed mb-1.5 whitespace-pre-line border border-border/30">
                                    {invitation.customStyles.rsvpShuttleInfo}
                                  </p>
                                )}
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className={cn(
                                      "flex-1 py-2.5 text-center border rounded-lg text-sm transition-all font-medium",
                                      rsvpShuttleUsed === "yes" 
                                        ? "border-primary bg-primary/5 text-primary" 
                                        : "border-border hover:bg-muted/50 text-muted-foreground"
                                    )}
                                    onClick={() => setRsvpShuttleUsed("yes")}
                                  >
                                    사용함
                                  </button>
                                  <button
                                    type="button"
                                    className={cn(
                                      "flex-1 py-2.5 text-center border rounded-lg text-sm transition-all font-medium",
                                      rsvpShuttleUsed === "no" 
                                        ? "border-primary bg-primary/5 text-primary" 
                                        : "border-border hover:bg-muted/50 text-muted-foreground"
                                    )}
                                    onClick={() => setRsvpShuttleUsed("no")}
                                  >
                                    사용안함
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 8. 축하 메세지 */}
                        {(invitation.customStyles?.rsvpMessageSurvey ?? (invitation.rsvpCommentEnabled !== false)) && (
                          <div className="space-y-2">
                            <Label htmlFor="rsvp-msg" className="text-sm font-semibold">축하 메시지 (선택)</Label>
                            <Textarea id="rsvp-msg" placeholder="축하 메시지를 남겨주세요" rows={3} value={rsvpMessage} onChange={(e) => setRsvpMessage(e.target.value)} />
                          </div>
                        )}
                      </div>
                      <Button className="w-full text-white" style={{ backgroundColor: sectColors.accent, color: isDuotone ? color2 : '#ffffff', ...borderStyle }} onClick={handleRsvpSubmit} disabled={isSubmittingRsvp}>
                        {isSubmittingRsvp ? "전송 중..." : "전송하기"}
                      </Button>
                    </DialogContent>
                  </Dialog>
                </section>
              )

            case 'guestbook':
              if (invitation.guestbookType === 'none' || invitation.guestbookType === undefined) return null
              const visibleMessages = guestbookMessages.filter((comment: any) => comment.is_visible !== false)
              const PAGE_SIZE = 5
              const totalPages = Math.ceil(visibleMessages.length / PAGE_SIZE)
              const pagedMessages = visibleMessages.slice(guestbookPage * PAGE_SIZE, (guestbookPage + 1) * PAGE_SIZE)

              return (
                <section key="guestbook" className={cn(spacingClass, "px-8", sectionBg, sectionBorderClass)} style={{ ...sectColors.bgStyle, ...sectColors.textStyle, ...(isGrid ? borderStyle : undefined) }}>
                  {showDivider && renderDivider()}
                  {renderSectionHeader('guestbook', 'Guestbook', '방명록', 'mb-8')}
                  <div className="space-y-4 text-left">
                    {visibleMessages.length === 0 ? (
                      <p className="text-center text-sm opacity-40 py-6">남겨진 축하 메시지가 없습니다. 첫 메시지를 남겨보세요!</p>
                    ) : (
                      pagedMessages.map((comment) => (
                        <Card key={comment.id} className={cn("border-0 shadow-sm", effectiveCardBg, shadowClass)} style={{ ...borderStyle, color: 'inherit' }}>
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

                  {visibleMessages.length > PAGE_SIZE && (
                    <div className="flex items-center justify-center gap-6 mt-6 text-sm">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 rounded-full border border-current/10 text-muted-foreground hover:text-foreground"
                        disabled={guestbookPage === 0}
                        onClick={() => setGuestbookPage(p => p - 1)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-xs font-semibold tracking-wider opacity-60">
                        {guestbookPage + 1} / {totalPages}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 rounded-full border border-current/10 text-muted-foreground hover:text-foreground"
                        disabled={guestbookPage >= totalPages - 1}
                        onClick={() => setGuestbookPage(p => p + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  
                  <Dialog open={showCommentModal} onOpenChange={setShowCommentModal}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full mt-4 border-current/30" style={isDuotone ? { borderColor: `${color1}33`, color: color1, backgroundColor: 'transparent', borderRadius: borderStyle.borderRadius } : borderStyle}>
                        축하 메시지 남기기
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm bg-background border border-border p-6 rounded-lg shadow-lg">
                      <DialogHeader>
                        <DialogTitle>축하 메시지 남기기</DialogTitle>
                        <DialogDescription>신랑 신부에게 축하의 메시지를 남겨주세요.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="guestbook-name">이름</Label>
                          <Input id="guestbook-name" placeholder="이름을 입력해주세요" value={newCommentName} onChange={(e) => setNewCommentName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="guestbook-msg">축하 메시지</Label>
                          <Textarea id="guestbook-msg" placeholder="축하 메시지를 작성해주세요" rows={4} value={newCommentMessage} onChange={(e) => setNewCommentMessage(e.target.value)} />
                        </div>
                      </div>
                      <Button className="w-full text-white" style={{ backgroundColor: sectColors.accent, color: isDuotone ? color2 : '#ffffff', ...borderStyle }} onClick={handleAddComment} disabled={isSubmittingComment}>
                        {isSubmittingComment ? "등록 중..." : "등록하기"}
                      </Button>
                    </DialogContent>
                  </Dialog>
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
                    <div key={imgIdx} className={cn("w-full overflow-hidden", imgIdx > 0 ? 'pt-4' : '')}>
                      <img
                        src={img.url}
                        alt={img.caption || `section image ${imgIdx + 1}`}
                        className="w-full h-auto object-cover block"
                      />
                      {img.caption && (
                        <p className="text-center text-xs opacity-50 py-2 px-4">{img.caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </React.Fragment>
          )
        })}

        {/* Share Section */}
        <section className="py-12 px-8 text-center bg-transparent" style={isDuotone ? { backgroundColor: color2, color: color1 } : undefined}>
          <Button variant="ghost" className={cn("text-xs gap-1.5 hover:bg-transparent", isDuotone ? "text-current opacity-70 hover:opacity-100" : "text-muted-foreground opacity-60 hover:opacity-100")} onClick={() => {
            navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.href : '');
            toast.success("청첩장 주소가 복사되었습니다.");
          }}>
            <Share2 className="w-3.5 h-3.5" />
            청첩장 주소 복사하기
          </Button>
        </section>

        {/* Footer */}
        <footer className="py-8 px-8 text-center text-xs flex flex-col items-center justify-center" style={isDuotone ? { backgroundColor: color2, color: color1 } : undefined}>
          <Logo className={cn("h-3.5 w-auto text-current", isDuotone ? "opacity-60" : "opacity-30")} />
        </footer>
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
