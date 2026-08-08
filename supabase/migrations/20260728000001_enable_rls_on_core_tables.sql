-- =========================================================================
-- 핵심 테이블에 RLS 활성화
--
-- 20260728000000_tighten_rls.sql 를 적용했는데도 anon 키로 customers 17건,
-- invitations 3건, visit_logs 22건이 그대로 조회되는 것을 확인했다.
--
-- 원인: 초기 스키마(20260708000000)가 이 테이블들에 대해
-- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` 를 한 번도 실행하지 않았다.
-- RLS 가 꺼진 테이블은 정책을 아무리 만들어도 전부 무시되고 무조건 통과한다.
-- (RLS 가 켜져 있던 orders/bgms/faqs/notices/inquiries 5개만 앞 마이그레이션이
--  실제로 먹혔다. rsvp_responses 가 0건이던 것도 차단이 아니라 데이터가 없어서였다.)
--
-- 여기서는 (1) RLS 를 켜고 (2) 켜는 순간 기존에 남아있을 수 있는 개방 정책이
-- 그대로 살아나지 않도록 대상 테이블의 정책을 전부 지운 뒤 (3) 앞 마이그레이션과
-- 동일한 정책을 다시 만든다. 정책 이름을 몰라도 되도록 pg_policies 를 순회한다.
--
-- ⚠️ 적용 전 SUPABASE_SERVICE_ROLE_KEY 가 서버에 설정되어 있어야 한다.
--    /w/[slug] 와 신랑신부 대시보드가 이 키로 읽는다.
-- =========================================================================

-- 1) 대상 테이블의 기존 정책 전부 제거 (이름을 몰라도 되도록 동적으로)
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'customers', 'invitations', 'rsvp_responses',
        'guestbook_entries', 'visit_logs'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 2) RLS 활성화
ALTER TABLE public.customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvp_responses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guestbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_logs        ENABLE ROW LEVEL SECURITY;

-- 3) 정책 재생성 (20260728000000 과 동일한 의도)

-- 고객·청첩장: 전부 서버 경유. invitations 행에는 dashboard_password 가 들어 있다.
CREATE POLICY "customers by admin" ON public.customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "invitations by admin" ON public.invitations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RSVP: 하객은 제출만, 조회는 관리자(및 service_role)만.
CREATE POLICY "rsvp insert by anyone" ON public.rsvp_responses
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "rsvp read by admin" ON public.rsvp_responses
  FOR SELECT TO authenticated USING (true);

-- 방명록: 작성은 누구나, 읽기는 청첩장에 공개된 글만.
CREATE POLICY "guestbook insert by anyone" ON public.guestbook_entries
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "guestbook read visible" ON public.guestbook_entries
  FOR SELECT TO anon USING (is_visible = true);
CREATE POLICY "guestbook read by admin" ON public.guestbook_entries
  FOR SELECT TO authenticated USING (true);

-- 방문 로그: 기록은 서버(/w/[slug])가 service_role 로 한다. anon 은 읽지도 쓰지도 않는다.
CREATE POLICY "visit_logs read by admin" ON public.visit_logs
  FOR SELECT TO authenticated USING (true);

-- -------------------------------------------------------------------------
-- 4) 앞 마이그레이션의 누락 보정 — inquiries UPDATE
--
-- 20260728000000 이 inquiries 에 SELECT 정책만 만들어서, /admin/inquiries 의
-- 문의 상태 변경이 동작하지 않았다. RLS 로 걸린 UPDATE 는 에러가 아니라
-- "0건 갱신"(HTTP 200 + 빈 배열)으로 돌아와 화면에서도 조용히 실패했다.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "inquiries update by admin" ON public.inquiries;
CREATE POLICY "inquiries update by admin" ON public.inquiries
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
