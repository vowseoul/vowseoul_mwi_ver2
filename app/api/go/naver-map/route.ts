import { NextResponse } from 'next/server'
import { normalizeNaverPlaceUrl } from '@/lib/naver-place'

/**
 * 네이버 지도로 리다이렉트만 하는 우리 도메인 경유지.
 *
 * 카카오톡 공유(§components/invitation/islands/share-island.tsx)의 "위치 보기" 버튼이
 * map.naver.com 을 직접 가리키면, 카카오 쪽이 "제품 링크 관리"에 등록된 도메인(우리
 * 서비스 도메인)이 아닌 링크는 신뢰하지 않고 등록된 기본 도메인 루트로 대신 보내버린다
 * (그 결과가 관리자 페이지로 튀는 버그였다). 버튼 링크를 항상 우리 도메인으로 유지하고,
 * 그 페이지가 실제 목적지로 다시 리다이렉트한다.
 *
 * naver.com/naver.me 외의 목적지는 거부한다 — 검증 없이 아무 url이나 받으면 오픈 리다이렉트가 된다.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const target = normalizeNaverPlaceUrl(searchParams.get('url'))

  if (!target) {
    return NextResponse.json({ error: 'Invalid or missing url' }, { status: 400 })
  }

  return NextResponse.redirect(target)
}
