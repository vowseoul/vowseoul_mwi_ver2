import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import {
  hashDashboardPassword,
  resolveDefaultDashboardPassword,
  verifyDashboardPassword,
} from "@/lib/dashboard-password"
import { logAuditEvent } from "@/lib/audit-log"

/**
 * 관리자 전용: 신랑신부 대시보드 비밀번호 상태 조회(GET) / 기본값 초기화(POST).
 *
 * 비밀번호는 해시로만 저장돼 관리자도 값을 볼 수 없다. 그런데 고객이 직접 바꿀 수
 * 있게 되면서(§app/api/dashboard-password) "지금 기본값인지 고객이 바꾼 값인지"를
 * 담당자가 알아야 안내를 할 수 있다 — 별도 플래그 컬럼을 두는 대신, 저장된 해시가
 * "현재 연락처 기준 기본값"과 일치하는지 검증해서 판정한다. 컬럼 추가(마이그레이션)가
 * 필요 없고, 고객이 기본값으로 되돌려놓은 경우까지 정확히 잡아낸다.
 *
 * 응답에 실제 비밀번호를 담지는 않지만, 초기화가 어떤 연락처의 뒷 4자리를 쓰는지는
 * 반드시 알려준다 — 신랑/신부 번호가 다르고 등록 시 오타도 나므로, 담당자가 "뒷
 * 4자리요"라고만 말하면 고객이 어느 번호인지 몰라 못 들어가는 일이 실제로 생긴다.
 */

async function assertAdmin(): Promise<boolean> {
  const sessionSupabase = await createSupabaseServerClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return false
  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle()
  return profile?.role === "ADMIN"
}

/** 청첩장 + 연결된 고객 연락처 */
async function loadTarget(invitationId: string) {
  const admin = createSupabaseAdminClient()
  const { data: invitation } = await admin
    .from("invitations")
    .select("id, dashboard_password, customer_id")
    .eq("id", invitationId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!invitation) return null

  const { data: customer } = invitation.customer_id
    ? await admin.from("customers").select("phone").eq("id", invitation.customer_id).maybeSingle()
    : { data: null }

  return { admin, invitation, phone: (customer?.phone as string | null) ?? null }
}

export async function GET(request: Request) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
  }

  const invitationId = new URL(request.url).searchParams.get("invitationId")
  if (!invitationId) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })

  const target = await loadTarget(invitationId)
  if (!target) return NextResponse.json({ error: "청첩장을 찾을 수 없습니다." }, { status: 404 })

  const fallback = resolveDefaultDashboardPassword(target.phone)
  const stored = String(target.invitation.dashboard_password ?? "")
  const isDefault = stored ? await verifyDashboardPassword(fallback.password, stored) : false

  return NextResponse.json({
    isDefault,
    // 초기화 시 어떤 값이 되는지 — 담당자가 고객에게 그대로 읽어줄 수 있어야 한다
    resetTo: fallback.password,
    phone: fallback.phone,
    phoneMissing: fallback.source === "fallback",
  })
}

export async function POST(request: Request) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
  }

  let invitationId: unknown
  try {
    invitationId = (await request.json())?.invitationId
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }
  if (typeof invitationId !== "string" || !invitationId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const target = await loadTarget(invitationId)
  if (!target) return NextResponse.json({ error: "청첩장을 찾을 수 없습니다." }, { status: 404 })

  const fallback = resolveDefaultDashboardPassword(target.phone)
  const { error } = await target.admin
    .from("invitations")
    .update({ dashboard_password: await hashDashboardPassword(fallback.password) })
    .eq("id", invitationId)

  if (error) {
    console.error("dashboard-password reset failed:", error.message)
    return NextResponse.json({ error: "초기화하지 못했습니다." }, { status: 500 })
  }

  const sessionSupabase = await createSupabaseServerClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  await logAuditEvent(target.admin, {
    invitationId,
    actorType: "admin",
    actorLabel: user?.email ?? null,
    action: "dashboard_password.reset",
    summary: fallback.source === "phone"
      ? `대시보드 비밀번호를 기본값(${fallback.phone} 뒷 4자리)으로 초기화했습니다.`
      : `대시보드 비밀번호를 기본값(${fallback.password})으로 초기화했습니다. 등록된 연락처가 없어 고정값을 사용했습니다.`,
  })

  return NextResponse.json({
    ok: true,
    resetTo: fallback.password,
    phone: fallback.phone,
    phoneMissing: fallback.source === "fallback",
  })
}
