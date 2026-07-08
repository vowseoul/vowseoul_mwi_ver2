'use client'

import React, { useState, use, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Lock, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/logo'

function DashboardVerifyContent({ slug }: { slug: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsVerifying(true)
    setError('')

    try {
      // Lookup the invitation by public_slug
      const { data, error: queryError } = await supabase
        .from('invitations')
        .select('id, dashboard_password, customer:customer_id(groom_name, bride_name)')
        .eq('public_slug', slug)
        .single()

      if (queryError || !data) {
        setError('일치하는 청첩장 대시보드를 찾을 수 없습니다.')
        toast.error('대시보드 조회 실패')
        setIsVerifying(false)
        return
      }

      // Verify passcode (usually last 4 digits of the phone number)
      if (password === data.dashboard_password) {
        toast.success('인증에 성공했습니다. 대시보드로 진입합니다.')
        // Store session token in localStorage for client-side reference
        localStorage.setItem(`vow_seoul_dashboard_authorized_${data.id}`, 'true')
        
        // Redirect to the actual dashboard
        router.push(`/invitation/${data.id}/dashboard`)
      } else {
        setError('비밀번호가 올바르지 않습니다. (기본값: 연락처 뒷 4자리)')
        toast.error('비밀번호가 일치하지 않습니다.')
      }
    } catch (err: any) {
      console.error(err)
      setError('인증 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans px-4">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex justify-center">
            <Logo className="h-6 w-auto" />
          </div>
          <CardTitle className="text-xl font-bold flex items-center justify-center gap-2">
            <Lock className="w-5 h-5 text-primary" /> 신랑신부 대시보드 인증
          </CardTitle>
          <CardDescription className="text-xs pt-1">
            참석 의사 RSVP 분석, 방명록 축하 메시지 관리 및<br />
            실시간 방문 통계를 확인할 수 있는 전용 관리판입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleVerify} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="passcode">대시보드 비밀번호</FieldLabel>
              <Input
                id="passcode"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력 (기본값: 연락처 뒷 4자리)"
                required
                className="h-10"
              />
            </Field>

            {error && (
              <p className="text-xs text-destructive bg-red-50 border border-red-100 p-2 rounded-lg">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full h-10 gap-2" disabled={isVerifying}>
              {isVerifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              대시보드 진입하기
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function DashboardVerifyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <DashboardVerifyContent slug={slug} />
    </Suspense>
  )
}
