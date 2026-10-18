/**
 * 모바일 감사장 이미지 — 관리자 "도구 > 모바일감사장"(§app/admin/(dashboard)/tools)이
 * 미리보기와 내보내기에 같은 함수를 써서, 화면에서 본 것과 저장된 파일이 똑같이 나온다.
 * HTML 을 캡처하지 않고 캔버스에 직접 그린다 — 캡처 라이브러리는 폰트·배경 이미지가
 * 기기마다 다르게 찍히는 일이 잦고, 이 정도 배치는 직접 그리는 편이 단순하다.
 */

/** 휴대폰 화면 비율(9:16) — 카카오톡 등으로 보내 전체 화면으로 보기 좋은 크기 */
export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1920

export const DEFAULT_THANK_YOU_TEXT = [
  "바쁘신 와중에도 저희 결혼식에 함께해 주시고",
  "따뜻한 축하를 보내주셔서 진심으로 감사드립니다.",
  "",
  "보내주신 축복을 오래 간직하며",
  "서로 아끼고 행복하게 잘 살겠습니다.",
].join("\n")

export const DEFAULT_THANK_YOU_NAME = "신랑 ○○○ · 신부 ○○○ 올림"

export interface ThankYouCardOptions {
  /** 배경 이미지(로드 완료된 것). 없으면 backgroundColor 로 칠한다 */
  backgroundImage: HTMLImageElement | null
  backgroundColor: string
  textColor: string
  /** CSS font-family 값 (예: "'Nanum Myeongjo', serif") */
  fontFamily: string
  body: string
  name: string
}

const SIDE_PADDING = 120
const BODY_SIZE = 46
const NAME_SIZE = 50
const LINE_HEIGHT = 1.75
const NAME_GAP = 110

/** 한 줄 폭을 넘으면 띄어쓰기 단위로, 띄어쓰기가 없는 긴 덩어리는 글자 단위로 나눈다 */
export function wrapLines(ctx: Pick<CanvasRenderingContext2D, "measureText">, text: string, maxWidth: number): string[] {
  const out: string[] = []
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      out.push("")
      continue
    }
    let line = ""
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate
        continue
      }
      if (line) out.push(line)
      // 단어 하나가 한 줄보다 길면 글자 단위로 자른다
      let chunk = ""
      for (const ch of word) {
        if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
          out.push(chunk)
          chunk = ch
        } else {
          chunk += ch
        }
      }
      line = chunk
    }
    out.push(line)
  }
  return out
}

/** 배경을 잘라내며 꽉 채운다(CSS background-size: cover 와 같은 규칙) */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const scale = Math.max(CARD_WIDTH / img.naturalWidth, CARD_HEIGHT / img.naturalHeight)
  const w = img.naturalWidth * scale
  const h = img.naturalHeight * scale
  ctx.drawImage(img, (CARD_WIDTH - w) / 2, (CARD_HEIGHT - h) / 2, w, h)
}

export function drawThankYouCard(ctx: CanvasRenderingContext2D, o: ThankYouCardOptions) {
  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  ctx.fillStyle = o.backgroundColor
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  if (o.backgroundImage) drawCover(ctx, o.backgroundImage)

  const maxWidth = CARD_WIDTH - SIDE_PADDING * 2
  ctx.font = `${BODY_SIZE}px ${o.fontFamily}`
  const bodyLines = o.body.trim() ? wrapLines(ctx, o.body.trim(), maxWidth) : []
  ctx.font = `${NAME_SIZE}px ${o.fontFamily}`
  const nameLines = o.name.trim() ? wrapLines(ctx, o.name.trim(), maxWidth) : []

  const bodyStep = BODY_SIZE * LINE_HEIGHT
  const nameStep = NAME_SIZE * LINE_HEIGHT
  const blockHeight =
    bodyLines.length * bodyStep +
    (bodyLines.length && nameLines.length ? NAME_GAP : 0) +
    nameLines.length * nameStep
  let y = (CARD_HEIGHT - blockHeight) / 2

  ctx.fillStyle = o.textColor
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.font = `${BODY_SIZE}px ${o.fontFamily}`
  for (const line of bodyLines) {
    ctx.fillText(line, CARD_WIDTH / 2, y + bodyStep / 2)
    y += bodyStep
  }
  if (bodyLines.length && nameLines.length) y += NAME_GAP
  ctx.font = `${NAME_SIZE}px ${o.fontFamily}`
  for (const line of nameLines) {
    ctx.fillText(line, CARD_WIDTH / 2, y + nameStep / 2)
    y += nameStep
  }
}
