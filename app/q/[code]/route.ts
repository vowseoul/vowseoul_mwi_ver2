import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"

/**
 * 인쇄된 QR 이 실제로 찍는 주소. 지금 목적지로 넘겨준다.
 *
 * 종이에 박히는 것은 이 주소뿐이라, 청첩장을 갈아끼워도 인쇄물은 그대로 쓴다
 * (§supabase/migrations/20260904000000_qr_redirect_links.sql).
 *
 * ⚠ 반드시 302(임시)여야 한다. 301(영구)을 주면 브라우저와 QR 앱이 그 목적지를
 *   캐시해 버리고, 나중에 연결을 바꿔도 이미 스캔한 기기는 옛 주소로 계속 간다 —
 *   갈아끼울 수 있게 만들려고 넣은 한 겹이 그 순간 무의미해진다.
 */
export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const origin = new URL(request.url).origin

  const supabase = createSupabaseAdminClient()
  const { data: link } = await supabase
    .from("qr_links")
    .select("invitation_id, target_url")
    .eq("code", code)
    .maybeSingle()

  // 직접 지정한 주소가 있으면 그쪽이 우선이다. 저장 시점에 http(s) 만 통과시키므로
  // (§app/api/admin/qr-link) 여기서 javascript: 같은 것이 올라올 일은 없지만,
  // 우리 도메인을 밟고 나가는 주소라 한 번 더 확인한다 — 열린 리디렉터가 되면
  // 우리 주소를 앞세운 피싱 링크를 만들어 줄 수 있다.
  if (link?.target_url && /^https?:\/\//i.test(link.target_url)) {
    return NextResponse.redirect(link.target_url, 302)
  }

  if (link?.invitation_id) {
    // 파기된 청첩장으로는 보내지 않는다 — /w 가 어차피 "찾을 수 없음"을 띄우지만,
    // 그 전에 이 QR 이 아직 연결 가능한 상태인지 여기서 판정하는 편이 명확하다.
    const { data: invitation } = await supabase
      .from("invitations")
      .select("public_slug")
      .eq("id", link.invitation_id)
      .is("deleted_at", null)
      .maybeSingle()

    if (invitation?.public_slug) {
      return NextResponse.redirect(`${origin}/w/${invitation.public_slug}`, 302)
    }
  }

  // 아직 연결되지 않았거나 대상이 사라진 QR. 스캔한 하객에게 흰 화면 대신 사정을 알린다.
  return new NextResponse(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>연결되지 않은 QR코드</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#f5f5f5;font-family:system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif;color:#333}
div{text-align:center;padding:24px}h1{font-size:17px;margin:0 0 8px}p{font-size:14px;color:#666;margin:0}</style>
</head><body><div><h1>연결되지 않은 QR코드입니다</h1>
<p>청첩장을 준비 중이거나 공개 기간이 끝났습니다.<br>신랑·신부에게 문의해주세요.</p></div></body></html>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
  )
}
