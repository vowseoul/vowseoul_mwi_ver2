/**
 * 모바일 감사장 이미지 — 관리자 "도구 > 모바일감사장"(§app/admin/(dashboard)/tools)이
 * 미리보기와 내보내기에 같은 함수를 써서, 화면에서 본 것과 저장된 파일이 똑같이 나온다.
 * HTML 을 캡처하지 않고 캔버스에 직접 그린다 — 캡처 라이브러리는 폰트·배경 이미지가
 * 기기마다 다르게 찍히는 일이 잦고, 이 정도 배치는 직접 그리는 편이 단순하다.
 */

/** 아이폰 프로 맥스 화면 크기(1290×2796) — 카카오톡 등으로 보내 전체 화면으로 볼 때 꽉 찬다 */
export const CARD_WIDTH = 1290
export const CARD_HEIGHT = 2796

export const DEFAULT_THANK_YOU_TEXT = [
  "소중한 날, 따뜻한 사랑으로 함께해 주셔서 감사드립니다.",
  "",
  "바쁘신 와중에도 귀한 걸음 하시어",
  "저희 자녀들의 소중한 날을 함께해 주시고",
  "따뜻한 축복을 보내 주셔서 진심으로 감사드립니다.",
  "",
  "보내주신 축하와 사랑 덕분에 딸 지혜의 새로운 출발이",
  "더욱 빛나는 순간으로 오래도록 기억될 것 같습니다.",
  "",
  "오늘 전해주신 사랑의 마음을 깊이 간직하며",
  "두 아이가 서로 아끼고 행복한 가정을 이루어 가도록 지켜보겠습니다.",
  "",
  "베풀어 주신 마음에 다시 한번 감사드리며",
  "늘 건강과 행복이 함께하시기를 기원합니다.",
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
  /** 본문 위아래 이동(px, +면 아래). 이름도 본문 끝을 기준으로 따라 움직인다 */
  bodyOffsetY?: number
  /** 본문 끝 → 이름 간격을 기본값에서 더하거나 뺀다(px, +면 아래) */
  nameOffsetY?: number
  /** 글자 크기(px). 줄 간격도 같은 비율로 따라 커진다. 미설정 시 DEFAULT_FONT_SIZE */
  fontSize?: number
}

/*
 * 배치 수치는 디자인 시안(1290×2796, "Thank You"·꽃다발이 위에, 봉투가 아래에 그려진
 * 배경) 기준이다. 본문은 꽃다발 아래에서 시작해 아래로 흘러내리고, 이름은 본문 끝에서
 * 일정 간격 아래에 옅은 상자를 깔고 놓인다 — 가운데 정렬이 아니라 위에서부터 고정이라
 * 문구가 길어져도 위쪽 그림을 덮지 않는다.
 */
/** 기본 폰트(교보 손글씨 2020) 기준. 이 폰트는 글자가 작게 그려져 시안과 같은 크기가 되려면 44px 이다 */
export const DEFAULT_FONT_SIZE = 44
export const FONT_SIZE_RANGE = { min: 28, max: 64 }
/** 줄 간격(줄 중심 사이 거리). 빈 줄도 한 줄로 친다 */
const LINE_STEP_RATIO = 62.7 / DEFAULT_FONT_SIZE
const TEXT_MAX_WIDTH = 960
/** 본문 첫 줄 중심의 y */
const BODY_FIRST_LINE_Y = 834
/** 본문 마지막 줄 중심 → 이름 첫 줄 중심 */
const NAME_GAP = 214
const NAME_BOX_COLOR = "rgba(178, 161, 139, 0.2)" // #b2a18b, 불투명도 20%
const NAME_BOX_PAD_X = 20

/** 위치 슬라이더 범위(px). 기본 위치에서 이만큼 위·아래로 옮길 수 있다 */
export const BODY_OFFSET_RANGE = { min: -600, max: 800 }
export const NAME_OFFSET_RANGE = { min: -150, max: 800 }

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

  const fontSize = o.fontSize ?? DEFAULT_FONT_SIZE
  const LINE_STEP = fontSize * LINE_STEP_RATIO
  ctx.font = `${fontSize}px ${o.fontFamily}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const cx = CARD_WIDTH / 2
  const bodyLines = o.body.trim() ? wrapLines(ctx, o.body.trim(), TEXT_MAX_WIDTH) : []
  const nameLines = o.name.trim() ? wrapLines(ctx, o.name.trim(), TEXT_MAX_WIDTH) : []

  const bodyTop = BODY_FIRST_LINE_Y + (o.bodyOffsetY ?? 0)
  let y = bodyTop
  ctx.fillStyle = o.textColor
  for (const line of bodyLines) {
    ctx.fillText(line.trim(), cx, y)
    y += LINE_STEP
  }

  if (nameLines.length) {
    const nameY = (bodyLines.length ? y - LINE_STEP + NAME_GAP : bodyTop) + (o.nameOffsetY ?? 0)
    const boxWidth = Math.max(...nameLines.map((l) => ctx.measureText(l).width)) + NAME_BOX_PAD_X * 2
    const boxHeight = nameLines.length * LINE_STEP
    ctx.fillStyle = NAME_BOX_COLOR
    ctx.fillRect(cx - boxWidth / 2, nameY - LINE_STEP / 2, boxWidth, boxHeight)
    ctx.fillStyle = o.textColor
    nameLines.forEach((line, i) => ctx.fillText(line, cx, nameY + i * LINE_STEP))
  }
}
