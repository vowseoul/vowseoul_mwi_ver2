/**
 * content_data 안에 base64(data URI)로 박혀 있는 이미지를 Supabase Storage 로 옮기고
 * 해당 값을 public URL 로 치환한다.
 *
 * 배경: 고객 폼이 예전에 FileReader.readAsDataURL() 로 이미지를 base64 문자열로 만들어
 * form_submissions.data → content_data 로 흘려보냈다. 그 결과 한 청첩장의 발행 페이지가
 * 26MB / 15.6초가 되어 있었다(Storage URL 을 쓰는 청첩장은 0.04MB).
 * 업로드 경로는 lib/image-upload.ts 로 고쳤고, 이 스크립트는 이미 쌓인 데이터를 정리한다.
 *
 * 사용법:
 *   node scripts/migrate-base64-images.mjs <public_slug> [--apply]
 *
 * --apply 없이 실행하면 무엇을 바꿀지 출력만 하고 DB 는 건드리지 않는다.
 * 동일한 이미지가 여러 키에 중복 저장돼 있으면(레거시 camelCase + 필드키) 해시로
 * 묶어 Storage 에는 한 번만 올린다.
 */
import { createHash } from "crypto"
import { readFileSync, writeFileSync } from "fs"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = "vow-seoul-storage"

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.")
  process.exit(1)
}

const slug = process.argv[2]
const apply = process.argv.includes("--apply")
if (!slug) {
  console.error("사용법: node scripts/migrate-base64-images.mjs <public_slug> [--apply]")
  process.exit(1)
}

const headers = { apikey: key, Authorization: `Bearer ${key}` }

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

/** data URI 를 Storage 에 올리고 public URL 반환 (같은 내용이면 재업로드하지 않음) */
const uploaded = new Map()
async function uploadDataUri(dataUri) {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUri)
  if (!match) return null
  const [, mime, b64] = match
  const buffer = Buffer.from(b64, "base64")
  const hash = createHash("sha256").update(buffer).digest("hex")

  if (uploaded.has(hash)) return uploaded.get(hash)

  const ext = EXT_BY_MIME[mime] || "bin"
  const path = `invitations/migrated/${hash.slice(0, 32)}.${ext}`

  if (apply) {
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": mime, "x-upsert": "true" },
      body: buffer,
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`업로드 실패 (${res.status}): ${body.slice(0, 200)}`)
    }
  }

  const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${path}`
  uploaded.set(hash, publicUrl)
  return publicUrl
}

/** 객체를 순회하며 data URI 문자열을 public URL 로 치환 */
async function replaceDataUris(node, path, report) {
  if (typeof node === "string") {
    if (!node.startsWith("data:image/")) return node
    const publicUrl = await uploadDataUri(node)
    if (!publicUrl) return node
    report.push({ path, bytes: node.length, url: publicUrl })
    return publicUrl
  }
  if (Array.isArray(node)) {
    return Promise.all(node.map((v, i) => replaceDataUris(v, `${path}[${i}]`, report)))
  }
  if (node && typeof node === "object") {
    const out = {}
    for (const [k, v] of Object.entries(node)) {
      out[k] = await replaceDataUris(v, path ? `${path}.${k}` : k, report)
    }
    return out
  }
  return node
}

const res = await fetch(
  `${url}/rest/v1/invitations?select=id,public_slug,content_data&public_slug=eq.${encodeURIComponent(slug)}`,
  { headers },
)
const rows = await res.json()
if (!Array.isArray(rows) || rows.length === 0) {
  console.error(`'${slug}' 청첩장을 찾을 수 없습니다.`)
  process.exit(1)
}

const row = rows[0]
const before = JSON.stringify(row.content_data).length

// 되돌릴 수 있도록 원본을 파일로 남긴다
const backupPath = `content_data-backup-${slug}-${Date.now()}.json`
writeFileSync(backupPath, JSON.stringify(row.content_data))
console.log(`원본 백업: ${backupPath}`)

const report = []
const migrated = await replaceDataUris(row.content_data, "", report)
const after = JSON.stringify(migrated).length

console.log(`\n${apply ? "[적용]" : "[미리보기 — DB 변경 없음]"} ${slug}`)
for (const r of report) {
  console.log(`  ${r.path}: ${(r.bytes / 1048576).toFixed(2)}MB → ${r.url.split("/").pop()}`)
}
console.log(`\n  content_data: ${(before / 1048576).toFixed(2)}MB → ${(after / 1024).toFixed(1)}KB`)
console.log(`  base64 ${report.length}개, Storage 업로드 ${uploaded.size}개(중복 제거됨)`)

if (!apply) {
  console.log("\n실제로 반영하려면 --apply 를 붙여 다시 실행하세요.")
  process.exit(0)
}

const patch = await fetch(`${url}/rest/v1/invitations?id=eq.${row.id}`, {
  method: "PATCH",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ content_data: migrated }),
})
if (!patch.ok) {
  console.error(`DB 갱신 실패 (${patch.status}):`, (await patch.text()).slice(0, 300))
  console.error(`백업 파일로 복구하세요: ${backupPath}`)
  process.exit(1)
}
console.log("\n✅ 반영 완료")
