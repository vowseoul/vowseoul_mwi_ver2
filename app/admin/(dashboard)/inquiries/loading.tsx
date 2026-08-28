import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * 문의 관리는 서버 컴포넌트라 페이지 내부에 isLoading 상태가 없다 — 라우트 전환 시
 * Next.js가 자동으로 이 파일을 보여준다. 실제 문의 카드(제목+뱃지, 메타정보, 본문)와
 * 같은 골격으로 만들어 전환 시 레이아웃 점프를 없앤다.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-8 w-24 shrink-0" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
