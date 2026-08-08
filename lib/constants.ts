/**
 * 레거시 스타일 테마 편집기(admin/assets/themes/[id])의 섹션 순서 설정에서 쓰는
 * 기본 섹션 순서. 실제 발행(템플릿 엔진)에는 영향을 주지 않는다 — 8곳에 각자
 * 리터럴로 흩어져 있던 걸 단일화한 잔재.
 */
export const DEFAULT_BLOCK_ORDER: string[] = [
  'hero', 'greeting', 'sequence', 'gallery', 'calendar', 'location', 'contact', 'account', 'rsvp', 'guestbook',
]
