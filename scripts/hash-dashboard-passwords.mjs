// 일회성 마이그레이션 — invitations.dashboard_password 평문 → PBKDF2 해시.
// §lib/dashboard-password.ts 와 동일한 알고리즘을 그대로 복붙한다(그쪽은 TS라
// Node에서 바로 import 할 수 없어서). 이미 해시 형식인 행은 건너뛰므로 재실행해도 안전하다.
import { readFileSync } from "node:fs"

const env = {}
readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n")
  .forEach((line) => {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  })

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

const PBKDF2_ITERATIONS = 100_000
const HASH_BYTES = 32

async function deriveBits(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    HASH_BYTES * 8,
  )
  return new Uint8Array(bits)
}

function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function hashDashboardPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS)
  return `${PBKDF2_ITERATIONS}:${toHex(salt)}:${toHex(hash)}`
}

function isHashedDashboardPassword(value) {
  return /^\d+:[0-9a-f]{32}:[0-9a-f]+$/.test(value)
}

async function main() {
  const listRes = await fetch(`${SUPABASE_URL}/rest/v1/invitations?select=id,dashboard_password`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  })
  const invitations = await listRes.json()
  if (!Array.isArray(invitations)) {
    console.error("조회 실패:", invitations)
    process.exit(1)
  }

  let migrated = 0
  let skipped = 0
  for (const inv of invitations) {
    const current = String(inv.dashboard_password ?? "")
    if (!current || isHashedDashboardPassword(current)) {
      skipped++
      continue
    }
    const hashed = await hashDashboardPassword(current)
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/invitations?id=eq.${inv.id}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ dashboard_password: hashed }),
    })
    if (!patchRes.ok) {
      console.error(`  실패 (id=${inv.id}):`, await patchRes.text())
      continue
    }
    migrated++
  }

  console.log(`총 ${invitations.length}건 중 ${migrated}건 해시로 전환, ${skipped}건 건너뜀(이미 해시됨/빈값).`)
}

main()
