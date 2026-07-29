# VOW SEOUL 모바일 청첩장 테마 디자인 토큰 · 블럭 계약 가이드

이 문서는 VOW SEOUL 모바일 청첩장 플랫폼의 **테마(Theme)**를 디자인하고 등록할 때 지켜야 하는
**디자인 토큰(CSS 변수)** 과 **블럭 계약(`data-block`)** 의 실제 구현 규격을 설명한다.

> ⚠️ 이 문서의 이전 버전은 `{ colors, typography, spacing, border }` 형태의 중첩 JSON 스키마를
> 명세했지만, 실제 구현(`lib/theme-template.ts`)은 그런 구조를 읽지 않는다. 아래 내용이 코드와
> 일치하는 유일한 버전이다. (정정 이력: 2026-07-28, `PLAN_DESIGN_CONTROLS.md` 작업 중 발견)

---

## 1. 토큰은 평면 CSS 변수다

테마의 디자인 토큰은 중첩 JSON이 아니라 **`themes.styles` 컬럼(jsonb)에 저장된 평면 키-값**이다.
키는 CSS 커스텀 프로퍼티 이름(`--`로 시작)이고, 값은 테마의 **기본값**이다.

```json
{
  "--accent": "#D76C6C",
  "--bg": "#EFD0D0",
  "--ink": "#FFFFFF",
  "--font-kr": "'Noto Serif KR', serif",
  "--font-en": "'Playfair Display', serif"
}
```

이 값들은 `buildThemeTokens()` (`lib/theme-template.ts`) 가 그대로 읽어 `InvitationFrame` 이
iframe 루트에 `style.setProperty("--accent", "#D76C6C")` 형태로 주입한다. 청첩장 개별
오버라이드(`customization_overrides`)가 있으면 이 위에 덮어쓴다 — 우선순위는
**테마 기본값 < 청첩장 개별 오버라이드**.

레거시 테마(`primaryColor`/`fontKr` 등 카멜케이스 키)는 `LEGACY_STYLE_TO_TOKEN` 매핑을 통해
자동으로 위 CSS 변수명으로 변환된다. 신규 템플릿 테마는 처음부터 `--` 키로 저장한다.

### 1.1 색·폰트 토큰 (`TOKEN_FIELDS`)

편집기에 색상 피커/폰트 선택으로 노출되는 토큰. 값은 **문자열**(HEX 또는 font-family 스택)이다.

| 토큰 | 역할 | 실제 사용 |
|---|---|---|
| `--accent` | 포인트 색상 | 3개 테마 공통 |
| `--bg` | 배경색 | 3개 테마 공통 |
| `--ink` | 본문 텍스트 색 | 3개 테마 공통 |
| `--accent-2` | 보조 색상 | ⚠️ 선언만 되어 있고 어떤 테마 CSS도 참조하지 않음 |
| `--ink-2` | 보조 텍스트 색 | ⚠️ 위와 동일 |
| `--font-kr` | 한글 폰트 | 3개 테마 공통 |
| `--font-en` | 영문 폰트 | 3개 테마 공통 |

### 1.2 사이즈 토큰 (`SIZE_TOKEN_FIELDS`)

편집기에 **슬라이더**로 노출되는 토큰. 값은 **숫자**로 저장한다 (`{"--text-title": 20}`).
`extractOverrideTokens()` 가 저장 시점에 `20px` 문자열로 정규화하므로, 테마 CSS는 항상 일반
CSS 변수처럼 `var(--text-title, 18px)` 로 참조하면 된다.

| 토큰 | 역할 | 슬라이더 범위 |
|---|---|---|
| `--text-display` | 히어로 대표 문구 / 신랑·신부 이름 | 16–48px |
| `--text-title` | 섹션 제목 (갤러리, 식순…) | 12–32px |
| `--text-label` | 섹션 영문 소제목 (GALLERY) | 10–24px |
| `--text-body` | 인사말·본문 | 12–22px |
| `--text-caption` | 날짜·주석 등 작은 글씨 | 10–18px |
| `--section-py` | 섹션 세로 여백 | 16–120px |
| `--section-px` | 섹션 가로 여백 | 8–48px |
| `--content-gap` | 요소 간 기본 간격 | 8–64px |
| `--radius` | 모서리 곡률 | 0–24px |

**규칙**:
- CSS에서 항상 폴백을 동반한다: `font-size: var(--text-title, 18px);`
  → 폴백이 곧 그 테마의 "기본값"이다. 별도로 `themes.styles`에 기본값을 채울 필요가 없다
- 토큰은 선택적이다. 테마 CSS가 어떤 토큰을 안 쓰면, 편집기가 `template_css` 문자열에
  `var(--토큰명`이 있는지 검사해 해당 슬라이더를 자동으로 숨긴다
- 모든 요소를 토큰화하지 않는다. 예: 원형 아이콘의 `border-radius: 50%`나 장식용 2px 각짐은
  테마의 정체성이므로 `--radius`로 흡수하지 않고 하드코딩 유지 (판단 기준: "관리자가 이 값을
  바꾸는 게 자연스러운 요청인가")

---

## 2. 블럭 계약 (`data-block`)

색·폰트·전역 크기는 토큰으로 충분하지만, **"갤러리 섹션만 여백을 좁게"** 같은 블럭 단위 조정은
전역 토큰으로 표현할 수 없다. 이를 위해 `data-slot`/`data-field`와 같은 계층의 속성 계약을 쓴다.

```html
<section class="se-section se-gallery-section" data-block="gallery">
  <h4 class="se-section__subtitle" data-block-label>GALLERY</h4>
  <h3 class="se-section__title" data-block-title>갤러리</h3>
  <div data-slot="gallery"></div>
</section>
```

- **`data-block="키"`**: 이 섹션이 블럭 여백 오버라이드의 대상이 된다. 편집기가
  `[data-block="키"] { padding-top: ...; padding-bottom: ... }` 를 iframe에 주입한다
- **`data-block-title`**: 블럭 한글 제목 텍스트. 값이 없으면(빈 문자열) 템플릿 기본 텍스트를 유지한다
- **`data-block-label`**: 블럭 영문 소제목 텍스트. 위와 동일 규칙

### 2.1 블럭 키는 테마 독립적이다

```
hero, greeting, gallery, sequence, calendar, location, account, contact, rsvp, share
```

`slot_manifest`의 상위집합이다(`hero`/`greeting`은 슬롯이 없는 블럭). 테마가 바뀌어도 같은
키를 쓰므로, 청첩장 개별 오버라이드가 테마 재시드나 테마 변경에도 깨지지 않는다.
**클래스명(`se-`/`sb-`/`ca-` prefix)은 이 계약과 무관하다** — 편집기와 렌더러는 클래스명을
전혀 읽지 않는다. 새 테마를 만들 때 클래스 네이밍은 자유지만 `data-block`은 고정 키로 붙여야 한다.

### 2.2 `themes.block_manifest` — 테마가 지원 범위를 선언한다

```json
[
  { "key": "hero",     "label": "표지",          "title": false, "padding": false },
  { "key": "greeting", "label": "인사말",         "title": false, "padding": true  },
  { "key": "gallery",  "label": "갤러리",         "title": true,  "padding": true  },
  { "key": "calendar", "label": "캘린더 · D-day", "title": false, "padding": true  }
]
```

- `title: false` → 편집기가 이 블럭에 제목 입력란을 그리지 않는다 (그 블럭에
  `data-block-title` 마커가 없다는 뜻이므로 채워도 반영되지 않기 때문)
- `padding: false` → 여백 슬라이더를 숨긴다. 여백이 디자인상 고정이어야 하는 블럭에 쓴다
  (예: serif-pink의 `greeting`은 상단 사선 바 디자인 때문에 `padding-top:0`이 고정이어야 함)

### 2.3 인라인 스타일 금지

`<section style="padding-top: 0;">` 같은 인라인 스타일은 주입 CSS보다 항상 우선순위가 높아
그 섹션에서만 여백 오버라이드가 안 먹는 버그가 된다. 여백이 고정이어야 하면 클래스로 옮기고
(`.se-share-section { padding-top: 0; }`), 필요하면 `block_manifest`에서 `padding: false`로
선언한다.

### 2.4 계약 검사

`node scripts/check-theme-contract.mjs <테마키>` 로 다음을 검사한다:

1. `slot_manifest`의 모든 슬롯에 `data-slot`이 대응하는가
2. `block_manifest`의 모든 블럭에 `data-block`이 대응하는가
3. `title: true`인 블럭에 `data-block-title`이 있는가
4. `<section>`에 인라인 `style`이 없는가

`scripts/seed-theme.mjs`는 이 검사를 통과해야만 DB에 upsert한다.

---

## 3. 새 테마를 만들 때 체크리스트

1. `scripts/themes/<key>/template.html`, `template.css` 작성
2. `slot_manifest.json` — 이 테마가 지원하는 기능 키 배열
3. `field_manifest.json` — 이 테마가 참조하는 `[data-field]` 키 배열
4. `block_manifest.json` — 이 테마가 지원하는 블럭과 title/padding 편집 가능 여부
5. 각 섹션에 `data-block`(+ 필요 시 `data-block-title`/`data-block-label`) 부착
6. CSS의 `font-size`/`padding`을 가능한 한 `var(--토큰, 원래값)` 형태로 작성 (전부 필수는 아님 —
   관리자가 바꾸는 게 자연스러운 값만 토큰화한다)
7. `<section>`에 인라인 `style` 금지
8. `node scripts/check-theme-contract.mjs <key>` 통과 확인 후 `node scripts/seed-theme.mjs <key> "이름" <id>`

---

## 4. `themes` 테이블 관련 컬럼 요약

| 컬럼 | 형식 | 용도 |
|---|---|---|
| `template_html` | text | 섹션 마크업. `data-slot`/`data-field`/`data-block` 마커 포함 |
| `template_css` | text | 위 마크업에 대응하는 CSS. 토큰은 `var(--x, 폴백)` 형태 |
| `slot_manifest` | jsonb (string[]) | 이 테마가 지원하는 기능 슬롯 키 |
| `field_manifest` | jsonb (string[]) | 이 테마가 참조하는 필드키 (폼-테마 매핑 검증용) |
| `block_manifest` | jsonb (`BlockManifestEntry[]`) | 이 테마가 지원하는 블럭과 편집 가능 범위 |
| `styles` | jsonb | 색·폰트 토큰의 테마 기본값 (`--accent` 등) |

청첩장 단위 오버라이드는 전부 `invitations.customization_overrides`(jsonb) 하나에 공존한다:

```json
{
  "--accent": "#D76C6C",
  "--text-title": 20,
  "--section-py": 48,
  "disabled_slots": ["rsvp"],
  "blocks": { "gallery": { "py": 32, "title": "우리의 순간", "label": "OUR MOMENTS" } }
}
```

| 키 패턴 | 의미 | 값 타입 |
|---|---|---|
| `--*` | 색/폰트/사이즈 토큰 오버라이드 | 색·폰트는 문자열, 사이즈는 숫자 |
| `disabled_slots` | 이 청첩장에서 끈 기능 슬롯 목록 | `string[]` |
| `blocks` | 블럭별 여백/타이틀 오버라이드 | `Record<블럭키, {py?, title?, label?}>` |

새로운 최상위 키를 추가할 때는 편집기 `save()`의 "알 수 없는 오버라이드 키 보존" 루프에서
그 키를 제외 조건에 추가해야 한다 — 안 그러면 저장할 때마다 새 키가 옛 값으로 덮어써진다.
