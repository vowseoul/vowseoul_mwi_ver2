import webpush from "web-push"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * 웹 푸시(PWA 알림) 전송.
 *
 * 텔레그램을 쓰지 않으려는 직원을 위한 두 번째 경로다. 관리자 화면을 열어두지
 * 않아도 잠금화면에 뜬다는 점에서 헤더 벨(1분 폴링)과 다르다.
 *
 * ⚠ 아이폰 제약: iOS 16.4+ 에서만 되고, 사파리 탭이 아니라 "홈 화면에 추가"로
 *   설치한 뒤 그 아이콘으로 열었을 때만 도착한다. 설정 화면에서 이걸 안내한다
 *   (§app/admin/(dashboard)/notifications/page.tsx).
 *
 * VAPID 키가 없으면 조용히 넘어간다 — 텔레그램과 같은 방침이다. 알림이 설정되지
 * 않았다는 이유로 본래 작업(폼 제출 처리)이 실패하면 안 된다.
 */

export interface PushSubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

function configured(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@vowseoul.com", pub, priv)
  return true
}

/**
 * 구독들에 알림을 보낸다. 실패는 삼키고 로그만 남긴다(호출부는 await 해도 throw 되지 않는다).
 *
 * 404/410 은 "이 구독은 죽었다"는 뜻이라 그 행을 지운다. 브라우저는 구독이
 * 만료됐다고 미리 알려주지 않으므로, 보내보고 알아내는 것이 유일한 정리 방법이다.
 * 안 지우면 죽은 구독이 계속 쌓이고 발송 시간만 늘어난다.
 */
export async function sendWebPush(
  supabase: SupabaseClient<any, any, any>,
  subscriptions: PushSubscriptionRow[],
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  if (subscriptions.length === 0 || !configured()) return

  const dead: string[] = []
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        )
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) dead.push(sub.id)
        else console.error("[web-push] 전송 실패:", status, err)
      }
    }),
  )

  if (dead.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", dead)
    console.info(`[web-push] 만료된 구독 ${dead.length}건 정리`)
  }
}
