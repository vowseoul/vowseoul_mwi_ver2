"use client"

import { useEffect, useMemo, useState } from "react"
import { useAppStore } from "@/lib/store"
import { supabase } from "@/lib/supabase"
import { MobilePreview } from "@/components/mobile-preview"
import { InvitationFrame } from "@/components/invitation/invitation-frame"
import { buildSlots } from "@/components/invitation/slot-registry"
import { buildFieldData, normalizeLegacyKeys, type RawInvitationData } from "@/lib/invitation-data"
import { toThemeTemplate, buildThemeTokens, type ThemeRow } from "@/lib/theme-template"

/**
 * 편집기 우측 미리보기.
 * 현재 청첩장의 테마가 템플릿 엔진(render_engine==='template')이면 발행과 동일한
 * InvitationFrame 으로 렌더하고, 아니면 기존 MobilePreview(레거시)로 폴백한다.
 *
 * 스토어의 currentInvitation.themeId 는 (로드 시) theme_version_id 를 담을 수 있으므로
 * theme 직접 매칭 → theme_versions 경유 매칭 순으로 해석한다.
 */
export function EditorPreview() {
  const currentInvitation = useAppStore((s) => s.currentInvitation)
  const themes = useAppStore((s) => s.themes)

  const themeRef = currentInvitation?.themeId as string | undefined
  const [themeRow, setThemeRow] = useState<ThemeRow | null>(null)

  // themeRef → themes 행 해석
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!themeRef) { if (active) setThemeRow(null); return }
      const list = (themes || []) as unknown as ThemeRow[]

      // 1) themeRef 가 곧 theme id 인 경우
      let row = list.find((t) => t.id === themeRef) || null

      // 2) theme_version_id 인 경우 → theme_id 로 해석
      if (!row) {
        const { data: version } = await supabase
          .from("theme_versions")
          .select("theme_id")
          .eq("id", themeRef)
          .maybeSingle()
        if (version?.theme_id) {
          row = list.find((t) => t.id === version.theme_id) || null
          if (!row) {
            const { data: theme } = await supabase
              .from("themes").select("*").eq("id", version.theme_id).maybeSingle()
            row = (theme as ThemeRow) ?? null
          }
        }
      }
      if (active) setThemeRow(row)
    })()
    return () => { active = false }
  }, [themeRef, themes])

  // 템플릿 identity 는 테마가 바뀔 때만 갱신 → 폼 입력마다 iframe 재작성 방지
  const template = useMemo(() => toThemeTemplate(themeRow), [themeRow])
  // 최종 토큰 = 테마 기본 + 이 청첩장의 컬러 커스텀(디자인 페이지에서 설정)
  const overrides = currentInvitation?.tokenOverrides
  const tokens = useMemo(() => {
    const t = buildThemeTokens(themeRow)
    if (overrides) for (const [k, v] of Object.entries(overrides)) if (v) t[k] = v
    return t
  }, [themeRow, overrides])

  const raw = useMemo<RawInvitationData>(
    () => normalizeLegacyKeys((currentInvitation ?? {}) as RawInvitationData),
    [currentInvitation]
  )
  const data = useMemo(() => buildFieldData(raw), [raw])
  const accent = tokens["--accent"] || "#D76C6C"
  const slots = useMemo(
    () => buildSlots(template?.slots ?? [], { accent, data, raw }),
    [template, accent, data, raw]
  )

  // 템플릿 엔진 테마 → InvitationFrame, 아니면 레거시 미리보기
  if (template) {
    return (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <InvitationFrame template={template} data={data} tokens={tokens} slots={slots} width={360} height={640} />
      </div>
    )
  }
  return <MobilePreview />
}
