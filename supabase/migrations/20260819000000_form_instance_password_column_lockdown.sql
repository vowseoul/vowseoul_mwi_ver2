-- ============================================================================
-- form_instances.access_password 실제 차단
--
-- 20260814000000_phase1_security_hardening.sql 이 이미 이걸 의도했다:
--
--   REVOKE SELECT (access_password) ON public.form_instances FROM anon, authenticated;
--
-- 그리고 주석에는 "관리자도 원문을 볼 수 없다"고 적혀 있다. 실제로는 익명 키만으로
-- 평문이 그대로 조회된다 — 확인 결과 200 응답에 값이 담겨 돌아온다.
--
-- 원인은 PostgreSQL 권한 규칙이다. 테이블 단위 SELECT 권한이 살아 있으면 컬럼 단위
-- REVOKE 는 아무 효과가 없다(테이블 권한이 컬럼 권한을 포괄한다). 즉 위 한 줄은
-- 에러 없이 성공했지만 하는 일이 없었다. 같은 파일 바로 위의 UPDATE 는 올바른 형태
-- (REVOKE UPDATE → GRANT UPDATE (status))로 돼 있어, 한 줄만 형태가 어긋난 셈이다.
--
-- 그래서 여기서는 테이블 SELECT 를 회수한 뒤 허용할 컬럼만 다시 부여한다.
--
-- ---------------------------------------------------------------------------
-- 함께 바꿔야 하는 것: has_password
--
-- 기존 form_instances_has_password(public.form_instances) 는 "행 전체"를 인자로
-- 받는 PostgREST 계산된 컬럼이다. 행 전체 참조는 모든 컬럼에 대한 SELECT 권한을
-- 요구하므로, access_password 를 회수하는 순간 이 함수도 같이 막힌다 — 그러면
-- "비밀번호 없는 폼은 자동 잠금해제"가 깨져 공개 폼 전체가 멈춘다.
--
-- 생성 컬럼(GENERATED ALWAYS AS ... STORED)으로 바꾼다. 값이 아니라 존재 여부만
-- 담기므로 노출해도 안전하고, 일반 컬럼이라 컬럼 단위 GRANT 가 그대로 먹는다.
-- 함수와 달리 권한 우회(SECURITY DEFINER)도 필요 없다.
--
-- ⚠ 이 마이그레이션은 같은 커밋의 앱 코드와 함께 배포해야 한다. 코드가 아직 옛
--   계산된 컬럼을 쓰고 있는 상태에서 이 SQL 만 먼저 적용하면 공개 폼이 잠시 멈춘다.
-- ============================================================================

-- 1) 존재 여부를 담는 생성 컬럼
ALTER TABLE public.form_instances
  ADD COLUMN IF NOT EXISTS has_password boolean
  GENERATED ALWAYS AS (access_password IS NOT NULL AND access_password <> '') STORED;

-- 2) 테이블 단위 SELECT 회수 → 허용 컬럼만 재부여 (access_password 제외)
REVOKE SELECT ON public.form_instances FROM anon, authenticated;

GRANT SELECT (
  id,
  customer_id,
  template_id,
  fields_snapshot,
  unique_url_slug,
  status,
  expires_at,
  created_at,
  has_password
) ON public.form_instances TO anon, authenticated;

-- 3) 행 전체를 요구하던 계산된 컬럼 제거 — 위 회수 이후로는 어차피 호출이 막힌다.
--    앱은 같은 커밋에서 has_password 컬럼을 직접 읽도록 바뀐다.
DROP FUNCTION IF EXISTS public.form_instances_has_password(public.form_instances);

-- 주의: service_role 은 이 회수의 대상이 아니다. 비밀번호 대조는 지금도 앞으로도
-- app/api/form-auth/route.ts 가 service_role 로만 수행한다.
--
-- 남은 항목(이번 범위 밖): 20260811020000 이전에 발행된 폼에는 access_password 가
-- 평문으로 남아 있다(form-auth 가 isHashedDashboardPassword 로 형식을 가려 레거시
-- 평문도 받아준다). 이제 외부에서는 읽을 수 없지만 저장 형태는 여전히 평문이므로,
-- 재해싱은 별도로 판단한다.

-- PostgREST 스키마 캐시 갱신 — 새 컬럼(has_password)을 즉시 인식시킨다.
-- Supabase 는 보통 DDL 이벤트로 자동 갱신하지만, 안 되면 새 컬럼이 "찾을 수 없는
-- 컬럼"으로 400 을 돌려주므로 명시적으로 한 번 알린다.
NOTIFY pgrst, 'reload schema';
