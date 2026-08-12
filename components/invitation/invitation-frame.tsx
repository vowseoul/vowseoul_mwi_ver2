"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { buildFontFaceRule, joinFontFaceCss } from "@/lib/fonts"
import { SCROLL_MOTION_INTENSITY_PARAMS, type ScrollMotionSettings } from "@/lib/scroll-motion"

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
  rsvpDeadline?: string
  /** calendar 블럭 전용 서브옵션 (§slot-registry.tsx CalendarIsland) */
  ddayEnabled?: boolean
  icsButtonEnabled?: boolean
  googleCalendarButtonEnabled?: boolean
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
  /** 값이 있으면 "코멘트 모드"로 전환 — [data-block] 클릭 시 그 블록 키를 알려주고, 그
   * 클릭이 유발했을 원래 동작(RSVP 버튼 열기 등)은 막는다. 시안 검수 화면 전용이라
   * 평소(발행/일반 미리보기)에는 prop을 아예 넘기지 않아 기본 동작에 영향이 없다. */
  onBlockClick?: (blockKey: string) => void
  /** 하객이 스크롤할 때 섹션이 나타나는 방식. 없거나 preset이 'none'이면 정적으로 표시(기본값) */
  scrollMotion?: ScrollMotionSettings
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
    /* body 기본 폰트를 --font-kr로 잡아둔다. 테마 template_css가 자체적으로 body(또는 더 구체적인
       선택자)에 font-family를 지정하면 그 규칙이 우선하므로 안전하지만, 그런 지정이 전혀 없는
       테마에서는 이 기본값이 없으면 --font-kr을 아무리 바꿔도 본문(이름·인사말 등)에 반영되지
       않고 브라우저 기본 글꼴만 보이는 문제가 있었다. */
    body { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; background: var(--bg, #fff); color: var(--ink, #222); font-family: var(--font-kr, inherit); }
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
    /* 스크롤 모션 — 프리셋별 진입 전 상태. 실제 관찰/클래스 부착은 스크립트 쪽 useEffect가 담당하고,
       여기는 정적 규칙만 정의한다(설정과 무관하게 항상 존재해도 무해함 — .vs-reveal 클래스가
       없으면 아무 효과가 없다). .vs-revealed는 마지막에 두어 프리셋별 transform을 항상 이긴다. */
    .vs-reveal {
      opacity: 0;
      transition: opacity var(--vs-motion-duration, 600ms) var(--vs-ease-out-soft, cubic-bezier(0.16,1,0.3,1)),
                  transform var(--vs-motion-duration, 600ms) var(--vs-ease-out-soft, cubic-bezier(0.16,1,0.3,1));
    }
    .vs-reveal[data-vs-preset="fade-up"] { transform: translateY(var(--vs-motion-distance, 24px)); }
    .vs-reveal[data-vs-preset="zoom"] { transform: scale(var(--vs-motion-scale, 0.96)); }
    .vs-reveal[data-vs-preset="slide-alt"][data-vs-dir="l"] { transform: translateX(calc(-1 * var(--vs-motion-distance, 24px))); }
    .vs-reveal[data-vs-preset="slide-alt"][data-vs-dir="r"] { transform: translateX(var(--vs-motion-distance, 24px)); }
    .vs-reveal.vs-revealed { opacity: 1; transform: none; }
    @media (prefers-reduced-motion: reduce) {
      .vs-reveal { transition: none !important; opacity: 1 !important; transform: none !important; }
    }
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

// 다크/라이트 배경이 번갈아 깔리는 테마(color-atelier 등)용 — data-alt 마커가 붙은
// [data-block] 섹션들을 순회하며 "실제로 보이는" 것만 걸러 vs-alt-a/vs-alt-b 를 새로 매긴다.
// 템플릿에 dark/light 클래스를 정적으로 박아두면 중간 블럭을 꺼서 순서가 바뀌어도 클래스는
// 그대로 남아 A-B-B-A 처럼 교대가 깨진다 — hiddenBlocks 가 바뀔 때마다 다시 계산한다.
function applyAltClasses(doc: Document, hiddenBlocks: string[]) {
  let i = 0
  doc.querySelectorAll<HTMLElement>("[data-alt][data-block]").forEach((el) => {
    const key = el.getAttribute("data-block")
    const isHidden = key ? hiddenBlocks.includes(key) : false
    el.classList.remove("vs-alt-a", "vs-alt-b")
    if (isHidden) return
    el.classList.add(i % 2 === 0 ? "vs-alt-a" : "vs-alt-b")
    i++
  })
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
  onBlockClick,
  scrollMotion,
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

    // 문서를 새로 write() 한 직후 페인트 전에 동기적으로 적용 — 이펙트를 기다리면 첫 페인트에
    // 배경이 비어 있다가 스냅되고, 같은 iframe이 재사용되어 setDoc(d)가 이전과 동일한 Document
    // 참조를 받아 리렌더가 생략되는 경우(예: 테마 템플릿 편집기)에도 유실되지 않는다.
    applyAltClasses(d, hiddenBlocks)

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

  // hiddenBlocks 만 바뀌고 문서는 다시 write() 되지 않는 경우(편집기에서 블럭을 껐다 켤 때)를
  // 위한 재계산 — 문서를 새로 쓴 직후의 최초 적용은 위 write 이펙트가 동기적으로 처리한다.
  useEffect(() => {
    if (!doc) return
    applyAltClasses(doc, hiddenBlocks)
  }, [doc, hiddenBlocks])

  // 블럭 타이틀/영문 소제목 바인딩 — 빈 값이면 템플릿 기본 텍스트로 되돌아간다. 공백만 입력한
  // 경우는 truthy라 그대로 빈칸처럼 보이는 값이 적용된다(의도적으로 구분되는 상태 — 완전히
  // 비워야만 "기본값 사용"으로 취급한다). 각 요소의 원래 기본 텍스트는 최초 진입 시 딱 한 번
  // dataset에 캐시해둔다 — 그래야 "커스텀 → 다시 빈칸"으로 되돌렸을 때 무엇으로 복원해야 할지
  // 알 수 있다(문서를 새로 write()한 직후엔 항상 새 DOM이라 다시 그 시점의 기본값으로 캐시된다).
  useEffect(() => {
    if (!doc) return
    doc.querySelectorAll<HTMLElement>("[data-block]").forEach((section) => {
      const key = section.getAttribute("data-block")
      if (!key) return
      const override = blockOverrides[key]

      const titleEl = section.querySelector<HTMLElement>("[data-block-title]")
      if (titleEl) {
        if (titleEl.dataset.vsDefaultText === undefined) titleEl.dataset.vsDefaultText = titleEl.textContent ?? ""
        titleEl.textContent = override?.title || titleEl.dataset.vsDefaultText
      }
      const labelEl = section.querySelector<HTMLElement>("[data-block-label]")
      if (labelEl) {
        if (labelEl.dataset.vsDefaultText === undefined) labelEl.dataset.vsDefaultText = labelEl.textContent ?? ""
        labelEl.textContent = override?.label || labelEl.dataset.vsDefaultText
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
      // background: inherit 는 DOM 부모(.ca-container 등)를 따라가 버려 바로 앞 섹션과 색이
      // 안 맞는다 — anchor(직전 섹션)의 실제 계산된 배경/글자색을 그대로 복사해 이어 붙인다.
      const anchorStyle = doc.defaultView?.getComputedStyle(anchor)
      if (anchorStyle) {
        wrapper.style.backgroundColor = anchorStyle.backgroundColor
        wrapper.style.color = anchorStyle.color
      }

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

  // 스크롤 모션 — 하객이 스크롤하며 섹션에 다가가면 나타나는 연출. iframe은 별도 realm이라
  // IntersectionObserver/matchMedia도 그 문서의 window(doc.defaultView)에서 만들어야 한다.
  // 부모 window로 만들면 뷰포트 기준이 iframe이 아닌 부모 페이지가 되어 버린다.
  // 첫 [data-block](히어로)은 절대 대상에 넣지 않는다 — 열자마자 빈 화면처럼 보이면 안 되므로.
  useEffect(() => {
    if (!doc) return
    const view = doc.defaultView
    if (!view) return

    const preset = scrollMotion?.preset ?? "none"
    const blocks = Array.from(doc.querySelectorAll<HTMLElement>("[data-block]"))
    const targets = [...blocks.slice(1), ...Array.from(doc.querySelectorAll<HTMLElement>("[data-vs-section-image]"))]

    // 설정을 바꿀 때마다(관리자 실시간 미리보기) 이전 프리셋의 흔적을 지운다 — 지우지 않으면
    // 이미 revealed 된 섹션은 새 프리셋으로 바꿔도 화면에 반영되지 않는다.
    targets.forEach((el) => {
      el.classList.remove("vs-reveal", "vs-revealed")
      el.removeAttribute("data-vs-preset")
      el.removeAttribute("data-vs-dir")
    })

    if (preset === "none" || view.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const { distance, scale, duration } = SCROLL_MOTION_INTENSITY_PARAMS[scrollMotion?.intensity ?? "normal"]
    const root = doc.documentElement
    root.style.setProperty("--vs-motion-distance", distance)
    root.style.setProperty("--vs-motion-scale", scale)
    root.style.setProperty("--vs-motion-duration", duration)

    targets.forEach((el, i) => {
      el.classList.add("vs-reveal")
      el.setAttribute("data-vs-preset", preset)
      if (preset === "slide-alt") el.setAttribute("data-vs-dir", i % 2 === 0 ? "l" : "r")
    })

    const observer = new view.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add("vs-revealed")
          observer.unobserve(entry.target)
        }
      },
      { root: null, threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    )
    targets.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [doc, scrollMotion, sectionImages])

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

  // 코멘트 모드(onBlockClick 전달 시에만) — [data-block] 클릭을 capture 단계에서 가로채
  // 블록 키를 알려주고, 그 클릭이 원래 열었을 RSVP 모달 등 슬롯 아일랜드의 동작은 막는다.
  // 평소에는 onBlockClick 자체를 안 넘기므로 리스너가 아예 붙지 않는다.
  useEffect(() => {
    if (!doc || !onBlockClick) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const block = target?.closest<HTMLElement>("[data-block]")
      const key = block?.getAttribute("data-block")
      if (!key) return
      e.preventDefault()
      e.stopPropagation()
      onBlockClick(key)
    }
    doc.addEventListener("click", handleClick, true)
    return () => doc.removeEventListener("click", handleClick, true)
  }, [doc, onBlockClick])

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
    styleEl.textContent = joinFontFaceCss(
      fontFaces
        .map((f) => {
          if (f.embedCode) return f.embedCode
          if (f.fileUrl) return buildFontFaceRule(f.family, f.fileUrl)
          return ""
        })
        .filter(Boolean)
    )
  }, [doc, fontFaces])

  // 개인정보처리방침 링크 — 테마 template.html을 건드리지 않고 문서 최하단에 공통 주입한다.
  // 새 테마가 추가돼도 자동으로 붙는다(개인정보 보호법 제30조 고지 도달 경로).
  useEffect(() => {
    if (!doc) return
    const linkId = "vs-privacy-link"
    if (doc.getElementById(linkId)) return
    const link = doc.createElement("a")
    link.id = linkId
    link.href = "/privacy"
    link.target = "_top"
    link.textContent = "개인정보처리방침"
    link.style.cssText =
      "display:block;text-align:center;margin:24px 0 14px;font-size:10px;opacity:.35;color:inherit;text-decoration:underline;"
    doc.body.appendChild(link)
  }, [doc])

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
