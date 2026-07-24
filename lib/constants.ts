/**
 * legacy 렌더러(invitation-client.tsx/mobile-preview.tsx 등)가 공유하는
 * 기본 섹션 순서. 8곳에 각자 리터럴로 흩어져 있던 걸 단일화했다 — legacy
 * 렌더러 자체가 제거되면(WORKPLAN.md §4-1) 이 상수도 함께 정리될 것.
 */
export const DEFAULT_BLOCK_ORDER: string[] = [
  'hero', 'greeting', 'sequence', 'gallery', 'calendar', 'location', 'contact', 'account', 'rsvp', 'guestbook',
]
