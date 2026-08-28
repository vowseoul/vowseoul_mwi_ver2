"use client"

import { useEffect } from "react"

/** 저장하지 않은 변경사항이 있을 때 새로고침/탭 닫기/뒤로가기를 브라우저 네이티브
 * 확인창으로 막는다. 앱 내 링크 이동(Next.js router)은 각 화면의 "나가기" 버튼에서
 * confirmDialog(§components/ui/confirm-dialog.tsx)로 별도 처리해야 한다 — beforeunload는
 * 브라우저 차원의 이탈만 감지할 수 있고 클라이언트 사이드 라우팅은 가로채지 못한다. */
export function useUnsavedChangesWarning(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])
}
