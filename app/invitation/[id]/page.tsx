import { supabase } from "@/lib/supabase"
import InvitationClient from "./invitation-client"
import { Metadata, Viewport } from "next"

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params

  try {
    const { data: inviteData } = await supabase
      .from('invitations')
      .select('*')
      .eq('id', id)
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
    console.error('Error generating metadata in server page:', err)
  }

  // Fallback metadata
  return {
    title: 'VOW SEOUL | 모바일 청첩장',
    description: '소중한 서약을 담아드립니다.',
  }
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  // Pre-fetch invitation, themes, and font settings on server
  let initialInvitation = null
  let initialThemes = []
  let initialFonts = []
  try {
    const [inviteResult, themesResult, fontsResult] = await Promise.all([
      supabase.from('invitations').select('*').eq('id', id).single(),
      supabase.from('themes').select('*'),
      supabase.from('settings').select('*').eq('key', 'fonts')
    ])

    initialInvitation = inviteResult.data
    initialThemes = themesResult.data || []
    if (fontsResult.data && fontsResult.data.length > 0) {
      initialFonts = fontsResult.data[0].value || []
    }
  } catch (err) {
    console.error('Error fetching initial data on server:', err)
  }

  return (
    <InvitationClient 
      id={id} 
      initialInvitation={initialInvitation} 
      initialThemes={initialThemes}
      initialFonts={initialFonts}
    />
  )
}
