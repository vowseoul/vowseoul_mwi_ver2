-- ============================================================================
-- 정보 수집 폼 비밀번호 서버 이관
--
-- 지금까지 form_instances.access_password 가 useFormInstanceBySlugQuery의
-- select('*') 로 그대로 브라우저에 내려가, 네트워크 탭에서 평문이 보이고
-- 클라이언트 JS에서 문자열 비교(===)까지 하고 있었다. 실제 비교는
-- app/api/form-auth/route.ts(신규, lib/dashboard-session.ts의 passwordMatches
-- 재사용)로 옮기고, 이 컬럼은 더 이상 select 하지 않는다.
--
-- 다만 "비밀번호가 아예 설정 안 된 폼은 자동 잠금해제"라는 기존 동작을 유지하려면
-- 클라이언트가 "설정 여부"만은 알아야 한다 — 값이 아니라 존재 여부이므로 노출해도
-- 안전하다. PostgREST 계산된 컬럼(함수가 테이블 행을 인자로 받으면 select에서
-- 컬럼처럼 쓸 수 있다)으로 boolean만 넘긴다.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.form_instances_has_password(public.form_instances)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT $1.access_password IS NOT NULL AND $1.access_password <> ''
$$;

GRANT EXECUTE ON FUNCTION public.form_instances_has_password(public.form_instances) TO anon, authenticated;
