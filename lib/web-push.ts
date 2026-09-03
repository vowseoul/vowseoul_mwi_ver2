import webpush from "web-push"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * 웹 푸시(PWA 알림) 전송.
 *
 * 텔레그램을 쓰지 않으려는 직원을 위한 두 번째 경로다. 관리자 화면을 열어두지
 * 않아도 잠금화면에 뜬다는 점에서 헤더 벨(1분 폴링)과 다르다.
 *
 * ⚠ 아이폰 제약: iOS 16.4+ 에서만 되고, 사파리 탭이 아니라 "홈 화면에 추가"로
 *   설치한 뒤 그 아이콘으로 열었을 때만 도착한다.
 *
 * 이 모듈은 절대 throw 하지 않는다. 예전에는 setVapidDetails() 가 던지는 예외가
 * 그대로 올라가서, 환경변수 오타 하나로 고객의 폼 제출이 500 으로 실패했다 —
 * 알림을 못 보내는 것과 제출을 못 받는 것은 심각도가 다르다.
 */

export interface PushSubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

/** 보낸 건수와, 못 보냈다면 사람이 읽을 수 있는 이유 */
export interface PushResult {
  sent: number
  failed: number
  /** 설정이 잘못됐거나 아예 없을 때의 사유. 정상이면 undefined */
  reason?: string
}

/**
 * 환경변수를 web-push 에 물린다.
 *
 * 값을 그대로 넘기지 않고 다듬는 이유는 여기서 나는 오류가 전부 붙여넣기 사고라서다.
 * Vercel 대시보드에 값을 넣을 때 따옴표가 함께 들어가거나, 주제(subject)에 mailto:
 * 없이 이메일만 적는 일이 흔하다. 둘 다 setVapidDetails 가 예외를 던진다.
 */
function configure(): { ok: true } | { ok: false; reason: string } {
  const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "")

  const pub = clean(process.env.VAPID_PUBLIC_KEY)
  const priv = clean(process.env.VAPID_PRIVATE_KEY)
  if (!pub || !priv) {
    return { ok: false, reason: "서버에 VAPID 키(VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)가 설정되지 않았습니다." }
  }

  let subject = clean(process.env.VAPID_SUBJECT) || "mailto:admin@vowseoul.com"
  // 이메일만 적은 경우를 받아준다 — 사람이 "연락처"라고 읽고 이메일을 넣는 게 자연스럽다
  if (!/^(mailto:|https?:\/\/)/i.test(subject)) subject = `mailto:${subject}`

  try {
    webpush.setVapidDetails(subject, pub, priv)
    return { ok: true }
  } catch (err) {
    // 키 길이·형식이 어긋난 경우다. 원문 메시지가 어느 값이 문제인지 정확히 말해준다.
    return { ok: false, reason: `VAPID 설정이 올바르지 않습니다 — ${err instanceof Error ? err.message : String(err)}` }
  }
}

/**
 * 구독들에 알림을 보낸다.
 *
 * 404/410 은 "이 구독은 죽었다"는 뜻이라 그 행을 지운다. 브라우저는 구독이
 * 만료됐다고 미리 알려주지 않으므로, 보내보고 알아내는 것이 유일한 정리 방법이다.
 */
export async function sendWebPush(
  supabase: SupabaseClient<any, any, any>,
  subscriptions: PushSubscriptionRow[],
  payload: { title: string; body: string; url?: string },
): Promise<PushResult> {
  if (subscriptions.length === 0) return { sent: 0, failed: 0 }

  const config = configure()
  if (!config.ok) {
    console.error("[web-push]", config.reason)
    return { sent: 0, failed: subscriptions.length, reason: config.reason }
  }

  const dead: string[] = []
  let sent = 0
  let failed = 0
  let lastReason: string | undefined

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        )
        sent++
      } catch (err) {
        failed++
        const status = (err as { statusCode?: number }).statusCode
        const detail = (err as { body?: string }).body || (err as Error).message
        if (status === 404 || status === 410) {
          dead.push(sub.id)
          lastReason = "구독이 만료돼 정리했습니다. 기기에서 알림을 다시 켜주세요."
        } else {
          lastReason = `푸시 서버가 거부했습니다 (${status ?? "네트워크 오류"}) — ${String(detail).slice(0, 200)}`
        }
        console.error("[web-push] 전송 실패:", status, detail)
      }
    }),
  )

  if (dead.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", dead)
    console.info(`[web-push] 만료된 구독 ${dead.length}건 정리`)
  }
  // 한 기기만 실패해도 사유를 돌려준다 — 두 대 중 하나가 조용히 죽어 있으면
  // "왔으니 됐다"고 넘어가게 되고, 그 기기만 계속 못 받는다.
  return { sent, failed, reason: failed > 0 ? lastReason : undefined }
}
