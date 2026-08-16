import qrcode from "qrcode-generator"

/**
 * 청첩장 주소를 QR로 만들어 SVG/PNG로 내려받게 하는 유틸.
 *
 * qrcode-generator 는 "모듈(흑백 칸) 격자"까지만 만들어 주고 그리기는 하지 않는다.
 * 그래서 SVG는 여기서 직접 조립하고, PNG는 같은 격자를 캔버스에 찍어서 뽑는다 —
 * 렌더링까지 해주는 라이브러리(qrcode)는 CLI용 yargs·pngjs 를 런타임 의존성으로
 * 끌고 오는데, 우리가 쓰는 건 격자 하나뿐이라 그 비용을 낼 이유가 없다.
 */

/** 오류정정 레벨. M(15% 복원)이면 인쇄물에 얹어도 무난하고 QR도 과하게 커지지 않는다 */
const ERROR_CORRECTION = "M"

/** QR 규격상 코드 사방에 최소 4모듈의 여백(quiet zone)이 없으면 리더기가 인식하지 못한다 */
const QUIET_ZONE = 4

function buildModules(text: string): boolean[][] {
  // typeNumber 0 = 데이터 길이에 맞는 최소 버전 자동 선택
  const qr = qrcode(0, ERROR_CORRECTION)
  qr.addData(text)
  qr.make()
  const count = qr.getModuleCount()
  return Array.from({ length: count }, (_, row) =>
    Array.from({ length: count }, (_, col) => qr.isDark(row, col))
  )
}

/**
 * 검은 모듈을 SVG path 하나로 합친다. <rect>를 모듈마다 찍으면 수백 개 노드가 생겨
 * 파일이 커지고 일러스트레이터 같은 툴에서 다루기도 번거롭다.
 */
export function renderQrSvg(text: string): string {
  const modules = buildModules(text)
  const size = modules.length + QUIET_ZONE * 2

  const path = modules
    .flatMap((rowModules, row) =>
      rowModules.map((dark, col) =>
        dark ? `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z` : ""
      )
    )
    .join("")

  // viewBox 를 모듈 좌표계로 두면 확대해도 깨지지 않고, shape-rendering 으로
  // 작은 크기에서 모듈 경계가 흐려지는 것도 막는다.
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size * 8}" height="${size * 8}" shape-rendering="crispEdges">`,
    `<rect width="${size}" height="${size}" fill="#ffffff"/>`,
    `<path d="${path}" fill="#000000"/>`,
    `</svg>`,
  ].join("")
}

/**
 * 같은 격자를 캔버스에 찍어 PNG Blob 으로 만든다. `pixelSize`는 목표 한 변 픽셀 수이며,
 * 모듈 수로 나눠떨어지지 않으면 소수점 좌표 때문에 모듈 경계가 흐려지므로 정수배로
 * 내림한 뒤 실제 크기를 다시 계산한다.
 */
export async function renderQrPngBlob(text: string, pixelSize = 1024): Promise<Blob> {
  const modules = buildModules(text)
  const size = modules.length + QUIET_ZONE * 2
  const scale = Math.max(1, Math.floor(pixelSize / size))
  const canvasSize = size * scale

  const canvas = document.createElement("canvas")
  canvas.width = canvasSize
  canvas.height = canvasSize
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("캔버스를 생성할 수 없습니다.")

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvasSize, canvasSize)
  ctx.fillStyle = "#000000"
  modules.forEach((rowModules, row) => {
    rowModules.forEach((dark, col) => {
      if (dark) ctx.fillRect((col + QUIET_ZONE) * scale, (row + QUIET_ZONE) * scale, scale, scale)
    })
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("PNG 변환에 실패했습니다."))
    }, "image/png")
  })
}

/** SVG 문자열을 <img src>에 바로 물릴 수 있는 data URI 로 (미리보기용) */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
