/**
 * 크론 실패 알림 — 만료 청첩장 파기·방문통계 집계 크론이 실패해도 지금까지는
 * 서버 로그에만 남고 아무도 통보받지 못했다. 특히 파기 크론이 조용히 실패하면
 * 개인정보 보유기간 정책이 실제로는 지켜지지 않는 상태가 된다.
 *
 * 텔레그램 봇 API만 쓴다(추가 SDK 불필요) — TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID가
 * 아직 설정되지 않았으면 콘솔에만 남기고 조용히 넘어간다(알림 미설정이 크론 자체를
 * 막으면 안 된다).
 */
export async function notifyCronFailure(jobName: string, detail: string): Promise<void> {
  console.error(`[cron:${jobName}] ${detail}`)

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) return

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `⚠️ VOW SEOUL 크론 실패: ${jobName}\n${detail}`,
      }),
    })
  } catch (err) {
    console.error("[cron-alert] 텔레그램 알림 전송 실패:", err)
  }
}
