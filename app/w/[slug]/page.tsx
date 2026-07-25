import { supabase } from "@/lib/supabase"
import TemplateInvitationClient from "./template-invitation-client"
import { buildInvitationTokens, type ThemeRow } from "@/lib/theme-template"
import { mergeInvitationRaw, type RawInvitationData } from "@/lib/invitation-data"
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


export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params

  try {
    const { invitation, customer } = await loadInvitation(slug)
    if (invitation) {
      const raw = mergeInvitationRaw(invitation, customer)
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

  // 템플릿 엔진(B + iframe) 테마만 지원한다 (legacy 렌더러는 제거됨)
  if (themeRow?.render_engine === 'template' && themeRow.template_html) {
    return (
      <TemplateInvitationClient
        themeRow={themeRow}
        raw={mergeInvitationRaw(invitation, customer)}
        invitationId={String(invitation.id)}
        tokens={buildInvitationTokens(themeRow, invitation.customization_overrides)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans p-4">
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold text-slate-800">지원되지 않는 테마</h2>
        <p className="text-sm text-slate-500">
          이 청첩장의 테마를 표시할 수 없습니다. 관리자에게 문의해주세요.
        </p>
      </div>
    </div>
  )
}
