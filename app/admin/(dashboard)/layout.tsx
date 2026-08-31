'use client'

import React, { useEffect } from 'react'
import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Logo } from '@/components/logo'
import { AdminNotificationBell } from '@/components/admin-notification-bell'
import {
  LayoutDashboard,
  Palette,
  BarChart3,
  Settings,
  Menu,
  User,
  Users,
  FileText,
  Sparkles,
  LogOut,
  HelpCircle,
  Bell,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

// 주문 관리는 별도 메뉴 없이 고객 관리(상세 페이지)에 통합되었다 — orders 테이블/
// 데이터 자체는 그대로 쓰지만 전용 목록 화면(/admin/orders)은 더 이상 없다.
const navItems = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard },
  { href: '/admin/customers', label: '고객 관리', icon: Users },
  { href: '/admin/forms', label: '폼 관리', icon: FileText },
  { href: '/admin/invitations', label: '청첩장 관리', icon: Sparkles },
  { href: '/admin/assets', label: '에셋 관리', icon: Palette },
  { href: '/admin/statistics', label: '통계', icon: BarChart3 },
  { href: '/admin/inquiries', label: '문의 관리', icon: HelpCircle },
  { href: '/admin/settings', label: '시스템 설정', icon: Settings, adminOnly: true },
]

/** useLinkStatus()는 자신을 감싼 <Link>의 진행중 여부를 읽으므로 Link 내부에서만 호출할 수 있다.
 * 클릭 즉시(다음 페이지 응답을 기다리는 동안) 아이콘이 스피너로 바뀌어 "지금 이동 중"임을 보여준다 — Visibility. */
function NavIcon({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  const { pending } = useLinkStatus()
  return pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { setAuth, fetchData } = useAppStore()
  const [authChecking, setAuthChecking] = React.useState(true)
  const [authorized, setAuthorized] = React.useState(false)
  const [role, setRole] = React.useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /** 시스템 설정은 운영자만 — 눌러봐야 되돌려보내지는 메뉴를 보여줄 이유가 없다 */
  const visibleNavItems = navItems.filter((item) => !item.adminOnly || role === 'ADMIN')

  useEffect(() => {
    async function checkAdminAuth() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          window.location.href = '/admin/login'
          return
        }

        // Fetch user profile role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        // 등록된 직원이면 통과시킨다. 예전에는 ADMIN 만 들여보내 디자이너 계정이
        // 로그인 직후 다시 로그아웃되었다. 시스템 설정만 운영자 전용이고,
        // 그 판정은 여기(메뉴 숨김)와 proxy.ts(주소 직접 입력 차단) 양쪽에서 한다.
        if (profileError || !profile?.role) {
          console.error('Not authorized as staff:', profileError)
          await supabase.auth.signOut()
          window.location.href = '/admin/login'
          return
        }
        setRole(profile.role)

        setAuth(true, true)
        setAuthorized(true)
        setAuthChecking(false)
      } catch (err) {
        console.error('Admin authentication check error:', err)
        window.location.href = '/admin/login'
      }
    }

    checkAdminAuth()
  }, [setAuth])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setAuth(false, false)
    window.location.href = '/admin/login'
  }

  if (authChecking || !authorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm font-light">관리자 권한을 확인하고 있습니다...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-background lg:block">
        <div className="flex h-16 items-center border-b border-border px-6 gap-2">
          <Link href="/admin" className="flex items-center">
            <Logo className="h-4.5 w-auto text-foreground" />
          </Link>
          <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            Admin
          </span>
        </div>
        <nav className="p-4">
          <ul className="space-y-1">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/admin' && pathname.startsWith(item.href))
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive 
                        ? 'bg-foreground text-background' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <NavIcon icon={item.icon} />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-16 items-center justify-between gap-2 border-b border-border bg-background px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-4">
            {/* Mobile Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" aria-label="메뉴 열기">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {visibleNavItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href} className="flex items-center gap-2">
                      <NavIcon icon={item.icon} />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* 폰에서 이 브랜드 영역이 줄어들지 않아 오른쪽의 알림 배지가 "Admin" 글자 위로
                겹쳐 보였다. min-w-0 로 줄어들 수 있게 하고, 폭이 가장 빠듯한 구간에서는
                로고만 온전히 남기고 "Admin" 글자를 뺀다(잘린 채로 보이는 것보다 낫다). */}
            <span className="flex min-w-0 items-center gap-1.5 text-lg font-semibold lg:hidden">
              <Logo className="h-4.5 w-auto shrink-0 text-foreground" />
              <span className="hidden sm:inline">Admin</span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <AdminNotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  관리자
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/admin/notifications">
                    <Bell className="mr-2 h-4 w-4" />
                    내 알림 설정
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-muted/30 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
