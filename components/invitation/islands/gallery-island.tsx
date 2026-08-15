"use client"

import { useEffect, useRef, useState } from "react"
import { isToggledOn } from "@/lib/invitation-data"
import type { SlotProps } from "./shared"


/* ----------------------------- Gallery -----------------------------
 * 뷰 타입 2종(이전 버전 invitation-client.tsx 구조 참고):
 *  - slide: 가로 스크롤 스냅 스트립. 감싸는 박스 여백/모서리 없이 object-fit:cover 로
 *    사진 형태와 무관하게 꽉 채워 배치하고, gallery_align('center'|'bottom')으로
 *    세로 크롭 기준점을 고른다(인물 전신 사진 등에서 하단을 살리고 싶을 때 사용).
 *  - grid : 2열 그리드, object-cover (정방형 썸네일)
 * raw.gallery_view_type ('slide' | 'grid', 기본 slide) 로 선택.
 * 모서리 둥글기(border-radius)는 두 방식 모두 사용하지 않는다.
 * ------------------------------------------------------------------ */
const SAMPLE_GALLERY = [
  "https://images.unsplash.com/photo-1519741497674-611481863552?w=500&q=80",
  "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=500&q=80",
  "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=500&q=80",
  "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=500&q=80",
]
/** 로드 완료 시 서서히 나타나는 이미지 — 사진이 뚝뚝 튀어나오는 대신 부드럽게 채워진다.
 * 캐시된 이미지도 브라우저가 load 이벤트를 다시 쏴 주므로 항상 정상 동작한다. */
function FadeImage({ src, alt, style }: { src: string; alt: string; style?: React.CSSProperties }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      src={src}
      alt={alt}
      onLoad={() => setLoaded(true)}
      style={{ ...style, opacity: loaded ? 1 : 0, transition: "opacity 400ms ease-out" }}
    />
  )
}
function GalleryIsland({ raw }: SlotProps) {
  const rawImages = raw?.gallery_images
  const images = Array.isArray(rawImages) && rawImages.length > 0
    ? rawImages.filter((u): u is string => typeof u === "string")
    : SAMPLE_GALLERY
  const isGrid = raw?.gallery_view_type === "grid"
  const objectPosition = raw?.gallery_align === "bottom" ? "center bottom" : "center center"

  /** 확대방지 — 켜면 하객이 갤러리 사진을 어떤 방법으로도 크게 볼 수 없다:
   *  라이트박스(클릭 확대) 비활성 + 핀치줌/더블탭/Ctrl+휠 차단 + 드래그·길게눌러 저장 차단.
   *  미설정은 꺼짐이라 기존 청첩장 동작은 그대로다(§isToggledOn). */
  const zoomBlocked = isToggledOn(raw?.gallery_zoom_block)

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const prev = () => setLightboxIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length))
  const next = () => setLightboxIndex((i) => (i === null ? null : (i + 1) % images.length))

  // 라이트박스가 열려있을 때 ESC/방향키 조작 — iframe(별도 realm)에 포탈되므로
  // BgmIsland 와 동일하게 이 아일랜드가 속한 문서에 직접 리스너를 건다.
  useEffect(() => {
    if (lightboxIndex === null) return
    const doc = rootRef.current?.ownerDocument
    if (!doc) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null)
      else if (e.key === "ArrowLeft") prev()
      else if (e.key === "ArrowRight") next()
    }
    doc.addEventListener("keydown", onKeyDown)
    return () => doc.removeEventListener("keydown", onKeyDown)
  }, [lightboxIndex, images.length])

  // 확대방지가 켜졌을 때 갤러리 영역 안에서만 확대 제스처를 막는다. 문서 전체를 막는
  // InvitationFrame 의 preventZoom 과 달리 이건 발행/미리보기/검수 어느 화면에서든,
  // 그리고 갤러리 사진에 한해서만 동작해야 하므로 이 아일랜드가 직접 건다.
  // passive:false 로 걸어야 preventDefault 가 먹는다. 손가락 하나(가로 스와이프로 슬라이드
  // 넘기기)는 반드시 살려둬야 하므로 touches.length > 1 인 경우만 막는다.
  useEffect(() => {
    if (!zoomBlocked) return
    const root = rootRef.current
    if (!root) return

    const blockMultiTouch = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault() }
    const blockCtrlWheel = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault() } // PC 트랙패드 핀치 / Ctrl+휠
    const blockDefault = (e: Event) => e.preventDefault()                            // 우클릭·길게눌러 저장·드래그·더블클릭
    let lastTouchEnd = 0
    const blockDoubleTap = (e: TouchEvent) => {
      const now = Date.now()
      if (now - lastTouchEnd <= 300) e.preventDefault()
      lastTouchEnd = now
    }

    root.addEventListener("touchstart", blockMultiTouch, { passive: false })
    root.addEventListener("touchmove", blockMultiTouch, { passive: false })
    root.addEventListener("touchend", blockDoubleTap, { passive: false })
    root.addEventListener("wheel", blockCtrlWheel, { passive: false })
    root.addEventListener("contextmenu", blockDefault)
    root.addEventListener("dragstart", blockDefault)
    root.addEventListener("dblclick", blockDefault)
    return () => {
      root.removeEventListener("touchstart", blockMultiTouch)
      root.removeEventListener("touchmove", blockMultiTouch)
      root.removeEventListener("touchend", blockDoubleTap)
      root.removeEventListener("wheel", blockCtrlWheel)
      root.removeEventListener("contextmenu", blockDefault)
      root.removeEventListener("dragstart", blockDefault)
      root.removeEventListener("dblclick", blockDefault)
    }
  }, [zoomBlocked])

  const openLightbox = (i: number) => { if (!zoomBlocked) setLightboxIndex(i) }
  // 확대방지 시 사진 자체의 선택·길게눌러 저장·드래그를 CSS 레벨에서도 막는다
  // (위 이벤트 리스너와 이중으로 — iOS 사파리는 -webkit-touch-callout 없이는 길게 눌렀을 때
  //  이미지 저장 시트가 그대로 뜬다).
  const imgStyle: React.CSSProperties = {
    width: "100%", height: "100%", objectFit: "cover", objectPosition,
    ...(zoomBlocked ? { userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", pointerEvents: "none" } as React.CSSProperties : {}),
  }
  const tileCursor = zoomBlocked ? "default" : "pointer"

  const thumbnails = isGrid ? (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, width: "100%" }}>
      {images.map((src, i) => (
        <div key={i} onClick={() => openLightbox(i)} style={{ aspectRatio: "1/1", overflow: "hidden", cursor: tileCursor }}>
          <FadeImage src={src} alt="" style={imgStyle} />
        </div>
      ))}
    </div>
  ) : (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", width: "100%", paddingBottom: 8, scrollSnapType: "x mandatory" }}>
      {images.map((src, i) => (
        <div
          key={i}
          onClick={() => openLightbox(i)}
          style={{ width: 220, height: 280, flexShrink: 0, scrollSnapAlign: "center", overflow: "hidden", cursor: tileCursor }}
        >
          <FadeImage src={src} alt="" style={imgStyle} />
        </div>
      ))}
    </div>
  )

  const navBtnStyle: React.CSSProperties = {
    position: "absolute", top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%",
    border: "none", background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 22, lineHeight: 1, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  }

  return (
    <div ref={rootRef}>
      {thumbnails}
      {lightboxIndex !== null && (
        <div
          onClick={() => setLightboxIndex(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,.92)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null) }}
            style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 16, cursor: "pointer" }}
            aria-label="닫기"
          >
            ✕
          </button>
          {images.length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); prev() }} style={{ ...navBtnStyle, left: 12 }} aria-label="이전 사진">‹</button>
          )}
          <img
            src={images[lightboxIndex]}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "100%", maxHeight: "85vh", objectFit: "contain" }}
          />
          {images.length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); next() }} style={{ ...navBtnStyle, right: 12 }} aria-label="다음 사진">›</button>
          )}
          {images.length > 1 && (
            <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", color: "#fff", fontSize: 12, opacity: 0.8 }}>
              {lightboxIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export { GalleryIsland }
