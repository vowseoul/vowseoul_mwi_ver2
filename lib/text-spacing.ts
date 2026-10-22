/**
 * 청첩장 문구의 "빈칸" 처리 — 편집기 미리보기(PC)와 휴대폰에서 똑같이 보이게 한다.
 *
 * 1) 한글 채움 문자(ㅤ U+3164 등)는 유니코드상 "안 보여도 되는 문자"라 기기마다 다르게
 *    그려진다. PC 크롬은 한 글자 폭 빈칸으로, 아이폰(사파리·카카오톡)은 폭 0으로 숨긴다.
 *    고객 요청으로 줄 폭을 맞추려고 이 문자를 넣었다가 아이폰에서만 칸이 사라진 일이 있다.
 *    같은 폭(한 글자)의 전각 공백 U+3000 으로 바꾸면 모든 기기에서 보인다.
 * 2) 테마의 문구 영역은 white-space: pre-line 이라 스페이스를 여러 번 쳐도 1칸으로 합쳐진다.
 *    이어진 공백을 줄바꿈 없는 공백(U+00A0, 일반 공백과 같은 폭)으로 바꾸면 합쳐지지 않는다.
 */

const INVISIBLE_FILLERS = /[ᅟᅠㅤﾠ]/g

/** 한 글자 폭의 전각 공백 — 채움 문자 대신 쓴다 */
export const WIDE_SPACE = "　"

export function hasInvisibleFiller(text: string): boolean {
  return /[ᅟᅠㅤﾠ]/.test(text)
}

export function replaceInvisibleFillers(text: string): string {
  return text.replace(INVISIBLE_FILLERS, WIDE_SPACE)
}

/** 두 칸 이상 이어진 공백을 줄바꿈 없는 공백으로 — 입력한 칸 수 그대로 보이게 한다 */
export function preserveSpaceRuns(text: string): string {
  return text.replace(/ {2,}/g, (run) => " ".repeat(run.length))
}
