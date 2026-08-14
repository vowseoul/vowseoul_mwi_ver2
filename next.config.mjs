import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
}

// SENTRY_AUTH_TOKEN이 없으면(아직 조직/프로젝트 슬러그를 안 받은 상태) 소스맵 업로드만
// 건너뛰고 빌드는 그대로 진행된다 — org/project/토큰은 DSN을 받을 때 함께 설정.
// tunnelRoute: 광고차단기가 sentry.io로 나가는 요청을 막는 경우가 많아, 우리 도메인의
// /monitoring 경유로 우회한다 — proxy.ts의 matcher가 /admin·/theme-lab만 가로채므로
// 이 경로는 별도 제외 없이도 그냥 통과한다.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  // CI 밖(로컬 빌드)에서는 업로드 로그를 보여준다 — silent: true로 고정해두면
  // 소스맵이 실제로 올라갔는지 로컬에서 확인할 방법이 없어진다.
  silent: !process.env.CI,
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: false,
  },
})
