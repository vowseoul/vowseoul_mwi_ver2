-- WORKPLAN.md §1-B — 코드가 참조하지만 존재하지 않던 5개 테이블을 신설한다.
--
-- orders 는 결제 트랜잭션이 아니라 "제작 의뢰 + 이행 상태 기록"이다.
-- 실제 결제는 네이버 스마트스토어에서 앱 밖에서 끝난 채로 넘어온다 — 결제 게이트웨이 불필요.

-- =========================================================================
-- orders 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  invitation_id uuid REFERENCES public.invitations(id) ON DELETE SET NULL, -- 모바일 상품만 채워짐, 지류 전용이면 NULL
  product_type text NOT NULL CHECK (product_type IN ('mobile', 'offline', 'both')) DEFAULT 'mobile',
  external_order_ref text, -- 네이버 스마트스토어 주문번호 (대사용)
  amount integer NOT NULL DEFAULT 0, -- 실제 결제액 수기입력
  status text NOT NULL CHECK (status IN (
    'registered', 'form_sent', 'form_completed',
    'in_production', 'design_review', 'published', 'delivered'
  )) DEFAULT 'registered',
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

DROP TRIGGER IF EXISTS set_orders_updated_at ON public.orders;
CREATE TRIGGER set_orders_updated_at BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_invitation ON public.orders(invitation_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- =========================================================================
-- bgms 테이블 — 관리자가 등록하는 배경음악 에셋 목록
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.bgms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  artist text,
  duration text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =========================================================================
-- faqs 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =========================================================================
-- notices 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  is_pinned boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =========================================================================
-- inquiries 테이블 — /contact 문의 폼 제출
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  message text NOT NULL,
  status text NOT NULL CHECK (status IN ('new', 'read', 'replied')) DEFAULT 'new',
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =========================================================================
-- RLS — 기존 테이블들과 동일하게 anon 키로 CRUD 가능하도록 개방 정책 적용
-- (이 프로젝트는 별도 RLS 정책이 확인되지 않는 한 서버 auth 없이 anon 키로 직접 CRUD 하는
--  구조이므로, 정본 테이블들과의 일관성을 위해 동일 수준으로 개방한다. 추후 관리자 인증
--  기반 정책으로 조이는 것을 권장한다.)
-- =========================================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bgms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on orders" ON public.orders;
CREATE POLICY "Allow all on orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on bgms" ON public.bgms;
CREATE POLICY "Allow all on bgms" ON public.bgms FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on faqs" ON public.faqs;
CREATE POLICY "Allow all on faqs" ON public.faqs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on notices" ON public.notices;
CREATE POLICY "Allow all on notices" ON public.notices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert on inquiries" ON public.inquiries;
CREATE POLICY "Allow insert on inquiries" ON public.inquiries FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow select on inquiries" ON public.inquiries;
CREATE POLICY "Allow select on inquiries" ON public.inquiries FOR SELECT USING (true);
