"use client"

import { useEffect, useState } from "react"
import { useCopyFeedback } from "@/lib/use-copy-feedback"
import { soft, type SlotProps } from "./shared"

interface KakaoGlobal {
  init: (key: string) => void
  isInitialized: () => boolean
  Share: { sendDefault: (options: Record<string, unknown>) => void }
}

/** NEXT_PUBLIC_KAKAO_JS_KEY가 설정된 경우에만 SDK를 로드해 초기화한다 — 키가 없으면
 * 아예 로드를 시도하지 않고 카카오 공유 버튼도 노출하지 않는다(무료 카카오 개발자
 * 콘솔에서 JS 앱 키를 발급받아야 한다 — 비즈메시지 파트너사 계약과는 무관하다). */
function useKakaoShare(): KakaoGlobal | null {
  const [kakao, setKakao] = useState<KakaoGlobal | null>(null)
  const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY

  useEffect(() => {
    if (!kakaoKey || typeof window === "undefined") return
    const w = window as typeof window & { Kakao?: KakaoGlobal }
    if (w.Kakao) {
      if (!w.Kakao.isInitialized()) w.Kakao.init(kakaoKey)
      setKakao(w.Kakao)
      return
    }
    const script = document.createElement("script")
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.5/kakao.min.js"
    script.async = true
    script.onload = () => {
      if (w.Kakao && !w.Kakao.isInitialized()) w.Kakao.init(kakaoKey)
      if (w.Kakao) setKakao(w.Kakao)
    }
    document.head.appendChild(script)
  }, [kakaoKey])

  return kakao
}

/** VOW SEOUL 로고타입 — currentColor로 채워 어떤 테마 배경 위에서도 본문 색을 그대로 따라간다 */
function VowSeoulLogotype({ style }: { style: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 289.75 36.73" fill="currentColor" role="img" aria-label="VOW SEOUL" style={style}>
      <path d="M6.07.26l10.97,29.23L27.9.26h6.02l-14.23,36.22h-5.41L0,.26h6.07Z"/>
      <path d="M51.98,36.73c-2.55,0-4.88-.51-6.99-1.53-2.11-1.02-3.94-2.41-5.48-4.16-1.55-1.75-2.74-3.72-3.57-5.92-.83-2.19-1.25-4.45-1.25-6.76s.44-4.72,1.33-6.91c.88-2.19,2.12-4.15,3.7-5.87,1.58-1.72,3.42-3.08,5.51-4.08,2.09-1,4.39-1.51,6.91-1.51s4.97.53,7.06,1.58c2.09,1.05,3.9,2.47,5.43,4.23,1.53,1.77,2.7,3.74,3.52,5.92s1.22,4.42,1.22,6.73-.43,4.67-1.28,6.86c-.85,2.19-2.07,4.15-3.65,5.87-1.58,1.72-3.42,3.07-5.51,4.06-2.09.99-4.41,1.48-6.96,1.48ZM40.55,18.36c0,1.73.26,3.39.79,4.97.53,1.58,1.29,2.99,2.3,4.23,1,1.24,2.21,2.22,3.62,2.93,1.41.71,3.02,1.07,4.82,1.07s3.47-.37,4.9-1.12c1.43-.75,2.63-1.76,3.62-3.04.99-1.28,1.73-2.69,2.24-4.26.51-1.56.77-3.16.77-4.79,0-1.73-.27-3.38-.82-4.95-.54-1.56-1.33-2.97-2.35-4.21-1.02-1.24-2.24-2.22-3.65-2.93-1.41-.71-2.98-1.07-4.72-1.07-1.87,0-3.51.37-4.92,1.12s-2.61,1.75-3.6,3.01c-.99,1.26-1.73,2.67-2.24,4.23-.51,1.57-.77,3.16-.77,4.8Z"/>
      <path d="M86.82.41h5.36l4.49,12.34L101.16.41h5.41l-6.22,16.07,5.41,13.36L117.07.26h6.22l-14.79,36.22h-5l-6.78-16.22-6.84,16.22h-5L70.09.26h6.22l11.32,29.59,5.41-13.36L86.82.41Z"/>
      <path d="M148.04,8.77c-.31-.37-.79-.77-1.45-1.2-.66-.42-1.43-.82-2.3-1.17-.87-.36-1.82-.66-2.86-.92-1.04-.25-2.1-.38-3.19-.38-2.38,0-4.15.44-5.31,1.32-1.16.88-1.73,2.1-1.73,3.66,0,1.15.32,2.06.97,2.74.65.68,1.64,1.23,2.98,1.65,1.34.42,3,.87,4.97,1.35,2.48.58,4.62,1.27,6.4,2.08,1.79.81,3.16,1.88,4.13,3.2.97,1.32,1.45,3.08,1.45,5.28,0,1.79-.35,3.35-1.05,4.67-.7,1.32-1.66,2.39-2.88,3.22-1.22.83-2.64,1.45-4.23,1.85-1.6.41-3.32.61-5.15.61s-3.6-.2-5.38-.59c-1.79-.39-3.49-.95-5.1-1.68-1.61-.73-3.12-1.62-4.51-2.68l2.65-4.9c.41.44,1.04.93,1.89,1.45.85.53,1.83,1.03,2.93,1.51,1.11.48,2.31.88,3.62,1.2s2.64.48,4,.48c2.28,0,4.02-.4,5.23-1.19,1.21-.79,1.81-1.95,1.81-3.46,0-1.19-.4-2.14-1.2-2.87-.8-.73-1.94-1.35-3.42-1.85-1.48-.51-3.26-1.02-5.33-1.52-2.38-.61-4.37-1.3-5.97-2.08-1.6-.78-2.79-1.76-3.57-2.95-.78-1.19-1.17-2.73-1.17-4.62,0-2.37.57-4.38,1.71-6.02,1.14-1.64,2.71-2.88,4.72-3.71s4.23-1.25,6.68-1.25c1.63,0,3.19.18,4.67.54,1.48.36,2.86.84,4.13,1.45,1.28.61,2.41,1.31,3.39,2.09l-2.55,4.69Z"/>
      <path d="M182.62,31.42v5.05h-24.84V.26h24.38v5.05h-18.62v10.36h16.17v4.69h-16.17v11.07h19.08Z"/>
      <path d="M202.87,36.73c-2.55,0-4.88-.51-6.99-1.53-2.11-1.02-3.94-2.41-5.48-4.16-1.55-1.75-2.74-3.72-3.57-5.92-.83-2.19-1.25-4.45-1.25-6.76s.44-4.72,1.33-6.91c.88-2.19,2.12-4.15,3.7-5.87,1.58-1.72,3.42-3.08,5.51-4.08,2.09-1,4.39-1.51,6.91-1.51s4.97.53,7.06,1.58c2.09,1.05,3.9,2.47,5.43,4.23,1.53,1.77,2.7,3.74,3.52,5.92s1.22,4.42,1.22,6.73-.43,4.67-1.28,6.86c-.85,2.19-2.07,4.15-3.65,5.87-1.58,1.72-3.42,3.07-5.51,4.06-2.09.99-4.41,1.48-6.96,1.48ZM191.45,18.36c0,1.73.26,3.39.79,4.97.53,1.58,1.29,2.99,2.3,4.23,1,1.24,2.21,2.22,3.62,2.93,1.41.71,3.02,1.07,4.82,1.07s3.47-.37,4.9-1.12c1.43-.75,2.63-1.76,3.62-3.04.99-1.28,1.73-2.69,2.24-4.26.51-1.56.77-3.16.77-4.79,0-1.73-.27-3.38-.82-4.95-.54-1.56-1.33-2.97-2.35-4.21-1.02-1.24-2.24-2.22-3.65-2.93-1.41-.71-2.98-1.07-4.72-1.07-1.87,0-3.51.37-4.92,1.12s-2.61,1.75-3.6,3.01c-.99,1.26-1.73,2.67-2.24,4.23-.51,1.57-.77,3.16-.77,4.8Z"/>
      <path d="M241.34,36.73c-2.89,0-5.33-.49-7.32-1.48-1.99-.99-3.59-2.33-4.8-4.03s-2.09-3.64-2.65-5.82c-.56-2.18-.84-4.44-.84-6.78V.26h5.76v18.36c0,1.67.16,3.27.48,4.82.32,1.55.86,2.93,1.61,4.16.75,1.22,1.75,2.19,3.01,2.91,1.26.71,2.82,1.07,4.69,1.07s3.54-.36,4.79-1.07c1.26-.71,2.27-1.7,3.04-2.96.77-1.26,1.31-2.65,1.63-4.18.32-1.53.48-3.11.48-4.74V.26h5.76v18.36c0,2.48-.3,4.82-.89,7.01-.6,2.19-1.51,4.12-2.75,5.79-1.24,1.67-2.86,2.97-4.85,3.9-1.99.94-4.38,1.4-7.17,1.4Z"/>
      <path d="M264.6,36.47V.26h5.76v31.17h19.38v5.05h-25.15Z"/>
    </svg>
  )
}

function ShareIsland({ accent, data }: SlotProps) {
  const { isCopied, copy } = useCopyFeedback()
  const copied = isCopied()
  const kakao = useKakaoShare()
  const title = data.kakao_share_title || [data.groom_name, data.bride_name].filter(Boolean).join(" ♥ ") || "모바일 청첩장"

  const handleShare = () => {
    if (typeof window === "undefined") return
    const url = window.location.href
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
    if (nav.share) {
      nav.share({ title, url }).catch(() => { /* 사용자가 공유 시트를 취소한 경우 등 - 무시 */ })
      return
    }
    copy(url)
  }

  const shareViaKakao = () => {
    if (!kakao || typeof window === "undefined") return
    const url = window.location.href
    kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title,
        description: data.kakao_share_text || "저희 결혼식에 초대합니다",
        imageUrl: data.kakao_share_img || data.main_image || "",
        link: { mobileWebUrl: url, webUrl: url },
      },
      buttons: [{ title: "청첩장 보기", link: { mobileWebUrl: url, webUrl: url } }],
    })
  }

  const btnStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px", borderRadius: 20,
    border: `1px solid ${soft(40)}`, background: "transparent", color: "inherit", fontSize: 12.5,
    cursor: "pointer", opacity: 0.85,
  }

  return (
    <div style={{ paddingTop: 28 }}>
      <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {kakao && (
          <button onClick={shareViaKakao} style={{ ...btnStyle, border: "1px solid #FFE300", background: "#FFE300", color: "#3C1E1E", opacity: 1 }}>
            카카오톡 공유
          </button>
        )}
        <button onClick={handleShare} style={btnStyle}>
          {copied ? "청첩장 주소가 복사되었습니다" : "청첩장 주소 공유하기"}
        </button>
      </div>
      <VowSeoulLogotype style={{ display: "block", width: 88, height: "auto", margin: "20px auto 0", opacity: 0.5 }} />
    </div>
  )
}

export { ShareIsland }
