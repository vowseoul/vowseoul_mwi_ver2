import { supabase } from "@/lib/supabase"
import InvitationClient from "../../invitation/[id]/invitation-client"
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params

  try {
    const { data: inviteData } = await supabase
      .from('invitations')
      .select('*')
      .eq('public_slug', slug)
      .single()

    if (inviteData) {
      const title = inviteData.kakaoTitle || `${inviteData.groomName || '신랑'} ♥ ${inviteData.brideName || '신부'} 결혼합니다`
      const description = inviteData.kakaoDescription || `${inviteData.weddingDate || ''} ${inviteData.weddingTime || ''}`
      const image = inviteData.kakaoThumbnail || inviteData.mainImage || ''

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
        }
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

  let initialInvitation = null
  let initialThemes = []
  let initialFonts = []
  
  try {
    // Fetch invitation by public_slug
    const { data: inviteData, error: inviteError } = await supabase
      .from('invitations')
      .select('*')
      .eq('public_slug', slug)
      .single()

    if (inviteData) {
      initialInvitation = inviteData
      
      const [themesResult, fontsResult] = await Promise.all([
        supabase.from('themes').select('*'),
        supabase.from('settings').select('*').eq('key', 'fonts')
      ])

      initialThemes = themesResult.data || []
      if (fontsResult.data && fontsResult.data.length > 0) {
        initialFonts = fontsResult.data[0].value || []
      }
    }
  } catch (err) {
    console.error('Error fetching initial data on public slug page:', err)
  }

  if (!initialInvitation) {
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

  return (
    <InvitationClient 
      id={initialInvitation.id} 
      initialInvitation={initialInvitation} 
      initialThemes={initialThemes}
      initialFonts={initialFonts}
    />
  )
}
