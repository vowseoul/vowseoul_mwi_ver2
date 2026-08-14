'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

/**
 * 루트 에러 경계 — 지금까지 app/admin/(dashboard)/error.tsx만 있어서 정작
 * 매출과 직결되는 /w/[slug]·/dashboard/[slug]·/edit/[slug] 등 하객·고객向
 * 화면은 렌더링 중 예외가 나면 Next.js 기본 에러 화면이 그대로 노출됐다.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Root segment error:', error)
    Sentry.captureException(error)
  }, [error])

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
      textAlign: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif',
    }}>
      <p style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>일시적인 문제가 발생했습니다</p>
      <p style={{ fontSize: 13.5, color: '#6b6b6b', maxWidth: 320 }}>
        잠시 후 다시 시도해주세요. 문제가 계속되면 관리자에게 문의해주세요.
      </p>
      <button
        onClick={() => reset()}
        style={{
          padding: '10px 20px', borderRadius: 6, border: '1px solid #d4d4d4',
          background: '#fff', color: '#1a1a1a', fontSize: 13.5, cursor: 'pointer',
        }}
      >
        다시 시도
      </button>
    </div>
  )
}
