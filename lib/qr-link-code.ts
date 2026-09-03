import { randomBytes } from "crypto"

/**
 * QR 리디렉션 코드 생성.
 *
 * 사람이 눈으로 옮겨 적을 일이 있어서(다른 청첩장에 QR 이어붙이기) 헷갈리는 글자를
 * 뺀다 — 0/O, 1/l/I 가 섞이면 "코드를 넣었는데 안 된다"가 되고, 정작 인쇄물이
 * 걸린 상황에서 그 혼란이 제일 비싸다.
 */
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"
const LENGTH = 8

export function generateQrCode(): string {
  const bytes = randomBytes(LENGTH)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")
}

/** 사람이 입력한 코드를 관대하게 받아준다 — 대문자·공백·주소 통째로 붙여넣기 */
export function normalizeQrCode(input: string): string {
  const trimmed = input.trim().toLowerCase()
  // "https://…/q/ab12cd" 를 그대로 붙여넣는 게 가장 흔한 입력이다
  const fromUrl = trimmed.match(/\/q\/([a-z0-9]+)/)
  const raw = fromUrl ? fromUrl[1] : trimmed
  return raw.replace(/[^a-z0-9]/g, "")
}
