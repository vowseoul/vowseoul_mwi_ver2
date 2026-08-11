import type { SupabaseClient } from "@supabase/supabase-js"
import { BUCKET_NAME } from "./storage"

/**
 * 하드 삭제되는 청첩장/고객의 Storage 업로드 파일 정리.
 *
 * uploadImage()가 실제로 쓰는 경로 접두사만 지운다 — 로고·폰트·BGM 라이브러리 같은
 * 공용 에셋은 다른 경로(main-images/, logo-images/, fonts/, bgm/ 등)에 있어
 * 여기 걸리지 않는다. 업로드 파일명이 매번 uuid(§lib/storage.ts uploadFile)라
 * 이 두 접두사 안에서는 청첩장·고객 간 파일 재사용이 구조적으로 불가능하다 —
 * 그래서 다른 레코드가 같은 파일을 참조하는지 별도로 확인하지 않고 지워도 안전하다.
 */
const DELETABLE_PATH_PREFIXES = ["invitations/self-edit/", "forms/submissions/"]

function collectStorageUrls(value: unknown, bucketPrefix: string, out: Set<string>): void {
  if (typeof value === "string") {
    const marker = `${bucketPrefix}/`
    const idx = value.indexOf(marker)
    if (idx === -1) return
    const filePath = value.slice(idx + marker.length)
    if (DELETABLE_PATH_PREFIXES.some((p) => filePath.startsWith(p))) out.add(filePath)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((v) => collectStorageUrls(v, bucketPrefix, out))
    return
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((v) => collectStorageUrls(v, bucketPrefix, out))
  }
}

/** sources에 담긴 jsonb 값들을 재귀 탐색해 삭제 대상 Storage 파일을 지운다. 지운 개수를 반환한다. */
export async function deleteInvitationUploads(supabase: SupabaseClient, sources: unknown[]): Promise<number> {
  const filePaths = new Set<string>()
  for (const source of sources) collectStorageUrls(source, BUCKET_NAME, filePaths)
  if (filePaths.size === 0) return 0

  const { error } = await supabase.storage.from(BUCKET_NAME).remove(Array.from(filePaths))
  if (error) {
    console.error("deleteInvitationUploads failed:", error.message)
    return 0
  }
  return filePaths.size
}
