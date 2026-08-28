-- 샘플/테스트 고객 표시 — 내부 테스트용으로 만든 고객이 실제 매출/고객 수 집계와
-- 목록 기본 뷰에 섞이지 않게 한다.
--
-- 진입점은 고객 상세의 "제작 진행 상태"(orders.status)에 추가되는 'sample' 값이지만,
-- 고객 목록·통계는 orders 를 조인하지 않고 customers 만 읽으므로(§hooks/queries/useCustomers.ts,
-- app/admin/(dashboard)/statistics/page.tsx) 판정 결과를 customers.is_sample 에 비정규화해 둔다.
-- 동기화는 앱 코드가 아니라 트리거로 한다 — orders 를 쓰는 경로가 생성/수정/복사/삭제로
-- 여러 곳이라(§hooks/queries/useOrders.ts) 앱에서 맞추면 언젠가 한 곳이 빠진다.

-- =========================================================================
-- 1. orders.status 에 'sample' 추가
-- =========================================================================
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'registered', 'form_sent', 'form_completed',
  'in_production', 'design_review', 'published', 'delivered',
  'sample'
));

-- =========================================================================
-- 2. customers.is_sample (비정규화 사본)
-- =========================================================================
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;

-- 목록 기본 뷰가 항상 is_sample=false 로 거르므로 부분 인덱스로 충분하다
CREATE INDEX IF NOT EXISTS idx_customers_is_sample ON public.customers(is_sample) WHERE is_sample = true;

-- =========================================================================
-- 3. orders.status -> customers.is_sample 동기화 트리거
-- =========================================================================
-- 고객 1명에 orders 가 여러 건일 수 있어(§ 청첩장 복사 기능) 단일 행만 보고 판단하면
-- 안 된다. 항상 "이 고객에게 sample 주문이 하나라도 있는가"로 다시 계산한다.
CREATE OR REPLACE FUNCTION public.sync_customer_is_sample()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_customer uuid;
BEGIN
  target_customer := COALESCE(NEW.customer_id, OLD.customer_id);
  IF target_customer IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.customers c
     SET is_sample = EXISTS (
           SELECT 1 FROM public.orders o
            WHERE o.customer_id = target_customer AND o.status = 'sample'
         )
   WHERE c.id = target_customer;

  -- UPDATE 로 customer_id 자체가 바뀐 경우 예전 고객 쪽도 다시 계산한다
  IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id AND OLD.customer_id IS NOT NULL THEN
    UPDATE public.customers c
       SET is_sample = EXISTS (
             SELECT 1 FROM public.orders o
              WHERE o.customer_id = OLD.customer_id AND o.status = 'sample'
           )
     WHERE c.id = OLD.customer_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_customer_is_sample_trigger ON public.orders;
CREATE TRIGGER sync_customer_is_sample_trigger
AFTER INSERT OR UPDATE OF status, customer_id OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_customer_is_sample();
