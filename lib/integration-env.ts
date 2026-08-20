import fs from "fs"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * 통합 테스트용 환경 준비.
 *
 * 라우트 핸들러(인증·권한·파기)는 순수 함수로 떼어낼 수 없는 부분이 대부분이라
 * 실제로 서버에 요청을 보내 확인해야 의미가 있다. 다만 CI 는 시크릿도 DB 도 없이
 * `pnpm test` 만 돌리므로(§.github/workflows/ci.yml), 환경이 없으면 테스트를 실패
 * 시키지 않고 통째로 건너뛴다 — 로컬에서는 진짜 보호막이 되고 CI 는 초록으로 유지된다.
 */

export const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000"

function readEnvLocal(): Record<string, string> {
  try {
    return Object.fromEntries(
      fs.readFileSync(".env.local", "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=")
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
        }),
    )
  } catch {
    return {}
  }
}

const env = { ...readEnvLocal(), ...process.env } as Record<string, string>

/**
 * .env.local 값을 process.env 로도 올린다.
 *
 * vitest 는 environment:"node" 로 돌아 Next 의 .env 로딩을 거치지 않는다. 그래서
 * 이 파일의 클라이언트만 쓰는 테스트는 잘 돌지만, process.env 를 직접 읽는 모듈
 * (lib/supabase-admin.ts → lib/rate-limit.ts 등)을 부르는 순간 "환경변수가 설정되지
 * 않았습니다" 로 죽는다. 라우트가 실제로 쓰는 경로를 그대로 테스트하려면 필요하다.
 *
 * 이미 들어 있는 값은 덮지 않는다 — CI 나 셸에서 준 값이 우선이다.
 */
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DASHBOARD_SESSION_SECRET",
]) {
  if (!process.env[key] && env[key]) process.env[key] = env[key]
}

export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
export const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
export const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * DB 자격증명만 필요한 테스트용(§lib/rls-policy.integration.test.ts).
 * RLS·권한은 Supabase 에만 물어보면 되므로 Next 서버가 떠 있지 않아도 돌릴 수 있다.
 */
export function supabaseAvailable(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY)
}

/** PostgREST 가 노출 중인 테이블/뷰 목록 — 새 테이블이 조용히 끼어드는 걸 잡는 데 쓴다 */
export async function exposedTables(): Promise<string[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  })
  const spec = (await res.json()) as { paths?: Record<string, unknown> }
  return Object.keys(spec.paths ?? {})
    .filter((p) => p !== "/" && !p.includes("{") && !p.startsWith("/rpc/"))
    .map((p) => p.slice(1))
    .sort()
}

/** 서버와 DB 자격증명이 모두 있어야 통합 테스트를 돌린다 */
export async function integrationAvailable(): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return false
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(2500) })
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY)
}

/** Set-Cookie 헤더를 fetch 로 되돌려 보낼 수 있는 형태로 */
export function cookieHeader(res: Response): string {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ")
}
