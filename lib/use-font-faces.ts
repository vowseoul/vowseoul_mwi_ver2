"use client"

import { useEffect } from "react"
import { buildFontFaceCss, type RegisteredFont } from "@/lib/fonts"

/**
 * 현재(iframe이 아닌) 문서에 등록 폰트들을 실제로 로드해, 폰트 이름을 "그 폰트로" 미리보여줄 수
 * 있게 한다. 에셋 관리(폰트 목록)와 편집기(타이포그래피 폰트 선택)에서 공용으로 쓴다.
 * iframe 내부용 로딩은 invitation-frame.tsx 의 별도 useEffect가 담당한다(realm이 달라 공유 불가).
 *
 * lib/fonts.ts 가 아니라 별도 파일("use client")로 둔 이유: lib/fonts.ts 는
 * app/w/[slug]/page.tsx(Server Component)에서도 직접 import 되는데, 여기 useEffect를
 * 같이 두면 "Server Component 모듈 그래프에 클라이언트 전용 훅이 섞였다"는 빌드 에러가 난다.
 */
export function useInjectFontFaces(fonts: RegisteredFont[], styleId = "registered-font-faces-preview") {
  useEffect(() => {
    if (typeof document === "undefined") return
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement("style")
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = fonts.map(buildFontFaceCss).filter(Boolean).join("\n")
  }, [fonts, styleId])
}
