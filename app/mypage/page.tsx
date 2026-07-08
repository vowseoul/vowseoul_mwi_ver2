'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useAppStore, sampleThemes } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { 
  Plus, 
  MoreVertical, 
  Edit, 
  Eye, 
  Copy, 
  Share2, 
  Trash2,
  ExternalLink,
  User,
  Mail,
  Loader2,
  Calendar,
  Lock
} from 'lucide-react'
import { toast } from 'sonner'

export default function MyPage() {
  const router = useRouter()
  const { user, invitations, loadUserInvitations, setAuth, setUser } = useAppStore()
  
  const [profileName, setProfileName] = useState('')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedInviteId, setSelectedInviteId] = useState<string | null>(null)

  useEffect(() => {
    // Check auth status
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('로그인이 필요한 페이지입니다.')
        router.push('/login')
        return
      }
      
      if (session.user) {
        setProfileName(session.user.user_metadata?.name || '')
        await loadUserInvitations()
      }
      setIsLoading(false)
    }
    
    checkAuth()
  }, [user])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileName) return toast.error('이름을 입력해주세요.')
    
    setIsUpdatingProfile(true)
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { name: profileName }
      })
      
      if (error) throw error
      
      if (data?.user) {
        setUser(data.user)
        toast.success('프로필 정보가 수정되었습니다.')
      }
    } catch (err: any) {
      console.error('Profile update error:', err)
      toast.error('프로필 수정에 실패했습니다.')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleDeleteInvite = (id: string) => {
    setSelectedInviteId(id)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteInvite = async () => {
    if (!selectedInviteId) return
    
    try {
      const { error } = await supabase.from('invitations').delete().eq('id', selectedInviteId)
      if (error) throw error
      
      toast.success('청첩장이 성공적으로 삭제되었습니다.')
      await loadUserInvitations()
    } catch (err) {
      toast.error('청첩장 삭제에 실패했습니다.')
    } finally {
      setDeleteDialogOpen(false)
      setSelectedInviteId(null)
    }
  }

  const copyInviteLink = (inviteId: string) => {
    const link = `${window.location.origin}/invitation/${inviteId}`
    navigator.clipboard.writeText(link)
    toast.success('청첩장 링크가 클립보드에 복사되었습니다.')
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex-1 py-12">
        <div className="container max-w-5xl px-4">
          <div className="grid gap-8 md:grid-cols-3">
            {/* Left: User Profile */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5 text-muted-foreground" />
                    내 정보 관리
                  </CardTitle>
                  <CardDescription>프로필 정보를 확인하고 변경합니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground">이메일</label>
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border rounded-md text-sm text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        {user?.email}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="profileName" className="text-xs font-semibold text-muted-foreground">이름</label>
                      <Input 
                        id="profileName"
                        value={profileName}
                        onChange={e => setProfileName(e.target.value)}
                        placeholder="이름을 입력하세요"
                        disabled={isUpdatingProfile}
                      />
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={isUpdatingProfile}>
                      {isUpdatingProfile ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      수정하기
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Quick links */}
              <Card>
                <CardContent className="p-4 space-y-2">
                  <Button variant="outline" className="w-full justify-start text-xs font-medium" asChild>
                    <Link href="/mypage/orders">주문 내역 보기</Link>
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-xs font-medium text-destructive hover:bg-destructive/10" onClick={() => setAuth(false, false)}>
                    <Lock className="w-4 h-4 mr-2" />
                    로그아웃
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right: Invitations List */}
            <div className="md:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">내 청첩장</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    현재 제작중이거나 발행 완료된 모바일 청첩장 목록입니다.
                  </p>
                </div>
                <Button asChild>
                  <Link href="/templates">
                    <Plus className="w-4 h-4 mr-2" />
                    새 청첩장 만들기
                  </Link>
                </Button>
              </div>

              {invitations.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Plus className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-1">아직 생성된 청첩장이 없습니다</h3>
                    <p className="text-sm text-muted-foreground mb-6 text-center">
                      원하는 테마를 고르고 첫 청첩장을 만들어보세요.
                    </p>
                    <Button asChild>
                      <Link href="/templates">테마 고르기</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {invitations.map((invite) => {
                    const themeObj = sampleThemes.find(t => t.id === invite.themeId) || sampleThemes[0]
                    const previewTitle = invite.groomName && invite.brideName
                      ? `${invite.groomName} ♥ ${invite.brideName}`
                      : '이름 미입력 청첩장'
                      
                    const dateFormatted = invite.weddingDate || '일정 미지정'

                    return (
                      <Card key={invite.id} className="overflow-hidden shadow-sm border border-border/80 hover:border-border transition-colors">
                        <CardContent className="p-0">
                          <div className="flex flex-col sm:flex-row">
                            {/* Theme thumbnail placeholder */}
                            <div className="sm:w-36 aspect-[4/3] sm:aspect-auto bg-muted flex-shrink-0 flex items-center justify-center text-muted-foreground border-r border-border/50 relative overflow-hidden">
                              {invite.mainImage ? (
                                <img src={invite.mainImage} alt="Main Visual" className="w-full h-full object-cover" />
                              ) : (
                                <div className="text-[10px] uppercase font-mono tracking-wider opacity-60">
                                  {themeObj.name}
                                </div>
                              )}
                            </div>

                            {/* Invitation Details */}
                            <div className="flex-1 p-5 flex flex-col justify-between">
                              <div>
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className="font-semibold text-base text-foreground leading-none">{previewTitle}</h3>
                                      <Badge variant={invite.status === 'published' ? 'default' : 'secondary'} className="text-[10px] py-0.5">
                                        {invite.status === 'published' ? '발행됨' : '작성중'}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                                      <Calendar className="w-3.5 h-3.5" />
                                      예식일: {dateFormatted}
                                    </p>
                                  </div>
                                  
                                  {/* Dropdown Menu */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                      <DropdownMenuItem asChild>
                                        <Link href={`/editor/${invite.id}`}>
                                          <Edit className="w-3.5 h-3.5 mr-2" />
                                          편집하기
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <Link href={`/invitation/${invite.id}`} target="_blank">
                                          <Eye className="w-3.5 h-3.5 mr-2" />
                                          미리보기
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <Link href={`/mypage/rsvps/${invite.id}`}>
                                          <Mail className="w-3.5 h-3.5 mr-2" />
                                          참석/방명록 관리
                                        </Link>
                                      </DropdownMenuItem>
                                      {invite.status === 'published' && (
                                        <>
                                          <DropdownMenuItem onClick={() => copyInviteLink(invite.id)}>
                                            <Copy className="w-3.5 h-3.5 mr-2" />
                                            링크 복사
                                          </DropdownMenuItem>
                                          <DropdownMenuItem asChild>
                                            <a href={`/invitation/${invite.id}`} target="_blank" rel="noopener noreferrer">
                                              <ExternalLink className="w-3.5 h-3.5 mr-2" />
                                              모바일 화면 열기
                                            </a>
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-destructive focus:bg-destructive/10" onClick={() => handleDeleteInvite(invite.id)}>
                                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                                        삭제하기
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 mt-4">
                                <Button size="sm" variant="outline" className="text-xs h-8" asChild>
                                  <Link href={`/editor/${invite.id}`}>
                                    <Edit className="w-3.5 h-3.5 mr-1" />
                                    수정하기
                                  </Link>
                                </Button>
                                <Button size="sm" variant="outline" className="text-xs h-8 gap-1" asChild>
                                  <Link href={`/mypage/rsvps/${invite.id}`}>
                                    <Mail className="w-3.5 h-3.5" />
                                    참석/방명록
                                  </Link>
                                </Button>
                                {invite.status === 'published' ? (
                                  <Button size="sm" className="text-xs h-8 gap-1 animate-pulse hover:animate-none" onClick={() => copyInviteLink(invite.id)}>
                                    <Share2 className="w-3.5 h-3.5" />
                                    공유하기
                                  </Button>
                                ) : (
                                  <Button size="sm" className="text-xs h-8" asChild>
                                    <Link href={`/editor/${invite.id}/payment`}>
                                      발행하기
                                    </Link>
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>청첩장을 정말 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제하면 등록하신 사진, 방명록 데이터가 모두 유실되며, 발행된 주소(`/invitation/${selectedInviteId}`)로의 접속이 더 이상 불가능해집니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-white" onClick={confirmDeleteInvite}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
