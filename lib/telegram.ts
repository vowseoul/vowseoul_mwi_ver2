/**
 * 공용 채팅으로 보낸다 — 크론 실패 경보(§lib/cron-alert.ts)와, 담당자 중 아무도
 * 받을 곳이 없을 때의 최후 수단(§lib/notify-staff.ts)이 쓴다.
 *
 * 고객 제출 알림은 이제 담당자별로 갈린다(§lib/notify-staff.ts).
 *
 * TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID 가 설정되지 않았으면 조용히 넘어간다 —
 * 알림이 설정되지 않았다는 이유로 본래 작업(크론 실행, 고객의 폼 제출)이 실패하면 안 된다.
 * 전송 실패도 마찬가지로 삼키고 로그만 남긴다(호출부는 await 해도 절대 throw 되지 않는다).
 */
export async function sendTelegram(text: string, kind?: TelegramKind): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) return

  // 관리자가 끈 종류는 여기서 걸러낸다 — 호출부 네 곳이 각자 판단하면 한 곳을 빠뜨리는
  // 순간 "껐는데 계속 온다"가 된다. kind 를 넘기지 않은 호출(크론 실패)은 항상 보낸다.
  if (kind && !(await telegramKindEnabled(kind))) return

  await sendTelegramTo(chatId, text)
}

/** 보냈는지와, 못 보냈다면 사람이 읽을 수 있는 이유 */
export interface TelegramSendResult {
  sent: boolean
  reason?: string
}

/**
 * 지정한 채팅으로 그냥 보낸다 — 종류별 on/off 를 보지 않는다.
 *
 * 담당자별 발송(§lib/notify-staff.ts)이 쓴다. 거기서는 받는 사람이 여럿이라
 * 사람마다 설정을 다시 읽으면 같은 질문을 N 번 하게 되므로, 한 번만 확인하고
 * 이 함수로 뿌린다.
 */
export async function sendTelegramTo(chatId: string, text: string): Promise<TelegramSendResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return { sent: false, reason: "서버에 TELEGRAM_BOT_TOKEN 이 설정되지 않았습니다." }
  if (!chatId) return { sent: false, reason: "채팅 ID가 비어 있습니다." }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // disable_web_page_preview: 링크 미리보기 카드가 붙으면 알림이 길어져 목록에서 읽기 나쁘다
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    })
    if (res.ok) return { sent: true }

    // 텔레그램은 실패 사유를 본문에 담아준다. 가장 흔한 두 가지가
    // "chat not found"(채팅 ID 오타)와 "bot can't initiate conversation"(봇과 대화를
    // 시작하지 않음)인데, 로그로만 삼키면 둘 다 "그냥 안 온다"로만 보인다.
    const body = await res.text().catch(() => "")
    console.error("[telegram] 전송 실패:", res.status, body)
    return { sent: false, reason: `텔레그램이 거부했습니다 (${res.status}) — ${body.slice(0, 200)}` }
  } catch (err) {
    console.error("[telegram] 전송 중 오류:", err)
    return { sent: false, reason: `텔레그램에 연결하지 못했습니다 — ${err instanceof Error ? err.message : String(err)}` }
  }
}

/** 신랑·신부 이름으로 알림에 쓸 표시명을 만든다. 둘 다 비어 있으면 "고객". */
export function coupleLabel(groomName?: string | null, brideName?: string | null): string {
  return [groomName, brideName].filter(Boolean).join(" ♥ ") || "고객"
}


/**
 * 알림 종류별 on/off — 관리자 설정 > 알림에서 켜고 끈다(settings.key='telegram_notifications').
 *
 * 크론 실패 알림은 일부러 이 목록에 없다. 그건 시스템이 죽었다는 경보라 업무 알림과
 * 성격이 다르고, 끌 수 있게 만들면 조용해진 게 "설정" 때문인지 "정말 아무 일도 없어서"인지
 * 구분할 수 없게 된다 — 자기 경보기를 끄는 스위치는 만들지 않는다.
 *
 * 기본값은 전부 켜짐이다. 이 설정이 생기기 전부터 세 알림은 이미 발송되고 있었으므로,
 * 설정 행이 없다는 이유로 조용해지면 관리자는 알림이 사라진 걸 알 방법이 없다.
 */
export const TELEGRAM_SETTINGS_KEY = "telegram_notifications"

export type TelegramKind = "form_submit" | "review_revision" | "review_approved"

export interface TelegramNotificationSettings {
  form_submit: boolean
  review_revision: boolean
  review_approved: boolean
}

export const TELEGRAM_KIND_LABELS: { kind: TelegramKind; label: string; description: string }[] = [
  { kind: "form_submit", label: "고객 폼 제출", description: "신랑신부가 고객 폼을 완료하면 알립니다" },
  { kind: "review_revision", label: "검수 수정 요청", description: "신랑신부가 시안에 수정 요청을 남기면 알립니다" },
  { kind: "review_approved", label: "검수 확정", description: "신랑신부가 시안을 확정하면 알립니다" },
]

export function parseTelegramSettings(value: unknown): TelegramNotificationSettings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const on = (k: TelegramKind) => v[k] !== false
  return { form_submit: on("form_submit"), review_revision: on("review_revision"), review_approved: on("review_approved") }
}

export async function telegramKindEnabled(kind: TelegramKind): Promise<boolean> {
  try {
    const { createSupabaseAdminClient } = await import("./supabase-admin")
    const { data } = await createSupabaseAdminClient()
      .from("settings").select("value").eq("key", TELEGRAM_SETTINGS_KEY).maybeSingle()
    return parseTelegramSettings(data?.value)[kind]
  } catch (err) {
    // 설정을 못 읽었다고 알림을 삼키면 안 된다 — 못 읽었으면 보내는 쪽이 안전하다
    console.error("[telegram] 알림 설정 조회 실패, 발송은 계속합니다:", err)
    return true
  }
}
