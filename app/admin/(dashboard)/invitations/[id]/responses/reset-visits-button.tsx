"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { RotateCcw, Loader2 } from "lucide-react"
import { toast } from "sonner"

/** "누적 방문" StatCard 옆에 놓는 초기화 버튼. 테스트 트래픽 제거 등 운영 편의용. */
export function ResetVisitsButton({ invitationId }: { invitationId: string }) {
  const router = useRouter()
  const [isResetting, setIsResetting] = useState(false)

  const handleReset = async () => {
    if (!confirm("정말로 이 청첩장의 누적 방문수를 초기화하시겠습니까? 이 동작은 되돌릴 수 없습니다.")) return
    setIsResetting(true)
    try {
      const res = await fetch("/api/admin/reset-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(result?.error || "방문수 초기화에 실패했습니다.")
        return
      }
      toast.success("방문수가 초기화되었습니다.")
      router.refresh()
    } catch {
      toast.error("방문수 초기화 중 오류가 발생했습니다.")
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-amber-600" onClick={handleReset} disabled={isResetting}>
      {isResetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
      초기화
    </Button>
  )
}
