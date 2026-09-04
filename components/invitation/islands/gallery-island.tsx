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
  const overlayRef = useRef<HTMLDivElement>(null)
  /** 사진들을 가로로 늘어놓은 띠. 이 띠를 옮겨서 넘긴다 */
  const trackRef = useRef<HTMLDivElement>(null)
  /** 이번 이동은 애니메이션 없이 — 처음 열 때와, 끝에서 처음으로 순환할 때 */
  const jumpRef = useRef(true)
  const lightboxOpen = lightboxIndex !== null

  /** 한 장 옮긴다. 끝↔처음으로 감길 때는 중간 사진들을 훑고 지나가지 않도록 즉시 옮긴다 */
  const step = (dir: 1 | -1) => {
    if (lightboxIndex === null || images.length < 2) return
    const target = (lightboxIndex + dir + images.length) % images.length
    jumpRef.current = Math.abs(target - lightboxIndex) !== 1
    setLightboxIndex(target)
  }
  const prev = () => step(-1)
  const next = () => step(1)

  /**
   * 라이트박스가 열려 있는 동안 뒤에 깔린 청첩장이 따라 스크롤되지 않게 잠근다.
   *
   * overflow:hidden 만으로는 iOS 사파리에서 손가락 스크롤이 그대로 먹는다 — 그래서
   * body 를 fixed 로 띄우고 그만큼 top 을 당겨 화면을 붙잡아 둔다. 닫을 때 원래 위치로
   * 되돌리지 않으면 사진을 닫는 순간 청첩장 맨 위로 튄다.
   *
   * 청첩장은 iframe 안이라(§invitation-frame) 잠가야 할 것은 부모 페이지가 아니라
   * 이 아일랜드가 속한 문서다.
   */
  useEffect(() => {
    if (!lightboxOpen) return
    const doc = rootRef.current?.ownerDocument
    const win = doc?.defaultView
    if (!doc || !win) return

    const body = doc.body
    const root = doc.documentElement
    const scrollY = win.scrollY
    const saved = {
      position: body.style.position, top: body.style.top, width: body.style.width,
      overflow: body.style.overflow, overscroll: root.style.overscrollBehavior,
    }

    body.style.position = "fixed"
    body.style.top = `-${scrollY}px`
    body.style.width = "100%"
    body.style.overflow = "hidden"
    root.style.overscrollBehavior = "none"

    return () => {
      body.style.position = saved.position
      body.style.top = saved.top
      body.style.width = saved.width
      body.style.overflow = saved.overflow
      root.style.overscrollBehavior = saved.overscroll
      win.scrollTo(0, scrollY)
    }
  }, [lightboxOpen])

  /** 띠를 지금 사진 자리로 옮긴다. transform 을 JSX 에 두지 않는 이유는 손가락을 따라
   *  움직이는 동안 같은 값을 React 와 서로 덮어쓰게 되기 때문이다 — 여기 한 곳에서만 쓴다. */
  useEffect(() => {
    const track = trackRef.current
    if (!track || lightboxIndex === null) return
    track.style.transition = jumpRef.current ? "none" : "transform .3s cubic-bezier(.22,.61,.36,1)"
    track.style.transform = `translate3d(${-lightboxIndex * 100}%, 0, 0)`
    jumpRef.current = false
  }, [lightboxIndex])

  /**
   * 손가락을 따라 사진이 밀리고, 놓으면 넘어가거나 제자리로 돌아온다.
   *
   * touchmove 를 passive:false 로 직접 걸어야 preventDefault 가 먹는다. 이게 없으면
   * 카카오톡 인앱 브라우저에서 세로로 밀 때 화면 전체가 고무줄처럼 튕긴다 —
   * body 를 fixed 로 잠가도 브라우저의 오버스크롤 바운스까지는 막지 못한다.
   * 손가락 두 개(확대)는 그대로 둔다.
   */
  const swipedRef = useRef(false)
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay || lightboxIndex === null) return

    let startX = 0
    let startY = 0
    let tracking = false

    const onStart = (e: TouchEvent) => {
      swipedRef.current = false
      tracking = e.touches.length === 1
      if (!tracking) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }

    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 1) e.preventDefault()
      if (!tracking || images.length < 2) return
      const dx = e.touches[0].clientX - startX
      const track = trackRef.current
      if (!track) return
      track.style.transition = "none"
      track.style.transform = `translate3d(calc(${-lightboxIndex * 100}% + ${dx}px), 0, 0)`
    }

    const settle = () => {
      const track = trackRef.current
      if (!track) return
      track.style.transition = "transform .3s cubic-bezier(.22,.61,.36,1)"
      track.style.transform = `translate3d(${-lightboxIndex * 100}%, 0, 0)`
    }

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false
      const t = e.changedTouches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      // 세로로 더 많이 움직였으면 넘기지 않는다 — 사진을 살펴보려 훑는 동작까지
      // 넘김으로 처리하면 원하는 사진에 머무를 수가 없다.
      if (images.length < 2 || Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) {
        settle()
        return
      }
      swipedRef.current = true
      // prev()/next() 를 부르지 않고 여기서 계산한다 — 그 함수들은 렌더마다 새로 생겨
      // 의존성에 넣으면 이 리스너가 매 렌더 다시 붙는다.
      const target = (lightboxIndex + (dx > 0 ? -1 : 1) + images.length) % images.length
      jumpRef.current = Math.abs(target - lightboxIndex) !== 1
      setLightboxIndex(target)
    }

    overlay.addEventListener("touchstart", onStart, { passive: false })
    overlay.addEventListener("touchmove", onMove, { passive: false })
    overlay.addEventListener("touchend", onEnd)
    overlay.addEventListener("touchcancel", onEnd)
    return () => {
      overlay.removeEventListener("touchstart", onStart)
      overlay.removeEventListener("touchmove", onMove)
      overlay.removeEventListener("touchend", onEnd)
      overlay.removeEventListener("touchcancel", onEnd)
    }
  }, [lightboxIndex, images.length])

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

  const openLightbox = (i: number) => {
    if (zoomBlocked) return
    jumpRef.current = true // 열 때는 눌러 놓은 사진이 곧바로 떠야 한다
    setLightboxIndex(i)
  }
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
          ref={overlayRef}
          onClick={() => {
            if (swipedRef.current) { swipedRef.current = false; return }
            setLightboxIndex(null)
          }}
          style={{
            position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
            // 잠금을 뚫고 스크롤이 조상으로 흘러가는 것까지 막는다
            overscrollBehavior: "none",
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
          {/* 사진을 가로로 늘어놓은 띠. 한 칸이 화면 하나이고, 띠를 옮겨서 넘긴다 —
              보이는 것만 갈아끼우면 손가락을 따라오는 느낌이 나지 않는다. */}
          <div
            ref={trackRef}
            style={{ display: "flex", width: "100%", height: "100%", willChange: "transform" }}
          >
            {images.map((src, i) => (
              <div
                key={i}
                style={{
                  flex: "0 0 100%", height: "100%", padding: 24, boxSizing: "border-box",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <img
                  src={src}
                  alt=""
                  onClick={(e) => e.stopPropagation()}
                  draggable={false}
                  style={{ maxWidth: "100%", maxHeight: "85vh", objectFit: "contain" }}
                />
              </div>
            ))}
          </div>
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
