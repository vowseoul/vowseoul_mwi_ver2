/**
 * 브라우저 쪽 웹 푸시 구독 관리.
 *
 * 아이폰에서는 "홈 화면에 추가"로 설치한 뒤 그 아이콘으로 열었을 때만 동작한다
 * (iOS 16.4+). 사파리 탭에서는 serviceWorker 는 있어도 PushManager 가 없거나
 * 권한 요청이 거부되므로, supported 로 그 상태를 그대로 드러낸다 — 버튼을 눌렀는데
 * 아무 일도 안 일어나는 것보다 "여기선 안 된다"고 보이는 편이 낫다.
 */

export interface PushState {
  supported: boolean
  permission: NotificationPermission
  subscribed: boolean
}

function supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js')
}

export async function pushState(): Promise<PushState> {
  if (!supported()) return { supported: false, permission: 'default', subscribed: false }
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = reg ? await reg.pushManager.getSubscription() : null
    return { supported: true, permission: Notification.permission, subscribed: !!sub }
  } catch {
    return { supported: true, permission: Notification.permission, subscribed: false }
  }
}

/** base64url VAPID 공개키를 pushManager 가 요구하는 바이트 배열로 */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export async function subscribeToPush(): Promise<PushState> {
  if (!supported()) throw new Error('이 브라우저에서는 지원하지 않습니다.')

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapid) throw new Error('서버에 알림 키가 설정되지 않았습니다. 관리자에게 문의해주세요.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('알림 권한이 허용되지 않았습니다.')

  const reg = await registration()
  await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
    }))

  const res = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '알림을 켜지 못했습니다.')

  return { supported: true, permission: 'granted', subscribed: true }
}

export async function unsubscribeFromPush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  const sub = reg ? await reg.pushManager.getSubscription() : null
  if (sub) {
    await fetch('/api/push-subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    })
    await sub.unsubscribe()
  }
  return { supported: supported(), permission: Notification.permission, subscribed: false }
}
