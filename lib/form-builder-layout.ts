/**
 * 폼 빌더에서 필드를 옮길 때의 자리 계산.
 *
 * 화면에서 떼어 놓은 이유는 하나다 — 여기가 틀리면 조용히 틀린다. 필드가 엉뚱한
 * 섹션 끝에 붙어도 화면은 멀쩡해 보이고, 저장하고 나서야(sort_order 가 이 순서로
 * 굳는다) 고객이 받는 폼의 질문 순서가 어긋난 걸 알게 된다.
 */

type FieldLike = { options?: { page_title?: string; section_title?: string } | null }

export const pageOf = (f: FieldLike) => f.options?.page_title?.trim() || '기본 페이지'
export const sectionOf = (f: FieldLike) => f.options?.section_title?.trim() || '기본 섹션'

/**
 * fromIndices 의 필드들을 toPage > toSection 으로 옮긴 새 배열을 준다.
 * targetIndex 를 주면 그 필드 앞에, 없으면 섹션 끝(섹션이 비어 있으면 그 단계 끝)에 붙는다.
 *
 * 옮길 것들을 먼저 빼낸 뒤 남은 배열에서 자리를 찾는다 — 앞에서 뒤로 옮길 때
 * 인덱스가 하나 밀리는 보정을 따로 하지 않아도 된다.
 */
export function moveFieldsInList<T extends FieldLike>(
  fields: T[],
  fromIndices: number[],
  toPage: string,
  toSection: string,
  targetIndex?: number,
): T[] {
  const moving = new Set(fromIndices)
  if (moving.size === 0) return fields

  const target = targetIndex !== undefined && !moving.has(targetIndex) ? fields[targetIndex] : null
  const stamped = fields
    .filter((_, i) => moving.has(i))
    .map((f) => ({ ...f, options: { ...(f.options || {}), page_title: toPage, section_title: toSection } }))
  const rest = fields.filter((_, i) => !moving.has(i))

  const after = (pred: (f: T) => boolean) => {
    for (let i = rest.length - 1; i >= 0; i--) if (pred(rest[i])) return i + 1
    return -1
  }
  let at = target ? rest.indexOf(target) : -1
  if (at < 0) at = after((f) => pageOf(f) === toPage && sectionOf(f) === toSection)
  if (at < 0) at = after((f) => pageOf(f) === toPage)
  if (at < 0) at = rest.length

  return [...rest.slice(0, at), ...stamped, ...rest.slice(at)]
}
