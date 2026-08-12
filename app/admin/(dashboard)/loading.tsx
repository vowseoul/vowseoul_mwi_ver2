import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CardListSkeleton } from '@/components/admin/list-skeleton'

/**
 * (dashboard) 세그먼트 전체가 공유하는 라우트 전환 로딩 화면. 어떤 하위 페이지로
 * 이동하든 데이터가 도착하기 전 잠깐 보이므로, 특정 화면 전용이 아닌 "제목 + 필터바 +
 * 목록" 형태의 범용 골격을 쓴다. 각 페이지 자체의 isLoading 스켈레톤이 곧 이어서 붙는다.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <Card>
        <CardContent className="p-0">
          <CardListSkeleton rows={6} />
        </CardContent>
      </Card>
    </div>
  )
}
