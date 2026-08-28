"use client"

import { useEffect, useRef, useState } from "react"
import { isToggledOn } from "@/lib/invitation-data"
import type { SlotProps } from "./shared"

/* ------------------------------- BGM ------------------------------- *
 * 이전 버전에서 안정적으로 동작하던 로직을 그대로 이식.
 * 자동재생을 시도하고, 브라우저 정책으로 막히면 첫 클릭/터치에 재생한다.
 * iframe 내부에 렌더되므로 이벤트는 iframe 문서에도 함께 등록한다.
 * ------------------------------------------------------------------ */
/** 모든 BgmIsland 인스턴스가 공유하는 "현재 재생 중인 오디오" 싱글턴.
 * 테마 전환 시 iframe이 다시 write()되며 포탈 대상이 바뀌는 타이밍에 따라 이전 인스턴스의
 * cleanup이 새 인스턴스의 재생 시작보다 늦게(또는 아예 누락되어) 실행되는 경우가 있어,
 * 인스턴스별 ref만으로는 두 음원이 겹쳐 재생되거나 화면에서 사라진 이전 음원을 끌 방법이
 * 없어지는 문제가 있었다. 새 오디오를 재생하기 전 항상 이 싱글턴부터 정지시켜 "동시에
 * 최대 한 개만 재생된다"를 인스턴스 생명주기와 무관하게 구조적으로 보장한다. */
let currentBgmAudio: HTMLAudioElement | null = null
function stopCurrentBgm() {
  currentBgmAudio?.pause()
  currentBgmAudio = null
}

function BgmIsland({ accent, data, raw }: SlotProps) {
  const bgmUrl = (typeof raw?.bgm_url === "string" ? raw.bgm_url : undefined) || data.bgm_url || ""
  // 자동재생은 관리자가 켠 청첩장에서만 시도한다 — 청첩장을 열자마자 예고 없이 음악이 나오면
  // 조용한 자리에서 열어본 하객이 당황한다. 미설정(기존 청첩장 전부)은 꺼짐이므로 하객이
  // 우측 상단 ♪ 버튼을 눌러야 재생된다(§isToggledOn: 미설정=꺼짐).
  const autoplay = isToggledOn(raw?.bgm_autoplay)
  const [isPlaying, setIsPlaying] = useState(autoplay)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const anchorRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    let playOnInteraction: (() => void) | null = null
    // 아일랜드가 속한 문서(iframe) + 부모 문서 모두에 폴백 리스너 등록
    const docs: Document[] = []
    const own = anchorRef.current?.ownerDocument
    if (own) docs.push(own)
    if (typeof document !== "undefined" && own !== document) docs.push(document)

    if (bgmUrl && isPlaying) {
      if (!audioRef.current || audioRef.current.src !== bgmUrl) {
        stopCurrentBgm()
        audioRef.current = new Audio(bgmUrl)
        audioRef.current.loop = true
      }
      currentBgmAudio = audioRef.current

      audioRef.current.play().catch(() => {
        // 자동재생 차단 → 첫 사용자 상호작용에 재생
        playOnInteraction = () => {
          audioRef.current?.play().then(() => {
            if (playOnInteraction) {
              docs.forEach((d) => {
                d.removeEventListener("click", playOnInteraction!)
                d.removeEventListener("touchstart", playOnInteraction!)
              })
            }
          }).catch(() => { /* 재시도 실패는 무시 */ })
        }
        docs.forEach((d) => {
          d.addEventListener("click", playOnInteraction!)
          d.addEventListener("touchstart", playOnInteraction!)
        })
      })
    } else if (audioRef.current) {
      audioRef.current.pause()
      if (currentBgmAudio === audioRef.current) currentBgmAudio = null
    }

    return () => {
      audioRef.current?.pause()
      if (currentBgmAudio === audioRef.current) currentBgmAudio = null
      if (playOnInteraction) {
        docs.forEach((d) => {
          d.removeEventListener("click", playOnInteraction!)
          d.removeEventListener("touchstart", playOnInteraction!)
        })
      }
    }
  }, [bgmUrl, isPlaying])

  // 화면을 실제로 보고 있을 때만 재생 — 하객이 청첩장 탭을 닫지 않은 채 다른 앱/탭으로
  // 넘어가거나 화면을 끄면 음악만 계속 흐르는 문제가 있었다. 재생 의사(isPlaying)는 그대로
  // 두고 오디오만 멈췄다가, 다시 돌아오면 이어서 재생한다(사용자가 ❚❚ 로 끈 경우는 건드리지 않음).
  // iframe 문서의 visibilityState 는 최상위 탭 상태를 따라가지만 환경에 따라 부모 문서에만
  // 이벤트가 오는 경우가 있어 양쪽 문서 모두에 리스너를 건다(§위 재생 폴백과 동일한 이유).
  useEffect(() => {
    const own = anchorRef.current?.ownerDocument
    const docs: Document[] = []
    if (own) docs.push(own)
    if (typeof document !== "undefined" && own !== document) docs.push(document)
    if (docs.length === 0) return

    const onVisibilityChange = () => {
      const audio = audioRef.current
      if (!audio) return
      if (docs.some((d) => d.visibilityState === "hidden")) audio.pause()
      else if (isPlaying) audio.play().catch(() => { /* 복귀 직후 재생 차단은 무시 */ })
    }
    docs.forEach((d) => d.addEventListener("visibilitychange", onVisibilityChange))
    return () => docs.forEach((d) => d.removeEventListener("visibilitychange", onVisibilityChange))
  }, [isPlaying])

  if (!bgmUrl) return <button ref={anchorRef} style={{ display: "none" }} aria-hidden />

  return (
    <button
      ref={anchorRef}
      onClick={() => setIsPlaying((p) => !p)}
      aria-label={isPlaying ? "배경음악 일시정지" : "배경음악 재생"}
      style={{
        position: "fixed", top: 16, right: 16, zIndex: 50,
        width: 40, height: 40, borderRadius: "50%", cursor: "pointer",
        background: "rgba(255,255,255,.8)", backdropFilter: "blur(4px)",
        border: "1px solid rgba(0,0,0,.08)", boxShadow: "0 4px 12px rgba(0,0,0,.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: isPlaying ? accent : "#9ca3af", fontSize: 13, lineHeight: 1,
      }}
    >
      {isPlaying ? "❚❚" : "♪"}
    </button>
  )
}

export { BgmIsland }
