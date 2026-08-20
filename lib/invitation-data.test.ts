import { describe, it, expect } from 'vitest'
import { formatWeddingTimeLabel, buildFieldData, mergeInvitationRaw, normalizeLegacyKeys, normalizeSequence, isToggledOff, isToggledOn } from './invitation-data'

describe('normalizeLegacyKeys', () => {
  it('레거시 camelCase 키를 필드키로 매핑한다', () => {
    const out = normalizeLegacyKeys({ groomName: '김민준', brideName: '이서연' })
    expect(out.groom_name).toBe('김민준')
    expect(out.bride_name).toBe('이서연')
  })

  it('필드키 값이 이미 있으면 레거시 값보다 우선한다', () => {
    const out = normalizeLegacyKeys({ groomName: '레거시이름', groom_name: '필드키이름' })
    expect(out.groom_name).toBe('필드키이름')
  })

  it('레거시 값이 빈 문자열이면 채우지 않는다', () => {
    const out = normalizeLegacyKeys({ groomName: '' })
    expect(out.groom_name).toBeUndefined()
  })

  it('매핑 대상이 아닌 키는 그대로 통과시킨다', () => {
    const out = normalizeLegacyKeys({ gallery_images: ['a.jpg', 'b.jpg'] })
    expect(out.gallery_images).toEqual(['a.jpg', 'b.jpg'])
  })
})

describe('buildFieldData', () => {
  it('문자열/숫자/불리언 필드를 문자열로 통과시킨다', () => {
    const data = buildFieldData({ groom_name: '김민준', some_number: 42, some_bool: true })
    expect(data.groom_name).toBe('김민준')
    expect(data.some_number).toBe('42')
    expect(data.some_bool).toBe('true')
  })

  it('null 값은 결과에서 제외한다', () => {
    const data = buildFieldData({ groom_name: '김민준', bride_name: null })
    expect('bride_name' in data).toBe(false)
  })

  it('wedding_date 로부터 영문/화면표시/요일/D-day 파생 필드를 계산한다', () => {
    const fixedNow = new Date('2027-05-01T00:00:00')
    const data = buildFieldData({ wedding_date: '2027-05-07' }, fixedNow)
    expect(data.wedding_date_en).toBe('MAY 7, 2027')
    expect(data.wedding_date_display).toBe('2027. 05. 07')
    expect(data.wedding_weekday).toBe('금요일')
    expect(data.wedding_dday).toBe('D-6')
  })

  it('예식 시간을 날짜 뒤에 영문 표기로 붙인다', () => {
    const at = (time: string) => buildFieldData({ wedding_date: '2026-12-13', wedding_time: time }).wedding_datetime_display
    expect(at('12:00')).toBe('2026. 12. 13. 12PM')
    expect(at('13:00')).toBe('2026. 12. 13. 1PM')
    expect(at('09:30')).toBe('2026. 12. 13. 9:30AM')
  })

  it('시간이 없거나 00:00 이면 날짜만 남긴다', () => {
    // 00:00 은 예식 시간이 아니라 "고르지 않음"이다. 그대로 두면 12AM 으로 표시된다.
    for (const time of ['', '   ', '00:00']) {
      expect(buildFieldData({ wedding_date: '2026-12-13', wedding_time: time }).wedding_datetime_display)
        .toBe('2026. 12. 13')
    }
    expect(buildFieldData({ wedding_date: '2026-12-13' }).wedding_datetime_display).toBe('2026. 12. 13')
  })

  it('wedding_date_display 는 시간 없이 그대로 둔다', () => {
    // 네 테마가 이미 이 키를 쓴다 — 여기에 시간을 붙이면 원치 않는 테마까지 바뀐다.
    const data = buildFieldData({ wedding_date: '2026-12-13', wedding_time: '12:00' })
    expect(data.wedding_date_display).toBe('2026. 12. 13')
  })

  it('예식일 당일이면 D-DAY, 지났으면 D+N 을 반환한다', () => {
    const today = buildFieldData({ wedding_date: '2027-05-07' }, new Date('2027-05-07T15:00:00'))
    expect(today.wedding_dday).toBe('D-DAY')

    const past = buildFieldData({ wedding_date: '2027-05-07' }, new Date('2027-05-10T00:00:00'))
    expect(past.wedding_dday).toBe('D+3')
  })

  it('wedding_date 가 없으면 파생 필드를 만들지 않는다', () => {
    const data = buildFieldData({ groom_name: '김민준' })
    expect(data.wedding_dday).toBeUndefined()
  })

  it('레거시 키가 섞여 들어와도 정규화 후 파생 필드를 계산한다', () => {
    const data = buildFieldData({ weddingDate: '2027-05-07' }, new Date('2027-05-01T00:00:00'))
    expect(data.wedding_date).toBe('2027-05-07')
    expect(data.wedding_dday).toBe('D-6')
  })
})

describe('mergeInvitationRaw', () => {
  it('customers 기본값 위에 content_data 를 덮어쓴다', () => {
    const customer = { groom_name: '고객DB이름', wedding_date: '2027-01-01' }
    const invitation = { content_data: { groom_name: '실제입력이름' } }
    const raw = mergeInvitationRaw(invitation, customer)
    expect(raw.groom_name).toBe('실제입력이름')
    expect(raw.wedding_date).toBe('2027-01-01')
  })

  it('customer 가 없으면 content_data 만 사용한다', () => {
    const raw = mergeInvitationRaw({ content_data: { groom_name: '단독입력' } }, null)
    expect(raw.groom_name).toBe('단독입력')
  })

  it('customer 필드가 빈 값이면 채우지 않는다', () => {
    const raw = mergeInvitationRaw({ content_data: {} }, { groom_name: '' })
    expect(raw.groom_name).toBeUndefined()
  })

  it('invitation.bgm_url 이 있으면 raw 에 포함시킨다', () => {
    const raw = mergeInvitationRaw({ content_data: {}, bgm_url: '/bgm/canon.mp3' }, null)
    expect(raw.bgm_url).toBe('/bgm/canon.mp3')
  })

  it('content_data 가 레거시 camelCase 여도 정규화해서 병합한다', () => {
    const raw = mergeInvitationRaw({ content_data: { groomName: '레거시입력' } }, { groom_name: '고객DB이름' })
    expect(raw.groom_name).toBe('레거시입력')
  })
})

describe('normalizeSequence', () => {
  it('배열이 아니면 빈 배열을 반환한다', () => {
    expect(normalizeSequence(undefined)).toEqual([])
    expect(normalizeSequence(null)).toEqual([])
    expect(normalizeSequence('11:00|개식')).toEqual([])
  })

  it('레거시 "time|title" 문자열 포맷을 파싱한다 (에디터가 예전에 이 케이스를 빠뜨려 데이터 유실이 있었다)', () => {
    const out = normalizeSequence(['11:00|개식사 및 화촉점화', '11:30|신랑 신부 입장'])
    expect(out).toEqual([
      { time: '11:00', title: '개식사 및 화촉점화' },
      { time: '11:30', title: '신랑 신부 입장' },
    ])
  })

  it('title 안에 "|"가 더 있어도 시간 뒤 전체를 title로 합친다', () => {
    const out = normalizeSequence(['11:00|축가 | 하객 인사'])
    expect(out).toEqual([{ time: '11:00', title: '축가 | 하객 인사' }])
  })

  it('"|" 구분자가 없는 문자열은 건너뛴다', () => {
    expect(normalizeSequence(['11:00'])).toEqual([])
  })

  it('객체 포맷에서 title/desc/text 중 있는 것을 title로 채택한다', () => {
    expect(normalizeSequence([{ time: '11:00', title: '개식' }])).toEqual([{ time: '11:00', title: '개식' }])
    expect(normalizeSequence([{ time: '11:00', desc: '개식' }])).toEqual([{ time: '11:00', title: '개식' }])
    expect(normalizeSequence([{ time: '11:00', text: '개식' }])).toEqual([{ time: '11:00', title: '개식' }])
  })

  it('title이 여러 키에 동시에 있으면 title > desc > text 순으로 우선한다', () => {
    const out = normalizeSequence([{ time: '11:00', title: '제목', desc: '설명', text: '텍스트' }])
    expect(out).toEqual([{ time: '11:00', title: '제목' }])
  })

  it('time과 title 둘 다 없으면 항목을 건너뛴다', () => {
    expect(normalizeSequence([{}])).toEqual([])
    expect(normalizeSequence([{ time: '' }])).toEqual([])
  })

  it('time 없이 title만 있어도 유지한다', () => {
    expect(normalizeSequence([{ title: '개식' }])).toEqual([{ time: '', title: '개식' }])
  })

  it('문자열/객체 포맷이 섞여 있어도 순서대로 정규화한다', () => {
    const out = normalizeSequence(['11:00|개식', { time: '11:30', title: '입장' }])
    expect(out).toEqual([
      { time: '11:00', title: '개식' },
      { time: '11:30', title: '입장' },
    ])
  })

  it('배열 안의 숫자/null 항목은 무시한다', () => {
    expect(normalizeSequence([42, null, { time: '11:00', title: '개식' }])).toEqual([{ time: '11:00', title: '개식' }])
  })
})

describe('isToggledOff', () => {
  it('null/undefined는 미설정으로 간주해 꺼짐이 아니다', () => {
    expect(isToggledOff(null)).toBe(false)
    expect(isToggledOff(undefined)).toBe(false)
  })

  it('false, "false", "아니오", "아니요", "off"는 모두 꺼짐이다', () => {
    expect(isToggledOff(false)).toBe(true)
    expect(isToggledOff('false')).toBe(true)
    expect(isToggledOff('아니오')).toBe(true)
    expect(isToggledOff('아니요')).toBe(true)
    expect(isToggledOff('off')).toBe(true)
  })

  it('true, "예", "on", 빈 문자열은 꺼짐이 아니다', () => {
    expect(isToggledOff(true)).toBe(false)
    expect(isToggledOff('예')).toBe(false)
    expect(isToggledOff('on')).toBe(false)
    expect(isToggledOff('')).toBe(false)
  })
})

describe('isToggledOn', () => {
  it('미설정(null/undefined)은 꺼짐 — 기존 청첩장이 새 옵트인 기능에 자동 편입되면 안 된다', () => {
    expect(isToggledOn(null)).toBe(false)
    expect(isToggledOn(undefined)).toBe(false)
  })

  it('true, "true", "예", "on"만 켜짐이다', () => {
    expect(isToggledOn(true)).toBe(true)
    expect(isToggledOn('true')).toBe(true)
    expect(isToggledOn('예')).toBe(true)
    expect(isToggledOn('on')).toBe(true)
  })

  it('꺼짐 값들과 빈 문자열은 켜짐이 아니다', () => {
    expect(isToggledOn(false)).toBe(false)
    expect(isToggledOn('아니오')).toBe(false)
    expect(isToggledOn('아니요')).toBe(false)
    expect(isToggledOn('off')).toBe(false)
    expect(isToggledOn('')).toBe(false)
  })

  it('isToggledOff 와 서로 반대가 아니다 — 미설정일 때 둘 다 false 다', () => {
    expect(isToggledOff(undefined)).toBe(false)
    expect(isToggledOn(undefined)).toBe(false)
  })
})

describe('formatWeddingTimeLabel', () => {
  it('HH:MM 을 12시간제 영문 표기로 바꾼다', () => {
    expect(formatWeddingTimeLabel('12:00')).toBe('12PM')
    expect(formatWeddingTimeLabel('00:30')).toBe('12:30AM')
    expect(formatWeddingTimeLabel('23:45')).toBe('11:45PM')
  })

  it('한국어 표기도 오전/오후가 있으면 해석한다', () => {
    // 실제 DB 에 "낮 12시" 형태가 남아 있다 — 폼의 시간 선택기가 생기기 전 값이다.
    expect(formatWeddingTimeLabel('낮 12시')).toBe('12PM')
    expect(formatWeddingTimeLabel('오후 1시 30분')).toBe('1:30PM')
    expect(formatWeddingTimeLabel('오전 11시')).toBe('11AM')
    expect(formatWeddingTimeLabel('저녁 6시')).toBe('6PM')
  })

  it('해석할 수 없으면 원문을 그대로 둔다', () => {
    // 못 읽었다고 지워버리면 고객이 적어 넣은 정보가 화면에서 사라진다.
    for (const raw of ['정오', '12시', '해질 무렵', '25:00']) {
      expect(formatWeddingTimeLabel(raw)).toBe(raw)
    }
  })

  it('빈 값과 00:00 은 시간 없음으로 본다', () => {
    for (const raw of ['', '  ', '00:00', null, undefined, 12]) {
      expect(formatWeddingTimeLabel(raw)).toBe('')
    }
  })
})
