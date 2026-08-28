"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { buildFontFaceRule, joinFontFaceCss } from "@/lib/fonts"
import { SCROLL_MOTION_INTENSITY_PARAMS, DEFAULT_SCROLL_MOTION, type ScrollMotionSettings } from "@/lib/scroll-motion"
import { blockTintOverlays, BLOCK_TINT_DEFAULT_OPACITY, type BlockTintStep } from "@/lib/theme-template"
import { DEFAULT_INTRO_SETTINGS, hasIntroContent, type IntroSettings } from "@/lib/intro-settings"
import type { BlockOverride, SectionImage } from "@/lib/theme-template"

export type { BlockOverride, SectionImage }

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
export type BlockOverrideMap = Record<string, BlockOverride>
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
  /** 블럭(섹션) 노출 순서. 없으면 테마 template.html의 기본 DOM 순서를 그대로 쓴다.
   * share는 순서 배열에 뭐가 오든 항상 맨 마지막으로 강제된다(§재정렬 이펙트) */
  blockOrder?: string[]
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
  /** 블럭별 배경 농담 패턴 (§lib/theme-template.ts BLOCK_TINT_PATTERNS). 미설정 시 "none" */
  blockTint?: string
  /** 단계별 농도(0~100). 미설정 시 BLOCK_TINT_DEFAULT_OPACITY */
  blockTintOpacity?: Record<BlockTintStep, number>
  /** 프레임이 화면을 꽉 채우는가.
   *
   * 편집기·테마 미리보기에서는 이 프레임이 페이지 위에 얹힌 "기기 목업"이라 둥근 모서리와
   * 그림자가 그 역할을 한다. 하지만 발행된 청첩장(§app/w/[slug])은 프레임 크기가 곧
   * 뷰포트 크기여서, 같은 스타일이 화면 네 귀퉁이를 잘라내고 그림자는 화면 밖으로 나간다 —
   * 실기기에서 모서리가 둥글게 깎여 보이는 원인이었다. 그 경우 이 값을 켜서 장식을 뺀다. */
  fullBleed?: boolean
  /** 섹션 사이에 끼워 넣는 이미지. afterBlock 이 가리키는 [data-block] 섹션 바로 뒤에 삽입된다 */
  sectionImages?: SectionImage[]
  /** 값이 있으면 "코멘트 모드"로 전환 — [data-block] 클릭 시 그 블록 키를 알려주고, 그
   * 클릭이 유발했을 원래 동작(RSVP 버튼 열기 등)은 막는다. 시안 검수 화면 전용이라
   * 평소(발행/일반 미리보기)에는 prop을 아예 넘기지 않아 기본 동작에 영향이 없다. */
  onBlockClick?: (blockKey: string) => void
  /** 하객이 스크롤할 때 섹션이 나타나는 방식. 없거나 preset이 'none'이면 정적으로 표시(기본값) */
  scrollMotion?: ScrollMotionSettings
  /** 진입 시 잠깐 보여주는 오프닝 연출 설정 (기본 꺼짐). 내용은 이름/직접 입력 문구/이미지 중 선택 */
  intro?: IntroSettings
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
    /* admin 페이지와 동일한 폰트 — RSVP/방명록 등 데이터 입력용 팝업 전용(.vs-popup),
       청첩장 본문의 --font-kr/--font-en과는 별개로 항상 이 폰트를 쓴다. */
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
    .vs-popup { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
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
    /* [data-field-when] 항목을 여러 개 묶은 래퍼(예: 오시는 길의 교통/주차/셔틀 안내 3종).
       안에 표시할 값이 하나도 없으면 테두리·여백만 남아 빈 줄처럼 보이므로 통째로 감춘다.
       [data-field-when] 처럼 기본 display:none 으로 두지 않는 건 래퍼의 display 가 테마마다
       달라(flex/grid 등) JS 가 "보일 때 무엇으로 되돌려야 하는지" 알 수 없기 때문 —
       대신 비었을 때만 클래스를 붙이는 방향으로 뒤집었다. */
    .vs-field-group-empty { display: none !important; }
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
    /* 진입 완료 상태는 프리셋별 초기 transform 을 "항상" 이겨야 한다 — 뒤에 두는 것만으로는
       부족하다. slide-alt 규칙은 속성 선택자를 2개 써서 특정도가 (0,3,0)이라, 클래스 2개짜리
       .vs-reveal.vs-revealed (0,2,0) 를 소스 순서와 무관하게 눌러버렸다. 그 결과 '좌우 번갈아'
       프리셋만 진입 후에도 translateX 가 남아 섹션이 좌우로 치우친 채 고정되는 버그가 있었다
       (다른 프리셋은 (0,2,0) 동률이라 순서로 이겨서 멀쩡히 동작했다). 아래 두 선택자로
       프리셋 규칙과 같거나 높은 특정도를 확보한다. */
    .vs-reveal[data-vs-preset][data-vs-dir].vs-revealed,
    .vs-reveal[data-vs-preset].vs-revealed { opacity: 1; transform: none; }
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

/**
 * 블럭별 배경 농담 — 보이는 [data-block] 섹션 순서대로 오버레이를 얹는다.
 *
 * background-color 를 바꾸지 않고 background-image 로 한 겹 덮는다. 테마가 어떤 색을
 * 쓰든, 섹션 배경이 이미지든 그라데이션이든 그대로 통하고, 설정을 끄면 흔적이 남지 않는다.
 *
 * 자체적으로 배경을 교대하는 테마([data-alt] 를 쓰는 color-atelier)는 건드리지 않는다 —
 * 그 위에 또 덮으면 의도한 교대가 뭉개진다.
 *
 * applyAltClasses 와 같은 이유로 hiddenBlocks 가 바뀔 때마다 다시 계산한다: 중간 블럭을
 * 끄면 순서가 밀려 A-B-A-C 가 어긋나기 때문이다.
 */
function applyBlockTint(
  doc: Document,
  hiddenBlocks: string[],
  pattern: string,
  opacity: Record<BlockTintStep, number>,
) {
  const sections = doc.querySelectorAll<HTMLElement>("[data-block]")
  const selfAlternating = doc.querySelector("[data-alt][data-block]") !== null
  const overlays = blockTintOverlays(pattern, opacity)
  let i = 0
  sections.forEach((el) => {
    el.style.removeProperty("background-image")
    const key = el.getAttribute("data-block")
    if (key && hiddenBlocks.includes(key)) return
    if (selfAlternating || pattern === "none") { i++; return }
    const overlay = overlays[i % overlays.length]
    if (overlay) el.style.setProperty("background-image", overlay)
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
  blockOrder = [],
  hiddenBlocks = [],
  focusBlock = null,
  width = 375,
  height = 720,
  preventZoom = false,
  fullBleed = false,
  blockTint = "none",
  blockTintOpacity = BLOCK_TINT_DEFAULT_OPACITY,
  sectionImages = [],
  onBlockClick,
  scrollMotion,
  intro = DEFAULT_INTRO_SETTINGS,
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
    // [data-field-when] 항목들을 묶은 래퍼 — 나열된 필드가 전부 비어 있으면 래퍼째 감춘다.
    // (교통/주차/셔틀 안내를 하나도 안 적었는데 구분선과 여백만 남던 문제)
    doc.querySelectorAll<HTMLElement>("[data-field-when-any]").forEach((el) => {
      const keys = (el.getAttribute("data-field-when-any") || "").split(",").map((k) => k.trim()).filter(Boolean)
      el.classList.toggle("vs-field-group-empty", !keys.some((k) => data[k]))
    })
    // 인사말 이미지 비율 선택(현재 비율 / 좌우로 꽉 채우기) — greeting_image_ratio 값에 따라
    // 이미지 래퍼에 is-fill 클래스를 토글한다. CSS 쪽 규칙은 각 테마 template.css에 있다.
    const greetingImageWrap = doc.querySelector<HTMLElement>('[data-field-when="greeting_image"]')
    if (greetingImageWrap) greetingImageWrap.classList.toggle("is-fill", data.greeting_image_ratio === "fill")
  }, [doc, data])

  // [data-copy-field="키"] 요소를 클릭하면 그 필드값을 클립보드에 복사한다(예: 식장 주소 카드).
  // 내부에 [data-copy-feedback] 요소가 있으면 문구를 잠깐 "복사되었습니다"로 바꿨다 되돌린다.
  useEffect(() => {
    if (!doc) return
    const cleanups: (() => void)[] = []
    doc.querySelectorAll<HTMLElement>("[data-copy-field]").forEach((el) => {
      const key = el.getAttribute("data-copy-field")
      if (!key) return
      const feedbackEl = el.querySelector<HTMLElement>("[data-copy-feedback]")
      const originalText = feedbackEl?.textContent ?? ""
      let timer: ReturnType<typeof setTimeout> | null = null
      const onClick = () => {
        const value = data[key]
        if (!value) return
        navigator.clipboard?.writeText(value)
        if (feedbackEl) {
          feedbackEl.textContent = "주소가 복사되었습니다"
          if (timer) clearTimeout(timer)
          timer = setTimeout(() => { feedbackEl.textContent = originalText }, 1500)
        }
      }
      el.addEventListener("click", onClick)
      cleanups.push(() => { el.removeEventListener("click", onClick); if (timer) clearTimeout(timer) })
    })
    return () => cleanups.forEach((fn) => fn())
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

  // 블럭(섹션) 순서 재배치 — blockOrder가 가리키는 순서대로 [data-block] 형제 요소를
  // appendChild로 다시 붙인다(이미 문서에 있는 노드에 appendChild를 부르면 "이동"이 된다).
  // blockOrder에 없는 키(새로 추가된 블럭 등)는 원래 DOM 순서를 유지한 채 뒤에 붙인다.
  // share는 사용자가 어떤 순서를 저장했든 항상 맨 마지막으로 강제한다 — 청첩장 주소 공유 +
  // 로고 섹션은 항상 청첩장의 마지막이어야 하는 고정 블럭이라 순서 변경 대상에서 제외된다.
  useEffect(() => {
    if (!doc) return
    const sections = Array.from(doc.querySelectorAll<HTMLElement>("[data-block]"))
    if (sections.length === 0) return
    const parent = sections[0].parentElement
    if (!parent) return
    const byKey = new Map(sections.map((el) => [el.getAttribute("data-block") as string, el] as const))
    const domOrder = sections.map((el) => el.getAttribute("data-block") as string)
    const source = blockOrder && blockOrder.length > 0 ? blockOrder : domOrder
    const wanted = source.filter((k) => byKey.has(k) && k !== "share")
    const missing = domOrder.filter((k) => !wanted.includes(k) && k !== "share")
    const finalOrder = [...wanted, ...missing]
    if (byKey.has("share")) finalOrder.push("share")
    finalOrder.forEach((key) => {
      const el = byKey.get(key)
      if (!el) return
      parent.appendChild(el)
      // 섹션 사이 삽입 이미지는 앵커 섹션 바로 뒤에 붙어 있어야 한다. 블럭만 appendChild 로
      // 옮기면 이미지 래퍼는 원래 자리에 남고, 블럭들이 전부 뒤로 이동한 결과 이미지가
      // 상대적으로 맨 앞(히어로보다도 위)으로 밀려난다 — 저장 후 리렌더로 이 이펙트가 다시
      // 돌 때 실제로 그렇게 보이던 버그. 블럭을 옮길 때 그 블럭에 딸린 이미지도 같이 옮긴다.
      parent.querySelectorAll(`[data-vs-after-block="${key}"]`).forEach((img) => parent.appendChild(img))
    })
  }, [doc, blockOrder])

  // hiddenBlocks/blockOrder 가 바뀌고 문서는 다시 write() 되지 않는 경우(편집기에서 블럭을
  // 껐다 켜거나 순서를 바꿀 때)를 위한 재계산 — 위 순서 재배치 이펙트 다음에 실행되어야
  // 최종 시각적 순서를 기준으로 dark/light 교대가 맞는다. 문서를 새로 쓴 직후의 최초 적용은
  // 위 write 이펙트가 동기적으로 처리한다.
  useEffect(() => {
    if (!doc) return
    applyAltClasses(doc, hiddenBlocks)
    applyBlockTint(doc, hiddenBlocks, blockTint, blockTintOpacity)
  }, [doc, hiddenBlocks, blockOrder, blockTint, blockTintOpacity])

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

  // 인사말 아이콘(하트/직접 업로드, 크기, 색상) — [data-greeting-icon] 요소 안의
  // [data-greeting-icon-heart]/[data-greeting-icon-custom] 두 자식 중 하나만 보여준다.
  // custom 이미지가 svg면 CSS mask로 색을 입히고, 그 외(png 등)는 배경 이미지로 그대로 얹는다.
  useEffect(() => {
    if (!doc) return
    const el = doc.querySelector<HTMLElement>("[data-greeting-icon]")
    if (!el) return
    const g = blockOverrides.greeting
    const shape = g?.greetingIconShape || "heart"
    const size = g?.greetingIconSize ?? 24
    const color = g?.greetingIconColor || tokens["--accent"] || "#D76C6C"
    const customUrl = g?.greetingIconCustomUrl

    el.style.width = `${size}px`
    el.style.height = `${size}px`

    const heartEl = el.querySelector<HTMLElement>("[data-greeting-icon-heart]")
    const customEl = el.querySelector<HTMLElement>("[data-greeting-icon-custom]")

    if (shape === "custom" && customUrl) {
      if (heartEl) heartEl.style.display = "none"
      if (customEl) {
        customEl.style.display = "inline-block"
        const isSvg = customUrl.toLowerCase().split("?")[0].endsWith(".svg")
        if (isSvg) {
          customEl.style.backgroundImage = "none"
          customEl.style.backgroundColor = color
          customEl.style.setProperty("-webkit-mask-image", `url(${customUrl})`)
          customEl.style.setProperty("mask-image", `url(${customUrl})`)
          customEl.style.setProperty("-webkit-mask-size", "contain")
          customEl.style.setProperty("mask-size", "contain")
          customEl.style.setProperty("-webkit-mask-repeat", "no-repeat")
          customEl.style.setProperty("mask-repeat", "no-repeat")
          customEl.style.setProperty("-webkit-mask-position", "center")
          customEl.style.setProperty("mask-position", "center")
        } else {
          customEl.style.backgroundColor = "transparent"
          customEl.style.removeProperty("-webkit-mask-image")
          customEl.style.removeProperty("mask-image")
          customEl.style.backgroundImage = `url(${customUrl})`
          customEl.style.backgroundSize = "contain"
          customEl.style.backgroundRepeat = "no-repeat"
          customEl.style.backgroundPosition = "center"
        }
      }
    } else {
      if (customEl) customEl.style.display = "none"
      if (heartEl) {
        heartEl.style.display = ""
        heartEl.style.color = color
      }
    }
  }, [doc, blockOverrides, tokens])

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
      // 블럭 재정렬 이펙트가 "이 이미지는 어느 섹션에 딸렸는지" 알아야 같이 옮길 수 있다
      wrapper.setAttribute("data-vs-after-block", img.afterBlock)
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

    // 발동 시점 판정을 IntersectionObserver 대신 직접 계산한다.
    //
    // IO를 쓸 수 없는 이유: 이 문서는 iframe 안이라 root:null 로 만든 관측자의 기준 박스가
    // iframe 뷰포트가 아니라 **최상위 페이지 뷰포트**로 잡힌다(entry.rootBounds 로 확인 —
    // iframe 높이가 680인데 rootBounds 는 부모 뷰포트 1270 기준으로 나왔다). documentElement/
    // body 를 root 로 넘겨도 둘 다 스크롤 루트라 같은 값이 나와 소용이 없다. 그래서 rootMargin
    // 으로 "화면 몇 % 지점에서 시작" 을 조절하려 해도 전혀 먹지 않았고, 특히 관리자 미리보기
    // 처럼 iframe 이 부모 화면 안에 작게 들어가 있을 때는 섹션이 iframe 안에 보이기만 하면
    // 즉시 발동해 모션이 늘 "너무 일찍" 끝나 있었다.
    //
    // 스크롤 위치로 직접 판정하면 iframe 중첩과 무관하게 항상 같은 지점에서 발동한다.
    // 발동 지점(섹션 상단이 화면 높이의 몇 %까지 올라와야 시작할지)은 관리자가 조절한다.
    const revealRatio = scrollMotion?.revealRatio ?? DEFAULT_SCROLL_MOTION.revealRatio
    const pending = new Set(targets)
    let frame = 0

    const check = () => {
      frame = 0
      const line = view.innerHeight * revealRatio
      for (const el of pending) {
        if (el.getBoundingClientRect().top < line) {
          el.classList.add("vs-revealed")
          pending.delete(el)
        }
      }
      if (pending.size === 0) view.removeEventListener("scroll", onScroll)
    }
    // 스크롤마다 레이아웃을 읽으면 비싸므로 rAF 로 프레임당 한 번만 계산한다
    const onScroll = () => { if (!frame) frame = view.requestAnimationFrame(check) }

    view.addEventListener("scroll", onScroll, { passive: true })
    // 창 크기가 바뀌면 발동선(화면 높이 기준)도 같이 움직인다
    view.addEventListener("resize", onScroll, { passive: true })

    check()    // 첫 화면에 이미 들어와 있는 섹션은 스크롤 없이도 바로 보여준다
    onScroll() // 폰트·이미지가 뒤늦게 로드되며 위치가 밀리는 경우를 위해 다음 프레임에 한 번 더

    return () => {
      view.removeEventListener("scroll", onScroll)
      view.removeEventListener("resize", onScroll)
      if (frame) view.cancelAnimationFrame(frame)
    }
  }, [doc, scrollMotion, sectionImages])

  // 블럭 포커스 — 편집기에서 블럭 아코디언을 펼치면 미리보기가 해당 섹션으로 스크롤
  useEffect(() => {
    if (!doc || !focusBlock) return
    const target = doc.querySelector(`[data-block="${focusBlock}"]`)
    target?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [doc, focusBlock])

  // 블럭 포커스 하이라이트 — "지금 이 섹션을 편집 중"임을 테두리 펄스 1회로 명확히 보여준다
  // (Visibility). 편집기 전용이라 focusBlock을 넘기지 않는 발행/검수 화면에서는 아무 일도 없다.
  useEffect(() => {
    if (!doc || !focusBlock) return
    const target = doc.querySelector(`[data-block="${focusBlock}"]`) as HTMLElement | null
    if (!target) return
    if (doc.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const styleId = "vs-focus-pulse-style"
    if (!doc.getElementById(styleId)) {
      const styleEl = doc.createElement("style")
      styleEl.id = styleId
      styleEl.textContent = `
        .vs-focus-pulse { animation: vs-focus-pulse-ring 900ms ease-out; }
        @keyframes vs-focus-pulse-ring {
          0% { box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--accent, #d76c6c) 70%, transparent); }
          100% { box-shadow: inset 0 0 0 3px transparent; }
        }
      `
      doc.head.appendChild(styleEl)
    }
    target.classList.remove("vs-focus-pulse")
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    void target.offsetWidth // 리플로우를 강제해 같은 블럭을 다시 눌러도 애니메이션이 재생되게 한다
    target.classList.add("vs-focus-pulse")
    const timer = setTimeout(() => target.classList.remove("vs-focus-pulse"), 900)
    return () => clearTimeout(timer)
  }, [doc, focusBlock])

  // 스크롤 유도 인디케이터 — 첫 화면(히어로) 하단에 은은한 화살표를 보여줘 "더 있다"는 걸
  // 암시한다(Affordance). 스크롤 이벤트는 1회성·passive라 성능에 영향이 없다. 스크롤 모션
  // 설정(scrollMotion)과 무관하게 항상 켜져 있다 — 이건 연출이 아니라 안내다.
  useEffect(() => {
    if (!doc) return
    const blocks = doc.querySelectorAll("[data-block]")
    if (blocks.length < 2) return // 스크롤할 다음 섹션이 없으면 힌트도 필요 없다

    const styleId = "vs-scroll-hint-style"
    if (!doc.getElementById(styleId)) {
      const styleEl = doc.createElement("style")
      styleEl.id = styleId
      styleEl.textContent = `
        .vs-scroll-hint { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
          opacity: 0.7; pointer-events: none; z-index: 40; transition: opacity 400ms ease-out;
          animation: vs-scroll-hint-bounce 1.6s ease-in-out infinite; }
        .vs-scroll-hint--hidden { opacity: 0; }
        @keyframes vs-scroll-hint-bounce { 0%, 100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(8px); } }
        @media (prefers-reduced-motion: reduce) { .vs-scroll-hint { animation: none; } }
      `
      doc.head.appendChild(styleEl)
    }

    const hintId = "vs-scroll-hint"
    if (doc.getElementById(hintId)) return
    const hint = doc.createElement("div")
    hint.id = hintId
    hint.className = "vs-scroll-hint"
    hint.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`
    hint.style.color = "var(--ink, #333)"
    doc.body.appendChild(hint)

    const view = doc.defaultView
    const onFirstScroll = () => {
      hint.classList.add("vs-scroll-hint--hidden")
      setTimeout(() => hint.remove(), 450)
    }
    view?.addEventListener("scroll", onFirstScroll, { once: true, passive: true })
    return () => view?.removeEventListener("scroll", onFirstScroll)
  }, [doc])

  // 오프닝 인트로 — 진입 시 설정된 내용(이름/직접 입력 문구/이미지)이 잠깐 나타났다 사라진다.
  // 콘텐츠 도달을 늦추지 않도록 1.4초 안에 끝나고, 탭하면 즉시 건너뛸 수 있다.
  // deps 를 전부 원시값으로 풀어놓은 건 intro 객체 identity 가 매 렌더 바뀌어도 이펙트가
  // 헛돌지 않게 하기 위해서다 — 헛돌면 cleanup 이 타이머를 지워 오버레이가 안 사라진다.
  useEffect(() => {
    if (!doc) return
    const groom = data.groom_name || ""
    const bride = data.bride_name || ""
    if (!hasIntroContent(intro, groom, bride)) return
    if (doc.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const overlay = doc.createElement("div")
    overlay.id = "vs-intro-overlay"
    const justify = intro.align === "left" ? "flex-start" : intro.align === "right" ? "flex-end" : "center"
    overlay.style.cssText =
      `position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:${justify};` +
      "background:var(--bg,#fff);color:var(--ink,#333);padding:0 32px;box-sizing:border-box;" +
      "opacity:1;transition:opacity 500ms ease-out;cursor:pointer;"

    if (intro.mode === "image") {
      const img = doc.createElement("img")
      img.src = intro.imageUrl
      img.alt = ""
      img.style.cssText = "max-width:100%;max-height:70%;object-fit:contain;"
      overlay.appendChild(img)
    } else {
      const box = doc.createElement("div")
      // 폰트를 지정하지 않았으면 테마 한글 폰트를 그대로 따른다
      box.style.cssText =
        `text-align:${intro.align};font-size:${intro.fontSize}px;letter-spacing:.05em;line-height:1.5;` +
        `font-family:${intro.fontFamily || "var(--font-kr, inherit)"};white-space:pre-line;`
      if (intro.mode === "text") {
        // 직접 입력 문구는 사용자 입력이므로 textContent 로만 넣는다(HTML 주입 방지)
        box.textContent = intro.text
      } else {
        box.appendChild(doc.createTextNode(groom))
        const amp = doc.createElement("span")
        amp.style.cssText = "opacity:.45;margin:0 10px;"
        amp.textContent = "&"
        box.appendChild(amp)
        box.appendChild(doc.createTextNode(bride))
      }
      overlay.appendChild(box)
    }
    doc.body.appendChild(overlay)

    let dismissed = false
    const dismiss = () => {
      if (dismissed) return
      dismissed = true
      overlay.style.opacity = "0"
      setTimeout(() => overlay.remove(), 500)
    }
    overlay.addEventListener("click", dismiss)
    const timer = setTimeout(dismiss, 900)
    return () => {
      clearTimeout(timer)
      overlay.removeEventListener("click", dismiss)
      // 설정이 바뀌어 이펙트가 다시 도는 경우(관리자 편집기 실시간 미리보기) 이전 오버레이가
      // 화면을 덮은 채 남지 않도록 반드시 걷어낸다 — 걷어내야 새 설정으로 다시 재생된다.
      overlay.remove()
    }
    // intro 객체를 통째로 의존하면 identity 가 매 렌더 바뀌어 이펙트가 헛돌고, 그때마다
    // cleanup 이 타이머를 지워 오버레이가 영영 안 사라진다 — 그래서 원시 필드만 나열한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    doc, data.groom_name, data.bride_name,
    intro.enabled, intro.mode, intro.text, intro.imageUrl, intro.fontFamily, intro.fontSize, intro.align,
  ])

  // 핀치줌·더블탭 확대 차단 (preventZoom=true 일 때만). 콘텐츠는 iframe 내부(별도 문서)에
  // 렌더되므로 터치 이벤트도 그 문서에 직접 등록해야 한다 — 부모 문서에 걸면 iframe 안의
  // 터치는 아예 잡히지 않는다. outer 페이지의 viewport meta(maximumScale/userScalable)만으로는
  // 일부 브라우저·인앱 웹뷰(카카오톡 등)가 더블탭 확대를 막지 않아 JS로 보강한다.
  useEffect(() => {
    if (!doc || !preventZoom) return
    // doc.body.style.x = y 형태의 직접 대입은 useState로 들고 있는 doc을 "변경"하는
    // 것으로 컴파일러가 오인한다(react-hooks/immutability) — 같은 파일의 다른 doc.head/
    // body 조작은 appendChild처럼 메서드 호출이라 걸리지 않는 것과 같은 이유로,
    // setProperty 메서드 호출로 바꿔 동일한 결과를 낸다.
    doc.body.style.setProperty("touch-action", "manipulation")

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

  // 개인정보처리방침 링크 — share 슬롯이 없는 테마를 위한 대비책이다.
  //
  // 원래는 테마와 무관하게 항상 문서 맨 끝에 붙였는데, 공유 블럭 아래에 맥락 없는 줄이
  // 하나 더 생기는 모양이었다. 지금은 share 아일랜드가 블럭 안에 직접 그리고
  // (§islands/share-island.tsx), 여기서는 그 블럭이 없을 때만 대신 붙인다 —
  // 고지 도달 경로(개인정보 보호법 제30조)가 테마 구성에 좌우되면 안 된다.
  const hasShareSlot = Boolean(slots.share)
  useEffect(() => {
    if (!doc) return
    const linkId = "vs-privacy-link"
    const existing = doc.getElementById(linkId)
    if (hasShareSlot) {
      // share 블럭을 켜면(편집기에서 실시간으로 바뀐다) 주입분은 중복이므로 걷어낸다
      existing?.remove()
      return
    }
    if (existing) return
    const link = doc.createElement("a")
    link.id = linkId
    link.href = "/privacy"
    link.target = "_top"
    link.textContent = "개인정보처리방침"
    link.style.cssText =
      "display:block;text-align:center;margin:24px 0 14px;font-size:10px;opacity:.35;color:inherit;text-decoration:underline;"
    doc.body.appendChild(link)
  }, [doc, hasShareSlot])

  return (
    <iframe
      key={template.key}
      ref={iframeRef}
      title={`invitation-preview-${template.key}`}
      width={width}
      height={height}
      style={{
        border: "none",
        // 화면을 꽉 채울 때는 모서리를 깎지 않는다 — 잘려나가는 건 장식이 아니라 청첩장 내용이다
        borderRadius: fullBleed ? 0 : 12,
        boxShadow: fullBleed ? "none" : "0 8px 40px rgba(0,0,0,0.12)",
        display: fullBleed ? "block" : undefined,
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
