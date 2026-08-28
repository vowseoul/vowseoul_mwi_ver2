-- ============================================================================
-- 공개 폼 읽기를 서버 라우트로 일원화 — anon 의 SELECT 회수
--
-- 지금까지 브라우저가 anon 키로 form_instances 를 직접 조회했고, 그 한 번의 쿼리에
-- form_submissions(제출한 답변 전체)와 customers(신랑신부 이름)가 임베드로 딸려왔다.
-- 문제가 셋이었다:
--
--  1. 답변이 비밀번호 확인보다 먼저 도착했다. 잠금 화면은 그 위에 덮이는 UI 일 뿐이라
--     슬러그만 알면 네트워크 탭에서 답변이 그대로 보였다 — 비밀번호가 정작 지키기로 한
--     데이터를 지키지 않고 있었다.
--  2. form_instances 목록 조회가 열려 있어 슬러그를 전부 나열할 수 있었다. 이 앱의
--     신뢰 모델은 "슬러그를 아는 것 = 접근 권한"인데, 그 슬러그가 공개돼 있었다.
--  3. form_submissions 는 RLS 가 anon 전체 읽기(USING true)라, 슬러그를 몰라도
--     모든 고객의 이름·연락처·예식장 주소를 통째로 읽을 수 있었다.
--
-- 이제 조회는 app/api/form-instance/route.ts 한 곳에서만 일어난다. 슬러그를 정확히
-- 알아야 하고, 비밀번호가 걸린 폼이면 서명된 잠금해제 쿠키(§lib/form-session.ts)까지
-- 있어야 답변이 내려간다.
--
-- ⚠ 이 마이그레이션은 같은 커밋의 앱 코드와 함께 배포해야 한다. SQL 만 먼저 적용하면
--   아직 anon 으로 직접 조회하는 코드가 폼을 못 읽는다.
--
-- 이번 범위 밖: 쓰기(임시저장·제출)는 아직 anon 이 직접 한다. INSERT/UPDATE 권한을
-- 그대로 두는 이유이고, 소유권 검증은 다음 단계에서 같은 방식으로 옮긴다.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- form_instances / form_submissions — anon 의 읽기만 회수한다.
--
-- 로그인한 직원(authenticated)의 범위는 일부러 그대로 둔다. customers 는 이미
-- is_admin() 전용이라 여기도 맞추고 싶은 마음이 들지만, 그건 직원 권한 등급을
-- 바꾸는 제품 판단이지 이번 조치의 목적이 아니다 — 지금 닫으려는 건 anon 이다.
--
-- 정책도 함께 다시 쓴다. 권한만 회수하고 정책에 TO anon 이 남아 있으면, 나중에
-- 누군가 GRANT 한 줄로 조용히 다시 열린다.
--
-- 주의: anon 의 upsert(INSERT ... ON CONFLICT DO UPDATE)가 SELECT 권한을 요구하지
-- 않는지 적용 후 실제 요청으로 확인한다. 요구했다면 임시저장·제출이 조용히 실패한다
-- — 방명록에서 겪은 것과 같은 함정이다(RETURNING/충돌검사가 SELECT 를 끌어들인다).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "form_instances public read" ON public.form_instances;
DROP POLICY IF EXISTS "form_instances read by staff" ON public.form_instances;

CREATE POLICY "form_instances read by staff" ON public.form_instances
  FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.form_instances FROM anon;

DROP POLICY IF EXISTS "form_submissions public read" ON public.form_submissions;
DROP POLICY IF EXISTS "form_submissions read by staff" ON public.form_submissions;

CREATE POLICY "form_submissions read by staff" ON public.form_submissions
  FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.form_submissions FROM anon;

NOTIFY pgrst, 'reload schema';
