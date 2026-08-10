# VOW SEOUL 기능 확장 계획서

> 작성일: 2026-08-09 (최종 수정: 2026-08-10) · 기준 브랜치: `beta` (`f94f1a5`)
> 현재 코드베이스 실측 분석 기반. 기존 `STATUS.md §3 다음 작업 과제`를 포함·확장한다.
>
> **범위 확정(2026-08-10):** 랜딩페이지·결제 연동(Phase 4)과 알림톡 자동화(A2)는
> **당분간 진행하지 않는다.** 둘 다 외부 서비스 연동에 건당/월 비용이 추가로 발생하는
> 항목이라 별도 예산·일정 논의 후 착수한다. 이 문서에는 §9에 계획만 남겨두고,
> 그 외 나머지 항목을 먼저 진행한다.

---

## 1. 한 줄 진단

**현재 시스템은 "제작 도구"는 잘 갖췄지만 "고객과의 왕복"이 전부 시스템 밖(카톡·전화)에 있다.**

청첩장을 만드는 엔진(테마 템플릿, 슬롯 아일랜드, 폼 빌더, 토큰 편집기)은 이미 상당히 정교하다.
문제는 고객 접점이 **딱 3개**뿐이고, 그 사이의 모든 소통이 수작업이라는 점이다.

```
[고객 접점 1]          [   시스템 밖 - 전부 수동   ]          [고객 접점 2]     [고객 접점 3]
폼 1회 제출      →   카톡으로 폼 링크 전달                →   완성 링크 수령  →  조회 전용
/form/[slug]          카톡으로 미제출 독촉                     (수동 전달)        대시보드
                      카톡으로 시안 확인 요청
                      카톡으로 "여기 오타요" ↔ "어디요?"
                      카톡으로 수정 반영 통보
                      카톡으로 발행 완료 안내
```

**결과: 매출이 늘면 인건비가 같은 기울기로 늘어난다.** 자동화 여지가 가장 큰 지점이 여기다.
(단, 이번 라운드에서는 외부 발송망 없이 "링크 수동 전달" 전제로 진행한다 — §9 참고)

---

## 2. 현재 구현 상태 지도

### 2.1 이미 잘 되어 있는 것 (건드리지 말 것)

| 영역 | 구현 |
|---|---|
| 렌더링 엔진 | `InvitationFrame` 단일 렌더러를 미리보기·발행이 공유 → 드리프트 없음 |
| 테마 시스템 | iframe 격리 + CSS 변수 토큰 + `[data-field]`/`[data-slot]`/`[data-block]` 계약 |
| 하객 기능 | 10개 슬롯 아일랜드 (BGM·갤러리·식순·캘린더·지도·계좌·연락처·RSVP·방명록·공유) |
| 길찾기 | 네이버/카카오/티맵 3사 딥링크 (`MapIsland`, `naver-map.tsx`) |
| 폼→초안 파이프라인 | `buildContentDataFromForm` / `deriveOgMetaFromForm` / `deriveOverridesFromForm` / `resolveBgmUrlFromSnapshot` |
| 신랑신부 인증 | 서명 httpOnly 쿠키 (`lib/dashboard-session.ts`) — 서버 검증 |
| 개인정보 정책 | 예식일 +7일 대시보드 만료 / +14일 하객 데이터 자동 파기 |
| 하객 명단 내보내기 | 대시보드에서 RSVP·방명록 CSV 다운로드 (BOM 포함, 엑셀 호환) |

### 2.2 스키마만 있고 코드가 없는 것 (⚠️ 발견 사항)

| 테이블 | 상태 |
|---|---|
| `notifications` | `type` enum까지 정의(`form_submitted`/`draft_failed`/`link_expiring`/`theme_error`)되어 있으나 **INSERT하는 코드가 한 줄도 없음.** 관리자 인앱 알림 미구현 |
| `visit_daily_stats` | **한 번도 쓰이지 않음.** `visit_logs` 원본만 무한 누적 → 청첩장당 수천 행 쌓이면 통계 쿼리가 선형으로 느려짐 |
| `archived_invitations` | 스냅샷 구조는 있으나 아카이브 로직 미연결 |
| `orders.amount` | 수기 입력. 결제 연동 없음 (`settings`에 PG사 선택 UI만 존재: 토스/카카오/네이버/이니시스) — §9 보류 |

### 2.3 의도적으로 꺼둔 것

`app/page.tsx` = `redirect('/admin')`.
`STATUS.md §2.1`에 따르면 홍보용 랜딩을 **의도적으로 제거**한 상태다.
다만 `hero-section.tsx` · `header.tsx` · `footer.tsx` · `/templates` · `/contact` · `/preview/theme/[id]` 컴포넌트는
**모두 살아 있고 동작한다.** 배선만 끊긴 상태 → §9 보류 항목, 필요해지는 시점에 저비용으로 복구 가능.

---

## 3. 핵심 병목 3가지

### 병목 ① 시안 검수 루프가 시스템 밖에 있다 — **업체 인건비 직결**

고객은 `draft` 상태 청첩장을 볼 방법이 없다. 그래서:
- 업체가 스크린샷을 찍어 카톡으로 보냄
- 고객이 "세 번째 사진 밑에 글자 오타요" → 업체가 "어느 사진이요?" → 왕복 3~5회
- 건당 20~40분 소모. 수정 요청은 평균 2~3라운드.

**블록 단위로 코멘트를 앵커링할 수만 있어도 이 왕복이 사라진다.**
그리고 이걸 구현할 재료가 이미 다 있다 — `InvitationFrame`은 `[data-block]`을 알고 있고,
`focusBlock` prop으로 특정 블록 스크롤까지 지원한다.
(검수 요청 알림은 이번 라운드엔 자동발송 없이 관리자가 링크를 직접 전달하는 방식으로 시작한다.)

### 병목 ② 고객이 오타 하나도 스스로 못 고친다

폼 제출은 1회성이다. 이후 모든 수정은 업체를 거쳐야 한다.
정작 `content_data`(jsonb) + 필드 정의 기반 폼 렌더러(`/form/[slug]`)가 이미 있으므로,
**"수정 가능 필드 화이트리스트"만 정의하면 셀프 편집을 재사용으로 구현할 수 있다.**

### 병목 ③ 나가는 알림이 0건

`notifications` 테이블은 비어 있고, 외부 발송(알림톡/SMS/이메일) 연동은 없다.
폼 링크·독촉·시안 요청·발행 완료를 **전부 사람이 카톡으로 보낸다.**
→ 외부 발송 자동화(알림톡)는 건당 비용이 발생해 **§9로 보류**하고, 이번 라운드에는
**관리자 인앱 알림(A3, 무료·내부용)만 먼저 구현**해 "누가 언제 뭘 해야 하는지"라도 시스템이 알려주게 한다.

---

## 4. 기능 후보 리스트업

우선순위 = 임팩트 ÷ 구현비용. **P0 = 지금 당장, P1 = 다음 분기, 보류 = §9(외부 비용 발생, 추후 진행).**

### 4.1 업체(운영) 관점

| # | 기능 | 임팩트 | 비용 | 우선 |
|---|---|---|---|---|
| A1 | **시안 검수 & 수정요청 워크플로** (고객이 draft 보고 블록별 코멘트) | 매우 높음 | 중 | **P0** |
| A2 | ~~알림 자동화 (알림톡)~~ | 매우 높음 | 중 + 외부 종량비 | **보류 (§9)** |
| A3 | 관리자 인앱 알림 (`notifications` 테이블 활성화) | 중 | 낮음 | **P0** |
| A4 | 고객 상태 자동 전이 (폼 완료 → 초안 자동 생성 트리거) | 중 | 낮음 | P1 |
| A5 | 작업 이력·감사 로그 (누가 언제 무엇을 바꿨나) | 중 | 중 | P1 |
| A6 | `visit_daily_stats` 집계 배치 (성능 부채 상환) | 낮음(지금)<br>높음(1년 후) | 낮음 | P1 |
| A7 | ~~결제 연동~~ (토스페이먼츠/포트원) | 높음* | 높음 | **보류 (§9)** |
| A8 | ~~공개 랜딩 + 템플릿 갤러리 복구~~ (유입 퍼널) | 높음* | 낮음 | **보류 (§9)** |
| A9 | 테마 ZIP 업로드 파서 고도화 (`STATUS.md §3-1`) | 중 | 높음 | P1 |

*A7/A8은 **셀프서비스 주문 모델로 갈 때만** 임팩트가 높다. 현재 상담 기반 B2C 모델에서는 보류가 합리적이다.

### 4.2 신랑신부(고객) 관점

| # | 기능 | 임팩트 | 비용 | 우선 |
|---|---|---|---|---|
| B1 | **시안 확인 & 수정요청** (A1의 고객측 화면) | 매우 높음 | — | **P0** |
| B2 | **셀프 편집** (텍스트·사진 화이트리스트) | 높음 | 중 | **P1** |
| B3 | ~~RSVP 응답 알림~~ (일일 요약 / 마감 임박) | 중 | 낮음* | **보류 (§9, A2 의존)** |
| B4 | 카카오톡 공유 카드 (Kakao JS SDK — 알림톡과 무관, 무료) | 중 | 낮음 | P1 |
| B5 | RSVP 마감일 설정 (날짜 필드 + 마감 배지, 발송 없이 화면 표시만) | 중 | 낮음 | P1 |
| B6 | 방명록 관리 강화 (스팸 차단, 일괄 숨김) | 낮음 | 낮음 | P1 |

*B3는 신랑신부에게 "나가는" 알림이라 알림톡/SMS 같은 외부 발송망이 있어야 의미가 있다. A2가 보류되므로
함께 보류하고, A2 착수 시 재검토한다.

> **B4 카카오톡 공유 카드**는 알림톡(비즈메시지 발송)과 전혀 다른 것 — 하객이 자기 카톡으로
> "청첩장 보내기" 버튼을 눌러 공유하는 **무료 클라이언트 SDK**(Kakao JS SDK, 앱 키만 발급받으면 됨)라
> 이번 라운드에 포함한다. `slot-registry.tsx`의 기존 `ShareIsland`(Web Share API 폴백)에 카카오 공유를
> 얹는 형태로, 알림톡 파트너사 연동과는 완전히 독립적이다.

### 4.3 하객 관점 — **저비용·고체감 (묶어서 하루면 끝)**

| # | 기능 | 현재 상태 | 비용 |
|---|---|---|---|
| C1 | **캘린더에 일정 추가** (.ics / Google Calendar 링크) | `CalendarIsland`는 있으나 추가 버튼 없음 | 매우 낮음 |
| C2 | **축의금 송금 딥링크 개선** | 현재 `kakaotalk://kakaopay/home` — 앱만 열리고 사용자가 직접 붙여넣어야 함. 토스 송금 링크 추가 여지 | 낮음 |
| C3 | RSVP 중복 제출 방지 / 응답 수정 | 무제한 중복 제출 가능 | 낮음 |
| C4 | 방명록 사진·이모지 | 텍스트만 | 중 |
| C5 | 갤러리 이미지 지연 로딩·최적화 | 원본 로드 | 중 |

---

## 5. 로드맵 (진행분만)

```
Phase 0 (1~2주)  ── 하객 QoL 묶음 + 관리자 인앱 알림
                    C1 캘린더 추가 · C2 송금 딥링크 · C3 RSVP 중복 방지
                    A3 notifications 활성화 (내부용, 외부 발송 없음)
                    ↳ 저비용·즉시 체감. 팀이 워밍업하며 배포 파이프라인 검증

Phase 1 (3~5주)  ── ★ 시안 검수 루프  ← 최우선
                    A1 + B1 (관리자측 + 고객측)
                    검수 요청 알림은 자동발송 없이 "링크 복사해서 전달"로 시작
                    ↳ 업체 인건비를 가장 크게 줄이는 단일 기능. 알림톡 없이도 완결됨

Phase 2 (4~6주)  ── 고객 셀프화 + 잔여 저비용 기능
                    B2 셀프 편집 · A5 감사 로그 · A4 자동 초안 · A6 집계 배치
                    B4 카카오 공유 카드(무료 SDK) · B5 RSVP 마감일 표시 · B6 방명록 관리
                    A9 테마 ZIP 파서 고도화

§9 보류 (외부 비용 발생, 별도 논의 후 착수)
                    A2 알림톡 자동화 + B3 RSVP 알림
                    A8 랜딩·갤러리 복구 → A7 결제 연동
```

> Phase 1(시안 검수)과 Phase 2(셀프 편집) 모두 **외부 발송망 없이 완결되도록 설계**했다.
> 검수 요청·완료 안내는 관리자가 대시보드에서 링크를 복사해 카톡으로 직접 보내는 것을
> 전제로 하며, 이는 지금과 동일한 수작업이지만 "왕복 확인"이라는 가장 비싼 부분만 없앤다.
> 나중에 §9(A2)를 붙이면 이 "링크 복사" 지점만 자동발송으로 치환하면 되므로 재작업이 거의 없다.

---

## 6. 상세 구현 계획 (진행분)

### 6.1 [P0] A1+B1 — 시안 검수 & 수정요청 워크플로

**목표:** 고객이 발행 전 초안을 직접 보고, 고칠 부분을 **블록 단위로 찍어서** 요청한다.

#### 데이터 모델

```sql
-- 새 테이블
CREATE TABLE public.invitation_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  round integer NOT NULL DEFAULT 1,          -- 검수 회차
  block_key text,                            -- 'gallery', 'greeting' … NULL이면 전체 코멘트
  field_key text,                            -- 특정 필드 지목 시
  note text NOT NULL,                        -- 고객이 쓴 요청 내용
  status text NOT NULL CHECK (status IN ('open','resolved','rejected')) DEFAULT 'open',
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX ON public.invitation_revisions (invitation_id, status);

-- invitations 확장
ALTER TABLE public.invitations
  ADD COLUMN review_status text
    CHECK (review_status IN ('none','in_review','changes_requested','approved'))
    DEFAULT 'none',
  ADD COLUMN review_round integer NOT NULL DEFAULT 0;
```

> `invitations.status`(draft/published/paused/expired)는 **발행 상태**,
> `review_status`는 **검수 상태**로 축을 분리한다. 기존 enum에 값을 끼워 넣으면
> 발행 로직·필터·배지가 전부 영향을 받으므로 별도 컬럼이 안전하다.

#### 고객측 화면 — `app/review/[slug]/page.tsx` (신규)

- 인증: **기존 `lib/dashboard-session.ts` 그대로 재사용.** 새 인증 체계를 만들지 않는다.
  `/dashboard/[slug]` 비밀번호 게이트 → 서명 쿠키 → 검수 화면.
- 렌더: `InvitationFrame`을 그대로 사용해 draft를 실제 청첩장과 동일하게 보여준다.
- 코멘트 앵커링 — **여기가 핵심이고, 기존 구조로 거의 공짜다:**
  ```
  iframe 내부 클릭 이벤트
    → e.target.closest('[data-block]')  ← 이미 모든 테마가 붙이고 있는 속성
    → block_key 확보
    → "이 부분 수정 요청" 시트 오픈
  ```
  `InvitationFrame`은 이미 `doc`(iframe Document) 참조를 들고 있고
  `focusBlock` prop으로 블록 스크롤도 한다. **이벤트 리스너 하나만 추가하면 된다.**
- 하단 고정 바: `수정 요청 N건 담기` / `이대로 확정합니다`

#### 관리자측

- 청첩장 에디터(`customize-client.tsx`)에 **"수정 요청" 패널** 추가
  - `open` 상태 요청 목록 → 클릭 시 기존 `focusBlock` prop으로 미리보기가 해당 블록으로 스크롤
  - 처리 완료 체크 → `status='resolved'`
- 고객 상세 페이지에 검수 라운드 요약 배지
- `[검수 요청 보내기]` 버튼 → `review_status='in_review'` + **검수 링크를 클립보드에 복사**
  (자동발송은 §9 A2 착수 시 이 지점에 붙인다)

#### 검증 기준
- [ ] 초안 링크로 접속 시 실제 발행본과 픽셀 동일하게 렌더
- [ ] 임의 블록 클릭 → 정확한 `block_key`가 잡힘 (테마 3종 이상에서)
- [ ] 관리자가 요청 클릭 → 미리보기가 해당 블록으로 스크롤
- [ ] 쿠키 없이 `/review/[slug]` 직접 접근 시 비밀번호 게이트로 리다이렉트

**예상 공수: 8~12일**

---

### 6.2 [P0] A3 — 관리자 인앱 알림 (스키마 활성화)

`notifications` 테이블이 이미 정확한 형태로 존재한다. **INSERT하는 쪽만 만들면 된다.**
외부 발송이 아니라 **관리자 화면 안에서만 도는 내부 알림**이라 비용이 없다.

- `app/api/form-submit/route.ts`에 폼 제출 시 `type='form_submitted'` INSERT 추가
  (이미 service_role 클라이언트를 쓰고 있어 RLS 문제 없음)
- 6.1의 검수 요청 처리(`invitation_revisions` open→resolved)에 `type='draft_failed'`류 알림 연동
- 만료 임박(`type='link_expiring'`)은 기존 purge 크론(`app/api/cron/purge-expired-invitations`)에 한 줄 추가
- 헤더에 벨 아이콘 + 드롭다운, `is_read` 토글

**예상 공수: 2~3일**

---

### 6.3 [P0] Phase 0 하객 QoL 묶음 (C1·C2·C3)

전부 `components/invitation/slot-registry.tsx` 안에서 끝난다.

**C1 캘린더 추가** — `CalendarIsland`에 버튼 추가
- iOS/macOS: `.ics` data URI (`data:text/calendar;charset=utf8,...`)
- Android/기타: Google Calendar 템플릿 URL
- 예식일·시간·장소는 이미 `data.wedding_date` / `wedding_time` / `venue_name`으로 들어와 있음

**C2 송금 딥링크** — `AccountIsland`
- 현재 `kakaotalk://kakaopay/home`은 앱 홈만 열어 사용자가 계좌를 직접 붙여넣어야 함
- 토스 송금 링크(`supertoss://send?bank=..&accountNo=..&amount=`) 병행 제공 검토
- ⚠️ 딥링크 스킴은 비공식·변동 가능 → **복사 버튼을 항상 폴백으로 유지**

**C3 RSVP 중복 방지** — `RsvpIsland` + `rsvp_responses`
- 현재 같은 사람이 무제한 제출 가능 → 집계가 오염됨
- `(invitation_id, phone)` 부분 유니크 인덱스 + 기존 응답 있으면 수정 모드로 전환
- ⚠️ 기존 중복 데이터 정리 마이그레이션이 선행되어야 함

**예상 공수: 3~4일 (묶음)**

---

### 6.4 [P1] B2 — 고객 셀프 편집

**핵심 원칙: 편집 범위를 화이트리스트로 좁힌다.** 디자인 토큰(색·폰트·여백)은 절대 열지 않는다.
품질 관리가 업체의 차별점이고, 열어주면 "이상해졌어요" 문의가 오히려 늘어난다.

| 허용 | 불허 |
|---|---|
| 인사말·이름 표기·연락처 | 색상/폰트 토큰 |
| 계좌 정보 | 테마 변경 |
| 갤러리 사진 교체·순서 | 블록 순서·표시 여부 |

- 재사용: `/form/[slug]`의 필드 렌더러 로직을 편집 폼으로 전용
- 저장 경로: `invitations.content_data` merge (기존 `mergeInvitationRaw` 규칙 유지)
- 이미지: **반드시 `lib/image-upload.ts` 경유** (리사이즈 + Storage). base64 DB 저장 금지
- 발행 후 수정은 **즉시 반영 + 변경 이력 기록**을 권장 (검수 재요청은 마찰이 큼)

**예상 공수: 7~10일**

---

### 6.5 [P1] B4 — 카카오톡 공유 카드 (무료, 알림톡과 무관)

- Kakao JS SDK(`Kakao.Share.sendDefault`)로 하객이 자기 카톡에 청첩장 카드를 공유
- 카카오 개발자 콘솔에서 **JavaScript 앱 키만 발급**받으면 됨 (비즈메시지 파트너사 계약 불필요, 무료 티어)
- `slot-registry.tsx`의 `ShareIsland`(현재 Web Share API 우선, 실패 시 클립보드 복사)에
  카카오 공유를 우선 옵션으로 추가
- 썸네일·제목·설명은 이미 `invitations.og_meta`(카카오 공유 필드 → `deriveOgMetaFromForm`)에 있는 값 재사용

**예상 공수: 2~3일**

---

### 6.6 [P1] A6 — `visit_daily_stats` 집계 (성능 부채)

지금은 문제가 없지만 **방치하면 반드시 터진다.**
`visit_logs`는 방문마다 1행이고, 인기 청첩장은 수천 행이 쌓인다.
현재 신랑신부 대시보드와 관리자 통계가 **원본 전체를 매번 SELECT**한다.

- 일 1회 크론으로 `visit_daily_stats` upsert (테이블·유니크 제약 이미 존재)
- 대시보드·통계는 집계 테이블 우선 조회, 당일분만 원본 조회
- 원본은 예식일 +14일 파기 정책에 이미 포함되어 있으므로 무한 증식은 아님 → **P1로 충분**

**예상 공수: 2~3일**

---

## 7. 권장하지 않는 것 / 주의

| 항목 | 판단 |
|---|---|
| **고객에게 디자인 토큰 편집 개방** | 하지 말 것. 품질 관리가 업체의 차별점이고, 문의가 오히려 늘어난다 |
| **`invitations.status`에 검수 상태 끼워넣기** | 발행 로직·필터·배지가 전부 영향받는다. 별도 `review_status` 컬럼으로 |
| **딥링크 단독 의존** | 카카오페이/토스 스킴은 비공식이며 변동된다. 복사 버튼 폴백 유지 |
| **알림톡 없이 B3(RSVP 알림)를 무리하게 구현** | 인앱 알림으로는 신랑신부에게 도달 못함(로그인 계정이 없음) — 외부 발송망 없이는 의미가 작아 §9와 함께 보류 |

### 기존 기술 부채 (이번 계획과 별개, 착수 전 정리 권장)

- `hooks/queries/useForms.ts`의 `FieldLibraryItem['field_type']` TS union이 실제 런타임 값과 불일치
  (`rselect`/`select_text`/`mselect`/`toggle`/`music`/`timentext` 누락) → `tsc` 에러 6건 상존
- `customers/new`·`forms` 생성 시 `created_by` 누락 → 타입 에러
- `bgms` 테이블 스키마 드리프트: `genre`/`hashtags` 컬럼이 실제 DB엔 있으나 마이그레이션 파일엔 없음
- `customers/[customerId]/page.tsx:52` — `React.useRouter` 오타 (미사용 죽은 변수)

---

## 8. 요약 (진행분 기준)

**지금 당장 해야 할 단 하나를 고른다면 → 6.1 시안 검수 워크플로.**

- 업체 인건비를 가장 크게 줄인다
- 고객 만족도가 가장 크게 오른다 (기다림 → 통제감)
- **구현 재료가 이미 다 있다** — `InvitationFrame`, `[data-block]` 계약, `focusBlock`, 서명 쿠키 인증
- 새로 만드는 건 테이블 1개 + 컬럼 2개 + 화면 1개
- **알림톡 없이도 완결된다** — 검수 요청 전달은 당분간 관리자가 링크를 복사해 수동으로 보낸다

그 다음은 Phase 0(하객 QoL + 인앱 알림, 저비용·즉시 체감)으로 워밍업 후,
Phase 2(셀프 편집·카카오 공유 카드 등)로 이어간다. 알림톡·랜딩·결제는 §9에 계획만 남겨두고
이번 라운드 범위에서 제외한다.

---

## 9. 보류 항목 (외부 비용 발생 — 추후 별도 논의 후 진행)

두 항목 모두 **외부 서비스 연동에 건당/월 비용이 드는 것**이 공통 사유다. 지금 당장 진행하지 않되,
나중에 필요해졌을 때 바로 시작할 수 있도록 조사 내용과 설계를 남겨둔다.

### 9.1 A2 + B3 — 알림톡 자동화

**왜 비용이 드는가:** 카카오는 알림톡 발송용 공개 API를 제공하지 않는다. 반드시 카카오가 인증한
비즈메시지 파트너사(솔라피/알리고/NHN Cloud/NCP SENS 등)를 거쳐야 하며, 이는 스팸 방지·템플릿
심사를 카카오가 파트너사에 위임한 구조적 설계라 우회할 방법이 없다. 파트너사는 **건당 발송비**
(대략 8~15원/건, 실패 시 대체발송되는 SMS/LMS는 더 비쌈)를 받는 종량제 구조다.

**파트너사 후보**

| 구분 | 업체 | 특징 |
|---|---|---|
| 개발자 친화 (단독 API) | **솔라피(Solapi)** | REST API 심플, Node SDK 있음, 소규모/스타트업에 제일 많이 쓰임 — 현재 스택(Vercel+Supabase)에 가장 적합 |
| 개발자 친화 (단독 API) | 알리고(Aligo) | SMS 강자, 알림톡은 부가 신청 필요 |
| 클라우드 결합형 | NHN Cloud Notification, 네이버클라우드 SENS | 해당 클라우드 프로젝트/IAM 체계 안에 들어가야 함 — 현재 스택엔 부적합 |
| 엔터프라이즈 | 인포뱅크, 다우기술, KT 등 | 대량 발송·SLA 계약 중심, 소규모엔 과함 |

**착수 시 절차**
1. 파트너사 가입 + 사업자 인증 (계정 생성이라 대표님이 직접 진행)
2. 기존 카카오 비즈니스 채널을 파트너사 대시보드에 연동 (발신 프로필 승인)
3. 템플릿 사전 심사 신청 — `#{변수}` 치환만 가능, 광고성 문구 반려. 심사는 영업일 1~3일,
   밀리면 최대 1주. VOW SEOUL 필요 템플릿 5종(폼 발송/독촉/시안요청/발행완료/RSVP 요약)을
   한 번에 신청
4. 승인된 템플릿에 웹링크 버튼 첨부 가능 → 6.1 검수 링크를 메시지 안에 바로 삽입
5. 실패 시 SMS/LMS 자동 대체발송 반드시 활성화

**구조 (착수 시 그대로 사용)**

```
lib/notify/
  index.ts        — sendNotification(type, to, vars) 단일 진입점
  provider.ts     — 공급자 어댑터 인터페이스 (파트너사 교체 가능하도록 분리)
  templates.ts    — 템플릿 코드 ↔ 변수 매핑
```

```sql
CREATE TABLE public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  invitation_id uuid REFERENCES public.invitations(id) ON DELETE SET NULL,
  channel text NOT NULL,                     -- 'alimtalk' | 'sms' | 'email'
  template_code text NOT NULL,
  recipient text NOT NULL,
  payload jsonb,
  status text NOT NULL CHECK (status IN ('queued','sent','failed')) DEFAULT 'queued',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

발송 시점 5개(고객 등록→폼 발송 / 미제출 독촉 D+3·D+7 / 검수 요청 / 발행 완료 / 예식 D-7 RSVP 요약),
배치는 기존 `app/api/cron/purge-expired-invitations/route.ts` 패턴 재사용. 발송 이력을
`notification_logs`에 남기지 않으면 "안 왔다" 클레임에 대응 불가하므로 필수.

예상 공수: 6~9일 (+ 파트너사 가입·템플릿 심사 대기 1~2주, 코드와 병행 가능)

### 9.2 A8 → A7 — 랜딩 복구 & 결제 연동

셀프서비스 주문 모델로 전환할 때만 임팩트가 크다. 현재는 상담 기반 B2C라 우선순위 낮음.
`hero-section.tsx`/`header.tsx`/`footer.tsx`/`/templates`/`/contact`는 이미 구현되어 있고
`app/page.tsx`의 리다이렉트만 걷어내면 되므로, **착수 결정만 나면 랜딩 자체는 저비용으로 복구 가능**.
결제(토스페이먼츠/포트원 등)는 랜딩으로 유입 퍼널이 생긴 뒤에 순서대로 붙인다 — 결제만 먼저
붙이면 쓸 곳이 없다.
