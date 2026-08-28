import { useEffect, useRef, useState } from "react"
import type { FieldData, BlockOverrideMap } from "../invitation-frame"
import type { RawInvitationData } from "@/lib/invitation-data"

/**
 * 아일랜드 9개(bgm/sequence/calendar/gallery/account/contact/map/rsvp/guestbook/share)가
 * 공유하는 props 타입과 스타일 헬퍼. slot-registry.tsx가 1,571줄이라 9개 아일랜드
 * 파일로 순수 이동(로직 변경 없음)한 것 중, 2개 이상의 아일랜드가 함께 쓰는 조각만 여기 남긴다.
 */

export interface SlotProps {
  accent: string
  data: FieldData
  /** 배열/객체(gallery_images, sequence_events 등)를 포함한 원본 데이터 */
  raw?: RawInvitationData
  /** 실제 청첩장 렌더 시 전달. 있으면 RSVP가 DB에 저장된다(없으면 미리보기 모드) */
  invitationId?: string
  /** 블럭별 오버라이드 (§rsvp 블럭의 mealEnabled/shuttleEnabled 서브옵션에 사용) */
  blockOverrides?: BlockOverrideMap
}

/** currentColor 기반 반투명 색 (테마 색을 그대로 따라감) */
export const soft = (pct: number) => `color-mix(in srgb, currentColor ${pct}%, transparent)`

/** 계좌/연락처 블럭의 아이콘형 버튼 공통 스타일 */
export const iconBtnStyle = (borderColor: string, background: string, iconColor: string): React.CSSProperties => ({
  width: 38, height: 38, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center",
  border: `1px solid ${borderColor}`, background, color: iconColor, cursor: "pointer", flexShrink: 0,
})

/** RSVP·방명록 입력창 공통 스타일 */
export const rsvpInput: React.CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, outline: "none", fontSize: 14,
}

/** RSVP·방명록 등 데이터 입력 팝업 공통 오버레이/카드 — admin 페이지 Dialog와 동일한
 * 톤(흰 배경, 옅은 회색 보더, 8px radius, 은은한 그림자)을 쓴다. 폰트는 .vs-popup 클래스가
 * Pretendard로 고정한다(§invitation-frame.tsx buildSrcDoc) — 청첩장 테마의 --font-kr를
 * 그대로 물려받으면 입력 폼에는 어울리지 않는 서체가 섞여 지저분해 보이기 때문. */
export const popupOverlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.5)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
}
export const popupCard: React.CSSProperties = {
  width: "100%", maxWidth: 320, maxHeight: "85%", overflowY: "auto",
  background: "#fff", color: "#1a1a1a", borderRadius: 8, padding: 24, textAlign: "left",
  border: "1px solid #e5e7eb", boxShadow: "0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1)",
}

/** RSVP·방명록 팝업을 어느 document 에 portal 해야 하는지 알아낸다. 아일랜드는 섹션
 * 안(§rsvp-island의 <div style={{maxWidth:320}}>처럼)에 그대로 렌더되면, 짝수 번째
 * 섹션에 걸린 backdrop-filter(§Modern Script template_css)가 새 containing block을
 * 만들어 popupOverlay의 position:fixed;inset:0 가 뷰포트가 아니라 그 섹션 크기로
 * 잘려버린다(모달이 화면 절반만 보이고 등록 버튼이 화면 밖으로 밀려남). iframe 문서
 * 최상위(body)에 직접 portal 하면 어떤 조상의 backdrop-filter/transform과도 무관하게
 * 항상 실제 뷰포트 기준 오버레이가 된다. ref가 이미 iframe 문서 안에 마운트된 뒤에야
 * ownerDocument를 알 수 있어 첫 렌더에는 null이었다가 마운트 이펙트에서 채워진다. */
export function usePortalDocument<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [doc, setDoc] = useState<Document | null>(null)
  useEffect(() => {
    setDoc(ref.current?.ownerDocument ?? null)
  }, [])
  return [ref, doc] as const
}

/** RSVP·방명록 입력창 라벨+필드 래퍼 — 두 아일랜드 모두 같은 팝업 폼 톤을 쓴다 */
export function RsvpField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>{label}</label>
      {children}
    </div>
  )
}

/** RSVP·방명록 팝업의 ESC 닫기 + 포커스 트랩. 아일랜드는 iframe(§invitation-frame.tsx)
 * 안으로 portal 되므로, 이 훅이 붙는 카드의 ownerDocument(= iframe 문서)에 리스너를
 * 걸어야 한다 — 최상위 window의 document에 걸면 iframe 안 포커스에서 발생하는 키
 * 이벤트를 전혀 받지 못한다(별도 브라우징 컨텍스트라 버블링되지 않음). 폼이 열릴 때
 * 카드 안 첫 포커스 가능 요소로 포커스를 옮기고, 닫히면 팝업을 열었던 요소로 되돌린다. */
export function useModalA11y(open: boolean, onClose: () => void) {
  const cardRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    if (!open) return
    const card = cardRef.current
    const ownerDoc = card?.ownerDocument
    if (!card || !ownerDoc) return

    const previouslyFocused = ownerDoc.activeElement as HTMLElement | null
    const getFocusable = () =>
      Array.from(
        card.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )
    getFocusable()[0]?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onCloseRef.current(); return }
      if (e.key !== "Tab") return
      const focusable = getFocusable()
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && ownerDoc.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && ownerDoc.activeElement === last) { e.preventDefault(); first.focus() }
    }
    ownerDoc.addEventListener("keydown", onKeyDown)
    return () => {
      ownerDoc.removeEventListener("keydown", onKeyDown)
      previouslyFocused?.focus()
    }
  }, [open])

  return cardRef
}
