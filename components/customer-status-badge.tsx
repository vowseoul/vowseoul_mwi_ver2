import { Badge } from '@/components/ui/badge'

// 고객 상태(Customer['status']) 배지 — 고객 관리 목록/대시보드 등 여러 화면에서 공용으로 쓴다
export function CustomerStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'registered':
      return <Badge variant="secondary">신규 등록</Badge>
    case 'form_sent':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">폼 전송</Badge>
    case 'form_completed':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">폼 완료</Badge>
    case 'draft':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">초안 작성</Badge>
    case 'published':
      return <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200">청첩장 발행</Badge>
    case 'expired':
      return <Badge variant="destructive">만료됨</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}
