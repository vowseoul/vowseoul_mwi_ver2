import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Mail, Phone, MapPin, Clock } from 'lucide-react'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { BUSINESS_INFO_SETTINGS_KEY, parseBusinessInfo } from '@/lib/business-info'
import { InquiryForm } from './inquiry-form'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '문의하기 | VOW SEOUL',
}

async function loadSupportInfo() {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase.from('settings').select('value').eq('key', BUSINESS_INFO_SETTINGS_KEY).maybeSingle()
  return parseBusinessInfo(data?.value)
}

export default async function ContactPage() {
  const business = await loadSupportInfo()

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 bg-muted/30">
        <div className="container mx-auto max-w-5xl px-4 py-16 md:py-24">
          <div className="mb-12 text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">문의하기</h1>
            <p className="mt-4 text-muted-foreground">
              VOW SEOUL 서비스 이용에 대해 궁금하신 점이나 제휴 문의를 남겨주세요.
            </p>
          </div>

          <div className="grid gap-12 md:grid-cols-2">
            {/* Contact Information */}
            <div>
              <h2 className="mb-6 text-2xl font-semibold">고객 지원 센터</h2>
              <p className="mb-8 text-muted-foreground leading-relaxed">
                궁금하신 점이 있으신가요? 아래 폼을 통해 문의를 남겨주시면,
                담당자가 확인 후 영업일 기준 24시간 이내에 답변을 드립니다.
              </p>

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">이메일</h3>
                    <p className="text-muted-foreground">{business.supportEmail || '-'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Phone className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">전화번호</h3>
                    <p className="text-muted-foreground">{business.supportPhone || '-'}</p>
                  </div>
                </div>

                {business.supportHours && (
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Clock className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">운영시간</h3>
                      <p className="text-muted-foreground">{business.supportHours}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">오시는 길</h3>
                    <p className="text-muted-foreground">{business.address || '-'}</p>
                  </div>
                </div>
              </div>
            </div>

            <InquiryForm />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
