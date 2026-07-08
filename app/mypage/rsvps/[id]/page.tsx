'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, 
  Download, 
  Trash2, 
  Search, 
  Users, 
  Utensils, 
  MessageSquare,
  Loader2,
  Calendar,
  Frown,
  CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'

interface RSVP {
  id: string
  invitationId: string
  name: string
  attendance: 'yes' | 'no' | string
  guestCount: number
  mealType: 'korean' | 'western' | 'none' | string
  message: string
  createdAt: string
}

interface GuestbookMessage {
  id: string
  invitationId: string
  name: string
  message: string
  createdAt: string
}

export default function RsvpManagerPage() {
  const router = useRouter()
  const params = useParams()
  const invitationId = params.id as string

  const [invitation, setInvitation] = useState<any>(null)
  const [rsvps, setRsvps] = useState<RSVP[]>([])
  const [guestbook, setGuestbook] = useState<GuestbookMessage[]>([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('rsvps')

  // Deletion States
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'rsvp' | 'guestbook' } | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const loadData = async () => {
    try {
      // 1. Get current authenticated user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('로그인이 필요한 페이지입니다.')
        router.push('/login')
        return
      }

      // 2. Fetch invitation to verify ownership
      const { data: invite, error: inviteError } = await supabase
        .from('invitations')
        .select('*')
        .eq('id', invitationId)
        .single()

      if (inviteError || !invite) {
        throw new Error('청첩장 정보를 찾을 수 없습니다.')
      }

      // Check ownership (bypass for admin)
      const userId = session.user.id
      const isOwner = invite.id.startsWith(userId + '__')
      const isAdmin = session.user.email === 'admin@vowseoul.com'

      if (!isOwner && !isAdmin) {
        toast.error('해당 청첩장의 관리 권한이 없습니다.')
        router.push('/mypage')
        return
      }

      setInvitation(invite)

      // 3. Fetch RSVPs
      const { data: rsvpsData } = await supabase
        .from('rsvps')
        .select('*')
        .eq('invitationId', invitationId)
        .order('createdAt', { ascending: false })

      // Fallback to local storage if DB query fails or table empty
      let finalRsvps = rsvpsData || []
      if (finalRsvps.length === 0) {
        const localRsvps = JSON.parse(localStorage.getItem(`rsvps_${invitationId}`) || '[]')
        finalRsvps = localRsvps
      }
      setRsvps(finalRsvps)

      // 4. Fetch Guestbook Messages
      const { data: gbData } = await supabase
        .from('guestbook')
        .select('*')
        .eq('invitationId', invitationId)
        .order('createdAt', { ascending: false })

      let finalGb = gbData || []
      if (finalGb.length === 0) {
        const localGb = JSON.parse(localStorage.getItem(`guestbook_comments_${invitationId}`) || '[]')
        finalGb = localGb
      }
      setGuestbook(finalGb)

    } catch (err: any) {
      console.error('Error loading RSVP/Guestbook data:', err)
      toast.error(err.message || '데이터를 불러오는데 실패했습니다.')
      router.push('/mypage')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (invitationId) {
      loadData()
    }
  }, [invitationId])

  // Statistics Calculations
  const totalRsvpsCount = rsvps.length
  const attendingRsvps = rsvps.filter(r => r.attendance === 'yes')
  const totalAttendingGuests = attendingRsvps.reduce((acc, r) => acc + (r.guestCount || 1), 0)
  const notAttendingCount = rsvps.filter(r => r.attendance === 'no').length

  const mealKoreanCount = attendingRsvps.filter(r => r.mealType === 'korean').reduce((acc, r) => acc + (r.guestCount || 1), 0)
  const mealWesternCount = attendingRsvps.filter(r => r.mealType === 'western').reduce((acc, r) => acc + (r.guestCount || 1), 0)
  const mealNoneCount = attendingRsvps.filter(r => r.mealType === 'none' || !r.mealType).reduce((acc, r) => acc + (r.guestCount || 1), 0)

  // Search Filter
  const filteredRsvps = rsvps.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.message && r.message.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const filteredGuestbook = guestbook.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.message.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Excel/CSV Download
  const handleDownloadCsv = () => {
    if (rsvps.length === 0) {
      toast.error('내보낼 참석 데이터가 없습니다.')
      return
    }

    const headers = ['성함', '참석 여부', '총 인원(본인 포함)', '식사 선택', '전달 메시지', '등록 일시']
    const rows = rsvps.map(r => [
      r.name,
      r.attendance === 'yes' ? '참석' : '불참',
      r.attendance === 'yes' ? (r.guestCount || 1) : 0,
      r.attendance === 'yes' ? (r.mealType === 'korean' ? '한식' : r.mealType === 'western' ? '양식' : '선택안함') : '불참',
      r.message || '',
      r.createdAt ? new Date(r.createdAt).toLocaleString('ko-KR') : ''
    ])

    // CSV format UTF-8 with BOM for Excel compatibility in Korean language
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"
    csvContent += [headers.join(','), ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `wedding_rsvp_list_${invitation?.groomName}_${invitation?.brideName}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('CSV 파일이 다운로드되었습니다.')
  }

  // Deletion logic
  const handleDeleteRequest = (id: string, type: 'rsvp' | 'guestbook') => {
    setDeleteTarget({ id, type })
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    const { id, type } = deleteTarget
    try {
      if (type === 'rsvp') {
        // Delete from Supabase
        const { error } = await supabase.from('rsvps').delete().eq('id', id)
        if (error) {
          // If table doesn't exist or permissions fail, delete from local storage
          const localRsvpsKey = `rsvps_${invitationId}`
          const localRsvps = JSON.parse(localStorage.getItem(localRsvpsKey) || '[]')
          const updated = localRsvps.filter((r: any) => r.id !== id)
          localStorage.setItem(localRsvpsKey, JSON.stringify(updated))
        }
        
        setRsvps(prev => prev.filter(r => r.id !== id))
        toast.success('참석자 데이터가 삭제되었습니다.')
      } else {
        const { error } = await supabase.from('guestbook').delete().eq('id', id)
        if (error) {
          const localGbKey = `guestbook_comments_${invitationId}`
          const localGb = JSON.parse(localStorage.getItem(localGbKey) || '[]')
          const updated = localGb.filter((g: any) => g.id !== id)
          localStorage.setItem(localGbKey, JSON.stringify(updated))
        }

        setGuestbook(prev => prev.filter(g => g.id !== id))
        toast.success('방명록 메시지가 삭제되었습니다.')
      }
    } catch (err) {
      toast.error('삭제 처리 중 오류가 발생했습니다.')
    } finally {
      setDeleteConfirmOpen(false)
      setDeleteTarget(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
        <Footer />
      </div>
    )
  }

  const weddingTitle = invitation?.groomName && invitation?.brideName 
    ? `${invitation.groomName} ♥ ${invitation.brideName}`
    : '이름 미입력 청첩장'

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex-1 py-10">
        <div className="container max-w-5xl px-4 space-y-8">
          
          {/* Header Navigation */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/mypage" className="hover:text-foreground transition-colors">마이페이지</Link>
                <span>&gt;</span>
                <span className="text-foreground font-medium">참석 및 방명록 관리</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{weddingTitle}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                예식일: {invitation?.weddingDate || '미정'} {invitation?.weddingTime || ''}
              </p>
            </div>
            
            <Button variant="outline" asChild className="w-fit">
              <Link href="/mypage">
                <ArrowLeft className="w-4 h-4 mr-2" />
                목록으로 돌아가기
              </Link>
            </Button>
          </div>

          {/* Stats Cards Dashboard */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-sm">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">총 참석 예정 인원</p>
                  <h3 className="text-2xl font-bold text-foreground mt-1">
                    {totalAttendingGuests}명
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    본인 포함 ({attendingRsvps.length}개 응답)
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                  <Utensils className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">식사 신청 현황</p>
                  <h3 className="text-base font-bold text-foreground mt-1 flex flex-wrap gap-x-2">
                    <span>한식: {mealKoreanCount}명</span>
                    <span className="text-muted-foreground font-light">/</span>
                    <span>양식: {mealWesternCount}명</span>
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    식사 안함: {mealNoneCount}명
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                  <Frown className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">참석 불가(불참)</p>
                  <h3 className="text-2xl font-bold text-foreground mt-1">
                    {notAttendingCount}명
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    정중히 거절하신 분들
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">등록된 방명록</p>
                  <h3 className="text-2xl font-bold text-foreground mt-1">
                    {guestbook.length}개
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    하객들의 따뜻한 축하 메시지
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Dashboard Control Area */}
          <Card className="shadow-sm">
            <CardHeader className="p-6 pb-0">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                  <TabsList className="grid w-full grid-cols-2 sm:w-[240px]">
                    <TabsTrigger value="rsvps">참석자 명단 ({rsvps.length})</TabsTrigger>
                    <TabsTrigger value="guestbook">방명록 ({guestbook.length})</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Filter and Download Actions */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="이름 또는 메시지 검색" 
                      className="pl-9 h-9" 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  {activeTab === 'rsvps' && (
                    <Button variant="outline" size="sm" className="h-9 gap-1" onClick={handleDownloadCsv}>
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Excel 다운로드</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              
              {/* RSVP Tab Content */}
              <Tabs value={activeTab} className="w-full">
                <TabsContent value="rsvps" className="m-0 space-y-4">
                  {filteredRsvps.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground space-y-2">
                      <Users className="w-12 h-12 mx-auto text-muted-foreground/40" />
                      <p className="text-sm font-medium">참석 정보가 없습니다.</p>
                      {searchTerm && <p className="text-xs text-muted-foreground">검색어를 변경해보세요.</p>}
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/55">
                          <TableRow>
                            <TableHead className="w-24 text-center">성함</TableHead>
                            <TableHead className="w-24 text-center">참석 여부</TableHead>
                            <TableHead className="w-24 text-center">참석 인원</TableHead>
                            <TableHead className="w-28 text-center">식사 여부</TableHead>
                            <TableHead>전달 메시지</TableHead>
                            <TableHead className="w-32 text-center">등록 시간</TableHead>
                            <TableHead className="w-16 text-center">관리</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRsvps.map((rsvp) => (
                            <TableRow key={rsvp.id} className="hover:bg-muted/30">
                              <TableCell className="font-semibold text-center text-foreground">{rsvp.name}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant={rsvp.attendance === 'yes' ? 'default' : 'secondary'} className="text-[10px] py-0.5 px-2">
                                  {rsvp.attendance === 'yes' ? (
                                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />참석</span>
                                  ) : '불참'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center text-foreground font-medium">
                                {rsvp.attendance === 'yes' ? `${rsvp.guestCount || 1}명` : '-'}
                              </TableCell>
                              <TableCell className="text-center">
                                {rsvp.attendance === 'yes' ? (
                                  <Badge variant="outline" className="text-[10px] py-0.5 px-1.5 font-medium border-slate-300">
                                    {rsvp.mealType === 'korean' ? '한식' : 
                                     rsvp.mealType === 'western' ? '양식' : '선택안함'}
                                  </Badge>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs" title={rsvp.message}>
                                {rsvp.message || '-'}
                              </TableCell>
                              <TableCell className="text-center text-xs text-muted-foreground">
                                {rsvp.createdAt ? new Date(rsvp.createdAt).toLocaleDateString('ko-KR', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : '-'}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteRequest(rsvp.id, 'rsvp')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* Guestbook Tab Content */}
                <TabsContent value="guestbook" className="m-0 space-y-4">
                  {filteredGuestbook.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground space-y-2">
                      <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/40" />
                      <p className="text-sm font-medium">방명록 축하 메시지가 없습니다.</p>
                      {searchTerm && <p className="text-xs text-muted-foreground">검색어를 변경해보세요.</p>}
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {filteredGuestbook.map((msg) => (
                        <Card key={msg.id} className="relative shadow-sm border border-border bg-card/50 hover:bg-card hover:border-border transition-colors">
                          <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
                            <div>
                              <span className="font-semibold text-sm text-foreground">{msg.name}</span>
                              <span className="text-[10px] text-muted-foreground ml-2">{msg.createdAt}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-1 -mr-1"
                              onClick={() => handleDeleteRequest(msg.id, 'guestbook')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </CardHeader>
                          <CardContent className="p-4 pt-0">
                            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                              {msg.message}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              
            </CardContent>
          </Card>

        </div>
      </main>

      <Footer />

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'rsvp' 
                ? '이 참석자 정보와 식사 현황이 명단에서 영구히 제거되며 복구할 수 없습니다.' 
                : '이 축하 방명록 메시지가 영구히 제거되며 복구할 수 없습니다.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-white" onClick={confirmDelete}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
