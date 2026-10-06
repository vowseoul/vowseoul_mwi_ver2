/**
 * 카카오톡으로 나가는 두 카드의 내용 규칙 — 실제로 내보내는 곳과 편집기 미리보기가 같은
 * 함수를 써서, 미리보기에서 본 것과 실제 카드가 어긋나지 않게 한다.
 *
 *  - 링크 미리보기: 카카오톡에 주소를 붙여넣으면 카카오가 페이지의 OG 메타를 읽어 만든다
 *    (§app/w/[slug]/page.tsx generateMetadata).
 *  - 공유하기 버튼 카드: 청첩장 하단 "카카오톡 공유" 버튼이 SDK로 보낸다
 *    (§components/invitation/islands/share-island.tsx).
 *
 * 입력은 og_title/og_description/og_image 가 얹힌 raw 또는 FieldData(§withOgMeta).
 */
type Fields = Record<string, unknown>

const str = (v: unknown): string => (typeof v === "string" ? v : "")

export interface KakaoCardContent {
  title: string
  description: string
  image: string
}

export function resolveLinkPreview(f: Fields): KakaoCardContent {
  const groom = String(f.groom_name ?? "신랑")
  const bride = String(f.bride_name ?? "신부")
  return {
    title: str(f.og_title) || `${groom} ♥ ${bride} 결혼합니다`,
    description: str(f.og_description) || [f.wedding_date, f.venue_name].filter(Boolean).join(" · "),
    image: str(f.og_image) || str(f.main_image),
  }
}

/** 공유하기 버튼 카드 전용 값 → 링크 미리보기 값 → 예전 폼 값 → 기본값 순. 링크 미리보기에만
 *  사진을 넣으면 두 카드가 같은 사진을 쓰고, 버튼 카드에 따로 넣어야 달라진다. */
export function resolveShareCard(f: Fields): KakaoCardContent {
  return {
    title:
      str(f.share_btn_title) || str(f.og_title) || str(f.kakao_share_title) ||
      [f.groom_name, f.bride_name].filter(Boolean).join(" ♥ ") || "모바일 청첩장",
    description: str(f.share_btn_text) || str(f.og_description) || str(f.kakao_share_text) || "저희 결혼식에 초대합니다",
    image: str(f.share_btn_img) || str(f.og_image) || str(f.kakao_share_img) || str(f.main_image),
  }
}
