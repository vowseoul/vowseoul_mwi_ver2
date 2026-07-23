"use client"

import { useState } from "react"
import {
  InvitationFrame,
  type FieldData,
  type ThemeTemplate,
  type TokenMap,
} from "@/components/invitation/invitation-frame"
import { buildSlots } from "@/components/invitation/slot-registry"
import { buildFieldData, type RawInvitationData } from "@/lib/invitation-data"

/* ------------------------------------------------------------------ *
 * 1) 샘플 데이터 — 오직 "필드키"로만 식별된다.
 *    두 테마가 완전히 다른 레이아웃이어도 이 키 계약은 동일하게 사용된다.
 * ------------------------------------------------------------------ */
const RAW_DATA: RawInvitationData = {
  groom_name: "김민준",
  bride_name: "이서연",
  groom_name_en: "Minjun",
  bride_name_en: "Seoyeon",
  wedding_date: "2027-05-07", // 원본 날짜(YYYY-MM-DD) → 어댑터가 en/display/weekday/dday 파생
  wedding_time: "낮 12시",
  venue_name: "그랜드 호텔 3F 그랜드볼룸",
  venue_address: "서울 강남구 테헤란로 501",
  greeting_message:
    "서로가 마주 보며 다져온 사랑을\n이제 함께 한 곳을 바라보며\n걸어갈 수 있는 큰 사랑으로 키우고자 합니다.\n귀한 걸음 하시어 축복해 주시면 감사하겠습니다.",
  main_image: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80",
  groom_photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
  bride_photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80",
  groom_father_name: "김정호",
  groom_mother_name: "박선영",
  bride_father_name: "이성재",
  bride_mother_name: "최미경",
  gallery_images: [
    "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80",
    "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&q=80",
    "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=600&q=80",
    "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&q=80",
  ],
  account_groom_bank: "카카오뱅크",
  account_groom_number: "3333-01-1234567",
  account_groom_holder: "김민준",
  account_bride_bank: "국민은행",
  account_bride_number: "123-45-6789012",
  account_bride_holder: "이서연",
}

/* ------------------------------------------------------------------ *
 * 2) 테마 템플릿 — 디자이너가 export한 HTML/CSS 라고 가정.
 *    slots: 이 테마가 사용하는 기능(인터랙션) 목록 = 미래 DB의 slot_manifest.
 *    [data-field] 데이터 자리 · [data-slot] 기능 자리 · var(--토큰) 에셋 설정 자리.
 * ------------------------------------------------------------------ */

const THEME_EDITORIAL: ThemeTemplate = {
  key: "editorial",
  name: "Editorial (에디토리얼 · 여백형)",
  slots: ["bgm", "gallery", "account", "rsvp", "guestbook"],
  css: `
    :root { --bg:#faf8f5; --ink:#2b2622; }
    .ed { font-family: 'Cormorant Garamond', 'Noto Serif KR', serif; background: var(--bg); color: var(--ink); padding: 56px 30px 48px; }
    .ed__en { font-family: 'Playfair Display', serif; font-style: italic; letter-spacing: .18em; font-size: 13px; color: var(--accent, #b08d57); text-transform: uppercase; }
    .ed__names { font-family: 'Playfair Display', serif; font-size: 40px; line-height: 1.15; margin: 18px 0 6px; }
    .ed__names small { display:block; font-size: 15px; letter-spacing:.3em; color: var(--accent,#b08d57); margin-bottom: 10px; }
    .ed__hero { margin: 30px 0; aspect-ratio: 3/4; overflow: hidden; }
    .ed__hero img { width:100%; height:100%; object-fit: cover; filter: grayscale(.15); }
    .ed__meta { border-top: 1px solid #ddd6cc; border-bottom:1px solid #ddd6cc; padding: 18px 0; margin: 24px 0; }
    .ed__meta p { font-size: 15px; letter-spacing:.04em; margin: 4px 0; }
    .ed__greet-title { font-family:'Noto Serif KR',serif; font-size: 18px; margin: 34px 0 14px; letter-spacing:.06em; }
    .ed__greet { font-family:'Noto Serif KR',serif; font-weight:300; font-size: 14.5px; line-height: 2.1; white-space: pre-line; color:#5a5148; }
    .ed__section { margin-top: 40px; }
    .ed__label { font-family:'Playfair Display',serif; font-style:italic; font-size:12px; letter-spacing:.15em; text-transform:uppercase; color: var(--accent,#b08d57); margin-bottom:14px; }
  `,
  html: `
    <div class="ed">
      <div class="ed__en" data-field="wedding_date_en">MAY 7 2026</div>
      <h1 class="ed__names">
        <small><span data-field="groom_name">신랑</span> &amp; <span data-field="bride_name">신부</span></small>
      </h1>
      <div class="ed__hero"><img data-field="main_image" alt="" /></div>
      <div class="ed__meta">
        <p data-field="wedding_date_display">2026. 05. 07</p>
        <p data-field="wedding_time_display">토요일 낮 12시</p>
        <p data-field="venue_name">그랜드 호텔</p>
      </div>
      <h2 class="ed__greet-title" data-field="greeting_title">저희 결혼합니다</h2>
      <p class="ed__greet" data-field="greeting_message"></p>
      <div class="ed__section"><div class="ed__label">Gallery</div><div data-slot="gallery"></div></div>
      <div class="ed__section" data-slot="account"></div>
      <div class="ed__section" data-slot="rsvp"></div>
      <div class="ed__section" data-slot="guestbook"></div>
      <div class="ed__section" data-slot="bgm"></div>
    </div>
  `,
}

const THEME_ROMANTIC: ThemeTemplate = {
  key: "romantic",
  name: "Romantic (로맨틱 · 카드형)",
  slots: ["bgm", "gallery", "account", "rsvp"],
  css: `
    :root { --bg:#fff; --ink:#4a3f3a; }
    .ro { font-family:'Gowun Batang','Noto Serif KR',serif; background:
      radial-gradient(120% 60% at 50% 0%, var(--accent-soft,#fbeef0) 0%, #ffffff 60%); padding: 44px 24px 44px; text-align:center; }
    .ro__card { border: 1px solid var(--accent,#d98a9e); border-radius: 20px; padding: 34px 22px; background: rgba(255,255,255,.7); backdrop-filter: blur(2px); }
    .ro__mark { font-family:'Playfair Display',serif; font-style:italic; color: var(--accent,#d98a9e); font-size: 15px; letter-spacing:.1em; }
    .ro__mark::before, .ro__mark::after { content:'✦'; margin: 0 8px; font-size:10px; vertical-align: middle; }
    .ro__hero { width: 150px; height: 150px; margin: 22px auto; border-radius: 50%; overflow:hidden; border: 3px solid var(--accent,#d98a9e); }
    .ro__hero img { width:100%; height:100%; object-fit: cover; }
    .ro__names { font-size: 27px; margin: 6px 0; color: var(--ink); }
    .ro__names span { color: var(--accent,#d98a9e); }
    .ro__date { font-family:'Playfair Display',serif; letter-spacing:.1em; font-size: 14px; color:#8a7a74; margin: 8px 0 2px; }
    .ro__meta { font-size: 14px; color:#7d716b; margin: 2px 0; }
    .ro__divider { width: 40px; height:1px; background: var(--accent,#d98a9e); margin: 22px auto; opacity:.6; }
    .ro__greet-title { font-size: 16px; margin-bottom: 12px; color: var(--accent,#d98a9e); }
    .ro__greet { font-size: 14px; line-height: 2; white-space: pre-line; color:#6b605a; }
    .ro__section { margin-top: 26px; }
  `,
  html: `
    <div class="ro">
      <div class="ro__card">
        <div class="ro__mark">We're getting married</div>
        <div class="ro__hero"><img data-field="main_image" alt="" /></div>
        <h1 class="ro__names"><span data-field="groom_name">신랑</span> ♥ <span data-field="bride_name">신부</span></h1>
        <p class="ro__date" data-field="wedding_date_display">2026. 05. 07</p>
        <p class="ro__meta" data-field="wedding_time_display">토요일 낮 12시</p>
        <p class="ro__meta" data-field="venue_name">그랜드 호텔</p>
        <div class="ro__divider"></div>
        <h2 class="ro__greet-title" data-field="greeting_title">저희 결혼합니다</h2>
        <p class="ro__greet" data-field="greeting_message"></p>
        <div class="ro__section" data-slot="gallery"></div>
        <div class="ro__section" data-slot="account"></div>
        <div class="ro__section" data-slot="rsvp"></div>
        <div class="ro__section" data-slot="bgm"></div>
      </div>
    </div>
  `,
}

// 실제 추출 테마(Serif Pink)는 DB가 단일 소스 → /preview/theme/[id] 에서 확인
const THEMES = [THEME_EDITORIAL, THEME_ROMANTIC]

/* ------------------------------------------------------------------ *
 * 3) Theme Lab 데모 페이지
 * ------------------------------------------------------------------ */
export default function ThemeLabPage() {
  const [themeIdx, setThemeIdx] = useState(0)
  const [accent, setAccent] = useState("#b08d57")
  const [groomName, setGroomName] = useState(RAW_DATA.groom_name as string)

  const template = THEMES[themeIdx]
  const raw: RawInvitationData = { ...RAW_DATA, groom_name: groomName }
  const data: FieldData = buildFieldData(raw) // 필드키 → 표시값(+파생) 변환
  const tokens: TokenMap = { "--accent": accent, "--accent-soft": accent + "22" }

  // 테마가 선언한 슬롯(기능)만 레지스트리에서 꺼내 마운트
  const slots = buildSlots(template.slots ?? [], { accent, data, raw })

  return (
    <div style={{ minHeight: "100vh", background: "#f1efec", padding: "28px 20px 60px", fontFamily: "'Noto Serif KR', serif" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#2b2622", marginBottom: 6 }}>
            Theme Lab — B(하이브리드) + iframe 구조 프로토타입
          </h1>
          <p style={{ fontSize: 14, color: "#6b625b", lineHeight: 1.6 }}>
            같은 데이터(필드키)를 서로 다른 테마 템플릿에 주입합니다. 테마는 필요한 기능(슬롯)만 선언하고,
            슬롯 레지스트리가 해당 React 인터랙션을 iframe 안에 자동 마운트합니다.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24, alignItems: "start" }}>
          {/* 컨트롤 패널 */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 16px rgba(0,0,0,.05)" }}>
            <label style={{ fontSize: 12, color: "#8a7f77", display: "block", marginBottom: 8 }}>테마 템플릿</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
              {THEMES.map((t, i) => (
                <button key={t.key} onClick={() => setThemeIdx(i)}
                  style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: 9, cursor: "pointer",
                    border: `1px solid ${themeIdx === i ? accent : "#e6e1da"}`,
                    background: themeIdx === i ? accent + "12" : "#fff", color: "#3a332e", fontSize: 13,
                  }}>
                  <div>{t.name}</div>
                  <div style={{ fontSize: 11, color: "#a49b93", marginTop: 3 }}>기능: {(t.slots ?? []).join(", ")}</div>
                </button>
              ))}
            </div>

            <label style={{ fontSize: 12, color: "#8a7f77", display: "block", marginBottom: 8 }}>포인트 색상 (--accent 토큰)</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
              {["#b08d57", "#d98a9e", "#6b8e7f", "#8a7dc4", "#c0563f"].map((c) => (
                <button key={c} onClick={() => setAccent(c)} aria-label={c}
                  style={{
                    width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
                    background: c, border: accent === c ? "3px solid #2b2622" : "2px solid #fff", boxShadow: "0 0 0 1px #ddd",
                  }} />
              ))}
            </div>

            <label style={{ fontSize: 12, color: "#8a7f77", display: "block", marginBottom: 8 }}>신랑 이름 (필드키: groom_name)</label>
            <input value={groomName} onChange={(e) => setGroomName(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e6e1da", outline: "none", fontSize: 14 }} />
            <p style={{ fontSize: 11.5, color: "#a49b93", marginTop: 8, lineHeight: 1.5 }}>
              입력하면 두 테마 모두에서 같은 위치에 실시간 반영됩니다 (배선 꼬임 불가능).
            </p>
          </div>

          {/* 프리뷰 */}
          <div style={{ display: "flex", justifyContent: "center", background: "#fff", borderRadius: 14, padding: "28px 0", boxShadow: "0 2px 16px rgba(0,0,0,.05)" }}>
            <InvitationFrame template={template} data={data} tokens={tokens} slots={slots} width={375} height={760} />
          </div>
        </div>
      </div>
    </div>
  )
}
