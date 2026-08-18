import { describe, it, expect } from 'vitest'
import { resolveDefaultDashboardPassword } from './dashboard-password'

describe('resolveDefaultDashboardPassword', () => {
  it('정상 번호는 뒷 4자리를 그대로 쓴다', () => {
    expect(resolveDefaultDashboardPassword('010-7777-8888').password).toBe('8888')
    expect(resolveDefaultDashboardPassword('01077778888').password).toBe('8888')
    expect(resolveDefaultDashboardPassword('010 7777 8888').password).toBe('8888')
  })

  it('자리수가 모자란 오타 번호에서도 숫자만 남는다', () => {
    // 예전엔 문자열을 그대로 slice(-4) 해서 "-567"/"2-34" 처럼 하이픈이 섞였고,
    // 담당자는 "뒷 4자리"라고 안내하는데 고객은 못 들어가는 상태가 됐다.
    expect(resolveDefaultDashboardPassword('010-1234-567').password).toBe('4567')
    expect(resolveDefaultDashboardPassword('010-12-34').password).toBe('1234')
    for (const phone of ['010-1234-567', '010-12-34', '010 777 888']) {
      expect(resolveDefaultDashboardPassword(phone).password).toMatch(/^\d{4}$/)
    }
  })

  it('연락처가 없거나 숫자가 4자리 미만이면 고정값으로 떨어지고 그 사실을 알린다', () => {
    for (const phone of [null, undefined, '', '   ', '-', '12']) {
      const r = resolveDefaultDashboardPassword(phone)
      expect(r.password).toBe('0000')
      expect(r.source).toBe('fallback')
    }
  })

  it('사용한 연락처 원문을 그대로 돌려준다 — 관리자 안내 문구가 어느 번호인지 밝혀야 하기 때문', () => {
    expect(resolveDefaultDashboardPassword('010-7777-8888').phone).toBe('010-7777-8888')
    expect(resolveDefaultDashboardPassword('010-7777-8888').source).toBe('phone')
    expect(resolveDefaultDashboardPassword(null).phone).toBeNull()
  })
})
