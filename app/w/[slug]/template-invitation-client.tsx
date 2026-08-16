"use client"

import { useEffect, useState } from "react"
import { InvitationFrame, type BlockOverrideMap, type FontFace, type SectionImage, type TokenMap } from "@/components/invitation/invitation-frame"
import { buildSlots } from "@/components/invitation/slot-registry"
import { buildFieldData, normalizeLegacyKeys, type RawInvitationData } from "@/lib/invitation-data"
import { toThemeTemplate, type ThemeRow } from "@/lib/theme-template"
import type { ScrollMotionSettings } from "@/lib/scroll-motion"
import type { IntroSettings } from "@/lib/intro-settings"

/**
 * 발행용 템플릿 렌더러 (render_engine === 'template').
 * 미리보기(/preview/theme)와 동일한 InvitationFrame 을 사용하므로
 * "미리보기 = 실제 발행" 이 구조적으로 보장된다.
 *
 * 실제 청첩장이므로 invitationId 를 슬롯에 전달 → RSVP 가 DB에 저장된다.
 */
export default function TemplateInvitationClient({
  themeRow,
  raw,
  invitationId,
  tokens = {},
  fontFaces = [],
  disabledSlots = [],
  blockOverrides = {},
  blockOrder,
  hiddenBlocks = [],
  sectionImages = [],
  scrollMotion,
  intro,
}: {
  themeRow: ThemeRow
  raw: RawInvitationData
  invitationId: string
  tokens?: TokenMap
  fontFaces?: FontFace[]
  /** 테마는 지원하지만 이 청첩장 한 건만 꺼둔 기능(예: RSVP 제외 요청) */
  disabledSlots?: string[]
  /** 블럭별 여백/타이틀 오버라이드 (customization_overrides.blocks) */
  blockOverrides?: BlockOverrideMap
  /** 블럭 노출 순서 (invitations.block_order). 없으면 테마 기본 순서 */
  blockOrder?: string[]
  /** disabledSlots 중 섹션 전체를 감춰야 하는 블럭 키 (getHiddenBlocks) */
  hiddenBlocks?: string[]
  /** 섹션 사이 삽입 이미지 (customization_overrides.sectionImages) */
  sectionImages?: SectionImage[]
  /** 스크롤 시 섹션 진입 연출 (customization_overrides.scrollMotion) */
  scrollMotion?: ScrollMotionSettings
  /** 진입 시 오프닝 연출 설정 (customization_overrides.intro) */
  intro?: IntroSettings
}) {
  const template = toThemeTemplate(themeRow)
  // 실제 청첩장은 화면 전체를 채운다 (뷰포트 기준)
  const [size, setSize] = useState({ w: 390, h: 780 })

  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  if (!template) return null

  // 레거시 camelCase content_data 도 슬롯이 읽을 수 있도록 정규화해서 함께 전달
  const normalizedRaw = normalizeLegacyKeys(raw)
  const data = buildFieldData(normalizedRaw)
  const accent = (tokens["--accent"] as string) || "#D76C6C"
  const activeSlots = (template.slots ?? []).filter((s) => !disabledSlots.includes(s))
  const slots = buildSlots(activeSlots, { accent, data, raw: normalizedRaw, invitationId, blockOverrides })

  return (
    <div style={{ margin: 0, padding: 0, lineHeight: 0, background: "#fff" }}>
      <InvitationFrame
        template={template}
        data={data}
        tokens={tokens}
        slots={slots}
        fontFaces={fontFaces}
        blockOverrides={blockOverrides}
        blockOrder={blockOrder}
        hiddenBlocks={hiddenBlocks}
        sectionImages={sectionImages}
        scrollMotion={scrollMotion}
        intro={intro}
        width={size.w}
        height={size.h}
        preventZoom
      />
    </div>
  )
}
