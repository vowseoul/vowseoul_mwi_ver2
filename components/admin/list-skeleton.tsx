import { Skeleton } from "@/components/ui/skeleton"
import { TableCell, TableRow } from "@/components/ui/table"

/**
 * 관리자 목록 화면(고객/청첩장/폼 관리 등)의 로딩 스켈레톤. 실제 데이터가 로드되면
 * 같은 행 수·같은 골격으로 자연스럽게 교체되어 레이아웃 점프가 없다.
 * 텍스트 placeholder("불러오는 중입니다...")보다 "무엇이, 몇 개나 올지"를 먼저 보여준다.
 */

/** 데스크톱 <Table> 안에서 쓴다 — <TableBody>{isLoading ? <TableRowsSkeleton .../> : ...}</TableBody> */
export function TableRowsSkeleton({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <TableCell key={c}>
              <Skeleton className="h-4 w-full max-w-[140px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

/** 모바일 카드 리스트 자리에 쓴다 — 이름/부제/뱃지가 있는 전형적인 카드 골격 */
export function CardListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2.5 p-4">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
          </div>
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  )
}
