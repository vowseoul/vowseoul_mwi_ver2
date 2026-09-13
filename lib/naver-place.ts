/**
 * 예식장 네이버 지도 링크 — "네이버지도" 버튼이 열 주소.
 *
 * 기본 동작은 주소 문자열 검색(map.naver.com/v5/search/{주소})이라, 건물이 아니라
 * 지번·도로명 결과가 뜬다. 하객이 원하는 건 "그 예식장" 페이지다.
 *
 * 이름으로 장소를 자동으로 찾아주는 길(네이버 지역검색 API)은 별도 인증과 별도 키가
 * 필요하고, 같은 이름의 다른 지점이 잡히면 조용히 엉뚱한 곳으로 보낸다. 그래서 관리자가
 * 네이버 지도에서 그 장소를 열어 주소창을 그대로 붙여넣게 한다 — 붙여넣은 주소를
 * 우리가 다시 조립하지 않고 그대로 열기 때문에, 네이버가 URL 형태를 바꿔도 따라갈 일이 없다.
 *
 * 네이버 도메인만 받는다. 청첩장의 "네이버지도" 버튼이 아무 데로나 나갈 수 있으면
 * 버튼 이름이 거짓이 되고, 하객을 임의의 주소로 보내는 통로가 된다.
 */

const ALLOWED_HOSTS = ["naver.com", "naver.me"]

/** 붙여넣은 값이 우리가 열어도 되는 네이버 지도 주소인가 */
export function isNaverPlaceUrl(value: string | null | undefined): boolean {
  return normalizeNaverPlaceUrl(value) !== null
}

/**
 * 저장·사용할 형태로 정규화한다. 네이버 주소가 아니면 null.
 * 스킴이 없으면 https 를 붙여준다 — 주소창에서 복사하면 빠져 있는 경우가 흔하다.
 */
export function normalizeNaverPlaceUrl(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim()
  if (!raw) return null

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null

  const host = url.hostname.toLowerCase()
  const allowed = ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  if (!allowed) return null

  return url.toString()
}
