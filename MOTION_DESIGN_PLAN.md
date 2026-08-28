# 인터랙션 모션 디자인 작업 계획서

> 대상: ① 관리자(담당자) 로딩 경험 ② 하객이 보는 모바일 청첩장 스크롤 경험 ③ 그 외 UX 개선 지점
> 기준: 인터랙션 디자인 6원칙 [Visibility, Feedback, Constraints, Consistency, Affordance, Error Recovery]

---

## 0. 요약

| 구분 | 현재 상태 | 목표 |
|---|---|---|
| 관리자 로딩 | `"데이터를 불러오는 중입니다..."` 텍스트 한 줄 (레이아웃 점프 발생) | 스켈레톤 + 라우트 전환 즉시 피드백 |
| 청첩장 스크롤 | 모션 없음 (정적 스크롤) | 4종 프리셋 + 강도 설정, 디자인 탭에서 선택 |
| 액션 피드백 | 토스트 위주 | 버튼 자체가 상태를 말하는 인라인 피드백 |

**핵심 제약 3가지** (이 계획 전체를 지배하는 전제)

1. **새 라이브러리를 도입하지 않는다.** 현재 스택은 Tailwind v4 + `tw-animate-css`이고 framer-motion이 없다. 청첩장은 카카오톡 인앱 브라우저에서 열리는 경우가 대다수라 JS 번들 증가가 곧 체감 로딩 지연이다 → **CSS transform/opacity + IntersectionObserver만 사용**한다.
2. **청첩장은 iframe 안에서 렌더된다.** [invitation-frame.tsx](components/invitation/invitation-frame.tsx)가 `doc.write()`로 테마 HTML/CSS를 별도 문서에 그린다. 스크롤 모션은 그 iframe 문서 안에 주입해야 하며, 부모 문서의 CSS/옵저버는 닿지 않는다.
3. **DB 마이그레이션이 필요 없다.** 청첩장별 설정은 이미 `invitations.customization_overrides`(jsonb)에 모여 있다 ([lib/theme-template.ts](lib/theme-template.ts)의 `extractBlockOverrides` / `extractDisabledSlots` / `extractSectionImages` 패턴). 같은 방식으로 `scrollMotion` 키만 추가한다.

---

## 1. 6원칙의 프로젝트 적용 기준

원칙을 추상적으로 나열하지 않고, **"이 프로젝트에서 그 원칙을 어겼다는 걸 어떻게 알아채는가"** 로 정의한다. 이게 각 작업의 합격 기준이 된다.

| 원칙 | 이 프로젝트에서의 정의 | 위반 신호 (= 고쳐야 할 대상) |
|---|---|---|
| **Visibility** | 시스템이 무언가 하는 중이면 100ms 안에 화면이 그걸 말해야 한다 | 사이드바 메뉴를 눌렀는데 아무 반응 없이 1초 뒤 화면이 바뀜 |
| **Feedback** | 사용자 행동의 결과가 **행동한 그 자리**에 나타나야 한다 | 계좌 복사 버튼을 눌렀는데 확인은 화면 반대편 토스트에서만 |
| **Constraints** | 지금 하면 안 되는 조작은 물리적으로 막혀 있어야 한다 | 저장 중에 저장 버튼을 다시 눌러 중복 요청이 나감 |
| **Consistency** | 같은 의미의 변화는 항상 같은 속도·곡선으로 움직인다 | 화면마다 로딩 표현이 spinner/텍스트/무표시로 제각각 |
| **Affordance** | 움직임이 "여기 더 있다 / 이건 누를 수 있다"를 암시해야 한다 | 첫 화면에서 아래로 스크롤할 게 있는지 알 수 없음 |
| **Error Recovery** | 실패는 조용히 사라지지 않고, 되돌리거나 재시도할 길을 준다 | 저장 실패 시 토스트만 뜨고 입력값 상태가 애매해짐 |

---

## 2. Phase 0 — 공통 기반 (선행 필수)

모션을 화면별로 따로 만들면 **Consistency가 바로 깨진다.** 값을 먼저 한 곳에 고정한다.

### 2-1. 모션 토큰 — [app/globals.css](app/globals.css)

```css
:root {
  /* duration */
  --motion-fast: 150ms;    /* 버튼 press, hover — 즉각 반응 */
  --motion-base: 250ms;    /* 패널 열림/닫힘, 탭 전환 */
  --motion-slow: 600ms;    /* 스크롤 진입 연출 */
  /* easing */
  --ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1);   /* 등장 — 빠르게 나와 부드럽게 안착 */
  --ease-in-out-soft: cubic-bezier(0.4, 0, 0.2, 1); /* 상태 전환 */
}
```

규칙: **등장은 `--ease-out-soft`, 퇴장은 짧게.** 청첩장 톤(차분·고급)에 맞춰 bounce/elastic 계열은 쓰지 않는다.

### 2-2. 접근성 — 현재 `prefers-reduced-motion` 처리가 **전무하다**

전정기관 질환·멀미 민감군에게 스크롤 모션은 실제 신체 반응을 유발한다. 하객 중 누가 해당될지 알 수 없으므로 예외 없이 적용한다.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

동일 규칙을 **iframe 안에도** 넣는다 (`buildSrcDoc`의 리셋 스타일 블록, [invitation-frame.tsx:98](components/invitation/invitation-frame.tsx#L98)). 부모 문서 CSS는 iframe에 상속되지 않는다.

> 검증: OS 설정에서 "동작 줄이기"를 켜고 청첩장을 스크롤 → 모든 요소가 처음부터 보이는 상태로 즉시 표시.

---

## 3. Phase 1 — 관리자 로딩 인터랙션

### 3-1. 현재 문제

| 위치 | 현재 코드 | 문제 |
|---|---|---|
| [invitations/page.tsx:298](app/admin/\(dashboard\)/invitations/page.tsx#L298) | `<p>청첩장 목록을 로딩 중입니다...</p>` | 한 줄 → 목록으로 바뀌며 **레이아웃 점프** |
| [customers/page.tsx:225](app/admin/\(dashboard\)/customers/page.tsx#L225) | `<p>고객 데이터를 불러오는 중입니다...</p>` | 위와 동일, 문구만 다름 (Consistency 위반) |
| 사이드바 메뉴 클릭 | 없음 | 클릭 후 응답까지 **무반응 구간** (Visibility 위반) |
| [(dashboard)/loading.tsx](app/admin/\(dashboard\)/loading.tsx) | 원형 스피너 + 문구 | 존재하지만 이 세그먼트 하나뿐 |
| 24개 파일의 `Loader2` | 파일마다 크기·문구 제각각 | Consistency 위반 |

`components/ui/skeleton.tsx`는 **이미 있는데 어디서도 안 쓰인다.**

### 3-2. 작업 내용

**① 목록 스켈레톤 — Visibility + Consistency**

`components/admin/list-skeleton.tsx` 신규 (약 40줄). 실제 테이블/카드와 **같은 골격·같은 행 수**로 렌더해 로딩→완료 시 점프가 없도록 한다.

```tsx
<ListSkeleton rows={10} columns={7} />   // 데스크톱 테이블
<CardListSkeleton rows={6} />            // 모바일 카드
```

적용: 고객 관리 / 청첩장 관리 / 폼 관리 / 문의 관리 / 통계 (총 5개 화면, 각 화면 2곳 = 데스크톱·모바일)

> **왜 스피너가 아니라 스켈레톤인가**: 스피너는 "기다려라"만 말하지만 스켈레톤은 "무엇이, 몇 개나 올지"를 미리 말한다. 체감 대기시간이 짧아지고 레이아웃 점프가 사라진다.

**② 라우트 전환 즉시 피드백 — Visibility**

`next/link`의 `useLinkStatus()`(Next 16에서 사용 가능함을 확인)로 사이드바 메뉴에 pending 상태를 붙인다. 클릭 즉시 해당 메뉴 항목이 반응 → 서버 응답을 기다리는 동안의 무반응 구간이 사라진다.

추가로 무거운 세그먼트에 `loading.tsx`를 둔다 (`/admin/customers`, `/admin/invitations`, `/admin/forms`, `/admin/statistics`, `/admin/invitations/editor/[id]`). 기존 `(dashboard)/loading.tsx`의 원형 스피너는 **스켈레톤 기반으로 교체**한다.

**③ 저장/제출 버튼 표준화 — Feedback + Constraints + Error Recovery**

현재 각 화면이 `disabled={isSaving}` + `"저장 중..."` 텍스트를 개별 구현 중. 공통 컴포넌트로 통일:

```
idle → 저장   |   pending → [스피너] 저장 중… (클릭 차단)   |   success → [체크] 저장됨 (1.5초 후 idle)
                                                            |   error → 흔들림 1회 + 원래 상태 복귀 + 재시도 안내
```

- **Constraints**: pending 동안 pointer-events 차단 → 중복 요청 원천 봉쇄
- **Error Recovery**: 실패 시 입력값을 유지한 채 버튼만 idle로 복귀 (사용자가 고친 뒤 다시 누르면 됨)
- 성공 체크 표시는 **버튼 자리에서** — 토스트는 보조 수단으로만

**④ 편집기 미리보기 로딩 — Visibility**

[customize-client.tsx:1642](app/admin/\(dashboard\)/invitations/editor/\[id\]/customize-client.tsx#L1642) iframe이 준비되기 전 흰 박스가 보인다. 테마 전환 시(`switchingTheme`) 미리보기 영역에 은은한 shimmer를 덮어 "지금 다시 그리는 중"임을 표시한다.

---

## 4. Phase 2 — 청첩장 스크롤 인터랙션 (핵심)

### 4-1. 기술 구조 — iframe 안에 주입

기존에 이미 검증된 주입 패턴이 두 개 있다:
- 블럭 여백 오버라이드 `<style>` 주입 — [invitation-frame.tsx:237-256](components/invitation/invitation-frame.tsx#L237)
- 개인정보처리방침 링크 DOM 주입 — [invitation-frame.tsx:413-425](components/invitation/invitation-frame.tsx#L413)

스크롤 모션도 **동일한 방식의 `useEffect` 하나**로 붙인다. 테마 HTML/CSS를 전혀 건드리지 않으므로 **새 테마가 추가돼도 자동 적용**된다.

대상 선택자는 모든 테마가 공통으로 갖는 **`[data-block]`** (섹션 단위) + 섹션 삽입 이미지 `[data-vs-section-image]`.

**주의점 2가지 (실수하기 쉬운 지점)**

1. IntersectionObserver를 반드시 **iframe 쪽 realm**에서 생성해야 한다 (`doc.defaultView.IntersectionObserver`). 부모 window의 옵저버를 쓰면 `root: null`이 **부모 뷰포트**를 가리켜 전혀 다르게 동작한다.
2. `prefers-reduced-motion` 판정도 iframe 쪽에서 (`doc.defaultView.matchMedia`).

한 번 나타난 요소는 `unobserve` 하여 반복 연산을 없앤다(one-shot).

### 4-2. 애니메이션 종류 선별 — 성능 기준

**판정 기준**: 컴포지터 스레드에서만 처리되는가? (`transform` / `opacity` = O, 그 외 = 레이아웃·페인트 유발)

#### 채택 (4종)

| 프리셋 | 움직임 | 비용 | 성격 |
|---|---|---|---|
| **없음** | — | 0 | 기본값. 정숙한 톤 / 최고 성능 |
| **페이드 인** | `opacity 0→1` | 컴포지터 전용 | 가장 안전. 어떤 테마에도 위화감 없음 |
| **아래에서 올라오기** | `opacity` + `translateY` | 컴포지터 전용 | 청첩장에서 가장 보편적. **권장 기본** |
| **부드러운 확대** | `opacity` + `scale` | 컴포지터 전용 | 사진 비중이 큰 테마에 적합 |
| **좌우 번갈아** | `opacity` + `translateX` (섹션마다 방향 교대) | 컴포지터 전용 | 리듬감. 단 가로 오버플로 주의 → `overflow-x: hidden` 동반 |

#### 조건부 — 패럴랙스

진짜 패럴랙스는 스크롤 위치를 **연속 추적**해야 해서 모바일 인앱 브라우저에서 프레임 드랍 위험이 크다. CSS 스크롤 기반 애니메이션(`animation-timeline: view()`)을 쓰면 메인 스레드를 타지 않아 안전하지만, **Firefox 미지원·Safari 최근 버전 한정**이다.

→ **기능 감지 후 지원 브라우저에서만 적용, 미지원 시 "페이드 인"으로 폴백.** 1차 릴리스에서는 **보류**하고 채택 4종 안정화 후 재검토를 권한다.

#### 제외 (이유 명시)

| 제외 대상 | 이유 |
|---|---|
| blur-in (`filter: blur`) | 매 프레임 리페인트. 모바일 GPU 부담이 크다 |
| 3D 회전 / 플립 | 레이어 래스터화 비용 + 저사양 기기에서 텍스트 깨짐 |
| 자식 요소 stagger(순차 등장) | 옵저버·노드 수가 수십 배로 증가. 섹션 단위 대비 이득이 작다 |
| 스크롤 스냅 / 스크롤 재킹 | **Affordance 위반** — 하객의 스크롤 조작권을 뺏는다. 청첩장은 훑어보는 문서다 |
| 무한 반복 애니메이션 | 배터리 소모 + 시선 분산 |

### 4-3. 강도(intensity) 설정

| 강도 | duration | 이동거리 | scale |
|---|---|---|---|
| 약 | 400ms | 12px | 0.99 |
| 보통 (기본) | 600ms | 24px | 0.96 |
| 강 | 800ms | 40px | 0.92 |

**설정으로 만들지 않고 고정할 것** (단순성 원칙 — 요청되지 않은 설정은 만들지 않는다):
- **첫 화면(hero) 블럭은 항상 즉시 표시.** 열자마자 비어 있는 화면은 로딩 실패로 오인된다.
- 트리거 지점: 요소가 뷰포트 하단에서 10% 들어왔을 때 (`threshold 0.15`, `rootMargin: 0px 0px -10% 0px`)
- 반복 재생 없음(one-shot)

### 4-4. 저장 구조 — 마이그레이션 없음

`lib/scroll-motion.ts` 신규:

```ts
export interface ScrollMotionSettings {
  preset: 'none' | 'fade' | 'fade-up' | 'zoom' | 'slide-alt'
  intensity: 'subtle' | 'normal' | 'bold'
}
export const DEFAULT_SCROLL_MOTION = { preset: 'none', intensity: 'normal' }
export function extractScrollMotion(overrides: unknown): ScrollMotionSettings
```

저장 위치: `invitations.customization_overrides.scrollMotion`
→ 기존 `blocks` / `disabled_slots` / `sectionImages` 와 같은 컬럼을 공유하되 별도 키라 서로 간섭하지 않는다. **기존 청첩장은 값이 없으므로 자동으로 `none`** = 배포해도 기존 청첩장 외형이 하나도 안 바뀐다(안전한 점진 도입).

### 4-5. 디자인 탭 UI — [customize-client.tsx:1110](app/admin/\(dashboard\)/invitations/editor/\[id\]/customize-client.tsx#L1110)

기존 "테마 / 색상 / 타이포그래피" Card 아래에 **"스크롤 모션" Card** 추가.

```
┌─ 스크롤 모션 ─────────────────────────────────┐
│ 하객이 스크롤할 때 각 섹션이 나타나는 방식입니다.  │
│                                              │
│  ○ 없음   ● 페이드 인   ○ 올라오기            │  ← 라디오 카드
│  ○ 확대   ○ 좌우 번갈아                       │
│                                              │
│  강도   [ 약 ][ 보통 ][ 강 ]                  │  ← 세그먼트
│                                              │
│  ⓘ 기기에서 "동작 줄이기"를 켠 하객에게는       │
│     자동으로 모션이 비활성화됩니다.             │
└──────────────────────────────────────────────┘
```

- **Feedback**: 선택 즉시 **우측 미리보기 iframe에 실시간 반영**. 저장 전에 결과를 본다 (기존 색상·폰트 토큰과 동일한 즉시 반영 방식)
- **Visibility**: 옵션 라벨 옆에 그 모션을 그대로 재생하는 초소형 프리뷰 칩
- **Consistency**: 이미 디자인 탭에 있는 Card·Field·Select 컴포넌트를 그대로 사용
- **Affordance**: 안내 문구로 "동작 줄이기" 예외를 미리 알림 → 담당자가 "왜 내 폰에선 안 움직이지?"로 혼란을 겪지 않게

### 4-6. 렌더 경로 연결

`InvitationFrame`에 `scrollMotion` prop 하나를 추가하면 아래 3경로가 **같은 코드로 동일하게** 동작한다 (기존 "미리보기 = 실제 발행" 보장 구조를 그대로 유지).

| 경로 | 파일 | 역할 |
|---|---|---|
| 발행(하객) | [app/w/[slug]/template-invitation-client.tsx](app/w/\[slug\]/template-invitation-client.tsx) | 실제 적용 |
| 편집기 미리보기 | customize-client.tsx | 담당자 실시간 확인 |
| 고객 검수 | [review-client.tsx](app/invitation/\[id\]/review/review-client.tsx) | 신랑신부 시안 확인 |

---

## 5. Phase 3 — 추가 제안

우선순위는 **효과 ÷ 비용**으로 매겼다.

### P0 — 즉시 효과가 큰 것

| # | 제안 | 원칙 | 내용 |
|---|---|---|---|
| 1 | **복사 버튼 인라인 모핑** | Feedback | 계좌번호 복사 시 아이콘이 `복사 → 체크`로 전환 후 1.5초 뒤 복귀. 현재는 화면 반대편 토스트뿐이라 "복사가 됐나?" 확인이 어렵다 |
| 2 | **갤러리 이미지 페이드인** | Visibility | 사진이 뚝뚝 나타나는 대신 로드 완료 시 부드럽게. 청첩장 체감 품질에 가장 직접적 |
| 3 | **RSVP 제출 성공 연출** | Feedback | 제출 → 체크 마크 그려지는 짧은 연출. 하객이 "제출됐구나"를 확신하게 |
| 4 | **스크롤 유도 인디케이터** | Affordance | 첫 화면 하단에 은은한 아래 화살표. 스크롤 시작하면 사라짐. **첫 화면에서 이탈하는 하객을 줄이는 가장 직접적 장치** |

### P1 — 담당자 작업 효율

| # | 제안 | 원칙 | 내용 |
|---|---|---|---|
| 5 | **블럭 ↔ 미리보기 하이라이트** | Visibility | 편집기에서 블럭 아코디언을 열면 미리보기가 그 섹션으로 스크롤되는 기능은 이미 있다(`focusBlock`). 여기에 **해당 섹션 테두리 펄스 1회**를 더해 "지금 이 부분을 편집 중"을 명확히 |
| 6 | **폼 빌더 필드 추가/정렬 피드백** | Feedback | 필드 추가 시 새 행 하이라이트, 위/아래 이동 시 위치 전환 트랜지션 |
| 7 | **저장 실패 복구 흐름** | Error Recovery | 실패 시 버튼 흔들림 + 입력값 보존 + "다시 시도" 인라인 버튼 |

### P2 — 여력이 될 때

| # | 제안 | 원칙 | 내용 |
|---|---|---|---|
| 8 | **오프닝 인트로** | Affordance | 청첩장 진입 시 신랑신부 이름이 페이드인. 한국 모바일 청첩장의 관례적 연출. **단, 콘텐츠 도달을 늦추므로 1.2초 이내 + 스킵 가능해야 함** |
| 9 | **D-day 숫자 롤링** | Feedback | 카운트다운 숫자가 슬롯머신처럼 정착 |
| 10 | **스크롤 진행률 바** | Visibility | 상단 2px 바. 긴 청첩장에서 "얼마나 남았나" 감각 제공 |

> 8번은 **의견이 갈릴 수 있어 기본 OFF 권장.** 인트로는 취향 편차가 크고, 재방문 하객에겐 매번 방해가 된다.

---

## 6. 성능 가드레일

측정 없이 "괜찮아 보인다"로 넘기지 않는다.

| 항목 | 기준 |
|---|---|
| 애니메이션 속성 | `transform` / `opacity` **만** 허용. 코드리뷰 체크 항목으로 고정 |
| 스크롤 이벤트 리스너 | **0개** (IntersectionObserver만 사용) |
| 옵저버 대상 수 | 섹션 단위 최대 ~15개. 개별 자식 요소 관찰 금지 |
| 추가 JS 번들 | +5KB 미만 (새 의존성 0) |
| 프레임율 | 저사양 기기 스크롤 시 55fps 이상 (Chrome DevTools Performance, 4x CPU 스로틀) |
| LCP 영향 | 첫 화면(hero)은 애니메이션 대상에서 제외되므로 **LCP 변화 없어야 함** |

---

## 7. 검증 계획

각 Phase는 아래를 통과해야 완료로 본다.

**Phase 0**
- OS "동작 줄이기" ON → 관리자·청첩장 양쪽 모든 모션 정지, 콘텐츠는 정상 표시

**Phase 1**
- 느린 3G 스로틀에서 각 목록 화면 진입 → 스켈레톤이 실제 목록과 같은 골격으로 표시, 완료 시 **레이아웃 점프 0**
- 사이드바 메뉴 클릭 → 100ms 이내 시각 반응
- 저장 버튼 연타 → 요청 1건만 발생 (네트워크 탭 확인)
- 네트워크 차단 후 저장 → 입력값 보존 + 재시도 가능

**Phase 2**
- 프리셋 5종 × 강도 3단계 전환 → 미리보기 즉시 반영
- 저장 후 실제 발행 URL(`/w/{slug}`)에서 **편집기 미리보기와 동일하게** 동작
- 기존 청첩장(설정값 없음) → 모션 없음, 외형 변화 0
- 모바일 실기기 + 카카오톡 인앱 브라우저에서 스크롤 확인
- 4x CPU 스로틀 스크롤 → 55fps 이상
- 좌우 번갈아 프리셋에서 가로 스크롤바 미발생

**Phase 3**
- 항목별 개별 검증 (해당 Phase 착수 시 구체화)

---

## 8. 범위 밖 (하지 않을 것)

명시적으로 제외해 범위 확산을 막는다.

- ❌ framer-motion / GSAP 등 애니메이션 라이브러리 도입
- ❌ 테마별 개별 모션 커스터마이징 (테마 HTML/CSS 수정 없이 공통 주입만)
- ❌ 블럭 단위 개별 모션 지정 (설정 복잡도 대비 실익 낮음 — 필요해지면 그때)
- ❌ 스크롤 재킹 / 풀페이지 스냅
- ❌ 기존 레거시 렌더러(`render_engine: 'legacy'`) 대응 — 템플릿 엔진 테마만 대상

---

## 9. 순서와 규모

| Phase | 내용 | 규모 | 선행 |
|---|---|---|---|
| **0** | 모션 토큰 + reduced-motion | 소 (파일 1~2개) | — |
| **1** | 관리자 로딩 | 중 (신규 2~3개 + 5개 화면 수정) | 0 |
| **2** | 청첩장 스크롤 모션 | 중 (신규 1개 + 렌더러/편집기 수정) | 0 |
| **3** | 추가 제안 P0 4건 | 중 | 0 |

**권장 진행 순서: 0 → 2 → 1 → 3**

Phase 2를 앞에 두는 이유: 하객이 보는 화면이 **매출과 직결되는 결과물**이고, 담당자 로딩 개선(1)은 내부 효율 문제라 상대적으로 미룰 수 있다. 다만 Phase 0은 두 작업의 공통 토대라 반드시 먼저 간다.

---

## 10. 확인이 필요한 결정사항

착수 전에 정하면 좋을 것들 (미정이어도 기본값으로 진행 가능):

1. **신규 청첩장의 기본 프리셋** — `없음`(현행 유지, 안전) vs `아래에서 올라오기`(권장 톤). → 기본은 `없음`으로 두고 담당자가 켜는 방식을 제안
2. **Phase 3 우선순위** — P0 4건 중 먼저 원하는 것
3. **오프닝 인트로(P2-8)** 도입 여부 — 취향 편차가 커서 별도 판단 필요
