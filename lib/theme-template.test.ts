import { describe, it, expect } from 'vitest'
import {
  buildInvitationTokens,
  buildThemeTokens,
  extractBlockOrder,
  extractBlockOverrides,
  extractOverrideTokens,
  isTemplateTheme,
  resolveThemeSwatch,
  toThemeTemplate,
  type ThemeRow,
} from './theme-template'

describe('isTemplateTheme', () => {
  it('render_engine이 template 이고 template_html 이 있으면 true', () => {
    expect(isTemplateTheme({ id: '1', render_engine: 'template', template_html: '<div></div>' })).toBe(true)
  })

  it('render_engine이 legacy 면 false', () => {
    expect(isTemplateTheme({ id: '1', render_engine: 'legacy', template_html: '<div></div>' })).toBe(false)
  })

  it('template_html 이 빈 문자열이면 false', () => {
    expect(isTemplateTheme({ id: '1', render_engine: 'template', template_html: '' })).toBe(false)
  })

  it('row 가 null/undefined 면 false', () => {
    expect(isTemplateTheme(null)).toBe(false)
    expect(isTemplateTheme(undefined)).toBe(false)
  })
})

describe('toThemeTemplate', () => {
  it('템플릿 엔진 테마가 아니면 null 을 반환한다 (legacy 폴백 신호)', () => {
    expect(toThemeTemplate({ id: '1', render_engine: 'legacy' })).toBeNull()
  })

  it('템플릿 엔진 테마면 ThemeTemplate 형태로 변환한다', () => {
    const row: ThemeRow = {
      id: 'theme-1',
      name: 'Soft Envelope',
      render_engine: 'template',
      template_html: '<div data-field="groom_name"></div>',
      template_css: ':root{}',
      slot_manifest: ['bgm', 'rsvp'],
    }
    const result = toThemeTemplate(row)
    expect(result).toEqual({
      key: 'theme-1',
      name: 'Soft Envelope',
      html: '<div data-field="groom_name"></div>',
      css: ':root{}',
      slots: ['bgm', 'rsvp'],
    })
  })

  it('slot_manifest 가 문자열 배열이 아니면 빈 배열로 정규화한다', () => {
    const row: ThemeRow = {
      id: 'theme-1',
      render_engine: 'template',
      template_html: '<div></div>',
      slot_manifest: 'not-an-array',
    }
    expect(toThemeTemplate(row)?.slots).toEqual([])
  })
})

describe('buildThemeTokens', () => {
  it('레거시 styles 키를 CSS 변수로 매핑한다', () => {
    const tokens = buildThemeTokens({
      id: '1',
      styles: { primaryColor: '#E8A87C', backgroundColor: '#FFF8F0', textColor: '#3A3A3A' },
    })
    expect(tokens['--accent']).toBe('#E8A87C')
    expect(tokens['--bg']).toBe('#FFF8F0')
    expect(tokens['--ink']).toBe('#3A3A3A')
  })

  it("'--' 로 시작하는 정식 토큰 키가 레거시 매핑보다 우선한다", () => {
    const tokens = buildThemeTokens({
      id: '1',
      styles: { primaryColor: '#레거시값', '--accent': '#정식값' },
    })
    expect(tokens['--accent']).toBe('#정식값')
  })

  it('font 계열 토큰은 font-serif/font-sans 유틸값을 실제 스택으로 변환한다', () => {
    const tokens = buildThemeTokens({ id: '1', styles: { fontKr: 'font-serif' } })
    expect(tokens['--font-kr']).toBe("'Noto Serif KR', serif")
  })

  it('이미 콤마 포함된 폰트 스택은 그대로 둔다', () => {
    const tokens = buildThemeTokens({ id: '1', styles: { fontKr: "'Pretendard', sans-serif" } })
    expect(tokens['--font-kr']).toBe("'Pretendard', sans-serif")
  })

  it('styles 가 없으면 빈 토큰맵을 반환한다', () => {
    expect(buildThemeTokens({ id: '1' })).toEqual({})
    expect(buildThemeTokens(null)).toEqual({})
  })
})

describe('extractOverrideTokens', () => {
  it("'--' 로 시작하는 키만 추출한다", () => {
    const tokens = extractOverrideTokens({ '--accent': '#000', groomName: '무시됨' })
    expect(tokens).toEqual({ '--accent': '#000' })
  })

  it('overrides 가 없으면 빈 객체를 반환한다', () => {
    expect(extractOverrideTokens(null)).toEqual({})
    expect(extractOverrideTokens(undefined)).toEqual({})
  })
})

describe('buildInvitationTokens', () => {
  it('테마 기본 토큰 위에 개별 오버라이드를 덮어쓴다', () => {
    const tokens = buildInvitationTokens(
      { id: '1', styles: { primaryColor: '#기본값' } },
      { '--accent': '#덮어쓴값' }
    )
    expect(tokens['--accent']).toBe('#덮어쓴값')
  })
})

describe('resolveThemeSwatch', () => {
  it('colorSets[0] 을 우선 사용한다', () => {
    const swatch = resolveThemeSwatch({ colorSets: [{ colors: ['#bg', '#primary', '#text'] }] })
    expect(swatch).toEqual({ bg: '#bg', primary: '#primary', text: '#text' })
  })

  it('colorSets 가 없으면 레거시 styles 로 폴백한다', () => {
    const swatch = resolveThemeSwatch({
      styles: { backgroundColor: '#bg2', primaryColor: '#primary2', textColor: '#text2' },
    })
    expect(swatch).toEqual({ bg: '#bg2', primary: '#primary2', text: '#text2' })
  })

  it('아무 값도 없으면 하드코딩된 기본값을 반환한다', () => {
    expect(resolveThemeSwatch(null)).toEqual({ bg: '#FFF8F0', text: '#3A3A3A', primary: '#E8A87C' })
    expect(resolveThemeSwatch(undefined)).toEqual({ bg: '#FFF8F0', text: '#3A3A3A', primary: '#E8A87C' })
  })
})

describe('extractBlockOrder', () => {
  it('배열이 아니면 undefined를 반환한다', () => {
    expect(extractBlockOrder(null)).toBeUndefined()
    expect(extractBlockOrder('hero,greeting')).toBeUndefined()
  })

  it('알려진 블럭 키만 순서대로 남긴다', () => {
    expect(extractBlockOrder(['hero', 'greeting', 'gallery'])).toEqual(['hero', 'greeting', 'gallery'])
  })

  it('알려지지 않은 키(옛 스키마 잔재 등)는 걸러낸다', () => {
    expect(extractBlockOrder(['hero', 'legacy_block', 'greeting'])).toEqual(['hero', 'greeting'])
  })

  it('문자열이 아닌 항목은 걸러낸다', () => {
    expect(extractBlockOrder(['hero', 42, null, 'greeting'])).toEqual(['hero', 'greeting'])
  })

  it('중복된 키는 처음 등장한 위치만 남긴다', () => {
    expect(extractBlockOrder(['hero', 'greeting', 'hero'])).toEqual(['hero', 'greeting'])
  })

  it('걸러내고 남는 게 없으면 undefined를 반환한다', () => {
    expect(extractBlockOrder(['legacy_block', 123])).toBeUndefined()
    expect(extractBlockOrder([])).toBeUndefined()
  })
})

describe('extractBlockOverrides', () => {
  it('overrides가 객체가 아니거나 blocks가 없으면 빈 객체를 반환한다', () => {
    expect(extractBlockOverrides(null)).toEqual({})
    expect(extractBlockOverrides('not an object')).toEqual({})
    expect(extractBlockOverrides({})).toEqual({})
    expect(extractBlockOverrides({ blocks: 'not an object' })).toEqual({})
  })

  it('알려진 필드를 타입 검증 후 통과시킨다', () => {
    const out = extractBlockOverrides({ blocks: { rsvp: { py: 40, title: '참석 여부', mealEnabled: false } } })
    expect(out).toEqual({ rsvp: { py: 40, title: '참석 여부', mealEnabled: false } })
  })

  it('타입이 스키마와 맞지 않는 필드는 조용히 버린다 (해당 블럭 자체는 유지)', () => {
    const out = extractBlockOverrides({ blocks: { calendar: { py: 'not a number', ddayEnabled: true } } })
    expect(out).toEqual({ calendar: { ddayEnabled: true } })
  })

  it('모든 필드가 유효하지 않은 블럭 항목은 결과에서 제외한다', () => {
    const out = extractBlockOverrides({ blocks: { rsvp: { py: 'invalid' } } })
    expect(out).toEqual({})
  })

  it('스키마에 없는 임의 필드는 무시한다', () => {
    const out = extractBlockOverrides({ blocks: { rsvp: { py: 20, unknownField: 'x' } } })
    expect(out).toEqual({ rsvp: { py: 20 } })
  })
})
