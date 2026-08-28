import { describe, it, expect } from 'vitest'
import {
  accountGroupOf,
  accountGroupKeys,
  composeAccountText,
  isAccountFilled,
  isExtraAccountKey,
  parseAccountList,
} from './account-fields'
import { buildContentDataFromForm, buildFieldData } from './invitation-data'

describe('accountGroupOf', () => {
  it('신랑·신부 본인 계좌 3필드를 각각의 그룹으로 묶는다', () => {
    expect(accountGroupOf('account_groom_holder')).toBe('account_groom')
    expect(accountGroupOf('account_groom_bank')).toBe('account_groom')
    expect(accountGroupOf('account_groom_number')).toBe('account_groom')
    expect(accountGroupOf('account_bride_number')).toBe('account_bride')
  })

  it('계좌와 무관한 필드는 묶지 않는다', () => {
    expect(accountGroupOf('groom_name')).toBeNull()
    expect(accountGroupOf('extra_account_groom')).toBeNull()
  })

  it('대표 필드는 예금주다 — 나머지 둘은 블럭에 흡수된다', () => {
    expect(accountGroupKeys('account_groom').holder).toBe('account_groom_holder')
  })
})

describe('parseAccountList', () => {
  it('배열은 필드 3개만 남겨 정규화한다', () => {
    expect(parseAccountList([{ holder: '홍길동', bank: '국민', number: '123', junk: 1 }]))
      .toEqual([{ holder: '홍길동', bank: '국민', number: '123' }])
  })

  it('빠진 키는 빈 문자열로 채운다', () => {
    expect(parseAccountList([{ holder: '홍길동' }])).toEqual([{ holder: '홍길동', bank: '', number: '' }])
  })

  it('예전 자유 입력(문자열)은 null — 원문을 그대로 보여줘야 한다', () => {
    expect(parseAccountList('아버지 신한 110-222\n어머니 우리 1002-333')).toBeNull()
  })

  it('JSON 문자열로 굳은 배열도 되살린다 (임시저장 경로)', () => {
    expect(parseAccountList('[{"holder":"홍","bank":"국민","number":"1"}]'))
      .toEqual([{ holder: '홍', bank: '국민', number: '1' }])
  })

  it('빈 값은 null', () => {
    expect(parseAccountList(undefined)).toBeNull()
    expect(parseAccountList('')).toBeNull()
  })
})

describe('composeAccountText / isAccountFilled', () => {
  it('은행 계좌번호 예금주 순으로 합친다', () => {
    expect(composeAccountText({ holder: '홍길동', bank: '국민은행', number: '123-456' }))
      .toBe('국민은행 123-456 홍길동')
  })

  it('빈 칸은 건너뛴다', () => {
    expect(composeAccountText({ holder: '홍길동', bank: '', number: '123' })).toBe('123 홍길동')
  })

  it('전부 비면 미입력으로 본다', () => {
    expect(isAccountFilled({ holder: '', bank: '', number: '  ' })).toBe(false)
    expect(isAccountFilled({ holder: '', bank: '', number: '123' })).toBe(true)
  })
})

describe('isExtraAccountKey', () => {
  it('혼주 계좌 키만 배열 필드로 취급한다', () => {
    expect(isExtraAccountKey('extra_account_groom')).toBe(true)
    expect(isExtraAccountKey('extra_account_bride')).toBe(true)
    expect(isExtraAccountKey('account_groom_holder')).toBe(false)
  })
})

/**
 * 폼 → 청첩장 파이프라인 회귀 방지. buildFieldData 는 문자열만 통과시키므로 혼주 계좌
 * 배열은 반드시 raw 로 읽어야 한다 — 이걸 잊으면 청첩장에서 혼주 계좌가 통째로 사라진다.
 */
describe('계좌 배열이 폼 → 청첩장까지 살아남는다', () => {
  const formData = {
    account_groom_bank: '국민은행',
    account_groom_number: '123-456',
    account_groom_holder: '홍길동',
    extra_account_groom: [
      { holder: '홍아버지', bank: '신한은행', number: '110-222' },
      { holder: '홍어머니', bank: '우리은행', number: '1002-333' },
    ],
  } as any

  it('content_data 로 배열이 그대로 넘어간다', () => {
    const content = buildContentDataFromForm(formData)
    expect(parseAccountList(content.extra_account_groom)).toHaveLength(2)
  })

  it('본인 계좌(문자열)는 data 로, 혼주 계좌(배열)는 raw 로만 온다', () => {
    const content = buildContentDataFromForm(formData)
    const data = buildFieldData(content as any)
    expect(data.account_groom_bank).toBe('국민은행')
    // 배열은 data 에 실리지 않는다 — 슬롯이 raw 에서 읽어야 하는 이유
    expect(data.extra_account_groom).toBeUndefined()
    expect(parseAccountList(content.extra_account_groom)?.map(composeAccountText)).toEqual([
      '신한은행 110-222 홍아버지',
      '우리은행 1002-333 홍어머니',
    ])
  })
})
