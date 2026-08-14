import * as Sentry from "@sentry/nextjs"

/** Edge 런타임(proxy.ts 등) 측 Sentry 초기화 — §instrumentation-client.ts와 동일한 DSN 규칙 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === "production",
})
