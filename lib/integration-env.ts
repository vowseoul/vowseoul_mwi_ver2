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

export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
export const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
export const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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
