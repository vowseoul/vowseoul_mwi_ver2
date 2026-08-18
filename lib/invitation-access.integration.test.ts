import { describe, it, expect, beforeAll, afterAll } from "vitest"
import {
  BASE_URL, adminClient, anonClient, cookieHeader, integrationAvailable,
} from "./integration-env"
import { hashDashboardPassword } from "./dashboard-password"

/**
 * 하객·신랑신부에게 실제로 무엇이 열려 있는지 확인하는 통합 테스트.
 *
 * 여기 있는 것들은 전부 "조용히 깨져도 한참 뒤에나 발견되는" 종류다 —
 *  - 삭제·정지한 청첩장이 계속 열려 있어도 관리자 목록에서는 사라져 보인다
 *  - 방명록 쓰기가 막혀도 관리자 화면에서는 아무 이상이 안 보인다(읽기는 서버 라우트)
 * 실제로 둘 다 운영 중에 깨져 있었고, 화면을 하나씩 눌러보고서야 찾았다.
 *
 * 픽스처는 전용 고객/청첩장을 새로 만들어 쓰고 끝나면 지운다 — 실데이터는 건드리지 않는다.
 */

const SLUG = `itest-${Date.now().toString(36)}`
const PASSWORD = "1234"

let available = false
let customerId = ""
let invitationId = ""

beforeAll(async () => {
  available = await integrationAvailable()
  if (!available) return

  const admin = adminClient()
  const { data: customer } = await admin.from("customers").insert([{
    groom_name: "통합테스트", bride_name: "미지정", phone: `010-0000-${PASSWORD}`,
    wedding_date: null, venue_name: "미지정", venue_address: "미지정", status: "published",
  }]).select().single()
  customerId = customer!.id

  const { data: version } = await admin.from("theme_versions").select("id").limit(1).maybeSingle()
  const { data: invitation } = await admin.from("invitations").insert([{
    customer_id: customerId,
    theme_version_id: version!.id,
    public_slug: SLUG,
    dashboard_slug: `dash-${SLUG}`,
    dashboard_password: await hashDashboardPassword(PASSWORD),
    content_data: {}, block_order: [], status: "published", is_sample: false,
    expires_at: new Date(Date.now() + 365 * 864e5).toISOString(),
  }]).select().single()
  invitationId = invitation!.id
}, 60000)

afterAll(async () => {
  if (!available || !customerId) return
  const admin = adminClient()
  await admin.from("audit_logs").delete().eq("invitation_id", invitationId)
  await admin.from("guestbook_entries").delete().eq("invitation_id", invitationId)
  await admin.from("invitations").delete().eq("customer_id", customerId)
  await admin.from("customers").delete().eq("id", customerId)
}, 60000)

/** 이 상태에서 청첩장이 하객에게 보이는가 */
async function publiclyVisible(): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/w/${SLUG}`)
  const html = await res.text()
  return !html.includes("찾을 수 없는 청첩장")
    && !html.includes("현재 열람할 수 없는")
    && !html.includes("기간이 종료된")
}

async function setState(patch: Record<string, unknown>) {
  await adminClient().from("invitations").update(patch).eq("id", invitationId)
}

describe("청첩장 공개 범위", () => {
  it("published / draft 는 하객에게 열려 있다", async (ctx) => {
    if (!available) return ctx.skip()
    await setState({ status: "published", deleted_at: null })
    expect(await publiclyVisible()).toBe(true)

    // draft 도 의도적으로 열어둔다 — 고객 상세가 발행 전에 이 주소를 복사해 건네는
    // 흐름이 있어서, 막으면 기존 업무가 끊긴다(§app/w/[slug]/page.tsx)
    await setState({ status: "draft" })
    expect(await publiclyVisible()).toBe(true)
  }, 30000)

  it("정지·만료한 청첩장은 하객에게 닫힌다", async (ctx) => {
    if (!available) return ctx.skip()
    await setState({ status: "paused" })
    expect(await publiclyVisible()).toBe(false)

    await setState({ status: "expired" })
    expect(await publiclyVisible()).toBe(false)
  }, 30000)

  it("삭제(소프트)된 청첩장은 열람도 대시보드 로그인도 막힌다", async (ctx) => {
    if (!available) return ctx.skip()
    await setState({ status: "expired", deleted_at: new Date().toISOString() })
    expect(await publiclyVisible()).toBe(false)

    const auth = await fetch(`${BASE_URL}/api/dashboard-auth`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: SLUG, password: PASSWORD }),
    })
    expect(auth.status).toBe(401)

    await setState({ status: "published", deleted_at: null })
  }, 30000)
})

describe("하객 방명록 작성 (anon)", () => {
  it("익명 하객이 방명록을 남길 수 있다", async (ctx) => {
    if (!available) return ctx.skip()
    // .insert().select() 로 되받으려 하면 PostgREST 가 RETURNING 때문에 SELECT 권한을
    // 요구하는데 anon 에겐 없다 — 그래서 INSERT 자체가 통째로 롤백되며 하객에게는
    // "등록에 실패했습니다"만 뜨고 아무것도 저장되지 않았다. 되받지 않는 형태여야 한다.
    const { error } = await anonClient().from("guestbook_entries").insert({
      id: crypto.randomUUID(),
      invitation_id: invitationId,
      author_name: "통합테스트하객",
      message: "축하합니다",
      password_hash: "x",
    })
    expect(error).toBeNull()

    const { count } = await adminClient()
      .from("guestbook_entries").select("id", { count: "exact", head: true })
      .eq("invitation_id", invitationId)
    expect(count).toBe(1)
  }, 30000)

  it("공개 조회는 서버 라우트로만 열려 있다 (anon 직접 SELECT 는 막힘)", async (ctx) => {
    if (!available) return ctx.skip()
    // anon 이 직접 읽을 수 있으면 invitation_id 를 몰라도 전 청첩장 방명록을 긁어갈 수 있다
    const { data } = await anonClient().from("guestbook_entries").select("id").limit(1)
    expect(data ?? []).toHaveLength(0)

    const res = await fetch(`${BASE_URL}/api/guestbook?invitationId=${invitationId}`)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.entries).toHaveLength(1)
  }, 30000)
})

describe("신랑신부 대시보드 인증", () => {
  it("비밀번호가 맞아야 세션이 발급된다", async (ctx) => {
    if (!available) return ctx.skip()
    const bad = await fetch(`${BASE_URL}/api/dashboard-auth`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: SLUG, password: "wrong" }),
    })
    expect(bad.status).toBe(401)

    const ok = await fetch(`${BASE_URL}/api/dashboard-auth`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: SLUG, password: PASSWORD }),
    })
    expect(ok.status).toBe(200)
    expect(cookieHeader(ok)).toContain("vs_dash_")
  }, 30000)

  it("비밀번호 변경은 쿠키와 현재 비밀번호를 모두 요구한다", async (ctx) => {
    if (!available) return ctx.skip()
    const login = await fetch(`${BASE_URL}/api/dashboard-auth`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: SLUG, password: PASSWORD }),
    })
    const cookie = cookieHeader(login)
    const change = (cur: string, next: string, ck = cookie) =>
      fetch(`${BASE_URL}/api/dashboard-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: ck },
        body: JSON.stringify({ invitationId, currentPassword: cur, newPassword: next }),
      })

    expect((await change(PASSWORD, "newpass123", "")).status).toBe(403) // 쿠키 없음
    expect((await change("0000", "newpass123")).status).toBe(401)       // 현재 비번 틀림
    expect((await change(PASSWORD, "12345")).status).toBe(400)          // 6자 미만
    expect((await change(PASSWORD, "newpass123")).status).toBe(200)     // 정상

    // 바뀐 비밀번호가 실제로 반영됐는가
    const withOld = await fetch(`${BASE_URL}/api/dashboard-auth`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: SLUG, password: PASSWORD }),
    })
    expect(withOld.status).toBe(401)
  }, 60000)
})
