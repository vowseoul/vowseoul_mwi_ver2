'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { useAppStore } from '@/lib/store'
import { Spinner } from '@/components/ui/spinner'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  
  const redirectPath = searchParams.get('redirect') || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      if (data?.user) {
        setAuth(true, data.user.email === 'vovvseoul@gmail.com')
        
        // Check for draft invitation to associate
        if (typeof window !== 'undefined') {
          const draft = localStorage.getItem('vow_seoul_draft_invitation')
          if (draft) {
            try {
              const parsedDraft = JSON.parse(draft)
              const store = useAppStore.getState()
              store.setUser(data.user)
              store.setAuth(true, data.user.email === 'vovvseoul@gmail.com')
              store.setCurrentInvitation(parsedDraft)
              
              const savedId = await store.saveInvitation()
              localStorage.removeItem('vow_seoul_draft_invitation')
              if (savedId) {
                router.push(`/editor/${savedId}`)
                return
              }
            } catch (err) {
              console.error('Error saving draft after login:', err)
            }
          }
        }

        router.push(redirectPath)
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthLogin = async (provider: 'google' | 'kakao' | 'notion' | 'github' | 'naver' | any) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (err: any) {
      console.error('OAuth login error:', err)
      setError(err.message || '소셜 로그인 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">로그인</CardTitle>
            <CardDescription>
              VOW SEOUL에 오신 것을 환영합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">이메일</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">비밀번호</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    placeholder="비밀번호를 입력하세요"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </Field>
              </FieldGroup>

              {error && (
                <p className="mt-4 text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="mt-6 w-full" disabled={isLoading}>
                {isLoading ? <Spinner className="mr-2" /> : null}
                로그인
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              계정이 없으신가요?{' '}
              <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
                회원가입
              </Link>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">또는</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                variant="outline" 
                className="w-full relative bg-[#FEE500] text-black hover:bg-[#FEE500]/90 border-none"
                onClick={() => handleOAuthLogin('kakao')}
              >
                <svg className="absolute left-4 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3c-5.523 0-10 3.535-10 7.896 0 2.808 1.83 5.27 4.675 6.643-.162.612-.584 2.21-.667 2.532-.104.408.15.405.32.287.133-.09 2.14-1.463 3.013-2.056.865.122 1.76.188 2.66.188 5.522 0 10-3.535 10-7.896C22 6.535 17.522 3 12 3z" />
                </svg>
                카카오 로그인
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full relative bg-[#03C75A] text-white hover:bg-[#03C75A]/90 border-none"
                onClick={() => handleOAuthLogin('naver')}
              >
                <svg className="absolute left-4 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z"/>
                </svg>
                네이버 로그인
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full relative bg-white text-black hover:bg-gray-50 border-gray-300"
                onClick={() => handleOAuthLogin('google')}
              >
                <svg className="absolute left-4 h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google 로그인
              </Button>
            </div>
            
            <div className="mt-4 pt-4 border-t border-border">
              <Button variant="ghost" className="w-full text-muted-foreground" asChild>
                <Link href="/admin/login">관리자 로그인</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

