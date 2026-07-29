# 청첩장 세부 디자인 편집 기능 — 작업 계획서

작성일: 2026-07-28 · 대상 브랜치: `beta` · 대상 화면: `/admin/invitations/editor/[id]`

목표: 청첩장 커스터마이즈 화면에서 **타이포그래피(폰트·크기), 블럭별 여백, 블럭 타이틀**을
슬라이더 중심의 간단한 UI로 편집한다. 현재의 미니멀한 카드 톤을 유지한다.

---

## 0. 결론 요약

**의미론적 토큰(semantic token) + `data-block` 계약**의 하이브리드로 간다.

- 전역 타이포그래피/여백은 **역할 기반 토큰**(`--text-title`, `--section-py` 등)으로 노출.
  기존 색/폰트 토큰이 쓰는 파이프라인(`customization_overrides` → CSS 변수 주입)을 그대로 탄다.
- 블럭별 여백·타이틀은 `[data-block]` 스코프 CSS 주입으로 처리. 계약이 **테마 클래스명이 아니라
  블럭 키**라서 테마 재시드/리디자인에 안전하다.
- 편집기는 **내용 / 디자인 2탭**으로 나누고, 블럭 관련 설정(표시여부·여백·타이틀)을
  **블럭 단위 아코디언 하나로 통합**한다. 컨트롤이 늘어나는데도 화면이 오히려 단순해진다.

**구조 통일 결론(§3)**: 3개 테마는 이미 **섹션 구성·순서·슬롯이 100% 동일**하다.
클래스명만 다르다. → **클래스명 리네이밍은 하지 않는다.** `data-block` 속성만 얹으면
구조 통일의 실익이 전부 확보되고, 리스크는 0에 수렴한다.

핵심 판단: **자유도를 "임의의 CSS"가 아니라 "잘 고른 토큰 세트"로 산다.** 근거는 §2.

---

## 1. 현재 구조 실측 (2026-07-28, 코드 직접 확인)

| 항목 | 실측 결과 |
|---|---|
| 토큰 주입 경로 | `themes.styles` + `customization_overrides['--*']` → `buildInvitationTokens()` → iframe `<html>`에 `style.setProperty`. **리로드 없이 실시간 반영** |
| 실제 CSS가 쓰는 토큰 | `--accent`, `--bg`, `--ink`, `--font-kr`, `--font-en` **5개뿐** (3개 테마 공통) |
| 선언됐지만 미사용 | `--accent-2`, `--ink-2` — `TOKEN_FIELDS`엔 있는데 어떤 테마 CSS도 참조하지 않음 |
| 하드코딩 `font-size` | serif-pink 23곳 / romantic-film 22곳 / color-atelier 17곳 (합계 62곳) |
| 테마 HTML/CSS 총량 | HTML 422줄 + CSS 1,196줄 = 1,618줄 |
| 클래스 prefix | `se-` / `sb-` / `ca-` — 테마마다 다름 |
| 섹션 기본 여백 | **3개 테마 모두 `padding: 64px 24px; text-align: center`** — 값까지 동일 |
| 블럭 타이틀 | `<h4 …__subtitle>GALLERY</h4>` + `<h3 …__title>갤러리</h3>` — **HTML에 하드코딩된 텍스트** |
| `[data-field]` 바인딩 | `if (value == null) return` — **값이 없으면 템플릿 기본값을 그대로 둔다** |
| `customization_overrides` | `--*`(토큰) + `disabled_slots`(string[]) 이 공존하는 이중 용도 jsonb |
| UI 프리미티브 | `slider.tsx`, `accordion.tsx`, `tabs.tsx` 모두 이미 있음 |

### 1.1 이번 조사에서 새로 확인한 사실 (이전 판단 정정)

1. **color-atelier에도 섹션 타이틀이 있다.** 클래스명이 `ca-section__header-sub` /
   `ca-section__header-title`로 다를 뿐, `se-`/`sb-`의 `__subtitle`/`__title`과 역할·
   여백값(`margin-top:4px; margin-bottom:32px`)까지 같다.
   → "color-atelier는 타이틀이 없어서 예외 처리 필요"라는 전제는 **사실이 아니다.**
2. **타이틀이 실제로 없는 곳은 serif-pink의 캘린더 섹션 하나뿐이다.**
   (`se-section__subtitle--pink`만 있고 `__title`이 없음) → 블럭 매니페스트가
   필요한 이유는 "테마 단위 예외"가 아니라 **"블럭 단위 예외 1건"** 이다.

### 1.2 조사 중 발견한 기존 결함 (이 작업이 부수적으로 고침)

`disabled_slots`로 기능을 끄면 **React 아일랜드만 마운트되지 않고, 섹션 껍데기는 그대로 남는다.**
`activeSlots` 필터가 `buildSlots()` 입력에만 걸리고 DOM에는 손대지 않기 때문이다
(`template-invitation-client.tsx:49`, `customize-client.tsx:323`).

즉 지금 "갤러리 끄기"를 하면 발행 청첩장에 **`GALLERY / 갤러리` 제목만 있고 내용이 빈 섹션**이
남는다. `[data-block]`이 붙으면 `[data-block="gallery"]{display:none}` 한 줄로 해결된다.
→ **§6-3단계에 포함.** 별도 과제로 빼지 않는다.

> ⚠️ `THEME_TOKEN_GUIDE.md`는 `colors`/`typography`/`spacing` 중첩 JSON 스키마를 명세하는데,
> 실제 구현(`buildThemeTokens`)은 `--` 접두 평면 키 또는 레거시 키만 읽는다. **문서가 구현과 다르다.**
> 이번 작업에서 같이 갱신하지 않으면 계속 오해를 만든다.

---

## 2. 접근 방식 비교 — 왜 하이브리드인가

### A안. 의미론적 토큰만 확장
테마 CSS를 전부 `var()`로 바꾸고 토큰 세트를 넓힌다.

- ✅ 기존 파이프라인 그대로. 실시간 미리보기 공짜. 편집기가 테마를 몰라도 된다
- ✅ 테마가 바뀌어도 오버라이드가 안 깨진다 (토큰명이 계약)
- ❌ **블럭별 여백·타이틀을 표현할 수 없다** — 전역 토큰은 "갤러리만 여백 좁게"를 못 한다

### B안. 요소 인스펙터 (미리보기에서 클릭 → CSS 오버라이드)

- ✅ 자유도 최대
- ❌ **선택자가 테마 클래스명에 묶인다.** 재시드 때마다 고객별 오버라이드가 조용히 깨진다.
  prefix가 제각각(`se-`/`sb-`/`ca-`)이라 더 취약하다
- ❌ 관리자가 임의 CSS를 만들면 **하객이 보는 화면이 깨져도 아무도 모른다**
- ❌ "미니멀·간편"과 정면 충돌. 인스펙터는 본질적으로 개발자 도구다

### C안. 하이브리드 — **채택**
전역은 토큰(A), 블럭 단위는 `data-block` 스코프 주입.

- ✅ A의 안정성 + 블럭 단위 제어
- ✅ 계약이 **클래스명이 아니라 `data-block` 키** → 테마 재시드/리디자인에 안전
- ✅ 테마가 선언한 블럭만 UI에 뜬다 → 편집기가 테마별 분기 없이 하나로 유지
- ⚠️ 테마 CSS 토큰화 선행 작업 필요 (1회성, 기계적)

**자유도에 대한 판단**: 자유도를 "무엇이든 바꿀 수 있음"이 아니라 **"바꿀 만한 것을 안전하게 다
바꿀 수 있음"**으로 정의한다. 실제로 요청받는 조정(글자 크기, 여백, 제목 문구, 색)은 토큰 세트로
95% 이상 커버된다. 나머지 5%는 테마를 새로 뜨는 게 맞다 — 그게 이 제품의 판매 단위이기도 하다.

---

## 3. 테마 구조 통일 — 가능성 검토 (요청 사항)

### 3.1 실측: 이미 통일되어 있다

3개 테마의 `template.html`을 나란히 비교한 결과다.

| 비교 항목 | serif-pink | romantic-film | color-atelier | 판정 |
|---|---|---|---|---|
| 섹션 개수·순서 | hero→greeting→gallery→order→calendar→location→account→contact→rsvp→share→bgm | 동일 | 동일 | ✅ **완전 일치** |
| `slot_manifest` | 9개 | 9개 | 9개 | ✅ **파일 내용까지 바이트 동일** |
| `data-slot` 위치 | 각 섹션 말미 | 동일 | 동일 | ✅ 일치 |
| 섹션 기본 여백 | `64px 24px` | `64px 24px` | `64px 24px` | ✅ 값까지 일치 |
| 섹션 정렬 | `center` | `center` | `center` | ✅ 일치 |
| 타이틀 구조 | `h4`+`h3` | `h4`+`h3` | `h4`+`h3` | ✅ 일치 |
| 타이틀 여백 | `4px / 32px` | `4px / 32px` | `4px / 32px` | ✅ 일치 |
| location 카드 | `__name`/`__address` | 동일 | 동일 | ✅ 일치 |
| share 섹션 | `style="padding-top:0"` | 동일 | 동일 | ✅ (문제도 일치, §3.3) |

**차이는 4가지뿐이다.**

| # | 차이 | 내용 |
|---|---|---|
| D1 | 클래스 prefix | `se-` / `sb-` / `ca-` |
| D2 | 타이틀 클래스명 | `__subtitle`·`__title` (se,sb) ↔ `__header-sub`·`__header-title` (ca) |
| D3 | hero·greeting의 소속 | se·sb는 `.X-section` 밖의 독립 클래스 / ca는 `.ca-section--dark\|--light` 안 |
| D4 | greeting 여백 | se `0 0 64px` (상단 사선 바 디자인) / sb `64px 24px` / ca `80px 24px` |

세 테마는 **같은 뼈대에 다른 껍데기를 씌운 것**이다. 서로 다른 사람이 만든 게 아니라
같은 골격에서 파생됐다는 뜻이고, 통일 작업의 난도를 결정적으로 낮춘다.

### 3.2 결론: 클래스명은 통일하지 않는다. 통일할 것은 "계약"이다

리네이밍(`se-section` → `vs-section`)을 실제로 하면:

- CSS 1,196줄 + HTML 422줄 전수 치환 → 오타 1개가 렌더 깨짐으로 직결
- 디자이너가 이후 테마를 만들 때 **prefix 네임스페이스가 사라져** 테마 간 클래스 충돌 위험
  (지금은 iframe 격리 + prefix 이중 방어)
- **얻는 게 없다.** 편집기는 클래스명을 읽지 않는다. 읽을 필요도 없어야 한다 (§2 B안)

대신 **속성 계약 한 겹**을 얹는다. 이게 실질적 통일이다.

```html
<!-- 세 테마 모두, 클래스는 그대로 두고 속성만 추가 -->
<section class="se-section se-gallery-section" data-block="gallery">
  <h4 class="se-section__subtitle" data-block-label>GALLERY</h4>
  <h3 class="se-section__title"    data-block-title>갤러리</h3>
  <div data-slot="gallery"></div>
</section>

<section class="ca-section ca-section--dark ca-gallery-section" data-block="gallery">
  <h4 class="ca-section__header-sub"   data-block-label>GALLERY</h4>
  <h3 class="ca-section__header-title" data-block-title>갤러리</h3>
  <div data-slot="gallery"></div>
</section>
```

`data-slot`·`data-field`가 이미 검증한 패턴이다. **D1·D2·D3가 한 번에 무의미해진다** —
편집기는 `[data-block="gallery"]`만 알면 되고, 그게 `.se-section`이든 `.ca-section--dark`든
상관하지 않는다.

**작업량 실측**: 섹션 11 × 테마 3 = `data-block` 33개 + 타이틀 마커 약 52개 = **85개 속성 추가.**
CSS는 한 줄도 건드리지 않는다. 렌더 결과가 바뀔 수 없는 변경이다(속성 셀렉터를 쓰는 CSS가 없으므로).

### 3.3 통일 과정에서 반드시 같이 처리할 것

**share 섹션의 인라인 스타일** — 3개 테마 모두 `style="padding-top: 0;"`.
인라인 스타일은 주입 CSS를 무조건 이긴다. 블럭 여백 슬라이더가 share에서만 안 먹는
버그가 된다. → 클래스(`.X-share-section { padding-top: 0; }`)로 옮긴다. **3줄 수정.**

### 3.4 통일하지 않을 것 (의도적)

| 항목 | 이유 |
|---|---|
| D4 (greeting 여백 차이) | serif-pink의 `padding-top:0`은 사선 바 디자인의 전제. 통일하면 디자인이 깨진다. → `block_manifest`에서 이 블럭의 여백 컨트롤을 `false`로 선언 |
| D3 (hero/greeting 소속) | color-atelier의 dark/light 교차는 이 테마의 정체성. `data-block`이 있으면 차이가 드러날 일이 없다 |
| CSS 파일 구조·주석 | 테마별 저자 스타일. 통일 이득 없음 |

### 3.5 향후 신규 테마를 위한 안전장치

구조가 통일되어 있다는 사실은 **강제되지 않으면 다음 테마에서 깨진다.**
`scripts/check-theme-contract.mjs`를 추가한다 — `scripts/themes/*/template.html`을 파싱해:

- `slot_manifest`의 모든 슬롯에 대응하는 `data-slot`이 있는가
- `block_manifest`의 모든 블럭에 대응하는 `data-block`이 있는가
- `title: true`인 블럭에 `data-block-title`이 있는가
- `<section>`에 인라인 `style`이 없는가 (§3.3 재발 방지)

시드 스크립트가 이 검사를 통과해야만 upsert하도록 건다. **약 60줄.**
계획 전체에서 가장 저렴하면서 가장 오래 가는 투자다.

---

## 4. 토큰 계약 (Token Contract)

### 4.1 타이포그래피 — 역할 기반 5단계

62개의 흩어진 `font-size`를 역할로 묶는다. 슬라이더 62개는 불가능하지만 5개는 가능하다.

| 토큰 | 역할 | 기본값(serif-pink) | 슬라이더 범위 |
|---|---|---|---|
| `--text-display` | 히어로 대표 문구 / 신랑·신부 이름 | 25px | 16–48 |
| `--text-title` | 섹션 제목 (갤러리, 식순…) | 18px | 12–32 |
| `--text-label` | 섹션 영문 소제목 (GALLERY) | 18px | 10–24 |
| `--text-body` | 인사말·본문 | 15px | 12–22 |
| `--text-caption` | 날짜·주석 등 작은 글씨 | 13px | 10–18 |

폰트는 기존 `--font-kr` / `--font-en` 유지 (이미 에셋 폰트 연동됨).

### 4.2 레이아웃

| 토큰 | 역할 | 기본값 | 범위 |
|---|---|---|---|
| `--section-py` | 섹션 세로 여백 | 64px | 16–120 |
| `--section-px` | 섹션 가로 여백 | 24px | 8–48 |
| `--content-gap` | 요소 간 기본 간격 | 32px | 8–64 |
| `--radius` | 모서리 곡률 | 8px | 0–24 |

### 4.3 규칙

- 모든 토큰은 **CSS에서 항상 폴백 동반**: `padding: var(--section-py, 64px) var(--section-px, 24px);`
  → 토큰을 모르는 구버전 테마도 그대로 렌더된다 (**하위호환 필수 조건**)
- 토큰은 **선택적**. 테마가 안 써도 되고, 안 쓰면 편집기에서 해당 슬라이더를 숨긴다(§6.3)
- 값은 **숫자만 저장**하고 단위는 렌더러가 붙인다 (`{"--section-py": 48}` → `48px`).
  슬라이더 바인딩이 단순해지고, 잘못된 문자열이 들어갈 여지가 없어진다
  → `TOKEN_FIELDS`에 `type: "size"`를 추가하고, 주입 시점(`InvitationFrame`의 토큰 `useEffect`)에서
    `typeof value === "number" ? `${value}px` : value` 로 정규화

---

## 5. 블럭 모델

### 5.1 블럭 키 (테마 독립)

`hero / greeting / gallery / sequence / calendar / location / account / contact / rsvp / share`
— 기존 슬롯 키와 정렬시킨다. 테마가 바뀌어도 같은 키를 쓰므로 고객 오버라이드가 살아남는다.
(`hero`·`greeting`은 슬롯이 없는 블럭 — 블럭 키가 슬롯 키의 상위집합이다.)

### 5.2 `themes.block_manifest` (신규 컬럼, jsonb)

```json
[
  { "key": "hero",     "label": "표지",          "title": false, "padding": false },
  { "key": "greeting", "label": "인사말",         "title": false, "padding": true  },
  { "key": "gallery",  "label": "갤러리",         "title": true,  "padding": true  },
  { "key": "calendar", "label": "캘린더 · D-day", "title": false, "padding": true  },
  { "key": "account",  "label": "마음 전하실 곳",  "title": true,  "padding": true  }
]
```

`slot_manifest`와 동일한 역할 — **"이 테마가 무엇을 지원하는가"**의 선언.
§1.1에서 확인했듯 실제 예외는 serif-pink의 `calendar`(타이틀 없음)와
serif-pink의 `greeting`(여백 고정, §3.4) **2건뿐**이다. 나머지는 세 테마가 같은 매니페스트를 쓴다.

### 5.3 저장 형식

`customization_overrides`의 이중 용도 관례를 그대로 따른다.

```json
{
  "--accent": "#D76C6C",
  "--text-title": 20,
  "--section-py": 48,
  "disabled_slots": ["rsvp"],
  "blocks": {
    "gallery": { "py": 32, "title": "우리의 순간", "label": "OUR MOMENTS" }
  }
}
```

> ⚠️ **함정**: `save()`의 "알 수 없는 오버라이드 키 보존" 루프(`customize-client.tsx:362`)에
> `k !== "blocks"`를 반드시 추가해야 한다. 지금 조건은 `!k.startsWith("--") && k !== "disabled_slots"`
> 뿐이라, 그대로 두면 `blocks`가 보존 대상으로 잡혀 **저장할 때마다 옛 값이 되살아난다.**
> `disabled_slots` 때 겪은 실수의 반복이다.

### 5.4 렌더러 처리

iframe `<head>`에 `<style id="vs-block-overrides">` 하나를 만들고, 블럭 규칙을 통째로 재생성한다.
토큰과 같이 `useEffect`로 갱신 → 실시간 미리보기 유지.

```css
[data-block="gallery"] { padding-top: 32px; padding-bottom: 32px; }
[data-block="rsvp"]    { display: none; }        /* §1.2 결함 수정 */
```

- **특정도**: `[data-block="x"]`(0,1,0)는 `.se-section`(0,1,0)과 동률이지만, 이 `<style>`이
  테마 `<style>`보다 **뒤에 삽입**되므로 순서로 이긴다. 인라인 스타일만 예외 → §3.3에서 제거함
- **타이틀**: `[data-block-title]` / `[data-block-label]`에 값을 꽂되 **빈 문자열은 건너뛴다.**
  `[data-field]` 바인딩이 `value == null`이면 기본값을 남기는 것과 같은 규칙 — 검증된 동작을 그대로 재사용

---

## 6. 편집기 UI

### 6.1 문제

현재 편집기는 카드 12개가 세로로 늘어선 1열 구조다. 여기에 타이포 슬라이더 5개 + 블럭 10개 ×
컨트롤 3개를 그냥 추가하면 **카드가 20개를 넘어가며 미니멀함이 무너진다.**

### 6.2 구조 — 내용 / 디자인 2탭

편집기 컬럼 최상단에 `Tabs`를 둔다. 미리보기는 지금처럼 오른쪽에 고정되어 **탭을 바꿔도 계속 보인다.**

```
┌─ 내용 ─┬─ 디자인 ─┐
│
│  [내용]   예식 일시·장소 / 신랑·신부 / 인사말 / 사진 / 갤러리 /
│           식순 / 계좌 / 연락처 / 배경음악        ← 기존 카드 그대로 이동
│
│  [디자인] 테마
│           색상          ← 기존 "디자인 토큰"에서 색만 분리
│           타이포그래피   ← 폰트 2 + 크기 슬라이더 5
│           여백          ← 전역 여백 슬라이더 3
│           블럭          ← 아코디언 (§6.4)
└
```

관리자의 실제 작업 흐름과 일치한다 — 내용을 채우는 단계와 디자인을 다듬는 단계는 분리돼 있다.
"테마" 카드는 디자인 탭 최상단으로 옮긴다(테마 변경이 나머지 디자인 설정을 리셋하므로 순서상 앞).

### 6.3 슬라이더 컨트롤 규격

```
섹션 제목 크기                            18px  [기본값]
─────────●──────────────────────
```

- **좌: 라벨 / 우: 현재값 + 상태 배지.** 오버라이드가 없으면 값은 muted로 표시하고
  배지를 "테마 기본값"으로 → 무엇이 커스텀인지 한눈에 보인다
- 값이 설정된 항목에만 되돌리기(X) 노출 — **기존 색상 토큰 UI 규칙을 그대로 계승**
- **테마가 해당 토큰을 CSS에서 안 쓰면 슬라이더를 렌더하지 않는다.** 판정 기준은
  `template_css`에 `var(--text-title` 문자열이 있는지 (빌드 타임이 아니라 런타임 문자열 검사 —
  테마 CSS가 DB에 있으므로 이게 가장 단순하고 정확하다).
  아무 효과 없는 슬라이더는 기능이 아니라 버그로 인식된다
- 슬라이더 조작 중에는 `onValueChange`로 미리보기만 갱신하고, 저장은 기존 저장 버튼에 맡긴다
  (지금 구조 그대로 — 별도 디바운스 불필요. CSS 변수 세팅은 리렌더가 아니다)

### 6.4 블럭 아코디언 — 기존 "기능 켜기·끄기" 흡수

지금 별도 카드인 "기능 켜기·끄기"(체크박스 9개)를 **블럭 행에 통합한다.**
블럭 하나당 한 줄, 펼치면 그 블럭의 모든 설정이 나온다.

```
블럭
┌──────────────────────────────────────┐
│  갤러리                       [표시 ●] ▾│
│  식순                         [표시 ●] ▾│
│  마음 전하실 곳                [표시 ○] ▾│   ← 끈 블럭은 흐리게
└──────────────────────────────────────┘
      ▾ 펼쳤을 때
      제목        [갤러리          ]  (비우면 테마 기본값)
      영문 제목   [GALLERY         ]
      위아래 여백  ────●──────  64px [기본값]
```

**개념이 늘지 않고 오히려 줄어든다** — "기능"과 "블럭"이라는 두 개념이 하나로 합쳐진다.
`disabled_slots`는 데이터 형식 그대로 두고 UI만 이 아코디언이 읽고 쓴다 (마이그레이션 불필요).

### 6.5 블럭 ↔ 미리보기 연동 (사용 편의성의 핵심)

아코디언을 펼치면 **미리보기 iframe이 해당 블럭으로 스크롤**한다.

```ts
doc.querySelector(`[data-block="${key}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" })
```

`InvitationFrame`에 `focusBlock?: string` prop 하나를 추가하면 끝이다(약 10줄).
블럭 10개짜리 아코디언에서 이게 없으면 관리자는 "지금 뭘 만지는지" 모른 채 슬라이더를 움직이게 된다.
**`data-block` 계약이 있어서 공짜로 얻어지는 기능**이고, 통일 작업의 실질적 배당금이다.

### 6.6 하지 않을 것

- **블럭 순서 드래그** — `block_order` 컬럼이 있지만 현 렌더러는 템플릿 HTML 순서를 따른다.
  UI에 넣으려면 렌더러가 DOM을 재배치해야 하고, 테마 디자인(color-atelier의 dark/light 교차 등)이
  깨진다. 별도 과제로 분리
- **블럭별 색상** — 전역 색 토큰으로 충분하고, 블럭마다 색이 달라지면 테마 완성도가 무너진다
- **자유 CSS 입력란** — §2 B안 참조
- **클래스명 리네이밍** — §3.2

---

## 7. 실행 순서

각 단계는 독립 배포 가능하고, 앞 단계가 끝나야 다음이 의미를 가진다.

### 1단계 — 계약 정의 (렌더 영향 없음)
- `lib/theme-template.ts`: `TOKEN_FIELDS`에 `type: "size"` 토큰 추가, `BLOCK_KEYS` 상수 정의
- `THEME_TOKEN_GUIDE.md`를 실제 구현에 맞게 다시 씀(§1 경고 해소) + 블럭 계약 문서화
- `scripts/check-theme-contract.mjs` 작성 (§3.5)

### 2단계 — 테마 구조 통일 + 토큰화 (기계적)
- **2a.** 3개 테마 `template.html`에 `data-block` / `data-block-title` / `data-block-label` 부착
  (약 85개 속성). share 섹션 인라인 스타일 제거(§3.3). **CSS 무변경 → 렌더 결과 불변**
- **2b.** 3개 테마 `template.css`의 `font-size` / `padding`을 `var(--토큰, 원래값)`으로 치환
- **2c.** `block_manifest.json` 3개 작성 → `seed-theme.mjs` 확장(계약 검사 통과 시에만 upsert) → 재시드
- **검증**: 오버라이드가 하나도 없는 상태에서 3개 테마 렌더 결과가 이전과 **픽셀 동일**해야 한다.
  폴백이 제대로 걸렸다는 증거이자, 기존 발행 청첩장이 안 깨진다는 보증
- ⚠️ 원본은 `scripts/themes/`뿐. 디자이너용 미러 폴더가 있다면 stale이다

### 3단계 — 렌더러 지원
- `themes` 테이블 `block_manifest` 컬럼 마이그레이션
- `invitation-frame.tsx`:
  - 숫자 토큰에 `px` 부착
  - `[data-block]` 스코프 `<style id="vs-block-overrides">` 주입 (여백 + `display:none`)
  - `[data-block-title]`/`[data-block-label]` 바인딩 (빈 값 건너뛰기)
  - `focusBlock` prop (§6.5)
- `lib/theme-template.ts`: `extractBlockOverrides()`, `getBlockManifest()` 추가
  (`extractDisabledSlots` 패턴 그대로)
- `app/w/[slug]/template-invitation-client.tsx`: 블럭 오버라이드를 발행 경로에도 전달
  (**빠뜨리면 "미리보기 = 발행" 원칙이 깨진다** — 여기가 이 단계의 유일한 실수 지점)
- **부수 수정**: 꺼진 슬롯의 빈 섹션이 사라진다 (§1.2)

### 4단계 — 편집기 UI
- 내용/디자인 탭 분리 (기존 카드는 이동만, 로직 변경 없음)
- 타이포그래피·여백 카드 (슬라이더 8 + 폰트 2)
- 블럭 아코디언 (기존 "기능 켜기·끄기" 카드 대체) + 미리보기 스크롤 연동
- `save()`에 `blocks` 키 보존 예외 추가 (§5.3 함정)

### 5단계 — 마무리
- 반응형 확인 (xl 미만 1열에서 슬라이더가 눌리지 않는지)
- 기존 발행 청첩장 전수 육안 확인
- 메모리/문서 갱신

---

## 8. 리스크와 대응

| 리스크 | 대응 |
|---|---|
| 테마 토큰화로 기존 발행 청첩장 렌더가 변함 | 2단계를 2a(속성만)/2b(CSS)로 쪼개고 각각 "픽셀 동일" 검증. 모든 `var()`에 원래 값 폴백 |
| 테마 재시드 시 고객 오버라이드 유실 | 오버라이드 키가 클래스명이 아니라 토큰명/블럭키 → 재시드와 무관 |
| 블럭 여백이 share에서만 안 먹음 | §3.3 인라인 스타일 제거를 2a에 포함 |
| 슬라이더가 아무 효과 없어 보임 | 테마 CSS가 실제 참조하는 토큰만 렌더 (§6.3) |
| 관리자가 값을 극단으로 밀어 디자인이 깨짐 | 슬라이더 min/max로 물리적 차단. 자유 입력란 없음 |
| `blocks` 키가 저장 때마다 되살아남 | §5.3 — 보존 루프 예외 처리 |
| 발행 경로에만 블럭 오버라이드가 빠짐 | 3단계 체크리스트에 명시. 편집기/발행 양쪽 육안 대조 |
| 다음 테마가 계약을 안 지킴 | §3.5 계약 검사 스크립트를 시드 전제조건으로 |
| 편집기가 더 복잡해짐 | 탭 분리 + 블럭 통합으로 **화면당 카드 수는 오히려 감소** |

---

## 9. 확인이 필요한 결정

| # | 결정 | 선택지 | 제안 |
|---|---|---|---|
| 1 | 글자 크기 조작 | (a) 역할별 5개 슬라이더 (b) 전체 배율 1개 | **(a)** — (b)는 간단하지만 "제목만 키우기"가 안 된다. 필요하면 나중에 (b)를 (a) 위에 얹을 수 있다 |
| 2 | 블럭 여백 | (a) 위아래 하나로 (b) 위/아래 분리 | **(a)** — 분리하면 컨트롤이 2배인데 실제 요청은 대부분 "이 블럭 좀 좁게" |
| 3 | 탭 분리 | (a) 내용/디자인 2탭 (b) 탭 없이 접이식 | **(a)** |
| 4 | 적용 범위 | (a) 3개 테마 동시 (b) serif-pink 파일럿 후 확산 | **(b)** — 1개로 전 과정을 검증한 뒤 나머지 2개는 반복 작업. 구조가 동일하므로(§3.1) 2·3번째는 훨씬 빠르다 |
| 5 | 클래스명 통일 | (a) 안 함, `data-block`만 (b) `vs-` prefix로 리네이밍 | **(a)** — §3.2 |

---

## 10. 예상 작업량

| 단계 | 규모 | 비고 |
|---|---|---|
| 1. 계약 정의 | 소 | 상수 + 문서 + 검사 스크립트 ~60줄 |
| 2a. 구조 통일 | 소 | 속성 85개 부착 + 인라인 스타일 3줄. 기계적, 렌더 불변 |
| 2b. 토큰화 | 중 | CSS 1,196줄에서 `font-size` 62 / `padding` 다수 훑기. 파일럿 1개 후 가속 |
| 2c. 매니페스트·시드 | 소 | JSON 3개 + 시드 스크립트 확장 |
| 3. 렌더러 | 소~중 | 기존 토큰 주입 로직에 유사 패턴 추가 (+발행 경로 배선) |
| 4. 편집기 UI | 중 | 탭 분리(이동 위주) + 신규 카드 3개 |
| 5. 검증 | 소~중 | 발행 청첩장 전수 + 반응형 |

---

## 부록. 이 계획이 지키는 기존 원칙

- **미리보기 = 발행**: 편집기와 `/w/[slug]`가 같은 `InvitationFrame`을 쓰는 구조를 깨지 않는다
- **테마가 지원 범위를 선언한다**: `slot_manifest` → `block_manifest`로 같은 패턴 확장
- **오버라이드는 항상 선택적**: 비우면 테마 기본값. 색 토큰이 이미 쓰는 규칙
- **`customization_overrides` 이중 용도**: `--*`는 토큰, 그 외 키는 개별 설정
- **계약은 속성으로, 디자인은 클래스로**: `data-slot`/`data-field`가 검증한 분리를 `data-block`까지 확장
