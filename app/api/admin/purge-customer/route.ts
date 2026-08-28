import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { purgeGuestData, describePurgeCounts } from "@/lib/guest-data-purge"
import { logAuditEvent } from "@/lib/audit-log"

/**
 * 소프트 삭제된 고객을 실제로 지운다 (되돌릴 수 없음).
 *
 * 목록에서 감춘 것과 지운 것은 다르다 — deleted_at 만 찍힌 고객이 계속 쌓이면
 * 조회할 때마다 함께 스캔되고, 개인정보를 "지웠다"고 말할 수도 없다. 관리자가
 * 고객 관리 화면 아래에서 골라 완전히 지운다(§app/admin/(dashboard)/customers).
 *
 * 자식 행을 FK 설정에 맡기지 않고 순서대로 직접 지운다. 표마다 ON DELETE 가
 * CASCADE / SET NULL / 미설정으로 제각각이라(orders 는 SET NULL, invitation_revisions
 * 는 CASCADE, 하객 데이터는 미설정), 그중 하나만 어긋나도 삭제가 통째로 실패하거나
 * 고아 행이 남는다. 명시적으로 지우면 어느 쪽이든 결과가 같다.
 *
 * 안전장치: deleted_at 이 찍힌 고객만 지운다. 실수로 살아 있는 고객 id 를 보내도
 * 아무 일도 일어나지 않는다 — 먼저 목록에서 삭제(소프트)를 거치도록 강제한다.
 */

async function currentStaff() {
  const sessionSupabase = await createSupabaseServerClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) return null
  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin
    .from("profiles").select("role, email").eq("id", user.id).maybeSingle()
  return profile?.role ? { ...profile, id: user.id } : null
}

export async function POST(request: Request) {
  const staff = await currentStaff()
  if (!staff) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
  }

  let body: { customerIds?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const ids = Array.isArray(body.customerIds)
    ? body.customerIds.filter((v): v is string => typeof v === "string" && v.length > 0)
    : []
  if (ids.length === 0) {
    return NextResponse.json({ error: "삭제할 고객을 선택해주세요." }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()

  // 소프트 삭제된 고객만 대상으로 좁힌다
  const { data: targets, error: loadError } = await admin
    .from("customers")
    .select("id, groom_name, bride_name")
    .in("id", ids)
    .not("deleted_at", "is", null)

  if (loadError) {
    console.error("purge-customer: 대상 조회 실패:", loadError.message)
    return NextResponse.json({ error: "대상을 확인하지 못했습니다." }, { status: 500 })
  }
  if (!targets || targets.length === 0) {
    return NextResponse.json(
      { error: "삭제 대기 중인 고객이 아닙니다. 목록에서 먼저 삭제해주세요." },
      { status: 409 },
    )
  }

  const purged: string[] = []
  for (const customer of targets) {
    const { data: invitations } = await admin
      .from("invitations").select("id").eq("customer_id", customer.id)

    for (const inv of invitations ?? []) {
      const counts = await purgeGuestData(admin, inv.id)
      await admin.from("audit_logs").delete().eq("invitation_id", inv.id)
      await admin.from("invitation_revisions").delete().eq("invitation_id", inv.id)
      const { error } = await admin.from("invitations").delete().eq("id", inv.id)
      if (error) {
        console.error(`purge-customer: 청첩장 삭제 실패 (${inv.id}):`, error.message)
        return NextResponse.json({ error: "청첩장을 지우지 못했습니다." }, { status: 500 })
      }
      console.info(`purge-customer: ${inv.id} 하객 데이터 — ${describePurgeCounts(counts) || "없음"}`)
    }

    await admin.from("form_submissions").delete().eq("customer_id", customer.id)
    await admin.from("form_instances").delete().eq("customer_id", customer.id)

    const { error: delError } = await admin.from("customers").delete().eq("id", customer.id)
    if (delError) {
      console.error(`purge-customer: 고객 삭제 실패 (${customer.id}):`, delError.message)
      return NextResponse.json({ error: "고객을 지우지 못했습니다." }, { status: 500 })
    }
    purged.push(`${customer.groom_name ?? ""} & ${customer.bride_name ?? ""}`.trim())
  }

  // 고객 행이 사라지므로 invitationId 로 묶을 수 없다 — 누가 무엇을 지웠는지만 남긴다.
  await logAuditEvent(admin, {
    invitationId: null,
    actorType: "admin",
    actorLabel: staff.email ?? null,
    action: "customer.purged",
    summary: `삭제 대기 고객 ${purged.length}명을 완전히 지웠습니다: ${purged.join(", ")}`,
  })

  return NextResponse.json({ ok: true, purged: purged.length })
}
