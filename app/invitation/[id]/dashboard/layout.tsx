import { Metadata } from 'next'

/**
 * 이 라우트는 비밀번호로 보호되는 신랑신부 전용 대시보드다.
 *
 * 이전 구현은 여기서 `invitations.groomName` / `orders.customerName` 을 조회해
 * 제목에 실명을 넣으려 했는데, 두 컬럼 모두 존재하지 않아(예식 정보는
 * content_data 안에 있고 orders 는 재설계됐다) 항상 catch 로 떨어져 폴백
 * 제목만 나왔다. 게다가 메타데이터는 인증 전에 생성되므로 UUID 만 아는
 * 사람에게 커플 실명이 노출된다 — 고정 제목으로 두는 편이 맞다.
 */
export const metadata: Metadata = {
  title: '청첩장 관리 대시보드',
  description: 'VOW SEOUL 모바일 청첩장 하객 RSVP 및 방명록 관리 대시보드입니다.',
  robots: { index: false, follow: false },
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
