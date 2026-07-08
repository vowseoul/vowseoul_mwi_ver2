'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Logo } from '@/components/logo'
import { 
  Users, 
  Calendar, 
  MessageSquare, 
  Download, 
  Trash2, 
  ArrowLeft, 
  ShieldAlert,
  Loader2,
  CalendarDays,
  Utensils,
  Bus
} from 'lucide-react'
import { toast } from 'sonner'

interface RSVP {
  id: string
  name: string
  phone?: string
  attendance: string
  side?: string // 'groom' | 'bride'
  guestCount: number
  mealType?: string
  shuttleUsed?: boolean
  mealInfo?: Record<string, number>
  message?: string
  createdAt: string
}

interface GuestbookMessage {
  id: string
  name: string
  message: string
  is_visible: boolean
  createdAt: string
}

interface VisitorLog {
  id: string
  visitedDate: string
  visitedAt: string
}

export default function CustomerDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const invitationId = params.id as string

  const [invitation, setInvitation] = useState<any>(null)
  const [rsvps, setRsvps] = useState<RSVP[]>([])
  const [guestbook, setGuestbook] = useState<GuestbookMessage[]>([])
  const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [isDataPurged, setIsDataPurged] = useState(false)
  const [isDashboardExpired, setIsDashboardExpired] = useState(false)

  // 1. Load Data
  const loadDashboardData = async () => {
    try {
      setIsLoading(true)

      // 1-1. Fetch Invitation Info
      const { data: invite, error: inviteErr } = await supabase
        .from('invitations')
        .select('*')
        .eq('id', invitationId)
        .single()

      if (inviteErr || !invite) {
        throw new Error('청첩장 정보를 찾을 수 없습니다.')
      }

      // Fetch Customer Name from Orders table
      let customerName = ''
      try {
        const { data: orderData } = await supabase
          .from('orders')
          .select('customerName')
          .eq('invitationId', invitationId)
          .single()
        if (orderData) {
          customerName = orderData.customerName
        }
      } catch (e) {
        console.warn('Failed to fetch order customerName, fallback to groom/bride:', e)
      }

      setInvitation({ ...invite, customerName })

      // 1-2. Expiry Policy Validation (예식일 기준 만료 검증)
      if (invite.weddingDate) {
        const wedding = new Date(invite.weddingDate + 'T00:00:00')
        const today = new Date()
        wedding.setHours(0, 0, 0, 0)
        today.setHours(0, 0, 0, 0)
        
        const diffTime = today.getTime() - wedding.getTime()
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

        if (diffDays >= 14) {
          // 예식일 기준 14일 초과: 데이터 파기 정책 실행
          setIsDataPurged(true)
          setIsDashboardExpired(true)
          await purgeAllCollectedData()
          setIsLoading(false)
          return
        } else if (diffDays >= 7) {
          // 예식일 기준 7일 초과: 대시보드 접속 만료
          setIsDashboardExpired(true)
          setIsLoading(false)
          return
        }
      }

      // 1-3. Fetch RSVPs
      const { data: rsvpsData } = await supabase
        .from('rsvps')
        .select('*')
        .eq('invitationId', invitationId)
        .order('createdAt', { ascending: false })

      let finalRsvps = rsvpsData || []
      if (finalRsvps.length === 0) {
        finalRsvps = JSON.parse(localStorage.getItem(`rsvps_${invitationId}`) || '[]')
      }
      setRsvps(finalRsvps)

      // 1-4. Fetch Guestbook Messages
      const { data: gbData } = await supabase
        .from('guestbook')
        .select('*')
        .eq('invitationId', invitationId)
        .order('createdAt', { ascending: false })

      let finalGb = gbData || []
      if (finalGb.length === 0) {
        finalGb = JSON.parse(localStorage.getItem(`guestbook_comments_${invitationId}`) || '[]')
      }
      setGuestbook(finalGb)

      // 1-5. Fetch Visitor Logs
      const { data: vlogsData } = await supabase
        .from('visitor_logs')
        .select('*')
        .eq('invitationId', invitationId)
        .order('visitedAt', { ascending: false })

      let finalVlogs = vlogsData || []
      if (finalVlogs.length === 0) {
        finalVlogs = JSON.parse(localStorage.getItem(`visitor_logs_${invitationId}`) || '[]')
      }
      setVisitorLogs(finalVlogs)

    } catch (err: any) {
      console.error('Error loading dashboard:', err)
      toast.error(err.message || '데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (invitationId) {
      loadDashboardData()
    }
  }, [invitationId])

  // 2. Data Purging Action (예식일 14일 경과 시 자동 영구 파기)
  const purgeAllCollectedData = async () => {
    try {
      // Supabase 원격 데이터 삭제
      await supabase.from('rsvps').delete().eq('invitationId', invitationId)
      await supabase.from('guestbook').delete().eq('invitationId', invitationId)
      await supabase.from('visitor_logs').delete().eq('invitationId', invitationId)

      // LocalStorage 로컬 데이터 삭제
      localStorage.removeItem(`rsvps_${invitationId}`)
      localStorage.removeItem(`guestbook_comments_${invitationId}`)
      localStorage.removeItem(`visitor_logs_${invitationId}`)
      
      console.log('Customer data has been successfully purged under the privacy policy (14 days past wedding).')
    } catch (e) {
      console.error('Error purging customer data:', e)
    }
  }

  // 3. Guestbook visibility toggle (방명록 노출 여부 전환)
  const handleToggleVisibility = async (id: string, currentVal: boolean) => {
    const updatedVal = !currentVal
    try {
      const { error } = await supabase
        .from('guestbook')
        .update({ is_visible: updatedVal })
        .eq('id', id)

      if (error) throw error

      setGuestbook(prev => prev.map(msg => msg.id === id ? { ...msg, is_visible: updatedVal } : msg))
      toast.success(updatedVal ? '해당 방명록이 청첩장 링크에 다시 공개됩니다.' : '해당 방명록이 청첩장 링크에서 숨김 처리되었습니다.')
    } catch (err) {
      console.warn('DB update failed, attempting local storage toggle:', err)
      const localGbKey = `guestbook_comments_${invitationId}`
      const localGb = JSON.parse(localStorage.getItem(localGbKey) || '[]')
      const updated = localGb.map((msg: any) => msg.id === id ? { ...msg, is_visible: updatedVal } : msg)
      localStorage.setItem(localGbKey, JSON.stringify(updated))
      
      setGuestbook(prev => prev.map(msg => msg.id === id ? { ...msg, is_visible: updatedVal } : msg))
      toast.success(updatedVal ? '해당 방명록이 공개 전환되었습니다. (로컬 반영)' : '해당 방명록이 숨김 전환되었습니다. (로컬 반영)')
    }
  }

  // 4. Delete Action (하객 RSVP / 방명록 단일 삭제)
  const handleDeleteItem = async (id: string, type: 'rsvp' | 'guestbook') => {
    try {
      if (type === 'rsvp') {
        const { error } = await supabase.from('rsvps').delete().eq('id', id)
        if (error) throw error
        
        // LocalStorage fallback
        const localKey = `rsvps_${invitationId}`
        const local = JSON.parse(localStorage.getItem(localKey) || '[]')
        localStorage.setItem(localKey, JSON.stringify(local.filter((r: any) => r.id !== id)))
        
        setRsvps(prev => prev.filter(r => r.id !== id))
        toast.success('참석 정보가 영구 삭제되었습니다.')
      } else {
        const { error } = await supabase.from('guestbook').delete().eq('id', id)
        if (error) throw error

        // LocalStorage fallback
        const localKey = `guestbook_comments_${invitationId}`
        const local = JSON.parse(localStorage.getItem(localKey) || '[]')
        localStorage.setItem(localKey, JSON.stringify(local.filter((g: any) => g.id !== id)))

        setGuestbook(prev => prev.filter(g => g.id !== id))
        toast.success('방명록 축하 한마디가 삭제되었습니다.')
      }
    } catch (err) {
      console.error('Delete failed, processing local storage only:', err)
      if (type === 'rsvp') {
        const localKey = `rsvps_${invitationId}`
        const local = JSON.parse(localStorage.getItem(localKey) || '[]')
        localStorage.setItem(localKey, JSON.stringify(local.filter((r: any) => r.id !== id)))
        setRsvps(prev => prev.filter(r => r.id !== id))
      } else {
        const localKey = `guestbook_comments_${invitationId}`
        const local = JSON.parse(localStorage.getItem(localKey) || '[]')
        localStorage.setItem(localKey, JSON.stringify(local.filter((g: any) => g.id !== id)))
        setGuestbook(prev => prev.filter(g => g.id !== id))
      }
      toast.success('데이터가 로컬 저장소에서 삭제되었습니다.')
    }
  }

  // 5. Excel (CSV) Download for RSVPs
  const downloadRsvpsCsv = () => {
    if (rsvps.length === 0) {
      toast.error('다운로드할 RSVP 응답 데이터가 없습니다.')
      return
    }

    const headers = ['응답일자', '구분(신랑/신부측)', '작성자', '연락처', '참석여부', '동행인 수', '식사여부', '셔틀 이용여부', '메시지']
    const rows = rsvps.map(r => [
      r.createdAt ? new Date(r.createdAt).toLocaleDateString('ko-KR') : '-',
      r.side === 'groom' ? '신랑측' : r.side === 'bride' ? '신부측' : '-',
      r.name,
      r.phone || '-',
      r.attendance === 'yes' ? '참석' : '불참',
      r.attendance === 'yes' ? `${r.guestCount}명` : '0명',
      r.attendance === 'yes' ? (r.mealInfo && Object.keys(r.mealInfo).length > 0
        ? Object.entries(r.mealInfo).map(([k, v]) => `${k}:${v}개`).join(', ')
        : (r.mealType === 'korean' ? '한식' : r.mealType === 'western' ? '양식' : '안함')) : '-',
      r.attendance === 'yes' ? (r.shuttleUsed ? '이용함' : '이용안함') : '-',
      r.message || ''
    ])

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `VOW_SEOUL_RSVP_${invitation.groomName}_${invitation.brideName}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // 6. Excel (CSV) Download for Guestbook
  const downloadGuestbookCsv = () => {
    if (guestbook.length === 0) {
      toast.error('다운로드할 방명록 데이터가 없습니다.')
      return
    }

    const headers = ['응답일자', '이름', '축하메세지']
    const rows = guestbook.map(g => [
      g.createdAt ? new Date(g.createdAt).toLocaleDateString('ko-KR') : '-',
      g.name,
      g.message
    ])

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `VOW_SEOUL_방명록_${invitation.groomName}_${invitation.brideName}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // 7. Recent 7 Days Visitor Stat calculations (최근 7일 방문자 추이 계산)
  const getRecent7DaysStats = () => {
    const stats: Record<string, number> = {}
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      stats[dateStr] = 0
    }

    // Accumulate logs
    visitorLogs.forEach(log => {
      const dateStr = log.visitedDate ? log.visitedDate : new Date(log.visitedAt).toISOString().split('T')[0]
      if (stats[dateStr] !== undefined) {
        stats[dateStr]++
      }
    })

    return Object.entries(stats).map(([date, count]) => {
      const parts = date.split('-')
      return {
        label: `${parts[1]}/${parts[2]}`,
        count
      }
    })
  }

  const chartData = getRecent7DaysStats()
  const maxCount = Math.max(...chartData.map(d => d.count), 1)

  // 8. Statistics
  const totalAttendingRsvps = rsvps.filter(r => r.attendance === 'yes')
  const groomSideGuests = totalAttendingRsvps.filter(r => r.side === 'groom').reduce((a, b) => a + (b.guestCount || 1), 0)
  const brideSideGuests = totalAttendingRsvps.filter(r => r.side === 'bride').reduce((a, b) => a + (b.guestCount || 1), 0)
  const totalAttendingGuests = totalAttendingRsvps.reduce((a, b) => a + (b.guestCount || 1), 0)
  
  // Shuttle count
  const shuttleCount = totalAttendingRsvps.filter(r => r.shuttleUsed).reduce((a, b) => a + (b.guestCount || 1), 0)

  // Meal Info Stats sum
  const mealSummary: Record<string, number> = {}
  totalAttendingRsvps.forEach(r => {
    if (r.mealInfo) {
      Object.entries(r.mealInfo).forEach(([k, v]) => {
        mealSummary[k] = (mealSummary[k] || 0) + (v || 0)
      })
    } else if (r.mealType && r.mealType !== 'none') {
      const legacyKey = r.mealType === 'korean' ? '한식' : r.mealType === 'western' ? '양식' : r.mealType
      mealSummary[legacyKey] = (mealSummary[legacyKey] || 0) + (r.guestCount || 1)
    }
  })

  // 9. Expiry Render
  if (isDataPurged) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center font-sans px-4">
        <Card className="max-w-md w-full border-border/80 shadow-md">
          <CardHeader className="text-center space-y-2">
            <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto text-destructive">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <CardTitle className="text-lg text-foreground">수집 정보 파기 완료</CardTitle>
            <CardDescription className="text-xs">
              개인정보 보호 정책에 따라 예식일로부터 14일이 경과하여 해당 청첩장의 하객 RSVP 정보와 방명록 데이터가 영구적으로 파기되었습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" className="w-full text-xs" onClick={() => router.push('/')}>
              메인 페이지로
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isDashboardExpired) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center font-sans px-4">
        <Card className="max-w-md w-full border-border/80 shadow-md">
          <CardHeader className="text-center space-y-2">
            <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto text-amber-600">
              <Calendar className="w-6 h-6" />
            </div>
            <CardTitle className="text-lg text-foreground">관리 대시보드 만료</CardTitle>
            <CardDescription className="text-xs">
              예식일로부터 7일이 경과하여 대시보드 링크가 만료되었습니다.<br />
              (하객 개인정보 보호를 위한 정책이며, 예식일 14일 이후 수집 데이터는 자동 영구 파기 처리됩니다.)
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" className="w-full text-xs" onClick={() => router.push('/')}>
              메인 페이지로
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#9E8B7E]" />
          <p className="text-xs text-muted-foreground font-light">대시보드 데이터를 불러오고 있습니다...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-16 font-sans text-foreground">
      {/* Header */}
      <header className="bg-background border-b border-border/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo className="h-5 w-auto text-foreground" />
            <span className="text-[10px] bg-secondary text-secondary-foreground font-semibold px-2 py-0.5 rounded-full">
              모바일 청첩장 대시보드
            </span>
          </div>
          <Link href={`/invitation/${invitationId}`}>
            <Button variant="ghost" size="sm" className="text-xs gap-1.5 hover:bg-muted">
              <ArrowLeft className="w-3.5 h-3.5" /> 청첩장 확인
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8 space-y-6">
        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {invitation.customerName ? `${invitation.customerName}님의 청첩장 관리 대시보드` : `${invitation.groomName} ♡ ${invitation.brideName} 예식 관리`}
            </h1>
            <p className="text-xs text-muted-foreground font-light mt-1">
              예식장: {invitation.venueName} {invitation.venueHall} | 예식일자: {invitation.weddingDate} {invitation.weddingTime}
            </p>
          </div>
        </div>

        {/* Dashboard Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-border/70 shadow-sm bg-background">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground">총 누적 방문수</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{visitorLogs.length}회</div>
            </CardContent>
          </Card>
          <Card className="border border-border/70 shadow-sm bg-background">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground">RSVP 하객 응답</CardTitle>
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rsvps.length}건</div>
            </CardContent>
          </Card>
          <Card className="border border-border/70 shadow-sm bg-background">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground">방명록 글 개수</CardTitle>
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{guestbook.length}개</div>
            </CardContent>
          </Card>
        </div>

        {/* Visitor graph */}
        <Card className="border border-border/70 shadow-sm bg-background">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">최근 7일 방문자 추이</CardTitle>
            <CardDescription className="text-xs">일자별 접속 횟수 추이</CardDescription>
          </CardHeader>
          <CardContent className="h-56 flex items-end justify-between gap-2 pt-4 px-6 md:px-12 border-t border-border/30">
            {chartData.map((d) => {
              const heightPct = (d.count / maxCount) * 80 // Max height 80%
              return (
                <div key={d.label} className="flex flex-col items-center flex-1 group">
                  <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors mb-1 font-bold">
                    {d.count}
                  </span>
                  <div className="w-full bg-secondary group-hover:bg-[#9E8B7E] transition-colors rounded-t-sm" style={{ height: `${heightPct}%`, minHeight: '4px' }} />
                  <span className="text-[9px] text-muted-foreground mt-2 font-medium tracking-tight">
                    {d.label}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Tab section */}
        <Tabs defaultValue="rsvp" className="space-y-4">
          <TabsList className="bg-muted p-1 border border-border/40">
            <TabsTrigger value="rsvp" className="text-xs px-4">RSVP 하객 명단</TabsTrigger>
            <TabsTrigger value="guestbook" className="text-xs px-4">축하 방명록</TabsTrigger>
          </TabsList>

          {/* RSVP Tab Content */}
          <TabsContent value="rsvp" className="space-y-4">
            {/* Statistics Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border border-border/60 bg-background/50 shadow-sm">
                <CardHeader className="py-3">
                  <CardTitle className="text-[11px] font-semibold text-muted-foreground">구분별 참석 하객</CardTitle>
                </CardHeader>
                <CardContent className="text-sm font-medium space-y-1">
                  <div className="flex justify-between">
                    <span className="text-xs font-light text-muted-foreground">총 참석 인원:</span>
                    <span>{totalAttendingGuests}명</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-light text-muted-foreground">신랑측:</span>
                    <span>{groomSideGuests}명</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-light text-muted-foreground">신부측:</span>
                    <span>{brideSideGuests}명</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border/60 bg-background/50 shadow-sm">
                <CardHeader className="py-3">
                  <CardTitle className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Utensils className="w-3.5 h-3.5" /> 식사 희망 수량
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm font-medium space-y-1">
                  {Object.keys(mealSummary).length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-2">수집 정보 없음</div>
                  ) : (
                    Object.entries(mealSummary).map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-xs font-light text-muted-foreground">{key}:</span>
                        <span>{val}개</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border/60 bg-background/50 shadow-sm">
                <CardHeader className="py-3">
                  <CardTitle className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Bus className="w-3.5 h-3.5" /> 셔틀버스 이용
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm font-medium space-y-1">
                  <div className="flex justify-between">
                    <span className="text-xs font-light text-muted-foreground">셔틀 버스 승차 인원:</span>
                    <span>{shuttleCount}명</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border border-border/70 shadow-sm bg-background">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">참석 응답 내역</CardTitle>
                  <CardDescription className="text-xs">하객들이 응답한 최종 상세 명단입니다.</CardDescription>
                </div>
                <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" onClick={downloadRsvpsCsv}>
                  <Download className="w-3.5 h-3.5" /> 엑셀 다운로드
                </Button>
              </CardHeader>
              <CardContent className="p-0 border-t border-border/30">
                {rsvps.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground opacity-60">
                    접수된 RSVP 응답이 없습니다.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-center w-24">응답일자</TableHead>
                          <TableHead className="text-center w-20">구분</TableHead>
                          <TableHead className="text-center w-20">작성자</TableHead>
                          <TableHead className="text-center w-28">연락처</TableHead>
                          <TableHead className="text-center w-20">참석여부</TableHead>
                          <TableHead className="text-center w-20">인원수</TableHead>
                          <TableHead className="text-center w-36">식사선택</TableHead>
                          <TableHead className="text-center w-20">셔틀탑승</TableHead>
                          <TableHead className="text-left max-w-xs">코멘트</TableHead>
                          <TableHead className="text-center w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rsvps.map((rsvp) => (
                          <TableRow key={rsvp.id} className="hover:bg-muted/10 text-xs">
                            <TableCell className="text-center text-muted-foreground font-light">
                              {rsvp.createdAt ? new Date(rsvp.createdAt).toLocaleDateString('ko-KR') : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              {rsvp.side === 'groom' && <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px]">신랑측</Badge>}
                              {rsvp.side === 'bride' && <Badge variant="secondary" className="bg-pink-50 text-pink-700 hover:bg-pink-100 text-[10px]">신부측</Badge>}
                              {!rsvp.side && '-'}
                            </TableCell>
                            <TableCell className="text-center font-medium">{rsvp.name}</TableCell>
                            <TableCell className="text-center text-muted-foreground">{rsvp.phone || '-'}</TableCell>
                            <TableCell className="text-center">
                              {rsvp.attendance === 'yes' ? (
                                <span className="text-emerald-600 font-medium">참석</span>
                              ) : (
                                <span className="text-muted-foreground">불참</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {rsvp.attendance === 'yes' ? `${rsvp.guestCount}명` : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              {rsvp.attendance === 'yes' ? (rsvp.mealInfo && Object.keys(rsvp.mealInfo).length > 0 ? (
                                <span className="text-muted-foreground leading-tight text-[11px]">
                                  {Object.entries(rsvp.mealInfo).map(([k, v]) => `${k}:${v}개`).join(', ')}
                                </span>
                              ) : (
                                rsvp.mealType === 'korean' ? '한식' : rsvp.mealType === 'western' ? '양식' : '안함'
                              )) : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              {rsvp.attendance === 'yes' ? (rsvp.shuttleUsed ? '이용' : '안함') : '-'}
                            </TableCell>
                            <TableCell className="text-left font-light truncate max-w-xs" title={rsvp.message}>
                              {rsvp.message || '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="w-7 h-7 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  if (confirm('해당 하객 참석 정보를 삭제하시겠습니까?')) {
                                    handleDeleteItem(rsvp.id, 'rsvp')
                                  }
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Guestbook Tab Content */}
          <TabsContent value="guestbook" className="space-y-4">
            <Card className="border border-border/70 shadow-sm bg-background">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">방명록 축하 메시지 목록</CardTitle>
                  <CardDescription className="text-xs">
                    청첩장 하단에 노출 중인 하객 방명록 리스트입니다. (숨김 및 삭제가 가능합니다.)
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" onClick={downloadGuestbookCsv}>
                  <Download className="w-3.5 h-3.5" /> 엑셀 다운로드
                </Button>
              </CardHeader>
              <CardContent className="p-0 border-t border-border/30">
                {guestbook.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground opacity-60">
                    작성된 방명록이 없습니다.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-center w-28">응답일자</TableHead>
                          <TableHead className="text-center w-28">작성자</TableHead>
                          <TableHead className="text-left">축하 메시지 내용</TableHead>
                          <TableHead className="text-center w-24">청첩장 노출</TableHead>
                          <TableHead className="text-center w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {guestbook.map((msg) => (
                          <TableRow key={msg.id} className="hover:bg-muted/10 text-xs">
                            <TableCell className="text-center text-muted-foreground font-light">
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString('ko-KR') : '-'}
                            </TableCell>
                            <TableCell className="text-center font-medium">{msg.name}</TableCell>
                            <TableCell className="text-left font-light whitespace-pre-line leading-relaxed max-w-lg">
                              {msg.message}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Switch 
                                  checked={msg.is_visible !== false} 
                                  onCheckedChange={() => handleToggleVisibility(msg.id, msg.is_visible !== false)}
                                />
                                <span className="text-[10px] text-muted-foreground w-8 text-left">
                                  {msg.is_visible !== false ? '공개' : '숨김'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="w-7 h-7 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  if (confirm('해당 방명록 글을 삭제하시겠습니까?')) {
                                    handleDeleteItem(msg.id, 'guestbook')
                                  }
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer Policy Info */}
        <div className="pt-6 border-t border-border/40 text-center font-light space-y-1">
          <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            하객 개인정보 보호 정책: 본 관리 대시보드는 예식일(기준일)로부터 7일 경과 시 접속이 차단되며, 14일 경과 시 모든 수집 정보가 데이터베이스에서 영구 소거됩니다.
          </p>
          <p className="text-[9px] text-muted-foreground">
            © VOW SEOUL. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  )
}
