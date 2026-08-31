'use client'

import { useEffect, useState } from 'react'
import { Bell, Send, Smartphone, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SaveButton } from '@/components/ui/save-button'
import { toast } from 'sonner'
import {
  subscribeToPush, unsubscribeFromPush, pushState, type PushState,
} from '@/lib/push-client'

/**
 * 내 알림 설정 — 직원마다 자기 경로를 고른다.
 *
 * 두 곳에서 같은 것을 보여준다: 시스템 설정 > 알림(운영자)과 /admin/notifications
 * (디자이너). 시스템 설정이 운영자 전용이라 디자이너가 자기 알림을 켤 길이 없어
 * 진입점을 둘로 뒀다 — 화면은 여기 하나뿐이라 두 곳이 어긋날 일은 없다.
 */
export function MyNotificationSettings() {
  const [chatId, setChatId] = useState('')
  const [loading, setLoading] = useState(true)
  const [push, setPush] = useState<PushState>({ supported: false, permission: 'default', subscribed: false })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/my-notifications')
        if (res.ok) setChatId((await res.json()).telegramChatId ?? '')
      } catch (e) {
        console.error(e)
      }
      setPush(await pushState())
      setLoading(false)
    })()
  }, [])

  const saveChatId = async (): Promise<boolean> => {
    const res = await fetch('/api/my-notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramChatId: chatId }),
    })
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({}))).error || '저장하지 못했습니다.')
      return false
    }
    toast.success('텔레그램 채팅 ID를 저장했습니다.')
    return true
  }

  const togglePush = async () => {
    setBusy(true)
    try {
      const next = push.subscribed ? await unsubscribeFromPush() : await subscribeToPush()
      setPush(next)
      toast.success(next.subscribed ? '이 기기에서 알림을 받습니다.' : '이 기기의 알림을 껐습니다.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '알림을 켜지 못했습니다.')
      setPush(await pushState())
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/my-notifications', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error || '보내지 못했습니다.')
        return
      }
      toast.success(
        `보냈습니다 — 텔레그램 ${body.telegram ? '1건' : '없음'} · 브라우저 알림 ${body.push}건`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4" /> 텔레그램
          </CardTitle>
          <CardDescription>
            텔레그램에서 <strong>@VOWSEOUL_bot</strong> 을 찾아 대화를 시작(<code>/start</code>)한 뒤,
            봇이 알려주는 숫자를 넣으세요. 비워두면 텔레그램으로는 받지 않습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="예: 868548xxxx"
            inputMode="numeric"
            disabled={loading}
            className="sm:max-w-xs"
          />
          <SaveButton onSave={saveChatId} idleLabel="저장" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-4 w-4" /> 브라우저 알림 (텔레그램 없이)
          </CardTitle>
          <CardDescription>
            이 기기의 잠금화면으로 바로 받습니다. 기기마다 따로 켜야 합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 아이폰이 이 기능의 유일한 함정이다. 안내를 안 하면 켠 줄 알고 못 받는다. */}
          <div className="flex gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">아이폰은 홈 화면에 추가해야 알림이 옵니다.</p>
              <p className="mt-1">
                사파리에서 이 페이지를 열고 → 아래 <strong>공유</strong> 버튼 → <strong>홈 화면에 추가</strong> →
                생긴 아이콘으로 다시 연 다음, 아래 버튼을 눌러주세요.
                사파리 탭에서 켜면 알림이 오지 않습니다. (iOS 16.4 이상)
              </p>
            </div>
          </div>

          {!push.supported ? (
            <p className="text-sm text-muted-foreground">
              이 브라우저에서는 지원하지 않습니다. 홈 화면에 추가한 뒤 그 아이콘으로 열어보세요.
            </p>
          ) : push.permission === 'denied' ? (
            <p className="text-sm text-destructive">
              알림 권한이 차단돼 있습니다. 기기 설정에서 이 앱의 알림을 허용한 뒤 다시 시도해주세요.
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <Button onClick={togglePush} disabled={busy} variant={push.subscribed ? 'outline' : 'default'}>
                {push.subscribed ? '이 기기 알림 끄기' : '이 기기에서 알림 받기'}
              </Button>
              {push.subscribed && (
                <span className="flex items-center gap-1 text-sm text-emerald-600">
                  <Check className="h-4 w-4" /> 켜짐
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> 확인
          </CardTitle>
          <CardDescription>
            설정한 경로로 한 통 보내봅니다. 안 오면 설정이 안 된 것입니다 — 이 기능의 실패는
            화면에 아무 표시가 없어서, 눌러 보는 것이 유일한 확인 방법입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={sendTest} disabled={busy}>
            테스트 알림 보내기
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
