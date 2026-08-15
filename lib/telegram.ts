/**
 * 텔레그램 봇 알림 공용 전송기.
 *
 * 크론 실패(§lib/cron-alert.ts)와 고객 제출 알림(폼 제출 §app/api/form-submit,
 * 시안 검수 §app/api/review-submit)이 같은 봇/채팅을 쓴다. 추가 SDK 없이 Bot API 만 호출한다.
 *
 * TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID 가 설정되지 않았으면 조용히 넘어간다 —
 * 알림이 설정되지 않았다는 이유로 본래 작업(크론 실행, 고객의 폼 제출)이 실패하면 안 된다.
 * 전송 실패도 마찬가지로 삼키고 로그만 남긴다(호출부는 await 해도 절대 throw 되지 않는다).
 */
export async function sendTelegram(text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) return

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // disable_web_page_preview: 링크 미리보기 카드가 붙으면 알림이 길어져 목록에서 읽기 나쁘다
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    })
    if (!res.ok) {
      console.error("[telegram] 전송 실패:", res.status, await res.text().catch(() => ""))
    }
  } catch (err) {
    console.error("[telegram] 전송 중 오류:", err)
  }
}

/** 신랑·신부 이름으로 알림에 쓸 표시명을 만든다. 둘 다 비어 있으면 "고객". */
export function coupleLabel(groomName?: string | null, brideName?: string | null): string {
  return [groomName, brideName].filter(Boolean).join(" ♥ ") || "고객"
}
