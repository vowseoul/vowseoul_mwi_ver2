import { describe, it, expect } from 'vitest'
import { resolveLinkPreview, resolveShareCard } from './kakao-share'

const base = { groom_name: '민준', bride_name: '서연', wedding_date: '2027-05-07', venue_name: '그랜드홀', main_image: 'main.jpg' }

describe('resolveLinkPreview', () => {
  it('falls back to names, date+venue, and main image', () => {
    expect(resolveLinkPreview(base)).toEqual({ title: '민준 ♥ 서연 결혼합니다', description: '2027-05-07 · 그랜드홀', image: 'main.jpg' })
  })
  it('uses link-preview values when set', () => {
    expect(resolveLinkPreview({ ...base, og_title: 'T', og_description: 'D', og_image: 'og.jpg' })).toEqual({ title: 'T', description: 'D', image: 'og.jpg' })
  })
})

describe('resolveShareCard', () => {
  it('shares the link-preview values when no button-card values are set', () => {
    expect(resolveShareCard({ ...base, og_title: 'T', og_description: 'D', og_image: 'og.jpg' })).toEqual({ title: 'T', description: 'D', image: 'og.jpg' })
  })
  it('lets button-card values override each field independently', () => {
    const c = resolveShareCard({ ...base, og_title: 'T', og_image: 'og.jpg', share_btn_img: 'btn.jpg', share_btn_text: '첫 줄\n둘째 줄' })
    expect(c).toEqual({ title: 'T', description: '첫 줄\n둘째 줄', image: 'btn.jpg' })
  })
  it('falls back to names, default text, and main image', () => {
    expect(resolveShareCard(base)).toEqual({ title: '민준 ♥ 서연', description: '저희 결혼식에 초대합니다', image: 'main.jpg' })
  })
})
