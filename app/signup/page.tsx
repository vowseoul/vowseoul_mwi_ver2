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
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth, setUser } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  
  const redirectPath = searchParams.get('redirect') || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name || !email || !password || !passwordConfirm) {
      setError('모든 항목을 입력해주세요.')
      return
    }

    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    if (password.length < 6) {
      setError('비밀번호는 최소 6자리 이상이어야 합니다.')
      return
    }

    setIsLoading(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          },
        },
      })

      if (signUpError) throw signUpError

      if (data?.user) {
        setUser(data.user)
        setAuth(true, data.user.email === 'vovvseoul@gmail.com')
        toast.success('회원가입이 완료되었습니다!')

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
              console.error('Error saving draft after signup:', err)
            }
          }
        }

        router.push(redirectPath)
      }
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || '회원가입 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">회원가입</CardTitle>
            <CardDescription>
              VOW SEOUL 계정을 생성합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">이름</FieldLabel>
                  <Input
                    id="name"
                    type="text"
                    placeholder="이름을 입력하세요"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isLoading}
                  />
                </Field>
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
                    placeholder="비밀번호를 입력하세요 (6자 이상)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="passwordConfirm">비밀번호 확인</FieldLabel>
                  <Input
                    id="passwordConfirm"
                    type="password"
                    placeholder="비밀번호를 다시 입력하세요"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    disabled={isLoading}
                  />
                </Field>
              </FieldGroup>

              {error && (
                <p className="mt-4 text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="mt-6 w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                회원가입
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              이미 계정이 있으신가요?{' '}
              <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
                로그인
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}
