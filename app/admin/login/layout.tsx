import type { Metadata } from 'next'

/** login/page.tsx 가 'use client' 라 제목만 여기서 지정한다 (§app/templates/layout.tsx) */
export const metadata: Metadata = {
  title: '관리자 로그인 | VOW SEOUL',
}

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
