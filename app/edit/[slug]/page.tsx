'use client'

import React, { useState, use, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Lock, Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/logo'

/**
 * 셀프 편집 화면 진입점 — 신랑신부 대시보드(/dashboard/[slug])와 완전히 동일한
 * 비밀번호 게이트를 그대로 재사용한다(§app/review/[slug]/page.tsx와 동일 패턴).
 * 기능 자체가 꺼져 있는지는 여기서 판단하지 않는다 — 인증 이후 서버 컴포넌트
 * (app/invitation/[id]/edit/page.tsx)가 판단해서 안내 화면을 보여준다.
 */
function EditVerifyContent({ slug }: { slug: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsVerifying(true)
    setError('')

    try {
      const res = await fetch('/api/dashboard-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, password }),
      })
      const result = await res.json().catch(() => ({}))

      if (!res.ok) {
        const message = result?.error || '인증에 실패했습니다.'
        setError(message)
        toast.error(message)
        setIsVerifying(false)
        return
      }

      toast.success('인증에 성공했습니다. 편집 화면으로 진입합니다.')
      router.push(`/invitation/${result.invitationId}/edit`)
    } catch (err) {
      console.error(err)
      setError('인증 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center font-sans px-4">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex justify-center">
            <Logo className="h-6 w-auto" />
          </div>
          <CardTitle className="text-xl font-bold flex items-center justify-center gap-2">
            <Lock className="w-5 h-5 text-primary" /> 청첩장 정보 수정
          </CardTitle>
          <CardDescription className="text-xs pt-1">
            이름·연락처·인사말·계좌·갤러리 사진을<br />
            직접 수정하실 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleVerify} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="passcode">비밀번호</FieldLabel>
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
                <Pencil className="w-4 h-4" />
              )}
              수정하러 가기
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function EditVerifyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <EditVerifyContent slug={slug} />
    </Suspense>
  )
}
