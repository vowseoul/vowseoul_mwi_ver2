import { describe, it, expect } from 'vitest'
import { extractIntroSettings, isValidIntroSettings, hasIntroContent, DEFAULT_INTRO_SETTINGS } from './intro-settings'

describe('extractIntroSettings', () => {
  it('overrides가 객체가 아니면 기본값을 반환한다', () => {
    expect(extractIntroSettings(null)).toEqual(DEFAULT_INTRO_SETTINGS)
    expect(extractIntroSettings('nope')).toEqual(DEFAULT_INTRO_SETTINGS)
  })

  it('레거시 introEnabled=true 만 있어도 enabled 로 승계한다 (기존 청첩장 설정 유실 방지)', () => {
    const out = extractIntroSettings({ introEnabled: true })
    expect(out.enabled).toBe(true)
    expect(out.mode).toBe('names')
  })

  it('레거시 introEnabled 가 없거나 false 면 꺼짐이다', () => {
    expect(extractIntroSettings({}).enabled).toBe(false)
    expect(extractIntroSettings({ introEnabled: false }).enabled).toBe(false)
  })

  it('intro 키가 있으면 그 값을 읽는다', () => {
    const out = extractIntroSettings({
      intro: { enabled: true, mode: 'text', text: '결혼합니다', imageUrl: '', fontFamily: 'X', fontSize: 30, align: 'left' },
    })
    expect(out).toEqual({ enabled: true, mode: 'text', text: '결혼합니다', imageUrl: '', fontFamily: 'X', fontSize: 30, align: 'left' })
  })

  it('intro.enabled 가 없으면 레거시 introEnabled 로 폴백한다', () => {
    expect(extractIntroSettings({ introEnabled: true, intro: { mode: 'text' } }).enabled).toBe(true)
    expect(extractIntroSettings({ intro: { mode: 'text' } }).enabled).toBe(false)
  })

  it('알 수 없는 mode/align 은 기본값으로 되돌린다', () => {
    const out = extractIntroSettings({ intro: { mode: 'hologram', align: 'diagonal' } })
    expect(out.mode).toBe('names')
    expect(out.align).toBe('center')
  })

  it('fontSize 는 허용 범위로 잡아준다', () => {
    expect(extractIntroSettings({ intro: { fontSize: 2 } }).fontSize).toBe(12)
    expect(extractIntroSettings({ intro: { fontSize: 999 } }).fontSize).toBe(80)
    expect(extractIntroSettings({ intro: { fontSize: 31.6 } }).fontSize).toBe(32)
  })

  it('fontSize 가 숫자가 아니면 기본값을 쓴다', () => {
    expect(extractIntroSettings({ intro: { fontSize: '30' } }).fontSize).toBe(DEFAULT_INTRO_SETTINGS.fontSize)
    expect(extractIntroSettings({ intro: { fontSize: Number.NaN } }).fontSize).toBe(DEFAULT_INTRO_SETTINGS.fontSize)
  })
})

describe('isValidIntroSettings', () => {
  const valid = { enabled: true, mode: 'image', text: '', imageUrl: 'https://x/y.jpg', fontFamily: '', fontSize: 22, align: 'center' }

  it('완전한 형태만 통과시킨다', () => {
    expect(isValidIntroSettings(valid)).toBe(true)
  })

  it('필드가 빠지거나 타입이 다르면 거부한다', () => {
    expect(isValidIntroSettings(null)).toBe(false)
    expect(isValidIntroSettings({ ...valid, enabled: 'yes' })).toBe(false)
    expect(isValidIntroSettings({ ...valid, mode: 'hologram' })).toBe(false)
    expect(isValidIntroSettings({ ...valid, align: 'diagonal' })).toBe(false)
    expect(isValidIntroSettings({ ...valid, fontSize: Number.NaN })).toBe(false)
    const { text: _omitted, ...missingText } = valid
    expect(isValidIntroSettings(missingText)).toBe(false)
  })
})

describe('hasIntroContent', () => {
  const base = { ...DEFAULT_INTRO_SETTINGS, enabled: true }

  it('꺼져 있으면 항상 false', () => {
    expect(hasIntroContent({ ...base, enabled: false }, '김민준', '이서연')).toBe(false)
  })

  it('names 모드는 이름이 하나라도 있어야 한다', () => {
    expect(hasIntroContent({ ...base, mode: 'names' }, '김민준', '')).toBe(true)
    expect(hasIntroContent({ ...base, mode: 'names' }, '', '')).toBe(false)
  })

  it('text 모드는 공백만 있으면 안 된다', () => {
    expect(hasIntroContent({ ...base, mode: 'text', text: '결혼합니다' }, '', '')).toBe(true)
    expect(hasIntroContent({ ...base, mode: 'text', text: '   ' }, '김민준', '이서연')).toBe(false)
  })

  it('image 모드는 imageUrl 이 있어야 한다', () => {
    expect(hasIntroContent({ ...base, mode: 'image', imageUrl: 'https://x/y.jpg' }, '', '')).toBe(true)
    expect(hasIntroContent({ ...base, mode: 'image', imageUrl: '' }, '김민준', '이서연')).toBe(false)
  })
})
