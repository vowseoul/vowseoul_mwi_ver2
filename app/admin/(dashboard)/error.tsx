'use client'

import React, { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Admin layout segment error:', error)
  }, [error])

  return (
    <div className="w-full h-[60vh] flex flex-col items-center justify-center font-sans px-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto text-destructive">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">문제가 발생했습니다</h2>
          <p className="text-sm text-muted-foreground font-light break-words">
            {error.message || '데이터를 로드하는 동안 에러가 발생했습니다.'}
          </p>
        </div>
        <div className="flex justify-center gap-3">
          <Button onClick={() => window.location.reload()} variant="outline">
            페이지 새로고침
          </Button>
          <Button onClick={() => reset()} variant="default">
            다시 시도
          </Button>
        </div>
      </div>
    </div>
  )
}
