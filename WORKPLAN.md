# VOW SEOUL Ver2 — 작업계획서

작성일: 2026-07-24 (최초) · 갱신: 2026-07-24 · 대상 브랜치: `beta` · 빌드 상태: ✅ 통과

이 문서는 (1) 하드코딩 데이터의 실 DB 전환, (2) 구조적 개선, (3) 오류 발생 포인트,
(4) 중복·불일치 항목을 코드 실측으로 정리한 실행 계획서다.

## 실제 비즈니스 프로세스 (확인됨)

이 앱은 **셀프서비스 구매/결제 플로우가 아니다.** 실제 운영 방식:

```
고객이 네이버 스마트스토어에서 구매·결제 (앱 밖, 이미 완료된 상태로 넘어옴)
  → 외부 채널로 연락 옴
  → 관리자가 VOW SEOUL MWI 에서 고객 수동 등록 + 정보 수집 폼 발급
  → 고객이 폼 작성 (계정 불필요)
  → [지류 상품] 관리자가 폼 데이터로 오프라인 청첩장 제작 (이 앱 범위 밖)
  → [모바일 상품] 관리자가 admin/invitations/editor 에서 직접 제작 + 디자인 피드백
  → 발행 후 /dashboard/[slug] 링크(비밀번호=연락처 뒷4자리) + 완성 링크를 고객에게 전달
```

이 확인으로 앱 내 **결제 게이트웨이·소비자 계정 가입·셀프 에디터가 전부 불필요**하다는
것이 명확해졌고, §1-B(orders)와 아래 "완료된 작업"의 근거가 되었다.

---

## ✅ 이번 세션에서 완료된 작업

위 프로세스 확인에 따라 다른 브랜치에는 원본이 남아있음을 전제로, `beta` 브랜치에서
셀프서비스 소비자 플로우(위 프로세스와 무관한 구식 코드)를 제거했다.

**삭제된 라우트/컴포넌트 (13개 파일)**
- `app/login`, `app/signup` — 소비자 Supabase Auth 가입/로그인
- `app/mypage/*`(page, orders, rsvps/[id]), `app/my-invitations` — 계정 기반 내 청첩장 목록
- `app/editor/[id]/*`(page, layout, design, content, features, payment) — 셀프 에디터 마법사(결제 시뮬레이션 포함)
- `components/invitation-card.tsx` — 사용처 0곳이던 죽은 컴포넌트

**같이 고친 dangling 참조**
- `components/header.tsx` — 로그인/마이페이지 드롭다운 제거
- `app/templates/page.tsx`, `components/hero-section.tsx` — "청첩장 만들기"/"직접 디자인하기" CTA를
  네이버 스마트스토어 링크로 교체
- `app/admin/(dashboard)/invitations/editor/[id]/page.tsx` — legacy 테마 편집 시
  삭제된 `/editor/[id]` 로 리다이렉트하던 로직을 인라인 안내 메시지로 교체
  (§3-7의 해결책 (b)를 사실상 구현함)
- `app/admin/(dashboard)/invitations/editor/[id]/customize-client.tsx` — 죽은
  "콘텐츠·디자인 편집기 열기" 링크 제거
- `lib/store.ts` — 삭제된 라우트(`/mypage`,`/my-invitations`,`/editor`)를 검사하던
  죽은 `loadUserInvitations()` 트리거 제거

**DB 정리**: legacy 테마(봄날의 세레나데/모던 에센스) 쓰던 draft 청첩장 3건을
테스트 데이터로 확인 후 삭제. 남은 invitations 3건은 전부 Soft Envelope(template 엔진).

**주의 — 삭제하지 않은 것** (얼핏 관련돼 보이지만 실사용 중으로 확인됨):
- `app/admin/(dashboard)/orders/*` — 관리자 사이드바에서 링크되는 활성 기능
  (§1-B 대로 재설계는 필요하나 삭제 대상 아님)
- `components/mobile-preview.tsx` — `editor-preview.tsx`의 legacy 폴백 + `orders/[id]` 에서 사용 중
- `app/invitation/[id]/*` — legacy 렌더러 + **`/dashboard/[slug]` 가 실제로 리다이렉트하는
  진짜 고객 대시보드**(`invitation/[id]/dashboard`)라서 확인 후 유지
- `lib/store.ts` 본체 — admin 페이지 다수가 여전히 의존, 부분 정리만 수행

빌드 라우트 42 → 30개로 감소, 빌드 통과 확인.

---

## 0. 핵심 요약

가장 중대한 발견은 **코드가 참조하는 테이블 8개가 실제 DB에 존재하지 않는다**는 점이다.
운영 Supabase에 PostgREST로 직접 조회해 확인했으며, 응답 코드는 `PGRST205`
(= 테이블 없음. RLS 차단이 아님)이다.

| 코드가 부르는 테이블 | 실제 DB | 정답 |
|---|---|---|
| `orders` | ❌ 없음 | 신규 생성 필요 |
| `bgms` | ❌ 없음 | 신규 생성 필요 |
| `faqs` | ❌ 없음 | 신규 생성 필요 |
| `notices` | ❌ 없음 | 신규 생성 필요 |
| `inquiries` | ❌ 없음 | 신규 생성 필요 |
| `rsvps` | ❌ 없음 | `rsvp_responses` 로 코드 수정 |
| `guestbook` | ❌ 없음 | `guestbook_entries` 로 코드 수정 |
| `visitor_logs` | ❌ 없음 | `visit_logs` 로 코드 수정 |

즉 **주문/결제, BGM, FAQ, 공지, 문의, RSVP, 방명록, 방문통계 기능이 전부 무동작**이다.
`const { data } = await supabase...` 패턴(에러 미수신)과 `sampleXxx` 폴백이
실패를 조용히 덮고 있어 화면상으로는 "빈 목록"으로만 보인다.

우선순위 요약:

- **P0** — 죽어 있는 데이터 경로 복구 (§1, §3.1~3.3). 이걸 못 고치면 실서비스 불가.
- **P1** — 목데이터 실연동 + 중복 제거 (§2, §4).
- **P2** — 구조 리팩터링·타입·테스트 (§5).

---

## 1. [P0] 존재하지 않는 테이블 정리

### 1-A. 이름만 틀린 3개 — 코드를 정본 스키마에 맞춘다 — ✅ 완료

`supabase_schema.sql` 에 정의된 정본 테이블이 이미 운영 DB에 있다.
레거시 코드가 다른 이름 + camelCase 컬럼으로 부르고 있을 뿐이다.

| 수정 대상 | → 변경 | 컬럼 |
|---|---|---|
| `rsvps` | `rsvp_responses` | `invitationId` → `invitation_id`, 이름/연락처 → `guest_name`/`phone`/`side`/`is_attending`/`party_size` |
| `guestbook` | `guestbook_entries` | `invitationId` → `invitation_id`, → `author_name`/`message`/`password_hash`/`is_visible` |
| `visitor_logs` | `visit_logs` | `invitationId` → `invitation_id`, → `ip_hash`/`user_agent`/`referrer`/`visited_at` |

수정 파일 (총 13개 호출 지점 — `mypage/rsvps/[id]` 는 이번 세션에 삭제되어 제외):

- `app/invitation/[id]/invitation-client.tsx:224, 262, 409, 456`
- `app/invitation/[id]/dashboard/page.tsx:134, 147, 160, 189, 190, 191, 209, 233, 244`

> ⚠️ `guestbook_entries.password_hash` 는 NOT NULL (bcrypt 전제)이고
> `rsvp_responses.side` 는 `CHECK (side IN ('groom','bride'))` 다.
> 현재 레거시 입력 폼이 이 값들을 만들지 않으므로 폼도 함께 손봐야 한다.
>
> ⚠️ `invitation/[id]/dashboard/page.tsx` 는 이제 우선순위가 더 높다 —
> `/dashboard/[slug]` (비밀번호 인증 게이트)가 실제로 여기로 리다이렉트하는,
> **고객에게 실제 전달되는 대시보드**임이 이번 세션에 확인됐다.
>
> **적용 완료**: `invitation-client.tsx`(RSVP/방명록/방문로그 insert 3곳) +
> `invitation/[id]/dashboard/page.tsx`(조회/삭제/토글 전체)를 정본 테이블·컬럼명으로
> 교정하고 실 DB에 curl로 insert/조회/delete 왕복 검증 + 브라우저로 대시보드 렌더
> 확인 완료. 다만 스키마와 기존 UI 사이에 메워지지 않는 간극 두 가지가 남았다:
> - `rsvp_responses` 에는 하객이 남기는 개인 메시지 컬럼이 없다 — 레거시 RSVP
>   폼의 `rsvpMessage` 는 더 이상 저장되지 않는다 (필드 추가 여부는 별도 결정 필요).
> - 옵션별 식사 수량 설문(`mealInfo: {한식:2, 양식:1}`)은 구조화된 컬럼이 없어
>   `meal_choice` 텍스트에 요약 문자열로 접어 넣는다 — 대시보드 "식사 희망 수량"
>   집계 카드가 이 요약 문자열 전체를 하나의 항목으로 세는 사소한 표시 오류가 있음
>   (데이터 유실은 아니고 집계 라벨만 어색함).
> - `guestbook_entries.password_hash`(NOT NULL)와 `visit_logs.ip_hash`(NOT NULL)는
>   실제로 이 값을 확인하는 코드가 전혀 없는 자리표시자 컬럼이다 — 코드에서 빈
>   문자열/`'unknown'` 을 넣어 제약만 만족시켰다. `ip_hash` 는 원래 서버에서 실
>   클라이언트 IP를 해시해야 의미가 있는 값이라, 브라우저에서 직접 insert하는
>   현재 구조로는 애초에 정확한 값을 넣을 수 없다 — 서버 라우트로 옮기는 게 맞다.

**작업량**: 반나절. 스키마 변경 없음 → 리스크 낮음.

### 1-B. 아예 없는 5개 — 스키마를 만든다 — ✅ 완료

`orders` / `bgms` / `faqs` / `notices` / `inquiries` 는 어떤 SQL 파일에도 정의가 없었다.

**`orders` — 결제 트랜잭션이 아니라 "제작 의뢰 + 이행 상태 기록"으로 정의 확정.**
실제 결제는 네이버 스마트스토어에서 앱 밖에서 끝난 채로 넘어온다(§실제 비즈니스 프로세스 참조).
따라서 결제 게이트웨이는 불필요하고, `orders` 는 관리자가 고객을 등록하며 수기로
남기는 이행 추적 레코드다.

```sql
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id),
  invitation_id uuid REFERENCES invitations(id),  -- 모바일 상품만 채워짐, 지류 전용이면 NULL
  product_type text CHECK (product_type IN ('mobile', 'offline', 'both')),
  external_order_ref text,        -- 네이버 스마트스토어 주문번호 (대사용)
  amount integer NOT NULL,        -- 실제 결제액 수기입력 (5만원 고정 아님)
  status text CHECK (status IN (
    'registered', 'form_sent', 'form_completed',
    'in_production', 'design_review', 'published', 'delivered'
  )),
  created_at timestamptz DEFAULT now()
);
```

| 테이블 | 사용처 | 역추출 필요 컬럼 (초안) |
|---|---|---|
| `orders` | `admin/orders/*` (3곳) — 위 스키마로 재설계, 결제 필드 제거 | 위 스키마 참조 |
| `bgms` | 9곳 — `admin/assets`, `admin/orders/[id]`, 렌더러 3종 | `id`, `name`, `url`, `artist`, `duration`, `is_active` |
| `faqs` | `lib/store.ts:361,599,603,609` | `id`, `question`, `answer`, `category`, `sort_order` |
| `notices` | `lib/store.ts:423,616,630,644` | `id`, `title`, `content`, `is_pinned`, `created_at` |
| `inquiries` | `app/contact/page.tsx:34` | `id`, `name`, `email`, `phone`, `message`, `status`, `created_at` |

> `app/admin/(dashboard)/orders/[id]/page.tsx`(3,431줄, 코드베이스 최대 파일)는
> 관리자가 legacy 테마 청첩장을 직접 편집하는 화면을 겸하고 있다.
> **orders 재설계와 이 화면의 편집 UI는 분리해서 다뤘다** — 편집 UI 자체(§4-1의
> legacy 렌더러 이관 대상)는 그대로 두고, orders 관련 필드 접근·저장 로직만 교정.

**적용 완료**:
- `supabase/migrations/20260724000002_orders_and_content_tables.sql` — 5개 테이블 +
  RLS(개방 정책) 생성. 사용자가 Supabase 프로젝트에 직접 적용함(이 세션은 anon
  key만 있어 DDL을 실행할 권한이 없음 — CREATE TABLE/ALTER TABLE 은 PostgREST로
  노출되지 않는다).
- `lib/store.ts` — `orders` 합성 로직(customers 순회해 가짜 주문 생성) 제거,
  실제 `orders` 테이블 조회로 교체 + customer_id 조인으로 표시용 이름/예식일 채움.
  `updateOrder` 의 `id.replace('ORD-','')` UUID 앞8자 역추적 해킹 제거, 실제
  `orders` 테이블 직접 업데이트로 교체. 미사용 `sampleOrders` 픽스처 삭제.
- `Order.status` 타입을 5가지 결제 상태(pending/paid/deployed/expired/refunded)에서
  7가지 이행 단계(registered~delivered)로 교체 — `admin/orders/page.tsx`,
  `admin/orders/create/page.tsx`, `admin/orders/[id]/page.tsx`,
  `admin/(dashboard)/page.tsx`(대시보드 홈 통계) 전부의 상태 배지·필터·드롭다운 갱신.
- `admin/orders/page.tsx` 의 "주문 내역 수정" 다이얼로그가 orders에 더 이상 존재하지
  않는 `groomName`/`brideName`/`weddingDate`/`theme`/`id`/`createdAt` 를 직접
  써왔던 것을 금액/상태/메모만 남기도록 축소(고객·청첩장 정보는 customers/invitations
  화면에서 관리).
- `admin/orders/create/page.tsx` — orders insert를 새 스키마로 교정하는 과정에서
  **이 화면의 청첩장 생성 자체가 원래부터 깨져 있던 버그**를 발견해 함께 고침:
  `invitationId = \`custom__${uuid}\`` 형태가 `invitations.id`(uuid 컬럼)에 들어갈
  수 없는 값이었다 — prefix 제거로 수정. (단, `defaultInvitation` 객체가 여전히
  `content_data` 필드키 대신 camelCase 컬럼을 직접 쓰고 `customer_id`/`public_slug`/
  `dashboard_slug`/`dashboard_password`/`block_order` 등 NOT NULL 컬럼을 채우지
  않아 **여전히 실패한다** — 이건 orders와 무관한 별개의 사전 버그이며 별도
  작업이 필요하다. 아래 "이번 세션에서 새로 발견한 이슈" 참고.)
- `app/contact/page.tsx` — `inquiries.id` 에 `inq_xxxxxxxx`(비-UUID) 를 직접 넣던
  버그 수정(DB 기본값으로 생성하도록 제거) + 폼이 실제로 수집하는 `subject` 컬럼이
  최초 마이그레이션 설계에 없어 후속 마이그레이션
  (`20260724000003_inquiries_subject_column.sql`)으로 추가.
- `admin/assets/page.tsx` 의 BGM 저장이 `bgm_${Date.now()}` 형태의 비-UUID id를
  쓰던 버그 수정(`crypto.randomUUID()`로 교체) + 실제로 수집하는 `genre`/`hashtags`
  컬럼이 없어 같은 후속 마이그레이션에 추가. `isRecommended`(코드 주석상 "Deprecated")
  는 저장하지 않도록 함.
- `faqs`/`notices` 의 `addFaq`/`updateFaq`/`addNotice`/`updateNotice`(store.ts) 는
  호출하는 UI가 전혀 없음을 확인(`/admin/faq`, `/admin/notice` 는 `/admin`으로
  리다이렉트하는 5줄짜리 스텁) — 죽은 코드라 손대지 않음. 공개 `/faq`,`/notice`
  페이지의 읽기 전용 조회만 실제로 동작하며, 관리 UI가 없어 `sampleFaqs`/
  `sampleNotices` 폴백이 사실상 유일한 콘텐츠 소스인 상태는 §2-2 그대로 남음.

각 변경은 curl로 실 스키마에 직접 insert/select 왕복 + 브라우저로 `/admin/orders`,
`/admin/orders/[id]`, `/contact` 실제 폼 제출까지 확인 후 테스트 데이터 정리함.

**남은 결정**: `bgms` 를 별도 테이블로 유지할지, `settings` JSONB 로 옮길지(현재는
테이블로 확정 적용됨 — 재검토 원하면 마이그레이션 필요).

#### 이번 세션에서 새로 발견한 이슈 (orders와 무관, 별도 처리 필요)

- **`admin/orders/create/page.tsx` 의 청첩장 생성이 원래부터 실패한다.**
  `defaultInvitation` 객체가 `groomName`/`brideName`/`weddingDate` 등을 `invitations`
  테이블의 최상위 컬럼인 것처럼 넣지만 실제로는 `content_data` jsonb 안에 필드키로
  들어가야 하고, `customer_id`(NOT NULL)/`public_slug`/`dashboard_slug`/
  `dashboard_password`/`block_order`/`expires_at`(전부 NOT NULL) 를 아예 채우지
  않는다. "수동 청첩장 추가" 버튼을 누르면 항상 `PGRST204`(컬럼 없음) 로 실패한다.
  `/admin/customers/[customerId]`의 "초안 자동생성" 다이얼로그는 이 문제를 이미
  올바르게 처리하고 있으므로, 그 패턴을 참고해 다시 만드는 게 맞다.

### 1-C. 마이그레이션 체계 부재 — ✅ 완료

기존 방식 — 순서·적용 여부를 추적할 수 없는 루트 SQL 파일 3벌
(`supabase_schema.sql`/`update_schema.sql`/`theme_template_schema.sql`,
"Supabase Dashboard SQL Editor에 복사해 실행" 수동 방식) — 이 위 8개 테이블
누락의 근본 원인이었다.

`npx supabase init` 으로 `supabase/` 프로젝트 구조를 만들고, 커밋 이력(`git log
--diff-filter=A`)으로 확인한 실제 적용 순서에 맞춰 타임스탬프 마이그레이션으로 이관:

- `supabase/migrations/20260708000000_initial_schema.sql` (구 `supabase_schema.sql`)
- `supabase/migrations/20260709000000_storage_bucket.sql` (구 `create_storage_bucket.sql`)
- `supabase/migrations/20260719000000_field_library_and_theme_assets.sql` (구 `update_schema.sql`)
- `supabase/migrations/20260724000000_theme_template_engine.sql` (구 `theme_template_schema.sql`)
- `supabase/seed.sql` (구 `seed.sql`, CLI 관례 경로)

루트의 5개 원본 SQL 파일은 삭제. 이후 스키마 변경은 `supabase/migrations/`에
새 타임스탬프 파일로만 추가할 것 (§1-B의 orders 등 신규 테이블부터 적용).

> ⚠️ **별도 보안 메모**: `seed.sql`(현 `supabase/seed.sql`)에 관리자/디자이너 계정의
> 평문 비밀번호(`admin1234`, `designer1234`)가 하드코딩되어 git 히스토리에 이미
> 커밋되어 있다. 이번 이관으로 노출 범위가 늘지는 않았으나, 실제로 이 비밀번호를
> 아직 쓰고 있다면 교체를 권장한다. 이 워크플랜의 스코프 밖이라 별도로 처리 필요.
>
> `supabase link`/`db pull` 로 라이브 DB와 실제로 동기화하려면 프로젝트 access
> token과 DB 비밀번호가 필요하다 — 이 세션은 anon key만 갖고 있어 위 스냅샷은
> "기존 SQL 파일 기준"이며 라이브와 byte-level로 대조하진 않았다. 편할 때 사용자가
> `supabase db pull` 을 한 번 실행해 대조해볼 것을 권한다.

---

## 2. [P1] 하드코딩 데이터 → 실 DB 연동

### 2-1. 순수 목데이터 (화면은 그럴듯한데 전부 가짜) — ✅ 완료

| 위치 | 내용 | 처리 |
|---|---|---|
| `app/admin/(dashboard)/templates/page.tsx` | `mockTemplates` 6건 | **삭제** — 사이드바 네비/코드베이스 어디서도 링크되지 않는 고아 페이지로 확인 |
| `app/admin/(dashboard)/users/page.tsx` | `mockUsers` 5건 | **삭제** — 위와 동일하게 고아 페이지로 확인 |
| `app/preview/template/[id]/page.tsx:487` | `mockImages` 갤러리 | 미착수 — 남은 항목 |

> `app/my-invitations/page.tsx`(`mockInvitations`)는 소비자 셀프서비스 플로우와 함께
> 이번 세션 초반에 삭제됐다.

> `templates`/`users` 는 §7 결정 #3("assets/themes 와 통폐합할지")을 고민할 필요 없이
> **애초에 어느 화면에서도 진입할 수 없는 라우트**였다(어드민 사이드바 nav 배열에 없음,
> URL 직접 입력해야만 접근). `themes`/`profiles` 연동 대신 삭제로 처리 — 실사용
> 경로였다면 이미 사이드바에 있었을 것.

### 2-2. 실 데이터에 가짜 값이 섞인 곳 (더 위험)

**`app/admin/(dashboard)/statistics/page.tsx` — ✅ 완료**
- ~~`revenue += 50000` 고정~~ → `orders.amount` 실합계로 교체(§1-B `orders` 테이블 활용).
- ~~`inv.theme_version_id || 'Classic White'` (UUID를 테마명으로 사용)~~,
  ~~UUID에 `'rose'`/`'minimal'` 문자열 포함 여부로 테마명 추정(절대 매칭 안 됨)~~ →
  `theme_version_id → theme_versions.theme_id → themes.name` 실제 조인으로 교체.
- ~~`inv.content_data?.bgmId || 'Canon in D'`~~ → 실 데이터 확인 결과 `bgmId` 는
  `bgms.id`(uuid) 참조가 아니라 파일명 문자열("Paper Swan.mp3" 등)이 그대로 들어있음
  — uuid 형식일 때만 `bgms.name` 조인, 아니면 원본 문자열을 그대로 표시.
- ~~`trafficMap = {'00':15,...}` 기저값 하드코딩~~ → `visit_daily_stats`(일 단위) 대신
  `visit_logs.visited_at`(실제 방문 시각)에서 3시간 단위로 직접 집계, 기저값 없이
  방문 0건이면 그래프도 정직하게 0으로 표시.
- 데이터 없을 때 가짜 항목 push 하던 부분 제거, 대신 차트 영역에 "데이터 없음" 문구.
- "선택 기간 내" 문구도 실제로는 필터링되지 않고 있어 "전체 누적"으로 정정,
  "결제" 표현은 "주문"으로 정정(§실제 비즈니스 프로세스 — 결제는 앱 밖에서 발생).
- RSVP 활성화율은 legacy `content_data.rsvpEnabled` 플래그만 보고 있어 템플릿
  엔진 청첩장(플래그 없음 → 항상 true 취급)에는 부정확할 수 있음 — 후속 과제로 남김.

**`lib/store.ts:405~425` — ✅ 완료** (Task 6 에서 처리, §1-B 참고)
- ~~`customers` 를 순회해 `orders` 를 합성하던 로직~~ → 실제 `orders` 테이블 조회로 교체 완료.
- `faqs`/`notices` 의 `sampleFaqs`/`sampleNotices` 폴백은 그대로 남아있음 — 단,
  `addFaq`/`updateFaq`/`addNotice`/`updateNotice` 를 호출하는 관리 UI가 아예
  없음을 확인(`/admin/faq`,`/admin/notice` 는 `/admin` 리다이렉트 스텁) →
  실질적으로 이 폴백이 유일한 콘텐츠 소스이므로 지금 제거하면 콘텐츠가 통째로
  사라진다. 관리 UI를 새로 만들기 전까지는 유지가 맞다 (제거 대상 아님으로 재분류).

### 2-3. 정당한 샘플 (유지, 단 출처 통일)

- `lib/sample-invitation.ts` `SAMPLE_RAW` — 테마 미리보기용. 목적이 명확해 유지.
- `lib/store.ts:706` `sampleThemes` — DB 미조회 시 폴백. §4-4 참조.

---

## 3. [P0/P1] 오류 발생 포인트

### 3-1. [P0] 방명록 슬롯이 저장을 안 하고, 가짜 글이 실제로 보인다 — ✅ 완료

`components/invitation/slot-registry.tsx:539` `GuestbookIsland`

```
const [entries, setEntries] = useState([
  { name: "정우", msg: "두 사람 결혼 진심으로 축하해!" },
])
```

- DB 연동 없음. `add()` 는 로컬 state에만 추가 → 새로고침 시 소실.
- **하드코딩된 "정우" 축하글이 실제 발행 청첩장에 노출된다.**
- 같은 파일의 `RsvpIsland`(L383)는 `rsvp_responses` 에 정상 insert 하고 있어 대비된다.

→ `guestbook_entries` 조회/등록 연동 완료. `invitationId` 있으면 실 DB(공개된
`is_visible=true` 항목만, 최신순 50개) 조회 후 등록 시 insert, 없으면(테마랩 등
미리보기) 로컬 state만 사용 — `RsvpIsland` 와 동일한 규칙. `password_hash` 는
자기 글 삭제 UI가 없어 빈 문자열 자리표시자로 NOT NULL 만 충족시킨다(§1-A 부속
참고). theme-lab 브라우저 테스트로 미리보기 모드 등록/표시 확인, 실 DB
경로는 insert/select curl 왕복으로 스키마 정합 확인 완료 — 어떤 배포된
테마도 아직 `slot_manifest`에 `guestbook`을 선언하지 않아 실제 청첩장에서의
end-to-end 클릭 테스트는 다음 테마 등록 시 진행할 것.

### 3-2. [P0] Supabase 클라이언트의 public 경로 목록에 신규 발행 경로 누락 — ✅ 완료

`lib/supabase.ts:7-10`

```
const isPublicPage = window.location.pathname.startsWith('/invitation/')
                  || window.location.pathname.startsWith('/preview/')
```

주석은 "public 페이지에서 Web Locks API 충돌을 피하기 위함"이라 밝히고 있는데,
**템플릿 엔진의 실제 발행 경로 `/w/[slug]` 와 하객 대시보드 `/dashboard/[slug]` 가 빠져 있다.**
→ `/w/` 와 `/dashboard/` 를 `isPublicPage` 체크에 추가. `/w/[slug]` 브라우저 로드 시
콘솔 에러 없음 확인.

### 3-3. [P0] 에러를 수신하지 않는 쿼리 19곳 — ✅ 완료

```
const { data } = await supabase.from('bgms').select('*')   // error 미수신
```

`supabase-js` 는 예외를 던지지 않고 `{ data, error }` 를 반환한다.
따라서 `lib/store.ts` 의 `try { ... } catch { faqs = [] }` 형태는 **catch에 절대 진입하지 않으며**,
테이블이 없어도 `data = null` → `[]` 로 조용히 흘러간다.
§1의 8개 테이블 누락이 지금까지 드러나지 않은 직접적 원인이다.

`lib/supabase.ts` 에 `logSupabaseError(context, error)` 헬퍼를 추가하고, 원래
식별된 `const { data } = await supabase...`(별칭 없음) 19곳 전부에 `error` 를
받아 로깅하도록 교정했다 (동작은 그대로, 실패 시 콘솔에 남도록만 추가).

> **후속 스코프**: 이번엔 원 감사에서 지목된 19곳(별칭 없는 `{ data }`)만
> 처리했다. `{ data: xxx }` 형태의 별칭 있는 동일 패턴이 앱 전역에 약 32곳 더
> 있다(`w/[slug]`, `invitation/[id]/dashboard`, `admin/statistics`,
> `hooks/queries/*` 등) — 범위가 커서 이번 세션에는 포함하지 않았다. 같은
> `logSupabaseError` 헬퍼로 이어서 정리할 것.

### 3-4. [P1] 인증 가드가 쿠키 존재 여부만 확인 — ✅ 완료

`middleware.ts:16` — 쿠키 이름이 `sb-*-auth-token` 인지만 봤다. **서명·만료 검증 없음.**
게다가 이 쿠키는 `admin/login/page.tsx` 가 `document.cookie = ...` 로 직접 손으로 쓰던
가짜 마커였다(값은 access_token 아니면 문자열 `'true'`) — 서버가 검증 가능한 진짜
세션 쿠키가 전혀 아니었다. 실제 권한 확인은 클라이언트 `layout.tsx` 에서
`profiles.role` 조회로만 이뤄지고 있었다.

`@supabase/ssr` 도입:
- `lib/supabase.ts` — `createClient`(로컬스토리지 세션) → `createBrowserClient`
  (쿠키 세션)로 교체. 서버가 읽을 수 있는 진짜 세션 쿠키가 이제 존재한다.
- `lib/supabase-server.ts` 신설 — Server Component/Route Handler 용 클라이언트.
- `proxy.ts` — `/admin/*` 요청마다 `supabase.auth.getUser()`(로컬 쿠키 값을
  그대로 믿는 `getSession()` 과 달리 Auth 서버에 매번 재검증)로 세션을 실제
  검증하고, `profiles.role === 'ADMIN'` 까지 확인 후 리다이렉트.
- `admin/login/page.tsx`, `admin/(dashboard)/layout.tsx` 의 손으로 쓰던
  `document.cookie` 마커 제거(더 이상 필요 없음 — 진짜 쿠키가 그 역할을 한다).
- 클라이언트 사이드 `layout.tsx` 의 재검증은 그대로 유지 — 이중 방어이자
  로딩 스피너 UX 를 위해 남겨둠.

브라우저로 5단계 전부 확인: 미로그인 상태 `/admin/orders` 접근 → 로그인 리다이렉트 /
실 계정(seed.sql: `vovvseoul@gmail.com`) 로그인 성공 → `/admin` 대시보드 진입 /
다른 보호 라우트(`/admin/orders`) 이동 시 세션 유지 / 로그아웃 → 로그인 화면 복귀 /
로그아웃 후 재접근 시 다시 차단.

### 3-5. [P1] Next.js 16 `middleware` 관용구 폐기 예정 — ✅ 완료

빌드 로그: `The "middleware" file convention is deprecated. Please use "proxy" instead.`
`middleware.ts` 삭제, `proxy.ts` 로 교체(exported 함수명도 `proxy` 로 변경 — Next 16
관용구가 파일명뿐 아니라 export 이름도 `proxy` 를 요구한다). 빌드 로그에서 해당
경고가 사라진 것 확인.

### 3-6. [P1] ESLint가 동작하지 않음 — ✅ 완료

`package.json` 에 `"lint": "eslint ."` 이 있으나 `eslint.config.*` / `.eslintrc*` 파일이 없었고
`eslint` 자체도 devDependencies 에 없었다. 현재 `pnpm lint` 는 설정 없음 오류로 종료 →
**정적 검사가 0인 상태였다.**

`eslint@9`, `eslint-config-next@16.2.0`(Next 버전과 일치), `@eslint/eslintrc` 설치 +
`eslint.config.mjs`(flat config) 추가. 처음엔 `FlatCompat.extends("next/core-web-vitals")`
로 시도했으나 legacy shim이 flat-config용 `eslint-plugin-react` 인스턴스와 충돌해
"Converting circular structure to JSON" 에러가 났다 — `eslint-config-next` 의
default export 자체가 이미 flat config 배열이라 FlatCompat 없이 바로 spread 해서 해결.

`components/ui/**`(shadcn 생성 컴포넌트, 직접 수정 대상 아님)는 lint 제외 처리.

**남은 실제 위반**: 104건(에러 32 + 경고 72). 대부분 `<img>` → `next/image` 권고,
`jsx-a11y/alt-text`, 그리고 `react-hooks/set-state-in-effect`/`react-hooks/purity`
(React 19의 더 엄격해진 규칙 — `hooks/use-mobile.ts`, `components/naver-map.tsx` 등에서
effect 안에서 곧바로 setState 하거나 렌더 중 `Math.random()` 호출하는 기존 패턴을 지적).
**이번 세션은 린터를 동작시키는 것까지만 처리했고, 위반 수정 자체는 하지 않았다** —
별도 후속 작업으로 남겨둠(전체 리스트는 `pnpm lint` 실행 결과 참고).

### 3-7. [P1] 레거시 편집기 ↔ 필드키 정합 — ✅ (b) 적용 완료

레거시 폼에서 이름을 수정해도 `content_data` 의 필드키(`groom_name` 등)에는 반영되지 않는다.
`lib/invitation-data.ts:93` `normalizeLegacyKeys` 는 **읽기 시점 어댑터**일 뿐 저장 경로가 아니다.
현재 필드키를 갱신하는 경로는 ① 폼 동기화 버튼 ② 커스터마이즈 편집기 두 가지뿐.

선택지 (a) 레거시 저장 시 역방향 매핑 동시 기록 / (b) 레거시 편집기를 템플릿
청첩장에서 진입 차단 중, **(b)를 이번 세션에 구현했다** — 셀프서비스 에디터
(`/editor/[id]`) 삭제에 맞춰 `invitations/editor/[id]/page.tsx` 가 legacy 테마
청첩장 편집 시 더 이상 리다이렉트하지 않고 "편집기 미지원" 안내를 표시한다.
남은 것은 legacy 테마 자체를 템플릿 엔진으로 이관하는 것뿐 (§4-1, §7-#4).

---

## 4. [P1] 중복·불일치

### 4-1. 레거시 렌더러 4벌 복제 — 가장 큰 부채

| 파일 | 줄 수 | 성격 |
|---|---|---|
| `app/invitation/[id]/invitation-client.tsx` | 2,755 | 원본 |
| `components/mobile-preview.tsx` | 2,147 | 거의 동일한 복제본 |
| `app/admin/(dashboard)/orders/[id]/page.tsx` | 3,431 | 미리보기 로직 내장 |
| `app/preview/template/[id]/page.tsx` | 872 | 부분 복제 |

섹션 렌더 분기(`isConcept*`, 섹션 키 문자열) 출현 횟수가 앞 두 파일에서 각각 27회로 동일하다.
= **미리보기와 발행이 어긋나는 원인이 여전히 남아 있다** (템플릿 엔진이 해결한 문제가
legacy 엔진 쪽에는 그대로 존재).

> **갱신**: 이번 세션에 `/editor/[id]/*`(소비자 셀프서비스 에디터, ~3,600줄)를 삭제했다.
> 이는 위 4벌과는 별개의 **5번째 복제본**이었고, 어떤 admin 플로우와도 연결돼 있지
>않아 안전하게 제거했다. 위 4벌(`invitation-client.tsx`/`mobile-preview.tsx`/
> `orders/[id]/page.tsx`/`preview/template/[id]/page.tsx`)은 그대로 남아 있으며,
> 특히 `orders/[id]/page.tsx` 는 이제 **legacy 테마 청첩장을 편집하는 유일한
> admin 화면**이라는 게 명확해졌다(§3-7 참조) — 삭제 대상이 아니라 §7-#4 결정 전까지
> 유지해야 하는 화면이다.

→ 신 엔진(`components/invitation/invitation-frame.tsx`)으로 테마를 전량 이관한 뒤
legacy 4벌을 일괄 삭제하는 것이 최종 목표. 중간 단계로 부분 통합은 권하지 않는다
(어차피 버릴 코드에 리팩터링 비용을 쓰게 됨).

### 4-2. `defaultOrder` 배열 8곳 중복 — ✅ 완료

`['hero','greeting','sequence','gallery','calendar','location','contact','account','rsvp','guestbook']`

`assets/themes/[id]/page.tsx:57,166,209` / `orders/[id]/page.tsx:586,3097` /
`invitation-client.tsx:653` / `preview/template/[id]/page.tsx:300` / `mobile-preview.tsx:300`

`lib/constants.ts` 신설, `DEFAULT_BLOCK_ORDER` 로 8곳 전부 단일화. 각 호출부는
`[...DEFAULT_BLOCK_ORDER]` 로 복사본을 받는다 — 원본 배열을 직접 참조하면
드래그 정렬 등에서 mutate 시 다른 화면과 공유되는 상태가 오염될 수 있어서다.

### 4-3. 테마 색상 추출 로직 4파일 중복 — ✅ 완료

```
theme.colorSets?.[0]?.colors?.[0] || theme.styles?.backgroundColor || '#FFF8F0'
```
`admin/assets/page.tsx:338` / `admin/assets/themes/[id]/page.tsx` / `templates/page.tsx:59`
(`editor/[id]/design/page.tsx` 는 이번 세션에 삭제되어 3곳으로 줄었다)

`lib/theme-template.ts` 에 `resolveThemeSwatch(theme)` 로 통합, 3곳 전부 교체.
이 함수는 레거시 카드용(`colorSets`/`styles`)이고 신 엔진의 `buildThemeTokens`
(themes.styles → CSS 변수)와는 별개 경로라 실제 충돌은 없다 — 서로 다른
화면(레거시 카드 미리보기 vs 템플릿 엔진 렌더)이 각자의 폴백을 쓰는 구조라
"정합 확인 필요" 우려는 해소.

### 4-4. 샘플 데이터 2벌 — ✅ 완료

`lib/sample-invitation.ts` `SAMPLE_RAW` 와 `app/theme-lab/page.tsx:17` `RAW_DATA` 가
같은 내용을 각각 정의하고 있었다. `theme-lab` 이 `SAMPLE_RAW` 를 import 하도록 교체.

### 4-5. Supabase 클라이언트 2벌 — 조사 결과 의도된 패턴, 통합 안 함

`lib/supabase.ts` 싱글턴 외에 `app/admin/(dashboard)/settings/page.tsx:60` 이
`createClient` 를 별도 호출(`tempClient`, `persistSession: false`).

**우연한 중복이 아니었다** — 직원 계정을 `signUp()`으로 생성하는 코드다.
싱글턴 클라이언트로 `signUp()` 을 호출하면 Supabase Auth 특성상 **현재
로그인된 관리자 세션이 방금 생성한 신규 직원 계정 세션으로 바뀌어버린다**
(관리자가 자기도 모르게 로그아웃되고 새 직원으로 로그인됨). `persistSession:
false` 임시 클라이언트는 이 세션 탈취를 막는 의도된 방어 코드이므로
**통합하지 않고 그대로 둔다.**

### 4-6. 데이터 접근 계층 이원화

- `hooks/queries/*` — React Query 기반 (`useInvitations`, `useThemes`, `useForms`, `useCustomers`)
- `lib/store.ts` (968줄) — Zustand + 직접 fetch, 자체 캐시
- 페이지 컴포넌트 11곳 — `useEffect` 안에서 `supabase.from()` 직접 호출
  (셀프서비스 에디터 삭제로 17→11곳으로 감소)

같은 `invitations` 를 세 경로로 읽는다. 캐시 무효화가 서로 전파되지 않아
**저장 후 화면이 갱신되지 않는 버그의 온상**이다.

### 4-7. 컬럼 네이밍 불일치

- 정본 스키마: `snake_case` (`invitation_id`, `guest_name`)
- 레거시 코드: `camelCase` (`invitationId`)
- `themes` 테이블: `update_schema.sql:16-19` 에서 `"recommendedBgms"`, `"colorSets"`,
  `"fontSets"` 를 **따옴표로 감싼 camelCase 컬럼**으로 추가 → 스키마 내부에서도 혼재.

### 4-8. 타입 안정성 — Database 타입 생성 완료, 전면 적용은 안 함

`app`/`lib`/`hooks`/`components` 전체에 `: any` 209회 (셀프서비스 에디터 삭제로 228→209).
Supabase 생성 타입이 없어 컬럼 오타가 런타임까지 간다. §1의 테이블 누락도 타입이
있었다면 컴파일 단계에서 걸렸다.

`types/database.ts` 작성 완료. **단, `supabase gen types typescript` CLI 로 생성한
게 아니다** — 이 명령은 Supabase 액세스 토큰(`supabase login` 또는
`SUPABASE_ACCESS_TOKEN`)이 필요한데 이 세션엔 anon key 뿐이라 실행 권한이 없었다
(`--project-id` 만으로는 `LegacyPlatformAuthRequiredError`). 대신 이번 세션에 직접
작성해 운영 DB에 적용·검증한 4개 마이그레이션 파일을 근거로 손으로 작성했다 —
스키마가 바뀌면 수동으로 같이 갱신해야 하고, 사용자가 액세스 토큰을 발급하면
정식 CLI 생성으로 교체하는 게 더 안전하다(파일 상단에 방법 기록해둠).

**`lib/supabase.ts`/`lib/supabase-server.ts` 의 클라이언트에는 이 타입을 아직
연결하지 않았다** — `createBrowserClient<Database>` 로 강제하면 `.from('invitations')`
등의 반환 타입이 엄격해지는데, `content_data`/`customization_overrides` 같은
jsonb 컬럼을 `any` 로 느슨하게 다루는 기존 코드 다수(레거시 camelCase 필드 접근
포함)가 한꺼번에 타입 에러로 드러날 가능성이 높다. "타입 생성"과 "전면 적용"은
분리된 작업으로 남겨둔다 — 후자는 다른 발견들처럼 그 자체로 별도 세션이 필요하다.

---

## 5. [P2] 구조 개선

- **초대형 파일 분해** — `orders/[id]/page.tsx` 3,431줄, `invitation-client.tsx` 2,755줄,
  `mobile-preview.tsx` 2,147줄, `assets/themes/[id]/page.tsx` 1,809줄.
  단, §4-1대로 legacy는 **삭제 대상**이므로 분해보다 이관을 우선한다.
- **테스트 0 → ✅ 33개 추가** — `vitest` 도입(`pnpm test`), `lib/invitation-data.test.ts`
  (`buildFieldData`/`normalizeLegacyKeys`/`mergeInvitationRaw`, 15개)와
  `lib/theme-template.test.ts`(`buildThemeTokens`/`resolveThemeSwatch`/
  `isTemplateTheme`/`toThemeTemplate`/`extractOverrideTokens`/`buildInvitationTokens`,
  18개) 작성. 핵심 어댑터만 커버한 시작점이고, 컴포넌트/페이지 테스트는 없다.
- **DB 타입 생성 파이프라인** — ✅ `types/database.ts` 작성 완료(§4-8 참고,
  CLI 생성이 아니라 마이그레이션 기반 수기 작성).
- **`app/theme-lab`** — 개발용 페이지가 프로덕션 빌드에 포함됨. 라우트 가드 또는 제외.
  (미착수로 남음)

---

## 6. 실행 순서 제안

### 0차 — ✅ 완료: 소비자 셀프서비스 플로우 제거
비즈니스 프로세스 확인 결과 불필요해진 `login`/`signup`/`mypage`/`my-invitations`/
`editor/[id]/*` 및 dangling 참조 정리. "이번 세션에서 완료된 작업" 절 참조.

### 1차 — 데이터 경로 복구 (1~2주) — ✅ 전체 완료
1. `supabase/migrations/` 도입, 현행 스키마 스냅샷 커밋 · §1-C
2. 쿼리 에러 수신 래퍼 도입 + `const { data }` 19곳 교정 · §3-3 ← **먼저 해야 나머지 문제가 보인다**
3. `rsvps`/`guestbook`/`visitor_logs` → 정본 테이블명·컬럼으로 교정 · §1-A
4. `GuestbookIsland` DB 연동 + 하드코딩 축하글 제거 · §3-1
5. `lib/supabase.ts` public 경로에 `/w/`, `/dashboard/` 추가 · §3-2
6. `orders`(§1-B 확정 스키마)/`bgms`/`faqs`/`notices`/`inquiries` 생성 · §1-B
   - **남은 결정**: `bgms` 저장 위치(테이블 vs `settings` JSONB)뿐

### 2차 — 목데이터 실연동 (1주) — ✅ 전체 완료
7. `statistics` 하드코딩 제거 또는 "샘플" 명시 · §2-2
8. `store.ts` 합성 orders 제거(§1-B 정식 테이블로 대체), `sampleFaqs`/`sampleNotices` 폴백 제거 · §2-2
9. ~~`templates`/`users` 실연동 (또는 화면 통폐합)~~ · §2-1 ✅ 완료 (고아 페이지 확인 후 삭제)

### 3차 — 중복 제거·안전망 (1~2주) — ✅ 전체 완료
10. ESLint 설정 복구 · §3-6
11. ~~`defaultOrder`·색상추출·SAMPLE_RAW·클라이언트 단일화~~ · §4-2~4-5 ✅ 완료
    (클라이언트 2벌은 조사 후 의도된 방어 코드로 확인, 통합 안 함)
12. ~~미들웨어 → `proxy.ts` + 서버 세션 검증~~ · §3-4, §3-5 ✅ 완료
13. ~~Supabase 타입 생성 + 핵심 어댑터 단위 테스트~~ · §4-8, §5 ✅ 완료
    (타입은 CLI 대신 마이그레이션 기반 수기 작성, 클라이언트엔 아직 미적용)

### 4차 — legacy 청산 (진행 중)

14. ~~남은 legacy 테마 2개(봄날의 세레나데, 모던 에센스)를 템플릿 엔진으로 이관~~
    · ✅ **이관 대신 삭제로 처리**(사용자 결정). 두 테마 모두 `theme_versions`
    포함 DB에서 완전히 삭제했고, 남은 invitations 3건은 전부 Soft Envelope 사용 중이라
    참조 무결성 문제 없음(cascade 삭제 확인). `/templates`, `admin/assets/themes`
    양쪽 다 남은 3개(Soft Envelope/Romantic Film/Color Atelier)만 정상 표시되는 것을
    브라우저로 확인. → **이제 `themes` 테이블에 `render_engine='legacy'` 행이
    0개**다.

15. legacy 렌더러 4벌(`invitation-client.tsx`/`mobile-preview.tsx`/`orders/[id]`/
    `preview/template/[id]`) + `store.ts` 데이터 계층 제거 · §4-1, §4-6 — **보류**
    (사용자가 이번 세션에서는 코드 삭제를 미루기로 결정, 아래 발견 사항 참고)

    > ⚠️ **삭제 전 반드시 처리해야 할 선행 작업 발견**: `/invitation/[id]`
    > (legacy 렌더러 라우트)가 여전히 3곳에서 "배포된 청첩장 보기/링크 복사"
    > 용도로 하드코딩되어 있다 — 그리고 이 3곳 전부 **template 엔진 청첩장에도
    > 무조건 이 legacy 라우트를 가리킨다** (진짜 발행 URL인 `/w/{public_slug}`
    > 가 아님):
    > - `app/admin/(dashboard)/orders/page.tsx:126` — "링크 복사하기"
    > - `app/admin/(dashboard)/orders/[id]/page.tsx:687` — "배포된 화면 보기"
    > - `app/invitation/[id]/dashboard/page.tsx:480` — "청첩장 확인" 백링크
    >
    > 지금 남은 invitations 3건이 전부 template 엔진(Soft Envelope)이므로,
    > legacy 렌더러를 먼저 지우면 이 3개 버튼이 전부 깨진다. **legacy 렌더러
    > 삭제보다 먼저 이 3곳을 `/w/{invitation.public_slug}` 로 고쳐야 한다.**

16. ~~레거시 편집기 진입 차단~~ · §3-7 ✅ 완료 (이번 세션)

### 이후 — 보류 항목
17. **카카오맵 연동** — `MapIsland`(`slot-registry.tsx:349`)는 현재 플레이스홀더.
    JavaScript 키 발급(사용자 제공)이 선행 조건. 위 단계 완료 후 착수하기로 합의된 항목.

---

## 7. 확인이 필요한 결정 사항

| # | 결정 | 상태 |
|---|---|---|
| 1 | ~~`orders` 를 정식 테이블로 만들 것인가~~ | ✅ 확정 — §1-B 스키마대로 "제작 의뢰 이행 기록"으로 재정의. 결제 게이트웨이 불필요(네이버 스마트스토어가 처리) |
| 2 | `bgms` = 테이블 vs `settings` JSONB | 미결 — 9개 호출 지점 영향 |
| 3 | ~~`admin/templates` 화면을 `admin/assets/themes` 와 통폐합할 것인가~~ | ✅ 해소 — 애초에 사이드바 nav 에 없는 고아 페이지였음, `admin/users` 와 함께 삭제 |
| 4 | ~~legacy 테마 2개를 템플릿 엔진으로 이관할 것인가~~ | ✅ 확정 — 이관 대신 **삭제**. `themes` 테이블에 legacy 테마 0개. 단, legacy 렌더러 4벌 코드 자체 삭제는 §4-1의 링크 3곳 수정이 선행돼야 해서 보류 중 |
| 5 | `statistics` 를 실연동 전까지 숨길 것인가, "샘플" 배지로 남길 것인가 | 미결 — 운영 오판 리스크 |
