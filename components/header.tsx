'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Menu, ChevronLeft } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { usePathname, useRouter } from 'next/navigation'

import { Logo } from '@/components/logo'

export function Header() {
  const { isAuthenticated, setAuth } = useAppStore()
  const pathname = usePathname()
  const router = useRouter()
  const isHome = pathname === '/'

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          {!isHome && (
            <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="md:hidden">
              <ChevronLeft className="h-5 w-5" />
              <span className="sr-only">뒤로가기</span>
            </Button>
          )}
          <Link href="/" className="flex items-center gap-2">
            {!isHome && <ChevronLeft className="h-5 w-5 hidden md:block text-muted-foreground" />}
            <Logo className="h-5 w-auto text-foreground" />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          <Link 
            href="/templates" 
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            템플릿 갤러리
          </Link>
          <Link 
            href="/notice" 
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            공지사항
          </Link>
          <Link 
            href="/faq" 
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            FAQ
          </Link>
          <a 
            href="https://mkt.shopping.naver.com/link/6a20207aa4d80c5688e963db" 
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            스토어
          </a>
        </nav>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  마이페이지
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/mypage">내 청첩장</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/mypage/orders">주문 내역</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAuth(false, false)}>
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">로그인</Link>
            </Button>
          )}

          {/* Mobile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">메뉴 열기</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/templates">템플릿 갤러리</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/notice">공지사항</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/faq">FAQ</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a 
                  href="https://mkt.shopping.naver.com/link/6a20207aa4d80c5688e963db" 
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  스토어
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
