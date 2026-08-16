import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { BUSINESS_INFO_SETTINGS_KEY, parseBusinessInfo } from '@/lib/business-info'
import { DATA_RETENTION_SETTINGS_KEY, GUEST_DATA_PURGE_DAYS, parseRetentionSettings } from '@/lib/data-retention'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '이용약관 | VOW SEOUL',
}

function Fallback({ value, label }: { value: string; label: string }) {
  if (value.trim()) return <>{value}</>
  return <span className="text-amber-600">[TODO: {label} 미입력 — 관리자 설정 &gt; 보안에서 입력해주세요]</span>
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-border pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-bold text-foreground">
        제{n}조 ({title})
      </h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  )
}

export default async function TermsPage() {
  const supabase = createSupabaseAdminClient()
  const [{ data }, { data: retentionData }] = await Promise.all([
    supabase.from('settings').select('value').eq('key', BUSINESS_INFO_SETTINGS_KEY).maybeSingle(),
    supabase.from('settings').select('value').eq('key', DATA_RETENTION_SETTINGS_KEY).maybeSingle(),
  ])
  const business = parseBusinessInfo(data?.value)
  const retentionDays = parseRetentionSettings(retentionData?.value).daysAfterWedding

  return (
    <div className="flex min-h-screen flex-col">
      <Header hideTemplates />

      <main className="flex-1 bg-muted/30">
        <div className="container mx-auto max-w-3xl px-4 py-16 md:py-24">
          <div className="mb-12">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">이용약관</h1>
          </div>

          <div className="rounded-xl border bg-background p-6 sm:p-8 space-y-10">
            <Section n={1} title="목적">
              <p>
                이 약관은 <Fallback value={business.businessName} label="상호명" />(이하 &ldquo;회사&rdquo;)이
                제공하는 모바일 청첩장 제작 및 관련 서비스(이하 &ldquo;서비스&rdquo;)의 이용과 관련하여
                회사와 이용자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
              </p>
            </Section>

            <Section n={2} title="정의">
              <ul className="list-disc space-y-1 pl-5">
                <li>&ldquo;이용자&rdquo;란 서비스를 통해 청첩장 제작을 의뢰하는 자를 말합니다.</li>
                <li>&ldquo;하객&rdquo;이란 발행된 청첩장을 열람하고 참석 회신·방명록 등을 이용하는 자를 말합니다.</li>
                <li>&ldquo;콘텐츠&rdquo;란 서비스 이용 과정에서 이용자가 제공한 문구·사진·정보 등을 말합니다.</li>
              </ul>
            </Section>

            <Section n={3} title="약관의 효력 및 변경">
              <p>
                이 약관은 서비스 화면에 게시하거나 기타의 방법으로 공지함으로써 효력이 발생합니다. 회사는
                관련 법령을 위배하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 적용일자 및 변경사유를
                명시하여 적용일 7일 전부터 공지합니다.
              </p>
            </Section>

            <Section n={4} title="서비스의 제공 및 변경">
              <p>회사는 다음과 같은 서비스를 제공합니다.</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>모바일 청첩장 제작·발행</li>
                <li>참석 회신, 방명록, 축의금 계좌 안내 등 하객 대상 부가 기능</li>
                <li>청첩장 관리를 위한 신랑신부 전용 대시보드 제공</li>
              </ul>
              <p>회사는 서비스의 내용을 변경할 수 있으며, 이 경우 변경 내용을 사전에 공지합니다.</p>
            </Section>

            <Section n={5} title="청약철회 및 환불">
              <p>
                회사가 제공하는 모바일 청첩장 서비스는 「전자상거래 등에서의 소비자보호에 관한 법률」
                제17조 및 같은 법 시행령 제21조에 따른 디지털 콘텐츠에 해당합니다.
              </p>
              <p>
                이용자는 결제 전 무료 상담, 샘플 확인 등 확인 수단을 통해 서비스 내용을 충분히 확인할 수
                있습니다.
              </p>
              <p>다음 각 호 중 하나에 해당하는 경우 디지털 콘텐츠의 제공이 개시된 것으로 보며, 그 이후에는 청약철회 및 환불이 제한됩니다.</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>청첩장이 발행되어 공개 링크(URL)가 활성화된 경우</li>
                <li>이용자가 대시보드를 통해 콘텐츠 확정 후 제작이 착수된 경우</li>
              </ul>
              <p>발행(제공 개시) 전 취소를 요청하는 경우 다음 기준에 따라 환불합니다.</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>1차 시안 전달 전: 전액 환불</li>
              </ul>
              <p>
                이용자의 단순 변심, 기기·브라우저 환경 문제 등 이용자 귀책 사유로 인한 환불 요청은
                제한될 수 있습니다.
              </p>
              <p>
                실제 결제는 네이버 스마트스토어 &lsquo;VOW SEOUL 바우서울&rsquo;을 통해 이루어지며, 결제
                자체의 취소 절차는 해당 채널 정책을 따르되, 콘텐츠 제공 개시 여부 판단은 본 조를
                기준으로 합니다.
              </p>
              <p>
                환불 요청은 카카오채널 &lsquo;바우서울&rsquo;, 이메일{' '}
                <Fallback value={business.supportEmail} label="고객센터 이메일" /> 등으로 접수하며, 접수일로부터
                영업일 기준 3일 이내 처리합니다.
              </p>
            </Section>

            <Section n={6} title="콘텐츠 보관 및 파기">
              <p>
                이용자가 제작을 의뢰한 청첩장 콘텐츠는 예식일을 기준으로{' '}
                <strong className="text-foreground">{retentionDays}일</strong>간 보관되며, 보관기간 경과 후
                사전 통지 없이 삭제될 수 있습니다(관리자 설정에 따라 변경될 수 있습니다).
              </p>
              <p>
                하객이 입력한 참석 회신(RSVP), 방명록 등 개인정보는 예식일로부터{' '}
                <strong className="text-foreground">{GUEST_DATA_PURGE_DAYS}일</strong>이 경과하면
                파기되며, 자세한 사항은{' '}
                <a href="/privacy" className="text-foreground underline underline-offset-2">
                  개인정보처리방침
                </a>
                을 따릅니다.
              </p>
              <p>삭제된 콘텐츠는 복구할 수 없으며, 이용자는 필요한 자료를 사전에 별도로 보관해야 합니다.</p>
            </Section>

            <Section n={7} title="서비스 이용시간">
              <p>서비스는 연중무휴 1일 24시간 제공을 원칙으로 합니다.</p>
              <p>
                시스템 점검 등 예정된 작업으로 서비스가 일시 중단되는 경우 사전에 공지하며, 긴급한
                사유가 있는 경우 사후 공지로 갈음할 수 있습니다.
              </p>
              <p>다음의 경우 회사는 사전 공지 없이 서비스를 중단할 수 있습니다.</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>긴급한 시스템 점검, 고장 또는 오동작이 발생한 경우</li>
                <li>국가비상사태, 정전, 천재지변 등 불가항력적 사유가 있는 경우</li>
                <li>기간통신사업자가 전기통신 서비스를 중지한 경우</li>
              </ul>
            </Section>

            <Section n={8} title="이용자의 의무">
              <ul className="list-disc space-y-1 pl-5">
                <li>이용자는 정보 제공 시 사실에 근거한 정보를 제공해야 합니다.</li>
                <li>
                  이용자는 하객 등 제3자의 개인정보(연락처 등)를 청첩장에 반영할 때 해당 제3자의 동의를
                  받았음을 전제로 서비스를 이용해야 합니다.
                </li>
                <li>이용자는 타인의 권리를 침해하는 콘텐츠(사진·문구 등)를 등록해서는 안 됩니다.</li>
              </ul>
            </Section>

            <Section n={9} title="콘텐츠의 저작권">
              <p>
                회사가 제공하는 테마, 템플릿, 디자인 요소(그래픽·텍스트·소스코드 포함)의 저작권은
                회사에 있으며, 이용자는 서비스 이용 목적 범위 내에서 사용권만을 가집니다. 이용자는 이를
                상업적으로 이용하거나 재판매할 수 없습니다.
              </p>
              <p>
                이용자가 직접 등록한 사진·문구 등 콘텐츠의 저작권은 이용자에게 있습니다. 회사는 서비스
                제공·운영 및 홍보 목적 활용 범위 내에서만 이를 이용합니다.
              </p>
              <p>이용자가 등록한 콘텐츠가 제3자의 저작권을 침해하는 경우 그 책임은 이용자에게 있습니다.</p>
            </Section>

            <Section n={10} title="개인정보보호">
              <p>
                회사는 관련 법령이 정하는 바에 따라 이용자 및 하객의 개인정보를 보호하기 위해 노력하며,
                자세한 사항은{' '}
                <a href="/privacy" className="text-foreground underline underline-offset-2">
                  개인정보처리방침
                </a>
                을 따릅니다.
              </p>
            </Section>

            <Section n={11} title="서비스 이용의 제한 및 중지">
              <p>
                회사는 이용자가 이 약관 또는 관계 법령을 위반한 경우 서비스 이용을 제한하거나 중지할 수
                있습니다.
              </p>
              <p>
                이용 제한 시 회사는 카카오채널 &lsquo;바우서울&rsquo;, 이메일{' '}
                <Fallback value={business.supportEmail} label="고객센터 이메일" /> 등을 통해 그 사유를
                통지하며, 이용자는 통지일로부터 7일 이내 소명할 수 있습니다.
              </p>
              <p>소명 사유가 타당하다고 인정되는 경우 회사는 제한을 해제합니다.</p>
            </Section>

            <Section n={12} title="면책조항">
              <p>
                회사는 천재지변, 불가항력적 사유로 서비스를 제공할 수 없는 경우 책임이 면제됩니다. 회사는
                이용자가 등록한 콘텐츠의 정확성·신뢰성에 대해 책임을 지지 않습니다.
              </p>
            </Section>

            <Section n={13} title="분쟁해결 및 관할법원">
              <p>
                이 약관과 관련하여 회사와 이용자 간에 발생한 분쟁에 대해서는 민사소송법상의 관할법원에
                소를 제기할 수 있습니다.
              </p>
            </Section>

            <Section n={14} title="문의처">
              <p>
                서비스 이용과 관련한 문의는{' '}
                <Fallback value={business.supportEmail} label="고객센터 이메일" /> 또는{' '}
                <Fallback value={business.supportPhone} label="고객센터 전화번호" />로 연락해 주세요.
              </p>
            </Section>
          </div>
        </div>
      </main>

      <Footer minimal />
    </div>
  )
}
