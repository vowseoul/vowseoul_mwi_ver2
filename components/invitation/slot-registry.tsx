"use client"

import { BgmIsland } from "./islands/bgm-island"
import { SequenceIsland } from "./islands/sequence-island"
import { CalendarIsland } from "./islands/calendar-island"
import { GalleryIsland } from "./islands/gallery-island"
import { AccountIsland } from "./islands/account-island"
import { ContactIsland } from "./islands/contact-island"
import { MapIsland } from "./islands/map-island"
import { RsvpIsland } from "./islands/rsvp-island"
import { GuestbookIsland } from "./islands/guestbook-island"
import { ShareIsland } from "./islands/share-island"
import type { SlotProps } from "./islands/shared"

/**
 * 슬롯 레지스트리 — "기능 조합"의 핵심.
 *
 * 테마 템플릿이 [data-slot="키"] 로 필요한 기능만 선언하면,
 * 이 레지스트리가 해당 키에 맞는 React 인터랙션 컴포넌트를 자동 마운트한다.
 * → 테마마다 다른 기능 조합을 데이터로 선택 가능.
 * → 인터랙션 로직은 이곳 한 곳에서만 관리되어 발행/미리보기 간 드리프트가 없다.
 *
 * 실제 아일랜드 구현(BGM/식순/캘린더/갤러리/계좌/연락처/지도/RSVP/방명록/공유)은
 * ./islands/*.tsx 로 순수 이동했다(로직 변경 없음) — 이 파일은 매핑만 남는다.
 */

export type { SlotProps }

export const SLOT_REGISTRY: Record<string, React.ComponentType<SlotProps>> = {
  bgm: BgmIsland,
  gallery: GalleryIsland,
  account: AccountIsland,
  contact: ContactIsland,
  map: MapIsland,
  rsvp: RsvpIsland,
  sequence: SequenceIsland,
  calendar: CalendarIsland,
  guestbook: GuestbookIsland,
  share: ShareIsland,
}

export function buildSlots(slotKeys: string[], props: SlotProps): Record<string, React.ReactNode> {
  const map: Record<string, React.ReactNode> = {}
  for (const key of slotKeys) {
    const Comp = SLOT_REGISTRY[key]
    if (Comp) map[key] = <Comp {...props} />
  }
  return map
}
