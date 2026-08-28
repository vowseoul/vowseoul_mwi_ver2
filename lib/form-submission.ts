/**
 * form_instances 에 붙여 읽은 form_submissions 임베드에서 제출본 1건을 꺼낸다.
 *
 * form_submissions 에는 UNIQUE(form_instance_id) 가 걸려 있어서(§initial_schema.sql)
 * PostgREST 가 이 관계를 to-one 으로 보고 **배열이 아니라 객체 하나**를 돌려준다.
 * 그래서 `form_submissions[0]` 으로 꺼내면 항상 undefined 였다 — 서버에 저장된
 * 임시저장본이 있어도 폼이 빈 채로 열리고(다른 기기에서 이어쓰기가 안 됨),
 * 관리자 고객 상세의 폼 제출 시각도 표시되지 않았다.
 * 제약이 없는 환경/과거 데이터를 위해 배열로 오는 경우도 함께 받아준다.
 */
export function pickFormSubmission<T>(embedded: T | T[] | null | undefined): T | null {
  if (!embedded) return null
  return Array.isArray(embedded) ? embedded[0] ?? null : embedded
}
