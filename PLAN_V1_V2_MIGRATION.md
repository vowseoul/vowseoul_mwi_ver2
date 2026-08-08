# VER1 → VER2 비교 분석 및 작업 계획서

작성일: 2026-07-29
대상: `C:\Users\plazm\VOW_SEOUL_WMI` (ver1, 운영 중) → `C:\Users\plazm\VOWSEOUL_MWI Ver2` (ver2, 재구축)

---

## 0. 요약

ver1은 **현재도 활발히 운영·수정 중인 라이브 제품**이다 (최신 커밋 2026-07-29). ver2는 같은 도메인을
다른 사업모델·다른 렌더링 아키텍처로 재구축한 것이며, 단순한 후속 버전이 아니라 **타깃 사용자가 바뀐 리라이트**다.

핵심 결론 3가지:

1. **ver2가 구조적으로 더 우수한 영역이 많다.** 테마 엔진(iframe 격리 + 토큰), 이미지 압축(EXIF 대응),
   BGM 자동재생 폴백, RLS 보안 분리, React Query 도입은 ver1보다 확실히 앞선다. **되돌리면 안 된다.**
2. **ver1의 최근 버그 수정 중 ver2에 미반영된 것은 4건**이며, 그중 2건은 즉시 수정 대상이다.
3. **가장 심각한 문제는 ver1에서 가져오지 않은 것이 아니라, ver2가 자체적으로 만든 미완성 배선이다** —
   RSVP 식사 집계는 소비자(대시보드)만 있고 생산자(입력 폼)가 없어 영구히 빈 값이다.

---

## 1부. 구조적 차이

### 1.1 사업모델 — 가장 큰 차이

| | ver1 | ver2 |
|---|---|---|
| 타깃 | **B2C 셀프서비스** — 예비부부가 직접 제작 | **B2B/대행** — 관리자가 대신 제작 |
| 고객 진입 | `signup` → `login` → `editor/[id]` 직접 편집 → `payment` | `form/[slug]` 정보 제출 → 관리자가 편집 |
| 고객 계정 | 있음 (`mypage`, `my-invitations`, `mypage/orders`) | **없음** (계정 개념 자체가 없음) |
| 편집 주체 | 고객 (4단계 에디터: content/design/features/payment) | 관리자 (`admin/invitations/editor/[id]`) |
| 결제 | 앱 내 결제 페이지 존재 | 앱 내 결제 없음 (오프라인 수주 전제) |

ver1의 `app/editor/`, `app/login`, `app/signup`, `app/mypage/*`, `app/my-invitations`는
**ver2에 의도적으로 존재하지 않는다.** 이것은 결함이 아니라 사업모델 결정이다.

### 1.2 렌더링 아키텍처 — 두 번째로 큰 차이

| | ver1 | ver2 |
|---|---|---|
| 방식 | 단일 거대 React 컴포넌트 | **템플릿 HTML/CSS + iframe 격리** |
| 핵심 파일 | `app/invitation/[id]/invitation-client.tsx` (**3,100줄+**) | `components/invitation/invitation-frame.tsx` (262줄) + `slot-registry.tsx` (943줄) |
| 테마 추가 | 컴포넌트에 `if (theme === 'xxx')` 분기 추가 | DB에 `template_html`/`template_css` 행 추가 |
| 미리보기 일치 | `mobile-preview.tsx`가 **렌더링 로직을 중복 구현** → 미리보기와 실제가 어긋나는 버그 반복 발생 | 미리보기·발행이 **동일한 `InvitationFrame` 사용** → 구조적으로 일치 보장 |
| 커스터마이징 | 하드코딩된 옵션 분기 | CSS 변수 토큰 + `data-block` 계약 |

ver1 커밋 로그에 `duotone editor preview mismatch`, `theme editor preview mismatch` 같은
**미리보기 불일치 버그가 반복 등장**하는데, ver2 아키텍처는 이 버그 계열을 원천 차단한다.

### 1.3 데이터·보안

| | ver1 | ver2 |
|---|---|---|
| 상태관리 | `lib/store.ts` (전역 store) | React Query (`hooks/queries/*`) + store |
| RLS | 미적용 (anon 키로 전체 조회 가능했음) | **적용** + `service_role` 서버 경유 분리 |
| 관리자 인증 | localStorage 커스텀 세션 | Supabase Auth (`profiles.role` 검증) |
| 신랑신부 대시보드 | 인증 없음 | 비밀번호 → **서명 쿠키** |
| 폼 시스템 | 없음 | `form_templates`/`form_instances`/`form_submissions` 3단 구조 |

### 1.4 관리자 화면 구성

**ver1에만 있음:** `users`(회원관리), `templates`(템플릿관리), `faq`, `notice`
→ `faq`/`notice`는 ver2에서 **의도적으로 제거됨** (커밋 `0b3e9b3`). `users`는 고객계정이 없어 불필요.

**ver2에만 있음:** `customers`, `forms/*`(빌더·필드·발행·응답), `inquiries`, `invitations/editor`,
`settings/paper-types`(지류), `themes/block-library`

---

## 2부. ver1 최근 수정내역 → ver2 검증 결과

ver1의 최근 30개 커밋(2026-07-01 ~ 07-29)을 전수 검토하고, 각 수정이 ver2에 반영됐는지
**코드를 직접 대조**하여 검증했다.

### 2.1 이미 반영됨 (조치 불필요)

| ver1 커밋 | 내용 | ver2 상태 |
|---|---|---|
| `e64c6a0` `6a290e7` `2ae104d` | 네이버 지도 geocoding 서버 프록시 / NCP 헤더 / 에러 폴백 | ✅ `app/api/geocode/route.ts` **완전 동일**, `naver-map.tsx` 내용 동일 |
| `6d90263` `80348b4` | 지도 3사 길찾기 + 로딩 폴링 | ✅ 동일하게 이식됨 |
| `25f13ea` | 카카오페이 딥링크 `kakaotalk://kakaopay/home` | ✅ `slot-registry.tsx:401` 수정본 반영됨 |
| `df76747` | BGM 자동재생 차단 폴백 | ✅ **ver2가 더 우수** — iframe 문서 + 부모 문서 양쪽에 리스너 등록 |
| `2038b6c` (일부) | 혼주 고인(故) 표기 | ✅ `lib/invitation-data.ts:130-144`, 템플릿 수정 없이 전 테마 적용되는 우수한 구현 |
| `f760d28` (일부) | 이미지 업로드 자동 압축 | ✅ **ver2가 더 우수** — EXIF 회전 대응, 역효과 방지 가드, 2000px/85% |
| `4f6767c` | 캘린더·위치 토글 | ✅ 블럭 토글 시스템으로 일반화되어 있음 |
| `772d19e` | 섹션 타이틀 커스터마이징 | ✅ `data-block-title` 계약으로 일반화됨 |

### 2.2 미반영 — 수정 필요

#### 🔴 [P1] 웹폰트 Content-Type 누락 — iOS Safari / 카카오톡 웹뷰에서 폰트 미적용

- **ver1 수정:** `412b0c8` "모바일 환경(iOS Safari, 카카오톡 웹뷰)에서의 웹 폰트 적용 누락 오류 해결"
- **ver2 현재 상태:** `app/api/fonts/route.ts`가 **수정 전 ver1 코드 그대로**다.

```ts
// ver2 (수정 전 코드)
let contentType = response.headers.get('content-type') || 'font/ttf'
if (contentType === 'application/octet-stream') { contentType = 'font/ttf' }
```
```ts
// ver1 (수정 후) — 확장자로 판별 + text/plain 도 교정
if (!contentType || contentType === 'application/octet-stream' || contentType === 'text/plain') {
  contentType = detectedType   // .woff2/.woff/.otf/.ttf/.eot 별로 판별
}
```

- **왜 문제인가:** Supabase Storage가 업로드 파일에 `text/plain`을 반환하는 경우가 있는데,
  ver2는 `application/octet-stream`만 교정하고 `text/plain`은 **그대로 통과시킨다.**
  iOS Safari와 카카오톡 인앱 웹뷰는 MIME이 폰트 타입이 아니면 **파싱을 거부**한다.
  청첩장은 소비 경로의 대부분이 카카오톡 공유 → 인앱 웹뷰이므로 직격이다.
- **현재 발현 여부:** 등록된 폰트 4종이 모두 `embed`(구글폰트 @import) 타입이라 **아직 프록시 경로를 타지 않는다.**
  TTF 폰트를 하나라도 등록·사용하는 순간 발현된다. → **잠재 버그이나 발현 시 치명적**

#### 🔴 [P1] RSVP 식사 선택 — 소비자만 있고 생산자가 없음 (ver2 자체 결함)

ver1 `3c2de3f`에서 RSVP 커스텀 하위 옵션을 추가했으나, ver2는 **배선이 끊겨 있다.**

- **DB 스키마 (준비돼 있음):** `supabase/migrations/20260708000000_initial_schema.sql:235-247`

```sql
CREATE TABLE IF NOT EXISTS public.rsvp_responses (
  ...
  party_size integer DEFAULT 1 NOT NULL,
  meal_required boolean DEFAULT true NOT NULL,   -- ❗ 한 번도 기록되지 않음
  meal_choice text,                              -- ❗ 한 번도 기록되지 않음
  shuttle_required boolean DEFAULT false NOT NULL,-- ❗ 한 번도 기록되지 않음
  ...
);
```

- **소비 측 (존재함):**
  - `app/invitation/[id]/dashboard/dashboard-client.tsx:215-223` — `mealSummary` 집계 로직
  - 같은 파일 `:354-357` — "식사 집계" 카드 렌더링
  - `app/admin/(dashboard)/invitations/[id]/responses/page.tsx:123` — `meal_choice` 컬럼 표시
- **생산 측 (없음):** `slot-registry.tsx:650-657` `RsvpIsland`가 insert하는 컬럼은
  `guest_name, phone, side, is_attending, party_size` **뿐.**
- **결과:** 스키마에 3개 컬럼이 설계돼 있고 대시보드가 그것을 읽는데, **입력 폼만 없어서
  세 컬럼 모두 영구히 기본값이다.** 신랑신부 대시보드의 식사 집계는 항상 비어 있다.
  하객 수 대비 식사 수를 예식장에 통보하는 것이 RSVP의 핵심 실무 목적인데 그 값이 절대 안 채워진다.
- 추가로 `hooks/queries/useInvitations.ts:182`가 `rsvpMealEnabled: true`,
  `rsvpCommentEnabled: true`를 content_data에 기록하지만 **읽는 코드가 어디에도 없다.**
- 💡 **`shuttle_required` 컬럼의 존재는 셔틀버스 기능이 ver2 초기 설계에 포함돼 있었으나
  구현만 누락됐음을 보여준다.** (4.1-2 셔틀버스 항목의 근거)

#### 🟡 [P2] 예식장 주소 줄바꿈 — 4개 테마 중 2개만 적용

- **ver1 수정:** `b4f8af5` "support multiline custom linebreaks ... **across all themes**"
- **ver2 현재 상태:**

| 테마 | 주소 요소 | `white-space: pre-line` |
|---|---|---|
| serif-pink | `.se-location-card__address` | ✅ `template.css:457` |
| romantic-film | `.sb-location-card__address` | ✅ `template.css:404` |
| **color-atelier** | `.ca-location-card__address` | ❌ **없음** |
| **modern-script** | `.ms-location__address` | ❌ **없음** |

- 인사말(`__greeting__message`)은 4개 테마 모두 `pre-line`이 적용돼 있다. 주소만 누락.
- **결과:** color-atelier / modern-script를 쓰는 청첩장은 관리자가 주소를 여러 줄로 입력해도
  **한 줄로 뭉개져 렌더링**된다.

#### 🟡 [P2] 모바일 확대(핀치줌) 미차단

- **ver1 수정:** `7a0358f`, `2038b6c` — 청첩장 페이지에서 핀치줌·더블탭 확대 차단
- **ver2 현재 상태:** `app/w/[slug]/page.tsx:12-16`

```ts
export const viewport: Viewport = {
  themeColor: '#ffffff', width: 'device-width', initialScale: 1,
  // ver1에 있는 maximumScale: 1, userScalable: false 없음
}
```
- **판단 유보 필요:** ver1은 "앱 같은 느낌"을 위해 차단했으나, 확대 차단은 **접근성(WCAG) 위반**이다.
  ver1의 `PRODUCT.md`가 스스로 "WCAG AA 기준을 기본 목표"라고 명시하고 있어 **ver1 내부에서도 모순**이다.
  → 무비판적 이식 대신 **의사결정 필요 항목**으로 분류한다 (5.3 참조).

### 2.3 ver1에 있으나 ver2에 없는 기능 (버그 아님, 기능 격차)

| ver1 커밋 | 기능 | ver2 상태 |
|---|---|---|
| `df76747` | **셔틀버스 안내** | 신랑신부 대시보드에만 존재. **어느 테마 템플릿에도 렌더링되지 않음** |
| `4f8b06d` | 방명록 페이지네이션 (5개씩) | ver2 대시보드에 페이지네이션 없음 (전체 렌더) |
| `f760d28` | 관리자 "방문수 초기화" 버튼 | 없음 |
| `a4bb47a` `743c18a` | 인사말 이미지 + 풀블리드(여백 없음) 옵션 | 없음 (최신 기능, 2026-07-29) |
| `772d19e` | 섹션 사이 사진 삽입 | 없음 |
| `3c2de3f` | 데이터 자동 파기(auto-purging) 정책 | 없음 |

---

## 3부. 양쪽 공통 보안 이슈 (신규 발견)

> ver1·ver2 **양쪽 모두** 해당. ver1에서 넘어온 문제이며 ver2에서도 고쳐지지 않았다.

**NCP(네이버 클라우드) API 시크릿 키가 소스에 하드코딩되어 git에 커밋되어 있다.**

`app/api/geocode/route.ts` (양쪽 동일):
```ts
'X-NCP-APIGW-API-KEY-ID': 'od370yq3ix',
'X-NCP-APIGW-API-KEY': 'PjdS...(시크릿 전문)',
```

- 이 키는 서버 사이드 시크릿이며 **환경변수로 옮기고 즉시 로테이션(재발급)해야 한다.**
- 두 저장소의 git 히스토리 전체에 남아 있으므로 키 교체 없이 코드만 고치면 의미 없다.
- `components/naver-map.tsx`의 `ncpKeyId`는 클라이언트 공개 키라 성격이 다르지만,
  도메인 화이트리스트가 설정돼 있는지 확인 권장.

---

## 4부. ver1에서 가져오면 좋을 요소 (추천)

우선순위는 **"청첩장 실무에서 없으면 곤란한 것"** 기준으로 매겼다.

### 4.1 강력 추천

1. **RSVP 식사 선택 + 참석 메시지** — 2.2의 끊긴 배선을 잇는 것과 동일 작업.
   집계 UI가 이미 완성돼 있으므로 **입력 폼에 필드 2개만 추가하면 즉시 동작**한다. 투자 대비 효과 최고.
2. **셔틀버스 안내 블럭** — 한국 예식 실무에서 사용 빈도가 높다. ver2는 이미 `data-block` +
   `block_manifest` 체계가 있어 새 블럭 추가 비용이 낮다.
   **게다가 `rsvp_responses.shuttle_required` 컬럼이 이미 스키마에 있어**, ver2 초기 설계에
   포함됐다가 구현만 빠진 항목으로 보인다. 안내 블럭 + RSVP 수요 집계를 함께 붙이면 완결된다.
3. **폰트 woff2/otf 지원** — 현재 ver2는 `.ttf`만 업로드 가능한데, 한글 TTF는 보통 3~8MB다.
   woff2로 바꾸면 1/3 이하로 줄어 모바일 셀룰러 환경 체감이 크게 개선된다.
   `lib/fonts.ts:buildFontFaceRule`은 **이미 woff2/otf format 힌트를 지원하도록 작성돼 있어**
   업로드 필터와 `/api/fonts`만 맞추면 된다. (P1 폰트 수정과 묶어서 처리)

### 4.2 추천

4. **방명록 페이지네이션** — 방명록이 수백 건 쌓이면 대시보드가 무거워진다.
5. **관리자 방문수 초기화** — 테스트 트래픽 제거용. 운영 편의.
6. **인사말 이미지 / 섹션 사이 사진** — ver1의 최신 디자인 기능. ver2 블럭 체계와 잘 맞는다.

### 4.3 검토 후 결정

7. **데이터 자동 파기 정책** — 개인정보(하객 연락처) 보관 기간 관리. **법적 요구사항일 수 있어
   법무 확인 후 진행 권장.** ver2에는 `expires_at`이 이미 있으나 실제 파기 잡은 없다.
8. **핀치줌 차단** — 접근성과 충돌. 5.3 참조.

### 4.4 가져오지 말 것

- ver1의 `invitation-client.tsx` 렌더링 방식 (3,100줄 단일 컴포넌트)
- `mobile-preview.tsx`의 렌더링 로직 중복 구조 — ver2의 단일 렌더러가 명백히 우월
- localStorage 기반 관리자 세션 — ver2의 Supabase Auth가 우월

---

## 5부. 작업 계획서

### Phase 1 — 즉시 수정 (0.5일)

| # | 작업 | 파일 | 검증 방법 |
|---|---|---|---|
| 1-1 | `/api/fonts` Content-Type 확장자 판별 이식 | `app/api/fonts/route.ts` | TTF 폰트 등록 후 응답 헤더가 `font/ttf`인지 curl 확인 |
| 1-2 | color-atelier / modern-script 주소 `white-space: pre-line` 추가 | `scripts/themes/{color-atelier,modern-script}/template.css` | 계약검사 → 재시드 → 줄바꿈 포함 주소로 렌더 확인 |
| 1-3 | `font-loader.tsx` format 힌트를 `lib/fonts.ts`와 통일 | `components/font-loader.tsx` | 타입체크 + 관리자 화면 폰트 정상 표시 |

> 1-2는 반드시 `node scripts/check-theme-contract.mjs <테마>` → `node scripts/seed-theme.mjs ...` 순서로.

### Phase 2 — 끊긴 배선 복구 (1~2일)

**DB 마이그레이션 불필요** — `meal_required` / `meal_choice` / `shuttle_required` 컬럼이 이미 존재한다.
프론트엔드 입력 필드만 추가하면 대시보드 집계가 즉시 살아난다.

| # | 작업 | 상세 |
|---|---|---|
| 2-1 | `RsvpIsland`에 식사 선택 필드 추가 | 기존 `meal_choice` 컬럼에 저장 |
| 2-2 | `RsvpIsland`에 셔틀버스 이용 여부 체크박스 추가 | 기존 `shuttle_required` 컬럼에 저장 |
| 2-3 | `RsvpIsland`에 참석 메시지(선택) 필드 추가 | `rsvpCommentEnabled` 플래그를 실제로 읽도록 배선 (메시지 저장 컬럼은 없으므로 이 항목만 마이그레이션 필요) |
| 2-4 | 식사·셔틀 옵션의 청첩장별 on/off | 기존 블럭 토글 체계 재사용 |

> ⚠️ 2-1 착수 전 대시보드 집계 코드가 기대하는 **값 형식**을 먼저 확정해야 한다.
> `dashboard-client.tsx`는 `mealInfo`(객체, `{한식:2}`)와 `mealType`(문자열, `korean`/`western`)
> **두 형태를 모두 처리하도록** 작성돼 있는데, 실제 DB 컬럼은 `meal_choice text` 하나뿐이다.
> → `meal_choice`에 `'한식'`/`'양식'` 같은 한글 라벨을 저장하고 대시보드의 legacy 분기
> (`:221-223`)를 타도록 맞추는 것이 가장 변경이 적다.

### Phase 3 — 보안 (0.5일, 별도 진행 가능)

| # | 작업 |
|---|---|
| 3-1 | NCP 시크릿 키를 `.env.local`로 이전 (ver1·ver2 양쪽) |
| 3-2 | **NCP 콘솔에서 키 재발급** — 히스토리에 남아 있으므로 필수 |
| 3-3 | 네이버 지도 클라이언트 키 도메인 화이트리스트 확인 |

### Phase 4 — 기능 이식 (3~5일)

| # | 작업 | 비고 |
|---|---|---|
| 4-1 | 셔틀버스 안내 블럭 신설 | `block_manifest` + 4개 테마 템플릿 + 폼 필드 |
| 4-2 | 폰트 woff2/otf 업로드 지원 | 업로드 accept 확장 + Phase 1-1과 연동 |
| 4-3 | 방명록 페이지네이션 | 대시보드 |
| 4-4 | 방문수 초기화 버튼 | 관리자 |
| 4-5 | 인사말 이미지 / 섹션 사이 사진 | ver1 `a4bb47a`, `743c18a`, `772d19e` 참고 |

### 5.3 의사결정 필요 (착수 전 확인)

1. **핀치줌 차단 여부** — ver1은 차단했으나 접근성 위반. 하객 연령대에 고령층이 포함되는
   청첩장 특성상 확대 차단은 실사용 불편이 클 수 있음. **차단 대신 `initialScale` 유지 + 본문
   최소 폰트 크기 확보**를 권장하나, ver1과의 일관성을 원하면 차단도 가능.
2. **데이터 자동 파기 기간** — 법무/개인정보 처리방침 확인 필요.
3. **ver1 B2C 기능(고객 셀프 편집·결제) 재도입 여부** — 현 계획서는 "재도입 없음" 전제로 작성됨.

---

## 부록 A. 검증 방법 및 한계

- 2부의 모든 판정은 **양쪽 소스 코드 직접 대조**로 확인했다 (grep/diff/파일 통독).
- 실제 DB를 조회해 등록 폰트 4종이 전부 `embed` 타입임을 확인했다 (P1 폰트 이슈의 현재 발현 여부 판단 근거).
- **런타임 검증은 하지 않았다.** 특히 다음은 실제 기기 확인이 필요하다:
  - iOS Safari / 카카오톡 웹뷰에서의 폰트 로딩 (P1) — TTF 폰트 등록 후 실기기 테스트 필요
  - 발행 페이지의 iframe 높이(`window.innerHeight`) 처리가 iOS 주소창 접힘과 충돌하는지
- ver1의 `.next` 빌드 캐시·`node_modules`는 분석 대상에서 제외했다.

## 부록 B. ver2가 우월하여 유지해야 할 것

되돌리기 쉬운 항목들이므로 명시해 둔다.

- iframe 격리 테마 엔진 + CSS 변수 토큰 + `data-block` 계약
- 미리보기/발행 단일 렌더러 (`InvitationFrame`)
- 이미지 압축 (EXIF 회전 대응, 역효과 가드)
- BGM 자동재생 폴백 (iframe/부모 문서 동시 등록)
- RLS + `service_role` 서버 경유 분리
- 혼주 고인 표기 (`lib/invitation-data.ts` — 템플릿 무수정 전 테마 적용)
- React Query 기반 데이터 계층
