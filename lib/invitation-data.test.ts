import { describe, it, expect } from 'vitest'
import { buildFieldData, mergeInvitationRaw, normalizeLegacyKeys } from './invitation-data'

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
