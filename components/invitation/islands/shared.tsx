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

/** RSVP·방명록 입력창 라벨+필드 래퍼 — 두 아일랜드 모두 같은 팝업 폼 톤을 쓴다 */
export function RsvpField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>{label}</label>
      {children}
    </div>
  )
}
