/**
 * 알림을 누구에게 보낼지 정한다.
 *
 * 규칙은 하나다: 고객에 담당자가 지정돼 있으면 그 사람에게만, 아니면 전 직원에게.
 *
 * 화면과 떼어 둔 이유는 "아무도 못 받는" 경우가 조용하기 때문이다. 담당자 id 가
 * 남아 있는데 그 사람이 퇴사해 profiles 에서 사라졌다면, 그 사람만 찾다가 빈 목록을
 * 반환하면 알림이 흔적 없이 사라진다 — 그래서 못 찾으면 전 직원으로 되돌린다.
 * 알림이 한 명 더 가는 건 성가신 일이지만, 안 가는 건 놓치는 일이다.
 */

export function resolveRecipients<T extends { id: string }>(
  staff: T[],
  assignedTo: string | null | undefined,
): T[] {
  if (!assignedTo) return staff
  const owner = staff.find((s) => s.id === assignedTo)
  return owner ? [owner] : staff
}
