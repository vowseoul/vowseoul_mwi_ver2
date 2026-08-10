import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { dashboardCookieName, verifyDashboardToken } from '@/lib/dashboard-session'
import { mergeInvitationRaw } from '@/lib/invitation-data'
import { SELF_EDIT_SETTINGS_KEY, SELF_EDIT_FIELD_KEYS, parseSelfEditSettings } from '@/lib/self-edit'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock } from 'lucide-react'
import EditClient from './edit-client'

export const dynamic = 'force-dynamic'

/**
 * 셀프 편집 화면 진입점. 인증은 신랑신부 대시보드/검수 화면과 동일한 서명 쿠키로
 * 검증한다(§app/invitation/[id]/review/page.tsx와 같은 패턴). 기능 자체가 관리자
 * 설정에서 꺼져 있으면 인증을 통과했어도(북마크 등으로 재접속) 안내 화면만 보여준다
 * — 페이지 레벨 검사와 별개로 /api/self-edit도 저장 시점에 다시 한번 검사한다
 * (둘 중 하나만 있으면 우회 경로가 생길 수 있어 이중으로 막는다).
 */
export default async function InvitationEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = createSupabaseAdminClient()
  const { data: invitation, error } = await supabase
    .from('invitations')
    .select('id, public_slug, customer_id, content_data')
    .eq('id', id)
    .maybeSingle()

  if (error) console.error('edit: invitation lookup failed:', error.message)
  if (!invitation) notFound()

  const jar = await cookies()
  if (!verifyDashboardToken(jar.get(dashboardCookieName(id))?.value, id)) {
    redirect(`/edit/${invitation.public_slug}`)
  }

  const { data: settingRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', SELF_EDIT_SETTINGS_KEY)
    .maybeSingle()

  if (!parseSelfEditSettings(settingRow?.value).enabled) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center font-sans px-4">
        <Card className="max-w-md w-full border-border/80 shadow-md">
          <CardHeader className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto bg-amber-500/10 text-amber-600">
              <Lock className="w-6 h-6" />
            </div>
            <CardTitle className="text-lg text-foreground">셀프 편집이 비활성화되어 있습니다</CardTitle>
            <CardDescription className="text-xs">
              현재 정보 수정 기능이 꺼져 있습니다. 수정이 필요하시면 담당자에게 문의해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild variant="outline" className="w-full text-xs">
              <Link href={`/dashboard/${invitation.public_slug}`}>대시보드로 돌아가기</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: customer } = invitation.customer_id
    ? await supabase.from('customers').select('*').eq('id', invitation.customer_id).maybeSingle()
    : { data: null }

  const raw = mergeInvitationRaw(invitation, customer)
  const initialFields: Record<string, string> = {}
  for (const key of SELF_EDIT_FIELD_KEYS) {
    const v = raw[key]
    if (typeof v === 'string') initialFields[key] = v
  }
  const initialGalleryImages = Array.isArray(raw.gallery_images)
    ? raw.gallery_images.filter((v): v is string => typeof v === 'string')
    : []

  return (
    <EditClient
      invitationId={id}
      initialFields={initialFields}
      initialGalleryImages={initialGalleryImages}
    />
  )
}
