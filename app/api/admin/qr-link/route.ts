import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { generateQrCode, normalizeQrCode } from "@/lib/qr-link-code"
import { logAuditEvent } from "@/lib/audit-log"

/**
 * QR 리디렉션 코드 발급·연결변경.
 *
 * qr_links 는 RLS 로 전면 차단돼 있어 브라우저가 직접 만질 수 없다. 여기서 직원
 * 확인을 거쳐 service_role 로 대신 쓴다.
 *
 * GET  ?invitationId=... : 이 청첩장에 붙은 코드를 준다. 없으면 그때 하나 만든다.
 * POST { code, invitationId } : 이미 인쇄된 코드를 다른 청첩장으로 옮긴다.
 */

async function requireStaff() {
  const session = await createSupabaseServerClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return null
  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin
    .from("profiles").select("role, email").eq("id", user.id).maybeSingle()
  return profile?.role ? { id: user.id, email: profile.email as string | null } : null
}

export async function GET(request: Request) {
  if (!(await requireStaff())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
  }
  const invitationId = new URL(request.url).searchParams.get("invitationId")

  // invitationId 가 없으면 관리 화면용 전체 목록이다. 인쇄된 QR 이 지금 어디를
  // 가리키는지 한자리에서 보려면 발급 목록이 있어야 한다.
  if (!invitationId) return listAll()

  const admin = createSupabaseAdminClient()
  const { data: existing } = await admin
    .from("qr_links").select("code").eq("invitation_id", invitationId).limit(1).maybeSingle()
  if (existing) return NextResponse.json({ code: existing.code })

  // 코드는 처음 QR 을 열어볼 때 만든다. 청첩장을 만들 때마다 미리 뽑아두면 한 번도
  // 인쇄하지 않을 청첩장 몫까지 쌓인다.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateQrCode()
    const { error } = await admin.from("qr_links").insert({ code, invitation_id: invitationId })
    if (!error) return NextResponse.json({ code })
    if (error.code !== "23505") {
      console.error("qr-link insert failed:", error.message)
      return NextResponse.json({ error: "QR 코드를 발급하지 못했습니다." }, { status: 500 })
    }
    // 23505 = 코드 충돌. 8자 31진이면 사실상 없지만, 났을 때 조용히 실패하면
    // 관리자는 "QR 이 안 나온다"만 보게 된다.
  }
  return NextResponse.json({ error: "QR 코드를 발급하지 못했습니다. 다시 시도해주세요." }, { status: 500 })
}

export async function POST(request: Request) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })

  let body: { code?: unknown; invitationId?: unknown; targetUrl?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const code = normalizeQrCode(typeof body.code === "string" ? body.code : "")
  const invitationId = typeof body.invitationId === "string" ? body.invitationId.trim() : ""
  const rawUrl = typeof body.targetUrl === "string" ? body.targetUrl.trim() : ""
  if (!code) {
    return NextResponse.json({ error: "QR 코드를 지정해주세요." }, { status: 400 })
  }
  if (!invitationId && !rawUrl) {
    return NextResponse.json({ error: "연결할 청첩장이나 주소를 지정해주세요." }, { status: 400 })
  }

  // 이 주소는 우리 도메인을 밟고 나간다. 스킴을 열어두면 우리 주소를 앞세운
  // 피싱 링크를 만들어 주는 셈이라, http(s) 만 받는다.
  if (rawUrl) {
    let parsed: URL
    try {
      parsed = new URL(rawUrl)
    } catch {
      return NextResponse.json({ error: "주소 형식이 올바르지 않습니다. http:// 또는 https:// 로 시작해야 합니다." }, { status: 400 })
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "http:// 또는 https:// 주소만 연결할 수 있습니다." }, { status: 400 })
    }
  }

  const admin = createSupabaseAdminClient()
  const { data: link } = await admin
    .from("qr_links").select("code, invitation_id, target_url").eq("code", code).maybeSingle()
  if (!link) {
    return NextResponse.json(
      { error: "그런 QR 코드가 없습니다. 인쇄물의 주소를 다시 확인해주세요." },
      { status: 404 },
    )
  }

  // 둘 중 하나만 남긴다 — 양쪽에 값이 있으면 "지금 어디로 가는가"를 화면에서
  // 읽어낼 수 없고, 연결을 바꾼 줄 알았는데 안 바뀌는 일이 생긴다.
  const updates = rawUrl
    ? { target_url: rawUrl, invitation_id: null }
    : { target_url: null, invitation_id: invitationId }

  if (link.invitation_id === updates.invitation_id && link.target_url === updates.target_url) {
    return NextResponse.json({ ok: true, code, alreadyLinked: true })
  }

  const { error } = await admin
    .from("qr_links")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("code", code)

  if (error) {
    console.error("qr-link repoint failed:", error.message)
    return NextResponse.json({ error: "연결을 바꾸지 못했습니다." }, { status: 500 })
  }

  // 인쇄물이 어디로 가는지 바뀌는 순간이다 — 누가 언제 옮겼는지 남긴다.
  await logAuditEvent(admin, {
    invitationId: updates.invitation_id,
    actorType: "admin",
    actorLabel: staff.email,
    action: "qr.repointed",
    summary: rawUrl
      ? `QR 코드 ${code} 의 연결을 외부 주소로 옮겼습니다: ${rawUrl}`
      : `QR 코드 ${code} 의 연결을 이 청첩장으로 옮겼습니다.`,
  })

  return NextResponse.json({ ok: true, code })
}

/**
 * 발급된 QR 전체 — 코드마다 지금 어디로 가는지, 그 청첩장이 누구 것이고 언제 만료되는지.
 *
 * 청첩장·고객을 한 번에 끌어와 코드별로 맞춘다. 코드 수만큼 조회를 반복하면
 * 목록이 조금만 길어져도 화면이 눈에 띄게 느려진다.
 */
async function listAll() {
  const admin = createSupabaseAdminClient()
  const { data: links, error } = await admin
    .from("qr_links")
    .select("code, invitation_id, target_url, created_at, updated_at")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("qr-link list failed:", error.message)
    return NextResponse.json({ error: "목록을 불러오지 못했습니다." }, { status: 500 })
  }

  const invitationIds = [...new Set((links ?? []).map((l) => l.invitation_id).filter(Boolean))] as string[]
  const { data: invitations } = invitationIds.length
    ? await admin
        .from("invitations")
        .select("id, public_slug, status, deleted_at, customer_id, customers(groom_name, bride_name, wedding_date)")
        .in("id", invitationIds)
    : { data: [] }

  const byId = new Map((invitations ?? []).map((inv) => [inv.id as string, inv]))

  return NextResponse.json({
    links: (links ?? []).map((l) => {
      const inv = l.invitation_id ? byId.get(l.invitation_id) : null
      const customer = inv ? (Array.isArray(inv.customers) ? inv.customers[0] : inv.customers) : null
      return {
        code: l.code,
        targetUrl: l.target_url,
        createdAt: l.created_at,
        updatedAt: l.updated_at,
        invitation: inv
          ? {
              id: inv.id,
              slug: inv.public_slug,
              status: inv.status,
              deleted: !!inv.deleted_at,
              groomName: customer?.groom_name ?? null,
              brideName: customer?.bride_name ?? null,
              weddingDate: customer?.wedding_date ?? null,
            }
          : null,
      }
    }),
  })
}
