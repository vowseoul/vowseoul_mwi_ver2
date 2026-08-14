"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * "복사 → 일정 시간 복사됨 피드백 → 원복" 패턴을 훅 하나로 통일한다.
 * 목록의 항목별 복사 버튼처럼 여러 개가 있는 화면에서는 각 버튼이 서로 다른
 * key로 copy()를 부르면 그 key 하나만 복사됨 상태가 된다 — 단일 버튼은 key를
 * 생략하면 된다. 타임아웃도 여기 하나로 통일한다(이전엔 화면마다 1.5~2초로 제각각).
 */
export function useCopyFeedback(ms = 2000) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  const copy = useCallback(async (text: string, key: string = "default") => {
    // 클립보드 API가 없는 환경(카카오톡 인앱 브라우저 등)에서도 조용히 넘어간다
    await navigator.clipboard?.writeText(text)
    setCopiedKey(key)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopiedKey(null), ms)
  }, [ms])

  const isCopied = useCallback((key: string = "default") => copiedKey === key, [copiedKey])

  return { copiedKey, copy, isCopied }
}
