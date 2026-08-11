export interface MusicFileOption {
  name: string
  url: string
  title?: string
  tags?: string
}

export interface BgmLibraryRow {
  name: string
  url: string
  artist?: string | null
}

/**
 * 폼의 bgm/music 필드가 보여줄 최종 선택지 = 폼에 직접 업로드한 음원 + BGM 관리
 * 라이브러리 전체(url 이 겹치면 폼 쪽 항목을 우선한다). 어떤 저장/동기화 로직 없이
 * 렌더링 시점마다 다시 합쳐지므로, BGM 관리에 음원을 추가하면 이미 발행된 폼에도
 * 즉시 선택지로 나타난다.
 */
export function mergeMusicChoices(
  ownFiles: MusicFileOption[] | undefined | null,
  library: BgmLibraryRow[] | undefined | null
): MusicFileOption[] {
  const own = ownFiles || []
  const seenUrls = new Set(own.map((f) => f.url))
  const fromLibrary: MusicFileOption[] = (library || [])
    .filter((b) => !seenUrls.has(b.url))
    .map((b) => ({
      name: b.name,
      url: b.url,
      title: b.name,
      tags: b.artist ? `#${b.artist}` : undefined,
    }))
  return [...own, ...fromLibrary]
}
