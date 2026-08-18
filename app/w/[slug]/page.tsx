import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import TemplateInvitationClient from "./template-invitation-client"
import { buildInvitationTokens, extractBlockOrder, extractBlockOverrides, extractDisabledSlots, extractSectionImages, getHiddenBlocks, type ThemeRow } from "@/lib/theme-template"
import { extractScrollMotion } from "@/lib/scroll-motion"
import { extractIntroSettings } from "@/lib/intro-settings"
import { mergeInvitationRaw, type RawInvitationData } from "@/lib/invitation-data"
import { fetchRegisteredFonts, resolveFontFaces } from "@/lib/fonts"
import { Metadata, Viewport } from "next"
import { after } from "next/server"
import { headers } from "next/headers"
import { hashVisitorIp } from "@/lib/visit-hash"

// 하객이 실수로 확대/축소하지 않도록 앱처럼 고정한다 (핀치줌·더블탭 확대 차단).
// JS 레벨 보강은 InvitationFrame 의 preventZoom 옵션(§template-invitation-client.tsx)이 담당한다.
export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ slug: string }>
}

/**
 * 청첩장 + 고객 + (테마체인) 조회.
 *
 * service_role 로 읽는다 — invitations 행에는 신랑신부 대시보드 비밀번호가,
 * customers 행에는 연락처가 들어 있어 anon 에게 SELECT 를 열어둘 수 없다.
 * 이 함수는 Server Component 에서만 호출되므로 키가 브라우저로 나가지 않는다.
 */
async function loadInvitation(slug: string) {
  const supabase = createSupabaseAdminClient()
  // 삭제된(소프트 삭제 포함) 청첩장은 없는 것으로 취급한다 — 관리자 목록에서 지웠거나
  // 보관기간 만료 크론(§app/api/cron/purge-expired-invitations)이 하객 데이터를 파기하고
  // deleted_at 을 찍은 뒤에도, 이 필터가 없어서 링크가 계속 살아 있었다.
  const { data: invitation } = await supabase
    .from('invitations')
    .select('*')
    .eq('public_slug', slug)
    .is('deleted_at', null)
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

/**
 * 방문 로그 기록 — 통계 페이지(admin/statistics)가 visit_logs.visited_at 을 읽어
 * 시간대별 트래픽을 집계하는데, 지금까지 이 테이블에 INSERT하는 코드가 어디에도 없어
 * 실데이터가 전혀 쌓이지 않고 있었다. 서버 컴포넌트라 요청 헤더에서 실제 클라이언트 IP를
 * 읽을 수 있으므로(클라이언트 JS는 자신의 공인 IP를 알 수 없다), 여기서 해시해 저장한다.
 * ip_hash 컬럼이 NOT NULL 이라 실패해도 렌더링을 막지 않도록 항상 무언가를 채워 넣는다.
 * 응답을 지연시키지 않도록 next/server 의 after() 로 응답 전송 후에 실행한다(서버리스 환경에서
 * await 없이 그냥 던지면 함수 실행이 응답과 함께 끊겨버릴 수 있어 fire-and-forget 대신 이 방식을 쓴다).
 * headers() 는 after() 콜백 안에서 호출할 수 없으므로(Next.js 제약) 요청 처리 중에 먼저 읽어둔다.
 */
async function logVisit(invitationId: string, meta: { ipHash: string; userAgent: string | null; referrer: string | null }) {
  try {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from("visit_logs").insert({
      invitation_id: invitationId,
      ip_hash: meta.ipHash,
      user_agent: meta.userAgent,
      referrer: meta.referrer,
    })
    if (error) console.error("visit_logs insert failed:", error.message)
  } catch (err) {
    console.error("logVisit failed:", err)
  }
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
      <div className="min-h-screen bg-muted flex items-center justify-center font-sans p-4">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">찾을 수 없는 청첩장</h2>
          <p className="text-sm text-muted-foreground">
            링크 주소가 잘못되었거나 만료되었을 수 있습니다.
          </p>
        </div>
      </div>
    )
  }

  // 관리자가 청첩장 목록에서 "정지"를 눌렀거나 만료 처리된 청첩장은 하객에게 보여주지
  // 않는다. 지금까지 이 판정이 없어서 "일시정지 상태로 변경되었습니다" 토스트가 뜬 뒤에도
  // 링크는 그대로 살아 있었다 — 고객에게 "내렸다"고 안내하고도 실제로는 계속 공개됐다.
  // draft 는 막지 않는다: 발행 전 시안을 고객·담당자가 이 주소로 확인하는 흐름이 있고
  // (§고객 상세의 "하객용 모바일 청첩장 URL" 복사), 공개 여부는 위 토글이 담당한다.
  if (invitation.status === 'paused' || invitation.status === 'expired') {
    const paused = invitation.status === 'paused'
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center font-sans p-4">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            {paused ? '현재 열람할 수 없는 청첩장' : '기간이 종료된 청첩장'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {paused
              ? '신랑·신부의 요청으로 잠시 공개가 중단되었습니다.'
              : '공개 기간이 종료되어 더 이상 확인하실 수 없습니다.'}
          </p>
        </div>
      </div>
    )
  }

  const h = await headers()
  const forwardedFor = h.get("x-forwarded-for")
  const ip = (forwardedFor ? forwardedFor.split(",")[0].trim() : null) || h.get("x-real-ip") || "unknown"
  const visitMeta = {
    ipHash: hashVisitorIp(ip),
    userAgent: h.get("user-agent"),
    referrer: h.get("referer"),
  }
  after(() => logVisit(String(invitation.id), visitMeta))

  // 템플릿 엔진(B + iframe) 테마만 지원한다 (legacy 렌더러는 제거됨)
  if (themeRow?.render_engine === 'template' && themeRow.template_html) {
    const tokens = buildInvitationTokens(themeRow, invitation.customization_overrides)
    const fonts = await fetchRegisteredFonts()
    const disabledSlots = extractDisabledSlots(invitation.customization_overrides)
    return (
      <TemplateInvitationClient
        themeRow={themeRow}
        raw={mergeInvitationRaw(invitation, customer)}
        invitationId={String(invitation.id)}
        tokens={tokens}
        fontFaces={resolveFontFaces(tokens, fonts)}
        disabledSlots={disabledSlots}
        blockOverrides={extractBlockOverrides(invitation.customization_overrides)}
        blockOrder={extractBlockOrder(invitation.block_order)}
        hiddenBlocks={getHiddenBlocks(disabledSlots)}
        sectionImages={extractSectionImages(invitation.customization_overrides)}
        scrollMotion={extractScrollMotion(invitation.customization_overrides)}
        intro={extractIntroSettings(invitation.customization_overrides)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center font-sans p-4">
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold text-foreground">지원되지 않는 테마</h2>
        <p className="text-sm text-muted-foreground">
          이 청첩장의 테마를 표시할 수 없습니다. 관리자에게 문의해주세요.
        </p>
      </div>
    </div>
  )
}
