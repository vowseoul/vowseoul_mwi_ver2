import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { dashboardCookieName, verifyDashboardToken } from '@/lib/dashboard-session'
import { mergeInvitationRaw } from '@/lib/invitation-data'
import { buildInvitationTokens, extractBlockOverrides, extractDisabledSlots, extractSectionImages, getHiddenBlocks, type ThemeRow } from '@/lib/theme-template'
import { extractScrollMotion } from '@/lib/scroll-motion'
import { fetchRegisteredFonts, resolveFontFaces } from '@/lib/fonts'
import ReviewClient from './review-client'

export const dynamic = 'force-dynamic'

/**
 * 시안 검수 화면 진입점. 인증은 신랑신부 대시보드와 동일한 서명 쿠키로 검증한다
 * (§app/invitation/[id]/dashboard/page.tsx와 같은 패턴 — 계정이 없는 신랑신부는
 * 이 쿠키가 유일한 권한 증명이다).
 *
 * 렌더링은 /w/[slug](발행 페이지)와 동일한 파이프라인(buildInvitationTokens →
 * resolveFontFaces → InvitationFrame)을 그대로 재사용한다 — "검수 화면에서 본 것과
 * 실제 발행본이 다르다"는 신뢰를 깨는 문제를 원천적으로 막는다. status가 draft여도
 * 상관없이 항상 최신 콘텐츠를 보여준다(발행 여부와 무관하게 검수는 가능해야 한다).
 */
export default async function InvitationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = createSupabaseAdminClient()
  const { data: invitation, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) console.error('review: invitation lookup failed:', error.message)
  if (!invitation) notFound()

  const jar = await cookies()
  if (!verifyDashboardToken(jar.get(dashboardCookieName(id))?.value, id)) {
    redirect(`/review/${invitation.public_slug}`)
  }

  const { data: customer } = invitation.customer_id
    ? await supabase.from('customers').select('*').eq('id', invitation.customer_id).maybeSingle()
    : { data: null }

  let themeRow: ThemeRow | null = null
  if (invitation.theme_version_id) {
    const { data: version } = await supabase
      .from('theme_versions')
      .select('theme_id')
      .eq('id', invitation.theme_version_id)
      .maybeSingle()
    if (version?.theme_id) {
      const { data: theme } = await supabase.from('themes').select('*').eq('id', version.theme_id).maybeSingle()
      themeRow = (theme as ThemeRow) ?? null
    }
  }

  if (!themeRow || themeRow.render_engine !== 'template' || !themeRow.template_html) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center font-sans p-4">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">표시할 수 없는 청첩장</h2>
          <p className="text-sm text-muted-foreground">테마가 아직 지정되지 않았습니다. 관리자에게 문의해주세요.</p>
        </div>
      </div>
    )
  }

  const { data: revisions } = await supabase
    .from('invitation_revisions')
    .select('*')
    .eq('invitation_id', id)
    .order('created_at', { ascending: false })

  const tokens = buildInvitationTokens(themeRow, invitation.customization_overrides)
  const fonts = await fetchRegisteredFonts()
  const disabledSlots = extractDisabledSlots(invitation.customization_overrides)

  return (
    <ReviewClient
      invitationId={id}
      themeRow={themeRow}
      raw={mergeInvitationRaw(invitation, customer)}
      tokens={tokens}
      fontFaces={resolveFontFaces(tokens, fonts)}
      disabledSlots={disabledSlots}
      blockOverrides={extractBlockOverrides(invitation.customization_overrides)}
      hiddenBlocks={getHiddenBlocks(disabledSlots)}
      sectionImages={extractSectionImages(invitation.customization_overrides)}
      scrollMotion={extractScrollMotion(invitation.customization_overrides)}
      reviewStatus={invitation.review_status}
      initialRevisions={(revisions ?? []).map((r) => ({
        id: String(r.id),
        blockKey: r.block_key,
        note: String(r.note ?? ''),
        status: r.status as 'open' | 'resolved',
        createdAt: String(r.created_at ?? ''),
      }))}
    />
  )
}
