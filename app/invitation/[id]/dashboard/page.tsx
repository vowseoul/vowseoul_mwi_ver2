import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { after } from 'next/server'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { dashboardCookieName, verifyDashboardToken } from '@/lib/dashboard-session'
import { mergeInvitationRaw } from '@/lib/invitation-data'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, ShieldAlert } from 'lucide-react'
import CustomerDashboardClient from './dashboard-client'

export const dynamic = 'force-dynamic'

/** 하객 개인정보 보호 정책 (예식일 기준 경과일) */
const DASHBOARD_EXPIRY_DAYS = 7
const DATA_PURGE_DAYS = 14

/**
 * 신랑신부 대시보드 진입점.
 *
 * 이전에는 이 라우트 전체가 클라이언트 컴포넌트였고 **가드가 전혀 없었다** —
 * `/dashboard/[slug]` 의 비밀번호 게이트는 통과 여부를 localStorage 에만 적어뒀을
 * 뿐이라, invitation UUID 만 알면 하객 실명·연락처·방명록을 그대로 열람하고
 * 삭제까지 할 수 있었다. 이제 서버에서 서명 쿠키를 검증한 뒤에만 본문을 렌더한다.
 */
export default async function CustomerDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const { data: invitation, error } = await supabase
    .from('invitations')
    .select('id, public_slug, customer_id, content_data')
    .eq('id', id)
    .maybeSingle()

  if (error) console.error('dashboard: invitation lookup failed:', error.message)
  if (!invitation) notFound()

  // 1) 인증 — 서명·만료가 검증된 httpOnly 쿠키가 없으면 비밀번호 게이트로 되돌린다
  const jar = await cookies()
  if (!verifyDashboardToken(jar.get(dashboardCookieName(id))?.value, id)) {
    redirect(`/dashboard/${invitation.public_slug}`)
  }

  const { data: customer } = invitation.customer_id
    ? await supabase.from('customers').select('*').eq('id', invitation.customer_id).maybeSingle()
    : { data: null }

  // 2) 만료·파기 정책
  //
  // 예전 코드는 `invitations.weddingDate` 를 읽었는데 그런 컬럼이 없다 — 예식일은
  // content_data(또는 customers) 안의 `wedding_date` 필드키다. 항상 undefined 라
  // 이 블록 전체가 한 번도 실행된 적이 없었고, 따라서 "14일 후 자동 파기" 정책이
  // 실제로는 동작하지 않아 하객 연락처가 무기한 남아 있었다.
  const raw = mergeInvitationRaw(invitation, customer)
  const daysSinceWedding = daysSince(raw.wedding_date)

  if (daysSinceWedding !== null && daysSinceWedding >= DATA_PURGE_DAYS) {
    // 응답을 지연시키지 않도록 파기는 응답 전송 후에 실행한다
    after(() => purgeCollectedData(id))
    return (
      <PolicyNotice
        tone="destructive"
        icon={<ShieldAlert className="w-6 h-6" />}
        title="수집 정보 파기 완료"
        description={`개인정보 보호 정책에 따라 예식일로부터 ${DATA_PURGE_DAYS}일이 경과하여 해당 청첩장의 하객 RSVP 정보와 방명록 데이터가 영구적으로 파기되었습니다.`}
      />
    )
  }

  if (daysSinceWedding !== null && daysSinceWedding >= DASHBOARD_EXPIRY_DAYS) {
    return (
      <PolicyNotice
        tone="warning"
        icon={<Calendar className="w-6 h-6" />}
        title="관리 대시보드 만료"
        description={`예식일로부터 ${DASHBOARD_EXPIRY_DAYS}일이 경과하여 대시보드 링크가 만료되었습니다. (하객 개인정보 보호를 위한 정책이며, 예식일 ${DATA_PURGE_DAYS}일 이후 수집 데이터는 자동 영구 파기 처리됩니다.)`}
      />
    )
  }

  return (
    <CustomerDashboardClient
      invitationId={id}
      header={{
        groomName: String(raw.groom_name ?? '신랑'),
        brideName: String(raw.bride_name ?? '신부'),
        venueName: String(raw.venue_name ?? ''),
        weddingDate: String(raw.wedding_date ?? ''),
        weddingTime: String(raw.wedding_time ?? ''),
        publicSlug: String(invitation.public_slug ?? ''),
      }}
    />
  )
}

/** 'YYYY-MM-DD' 예식일로부터 오늘까지 며칠 지났는가 (미래면 음수, 파싱 불가면 null) */
function daysSince(weddingDate: unknown): number | null {
  if (typeof weddingDate !== 'string' || !weddingDate) return null
  const wedding = new Date(`${weddingDate.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(wedding.getTime())) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - wedding.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * 예식일 14일 경과 시 수집 데이터 영구 삭제.
 *
 * `after()` 콜백 안에서는 `cookies()` 를 호출할 수 없다(Next.js 제약) — 따라서
 * 쿠키 세션에 의존하는 createSupabaseServerClient() 대신 세션이 필요 없는
 * 순수 anon 클라이언트를 여기서 직접 만든다.
 */
async function purgeCollectedData(invitationId: string) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { auth: { persistSession: false } },
    )
    for (const table of ['rsvp_responses', 'guestbook_entries', 'visit_logs'] as const) {
      const { error } = await supabase.from(table).delete().eq('invitation_id', invitationId)
      if (error) console.error(`purge ${table} failed:`, error.message)
    }
  } catch (err) {
    console.error('purgeCollectedData failed:', err)
  }
}

function PolicyNotice({
  tone,
  icon,
  title,
  description,
}: {
  tone: 'destructive' | 'warning'
  icon: React.ReactNode
  title: string
  description: string
}) {
  const iconClass = tone === 'destructive'
    ? 'bg-destructive/10 text-destructive'
    : 'bg-amber-500/10 text-amber-600'

  return (
    <div className="min-h-screen bg-muted/20 flex items-center justify-center font-sans px-4">
      <Card className="max-w-md w-full border-border/80 shadow-md">
        <CardHeader className="text-center space-y-2">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${iconClass}`}>
            {icon}
          </div>
          <CardTitle className="text-lg text-foreground">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild variant="outline" className="w-full text-xs">
            <Link href="/">메인 페이지로</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
