import { describe, it, expect } from 'vitest'
import { extractScrollMotion, isValidScrollMotion, DEFAULT_SCROLL_MOTION } from './scroll-motion'

describe('extractScrollMotion', () => {
  it('overrides가 객체가 아니면 기본값을 반환한다', () => {
    expect(extractScrollMotion(null)).toEqual(DEFAULT_SCROLL_MOTION)
    expect(extractScrollMotion('nope')).toEqual(DEFAULT_SCROLL_MOTION)
    expect(extractScrollMotion({})).toEqual(DEFAULT_SCROLL_MOTION)
  })

  it('저장된 preset/intensity 를 읽는다', () => {
    const out = extractScrollMotion({ scrollMotion: { preset: 'slide-alt', intensity: 'bold', revealRatio: 0.6 } })
    expect(out).toEqual({ preset: 'slide-alt', intensity: 'bold', revealRatio: 0.6 })
  })

  it('알 수 없는 preset/intensity 는 기본값으로 되돌린다', () => {
    const out = extractScrollMotion({ scrollMotion: { preset: 'barrel-roll', intensity: 'ludicrous' } })
    expect(out.preset).toBe(DEFAULT_SCROLL_MOTION.preset)
    expect(out.intensity).toBe(DEFAULT_SCROLL_MOTION.intensity)
  })

  it('revealRatio 가 없던 기존 설정은 기본값으로 채워진다 (이 값 추가 전에 저장된 청첩장)', () => {
    const out = extractScrollMotion({ scrollMotion: { preset: 'fade', intensity: 'normal' } })
    expect(out.revealRatio).toBe(DEFAULT_SCROLL_MOTION.revealRatio)
  })

  it('revealRatio 는 허용 범위로 잡아준다', () => {
    expect(extractScrollMotion({ scrollMotion: { revealRatio: 5 } }).revealRatio).toBe(1.0)
    expect(extractScrollMotion({ scrollMotion: { revealRatio: 0 } }).revealRatio).toBe(0.4)
    expect(extractScrollMotion({ scrollMotion: { revealRatio: -3 } }).revealRatio).toBe(0.4)
  })

  it('revealRatio 가 숫자가 아니면 기본값을 쓴다', () => {
    expect(extractScrollMotion({ scrollMotion: { revealRatio: '0.6' } }).revealRatio).toBe(DEFAULT_SCROLL_MOTION.revealRatio)
    expect(extractScrollMotion({ scrollMotion: { revealRatio: Number.NaN } }).revealRatio).toBe(DEFAULT_SCROLL_MOTION.revealRatio)
  })
})

describe('isValidScrollMotion', () => {
  it('preset/intensity 가 유효하면 통과한다', () => {
    expect(isValidScrollMotion({ preset: 'fade', intensity: 'normal', revealRatio: 0.75 })).toBe(true)
  })

  it('revealRatio 는 선택 — 없어도 통과한다 (구버전 화면에서 온 요청 호환)', () => {
    expect(isValidScrollMotion({ preset: 'fade', intensity: 'normal' })).toBe(true)
  })

  it('revealRatio 가 있는데 숫자가 아니면 거부한다', () => {
    expect(isValidScrollMotion({ preset: 'fade', intensity: 'normal', revealRatio: '0.6' })).toBe(false)
    expect(isValidScrollMotion({ preset: 'fade', intensity: 'normal', revealRatio: Number.NaN })).toBe(false)
  })

  it('preset/intensity 가 빠지거나 알 수 없으면 거부한다', () => {
    expect(isValidScrollMotion(null)).toBe(false)
    expect(isValidScrollMotion({ preset: 'fade' })).toBe(false)
    expect(isValidScrollMotion({ preset: 'barrel-roll', intensity: 'normal' })).toBe(false)
  })
})
