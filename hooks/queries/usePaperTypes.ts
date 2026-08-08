import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase, logSupabaseError } from "@/lib/supabase"

/**
 * 지류 청첩장 라인업.
 *
 * 고객 등록 화면(`/admin/customers/new`)의 "지류 청첩장" 드롭다운이 4종을 하드코딩하고
 * 있어서 상품이 바뀌어도 코드를 고치지 않으면 반영할 수 없었다. settings 테이블에
 * key/value 로 두고 시스템 설정에서 편집한다 (main_image / hero_content 등과 동일한 패턴).
 */

export const PAPER_TYPES_KEY = "paper_types"

/** settings 행이 없을 때 쓰는 기본값 — 기존 하드코딩 목록과 동일하다 */
export const DEFAULT_PAPER_TYPES = [
  "클래식 화이트",
  "시그니처 레더",
  "럭스 골드",
  "오가닉 린넨",
]

/** 지류를 선택하지 않은 고객을 나타내는 고정 항목 (목록에서 편집 대상이 아니다) */
export const NO_PAPER_OPTION = "선택 안 함 (지류 없음)"

function normalize(value: unknown): string[] {
  if (!value || typeof value !== "object") return DEFAULT_PAPER_TYPES
  const list = (value as { types?: unknown }).types
  if (!Array.isArray(list)) return DEFAULT_PAPER_TYPES
  const cleaned = list.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
  return cleaned.length > 0 ? cleaned : DEFAULT_PAPER_TYPES
}

export function usePaperTypesQuery() {
  return useQuery({
    queryKey: ["paper-types"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", PAPER_TYPES_KEY)
        .maybeSingle()

      logSupabaseError("usePaperTypesQuery", error)
      return normalize(data?.value)
    },
  })
}

export function useUpdatePaperTypesMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (types: string[]) => {
      const cleaned = types.map((t) => t.trim()).filter(Boolean)
      const { error } = await supabase
        .from("settings")
        .upsert({ key: PAPER_TYPES_KEY, value: { types: cleaned } }, { onConflict: "key" })

      if (error) throw error
      return cleaned
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paper-types"] })
    },
  })
}
