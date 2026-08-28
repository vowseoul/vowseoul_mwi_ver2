-- ============================================================================
-- 공개 폼 쓰기도 서버 라우트로 — anon 의 form_* 권한 전면 회수
--
-- 바로 앞 마이그레이션(20260820000000)은 "읽기만 옮기고 쓰기는 anon 에 남긴다"는
-- 계획이었다. 그 계획은 성립하지 않는다. 적용 후 실제 요청으로 확인한 것:
--
--   upsert(on_conflict)        401  "GRANT SELECT ON public.form_submissions TO anon"
--   update ?id=eq.X (status)   401  WHERE 절이 참조하는 컬럼에도 SELECT 가 필요하다
--
-- PostgREST 의 쓰기는 읽기 권한 없이 성립하지 않는다. 충돌 검사와 필터가 SELECT 를
-- 끌어들이기 때문이다. 즉 anon 에게 쓰기를 남기려면 읽기도 열어둬야 하고, 그러면
-- 애초에 닫으려던 답변 유출이 그대로 남는다. 읽기/쓰기를 나눠 옮기려던 전제가
-- 틀렸으므로 여기서 함께 옮긴다.
--
-- (같은 함정을 방명록에서도 겪었다 — .insert().select() 의 RETURNING 이 SELECT 를
--  요구해 INSERT 까지 통째로 롤백됐다. 매번 형태만 다르고 원인은 같다.)
--
-- 이제 공개 폼의 읽기·쓰기가 전부 서버를 거친다:
--   조회   app/api/form-instance/route.ts
--   저장   app/api/form-answers/route.ts
--   고객   app/api/form-submit/route.ts  (기존)
--
-- 권한 판정도 바뀐다. 이전 신뢰 모델은 "instanceId 를 아는 것 = 제출 권한"이었고
-- 그 id 는 클라이언트가 보내는 값이었다. 이제 클라이언트는 슬러그만 보내고,
-- 어느 행에 쓸지는 서버가 정한다 — 남의 폼을 지목할 방법이 없다.
--
-- ⚠ 같은 커밋의 앱 코드와 함께 배포해야 한다.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- form_instances — anon 권한 전면 회수
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "form_instances public read" ON public.form_instances;
DROP POLICY IF EXISTS "form_instances status update by submitter" ON public.form_instances;

DROP POLICY IF EXISTS "form_instances read by staff" ON public.form_instances;
CREATE POLICY "form_instances read by staff" ON public.form_instances
  FOR SELECT TO authenticated USING (true);

-- 앞 단계에서 임시로 되돌렸을 수 있으므로 최종 상태를 다시 못 박는다
REVOKE ALL ON public.form_instances FROM anon;

-- ---------------------------------------------------------------------------
-- form_submissions — anon 권한 전면 회수. 직원 화면은 계속 읽고 고친다.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "form_submissions public read" ON public.form_submissions;
DROP POLICY IF EXISTS "form_submissions insert by anyone" ON public.form_submissions;
DROP POLICY IF EXISTS "form_submissions update by anyone" ON public.form_submissions;

DROP POLICY IF EXISTS "form_submissions read by staff" ON public.form_submissions;
CREATE POLICY "form_submissions read by staff" ON public.form_submissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "form_submissions write by staff" ON public.form_submissions;
CREATE POLICY "form_submissions write by staff" ON public.form_submissions
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "form_submissions edit by staff" ON public.form_submissions;
CREATE POLICY "form_submissions edit by staff" ON public.form_submissions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON public.form_submissions FROM anon;

NOTIFY pgrst, 'reload schema';
