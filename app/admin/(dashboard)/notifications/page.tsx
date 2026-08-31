'use client'

import { MyNotificationSettings } from '@/components/my-notification-settings'
import { useDocumentTitle } from '@/lib/use-document-title'

/**
 * 디자이너용 진입점.
 *
 * 같은 화면이 시스템 설정 > 알림 안에도 있지만(§app/admin/(dashboard)/settings),
 * 그쪽은 운영자 전용이라 디자이너가 열 수 없다. 자기 알림을 자기가 못 켜면
 * 담당자별 알림이 성립하지 않으므로 이 경로를 남겨둔다.
 */
export default function MyNotificationsPage() {
  useDocumentTitle('내 알림 설정')

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-semibold text-foreground">내 알림 설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          내가 담당하는 고객의 폼 제출·검수 알림을 어디로 받을지 정합니다. 담당자가 지정되지 않은
          고객의 알림은 전 직원에게 갑니다.
        </p>
      </div>
      <MyNotificationSettings />
    </div>
  )
}
