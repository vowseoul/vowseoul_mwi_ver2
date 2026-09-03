import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { sendTelegramTo } from "@/lib/telegram"
import { sendWebPush } from "@/lib/web-push"

/**
 * 내 알림 설정 — 개인 텔레그램 채팅 ID 읽기·저장.
 *
 * profiles 는 "update by admin" 이라 디자이너가 자기 행도 못 고친다. 그렇다고
 * 정책을 열면 role 을 스스로 올릴 길이 생긴다(그래서 admin 전용으로 잠근 것이다).
 * 여기서 로그인한 본인만, telegram_chat_id 한 칸만 service_role 로 대신 쓴다.
 */

async function me() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function GET() {
  const userId = await me()
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

  const { data } = await createSupabaseAdminClient()
    .from("profiles").select("telegram_chat_id, name, email").eq("id", userId).maybeSingle()

  return NextResponse.json({ telegramChatId: data?.telegram_chat_id ?? "", name: data?.name ?? "", email: data?.email ?? "" })
}

export async function PUT(request: Request) {
  const userId = await me()
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

  let raw: unknown
  try {
    raw = (await request.json()).telegramChatId
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const value = typeof raw === "string" ? raw.trim() : ""
  // 텔레그램 채팅 ID 는 정수(그룹은 음수)다. 형식을 여기서 거르지 않으면 오타가
  // 저장되고, 알림은 조용히 안 온다 — 잘못된 ID 로 보내면 Bot API 가 400 을 주고
  // 우리는 그걸 로그로만 삼킨다.
  if (value && !/^-?\d{5,20}$/.test(value)) {
    return NextResponse.json({ error: "채팅 ID는 숫자만 입력해주세요. (봇과 대화 후 받은 번호)" }, { status: 400 })
  }

  const { error } = await createSupabaseAdminClient()
    .from("profiles").update({ telegram_chat_id: value || null }).eq("id", userId)

  if (error) {
    console.error("my-notifications update failed:", error.message)
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

/**
 * 테스트 발송 — 설정한 경로로 실제로 한 통 보내본다.
 *
 * 이 기능의 실패는 전부 조용하다. 채팅 ID 오타, 봇과 대화를 시작하지 않은 상태,
 * 홈 화면에 추가하지 않은 아이폰, 서버 환경변수 오타 — 어느 쪽이든 화면에는
 * 아무 표시가 없고 알림만 안 온다.
 *
 * 그래서 결과를 경로별로 돌려준다. 예전에는 실패를 통째로 삼키고 "보내지
 * 못했습니다" 한 줄만 띄웠는데, 그러면 무엇을 고쳐야 하는지 알 수가 없어서
 * 확인 버튼을 만든 의미가 없었다.
 */
export async function POST() {
  const userId = await me()
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin
    .from("profiles").select("telegram_chat_id").eq("id", userId).maybeSingle()
  const { data: subs } = await admin
    .from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId)

  const chatId = profile?.telegram_chat_id?.trim()
  const subscriptions = subs ?? []
  if (!chatId && subscriptions.length === 0) {
    return NextResponse.json(
      { error: "설정된 알림 경로가 없습니다. 텔레그램 채팅 ID를 넣거나 이 기기에서 알림을 켜주세요." },
      { status: 400 },
    )
  }

  const [telegram, push] = await Promise.all([
    chatId ? sendTelegramTo(chatId, "🔔 VOW SEOUL 테스트 알림입니다. 이 메시지가 보이면 설정이 끝났습니다.") : null,
    sendWebPush(admin, subscriptions, {
      title: "테스트 알림",
      body: "이 알림이 보이면 설정이 끝났습니다.",
      url: "/admin/notifications",
    }),
  ])

  const problems = [telegram?.reason, push.reason].filter(Boolean) as string[]
  return NextResponse.json({
    ok: problems.length === 0,
    telegram: telegram ? telegram.sent : null,
    push: { sent: push.sent, failed: push.failed },
    problems,
  })
}
