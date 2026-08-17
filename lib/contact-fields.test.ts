import { describe, it, expect } from 'vitest'
import {
  composeContactText,
  isContactFilled,
  isExtraContactsKey,
  parseContactList,
} from './contact-fields'

describe('parseContactList', () => {
  it('배열은 필드 3개만 남겨 정규화한다', () => {
    expect(parseContactList([{ relation: '신랑 아버지', name: '홍아무개', phone: '010-1', junk: 1 }]))
      .toEqual([{ relation: '신랑 아버지', name: '홍아무개', phone: '010-1' }])
  })

  it('빠진 키는 빈 문자열로 채운다', () => {
    expect(parseContactList([{ phone: '010-1' }])).toEqual([{ relation: '', name: '', phone: '010-1' }])
  })

  it('배열이 아닌 값은 null', () => {
    expect(parseContactList(undefined)).toBeNull()
    expect(parseContactList('')).toBeNull()
    expect(parseContactList('그냥 문자열')).toBeNull()
  })

  it('JSON 문자열로 굳은 배열도 되살린다 (임시저장 경로)', () => {
    expect(parseContactList('[{"relation":"신부 어머니","name":"김","phone":"010-2"}]'))
      .toEqual([{ relation: '신부 어머니', name: '김', phone: '010-2' }])
  })
})

describe('composeContactText / isContactFilled', () => {
  it('관계, 이름, 연락처 순으로 합친다', () => {
    expect(composeContactText({ relation: '신랑 아버지', name: '홍아무개', phone: '010-1234-5678' }))
      .toBe('신랑 아버지 홍아무개 010-1234-5678')
  })

  it('이름이 없어도 관계+연락처는 나온다', () => {
    expect(composeContactText({ relation: '신랑측 삼촌', name: '', phone: '010-1' })).toBe('신랑측 삼촌 010-1')
  })

  it('전화번호가 없으면 전화·문자 버튼을 걸 곳이 없어 미입력으로 본다', () => {
    expect(isContactFilled({ relation: '신랑 아버지', name: '홍아무개', phone: '' })).toBe(false)
    expect(isContactFilled({ relation: '', name: '', phone: '010-1' })).toBe(true)
  })
})

describe('isExtraContactsKey', () => {
  it('extra_contacts 키만 배열 필드로 취급한다', () => {
    expect(isExtraContactsKey('extra_contacts')).toBe(true)
    expect(isExtraContactsKey('groom_phone')).toBe(false)
  })
})
