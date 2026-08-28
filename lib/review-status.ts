/**
 * 시안 검수 상태 표시용 공통 정의.
 *
 * 원래 편집기 전용 상수 파일(app/admin/(dashboard)/invitations/editor/[id]/field-defs.ts)에만
 * 있어서 검수 상태를 편집기 안에서만 볼 수 있었다 — 담당 건이 여러 개일 때 "누가 승인했고
 * 누가 수정 요청했는지" 확인하려면 청첩장을 하나씩 열어봐야 했다. 목록·고객 상세에서도
 * 쓰려고 라우트 밖으로 옮긴다.
 */

export type ReviewStatus = 'none' | 'in_review' | 'changes_requested' | 'approved'

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  none: '검수 전',
  in_review: '검수 요청됨',
  changes_requested: '수정 요청 있음',
  approved: '확정됨',
}

/**
 * 목록에서 한눈에 구분되도록 상태별 색을 준다. "수정 요청 있음"은 담당자가 해야 할 일이
 * 남아 있다는 뜻이라 가장 눈에 띄어야 하고(주황), "확정됨"은 발행해도 된다는 신호다(초록).
 * 검수 전은 아직 아무 일도 없는 상태라 색을 주지 않는다.
 */
export const REVIEW_STATUS_CLASS: Record<string, string> = {
  none: 'bg-muted text-muted-foreground',
  in_review: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  changes_requested: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  approved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
}

/** 상태값을 라벨로. 알 수 없는 값이면 원문을 그대로 보여준다(마이그레이션 중 새 값 대비) */
export function reviewStatusLabel(status: unknown): string {
  const key = String(status ?? 'none')
  return REVIEW_STATUS_LABEL[key] ?? key
}

export function reviewStatusClass(status: unknown): string {
  const key = String(status ?? 'none')
  return REVIEW_STATUS_CLASS[key] ?? REVIEW_STATUS_CLASS.none
}
