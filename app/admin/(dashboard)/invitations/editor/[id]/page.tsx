import { supabase } from "@/lib/supabase"
import type { ThemeRow } from "@/lib/theme-template"
import CustomizeClient from "./customize-client"

/**
 * 청첩장 편집 진입점.
 * - render_engine === 'template' → 전용 커스터마이즈 편집기(색/폰트 오버라이드 + 미리보기)
 * - 그 외(legacy) → 편집기 미지원 안내 (셀프서비스 에디터 폐기됨)
 */
export const dynamic = "force-dynamic"
export const revalidate = 0

function Unsupported({ reason }: { reason: string }) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
      {reason}
    </div>
  )
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: invitation } = await supabase
    .from("invitations")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (!invitation) return <Unsupported reason="청첩장을 찾을 수 없습니다." />

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

  // 템플릿 엔진이 아니면 편집 불가 (legacy 테마는 아직 전용 편집기가 없음)
  if (!(themeRow?.render_engine === "template" && themeRow.template_html)) {
    return <Unsupported reason="이 청첩장은 legacy 테마를 사용 중입니다. 전용 편집기가 아직 지원되지 않습니다." />
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
