import { describe, it, expect } from 'vitest'
import { pickFormSubmission } from '@/lib/form-submission'

describe('pickFormSubmission', () => {
  it('객체로 오면 그대로 돌려준다 — UNIQUE 제약 때문에 PostgREST 가 to-one 으로 주는 실제 경로', () => {
    const row = { id: 'a', data: { groom_name: '홍길동' } }
    expect(pickFormSubmission(row)).toBe(row)
  })

  it('배열로 와도 첫 건을 꺼낸다 (제약이 없는 환경/과거 데이터 대비)', () => {
    const row = { id: 'a' }
    expect(pickFormSubmission([row])).toBe(row)
  })

  it('없으면 null', () => {
    expect(pickFormSubmission(null)).toBeNull()
    expect(pickFormSubmission(undefined)).toBeNull()
    expect(pickFormSubmission([])).toBeNull()
  })
})
