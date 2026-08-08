import { createSupabaseServerClient } from "@/lib/supabase-server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import InquiryStatusSelect from "./status-select"

/**
 * 고객 문의 관리.
 *
 * /contact 폼은 지금도 살아 있어 inquiries 에 행이 쌓이는데, 이 테이블을 읽는
 * 화면이 코드베이스 어디에도 없었다 — 고객이 문의를 남겨도 아무도 볼 수 없었다.
 */
export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<string, string> = {
  new: "신규",
  read: "확인함",
  replied: "답변완료",
}

export default async function InquiriesPage() {
  const supabase = await createSupabaseServerClient()
  const { data: inquiries, error } = await supabase
    .from("inquiries")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) console.error("inquiries load failed:", error.message)

  const rows = inquiries ?? []
  const unread = rows.filter((r) => r.status === "new").length

  return (
    <div className="space-y-6 font-sans">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">문의 관리</h1>
        <p className="text-sm text-muted-foreground">
          홈페이지 문의하기 폼으로 접수된 내역입니다.
          {unread > 0 && <span className="ml-1 font-medium text-foreground">확인하지 않은 문의 {unread}건</span>}
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            접수된 문의가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((inq) => (
            <Card key={inq.id}>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    {inq.subject || "(제목 없음)"}
                    {inq.status === "new" && <Badge>신규</Badge>}
                  </CardTitle>
                  <CardDescription className="flex flex-wrap gap-x-3 gap-y-1">
                    <span className="font-medium text-foreground">{inq.name}</span>
                    {inq.email && <span>{inq.email}</span>}
                    {inq.phone && <span>{inq.phone}</span>}
                    <span>{formatDateTime(inq.created_at)}</span>
                  </CardDescription>
                </div>
                <InquiryStatusSelect
                  id={String(inq.id)}
                  status={String(inq.status ?? "new")}
                  labels={STATUS_LABEL}
                />
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{inq.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDateTime(value: unknown): string {
  if (typeof value !== "string" || !value) return "-"
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })
}
