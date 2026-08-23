import type { Metadata } from 'next'

/**
 * 페이지 제목만 지정하는 레이아웃.
 *
 * templates/page.tsx 는 'use client' 라 metadata 를 직접 내보낼 수 없다. 제목이 없으면
 * 루트 레이아웃의 "VOW SEOUL | 모바일 청첩장" 이 그대로 쓰여, 여러 탭을 띄워두면
 * 어느 것이 어느 화면인지 구분되지 않는다(문의하기·약관·개인정보는 이미 제목이 있다).
 */
export const metadata: Metadata = {
  title: '템플릿 둘러보기 | VOW SEOUL',
}

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return children
}
