import Link from "next/link"
import { notFound } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { mergeInvitationRaw } from "@/lib/invitation-data"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, CalendarDays, MessageSquare, Users } from "lucide-react"
import { ResetVisitsButton } from "./reset-visits-button"

/**
 * 청첩장별 하객 응답 조회 (관리자).
 *
 * 지금까지 rsvp_responses / guestbook_entries 를 읽는 화면은 신랑신부 대시보드
 * 한 곳뿐이라, 관리자가 "참석 인원이 몇 명이냐"는 문의를 받아도 확인할 방법이
 * 없었다. 관리자는 수정/삭제하지 않고 확인만 한다 — 수집 데이터의 편집 권한은
 * 신랑신부 대시보드에 그대로 둔다.
 */
export const dynamic = "force-dynamic"

export default async function InvitationResponsesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, public_slug, customer_id, content_data")
    .eq("id", id)
    .maybeSingle()

  if (!invitation) notFound()

  const { data: customer } = invitation.customer_id
    ? await supabase.from("customers").select("*").eq("id", invitation.customer_id).maybeSingle()
    : { data: null }

  const [{ data: rsvps }, { data: guestbook }, { data: visits }] = await Promise.all([
    supabase.from("rsvp_responses").select("*").eq("invitation_id", id).order("created_at", { ascending: false }),
    supabase.from("guestbook_entries").select("*").eq("invitation_id", id).order("created_at", { ascending: false }),
    supabase.from("visit_logs").select("id").eq("invitation_id", id),
  ])

  const raw = mergeInvitationRaw(invitation, customer)
  const rsvpRows = rsvps ?? []
  const guestbookRows = guestbook ?? []

  const attending = rsvpRows.filter((r) => r.is_attending)
  const headcount = attending.reduce((sum, r) => sum + (Number(r.party_size) || 1), 0)
  const groomSide = attending.filter((r) => r.side === "groom").reduce((sum, r) => sum + (Number(r.party_size) || 1), 0)
  const brideSide = attending.filter((r) => r.side === "bride").reduce((sum, r) => sum + (Number(r.party_size) || 1), 0)

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild className="-ml-2 h-8 gap-1.5 text-xs text-muted-foreground">
            <Link href="/admin/invitations">
              <ArrowLeft className="h-3.5 w-3.5" /> 청첩장 목록
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">
            {String(raw.groom_name ?? "신랑")} · {String(raw.bride_name ?? "신부")} 하객 응답
          </h1>
          <p className="text-sm text-muted-foreground">
            {[raw.wedding_date, raw.venue_name].filter(Boolean).join(" · ") || "예식 정보 미입력"}
          </p>
        </div>
        {invitation.public_slug && (
          <Button variant="outline" size="sm" asChild className="h-8 text-xs">
            <Link href={`/w/${invitation.public_slug}`} target="_blank">청첩장 열기</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="참석 인원" value={`${headcount}명`} hint={`신랑측 ${groomSide} · 신부측 ${brideSide}`} icon={<Users className="h-4 w-4" />} />
        <StatCard label="RSVP 응답" value={`${rsvpRows.length}건`} hint={`참석 ${attending.length} · 불참 ${rsvpRows.length - attending.length}`} icon={<CalendarDays className="h-4 w-4" />} />
        <StatCard label="방명록" value={`${guestbookRows.length}개`} hint={`공개 ${guestbookRows.filter((g) => g.is_visible !== false).length}개`} icon={<MessageSquare className="h-4 w-4" />} />
        <StatCard
          label="누적 방문"
          value={`${(visits ?? []).length}회`}
          hint="발행 페이지 조회 수"
          icon={<Users className="h-4 w-4" />}
          action={<ResetVisitsButton invitationId={id} />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">RSVP 응답 내역</CardTitle>
          <CardDescription>하객이 직접 제출한 참석 의사입니다. 수정·삭제는 신랑신부 대시보드에서만 가능합니다.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rsvpRows.length === 0 ? (
            <EmptyRow message="접수된 RSVP 응답이 없습니다." />
          ) : (
            <>
              {/* 모바일 카드 리스트 — sm 미만에서는 7열 테이블 대신 카드로 보여준다 */}
              <div className="sm:hidden divide-y divide-border">
                {rsvpRows.map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="font-medium">{r.guest_name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({r.side === "groom" ? "신랑측" : r.side === "bride" ? "신부측" : "-"})
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(r.created_at)} · {r.phone || "연락처 없음"}
                      </p>
                      {r.is_attending && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {r.party_size ?? 1}명 · {r.meal_choice || "식사 미응답"}
                        </p>
                      )}
                    </div>
                    <Badge variant={r.is_attending ? "default" : "secondary"} className="shrink-0">
                      {r.is_attending ? "참석" : "불참"}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* 데스크톱/태블릿 테이블 — sm 이상에서만 보인다 */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">응답일</TableHead>
                      <TableHead className="w-20">구분</TableHead>
                      <TableHead className="w-24">이름</TableHead>
                      <TableHead className="w-32">연락처</TableHead>
                      <TableHead className="w-20 text-center">참석</TableHead>
                      <TableHead className="w-20 text-center">인원</TableHead>
                      <TableHead>식사</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rsvpRows.map((r) => (
                      <TableRow key={r.id} className="text-sm">
                        <TableCell className="text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                        <TableCell>
                          {r.side === "groom" ? "신랑측" : r.side === "bride" ? "신부측" : "-"}
                        </TableCell>
                        <TableCell className="font-medium">{r.guest_name}</TableCell>
                        <TableCell className="text-muted-foreground">{r.phone || "-"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={r.is_attending ? "default" : "secondary"}>
                            {r.is_attending ? "참석" : "불참"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{r.is_attending ? `${r.party_size ?? 1}명` : "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{r.meal_choice || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">방명록</CardTitle>
          <CardDescription>숨김 처리된 글도 함께 표시됩니다.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {guestbookRows.length === 0 ? (
            <EmptyRow message="작성된 방명록이 없습니다." />
          ) : (
            <>
              {/* 모바일 카드 리스트 — sm 미만에서는 4열 테이블 대신 카드로 보여준다 */}
              <div className="sm:hidden divide-y divide-border">
                {guestbookRows.map((g) => (
                  <div key={g.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{g.author_name}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">{formatDate(g.created_at)}</span>
                      </div>
                      <Badge variant={g.is_visible !== false ? "outline" : "secondary"} className="shrink-0">
                        {g.is_visible !== false ? "공개" : "숨김"}
                      </Badge>
                    </div>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{g.message}</p>
                  </div>
                ))}
              </div>

              {/* 데스크톱/태블릿 테이블 — sm 이상에서만 보인다 */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">작성일</TableHead>
                      <TableHead className="w-28">작성자</TableHead>
                      <TableHead>내용</TableHead>
                      <TableHead className="w-20 text-center">노출</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {guestbookRows.map((g) => (
                      <TableRow key={g.id} className="text-sm">
                        <TableCell className="text-muted-foreground">{formatDate(g.created_at)}</TableCell>
                        <TableCell className="font-medium">{g.author_name}</TableCell>
                        <TableCell className="whitespace-pre-line leading-relaxed">{g.message}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={g.is_visible !== false ? "outline" : "secondary"}>
                            {g.is_visible !== false ? "공개" : "숨김"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  icon,
  action,
}: {
  label: string
  value: string
  hint: string
  icon: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{hint}</p>
          {action}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyRow({ message }: { message: string }) {
  return <div className="py-12 text-center text-sm text-muted-foreground">{message}</div>
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "-"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("ko-KR")
}
