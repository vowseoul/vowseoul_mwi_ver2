import { redirect } from 'next/navigation'

// 카카오톡 공유 카드의 앱 브랜드 아이콘(우측 하단 화살표)이 카카오에 등록된 "앱 대표
// 도메인"(이 사이트의 루트)으로 연결된다 — 하객에게 관리자 로그인 화면을 보여주는 대신
// 공식 링크트리로 보낸다.
export default function LuxuryLandingPage() {
  redirect('https://linktr.ee/vowseoul')
}
