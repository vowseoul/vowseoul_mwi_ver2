import { describe, it, expect } from 'vitest'
import { formatPostcodeResult } from './address-search-field'

describe('formatPostcodeResult', () => {
  it('도로명 주소를 우선 쓴다', () => {
    expect(formatPostcodeResult({ roadAddress: '서울 중구 세종대로 110', jibunAddress: '서울 중구 태평로1가 31' }))
      .toBe('서울 중구 세종대로 110')
  })

  it('건물명이 있으면 괄호로 덧붙인다 — 하객이 알아보기 쉬워진다', () => {
    expect(formatPostcodeResult({
      roadAddress: '서울 중구 세종대로 110', jibunAddress: '서울 중구 태평로1가 31', buildingName: '서울시청',
    })).toBe('서울 중구 세종대로 110 (서울시청)')
  })

  it('도로명이 없는 지역은 지번 주소로 대체한다', () => {
    expect(formatPostcodeResult({ roadAddress: '', jibunAddress: '전남 완도군 청산면 도청리 산 1' }))
      .toBe('전남 완도군 청산면 도청리 산 1')
  })

  it('건물명이 공백뿐이면 괄호를 붙이지 않는다', () => {
    expect(formatPostcodeResult({ roadAddress: '서울 중구 세종대로 110', jibunAddress: '', buildingName: '   ' }))
      .toBe('서울 중구 세종대로 110')
  })
})
