import { describe, it, expect } from 'vitest'
import { hasInvisibleFiller, preserveSpaceRuns, replaceInvisibleFillers } from './text-spacing'
import { buildFieldData } from './invitation-data'

describe('text spacing', () => {
  it('replaces the Hangul filler with a full-width space', () => {
    const line = '이 명로 · 김 윤정 의 딸 ㅤ은지'
    expect(hasInvisibleFiller(line)).toBe(true)
    expect(replaceInvisibleFillers(line)).toBe('이 명로 · 김 윤정 의 딸 　은지')
  })
  it('keeps runs of spaces but leaves single spaces alone', () => {
    expect(preserveSpaceRuns('딸   은지 님')).toBe('딸   은지 님')
  })
  it('applies both to the greeting, only filler replacement to other fields', () => {
    const data = buildFieldData({ greeting_message: '딸  ㅤ은지', venue_name: '홀  ㅤA' })
    expect(data.greeting_message).toBe('딸  　은지')
    expect(data.venue_name).toBe('홀  　A')
  })
})
