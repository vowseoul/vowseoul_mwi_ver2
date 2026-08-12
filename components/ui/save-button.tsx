"use client"

import { useState } from "react"
import { Loader2, Save, Check } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { VariantProps } from "class-variance-authority"

/**
 * 저장 버튼 상태 표준화. idle → pending(클릭 차단) → success(체크 1.5초 후 idle)
 * 또는 → error(흔들림 후 idle, 입력값은 호출부가 그대로 유지하므로 다시 누르면 된다).
 *
 * onSave가 명시적으로 false를 반환하면 실패로 간주해 흔들림을 보여준다 — throw 하지
 *않아도 되므로 기존 "const { error } = await supabase...; if (error) {...}" 패턴을
 * 거의 그대로 두고 마지막에 `return !error`만 추가하면 된다.
 */
export function SaveButton({
  onSave,
  idleLabel = "저장",
  pendingLabel = "저장 중…",
  successLabel = "저장됨",
  className,
  variant,
  size,
  disabled,
}: {
  onSave: () => Promise<boolean | void> | boolean | void
  idleLabel?: React.ReactNode
  pendingLabel?: React.ReactNode
  successLabel?: React.ReactNode
  className?: string
  disabled?: boolean
} & VariantProps<typeof buttonVariants>) {
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle")

  const handleClick = async () => {
    if (status === "pending") return // Constraints: 중복 클릭 차단
    setStatus("pending")
    let ok: boolean | void
    try {
      ok = await onSave()
    } catch {
      ok = false
    }
    if (ok === false) {
      setStatus("error")
      setTimeout(() => setStatus("idle"), 600)
    } else {
      setStatus("success")
      setTimeout(() => setStatus("idle"), 1500)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || status === "pending"}
      onClick={handleClick}
      className={cn(status === "error" && "animate-vs-shake", className)}
    >
      {status === "pending" ? (
        <>
          <Loader2 className="animate-spin" /> {pendingLabel}
        </>
      ) : status === "success" ? (
        <>
          <Check /> {successLabel}
        </>
      ) : (
        <>
          <Save /> {idleLabel}
        </>
      )}
    </Button>
  )
}
