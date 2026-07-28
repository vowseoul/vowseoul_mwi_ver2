"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

/**
 * 문의 처리 상태 변경.
 * 관리자는 실제 Supabase 세션을 갖고 있으므로 브라우저에서 직접 업데이트한다
 * (RLS 상 authenticated 로 통과한다).
 */
export default function InquiryStatusSelect({
  id,
  status,
  labels,
}: {
  id: string
  status: string
  labels: Record<string, string>
}) {
  const router = useRouter()
  const [value, setValue] = useState(status)
  const [isPending, startTransition] = useTransition()

  const handleChange = async (next: string) => {
    const previous = value
    setValue(next)

    const { error } = await supabase.from("inquiries").update({ status: next }).eq("id", id)
    if (error) {
      console.error("inquiry status update failed:", error.message)
      setValue(previous)
      toast.error("상태를 변경하지 못했습니다.")
      return
    }

    toast.success(`'${labels[next] ?? next}' 으로 변경했습니다.`)
    startTransition(() => router.refresh())
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="h-8 w-32 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(labels).map(([key, label]) => (
          <SelectItem key={key} value={key} className="text-xs">
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
