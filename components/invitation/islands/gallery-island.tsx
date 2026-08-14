"use client"

import { useEffect, useRef, useState } from "react"
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

  const thumbnails = isGrid ? (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, width: "100%" }}>
      {images.map((src, i) => (
        <div key={i} onClick={() => setLightboxIndex(i)} style={{ aspectRatio: "1/1", overflow: "hidden", cursor: "pointer" }}>
          <FadeImage src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition }} />
        </div>
      ))}
    </div>
  ) : (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", width: "100%", paddingBottom: 8, scrollSnapType: "x mandatory" }}>
      {images.map((src, i) => (
        <div
          key={i}
          onClick={() => setLightboxIndex(i)}
          style={{ width: 220, height: 280, flexShrink: 0, scrollSnapAlign: "center", overflow: "hidden", cursor: "pointer" }}
        >
          <FadeImage src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition }} />
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
