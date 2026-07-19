'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
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
import { 
  LayoutDashboard, 
  ShoppingCart, 
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
  Megaphone
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard },
  { href: '/admin/customers', label: '고객 관리', icon: Users },
  { href: '/admin/forms', label: '폼 관리', icon: FileText },
  { href: '/admin/invitations', label: '청첩장 관리', icon: Sparkles },
  { href: '/admin/orders', label: '주문 관리', icon: ShoppingCart },
  { href: '/admin/assets', label: '에셋 관리', icon: Palette },
  { href: '/admin/statistics', label: '통계', icon: BarChart3 },
  { href: '/admin/settings', label: '시스템 설정', icon: Settings },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { setAuth, fetchData } = useAppStore()
  const [authChecking, setAuthChecking] = React.useState(true)
  const [authorized, setAuthorized] = React.useState(false)

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

        if (profileError || profile?.role !== 'ADMIN') {
          console.error('Not authorized as admin:', profileError)
          // Attempt sign out since they are not an admin
          await supabase.auth.signOut()
          document.cookie = 'sb-vowseoul-auth-token=; path=/; max-age=0; SameSite=Lax'
          window.location.href = '/admin/login'
          return
        }

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
    document.cookie = 'sb-vowseoul-auth-token=; path=/; max-age=0; SameSite=Lax'
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
      <aside className="hidden w-64 border-r border-border bg-background lg:block">
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
            {navItems.map((item) => {
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
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
          <div className="flex items-center gap-4">
            {/* Mobile Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {navItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-lg font-semibold lg:hidden flex items-center gap-1.5">
              <Logo className="h-4.5 w-auto text-foreground" /> Admin
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <User className="h-4 w-4" />
                관리자
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-muted/30 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
