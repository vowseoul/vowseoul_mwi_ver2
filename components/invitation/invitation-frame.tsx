"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

/**
 * InvitationFrame — B(하이브리드) + iframe 구조의 핵심 렌더러 프로토타입.
 *
 * 설계 원칙
 *  1) 단일 렌더러: 이 컴포넌트 하나를 발행/미리보기/에디터가 공유한다.
 *  2) iframe 격리: 테마 HTML/CSS를 <iframe srcdoc> 안에서 렌더링 → 앱 CSS와 완전 분리.
 *     테마끼리, 그리고 앱과 우선순위 충돌이 원천적으로 사라진다.
 *  3) 토큰 = CSS 변수: 색상/폰트/여백 등을 iframe 루트의 CSS 커스텀 프로퍼티로 주입.
 *     어떤 테마든 값이 결정론적으로 적용된다.
 *  4) 필드키 바인딩: 템플릿의 [data-field="키"] 요소에만 데이터가 꽂힌다.
 *     "같은 내용 = 같은 값"이 배선 레벨에서 보장된다.
 *  5) 슬롯 아일랜드: [data-slot="이름"] 위치에 React 인터랙션 컴포넌트를 portal로 마운트.
 *     정적 레이아웃/그래픽은 템플릿 자유, 인터랙션(RSVP·BGM·지도 등)은 정해진 계약으로 주입.
 */

export interface ThemeTemplate {
  key: string
  name: string
  html: string
  css: string
  /** 이 테마가 사용하는 기능(슬롯) 키 목록 = 미래 DB의 slot_manifest */
  slots?: string[]
}

export type FieldData = Record<string, string>
export type TokenMap = Record<string, string>
export type SlotMap = Record<string, React.ReactNode>

interface InvitationFrameProps {
  template: ThemeTemplate
  data: FieldData
  tokens: TokenMap
  slots?: SlotMap
  /** 프레임 너비. 모바일 청첩장이므로 기본 375px. */
  width?: number
  height?: number
}

function buildSrcDoc(template: ThemeTemplate): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!-- 기본 폰트 + 리셋 (자체 스타일시트) -->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..700;1,400&family=Cormorant+Garamond:ital,wght@0,400..600;1,400&family=Gowun+Batang:wght@400;700&family=Noto+Serif+KR:wght@300;400;600&family=Nanum+Myeongjo:wght@400;700&display=swap');
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; }
    body { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; background: var(--bg, #fff); color: var(--ink, #222); }
    img { max-width: 100%; display: block; }
  </style>
  <!-- 테마 CSS는 별도 스타일시트로 주입 → 템플릿 선두의 @import(커스텀 폰트)가 유효하게 유지됨 -->
  <style>
    ${template.css}
  </style>
</head>
<body>
${template.html}
</body>
</html>`
}

export function InvitationFrame({
  template,
  data,
  tokens,
  slots = {},
  width = 375,
  height = 720,
}: InvitationFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [doc, setDoc] = useState<Document | null>(null)
  const [slotNodes, setSlotNodes] = useState<Record<string, HTMLElement>>({})

  const srcDoc = useMemo(() => buildSrcDoc(template), [template])

  // 템플릿 문서를 iframe에 직접 write (srcDoc+onLoad 경쟁 없이 결정론적으로 준비)
  useEffect(() => {
    const iframe = iframeRef.current
    const d = iframe?.contentDocument
    if (!d) return

    d.open()
    d.write(srcDoc)
    d.close()

    const nodes: Record<string, HTMLElement> = {}
    d.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) => {
      const key = el.getAttribute("data-slot")
      if (key) nodes[key] = el
    })
    setDoc(d)
    setSlotNodes(nodes)
  }, [srcDoc])

  // 필드키 → 데이터 바인딩 (data 변경 시 재적용, iframe 리로드 없음)
  useEffect(() => {
    if (!doc) return
    doc.querySelectorAll<HTMLElement>("[data-field]").forEach((el) => {
      const key = el.getAttribute("data-field")
      if (!key) return
      const value = data[key]
      if (value == null) return
      // iframe은 별도 realm이라 instanceof HTMLImageElement가 false가 될 수 있어 tagName으로 판별
      if (el.tagName === "IMG") {
        el.setAttribute("src", value)
      } else {
        el.textContent = value
      }
    })
  }, [doc, data])

  // 토큰 → CSS 변수 주입 (tokens 변경 시 실시간 반영, 리로드 없음)
  useEffect(() => {
    if (!doc) return
    const root = doc.documentElement
    Object.entries(tokens).forEach(([name, value]) => {
      root.style.setProperty(name.startsWith("--") ? name : `--${name}`, value)
    })
  }, [doc, tokens])

  return (
    <iframe
      key={template.key}
      ref={iframeRef}
      title={`invitation-preview-${template.key}`}
      width={width}
      height={height}
      style={{
        border: "none",
        borderRadius: 12,
        boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
        background: "#fff",
      }}
    >
      {/* 슬롯 아일랜드: 로드 후 iframe 내부 DOM에 React를 portal로 마운트 */}
      {doc &&
        Object.entries(slots).map(([slotKey, node]) => {
          const target = slotNodes[slotKey]
          if (!target) return null
          return <FramePortal key={slotKey} target={target}>{node}</FramePortal>
        })}
    </iframe>
  )
}

function FramePortal({ target, children }: { target: HTMLElement; children: React.ReactNode }) {
  return createPortal(children, target)
}
