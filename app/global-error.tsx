'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

/**
 * app/error.tsx는 루트 레이아웃 자체가 던지는 예외는 잡지 못한다(레이아웃보다
 * 바깥이라서) — Sentry Next.js 통합이 권장하는 global-error.tsx로 그 틈을 메운다.
 * <html>/<body>를 직접 렌더해야 한다(루트 레이아웃이 아예 실패한 상태이므로).
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    console.error('Global error:', error)
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div style={{
          minHeight: '100dvh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
          textAlign: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif',
        }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>일시적인 문제가 발생했습니다</p>
          <p style={{ fontSize: 13.5, color: '#6b6b6b', maxWidth: 320 }}>
            잠시 후 페이지를 새로고침해주세요.
          </p>
        </div>
      </body>
    </html>
  )
}
