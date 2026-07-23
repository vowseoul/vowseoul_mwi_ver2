"use client"

import { InvitationFrame, type TokenMap } from "@/components/invitation/invitation-frame"
import { buildSlots } from "@/components/invitation/slot-registry"
import { buildFieldData } from "@/lib/invitation-data"
import { SAMPLE_RAW } from "@/lib/sample-invitation"
import { buildThemeTokens, toThemeTemplate, type ThemeRow } from "@/lib/theme-template"

/**
 * DB themes 행 → 렌더러 실경로.
 * render_engine === 'template' 이면 InvitationFrame(iframe)으로 렌더,
 * 아니면(legacy) 안내 문구 표시.
 */
export default function ThemePreviewClient({ themeRow }: { themeRow: ThemeRow | null }) {
  const template = toThemeTemplate(themeRow)

  if (!themeRow) {
    return <Center>테마를 찾을 수 없습니다.</Center>
  }
  if (!template) {
    return (
      <Center>
        이 테마는 <b>{themeRow.render_engine ?? "legacy"}</b> 엔진입니다.<br />
        새 iframe 렌더러는 render_engine=&apos;template&apos; 테마에만 적용됩니다.
      </Center>
    )
  }

  const data = buildFieldData(SAMPLE_RAW)
  // 테마 토큰(에셋 설정) 적용 — 미지정 항목은 템플릿 CSS의 :root 기본값이 살아남음
  const tokens: TokenMap = buildThemeTokens(themeRow)
  const accent = tokens["--accent"] || "#D76C6C"
  const slots = buildSlots(template.slots ?? [], { accent, data, raw: SAMPLE_RAW })

  return (
    <div style={{ minHeight: "100vh", background: "#e9e5e1", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 0 60px" }}>
      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: "#6b625b", marginBottom: 16 }}>
        미리보기 · {template.name} <span style={{ opacity: 0.6 }}>(DB → InvitationFrame)</span>
      </div>
      <InvitationFrame template={template} data={data} tokens={tokens} slots={slots} width={390} height={780} />
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: "system-ui, sans-serif", color: "#4a3f3a", lineHeight: 1.7, padding: 24 }}>
      <div>{children}</div>
    </div>
  )
}
