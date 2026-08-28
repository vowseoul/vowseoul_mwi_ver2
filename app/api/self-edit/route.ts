import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { dashboardCookieName, verifyDashboardToken } from "@/lib/dashboard-session"
import { SELF_EDIT_SETTINGS_KEY, SELF_EDIT_FIELD_KEYS, parseSelfEditSettings } from "@/lib/self-edit"
import { isValidScrollMotion } from "@/lib/scroll-motion"
import { logAuditEvent } from "@/lib/audit-log"

/**
 * 셀프 편집 저장. 신랑신부는 Supabase 계정이 없는 익명 사용자라 대시보드/검수와
 * 동일하게 서명 쿠키로 권한을 판정하고(§lib/dashboard-session.ts), 실제 쓰기는
 * service_role로 대신한다(§app/api/dashboard-data/route.ts, §app/api/review-submit/route.ts와
 * 동일 패턴).
 *
 * 기능 on/off는 페이지 진입 시점(app/invitation/[id]/edit/page.tsx)에도 검사하지만,
 * 그 검사만 믿지 않고 저장 시점에 여기서도 다시 검사한다 — 페이지를 이미 열어둔 채로
 * 관리자가 기능을 끈 경우까지 막아야 하기 때문이다.
 *
 * 저장 가능한 필드는 SELF_EDIT_FIELD_KEYS 화이트리스트로 고정되어 있다. 디자인 토큰
 * (색상·폰트)·테마(theme_version_id)·블록순서(block_order)는 이 라우트가 아예 건드리지
 * 않으므로 셀프 편집으로 손댈 방법이 없다. customization_overrides 중 유일한 예외는
 * scrollMotion(스크롤 모션) — isValidScrollMotion으로 검증한 값만, 그 키 하나만 병합해
 * 저장한다. 나머지 customization_overrides(색상·블록 오버라이드·섹션이미지 등)는 항상
 * 기존 값 그대로 보존된다.
 */

const SELF_EDIT_FIELD_KEY_SET = new Set<string>(SELF_EDIT_FIELD_KEYS)

export async function POST(request: Request) {
  let body: { invitationId?: string; fields?: Record<string, unknown>; galleryImages?: unknown; scrollMotion?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const { invitationId, fields, galleryImages, scrollMotion } = body
  if (typeof invitationId !== "string" || !invitationId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const jar = await cookies()
  if (!verifyDashboardToken(jar.get(dashboardCookieName(invitationId))?.value, invitationId)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
  }

  const supabase = createSupabaseAdminClient()

  const { data: settingRow } = await supabase
    .from("settings")
    .select("value")
    .eq("key", SELF_EDIT_SETTINGS_KEY)
    .maybeSingle()
  if (!parseSelfEditSettings(settingRow?.value).enabled) {
    return NextResponse.json({ error: "현재 셀프 편집 기능이 비활성화되어 있습니다." }, { status: 403 })
  }

  const { data: invitation, error: invError } = await supabase
    .from("invitations")
    .select("content_data, customization_overrides")
    .eq("id", invitationId)
    .is("deleted_at", null)
    .maybeSingle()
  if (invError || !invitation) {
    return NextResponse.json({ error: "청첩장을 찾을 수 없습니다." }, { status: 404 })
  }

  const existingContentData = (invitation.content_data && typeof invitation.content_data === "object")
    ? (invitation.content_data as Record<string, unknown>)
    : {}
  const existingOverrides = (invitation.customization_overrides && typeof invitation.customization_overrides === "object")
    ? (invitation.customization_overrides as Record<string, unknown>)
    : {}

  // 화이트리스트에 없는 키는 완전히 무시한다 — 클라이언트가 임의의 키(customization_overrides
  // 흉내 등)를 보내도 반영되지 않는다.
  const nextFields: Record<string, string> = {}
  if (fields && typeof fields === "object") {
    for (const [key, value] of Object.entries(fields)) {
      if (!SELF_EDIT_FIELD_KEY_SET.has(key)) continue
      if (typeof value === "string") nextFields[key] = value
    }
  }

  const contentPayload: Record<string, unknown> = { ...existingContentData, ...nextFields }

  if (Array.isArray(galleryImages) && galleryImages.every((v) => typeof v === "string")) {
    contentPayload.gallery_images = galleryImages
  }

  // customization_overrides는 scrollMotion 키 하나만 바꾼다 — 색상·폰트·블록 오버라이드·
  // 섹션이미지 등 나머지는 항상 기존 값 그대로 보존한다(existingOverrides를 스프레드).
  const overridesPayload: Record<string, unknown> = { ...existingOverrides }
  if (isValidScrollMotion(scrollMotion)) {
    overridesPayload.scrollMotion = scrollMotion
  }

  const { error: updateError } = await supabase
    .from("invitations")
    .update({
      content_data: contentPayload,
      customization_overrides: overridesPayload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId)

  if (updateError) {
    console.error("self-edit update failed:", updateError.message)
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 })
  }

  const changedCount = Object.keys(nextFields).length
  const galleryChanged = Array.isArray(galleryImages)
  // 서버리스 함수는 응답을 보낸 뒤 곧바로 얼어붙을 수 있어 await 없이 던지면 로그가
  // 유실될 수 있다 — 응답 지연이 미미하므로(단건 insert) 기다렸다가 응답한다.
  await logAuditEvent(supabase, {
    invitationId,
    actorType: "customer",
    action: "self_edit.saved",
    summary: `신랑신부가 정보를 직접 수정했습니다 (${changedCount}개 항목${galleryChanged ? " + 갤러리 사진" : ""}).`,
  })

  return NextResponse.json({ ok: true })
}
