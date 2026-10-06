"use client"

import { useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"
import type { KakaoCardContent } from "@/lib/kakao-share"

/**
 * 편집기 "카카오톡 공유" 카드의 미리보기 — 카카오톡 말풍선 모양을 흉내 낸 것이다.
 * 내용(사진·제목·설명)은 실제로 내보내는 곳과 같은 규칙(§lib/kakao-share.ts)으로 정해지지만,
 * 사진을 자르는 위치·비율과 글자 줄 수는 카카오톡 앱이 정하므로 실제와 조금 다를 수 있다.
 * 색은 카카오톡 화면을 그린 것이라 관리자 화면 테마를 따르지 않는다.
 */

function CardImage({ src, aspect }: { src: string; aspect: string }) {
  if (!src) {
    return (
      <div className="flex items-center justify-center bg-[#ececec] text-[11px] text-[#9a9a9a]" style={{ aspectRatio: aspect }}>
        사진 없음
      </div>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="block w-full object-cover" style={{ aspectRatio: aspect }} />
}

function useHost(): string {
  const [host, setHost] = useState("")
  useEffect(() => setHost(window.location.host), [])
  return host
}

/** 카카오톡에 주소를 붙여넣었을 때 카카오가 만드는 링크 미리보기 */
export function LinkPreviewCard({ content }: { content: KakaoCardContent }) {
  const host = useHost()
  return (
    <div className="w-full max-w-[260px] overflow-hidden rounded-xl border border-[#e5e5e5] bg-white text-[#191919] shadow-sm">
      <CardImage src={content.image} aspect="1.91 / 1" />
      <div className="space-y-1 p-3">
        <p className="line-clamp-2 text-[14px] font-semibold leading-snug">{content.title}</p>
        {content.description && (
          <p className="line-clamp-2 text-[12px] leading-snug text-[#7a7a7a]">{content.description}</p>
        )}
        {host && <p className="truncate pt-1 text-[11px] text-[#3a73c9] underline">{host}</p>}
      </div>
    </div>
  )
}

/** 청첩장 하단 "카카오톡 공유" 버튼으로 보내는 카드 */
export function ShareButtonCard({ content, hasLocation }: { content: KakaoCardContent; hasLocation: boolean }) {
  return (
    <div className="w-full max-w-[260px] overflow-hidden rounded-xl border border-[#e5e5e5] bg-white text-[#191919] shadow-sm">
      <CardImage src={content.image} aspect="4 / 3" />
      <div className="space-y-1 p-3">
        <p className="line-clamp-2 text-[14px] font-semibold leading-snug">{content.title}</p>
        {content.description && (
          <p className="line-clamp-2 whitespace-pre-line text-[12px] leading-snug text-[#7a7a7a]">{content.description}</p>
        )}
        <div className="flex gap-1.5 pt-2">
          <span className="flex-1 rounded-lg bg-[#f2f2f2] py-2 text-center text-[12px]">청첩장 보기</span>
          {hasLocation && <span className="flex-1 rounded-lg bg-[#f2f2f2] py-2 text-center text-[12px]">위치 보기</span>}
        </div>
        <div className="flex items-center justify-between pt-1.5 text-[11px] text-[#9a9a9a]">
          <span>VOWSEOUL</span>
          <ChevronRight className="h-3 w-3" />
        </div>
      </div>
    </div>
  )
}
