import { describe, it, expect } from 'vitest'
import { renderQrSvg, svgToDataUri } from './qr-code'

describe('renderQrSvg', () => {
  it('스캔 가능한 SVG 구조를 만든다 (흰 배경 + 검은 모듈 path)', () => {
    const svg = renderQrSvg('https://example.com/w/test')
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).toContain('fill="#000000"')
    expect(svg.endsWith('</svg>')).toBe(true)
  })

  it('사방 4모듈 여백(quiet zone)을 남긴다 — 없으면 리더기가 인식하지 못한다', () => {
    const svg = renderQrSvg('hi')
    const viewBox = svg.match(/viewBox="0 0 (\d+) \1"/)
    expect(viewBox).not.toBeNull()
    const size = Number(viewBox![1])
    // 가장 작은 QR(버전1)이 21모듈이므로 여백 8을 더하면 최소 29가 된다
    expect(size).toBeGreaterThanOrEqual(29)
    // 모든 모듈 좌표가 여백 안쪽(>=4)에서 시작해야 한다
    const firstModule = svg.match(/d="M(\d+) (\d+)/)
    expect(Number(firstModule![1])).toBeGreaterThanOrEqual(4)
    expect(Number(firstModule![2])).toBeGreaterThanOrEqual(4)
  })

  it('데이터가 길어지면 더 높은 버전(큰 격자)을 쓴다', () => {
    const short = renderQrSvg('a')
    const long = renderQrSvg('a'.repeat(500))
    const sizeOf = (s: string) => Number(s.match(/viewBox="0 0 (\d+)/)![1])
    expect(sizeOf(long)).toBeGreaterThan(sizeOf(short))
  })

  it('같은 입력이면 같은 결과가 나온다', () => {
    expect(renderQrSvg('https://vowseoul.com')).toBe(renderQrSvg('https://vowseoul.com'))
  })

  /**
   * 인식 가능한 QR인지를 코드로 확인하는 가장 값싼 방법. 파인더 패턴(세 모서리의 7x7
   * 겹눈 사각형)은 위치가 규격으로 고정돼 있어서, 행/열을 뒤집거나 여백 계산이 어긋나면
   * 바로 깨진다 — 렌더링 단계에서 실제로 날 수 있는 버그가 여기서 걸린다.
   */
  it('세 모서리에 파인더 패턴이 규격대로 들어간다', () => {
    const svg = renderQrSvg('https://vowseoul.com/w/demo')
    const size = Number(svg.match(/viewBox="0 0 (\d+)/)![1])

    // path 를 다시 격자로 되돌린다 (M{x} {y}h1v1h-1z 가 검은 모듈 1칸)
    const grid = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
    for (const m of svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
      grid[Number(m[2])][Number(m[1])] = true
    }

    const modules = size - 8 // 여백 4씩 제외한 실제 모듈 수
    const finderAt = (top: number, left: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const onOuterRing = r === 0 || r === 6 || c === 0 || c === 6
          const inCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4
          const expected = onOuterRing || inCenter // 그 사이 링은 흰색
          if (grid[top + 4 + r][left + 4 + c] !== expected) return false
        }
      }
      return true
    }

    expect(finderAt(0, 0)).toBe(true) // 좌상단
    expect(finderAt(0, modules - 7)).toBe(true) // 우상단
    expect(finderAt(modules - 7, 0)).toBe(true) // 좌하단
    // 우하단에는 파인더가 없다 — 스캐너가 회전 방향을 잡는 근거다
    expect(finderAt(modules - 7, modules - 7)).toBe(false)
  })
})

describe('svgToDataUri', () => {
  it('img src 에 바로 넣을 수 있는 형태로 인코딩한다', () => {
    const uri = svgToDataUri('<svg><rect width="1" height="1"/></svg>')
    expect(uri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    // '#' 같은 문자가 그대로 남으면 data URI 가 조각 구분자로 잘린다
    expect(svgToDataUri('<svg fill="#000"/>')).not.toContain('#')
  })
})
