import { supabase } from "@/lib/supabase"
import InvitationClient from "../../invitation/[id]/invitation-client"
import TemplateInvitationClient from "./template-invitation-client"
import { buildThemeTokens, type ThemeRow } from "@/lib/theme-template"
import { normalizeLegacyKeys, type RawInvitationData } from "@/lib/invitation-data"
import type { TokenMap } from "@/components/invitation/invitation-frame"
import { Metadata, Viewport } from "next"

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ slug: string }>
}

/** 청첩장 + 고객 + (테마체인) 조회 */
async function loadInvitation(slug: string) {
  const { data: invitation } = await supabase
    .from('invitations')
    .select('*')
    .eq('public_slug', slug)
    .maybeSingle()

  if (!invitation) return { invitation: null, customer: null, themeRow: null }

  // 고객 정보 (customers 컬럼은 필드키와 동일한 snake_case)
  const { data: customer } = invitation.customer_id
    ? await supabase.from('customers').select('*').eq('id', invitation.customer_id).maybeSingle()
    : { data: null }

  // 테마 체인: invitations.theme_version_id → theme_versions.theme_id → themes
  let themeRow: ThemeRow | null = null
  if (invitation.theme_version_id) {
    const { data: version } = await supabase
      .from('theme_versions')
      .select('theme_id')
      .eq('id', invitation.theme_version_id)
      .maybeSingle()
    if (version?.theme_id) {
      const { data: theme } = await supabase
        .from('themes')
        .select('*')
        .eq('id', version.theme_id)
        .maybeSingle()
      themeRow = (theme as ThemeRow) ?? null
    }
  }

  return { invitation, customer, themeRow }
}

/** 고객 정보 + content_data(필드키) 를 병합해 렌더러용 원본 데이터를 만든다 */
function buildRawData(invitation: Record<string, unknown>, customer: Record<string, unknown> | null): RawInvitationData {
  const fromCustomer: RawInvitationData = {}
  if (customer) {
    for (const key of ['groom_name', 'bride_name', 'wedding_date', 'wedding_time', 'venue_name', 'venue_address'] as const) {
      const v = customer[key]
      if (v != null && v !== '') fromCustomer[key] = v
    }
  }
  const contentData = (invitation.content_data && typeof invitation.content_data === 'object')
    ? invitation.content_data as RawInvitationData
    : {}

  // content_data 를 먼저 정규화해야 레거시 camelCase 값도 고객 기본값보다 우선한다
  const normalizedContent = normalizeLegacyKeys(contentData)
  const raw: RawInvitationData = { ...fromCustomer, ...normalizedContent }
  if (invitation.bgm_url) raw.bgm_url = invitation.bgm_url
  return raw
}

/**
 * 최종 토큰 = 테마 기본 토큰(themes.styles) + 청첩장 개별 오버라이드
 * (청첩장 오버라이드가 우선)
 */
function buildTokens(invitation: Record<string, unknown>, themeRow: ThemeRow | null): TokenMap {
  const tokens: TokenMap = { ...buildThemeTokens(themeRow) }

  const overrides = invitation.customization_overrides
  if (overrides && typeof overrides === 'object') {
    for (const [k, v] of Object.entries(overrides as Record<string, unknown>)) {
      if (k.startsWith('--') && typeof v === 'string' && v) tokens[k] = v
    }
  }
  return tokens
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params

  try {
    const { invitation, customer } = await loadInvitation(slug)
    if (invitation) {
      const raw = buildRawData(invitation, customer)
      const og = (invitation.og_meta && typeof invitation.og_meta === 'object')
        ? invitation.og_meta as Record<string, string>
        : {}

      const groom = String(raw.groom_name ?? '신랑')
      const bride = String(raw.bride_name ?? '신부')
      const title = og.title || `${groom} ♥ ${bride} 결혼합니다`
      const description = og.description || [raw.wedding_date, raw.venue_name].filter(Boolean).join(' · ')
      const image = og.image || (typeof raw.main_image === 'string' ? raw.main_image : '')

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          images: image ? [{ url: image }] : [],
          type: 'website',
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: image ? [image] : [],
        },
      }
    }
  } catch (err) {
    console.error('Error generating metadata in public slug page:', err)
  }

  return {
    title: 'VOW SEOUL | 모바일 청첩장',
    description: '소중한 서약을 담아드립니다.',
  }
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params

  let invitation: Record<string, unknown> | null = null
  let customer: Record<string, unknown> | null = null
  let themeRow: ThemeRow | null = null

  try {
    const loaded = await loadInvitation(slug)
    invitation = loaded.invitation
    customer = loaded.customer
    themeRow = loaded.themeRow
  } catch (err) {
    console.error('Error fetching initial data on public slug page:', err)
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans p-4">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-slate-800">찾을 수 없는 청첩장</h2>
          <p className="text-sm text-slate-500">
            링크 주소가 잘못되었거나 만료되었을 수 있습니다.
          </p>
        </div>
      </div>
    )
  }

  // ── 새 템플릿 엔진 (B + iframe) ───────────────────────────────
  if (themeRow?.render_engine === 'template' && themeRow.template_html) {
    return (
      <TemplateInvitationClient
        themeRow={themeRow}
        raw={buildRawData(invitation, customer)}
        invitationId={String(invitation.id)}
        tokens={buildTokens(invitation, themeRow)}
      />
    )
  }

  // ── 기존 레거시 렌더러 (기본값) ────────────────────────────────
  let initialThemes: unknown[] = []
  let initialFonts: unknown[] = []
  try {
    const [themesResult, fontsResult] = await Promise.all([
      supabase.from('themes').select('*'),
      supabase.from('settings').select('*').eq('key', 'fonts'),
    ])
    initialThemes = themesResult.data || []
    if (fontsResult.data && fontsResult.data.length > 0) {
      initialFonts = fontsResult.data[0].value || []
    }
  } catch (err) {
    console.error('Error fetching legacy renderer data:', err)
  }

  return (
    <InvitationClient
      id={String(invitation.id)}
      initialInvitation={invitation}
      initialThemes={initialThemes}
      initialFonts={initialFonts}
    />
  )
}
