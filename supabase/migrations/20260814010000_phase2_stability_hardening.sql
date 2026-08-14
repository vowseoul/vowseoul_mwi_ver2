-- ============================================================================
-- Phase 2 안정성 보강 — rate limit 저장소 + RSVP 변경 이력
-- ============================================================================

-- -------------------------------------------------------------------------
-- 1. rate_limit_attempts — 인증 관문 3종(dashboard-auth/form-auth/
--    guestbook-delete/rsvp-cancel)의 IP당 시도 횟수 제한 저장소.
--    lib/rate-limit.ts가 service_role로만 읽고 쓴다 — anon/authenticated
--    정책을 두지 않아 기본적으로 전면 차단(= 클라이언트가 직접 조작 불가).
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limit_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  identifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_attempts_lookup
  ON public.rate_limit_attempts (scope, identifier, created_at);

ALTER TABLE public.rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- 2. rsvp_responses_history — upsert_rsvp_response RPC(SECURITY DEFINER)에
--    소유권 검증이 없어, 다른 사람의 참석 여부/인원/식사를 조용히 바꿔놓을
--    수 있는 문제의 최소 대응. 실시간 차단 대신, UPDATE가 일어날 때마다
--    직전 값을 남겨 사후 대조가 가능하게 한다.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rsvp_responses_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_response_id uuid NOT NULL,
  invitation_id uuid NOT NULL,
  guest_name text,
  phone text,
  side text,
  is_attending boolean,
  party_size integer,
  meal_required boolean,
  meal_choice text,
  shuttle_required boolean,
  replaced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rsvp_responses_history_response
  ON public.rsvp_responses_history (rsvp_response_id, replaced_at);

ALTER TABLE public.rsvp_responses_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rsvp history read by admin" ON public.rsvp_responses_history;
CREATE POLICY "rsvp history read by admin" ON public.rsvp_responses_history
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.log_rsvp_response_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rsvp_responses_history (
    rsvp_response_id, invitation_id, guest_name, phone, side,
    is_attending, party_size, meal_required, meal_choice, shuttle_required
  ) VALUES (
    OLD.id, OLD.invitation_id, OLD.guest_name, OLD.phone, OLD.side,
    OLD.is_attending, OLD.party_size, OLD.meal_required, OLD.meal_choice, OLD.shuttle_required
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_rsvp_response_update ON public.rsvp_responses;
CREATE TRIGGER trg_log_rsvp_response_update
  BEFORE UPDATE ON public.rsvp_responses
  FOR EACH ROW EXECUTE FUNCTION public.log_rsvp_response_update();
