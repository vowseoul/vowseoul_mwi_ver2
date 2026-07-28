"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GripVertical, Loader2, Plus, Save, Trash2, FileText } from "lucide-react"
import { toast } from "sonner"
import {
  usePaperTypesQuery,
  useUpdatePaperTypesMutation,
  NO_PAPER_OPTION,
} from "@/hooks/queries/usePaperTypes"

/**
 * 지류 청첩장 라인업 편집.
 *
 * 고객 등록 화면의 "지류 청첩장" 드롭다운이 4종을 하드코딩하고 있어서, 상품이
 * 바뀌어도 코드를 고치기 전엔 반영할 방법이 없었다. settings.paper_types 로 옮기고
 * 여기서 관리한다. "선택 안 함 (지류 없음)"은 지류 미주문 고객을 나타내는 고정
 * 항목이라 목록에 포함하지 않는다.
 */
export default function PaperTypesCard() {
  const { data: saved, isLoading } = usePaperTypesQuery()
  const updateMutation = useUpdatePaperTypesMutation()

  // 서버 값을 초기값으로 받되, 편집 중에는 로컬 상태를 우선한다
  const [draft, setDraft] = useState<string[] | null>(null)
  const types = draft ?? saved ?? []

  const setTypes = (next: string[]) => setDraft(next)

  const handleChange = (index: number, value: string) => {
    setTypes(types.map((t, i) => (i === index ? value : t)))
  }

  const handleAdd = () => setTypes([...types, ""])

  const handleRemove = (index: number) => setTypes(types.filter((_, i) => i !== index))

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= types.length) return
    const next = [...types]
    ;[next[index], next[target]] = [next[target], next[index]]
    setTypes(next)
  }

  const handleSave = async () => {
    const cleaned = types.map((t) => t.trim()).filter(Boolean)
    if (cleaned.length === 0) {
      toast.error("지류 청첩장은 최소 1개 이상이어야 합니다.")
      return
    }
    if (new Set(cleaned).size !== cleaned.length) {
      toast.error("같은 이름이 중복됩니다.")
      return
    }

    try {
      await updateMutation.mutateAsync(cleaned)
      setDraft(null)
      toast.success("지류 청첩장 목록을 저장했습니다.")
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "저장에 실패했습니다.")
    }
  }

  const isDirty = draft !== null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          지류 청첩장 라인업
        </CardTitle>
        <CardDescription>
          고객 등록 화면의 &ldquo;지류 청첩장&rdquo; 선택 목록입니다. 순서를 바꾸면 드롭다운에 보이는
          순서도 함께 바뀌고, 맨 위 항목이 기본값이 됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중...
          </div>
        ) : (
          <div className="space-y-2">
            {types.map((type, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none text-[10px]"
                    aria-label="위로"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === types.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none text-[10px]"
                    aria-label="아래로"
                  >
                    ▼
                  </button>
                </div>
                <GripVertical className="w-4 h-4 shrink-0 text-muted-foreground/40" />
                <Input
                  value={type}
                  onChange={(e) => handleChange(index, e.target.value)}
                  placeholder="예: 클래식 화이트"
                  className="h-9"
                />
                {index === 0 && (
                  <span className="shrink-0 rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                    기본값
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(index)}
                  disabled={types.length <= 1}
                  aria-label="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleAdd}>
              <Plus className="w-3.5 h-3.5" /> 항목 추가
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          &ldquo;{NO_PAPER_OPTION}&rdquo;은 지류를 주문하지 않은 고객을 위해 항상 마지막에 자동으로 표시됩니다.
        </p>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!isDirty || updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {updateMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
