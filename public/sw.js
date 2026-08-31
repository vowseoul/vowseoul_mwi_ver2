/**
 * 알림 전용 서비스워커.
 *
 * 오프라인 캐싱은 하지 않는다 — 관리자 화면은 언제나 최신 데이터를 봐야 하고,
 * 캐시를 끼우는 순간 "왜 옛날 게 보이지"를 디버깅하게 된다. 여기서는 푸시를 받아
 * 알림으로 띄우고, 눌렀을 때 해당 화면을 여는 일만 한다.
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'VOW SEOUL', body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'VOW SEOUL', {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url || '/admin' },
      // 같은 태그로 묶으면 연달아 온 알림이 목록을 채우지 않고 최신 것만 남는다
      tag: 'vowseoul-admin',
      renotify: true,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/admin'

  // 이미 열려 있는 창이 있으면 새 탭을 만들지 않고 그 창을 옮긴다 —
  // 알림을 누를 때마다 탭이 늘어나면 금세 못 쓰게 된다.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('/admin') && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
