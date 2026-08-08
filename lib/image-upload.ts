import { uploadFile } from "./storage"

/**
 * 이미지 업로드 전 리사이즈·재압축.
 *
 * 배경: 고객 폼이 원본 파일을 base64(data URI)로 만들어 form_submissions.data
 * (jsonb)에 통째로 저장하고 있었다. base64 는 원본보다 ~33% 크고, 그 값이
 * content_data 를 거쳐 발행 페이지 HTML 에 그대로 실려나가면서 실제로 한 청첩장이
 * 26MB / 15.6초짜리 페이지가 되어 있었다(Storage URL 을 쓰는 청첩장은 0.04MB).
 *
 * 청첩장은 모바일 화면에서 보는 물건이라 원본 화질이 필요 없다. 요즘 미러리스
 * JPEG 이 8~15MB, 보정본은 20~40MB 인데 장변 2000px / JPEG 85% 로 줄이면
 * 보통 1MB 아래로 떨어지면서 육안 차이가 없다.
 */

export interface CompressOptions {
  /** 장변 최대 픽셀 */
  maxDimension?: number
  /** JPEG 품질 (0~1) */
  quality?: number
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 2000,
  quality: 0.85,
}

/** 리사이즈가 의미 없는 형식 — 벡터이거나 애니메이션이 깨진다 */
const SKIP_COMPRESSION = ["image/svg+xml", "image/gif"]

/** 업로드 자체를 거부할 크기 (리사이즈 실패 시의 최후 방어선) */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20MB

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

/**
 * 이미지를 장변 maxDimension 이하로 줄이고 JPEG 로 재압축한다.
 * 이미 충분히 작거나 처리에 실패하면 원본 File 을 그대로 돌려준다
 * (업로드 자체를 막지는 않는다 — 크기 상한은 uploadImage 에서 검사).
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  const { maxDimension, quality } = { ...DEFAULTS, ...options }

  if (typeof window === "undefined") return file
  if (!file.type.startsWith("image/")) return file
  if (SKIP_COMPRESSION.includes(file.type)) return file

  try {
    // imageOrientation: 'from-image' 로 EXIF 회전을 미리 반영한다 —
    // 이걸 빼면 세로로 찍은 사진이 눕는다.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    const { width, height } = bitmap

    const scale = Math.min(1, maxDimension / Math.max(width, height))
    const targetW = Math.round(width * scale)
    const targetH = Math.round(height * scale)

    const canvas = document.createElement("canvas")
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    )
    if (!blob) return file

    // 재압축이 오히려 커졌다면(이미 잘 압축된 작은 파일) 원본을 쓴다
    if (blob.size >= file.size) return file

    const baseName = file.name.replace(/\.[^.]+$/, "")
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() })
  } catch (err) {
    console.warn("이미지 압축 실패, 원본을 사용합니다:", err)
    return file
  }
}

/**
 * 리사이즈 후 Supabase Storage 에 올리고 public URL 을 반환한다.
 * 폼·편집기 어디서든 이 함수만 쓰면 base64 가 DB 로 새어 들어가지 않는다.
 */
export async function uploadImage(
  file: File,
  path: string,
  options?: CompressOptions,
): Promise<string> {
  const compressed = await compressImage(file, options)

  if (compressed.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `이미지 용량이 너무 큽니다 (${formatBytes(compressed.size)}). ` +
        `${formatBytes(MAX_UPLOAD_BYTES)} 이하로 줄여서 다시 시도해주세요.`,
    )
  }

  return uploadFile(compressed, path)
}
