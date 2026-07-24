import { redirect } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { ThemeRow } from "@/lib/theme-template"
import CustomizeClient from "./customize-client"

/**
 * 청첩장 편집 진입점.
 * - render_engine === 'template' → 전용 커스터마이즈 편집기(색/폰트 오버라이드 + 미리보기)
 * - 그 외(legacy) → 기존 /editor/[id] 로 리다이렉트 (동작 보존)
 */
export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: invitation } = await supabase
    .from("invitations")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (!invitation) redirect(`/editor/${id}`)

  const { data: customer } = invitation.customer_id
    ? await supabase.from("customers").select("*").eq("id", invitation.customer_id).maybeSingle()
    : { data: null }

  let themeRow: ThemeRow | null = null
  if (invitation.theme_version_id) {
    const { data: version } = await supabase
      .from("theme_versions")
      .select("theme_id")
      .eq("id", invitation.theme_version_id)
      .maybeSingle()
    if (version?.theme_id) {
      const { data: theme } = await supabase
        .from("themes")
        .select("*")
        .eq("id", version.theme_id)
        .maybeSingle()
      themeRow = (theme as ThemeRow) ?? null
    }
  }

  // 템플릿 엔진이 아니면 기존 편집기로
  if (!(themeRow?.render_engine === "template" && themeRow.template_html)) {
    redirect(`/editor/${id}`)
  }

  return (
    <CustomizeClient
      invitationId={id}
      publicSlug={String(invitation.public_slug ?? "")}
      themeRow={themeRow}
      invitation={invitation}
      customer={customer}
    />
  )
}
