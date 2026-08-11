import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import {
  BUSINESS_INFO_SETTINGS_KEY,
  DATA_TRANSFER_SETTINGS_KEY,
  parseBusinessInfo,
  parseDataTransferInfo,
  isBusinessInfoIncomplete,
} from '@/lib/business-info'
import { DATA_RETENTION_SETTINGS_KEY, GUEST_DATA_PURGE_DAYS, parseRetentionSettings } from '@/lib/data-retention'
import { PRIVACY_POLICY_VERSION, PRIVACY_POLICY_EFFECTIVE_DATE } from '@/lib/privacy-policy'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '개인정보처리방침 | VOW SEOUL',
}

async function loadPolicySettings() {
  const supabase = createSupabaseAdminClient()
  const [{ data: businessData }, { data: transferData }, { data: retentionData }] = await Promise.all([
    supabase.from('settings').select('value').eq('key', BUSINESS_INFO_SETTINGS_KEY).maybeSingle(),
    supabase.from('settings').select('value').eq('key', DATA_TRANSFER_SETTINGS_KEY).maybeSingle(),
    supabase.from('settings').select('value').eq('key', DATA_RETENTION_SETTINGS_KEY).maybeSingle(),
  ])
  return {
    business: parseBusinessInfo(businessData?.value),
    transfer: parseDataTransferInfo(transferData?.value),
    retentionDays: parseRetentionSettings(retentionData?.value).daysAfterWedding,
  }
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-border pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-bold text-foreground">
        {n}. {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  )
}

function Fallback({ value, label }: { value: string; label: string }) {
  if (value.trim()) return <>{value}</>
  return <span className="text-amber-600">[TODO: {label} 미입력 — 관리자 설정 &gt; 보안에서 입력해주세요]</span>
}

export default async function PrivacyPolicyPage() {
  const { business, transfer, retentionDays } = await loadPolicySettings()
  const incomplete = isBusinessInfoIncomplete(business)

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 bg-muted/30">
        <div className="container mx-auto max-w-3xl px-4 py-16 md:py-24">
          <div className="mb-12">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">개인정보처리방침</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              버전 {PRIVACY_POLICY_VERSION} · 시행일 {PRIVACY_POLICY_EFFECTIVE_DATE}
            </p>
          </div>

          {incomplete && (
            <div className="mb-10 rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-800">
              사업자 정보가 아직 입력되지 않아 아래 방침 곳곳이 임시 표시(TODO)로 나갑니다. 관리자 &gt;
              설정 &gt; 보안 탭에서 실제 값을 입력해 주세요.
            </div>
          )}

          <div className="rounded-xl border bg-background p-6 sm:p-8 space-y-10">
            <p className="text-sm leading-relaxed text-muted-foreground">
              <Fallback value={business.businessName} label="상호명" />(이하 &ldquo;회사&rdquo;)는 이용자의
              개인정보를 중요시하며, 「개인정보 보호법」 등 관련 법령을 준수하고 있습니다. 회사는 본
              개인정보처리방침을 통하여 이용자가 제공하는 개인정보가 어떠한 목적과 방식으로 이용되고
              있으며, 개인정보 보호를 위해 어떠한 조치가 취해지고 있는지 알려드립니다.
            </p>

            <Section n={1} title="수집하는 개인정보의 항목 및 수집 방법">
              <p>회사는 서비스 제공을 위해 아래와 같이 개인정보를 수집합니다.</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 pr-3 font-semibold text-foreground">수집 대상</th>
                      <th className="py-2 pr-3 font-semibold text-foreground">수집 항목</th>
                      <th className="py-2 font-semibold text-foreground">수집 방법</th>
                    </tr>
                  </thead>
                  <tbody className="align-top">
                    <tr className="border-b border-border/60">
                      <td className="py-2 pr-3">청첩장 제작 의뢰인(신랑신부)</td>
                      <td className="py-2 pr-3">
                        성명, 연락처, 예식 일시·장소, 인사말, 사진, 계좌정보(은행명·계좌번호·예금주), 배경음악 선택
                      </td>
                      <td className="py-2">정보 수집 양식(폼) 제출, 셀프 편집 화면 수정</td>
                    </tr>
                    <tr className="border-b border-border/60">
                      <td className="py-2 pr-3">청첩장을 열람한 하객(참석 회신)</td>
                      <td className="py-2 pr-3">성명, 연락처, 참석 여부, 참석 인원, 식사·셔틀버스 이용 여부</td>
                      <td className="py-2">모바일 청첩장 내 참석 회신 작성</td>
                    </tr>
                    <tr className="border-b border-border/60">
                      <td className="py-2 pr-3">청첩장을 열람한 하객(방명록)</td>
                      <td className="py-2 pr-3">작성자 이름, 메시지 내용</td>
                      <td className="py-2">모바일 청첩장 내 방명록 작성</td>
                    </tr>
                    <tr className="border-b border-border/60">
                      <td className="py-2 pr-3">청첩장을 열람한 모든 방문자</td>
                      <td className="py-2 pr-3">
                        접속 IP(일방향 암호화 처리), 기기·브라우저 정보, 접속 일시, 유입 경로
                      </td>
                      <td className="py-2">청첩장 페이지 접속 시 자동 수집</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-3">서비스 문의자</td>
                      <td className="py-2 pr-3">이름, 이메일, 문의 내용</td>
                      <td className="py-2">문의하기 양식 제출</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                계좌정보는 하객에게 축의금 계좌를 안내하기 위한 목적으로만 수집·표시되며, 그 외 별도의
                금융 처리에는 사용되지 않습니다.
              </p>
            </Section>

            <Section n={2} title="개인정보의 수집 및 이용 목적">
              <ul className="list-disc space-y-1 pl-5">
                <li>모바일 청첩장 제작·발행 및 신랑신부와의 제작 관련 소통</li>
                <li>하객 참석 인원·식사·셔틀버스 수요 파악 및 안내</li>
                <li>방명록 등 하객 참여 콘텐츠 제공</li>
                <li>서비스 이용 통계 산출 및 오류 대응</li>
                <li>문의 접수 및 답변</li>
              </ul>
            </Section>

            <Section n={3} title="개인정보의 보유 및 이용 기간">
              <p>회사는 원칙적으로 개인정보 수집·이용 목적이 달성되면 지체 없이 파기합니다.</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  신랑신부(의뢰인) 정보: 예식일로부터{' '}
                  <strong className="text-foreground">{retentionDays}일</strong>이 경과하면 파기합니다 (관리자
                  설정에 따라 변경될 수 있습니다).
                </li>
                <li>
                  하객 참석 회신·방명록·접속기록: 예식일로부터{' '}
                  <strong className="text-foreground">{GUEST_DATA_PURGE_DAYS}일</strong>이 경과하면 파기합니다.
                </li>
                <li>문의 내역: 문의 처리 완료 후 3년간 보관 후 파기합니다.</li>
                <li>관계 법령에 따라 보존이 필요한 경우 해당 법령이 정한 기간 동안 보관합니다.</li>
              </ul>
            </Section>

            <Section n={4} title="개인정보의 제3자 제공">
              <p>
                회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 아래의 경우에는
                예외로 합니다.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>이용자가 사전에 별도로 동의한 경우</li>
                <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 요구가 있는 경우</li>
              </ul>
            </Section>

            <Section n={5} title="개인정보처리 업무의 위탁">
              <p>회사는 서비스 운영을 위해 아래와 같이 개인정보 처리 업무를 위탁하고 있습니다.</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 pr-3 font-semibold text-foreground">수탁업체</th>
                      <th className="py-2 font-semibold text-foreground">위탁 업무 내용</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/60">
                      <td className="py-2 pr-3">Supabase, Inc.</td>
                      <td className="py-2">데이터베이스 및 파일(이미지 등) 저장·관리</td>
                    </tr>
                    <tr className="border-b border-border/60">
                      <td className="py-2 pr-3">Vercel Inc.</td>
                      <td className="py-2">서비스 호스팅 및 접속 통계 분석</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-3">네이버클라우드(주)</td>
                      <td className="py-2">청첩장 내 지도·주소 검색(지오코딩)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>

            <Section n={6} title="개인정보의 국외 이전">
              {transfer.isOverseas ? (
                <>
                  <p>회사는 서비스 제공을 위해 아래와 같이 개인정보를 국외로 이전하고 있습니다.</p>
                  <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs">
                    {transfer.details.trim() || (
                      <span className="text-amber-600">
                        [TODO: 국외이전 상세 내용 미입력 — 관리자 설정 &gt; 보안에서 입력해주세요]
                      </span>
                    )}
                  </p>
                </>
              ) : (
                <p>회사가 이용하는 서버는 국내 리전에서 운영되어 별도의 국외이전 사항이 없습니다.</p>
              )}
            </Section>

            <Section n={7} title="정보주체의 권리·의무 및 행사방법">
              <p>
                이용자는 언제든지 자신의 개인정보를 조회하거나 수정할 수 있으며, 수집·이용 동의를
                철회(삭제)를 요청할 수 있습니다.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  청첩장 제작 정보: 발급받은 신랑신부 대시보드에서 직접 조회·수정하거나, 아래 문의처를
                  통해 삭제를 요청할 수 있습니다.
                </li>
                <li>
                  참석 회신: 동일한 연락처로 청첩장에서 다시 제출하면 기존 응답이 수정되며, &ldquo;응답
                  취소하기&rdquo;로 직접 삭제할 수도 있습니다.
                </li>
                <li>방명록: 작성 시 등록한 비밀번호로 본인 글을 직접 삭제할 수 있습니다.</li>
                <li>
                  그 밖의 권리 행사는 아래 &ldquo;개인정보 보호책임자&rdquo; 연락처로 요청하시면 지체
                  없이 조치합니다.
                </li>
              </ul>
            </Section>

            <Section n={8} title="개인정보의 파기절차 및 방법">
              <ul className="list-disc space-y-1 pl-5">
                <li>파기절차: 보유기간이 경과한 개인정보는 별도의 DB로 옮겨지거나 즉시 파기됩니다.</li>
                <li>
                  파기방법: 전자적 파일 형태로 저장된 개인정보는 기록을 재생할 수 없는 기술적 방법을
                  사용하여 삭제하며, 첨부된 이미지 등 파일은 저장소에서 함께 삭제합니다.
                </li>
              </ul>
            </Section>

            <Section n={9} title="개인정보의 안전성 확보조치">
              <ul className="list-disc space-y-1 pl-5">
                <li>비밀번호 등 인증정보는 암호화하여 저장·관리합니다.</li>
                <li>개인정보에 대한 접근권한을 서비스 제공에 필요한 범위로 제한하고 있습니다.</li>
                <li>접속 IP는 일방향 암호화(해시) 처리하여 저장합니다.</li>
                <li>개인정보처리시스템에 대한 접근기록을 보관·관리합니다.</li>
              </ul>
            </Section>

            <Section n={10} title="쿠키 등 자동 수집 장치의 설치·운영 및 거부">
              <p>
                회사는 이용 통계 분석과 콘텐츠(웹폰트) 제공을 위해 아래와 같은 자동 수집 장치를
                운영합니다. 이는 광고 목적의 추적에 사용되지 않습니다.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>접속 통계 분석: 페이지 방문 정보가 서비스 운영사(Vercel)로 전송됩니다.</li>
                <li>웹폰트 제공: 화면 표시를 위해 글꼴 파일 요청 시 접속 IP가 폰트 제공사로 전송될 수 있습니다.</li>
              </ul>
              <p>
                이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 서비스 이용에 일부
                제약이 있을 수 있습니다.
              </p>
            </Section>

            <Section n={11} title="개인정보 보호책임자">
              <div className="rounded-md bg-muted/50 p-4 text-xs">
                <p>
                  <span className="font-semibold text-foreground">성명</span>{' '}
                  <Fallback value={business.cpoName} label="CPO 성명" />
                  {business.cpoTitle.trim() && ` (${business.cpoTitle})`}
                </p>
                <p>
                  <span className="font-semibold text-foreground">연락처</span>{' '}
                  <Fallback value={business.cpoPhone} label="CPO 연락처" />
                </p>
                <p>
                  <span className="font-semibold text-foreground">이메일</span>{' '}
                  <Fallback value={business.cpoEmail} label="CPO 이메일" />
                </p>
              </div>
              <p>
                이용자는 서비스 이용 중 발생한 개인정보 관련 문의·불만·피해구제 등을 개인정보 보호책임자
                및 담당부서로 문의하실 수 있습니다.
              </p>
            </Section>

            <Section n={12} title="권익침해 구제방법">
              <p>
                개인정보 침해에 대한 신고나 상담이 필요하신 경우 아래 기관에 문의하실 수 있습니다.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>개인정보분쟁조정위원회 (1833-6972, www.kopico.go.kr)</li>
                <li>개인정보침해신고센터 (국번없이 118, privacy.kisa.or.kr)</li>
                <li>대검찰청 사이버범죄수사단 (국번없이 1301, www.spo.go.kr)</li>
                <li>경찰청 사이버안전국 (국번없이 182, cyberbureau.police.go.kr)</li>
              </ul>
            </Section>

            <Section n={13} title="사업자 정보">
              <div className="rounded-md bg-muted/50 p-4 text-xs">
                <p>
                  <span className="font-semibold text-foreground">상호</span>{' '}
                  <Fallback value={business.businessName} label="상호명" />
                </p>
                <p>
                  <span className="font-semibold text-foreground">대표자</span>{' '}
                  <Fallback value={business.representativeName} label="대표자명" />
                </p>
                <p>
                  <span className="font-semibold text-foreground">사업자등록번호</span>{' '}
                  <Fallback value={business.registrationNumber} label="사업자등록번호" />
                </p>
                <p>
                  <span className="font-semibold text-foreground">주소</span>{' '}
                  <Fallback value={business.address} label="사업장 주소" />
                </p>
                <p>
                  <span className="font-semibold text-foreground">고객센터</span>{' '}
                  <Fallback value={business.supportEmail} label="고객센터 이메일" /> /{' '}
                  <Fallback value={business.supportPhone} label="고객센터 전화번호" />
                </p>
              </div>
            </Section>

            <Section n={14} title="고지의 의무">
              <p>
                이 개인정보처리방침은 {PRIVACY_POLICY_EFFECTIVE_DATE}부터 적용됩니다. 법령·정책 또는
                보안기술의 변경에 따라 내용의 추가·삭제 및 수정이 있을 경우, 변경사항의 시행 7일 전부터
                본 페이지를 통해 공지합니다.
              </p>
            </Section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
