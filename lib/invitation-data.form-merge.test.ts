import { describe, it, expect } from "vitest"
import { buildContentDataFromForm, deriveOgMetaFromForm, deriveOverridesFromForm, resolveBgmUrlFromSnapshot } from "./invitation-data"

describe("buildContentDataFromForm", () => {
  it("passes through form field keys the renderer already expects", () => {
    const raw = {
      main_image: "https://example.com/main.jpg",
      gallery_images: ["https://example.com/g1.jpg", "https://example.com/g2.jpg"],
      account_groom_bank: "QA은행",
      account_groom_number: "111-222-333",
      account_groom_holder: "QA신랑",
    }
    const out = buildContentDataFromForm(raw)
    expect(out.main_image).toBe(raw.main_image)
    expect(out.gallery_images).toEqual(raw.gallery_images)
    expect(out.account_groom_bank).toBe("QA은행")
  })

  it("aliases form-only keys to the content_data keys the renderer reads", () => {
    const raw = { direction_tpt: "지하철 5분", direction_prk: "무료주차", direction_sht: "셔틀 있음", gallery_format: "그리드형" }
    const out = buildContentDataFromForm(raw)
    expect(out.traffic_info).toBe("지하철 5분")
    expect(out.parking_info).toBe("무료주차")
    expect(out.shuttle_info).toBe("셔틀 있음")
    expect(out.gallery_view_type).toBe("그리드형")
  })

  it("does not clobber an existing canonical key with an empty alias source", () => {
    const raw = { traffic_info: "이미 있음", direction_tpt: "" }
    const out = buildContentDataFromForm(raw)
    expect(out.traffic_info).toBe("이미 있음")
  })

  it("leaves alias target unset (not empty string) when no source has a value", () => {
    const out = buildContentDataFromForm({})
    expect(out.traffic_info).toBeUndefined()
  })

  it("falls back to rsvp_shuttle_detail for shuttle_info when direction_sht is empty", () => {
    const out = buildContentDataFromForm({ rsvp_shuttle_detail: "정문 앞 15분 간격" })
    expect(out.shuttle_info).toBe("정문 앞 15분 간격")
  })

  it("falls back to greeting_message_m/greeting_message_mobile for greeting_message", () => {
    expect(buildContentDataFromForm({ greeting_message_m: "모바일 인사말" }).greeting_message).toBe("모바일 인사말")
    expect(buildContentDataFromForm({ greeting_message_mobile: "모바일 인사말2" }).greeting_message).toBe("모바일 인사말2")
    // 정식 필드가 이미 있으면 대체 필드보다 우선
    expect(buildContentDataFromForm({ greeting_message: "정식", greeting_message_m: "대체" }).greeting_message).toBe("정식")
  })

  it("derives individual *_deceased flags from the parents_deceased mselect string", () => {
    const out = buildContentDataFromForm({ parents_deceased: "신랑측 아버지, 신부측 어머니" })
    expect(out.groom_father_deceased).toBe("예")
    expect(out.bride_mother_deceased).toBe("예")
    expect(out.groom_mother_deceased).toBe("아니오")
    expect(out.bride_father_deceased).toBe("아니오")
  })

  it("does not override an existing individual *_deceased flag with the mselect derivation", () => {
    const out = buildContentDataFromForm({ parents_deceased: "신랑측 아버지", groom_father_deceased: "아니오" })
    expect(out.groom_father_deceased).toBe("아니오")
  })
})

describe("deriveOgMetaFromForm", () => {
  it("maps kakao_share_* fields to og_meta shape", () => {
    const raw = { kakao_share_title: "QA 제목", kakao_share_text: "QA 설명", kakao_share_img: "https://example.com/k.jpg" }
    expect(deriveOgMetaFromForm(raw)).toEqual({ title: "QA 제목", description: "QA 설명", image: "https://example.com/k.jpg" })
  })

  it("returns null when none of the kakao fields are present", () => {
    expect(deriveOgMetaFromForm({ groom_name: "a" })).toBeNull()
  })

  it("returns only the keys that are actually present", () => {
    expect(deriveOgMetaFromForm({ kakao_share_title: "제목만" })).toEqual({ title: "제목만" })
  })
})

describe("deriveOverridesFromForm", () => {
  it("adds a slot to disabledSlotsAdd when the toggle is explicitly off", () => {
    const out = deriveOverridesFromForm({ show_rsvp: "아니오", account_expose: "아니오" })
    expect(out.disabledSlotsAdd.sort()).toEqual(["account", "rsvp"])
    expect(out.disabledSlotsRemove).toEqual([])
  })

  it("adds a slot to disabledSlotsRemove when the toggle is explicitly on", () => {
    const out = deriveOverridesFromForm({ guestbook_expose: "예" })
    expect(out.disabledSlotsRemove).toEqual(["guestbook"])
    expect(out.disabledSlotsAdd).toEqual([])
  })

  it("treats both 아니오 and 아니요 spellings as off (show_direction uses 아니요)", () => {
    const out = deriveOverridesFromForm({ show_direction: "아니요" })
    expect(out.disabledSlotsAdd).toEqual(["map"])
  })

  it("ignores untouched (absent) toggles entirely", () => {
    const out = deriveOverridesFromForm({})
    expect(out.disabledSlotsAdd).toEqual([])
    expect(out.disabledSlotsRemove).toEqual([])
    expect(out.blockPatches).toEqual({})
  })

  it("derives rsvp mealEnabled/shuttleEnabled and calendar ddayEnabled block patches", () => {
    const out = deriveOverridesFromForm({ rsvp_meal: "아니오", rsvp_shuttle: "예", show_dday: "아니오" })
    expect(out.blockPatches.rsvp).toEqual({ mealEnabled: false, shuttleEnabled: true })
    expect(out.blockPatches.calendar).toEqual({ ddayEnabled: false })
  })
})

describe("resolveBgmUrlFromSnapshot", () => {
  const snapshot = [
    { field_key: "groom_name" },
    { field_key: "bgm", options: { music_files: [{ name: "a.mp3", url: "https://example.com/a.mp3" }, { name: "b.mp3", url: "https://example.com/b.mp3" }] } },
  ]

  it("looks up the playable url for the chosen file name", () => {
    expect(resolveBgmUrlFromSnapshot(snapshot, "b.mp3")).toBe("https://example.com/b.mp3")
  })

  it("also works when options was stored as a JSON string", () => {
    const snapshotWithStringOptions = [
      { field_key: "bgm", options: JSON.stringify({ music_files: [{ name: "c.mp3", url: "https://example.com/c.mp3" }] }) },
    ]
    expect(resolveBgmUrlFromSnapshot(snapshotWithStringOptions, "c.mp3")).toBe("https://example.com/c.mp3")
  })

  it("returns null when nothing matches or inputs are missing", () => {
    expect(resolveBgmUrlFromSnapshot(snapshot, "missing.mp3")).toBeNull()
    expect(resolveBgmUrlFromSnapshot(snapshot, undefined)).toBeNull()
    expect(resolveBgmUrlFromSnapshot(null, "a.mp3")).toBeNull()
    expect(resolveBgmUrlFromSnapshot([{ field_key: "not_bgm" }], "a.mp3")).toBeNull()
  })
})

describe('base64 원본 걸러내기', () => {
  // 실제로 form_submissions 한 행의 kakao_share_img 가 20MB base64 였다. 초안 생성이
  // 그 값을 content_data 와 og_meta 양쪽에 복사해 40MB PATCH 를 만들었고, 요청이
  // 끝나지 않다가 "Failed to fetch" 로 죽었다.
  const bigDataUri = 'data:image/jpeg;base64,' + 'A'.repeat(2000)

  it('content_data 로 옮길 때 data URI 값을 버린다', () => {
    const out = buildContentDataFromForm({
      kakao_share_img: bigDataUri,
      main_image: 'https://cdn.example.com/main.jpg',
      groom_name: '김민준',
    })
    expect('kakao_share_img' in out).toBe(false)
    expect(out.main_image).toBe('https://cdn.example.com/main.jpg')
    expect(out.groom_name).toBe('김민준')
  })

  it('배열 안에 섞인 data URI 도 걸러내고 나머지는 남긴다', () => {
    const out = buildContentDataFromForm({
      gallery_images: ['https://cdn.example.com/a.jpg', bigDataUri, 'https://cdn.example.com/b.jpg'],
    })
    expect(out.gallery_images).toEqual(['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'])
  })

  it('og_meta 에도 data URI 를 넣지 않는다', () => {
    const meta = deriveOgMetaFromForm({ kakao_share_title: '제목', kakao_share_img: bigDataUri })
    expect(meta).toEqual({ title: '제목' })
  })

  it('정상 URL 은 그대로 통과시킨다', () => {
    const meta = deriveOgMetaFromForm({ kakao_share_img: 'https://cdn.example.com/k.jpg' })
    expect(meta).toEqual({ image: 'https://cdn.example.com/k.jpg' })
  })
})
