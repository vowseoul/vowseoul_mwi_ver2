import { sendTelegram } from "./telegram"

/**
 * 크론 실패 알림 — 만료 청첩장 파기·방문통계 집계 크론이 실패해도 지금까지는
 * 서버 로그에만 남고 아무도 통보받지 못했다. 특히 파기 크론이 조용히 실패하면
 * 개인정보 보유기간 정책이 실제로는 지켜지지 않는 상태가 된다.
 *
 * 실제 전송은 §lib/telegram.ts 가 담당한다(고객 제출 알림과 같은 봇/채팅 공유).
 */
export async function notifyCronFailure(jobName: string, detail: string): Promise<void> {
  console.error(`[cron:${jobName}] ${detail}`)
  await sendTelegram(`⚠️ VOW SEOUL 크론 실패: ${jobName}\n${detail}`)
}
