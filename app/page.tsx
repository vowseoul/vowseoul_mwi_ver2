'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const LINKTREE_URL = 'https://linktr.ee/vowseoul'

/**
 * 사이트 루트는 두 갈래다.
 *  - 홈 화면에 추가한 웹앱(standalone)으로 열면 관리자 화면으로 — 설치된 아이콘의 시작 주소가
 *    "/"라서, 여기서 걸러내지 않으면 앱 아이콘이 링크트리로 연결된다. 서버는 앱으로 열렸는지
 *    알 수 없어 클라이언트에서 판별한다(manifest start_url/id를 바꾸면 이미 설치된 앱이 새
 *    앱으로 취급되므로 건드리지 않는다).
 *  - 그 외(카카오톡 공유 카드의 앱 아이콘 화살표 등 하객이 들어오는 길)는 공식 링크트리로.
 */
export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) router.replace('/admin')
    else window.location.replace(LINKTREE_URL)
  }, [router])

  return null
}
