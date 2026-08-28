-- ============================================================================
-- Phase 1 보안 긴급 대응 — RLS 하드닝
--
-- 남아있던 미보호 16개 테이블(profiles/field_library/form_templates/
-- form_template_versions/form_template_fields/form_instances/form_submissions/
-- block_library/block_variants/themes/theme_versions/invitation_blocks/
-- visit_daily_stats/account_info/archived_invitations/settings)에 RLS를 켜고,
-- 기존에 "관리자용"이라는 이름으로 만들어졌지만 실제로는 TO authenticated
-- USING (true) 라서 어떤 로그인 계정이든(DESIGNER 포함, proxy.ts는 페이지
-- 단위 가드일 뿐 Supabase REST API 직접 호출은 막지 못한다) 통과하던 정책들을
-- is_admin() 기반으로 좁힌다.
-- ============================================================================

-- profiles 를 직접 서브쿼리하는 정책이 profiles 자신에게 걸리면 정책 평가 중
-- profiles 를 다시 조회하는 순환이 생길 수 있어 SECURITY DEFINER 함수로 분리한다.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- -------------------------------------------------------------------------
-- 1. profiles — role 상승 경로 차단
--    읽기는 authenticated 전체(본인 role 판정 + 담당자 드롭다운에 필요),
--    쓰기(직원 계정 생성/수정/삭제)는 is_admin() 인 계정만.
-- -------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles read by authenticated" ON public.profiles;
CREATE POLICY "profiles read by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles insert by admin" ON public.profiles;
CREATE POLICY "profiles insert by admin" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles update by admin" ON public.profiles;
CREATE POLICY "profiles update by admin" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles delete by admin" ON public.profiles;
CREATE POLICY "profiles delete by admin" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_admin());

-- -------------------------------------------------------------------------
-- 2. 순수 관리자 전용 카탈로그 — 공개 접점 없음 (Explore 조사로 확인)
-- -------------------------------------------------------------------------
ALTER TABLE public.field_library          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_template_fields   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_library          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_variants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_versions         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "field_library by admin" ON public.field_library;
CREATE POLICY "field_library by admin" ON public.field_library
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "form_templates by admin" ON public.form_templates;
CREATE POLICY "form_templates by admin" ON public.form_templates
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "form_template_versions by admin" ON public.form_template_versions;
CREATE POLICY "form_template_versions by admin" ON public.form_template_versions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "form_template_fields by admin" ON public.form_template_fields;
CREATE POLICY "form_template_fields by admin" ON public.form_template_fields
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "block_library by admin" ON public.block_library;
CREATE POLICY "block_library by admin" ON public.block_library
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "block_variants by admin" ON public.block_variants;
CREATE POLICY "block_variants by admin" ON public.block_variants
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "theme_versions by admin" ON public.theme_versions;
CREATE POLICY "theme_versions by admin" ON public.theme_versions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- -------------------------------------------------------------------------
-- 3. 미사용 테이블 — 정책 없이 RLS만 켠다 (기본 전면 차단).
--    코드베이스 전체를 뒤져도 이 4개 테이블을 읽거나 쓰는 곳이 없다
--    (Explore 조사 결과 — generated types/migration에만 존재).
-- -------------------------------------------------------------------------
ALTER TABLE public.invitation_blocks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_daily_stats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_info         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archived_invitations ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- 4. themes — 공개 템플릿 갤러리(app/templates)와 미리보기가 anon 으로 직접
--    읽는다. template_html/css 자체가 공개 콘텐츠라 컬럼 제한은 필요 없다.
-- -------------------------------------------------------------------------
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "themes public read" ON public.themes;
CREATE POLICY "themes public read" ON public.themes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "themes insert by admin" ON public.themes;
CREATE POLICY "themes insert by admin" ON public.themes
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "themes update by admin" ON public.themes;
CREATE POLICY "themes update by admin" ON public.themes
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "themes delete by admin" ON public.themes;
CREATE POLICY "themes delete by admin" ON public.themes
  FOR DELETE TO authenticated USING (public.is_admin());

-- -------------------------------------------------------------------------
-- 5. settings — key/value 테이블이라 행 단위가 아니라 "어떤 key냐"로 공개
--    범위를 가른다. 폰트/기능토글/메인이미지/로고/데이터보관 설정 6개 키만
--    anon 에게 허용한다 — business_info/data_transfer/self_edit 등 민감
--    키는 이 allow-list에 없어 anon PostgREST 요청으로도 읽을 수 없다.
-- -------------------------------------------------------------------------
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings public read" ON public.settings;
CREATE POLICY "settings public read" ON public.settings
  FOR SELECT TO anon, authenticated
  USING (key IN ('fonts', 'is_feature_open', 'main_image', 'hero_content', 'logo_image', 'data_retention'));

DROP POLICY IF EXISTS "settings write by admin" ON public.settings;
CREATE POLICY "settings write by admin" ON public.settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- -------------------------------------------------------------------------
-- 6. form_instances — 공개 폼(/form/[slug])이 anon 으로 직접 읽고, 제출 완료
--    시 status 컬럼만 anon 이 갱신한다(app/form/[slug]의 기존 동작 그대로).
--    access_password는 RLS와 별개로 컬럼 권한 자체를 회수해 anon/authenticated
--    어느 쪽도 select 할 수 없다 — 관리자도 원문을 볼 수 없다는 점에서
--    invitations.dashboard_password 와 같은 원칙(비교는 항상 서버가 대신).
-- -------------------------------------------------------------------------
ALTER TABLE public.form_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "form_instances public read" ON public.form_instances;
CREATE POLICY "form_instances public read" ON public.form_instances
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "form_instances insert by admin" ON public.form_instances;
CREATE POLICY "form_instances insert by admin" ON public.form_instances
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "form_instances update by admin" ON public.form_instances;
CREATE POLICY "form_instances update by admin" ON public.form_instances
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "form_instances delete by admin" ON public.form_instances;
CREATE POLICY "form_instances delete by admin" ON public.form_instances
  FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "form_instances status update by submitter" ON public.form_instances;
CREATE POLICY "form_instances status update by submitter" ON public.form_instances
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

REVOKE UPDATE ON public.form_instances FROM anon;
GRANT UPDATE (status) ON public.form_instances TO anon;
REVOKE SELECT (access_password) ON public.form_instances FROM anon, authenticated;

-- -------------------------------------------------------------------------
-- 7. form_submissions — 제출 폼이 anon 으로 직접 upsert한다. 기존 앱의 신뢰
--    모델 자체가 "instanceId를 아는 것 = 제출 권한"이라(§app/api/form-submit)
--    RLS로 행 단위 소유권까지 강제하지는 못한다 — RLS 미적용 상태보다는
--    확실한 개선(오늘은 DELETE까지 무방비)이고, 소유권 검증 강화는 Phase 2로
--    별도 추적한다.
-- -------------------------------------------------------------------------
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "form_submissions public read" ON public.form_submissions;
CREATE POLICY "form_submissions public read" ON public.form_submissions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "form_submissions insert by anyone" ON public.form_submissions;
CREATE POLICY "form_submissions insert by anyone" ON public.form_submissions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "form_submissions update by anyone" ON public.form_submissions;
CREATE POLICY "form_submissions update by anyone" ON public.form_submissions
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "form_submissions delete by admin" ON public.form_submissions;
CREATE POLICY "form_submissions delete by admin" ON public.form_submissions
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================================
-- 8. 기존 "관리자용" 정책 강화 — TO authenticated USING (true) 는 로그인만
--    하면 통과했다. is_admin() 기반으로 좁힌다.
-- ============================================================================

DROP POLICY IF EXISTS "customers by admin" ON public.customers;
CREATE POLICY "customers by admin" ON public.customers
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "invitations by admin" ON public.invitations;
CREATE POLICY "invitations by admin" ON public.invitations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "rsvp read by admin" ON public.rsvp_responses;
CREATE POLICY "rsvp read by admin" ON public.rsvp_responses
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "guestbook read by admin" ON public.guestbook_entries;
CREATE POLICY "guestbook read by admin" ON public.guestbook_entries
  FOR SELECT TO authenticated USING (public.is_admin());

-- 방명록 anon 조회 정책 폐지: is_visible=true 스코프는 있었지만 invitation_id
-- 스코프가 없어 anon 키만 있으면 전 청첩장 방명록(실명 포함)을 한 번에 조회할
-- 수 있었다. RLS는 "행 가시성"만 제어할 뿐 "반드시 invitation_id로 필터"를
-- 강제할 수 없으므로, 공개 조회는 서버 라우트(app/api/guestbook, service_role)
-- 로 이관하고 이 정책은 없앤다.
DROP POLICY IF EXISTS "guestbook read visible" ON public.guestbook_entries;

DROP POLICY IF EXISTS "visit_logs read by admin" ON public.visit_logs;
CREATE POLICY "visit_logs read by admin" ON public.visit_logs
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "orders by admin" ON public.orders;
CREATE POLICY "orders by admin" ON public.orders
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "inquiries read by admin" ON public.inquiries;
CREATE POLICY "inquiries read by admin" ON public.inquiries
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "inquiries update by admin" ON public.inquiries;
CREATE POLICY "inquiries update by admin" ON public.inquiries
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "bgms write by admin" ON public.bgms;
CREATE POLICY "bgms write by admin" ON public.bgms
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "faqs write by admin" ON public.faqs;
CREATE POLICY "faqs write by admin" ON public.faqs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "notices write by admin" ON public.notices;
CREATE POLICY "notices write by admin" ON public.notices
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "notifications by admin" ON public.notifications;
CREATE POLICY "notifications by admin" ON public.notifications
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "audit logs by admin" ON public.audit_logs;
CREATE POLICY "audit logs by admin" ON public.audit_logs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "invitation revisions by admin" ON public.invitation_revisions;
CREATE POLICY "invitation revisions by admin" ON public.invitation_revisions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- 9. storage.objects — 인증 없는 전면 삭제 정책 제거.
--    실제 삭제 호출은 lib/storage-cleanup.ts 하나뿐이고 항상 service_role로
--    실행된다(app/api/cron/purge-expired-invitations 전용) — service_role은
--    RLS를 우회하므로 정책을 아예 두지 않아도 동작에는 영향이 없다.
-- ============================================================================
DROP POLICY IF EXISTS "Allow public delete from vow-seoul-storage" ON storage.objects;
