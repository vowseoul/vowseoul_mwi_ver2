"use client"

import { useEffect } from "react"

/**
 * 화면 제목을 브라우저 탭에 반영한다.
 *
 * 관리자 화면은 전부 'use client' 라 Next 의 metadata 를 내보낼 수 없고, 그래서 12개
 * 화면이 모두 루트 기본값("VOW SEOUL | 모바일 청첩장")으로 떴다. 고객 상세와 폼 빌더와
 * 설정을 탭 세 개로 띄워두면 어느 것이 어느 것인지 구분되지 않는다.
 *
 * 화면마다 layout.tsx 를 두는 방법도 있지만 제목 한 줄을 위해 파일 12개가 늘어난다 —
 * 여기서는 훅 하나로 끝낸다. 서버 렌더 시점의 제목은 기본값 그대로이고 마운트 직후
 * 바뀌는데, 로그인이 필요한 내부 화면이라 그 차이가 문제되지 않는다.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | VOW SEOUL`
  }, [title])
}
