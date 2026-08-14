import * as Sentry from "@sentry/nextjs"

/**
 * 브라우저(클라이언트) 측 Sentry 초기화. NEXT_PUBLIC_SENTRY_DSN이 비어 있으면
 * Sentry SDK가 조용히 아무 것도 전송하지 않는다 — DSN 발급 전에도 배포가
 * 깨지지 않는다. 에러+트레이싱만 켠다(세션 리플레이/로깅/프로파일링은 하객·고객
 * PII가 그대로 오가는 화면이 많아 별도로 켤지 판단이 필요한 확장 시그널이라
 * 지금은 넣지 않는다).
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === "production",
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
