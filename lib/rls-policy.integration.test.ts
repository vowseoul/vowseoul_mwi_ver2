import { describe, it, expect, beforeAll } from "vitest"
import { adminClient, anonClient, exposedTables, supabaseAvailable } from "./integration-env"

/**
 * "익명 키만 들고 있는 사람에게 무엇이 보이는가"를 표마다 한 줄로 고정한다.
 *
 * 이 파일이 생긴 이유: 20260814000000 이 access_password 를 가리려고
 * `REVOKE SELECT (access_password)` 를 썼는데, 테이블 단위 SELECT 권한이 살아
 * 있으면 컬럼 단위 REVOKE 는 아무 효과가 없다. 마이그레이션은 에러 없이 성공했고,
 * 주석에는 "관리자도 원문을 볼 수 없다"고 적혀 있었고, 코드를 읽으면 막힌 것처럼
 * 보였다 — 실제로 요청을 보내야만 평문이 그대로 나온다는 게 드러났다.
 *
 * 정책을 쓰는 것과 정책이 먹는 것은 다른 일이다. 여기서 검사하는 건 후자뿐이다.
 *
 * 왜 행 수로 판정하는가: RLS 는 권한 오류를 내지 않고 조용히 행을 걸러낸다.
 * 그래서 "막혔다"는 걸 증명하려면 service_role 로는 보이는 행이 익명에게는
 * 안 보인다는 대조가 필요하다 — 표가 비어 있으면 그 대조가 불가능하므로
 * 통과시키지 않고 건너뛴다(조용히 통과하는 검사가 이 파일이 막으려는 바로 그것이다).
 */

type AnonAccess = "blocked" | "open"

/**
 * 표별로 익명에게 열려 있어야 하는가.
 *
 * "open" 은 전부 하객·고객이 로그인 없이 읽어야 하는 것들이다. 그 외에는 전부
 * "blocked" 이고, 새 표가 생기면 아래 목록에 없으므로 테스트가 실패한다 —
 * 새 표가 의도 선언 없이 배포되는 것을 막는 게 이 목록의 절반쯤 되는 목적이다.
 */
const EXPECTED_ANON_SELECT: Record<string, AnonAccess> = {
  // --- 하객·고객이 로그인 없이 읽어야 하는 것 ---
  bgms: "open",                    // 청첩장 배경음악 목록
  themes: "open",                  // 공개 템플릿 갤러리
  settings: "open",                // 일부 키만(아래 별도 검사)

  // --- 나머지 전부 ---
  account_info: "blocked",
  archived_invitations: "blocked",
  audit_logs: "blocked",
  block_library: "blocked",
  block_variants: "blocked",
  customers: "blocked",
  faqs: "blocked",
  field_library: "blocked",
  // 공개 폼(/form/[slug])이 읽고 쓰지만 전부 서버 라우트를 거친다 — 브라우저는
  // anon 키로 이 두 표를 건드리지 않는다(§app/api/form-instance, form-answers).
  form_instances: "blocked",
  form_submissions: "blocked",
  form_template_fields: "blocked",
  form_template_versions: "blocked",
  form_templates: "blocked",
  guestbook_entries: "blocked",    // 쓰기만 열려 있다(§lib/invitation-access.integration.test.ts)
  inquiries: "blocked",
  invitation_blocks: "blocked",
  invitation_revisions: "blocked",
  invitations: "blocked",
  notices: "blocked",
  notifications: "blocked",
  orders: "blocked",
  profiles: "blocked",
  // 직원 알림 구독. 등록·해제·조회 전부 서버 라우트를 거친다(§app/api/push-subscribe) —
  // endpoint 가 새어 나가면 남의 기기로 알림을 밀어 넣을 여지가 생긴다.
  push_subscriptions: "blocked",
  // 인쇄된 QR 이 어디로 가는지. 발급·연결변경은 관리자 라우트, 조회는 /q/[code] 가 한다 —
  // 브라우저가 쓸 수 있으면 남의 인쇄물을 아무 데로나 돌려버릴 수 있다.
  qr_links: "blocked",
  rate_limit_attempts: "blocked",
  rsvp_responses: "blocked",
  rsvp_responses_history: "blocked",
  theme_versions: "blocked",
  visit_daily_stats: "blocked",
  visit_logs: "blocked",
}

/** 익명에게 열려 있어야 하는 settings 키 — 공개 페이지(약관·개인정보·청첩장)가 읽는다 */
const PUBLIC_SETTINGS_KEYS = ["data_retention", "fonts", "is_feature_open"]

let available = false
beforeAll(() => { available = supabaseAvailable() })

async function counts(table: string) {
  const [anon, admin] = await Promise.all([
    anonClient().from(table).select("*", { count: "exact", head: true }),
    adminClient().from(table).select("*", { count: "exact", head: true }),
  ])
  // head:true 요청은 응답 본문이 없어 supabase-js 가 error.code 를 채우지 못한다
  // (권한 거부여도 { message: "" } 만 온다). 그래서 HTTP 상태로 판정한다.
  return { anon: anon.count ?? 0, admin: admin.count ?? 0, anonStatus: anon.status }
}

describe("표별 익명 접근 범위", () => {
  it("노출 중인 표는 전부 의도가 선언돼 있다", async (ctx) => {
    if (!available) return ctx.skip()
    // 새 표를 만들면 기본값이 "열림"인지 "닫힘"인지 아무도 확인하지 않은 채 배포된다.
    // 여기서 걸리면 위 목록에 한 줄 적으라는 뜻이다.
    const undeclared = (await exposedTables()).filter((t) => !(t in EXPECTED_ANON_SELECT))
    expect(undeclared, `의도가 선언되지 않은 표: ${undeclared.join(", ")}`).toEqual([])
  }, 30000)

  for (const [table, expected] of Object.entries(EXPECTED_ANON_SELECT)) {
    it(`${table} — 익명에게 ${expected === "open" ? "열려 있다" : "닫혀 있다"}`, async (ctx) => {
      if (!available) return ctx.skip()
      const { anon, admin, anonStatus } = await counts(table)

      if (admin === 0) {
        // 행이 없으면 "막혀서 0" 과 "원래 0" 을 구분할 수 없다. 통과시키면 거짓 안심이 된다.
        return ctx.skip(`${table}: 표가 비어 있어 판별 불가 — 데이터가 생기면 자동으로 검사된다`)
      }

      if (expected === "blocked") {
        // 막히는 방식이 둘이다: 권한 자체가 없으면 401 로 거부되고, 권한은 있는데
        // RLS 가 거르면 200 에 0행이 온다. 둘 다 "익명은 못 읽는다"이다. 그 외의
        // 상태(404 처럼 표가 사라진 경우)로 0행이 나오면 검사가 무의미하므로 가른다.
        if (anonStatus === 401 || anonStatus === 403) {
          expect(anonStatus, `${table}: 권한으로 차단됨`).toBeGreaterThanOrEqual(401)
        } else {
          expect(anonStatus, `${table}: 예상치 못한 응답 상태`).toBeLessThan(300)
          expect(anon, `${table}: service_role 은 ${admin}행을 보는데 익명도 ${anon}행을 본다`).toBe(0)
        }
      } else {
        expect(anonStatus, `${table}: 공개돼야 하는데 ${anonStatus} 로 거부됐다`).toBeLessThan(300)
        expect(anon, `${table}: 공개돼야 하는데 익명이 한 행도 못 본다`).toBeGreaterThan(0)
      }
    }, 30000)
  }
})

describe("form_instances.access_password 컬럼 차단", () => {
  // 행 수가 아니라 권한 오류로 판정한다 — 컬럼 권한은 RLS 와 달리 실제로 거부하므로
  // 표가 비어 있어도 증명된다.
  const anonSelect = (select: string) => anonClient().from("form_instances").select(select).limit(1)

  it("컬럼을 직접 지정해 읽을 수 없다", async (ctx) => {
    if (!available) return ctx.skip()
    const { error } = await anonSelect("access_password")
    expect(error?.code).toBe("42501") // insufficient_privilege
  }, 30000)

  it("select('*') 로도 새어 나가지 않는다", async (ctx) => {
    if (!available) return ctx.skip()
    // 앱이 명시 컬럼 목록을 쓰는 이유가 이것이다. '*' 는 전 컬럼 권한을 요구한다.
    const { error } = await anonSelect("*")
    expect(error).not.toBeNull()
  }, 30000)

  it("값으로 필터링해 한 글자씩 맞춰볼 수 없다", async (ctx) => {
    if (!available) return ctx.skip()
    // 읽기만 막고 필터를 열어두면 ?access_password=eq.0000 으로 값을 알아낼 수 있다.
    const { error } = await anonClient()
      .from("form_instances").select("id").eq("access_password", "0000")
    expect(error).not.toBeNull()
  }, 30000)

  it("공개 폼이 읽던 컬럼도 이제 익명에게는 닫혀 있다", async (ctx) => {
    if (!available) return ctx.skip()
    // 공개 폼은 이 값들을 /api/form-instance 를 통해 받는다 — 브라우저가 DB 를
    // 직접 읽지 않으므로, 익명에게 열어둘 이유가 남아 있지 않다.
    const { error } = await anonSelect("id, unique_url_slug, status, has_password")
    expect(error?.code).toBe("42501")
  }, 30000)

  it("has_password 가 실제 비밀번호 설정 여부와 일치한다", async (ctx) => {
    if (!available) return ctx.skip()
    // 생성 컬럼이라 어긋날 일이 없어야 하지만, 어긋나면 비밀번호 걸린 폼이
    // 잠금해제된 채 열린다 — 조용히 깨지는 쪽이라 고정해둔다.
    const { data } = await adminClient().from("form_instances").select("access_password, has_password")
    const mismatched = (data ?? []).filter(
      (r: { access_password: string | null; has_password: boolean }) =>
        r.has_password !== (r.access_password != null && r.access_password !== "")
    )
    expect(mismatched).toHaveLength(0)
  }, 30000)
})

describe("공개 폼 표는 익명이 쓸 수도 없다", () => {
  // 읽기만 막고 쓰기를 남기려던 게 원래 계획이었는데, PostgREST 는 쓰기에도 읽기
  // 권한을 요구해서(upsert 는 충돌 검사에, update 는 WHERE 절에) 분할이 성립하지
  // 않았다. 결국 둘 다 서버 라우트로 옮겼으므로 쓰기 차단도 함께 고정한다.
  it("form_submissions 에 직접 쓸 수 없다", async (ctx) => {
    if (!available) return ctx.skip()
    const { error } = await anonClient().from("form_submissions").insert({
      form_instance_id: "00000000-0000-0000-0000-000000000000",
      customer_id: "00000000-0000-0000-0000-000000000000",
      data: {},
    })
    // 권한 거부여야 한다. 외래키 위반(23503)이 나면 INSERT 자체는 허용됐다는 뜻이다.
    expect(error?.code).toBe("42501")
  }, 30000)

  it("form_instances 의 status 를 직접 바꿀 수 없다", async (ctx) => {
    if (!available) return ctx.skip()
    const { error } = await anonClient()
      .from("form_instances").update({ status: "completed" })
      .eq("id", "00000000-0000-0000-0000-000000000000")
    expect(error?.code).toBe("42501")
  }, 30000)
})

describe("settings 키 단위 노출", () => {
  it("공개 페이지가 읽는 키만 익명에게 보인다", async (ctx) => {
    if (!available) return ctx.skip()
    const { data } = await anonClient().from("settings").select("key")
    const visible = (data ?? []).map((r: { key: string }) => r.key).sort()
    expect(visible).toEqual([...PUBLIC_SETTINGS_KEYS].sort())
  }, 30000)
})
