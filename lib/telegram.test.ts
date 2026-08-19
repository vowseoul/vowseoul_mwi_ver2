import { describe, it, expect } from 'vitest'
import { parseTelegramSettings, TELEGRAM_KIND_LABELS } from './telegram'

describe('parseTelegramSettings', () => {
  it('설정 행이 없으면 전부 켜진 것으로 본다', () => {
    // 이 설정이 생기기 전부터 세 알림은 이미 나가고 있었다. 행이 없다는 이유로 조용해지면
    // 관리자는 알림이 사라진 사실 자체를 알 수 없다 — 없으면 켜짐이어야 한다.
    for (const value of [null, undefined, {}, 'garbage', 42]) {
      expect(parseTelegramSettings(value)).toEqual({
        form_submit: true, review_revision: true, review_approved: true,
      })
    }
  })

  it('명시적으로 false 인 종류만 꺼진다', () => {
    const s = parseTelegramSettings({ form_submit: false, review_approved: true })
    expect(s.form_submit).toBe(false)
    expect(s.review_approved).toBe(true)
    expect(s.review_revision).toBe(true) // 빠진 키는 켜짐 유지
  })

  it('화면에 그리는 목록과 저장되는 키가 일치한다', () => {
    // UI 는 TELEGRAM_KIND_LABELS 를 map 해서 스위치를 그리고 그 key 로 저장한다.
    // 여기가 어긋나면 "껐는데 계속 온다"가 되고, 타입만으로는 안 걸린다.
    expect(TELEGRAM_KIND_LABELS.map((k) => k.kind).sort())
      .toEqual(Object.keys(parseTelegramSettings(null)).sort())
  })
})
