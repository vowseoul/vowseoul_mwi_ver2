"use client"

import { useRef, useState } from "react"
import { Search, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * 도로명 주소 검색 입력칸 (다음 우편번호 서비스).
 *
 * 손으로 적은 주소를 그대로 받으면 "강남구 테헤란로 123 3층"처럼 층·호수가 섞여
 * 들어와 청첩장 지도의 지오코딩(§app/api/geocode/route.ts)이 실패한다. 검색으로
 * 고른 값은 항상 정규화된 도로명 주소라 지도가 깨지지 않는다.
 *
 * 스크립트는 버튼을 처음 누를 때 한 번만 불러온다 — 주소 항목 하나 때문에 모든
 * 방문자가 외부 스크립트를 받을 이유가 없다.
 */

const POSTCODE_SRC = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"

declare global {
  interface Window {
    daum?: any
  }
}

export interface PostcodeResult {
  roadAddress: string
  jibunAddress: string
  buildingName?: string
}

/**
 * 다음 검색 결과를 입력칸에 넣을 한 줄 주소로 만든다.
 * 도로명이 없는 지역(일부 지방·신규 부지)은 지번 주소로 대신하고, 건물명이 있으면
 * 괄호로 덧붙인다 — "그랜드호텔" 같은 이름이 있어야 하객이 알아보기 쉽다.
 */
export function formatPostcodeResult(data: PostcodeResult): string {
  const base = data.roadAddress || data.jibunAddress || ''
  const building = data.buildingName?.trim()
  return building ? `${base} (${building})` : base
}

function loadPostcodeScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"))
  if (window.daum?.Postcode) return Promise.resolve()

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${POSTCODE_SRC}"]`)
  if (existing) {
    // 다른 입력칸이 이미 로드를 시작한 경우 그 결과를 같이 기다린다
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error("주소 검색을 불러오지 못했습니다.")))
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = POSTCODE_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("주소 검색을 불러오지 못했습니다."))
    document.head.appendChild(script)
  })
}

export function AddressSearchField({
  value,
  onChange,
  placeholder,
  required,
  invalid,
  id,
}: {
  value: string
  onChange: (address: string) => void
  placeholder?: string
  required?: boolean
  invalid?: boolean
  id?: string
}) {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const openSearch = async () => {
    setLoading(true)
    try {
      await loadPostcodeScript()
      setOpen(true)
      // 다이얼로그 내용이 DOM 에 붙은 뒤에 붙여야 한다
      requestAnimationFrame(() => {
        if (!containerRef.current) return
        containerRef.current.innerHTML = ""
        // popup(.open())이 아니라 embed 다 — .open()은 새 창을 띄우는데,
        // 스크립트 로딩을 await 한 뒤라 클릭 제스처가 끊겨 모바일에서 팝업이 차단된다.
        new window.daum.Postcode({
          oncomplete: (data: PostcodeResult) => {
            onChange(formatPostcodeResult(data))
            setOpen(false)
          },
          width: "100%",
          height: "100%",
        }).embed(containerRef.current)
      })
    } catch (err) {
      // 스크립트를 못 받아도 직접 입력은 계속 되도록 막지 않는다
      toast.error(err instanceof Error ? err.message : "주소 검색을 열 수 없습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "주소를 검색해주세요."}
          required={required}
          aria-invalid={invalid || undefined}
        />
        <Button type="button" variant="outline" onClick={openSearch} disabled={loading} className="shrink-0 gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          검색
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        검색으로 선택하면 청첩장 지도가 정확히 표시됩니다. 상세 주소(층·홀 이름)는 뒤에 덧붙여 주세요.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 sm:max-w-md">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle className="text-base">주소 검색</DialogTitle>
          </DialogHeader>
          <div ref={containerRef} className="h-[420px] w-full" />
        </DialogContent>
      </Dialog>
    </div>
  )
}
