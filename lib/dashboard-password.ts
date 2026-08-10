/**
 * invitations.dashboard_password 해시.
 *
 * 지금까지 이 컬럼은 평문("연락처 뒷 4자리")으로 저장됐다 — 개인정보 보호법의
 * 안전성 확보조치 기준(고시 제7조, 비밀번호는 일방향 암호화)을 위반하는 상태였다.
 *
 * Node의 crypto.scrypt가 아니라 Web Crypto(SubtleCrypto) PBKDF2를 쓰는 이유:
 * 청첩장 생성이 지금 서버 라우트를 거치지 않고 관리자 브라우저에서 직접
 * `supabase.from('invitations').insert(...)` 하는 구조라(§hooks/queries/useInvitations.ts),
 * Node 전용 API를 쓰면 그 흐름 전체를 서버 라우트로 옮겨야 한다. Web Crypto는
 * 브라우저·Node(18+) 양쪽에서 동일하게 동작해 생성 흐름을 그대로 두고 해시만
 * 끼워 넣을 수 있다.
 *
 * 저장 형식: "<반복횟수>:<salt-hex>:<hash-hex>"
 */

const PBKDF2_ITERATIONS = 100_000
const HASH_BYTES = 32

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    HASH_BYTES * 8,
  )
  return new Uint8Array(bits)
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  return bytes
}

export async function hashDashboardPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS)
  return `${PBKDF2_ITERATIONS}:${toHex(salt)}:${toHex(hash)}`
}

/** 저장된 해시와 입력값을 상수시간으로 비교한다. 형식이 깨졌으면 항상 false. */
export async function verifyDashboardPassword(input: string, stored: string): Promise<boolean> {
  const parts = stored.split(":")
  if (parts.length !== 3) return false
  const [iterationsStr, saltHex, hashHex] = parts
  const iterations = Number(iterationsStr)
  if (!Number.isFinite(iterations) || iterations <= 0) return false

  const salt = fromHex(saltHex)
  const expected = fromHex(hashHex)
  const actual = await deriveBits(input, salt, iterations)
  if (actual.length !== expected.length) return false

  // Web Crypto엔 timingSafeEqual이 없어 직접 상수시간 비교를 구현한다.
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
  return diff === 0
}

/** 이 형식이 아니면 아직 해시 이전(마이그레이션 전) 평문 값이다 */
export function isHashedDashboardPassword(value: string): boolean {
  return /^\d+:[0-9a-f]{32}:[0-9a-f]+$/.test(value)
}
