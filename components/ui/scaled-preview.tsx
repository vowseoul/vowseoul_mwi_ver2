'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 고정 픽셀 크기 콘텐츠(휴대폰 목업, 미리보기 iframe 등)를 부모 컨테이너 너비에 맞춰
 * transform: scale로 축소해 보여준다. 모바일처럼 좁은 화면에서 내용이 잘리거나
 * 가로 스크롤이 생기는 대신, 비율을 유지한 채 줄어든다. 컨테이너가 원본보다
 * 넓을 때는 1:1 크기 그대로 렌더링한다(확대는 하지 않는다).
 */
export function ScaledPreview({
  width,
  height,
  children,
  className,
}: {
  /** 콘텐츠의 원본(디자인 기준) 너비 — 목업 카드 전체 폭(테두리 포함) */
  width: number
  /** 콘텐츠의 원본(디자인 기준) 높이 */
  height: number
  children: ReactNode
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const containerWidth = el.clientWidth
      setScale(containerWidth > 0 ? Math.min(1, containerWidth / width) : 1)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])

  return (
    <div ref={containerRef} className={className ?? 'w-full'}>
      <div className="mx-auto" style={{ width: width * scale, height: height * scale }}>
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
