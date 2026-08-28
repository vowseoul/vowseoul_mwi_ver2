-- ============================================================================
-- 직원(디자이너) 권한 확대 — '시스템 설정'만 운영자 전용으로 남긴다
--
-- 지금까지 거의 모든 표가 is_admin() 전용이었다. 디자이너 계정은 로그인은 되지만
-- 고객도 청첩장도 폼도 열 수 없어 사실상 아무 일도 할 수 없었다(§proxy.ts 는 아예
-- /admin 진입 자체를 ADMIN 으로 막고 있었다).
--
-- 바꾸는 방향:
--   업무 데이터(고객·청첩장·폼·테마·문의·주문 등) → 로그인한 직원이면 누구나
--   시스템 설정(settings) 과 직원 계정(profiles 쓰기)  → 운영자(ADMIN)만
--
-- authenticated 를 그대로 쓰지 않고 is_staff() 를 새로 두는 이유: Supabase Auth 에
-- 계정만 있고 profiles 행이 없는 사용자(예: 어떤 경로로든 가입만 된 계정)까지
-- 업무 데이터에 닿으면 안 된다. profiles 에 등록된 사람만 직원으로 본다.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
$$;

GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- 정책 이름도 바꾼다. "by admin" 인데 실제로는 전 직원을 허용하면,
-- 다음에 이 파일을 읽는 사람이 이름만 보고 운영자 전용이라고 오해한다.

-- field_library
DROP POLICY IF EXISTS "field_library by admin" ON public.field_library;
DROP POLICY IF EXISTS "field_library by staff" ON public.field_library;
CREATE POLICY "field_library by staff" ON public.field_library
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- form_templates
DROP POLICY IF EXISTS "form_templates by admin" ON public.form_templates;
DROP POLICY IF EXISTS "form_templates by staff" ON public.form_templates;
CREATE POLICY "form_templates by staff" ON public.form_templates
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- form_template_versions
DROP POLICY IF EXISTS "form_template_versions by admin" ON public.form_template_versions;
DROP POLICY IF EXISTS "form_template_versions by staff" ON public.form_template_versions;
CREATE POLICY "form_template_versions by staff" ON public.form_template_versions
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- form_template_fields
DROP POLICY IF EXISTS "form_template_fields by admin" ON public.form_template_fields;
DROP POLICY IF EXISTS "form_template_fields by staff" ON public.form_template_fields;
CREATE POLICY "form_template_fields by staff" ON public.form_template_fields
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- block_library
DROP POLICY IF EXISTS "block_library by admin" ON public.block_library;
DROP POLICY IF EXISTS "block_library by staff" ON public.block_library;
CREATE POLICY "block_library by staff" ON public.block_library
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- block_variants
DROP POLICY IF EXISTS "block_variants by admin" ON public.block_variants;
DROP POLICY IF EXISTS "block_variants by staff" ON public.block_variants;
CREATE POLICY "block_variants by staff" ON public.block_variants
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- theme_versions
DROP POLICY IF EXISTS "theme_versions by admin" ON public.theme_versions;
DROP POLICY IF EXISTS "theme_versions by staff" ON public.theme_versions;
CREATE POLICY "theme_versions by staff" ON public.theme_versions
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- themes
DROP POLICY IF EXISTS "themes insert by admin" ON public.themes;
DROP POLICY IF EXISTS "themes insert by staff" ON public.themes;
CREATE POLICY "themes insert by staff" ON public.themes
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

-- themes
DROP POLICY IF EXISTS "themes update by admin" ON public.themes;
DROP POLICY IF EXISTS "themes update by staff" ON public.themes;
CREATE POLICY "themes update by staff" ON public.themes
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- themes
DROP POLICY IF EXISTS "themes delete by admin" ON public.themes;
DROP POLICY IF EXISTS "themes delete by staff" ON public.themes;
CREATE POLICY "themes delete by staff" ON public.themes
  FOR DELETE TO authenticated USING (public.is_staff());

-- form_instances
DROP POLICY IF EXISTS "form_instances insert by admin" ON public.form_instances;
DROP POLICY IF EXISTS "form_instances insert by staff" ON public.form_instances;
CREATE POLICY "form_instances insert by staff" ON public.form_instances
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

-- form_instances
DROP POLICY IF EXISTS "form_instances update by admin" ON public.form_instances;
DROP POLICY IF EXISTS "form_instances update by staff" ON public.form_instances;
CREATE POLICY "form_instances update by staff" ON public.form_instances
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- form_instances
DROP POLICY IF EXISTS "form_instances delete by admin" ON public.form_instances;
DROP POLICY IF EXISTS "form_instances delete by staff" ON public.form_instances;
CREATE POLICY "form_instances delete by staff" ON public.form_instances
  FOR DELETE TO authenticated USING (public.is_staff());

-- form_submissions
DROP POLICY IF EXISTS "form_submissions delete by admin" ON public.form_submissions;
DROP POLICY IF EXISTS "form_submissions delete by staff" ON public.form_submissions;
CREATE POLICY "form_submissions delete by staff" ON public.form_submissions
  FOR DELETE TO authenticated USING (public.is_staff());

-- customers
DROP POLICY IF EXISTS "customers by admin" ON public.customers;
DROP POLICY IF EXISTS "customers by staff" ON public.customers;
CREATE POLICY "customers by staff" ON public.customers
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- invitations
DROP POLICY IF EXISTS "invitations by admin" ON public.invitations;
DROP POLICY IF EXISTS "invitations by staff" ON public.invitations;
CREATE POLICY "invitations by staff" ON public.invitations
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- rsvp_responses
DROP POLICY IF EXISTS "rsvp read by admin" ON public.rsvp_responses;
DROP POLICY IF EXISTS "rsvp read by staff" ON public.rsvp_responses;
CREATE POLICY "rsvp read by staff" ON public.rsvp_responses
  FOR SELECT TO authenticated USING (public.is_staff());

-- guestbook_entries
DROP POLICY IF EXISTS "guestbook read by admin" ON public.guestbook_entries;
DROP POLICY IF EXISTS "guestbook read by staff" ON public.guestbook_entries;
CREATE POLICY "guestbook read by staff" ON public.guestbook_entries
  FOR SELECT TO authenticated USING (public.is_staff());

-- visit_logs
DROP POLICY IF EXISTS "visit_logs read by admin" ON public.visit_logs;
DROP POLICY IF EXISTS "visit_logs read by staff" ON public.visit_logs;
CREATE POLICY "visit_logs read by staff" ON public.visit_logs
  FOR SELECT TO authenticated USING (public.is_staff());

-- orders
DROP POLICY IF EXISTS "orders by admin" ON public.orders;
DROP POLICY IF EXISTS "orders by staff" ON public.orders;
CREATE POLICY "orders by staff" ON public.orders
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- inquiries
DROP POLICY IF EXISTS "inquiries read by admin" ON public.inquiries;
DROP POLICY IF EXISTS "inquiries read by staff" ON public.inquiries;
CREATE POLICY "inquiries read by staff" ON public.inquiries
  FOR SELECT TO authenticated USING (public.is_staff());

-- inquiries
DROP POLICY IF EXISTS "inquiries update by admin" ON public.inquiries;
DROP POLICY IF EXISTS "inquiries update by staff" ON public.inquiries;
CREATE POLICY "inquiries update by staff" ON public.inquiries
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- bgms
DROP POLICY IF EXISTS "bgms write by admin" ON public.bgms;
DROP POLICY IF EXISTS "bgms write by staff" ON public.bgms;
CREATE POLICY "bgms write by staff" ON public.bgms
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- faqs
DROP POLICY IF EXISTS "faqs write by admin" ON public.faqs;
DROP POLICY IF EXISTS "faqs write by staff" ON public.faqs;
CREATE POLICY "faqs write by staff" ON public.faqs
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- notices
DROP POLICY IF EXISTS "notices write by admin" ON public.notices;
DROP POLICY IF EXISTS "notices write by staff" ON public.notices;
CREATE POLICY "notices write by staff" ON public.notices
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- notifications
DROP POLICY IF EXISTS "notifications by admin" ON public.notifications;
DROP POLICY IF EXISTS "notifications by staff" ON public.notifications;
CREATE POLICY "notifications by staff" ON public.notifications
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- audit_logs
DROP POLICY IF EXISTS "audit logs by admin" ON public.audit_logs;
DROP POLICY IF EXISTS "audit logs by staff" ON public.audit_logs;
CREATE POLICY "audit logs by staff" ON public.audit_logs
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- invitation_revisions
DROP POLICY IF EXISTS "invitation revisions by admin" ON public.invitation_revisions;
DROP POLICY IF EXISTS "invitation revisions by staff" ON public.invitation_revisions;
CREATE POLICY "invitation revisions by staff" ON public.invitation_revisions
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- settings / profiles 는 손대지 않는다 — 시스템 설정과 직원 계정 관리는 운영자 몫이다.
-- (settings 읽기는 공개 화면이 쓰는 키 화이트리스트로 이미 열려 있다.)

NOTIFY pgrst, 'reload schema';
