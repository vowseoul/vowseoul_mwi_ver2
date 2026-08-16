/**
 * 청첩장 스크롤 인터랙션(하객이 스크롤할 때 섹션이 나타나는 방식) 설정.
 * 저장 위치는 lib/theme-template.ts의 blocks/disabled_slots/sectionImages와 동일하게
 * invitations.customization_overrides(jsonb)를 공유하되 'scrollMotion' 이라는 별도 키를 쓴다
 * — 서로 다른 키라 간섭하지 않는다.
 *
 * 관리자 편집기(customize-client.tsx)와 고객 셀프편집(edit-client.tsx) 양쪽에서 값을
 * 바꿀 수 있고, 발행(app/w/[slug])·검수(app/invitation/[id]/review) 양쪽이 이 값을 읽어
 * InvitationFrame에 그대로 전달한다.
 */

export const SCROLL_MOTION_PRESETS = [
  { value: "none", label: "없음", description: "기본값. 정적으로 표시됩니다." },
  { value: "fade", label: "페이드 인", description: "서서히 나타납니다." },
  { value: "fade-up", label: "올라오기", description: "아래에서 떠오르듯 나타납니다." },
  { value: "zoom", label: "부드러운 확대", description: "살짝 커지며 나타납니다." },
  { value: "slide-alt", label: "좌우 번갈아", description: "섹션마다 좌우에서 번갈아 나타납니다." },
] as const

export type ScrollMotionPreset = (typeof SCROLL_MOTION_PRESETS)[number]["value"]

export const SCROLL_MOTION_INTENSITIES = [
  { value: "subtle", label: "약하게" },
  { value: "normal", label: "보통" },
  { value: "bold", label: "강하게" },
] as const

export type ScrollMotionIntensity = (typeof SCROLL_MOTION_INTENSITIES)[number]["value"]

export interface ScrollMotionSettings {
  preset: ScrollMotionPreset
  intensity: ScrollMotionIntensity
  /**
   * 발동 지점 — 섹션 상단이 화면 높이의 이 비율까지 올라오면 모션을 시작한다.
   * 1.0 이면 섹션이 화면 아래 끝에 걸치자마자(=가장 이르게), 0.4 면 화면 중간보다
   * 더 위로 올라와야(=가장 늦게) 시작한다. §invitation-frame.tsx 의 스크롤 판정에서 쓴다.
   */
  revealRatio: number
}

/** 발동 지점 허용 범위 — 1.0 을 넘으면 화면 밖에서 이미 끝나 버리고, 너무 낮으면 영영 안 나온다 */
export const REVEAL_RATIO_MIN = 0.4
export const REVEAL_RATIO_MAX = 1.0

export const DEFAULT_SCROLL_MOTION: ScrollMotionSettings = { preset: "none", intensity: "normal", revealRatio: 0.75 }

const PRESET_VALUES: string[] = SCROLL_MOTION_PRESETS.map((p) => p.value)
const INTENSITY_VALUES: string[] = SCROLL_MOTION_INTENSITIES.map((i) => i.value)

/** 강도별 이동거리/확대율/재생시간. InvitationFrame이 iframe 안 CSS 변수로 주입한다. */
export const SCROLL_MOTION_INTENSITY_PARAMS: Record<ScrollMotionIntensity, { distance: string; scale: string; duration: string }> = {
  subtle: { distance: "12px", scale: "0.99", duration: "400ms" },
  normal: { distance: "24px", scale: "0.96", duration: "600ms" },
  bold: { distance: "40px", scale: "0.92", duration: "800ms" },
}

/** customization_overrides(jsonb)에서 scrollMotion을 안전하게 추출한다. 알 수 없는 값은 기본값으로 되돌린다 */
export function extractScrollMotion(overrides: unknown): ScrollMotionSettings {
  if (!overrides || typeof overrides !== "object") return { ...DEFAULT_SCROLL_MOTION }
  const raw = (overrides as Record<string, unknown>).scrollMotion
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SCROLL_MOTION }
  const r = raw as Record<string, unknown>
  const preset = typeof r.preset === "string" && PRESET_VALUES.includes(r.preset) ? (r.preset as ScrollMotionPreset) : DEFAULT_SCROLL_MOTION.preset
  const intensity = typeof r.intensity === "string" && INTENSITY_VALUES.includes(r.intensity) ? (r.intensity as ScrollMotionIntensity) : DEFAULT_SCROLL_MOTION.intensity
  // revealRatio 는 나중에 추가된 값이라 기존 청첩장에는 아예 없다 — 없으면 기본값으로 채운다
  const revealRatio = typeof r.revealRatio === "number" && Number.isFinite(r.revealRatio)
    ? Math.min(REVEAL_RATIO_MAX, Math.max(REVEAL_RATIO_MIN, r.revealRatio))
    : DEFAULT_SCROLL_MOTION.revealRatio
  return { preset, intensity, revealRatio }
}

/**
 * 클라이언트가 보낸 값이 유효한 ScrollMotionSettings 형태인지 검증 (self-edit API 화이트리스트용).
 * revealRatio 는 선택 — 이 값이 생기기 전 화면에서 온 요청(또는 구버전 캐시)도 계속 받아줘야
 * 하고, 빠졌거나 범위를 벗어나도 읽는 쪽(extractScrollMotion)이 기본값으로 보정한다.
 */
export function isValidScrollMotion(value: unknown): value is ScrollMotionSettings {
  if (!value || typeof value !== "object") return false
  const r = value as Record<string, unknown>
  if (r.revealRatio !== undefined && (typeof r.revealRatio !== "number" || !Number.isFinite(r.revealRatio))) return false
  return typeof r.preset === "string" && PRESET_VALUES.includes(r.preset) && typeof r.intensity === "string" && INTENSITY_VALUES.includes(r.intensity)
}
