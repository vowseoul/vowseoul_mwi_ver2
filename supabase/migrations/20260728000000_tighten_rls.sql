-- =========================================================================
-- RLS 강화
--
-- 기존 정책은 사실상 전 테이블이 `USING (true)` 개방 정책이었다. anon 키는
-- 클라이언트 번들에 실려 공개되므로, 누구든 그 키로 customers(연락처),
-- rsvp_responses(하객 실명·연락처), invitations(대시보드 비밀번호),
-- inquiries(문의자 개인정보) 전체를 덤프할 수 있는 상태였다.
--
-- 선행 조건 (반드시 코드 배포가 먼저):
--   1. SUPABASE_SERVICE_ROLE_KEY 환경변수 설정 (서버 전용, NEXT_PUBLIC_ 아님)
--   2. lib/supabase-admin.ts 를 쓰도록 바뀐 아래 경로가 배포되어 있을 것
--      - app/w/[slug]/page.tsx (발행 청첩장 렌더 + 방문 로그)
--      - app/invitation/[id]/dashboard (신랑신부 대시보드 조회)
--      - app/api/dashboard-data (신랑신부 대시보드 변경)
--
-- 원칙:
--   - service_role 은 RLS 를 우회하므로 별도 정책이 필요 없다
--   - anon 에게는 "하객이 직접 해야 하는 쓰기"와 "청첩장에 실제로 보이는 읽기"만 남긴다
--   - 관리자 화면은 진짜 Supabase 세션이 있으므로 authenticated 로 연다
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. 하객이 남기는 데이터
-- -------------------------------------------------------------------------

-- RSVP: 하객은 제출만 한다. 조회·수정·삭제는 신랑신부 대시보드(service_role)와
-- 관리자만 가능하다.
DROP POLICY IF EXISTS "Allow all on rsvp_responses" ON public.rsvp_responses;
DROP POLICY IF EXISTS "rsvp insert by anyone" ON public.rsvp_responses;
DROP POLICY IF EXISTS "rsvp read by admin" ON public.rsvp_responses;
CREATE POLICY "rsvp insert by anyone" ON public.rsvp_responses
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "rsvp read by admin" ON public.rsvp_responses
  FOR SELECT TO authenticated USING (true);

-- 방명록: 하객은 작성할 수 있고, 청첩장에 공개된 글만 읽을 수 있다.
-- 숨김 처리된 글은 anon 에게 아예 반환되지 않는다.
DROP POLICY IF EXISTS "Allow all on guestbook_entries" ON public.guestbook_entries;
DROP POLICY IF EXISTS "guestbook insert by anyone" ON public.guestbook_entries;
DROP POLICY IF EXISTS "guestbook read visible" ON public.guestbook_entries;
DROP POLICY IF EXISTS "guestbook read by admin" ON public.guestbook_entries;
CREATE POLICY "guestbook insert by anyone" ON public.guestbook_entries
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "guestbook read visible" ON public.guestbook_entries
  FOR SELECT TO anon USING (is_visible = true);
CREATE POLICY "guestbook read by admin" ON public.guestbook_entries
  FOR SELECT TO authenticated USING (true);

-- 방문 로그: 이제 서버(/w/[slug])에서만 기록한다. anon 은 읽지도 쓰지도 않는다.
DROP POLICY IF EXISTS "Allow all on visit_logs" ON public.visit_logs;
DROP POLICY IF EXISTS "visit_logs read by admin" ON public.visit_logs;
CREATE POLICY "visit_logs read by admin" ON public.visit_logs
  FOR SELECT TO authenticated USING (true);

-- -------------------------------------------------------------------------
-- 2. 고객·청첩장 (전부 서버 경유)
-- -------------------------------------------------------------------------

-- invitations 행에는 dashboard_password 가 들어 있어 anon SELECT 를 허용할 수 없다.
-- 발행 청첩장은 /w/[slug] 가 service_role 로 읽어 렌더한 HTML 만 내려보낸다.
DROP POLICY IF EXISTS "Allow all on invitations" ON public.invitations;
DROP POLICY IF EXISTS "invitations by admin" ON public.invitations;
CREATE POLICY "invitations by admin" ON public.invitations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on customers" ON public.customers;
DROP POLICY IF EXISTS "customers by admin" ON public.customers;
CREATE POLICY "customers by admin" ON public.customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------------------------
-- 3. 운영 데이터 (관리자 전용)
-- -------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow all on orders" ON public.orders;
DROP POLICY IF EXISTS "orders by admin" ON public.orders;
CREATE POLICY "orders by admin" ON public.orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 문의: 누구나 남길 수 있지만, 읽는 건 관리자뿐이다.
-- (기존 "Allow select on inquiries" 는 문의자 이름·이메일·연락처를 전부 공개했다)
DROP POLICY IF EXISTS "Allow select on inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "inquiries read by admin" ON public.inquiries;
CREATE POLICY "inquiries read by admin" ON public.inquiries
  FOR SELECT TO authenticated USING (true);

-- -------------------------------------------------------------------------
-- 4. 공개 콘텐츠 (읽기는 열고 쓰기는 관리자)
--    청첩장 렌더·공개 페이지가 브라우저에서 직접 읽으므로 anon SELECT 를 유지한다.
-- -------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow all on bgms" ON public.bgms;
DROP POLICY IF EXISTS "bgms public read" ON public.bgms;
DROP POLICY IF EXISTS "bgms write by admin" ON public.bgms;
CREATE POLICY "bgms public read" ON public.bgms
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "bgms write by admin" ON public.bgms
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on faqs" ON public.faqs;
DROP POLICY IF EXISTS "faqs public read" ON public.faqs;
DROP POLICY IF EXISTS "faqs write by admin" ON public.faqs;
CREATE POLICY "faqs public read" ON public.faqs
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "faqs write by admin" ON public.faqs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on notices" ON public.notices;
DROP POLICY IF EXISTS "notices public read" ON public.notices;
DROP POLICY IF EXISTS "notices write by admin" ON public.notices;
CREATE POLICY "notices public read" ON public.notices
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "notices write by admin" ON public.notices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
