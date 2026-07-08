import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface BlockLibraryItem {
  id: string
  block_key: string
  name: string
  description: string | null
  icon_name: string | null
  is_required: boolean
  allow_duplicate: boolean
  recommended_position: number
  default_data: any
  default_style: any
  created_at: string
}

export interface BlockVariant {
  id: string
  block_library_id: string
  variant_key: string
  name: string
  description: string | null
  preview_image_url: string | null
  react_component_name: string
  created_at: string
}

export interface Theme {
  id: string
  name: string
  description: string | null
  thumbnail_url: string | null
  created_by: string | null
  is_active: boolean
  deleted_at: string | null
  created_at: string
}

export interface ThemeVersion {
  id: string
  theme_id: string
  version_number: number
  design_tokens: any
  block_variant_selections: any
  default_block_order: string[]
  default_block_visibility: any
  interaction_settings: any
  status: 'draft' | 'active' | 'deprecated'
  change_note: string | null
  created_at: string
}

// =========================================================================
// 1. Block Library Hooks
// =========================================================================
export function useBlockLibraryQuery() {
  return useQuery({
    queryKey: ['block-library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('block_library')
        .select('*')
        .order('recommended_position', { ascending: true })

      if (error) throw error
      return data as BlockLibraryItem[]
    },
  })
}

export function useBlockVariantsQuery() {
  return useQuery({
    queryKey: ['block-variants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('block_variants')
        .select(`
          *,
          block_library:block_library_id (
            block_key,
            name
          )
        `)

      if (error) throw error
      return data as (BlockVariant & { block_library: { block_key: string; name: string } })[]
    },
  })
}

// =========================================================================
// 2. Themes Hooks
// =========================================================================
export function useThemesQuery() {
  return useQuery({
    queryKey: ['themes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('themes')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Theme[]
    },
  })
}

export function useThemeQuery(themeId: string) {
  return useQuery({
    queryKey: ['theme', themeId],
    queryFn: async () => {
      if (!themeId) return null
      const { data, error } = await supabase
        .from('themes')
        .select('*')
        .eq('id', themeId)
        .is('deleted_at', null)
        .single()

      if (error) throw error
      return data as Theme
    },
    enabled: !!themeId,
  })
}

export function useLatestThemeVersionQuery(themeId: string) {
  return useQuery({
    queryKey: ['theme-latest-version', themeId],
    queryFn: async () => {
      if (!themeId) return null
      const { data, error } = await supabase
        .from('theme_versions')
        .select('*')
        .eq('theme_id', themeId)
        .order('version_number', { ascending: false })
        .limit(1)

      if (error) return null
      return (data[0] as ThemeVersion) || null
    },
    enabled: !!themeId,
  })
}

export function useCreateThemeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (newTheme: Omit<Theme, 'id' | 'created_at' | 'deleted_at' | 'is_active'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      
      // 1. Insert Theme
      const { data: theme, error: themeError } = await supabase
        .from('themes')
        .insert([{ ...newTheme, created_by: user?.id || null }])
        .select()
        .single()

      if (themeError) throw themeError

      // 2. Insert Theme Version (v1) with default dummy tokens
      const defaultTokens = {
        colors: {
          primary: "#c4a574",
          background: "#faf9f7",
          text: "#3d3d3d",
          textMuted: "#8a8a8a",
          border: "#ececec"
        },
        typography: {
          heading: { fontFamily: "Playfair Display, serif", fontWeight: 400 },
          body: { fontFamily: "Inter, sans-serif", fontWeight: 400 }
        },
        spacing: { sectionGap: "48px", contentPadding: "24px" },
        border: { radius: "8px" }
      }

      const { error: versionError } = await supabase
        .from('theme_versions')
        .insert([{
          theme_id: theme.id,
          version_number: 1,
          design_tokens: defaultTokens,
          block_variant_selections: {
            cover: "type_a",
            greeting: "type_a",
            "couple-info": "type_a",
            "event-info": "type_a",
            gallery: "slide",
            map: "default",
            account: "type_b",
            rsvp: "default",
            guestbook: "default",
            bgm: "default"
          },
          default_block_order: ["cover", "greeting", "couple-info", "event-info", "gallery", "map", "account", "rsvp", "guestbook"],
          default_block_visibility: {
            cover: true, greeting: true, "couple-info": true, "event-info": true, gallery: true, map: true, account: true, rsvp: true, guestbook: true, bgm: false
          },
          interaction_settings: {
            map_provider: "kakao"
          },
          status: 'active',
          change_note: '초기 테마 템플릿 버전 v1'
        }])

      if (versionError) throw versionError
      return theme as Theme
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes'] })
    },
  })
}

export function useSaveThemeVersionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      themeId,
      designTokens,
      blockVariantSelections,
      defaultBlockOrder,
      defaultBlockVisibility,
      interactionSettings,
      changeNote,
    }: {
      themeId: string
      designTokens: any
      blockVariantSelections: any
      defaultBlockOrder: string[]
      defaultBlockVisibility: any
      interactionSettings: any
      changeNote?: string
    }) => {
      // 1. Get latest version
      const { data: latest } = await supabase
        .from('theme_versions')
        .select('version_number')
        .eq('theme_id', themeId)
        .order('version_number', { ascending: false })
        .limit(1)

      const nextVersion = (latest?.[0]?.version_number || 0) + 1

      // 2. Insert new version
      const { data, error } = await supabase
        .from('theme_versions')
        .insert([{
          theme_id: themeId,
          version_number: nextVersion,
          design_tokens: designTokens,
          block_variant_selections: blockVariantSelections,
          default_block_order: defaultBlockOrder,
          default_block_visibility: defaultBlockVisibility,
          interaction_settings: interactionSettings,
          status: 'active',
          change_note: changeNote || `테마 편집 저장 (v${nextVersion})`
        }])
        .select()
        .single()

      if (error) throw error
      return data as ThemeVersion
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['theme-latest-version', data.theme_id] })
    },
  })
}
