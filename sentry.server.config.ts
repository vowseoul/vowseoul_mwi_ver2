import * as Sentry from "@sentry/nextjs"

/**
 * 서버(Node 런타임) 측 Sentry 초기화 — §instrumentation-client.ts와 동일한 DSN 규칙.
 * includeLocalVariables는 일부러 켜지 않는다 — 이 앱의 서버 함수 로컬 변수엔 하객
 * 전화번호·주소 같은 실PII가 그대로 들어있는 경우가 많아, 스택프레임에 값을 그대로
 * 붙이면 그 PII가 Sentry(제3자, 해외 리전)로 함께 전송된다.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === "production",
})
