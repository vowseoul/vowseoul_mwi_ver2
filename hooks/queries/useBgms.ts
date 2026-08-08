import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface BgmAsset {
  id: string
  name: string
  url: string
  artist: string | null
  duration: string | null
  is_active: boolean
  created_at: string
}

// 활성화된 BGM 에셋 목록 — 폼 빌더의 bgm/music 필드 선택지, 공개 폼 렌더링에서 공용으로 쓴다
export function useBgmLibraryQuery() {
  return useQuery({
    queryKey: ['bgm-library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bgms')
        .select('id, name, url, artist, duration, is_active, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as BgmAsset[]) || []
    },
  })
}

// 폼 빌더에서 새 음원을 직접 업로드하면 BGM 관리 라이브러리에도 함께 등록한다(§요청 5).
// url 이 이미 등록돼 있으면 건너뛴다(중복 방지) — upsert 대신 조회 후 조건부 insert.
export function useRegisterBgmAssetMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, url, artist }: { name: string; url: string; artist?: string | null }) => {
      const { data: existing } = await supabase.from('bgms').select('id').eq('url', url).maybeSingle()
      if (existing) return existing

      const { data, error } = await supabase
        .from('bgms')
        .insert({ name, url, artist: artist || null, is_active: true })
        .select('id')
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bgm-library'] })
    },
  })
}
