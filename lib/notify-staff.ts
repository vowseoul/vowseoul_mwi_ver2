import type { SupabaseClient } from "@supabase/supabase-js"
import { sendTelegram, sendTelegramTo, telegramKindEnabled, type TelegramKind } from "./telegram"
import { sendWebPush, type PushSubscriptionRow } from "./web-push"
import { resolveRecipients } from "./notify-recipients"

/**
 * 고객 관련 알림을 담당자에게 보낸다 — 텔레그램 개인 채팅과 웹 푸시 양쪽으로.
 *
 * 알림 종류가 늘 때마다 두 경로를 각자 챙기면 한쪽을 빠뜨린다. 그래서 호출부는
 * 여기 한 곳만 부른다 — lib/telegram.ts 가 종류별 on/off 를 한곳에 모아둔 것과 같은 이유다.
 *
 * 받을 곳이 하나도 없으면 공용 채팅으로 보낸다. 직원들이 아직 자기 채팅 ID 를
 * 넣지 않은 상태에서 담당자별 발송으로 바꾸면, 그 순간 알림이 통째로 끊긴다 —
 * 조용해진 게 "설정을 안 해서"인지 "일이 없어서"인지 구분할 수 없게 된다.
 */
export async function notifyStaff(
  supabase: SupabaseClient<any, any, any>,
  opts: {
    kind: TelegramKind
    /** 담당자 판정 기준. 없거나 담당자 미지정이면 전 직원에게 간다. */
    customerId?: string | null
    telegramText: string
    push: { title: string; body: string; url: string }
  },
): Promise<void> {
  // 종류별 on/off 는 여기서 한 번만 확인한다 — 받는 사람마다 물으면 같은 질문을 N 번 한다
  if (!(await telegramKindEnabled(opts.kind))) return

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, telegram_chat_id")
    .not("role", "is", null)

  let assignedTo: string | null = null
  if (opts.customerId) {
    const { data: customer } = await supabase
      .from("customers").select("assigned_to").eq("id", opts.customerId).maybeSingle()
    assignedTo = customer?.assigned_to ?? null
  }

  const recipients = resolveRecipients(staff ?? [], assignedTo)
  const ids = recipients.map((r) => r.id)

  const { data: subs } = ids.length
    ? await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .in("user_id", ids)
    : { data: [] as PushSubscriptionRow[] }

  const chatIds = recipients
    .map((r) => (r as { telegram_chat_id?: string | null }).telegram_chat_id)
    .filter((c): c is string => !!c && c.trim().length > 0)

  if (chatIds.length === 0 && (subs ?? []).length === 0) {
    await sendTelegram(opts.telegramText) // 아무도 받을 곳이 없다 — 공용 채팅으로
    return
  }

  await Promise.all([
    ...chatIds.map((chatId) => sendTelegramTo(chatId, opts.telegramText)),
    sendWebPush(supabase, (subs ?? []) as PushSubscriptionRow[], opts.push),
  ])
}

/**
 * 알림 때문에 본래 작업이 실패하지는 않게 감싼 호출.
 *
 * 고객이 폼을 제출하는 라우트가 이걸 부른다. 알림 경로에서 예외가 하나 새면
 * 라우트가 500 이 되고, 고객 화면에는 "제출하지 못했습니다"가 뜬다 — 데이터는
 * 이미 저장됐는데도. 알림을 못 보내는 것과 제출을 못 받는 것은 심각도가 다르다.
 */
export async function notifyStaffQuietly(
  supabase: SupabaseClient<any, any, any>,
  opts: Parameters<typeof notifyStaff>[1],
): Promise<void> {
  try {
    await notifyStaff(supabase, opts)
  } catch (err) {
    console.error("[notify] 알림 발송 실패(본래 작업은 계속):", err)
  }
}
