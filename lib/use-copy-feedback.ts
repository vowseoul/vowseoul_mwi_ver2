"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * "복사 → 일정 시간 복사됨 피드백 → 원복" 패턴을 훅 하나로 통일한다.
 * 목록의 항목별 복사 버튼처럼 여러 개가 있는 화면에서는 각 버튼이 서로 다른
 * key로 copy()를 부르면 그 key 하나만 복사됨 상태가 된다 — 단일 버튼은 key를
 * 생략하면 된다. 타임아웃도 여기 하나로 통일한다(이전엔 화면마다 1.5~2초로 제각각).
 */
/**
 * 클립보드 쓰기 — 실패하면 구형 방식으로 한 번 더 시도한다.
 *
 * 원래는 `await navigator.clipboard?.writeText(text)` 한 줄이었고, 주석은 "API가 없는
 * 환경(카카오톡 인앱 브라우저 등)에서도 조용히 넘어간다"고 적혀 있었다. 실제로는 그렇지
 * 않았다 — `?.` 는 API 가 *없을* 때만 막아주고 *거부될* 때는 못 막는다. writeText 는
 * 문서에 포커스가 없거나 권한이 없으면 reject 하는데, 그 거부가 잡히지 않아 뒤따르는
 * setCopiedKey 가 아예 실행되지 않았다. 즉 주석이 지목한 바로 그 환경에서 버튼을 눌러도
 * 아무 일도 일어나지 않고, 처리되지 않은 promise 거부만 남았다.
 *
 * 하객 대부분이 카카오톡 인앱 브라우저로 청첩장을 연다 — 계좌번호 복사가 조용히
 * 안 되는 건 이 앱에서 가장 아픈 자리다.
 */
export async function writeToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // 포커스·권한 문제 — 아래 구형 방식으로 넘어간다
    }
  }
  if (typeof document === "undefined") return false
  try {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.setAttribute("readonly", "")
    // 화면 밖으로 밀지 않고 투명하게 둔다 — 위치를 옮기면 iOS 가 스크롤을 튕긴다
    ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:none;opacity:0;"
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand("copy")
    ta.remove()
    return ok
  } catch {
    return false
  }
}

export function useCopyFeedback(ms = 2000) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  const copy = useCallback(async (text: string, key: string = "default") => {
    const ok = await writeToClipboard(text)
    if (!ok) return // 실제로 복사되지 않았는데 "복사됨"이라고 하면 계좌번호를 안 든 채 붙여넣는다
    setCopiedKey(key)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopiedKey(null), ms)
  }, [ms])

  const isCopied = useCallback((key: string = "default") => copiedKey === key, [copiedKey])

  return { copiedKey, copy, isCopied }
}
