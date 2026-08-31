import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"

/**
 * 웹 푸시 구독 등록·해제.
 *
 * push_subscriptions 는 RLS 로 전면 차단돼 있어(§20260828000000) 브라우저가 직접
 * 만질 수 없다. 여기서 로그인한 본인 확인을 거쳐 service_role 로 대신 쓴다 —
 * 폼 표들을 서버 경유로 옮긴 것과 같은 방침이다.
 *
 * 구독은 기기 단위다. 같은 사람이 노트북과 폰에서 각각 켜면 두 행이 생기고,
 * 알림은 양쪽 모두로 간다. endpoint 가 UNIQUE 라 같은 기기에서 다시 켜도 늘지 않는다.
 */

async function currentUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function POST(request: Request) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

  let body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint : ""
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : ""
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : ""
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "구독 정보가 올바르지 않습니다." }, { status: 400 })
  }

  // 같은 기기를 다른 계정으로 켰을 수 있으니 user_id 까지 덮어쓴다
  const { error } = await createSupabaseAdminClient()
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
      { onConflict: "endpoint" },
    )

  if (error) {
    console.error("push-subscribe failed:", error.message)
    return NextResponse.json({ error: "알림을 켜지 못했습니다." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

  let endpoint = ""
  try {
    endpoint = (await request.json()).endpoint ?? ""
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }
  if (!endpoint) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })

  // 본인 것만 지운다 — endpoint 를 알아도 남의 구독을 끌 수는 없어야 한다
  await createSupabaseAdminClient()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", userId)

  return NextResponse.json({ ok: true })
}
