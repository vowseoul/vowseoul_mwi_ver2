'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

/**
 * 신랑신부가 직접 대시보드 비밀번호를 바꾸는 다이얼로그.
 *
 * 기본값이 "연락처 뒷 4자리"라 링크만 알면 추측이 어렵지 않다 — 하객 실명·연락처가
 * 담긴 화면이므로 본인이 바꿀 수 있어야 한다. 설정 페이지를 따로 만들지 않고
 * 헤더에서 바로 여는 이유는, 이 대시보드가 예식 전후로 잠깐씩만 쓰는 화면이라
 * 한 단계 더 들어가면 있는 줄도 모르고 지나가기 때문이다.
 */
export function ChangePasswordDialog({ invitationId }: { invitationId: string }) {
  const [open, setOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('새 비밀번호가 서로 다릅니다.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/dashboard-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId, currentPassword, newPassword }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(result?.error || '비밀번호를 변경하지 못했습니다.')
        return
      }
      toast.success('비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용해주세요.')
      reset()
      setOpen(false)
    } catch (err) {
      console.error(err)
      toast.error('비밀번호를 변경하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs gap-1.5 hover:bg-muted px-2 sm:px-3">
          <KeyRound className="w-3.5 h-3.5" /> <span className="hidden sm:inline">비밀번호 변경</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">대시보드 비밀번호 변경</DialogTitle>
          <DialogDescription className="text-xs">
            하객 명단과 연락처가 담긴 화면입니다. 처음 받으신 기본 비밀번호(연락처 뒷 4자리)는
            추측하기 쉬우니 직접 정한 값으로 바꿔주세요.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="currentPassword">현재 비밀번호</FieldLabel>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={saving}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="newPassword">새 비밀번호</FieldLabel>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={saving}
            />
            <p className="text-[11px] text-muted-foreground mt-1">6자 이상으로 입력해주세요.</p>
          </Field>
          <Field>
            <FieldLabel htmlFor="confirmPassword">새 비밀번호 확인</FieldLabel>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={saving}
            />
          </Field>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              취소
            </Button>
            <Button type="submit" size="sm" className="gap-1.5" disabled={saving}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              변경하기
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
