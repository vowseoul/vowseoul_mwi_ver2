import { describe, it, expect } from 'vitest'
import { wrapLines } from './thank-you-card'

// 글자당 폭 10 으로 재는 가짜 측정기
const ctx = { measureText: (s: string) => ({ width: s.length * 10 }) as TextMetrics }

describe('wrapLines', () => {
  it('keeps explicit line breaks and blank lines', () => {
    expect(wrapLines(ctx, '가나\n\n다라', 100)).toEqual(['가나', '', '다라'])
  })
  it('wraps at spaces when a line is too wide', () => {
    expect(wrapLines(ctx, '가나다 라마바 사아', 60)).toEqual(['가나다', '라마바 사아'])
  })
  it('breaks a word longer than the line by characters', () => {
    expect(wrapLines(ctx, '가나다라마바', 30)).toEqual(['가나다', '라마바'])
  })
})
