import { Metadata } from 'next'
import { supabase } from '@/lib/supabase'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const invitationId = params.id

  try {
    // 1. invitations 테이블에서 기본 정보(신랑 신부명 등) 조회
    const { data: invite } = await supabase
      .from('invitations')
      .select('groomName, brideName')
      .eq('id', invitationId)
      .single()

    // 2. orders 테이블에서 고객명(customerName) 조회
    const { data: order } = await supabase
      .from('orders')
      .select('customerName')
      .eq('invitationId', invitationId)
      .single()

    const customerName = order?.customerName || `${invite?.groomName || '신랑'} & ${invite?.brideName || '신부'}`
    const title = `${customerName}님의 청첩장 관리 대시보드`
    const description = `${invite?.groomName || '신랑'} ♡ ${invite?.brideName || '신부'}의 예식 하객 RSVP 및 방명록 관리 대시보드입니다.`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
      },
      twitter: {
        card: 'summary',
        title,
        description,
      }
    }
  } catch (err) {
    console.error('Error generating metadata for dashboard:', err)
    return {
      title: '청첩장 관리 대시보드',
      description: 'VOW SEOUL 모바일 청첩장 하객 RSVP 및 방명록 관리 대시보',
    }
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
