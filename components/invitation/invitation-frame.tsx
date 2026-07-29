"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { buildFontFaceRule } from "@/lib/fonts"

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
/** 블럭(섹션) 하나에 대한 여백/타이틀 오버라이드. lib/theme-template.ts 의 BlockOverride 와 동일한 형태 */
export interface BlockOverride {
  py?: number
  title?: string
  label?: string
  /** rsvp 블럭 전용 서브옵션 (§slot-registry.tsx RsvpIsland) */
  mealEnabled?: boolean
  shuttleEnabled?: boolean
}
export type BlockOverrideMap = Record<string, BlockOverride>
/** 섹션(블럭) 사이에 끼워 넣는 이미지. lib/theme-template.ts 의 SectionImage 와 동일한 형태 */
export interface SectionImage {
  id: string
  url: string
  afterBlock: string
  caption?: string
}
export interface FontFace {
  family: string
  /** 구글 폰트 등 @import 임베드 코드 */
  embedCode?: string
  /** 업로드된 TTF/WOFF 파일 URL */
  fileUrl?: string
}

interface InvitationFrameProps {
  template: ThemeTemplate
  data: FieldData
  tokens: TokenMap
  slots?: SlotMap
  /** 에셋 관리에 등록된 커스텀 폰트 중 --font-kr/--font-en 토큰이 가리키는 것들 (실제 로딩용) */
  fontFaces?: FontFace[]
  /** 블럭별 여백/타이틀 오버라이드. [data-block="키"] 섹션에 스코프 CSS로 주입된다 */
  blockOverrides?: BlockOverrideMap
  /** 완전히 감춰야 하는 블럭 키 목록 (꺼진 슬롯의 빈 섹션 껍데기 제거용) */
  hiddenBlocks?: string[]
  /** 이 블럭 키로 미리보기를 스크롤한다. 편집기에서 블럭 아코디언을 펼칠 때 사용 */
  focusBlock?: string | null
  /** 프레임 너비. 모바일 청첩장이므로 기본 375px. */
  width?: number
  height?: number
  /** 핀치줌·더블탭 확대 차단. 실제 발행 페이지(하객용)에서만 켠다 — 편집기/미리보기에서는
   * 관리자가 레이아웃을 확대해 볼 수 있어야 하므로 기본 꺼짐. */
  preventZoom?: boolean
  /** 섹션 사이에 끼워 넣는 이미지. afterBlock 이 가리키는 [data-block] 섹션 바로 뒤에 삽입된다 */
  sectionImages?: SectionImage[]
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
    /* [data-slot] 아일랜드(계좌·연락처·식순·방명록·RSVP·공유 등)는 React portal로 마운트되어
       테마 CSS의 개별 클래스 지정 없이 조상 요소의 font-family를 그대로 상속한다. 대부분의
       테마는 컨테이너 기본 폰트를 --font-en(영문)으로 잡고 개별 한글 요소에만 --font-kr를
       얹는 구조라, 이 규칙이 없으면 아일랜드 안의 한글 텍스트는 --font-kr을 전혀 반영하지 못한다. */
    [data-slot] { font-family: var(--font-kr, inherit); }
    /* button/input/select/textarea 는 브라우저 기본 UA 스타일상 조상의 font-family를
       상속하지 않는다(OS 위젯 폰트를 쓴다) — 위 [data-slot] 규칙만으로는 아일랜드 안의
       버튼(공유하기, 계좌 복사, RSVP 등)에 폰트가 전혀 반영되지 않아 별도로 명시한다. */
    button, input, select, textarea { font-family: inherit; }
    /* data-field-when="키" 요소는 해당 필드값이 있을 때만 보인다 — 인사말 이미지처럼
       "값이 없으면 자리 자체가 아예 없어야" 하는 선택적 요소용. main_image/groom_photo
       처럼 미설정 시 템플릿 기본 사진을 유지해야 하는 [data-field] 일반 규칙과는 다르므로
       별도 속성으로 분리했다 (아래 필드 바인딩 useEffect 참고). */
    [data-field-when] { display: none; }
    /* 섹션 사이 삽입 이미지 — 테마 무관 공용 스타일 (아래 sectionImages 삽입 useEffect 참고).
       테마마다 별도 CSS를 만들 필요 없이 어떤 테마 뒤에 꽂혀도 자연스럽게 화면 폭을 채운다. */
    .vs-section-image { width: 100%; background: inherit; }
    .vs-section-image img { width: 100%; height: auto; display: block; }
    .vs-section-image__caption { padding: 10px 24px; font-size: 12px; text-align: center; opacity: 0.6; }
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
  fontFaces = [],
  blockOverrides = {},
  hiddenBlocks = [],
  focusBlock = null,
  width = 375,
  height = 720,
  preventZoom = false,
  sectionImages = [],
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
    // data-field-when="키" 래퍼는 그 필드에 값이 있을 때만 보인다 (예: 인사말 이미지).
    // 기본 CSS가 display:none 이므로 값이 있을 때는 빈 문자열이 아니라 실제 표시값으로
    // 인라인 스타일을 채워야 그 규칙을 이긴다 — 빈 문자열은 "인라인 오버라이드 제거"일 뿐이라
    // 다시 스타일시트의 none 으로 되돌아간다.
    doc.querySelectorAll<HTMLElement>("[data-field-when]").forEach((el) => {
      const key = el.getAttribute("data-field-when")
      if (!key) return
      el.style.display = data[key] ? "block" : "none"
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

  // 블럭 여백/표시여부 → [data-block] 스코프 CSS 주입 (테마 <style> 뒤에 삽입되므로 동률 특정도에서 우선한다.
  // 인라인 style 만 예외 — 테마 쪽에서 금지되어 있다, THEME_TOKEN_GUIDE.md §2.3)
  useEffect(() => {
    if (!doc) return
    const styleId = "vs-block-overrides"
    let styleEl = doc.getElementById(styleId) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = doc.createElement("style")
      styleEl.id = styleId
      doc.head.appendChild(styleEl)
    }
    const rules: string[] = []
    for (const [key, override] of Object.entries(blockOverrides)) {
      if (typeof override.py === "number") {
        rules.push(`[data-block="${key}"]{padding-top:${override.py}px;padding-bottom:${override.py}px;}`)
      }
    }
    for (const key of hiddenBlocks) {
      rules.push(`[data-block="${key}"]{display:none;}`)
    }
    styleEl.textContent = rules.join("\n")
  }, [doc, blockOverrides, hiddenBlocks])

  // 블럭 타이틀/영문 소제목 바인딩 — 빈 값이면 템플릿 기본 텍스트를 그대로 둔다 ([data-field]와 동일 규칙)
  useEffect(() => {
    if (!doc) return
    doc.querySelectorAll<HTMLElement>("[data-block]").forEach((section) => {
      const key = section.getAttribute("data-block")
      if (!key) return
      const override = blockOverrides[key]
      if (!override) return
      if (override.title) {
        const titleEl = section.querySelector<HTMLElement>("[data-block-title]")
        if (titleEl) titleEl.textContent = override.title
      }
      if (override.label) {
        const labelEl = section.querySelector<HTMLElement>("[data-block-label]")
        if (labelEl) labelEl.textContent = override.label
      }
    })
  }, [doc, blockOverrides])

  // 섹션 사이 삽입 이미지 — afterBlock 이 가리키는 [data-block] 섹션 바로 뒤에 <div class="vs-section-image">
  // 를 끼워 넣는다. 테마 template.html 을 전혀 건드리지 않아 어떤 테마에도 그대로 적용된다.
  // sectionImages 가 바뀔 때마다(추가/삭제/순서변경/위치변경) 이전에 넣어둔 노드를 전부 지우고
  // 다시 그린다 — 순서·위치가 자유롭게 바뀌는 목록이라 diff 갱신보다 통째로 다시 그리는 쪽이 단순하고 안전하다.
  useEffect(() => {
    if (!doc) return
    doc.querySelectorAll("[data-vs-section-image]").forEach((el) => el.remove())

    // 같은 afterBlock 을 가리키는 이미지가 여러 개면 배열 순서대로 이어 붙여야 하므로,
    // 각 블럭 뒤에 "마지막으로 삽입한 지점"을 추적하며 순서대로 insertAfter 한다.
    const lastInserted = new Map<string, Element>()
    for (const img of sectionImages) {
      const anchor = lastInserted.get(img.afterBlock) ?? doc.querySelector(`[data-block="${img.afterBlock}"]`)
      if (!anchor) continue

      const wrapper = doc.createElement("div")
      wrapper.className = "vs-section-image"
      wrapper.setAttribute("data-vs-section-image", img.id)

      const imgEl = doc.createElement("img")
      imgEl.src = img.url
      imgEl.alt = img.caption || ""
      wrapper.appendChild(imgEl)

      if (img.caption) {
        const caption = doc.createElement("p")
        caption.className = "vs-section-image__caption"
        caption.textContent = img.caption
        wrapper.appendChild(caption)
      }

      anchor.after(wrapper)
      lastInserted.set(img.afterBlock, wrapper)
    }
  }, [doc, sectionImages])

  // 블럭 포커스 — 편집기에서 블럭 아코디언을 펼치면 미리보기가 해당 섹션으로 스크롤
  useEffect(() => {
    if (!doc || !focusBlock) return
    const target = doc.querySelector(`[data-block="${focusBlock}"]`)
    target?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [doc, focusBlock])

  // 핀치줌·더블탭 확대 차단 (preventZoom=true 일 때만). 콘텐츠는 iframe 내부(별도 문서)에
  // 렌더되므로 터치 이벤트도 그 문서에 직접 등록해야 한다 — 부모 문서에 걸면 iframe 안의
  // 터치는 아예 잡히지 않는다. outer 페이지의 viewport meta(maximumScale/userScalable)만으로는
  // 일부 브라우저·인앱 웹뷰(카카오톡 등)가 더블탭 확대를 막지 않아 JS로 보강한다.
  useEffect(() => {
    if (!doc || !preventZoom) return
    doc.body.style.touchAction = "manipulation"

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }
    let lastTouchEnd = 0
    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now()
      if (now - lastTouchEnd <= 300) e.preventDefault()
      lastTouchEnd = now
    }

    doc.addEventListener("touchstart", handleTouchStart, { passive: false })
    doc.addEventListener("touchmove", handleTouchMove, { passive: false })
    doc.addEventListener("touchend", handleTouchEnd, { passive: false })
    return () => {
      doc.removeEventListener("touchstart", handleTouchStart)
      doc.removeEventListener("touchmove", handleTouchMove)
      doc.removeEventListener("touchend", handleTouchEnd)
    }
  }, [doc, preventZoom])

  // 커스텀 폰트 로딩 — 에셋 관리에서 등록한 폰트를 iframe 문서 안에 주입한다.
  // (iframe은 별도 realm이라 부모 문서에 <link>/<style>을 추가해도 적용되지 않는다)
  useEffect(() => {
    if (!doc) return
    const styleId = "custom-font-faces"
    let styleEl = doc.getElementById(styleId) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = doc.createElement("style")
      styleEl.id = styleId
      doc.head.appendChild(styleEl)
    }
    styleEl.textContent = fontFaces
      .map((f) => {
        if (f.embedCode) return f.embedCode
        if (f.fileUrl) return buildFontFaceRule(f.family, f.fileUrl)
        return ""
      })
      .filter(Boolean)
      .join("\n")
  }, [doc, fontFaces])

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
