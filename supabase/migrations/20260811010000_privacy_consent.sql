-- ============================================================================
-- 개인정보 수집·이용 동의 기록
--
-- 지금까지 RSVP·방명록·정보수집폼·문의 4개 제출 경로 전부 동의 절차 없이
-- 개인정보를 수집하고 있었다(개인정보 보호법 제15조·제22조 위반 상태).
-- 동의 UI(§components/privacy-consent-field.tsx, §components/invitation/consent-notice.tsx)를
-- 붙이면서, "언제 · 몇 번째 방침에" 동의했는지를 각 제출 행 자체에 남긴다.
-- 별도 consent_records 테이블을 두지 않는 이유: 이 값들은 원본 데이터(RSVP 등)와
-- 생명주기가 같다 — 원본이 파기되면(§app/invitation/[id]/dashboard/page.tsx의
-- 14일 파기) 동의 기록도 함께 사라지는 게 보관 정책과 정합적이다.
-- ============================================================================

ALTER TABLE public.rsvp_responses
  ADD COLUMN IF NOT EXISTS consent_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version text;

ALTER TABLE public.guestbook_entries
  ADD COLUMN IF NOT EXISTS consent_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version text;

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS consent_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version text;

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS consent_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version text;

-- rsvp_responses는 anon이 INSERT/UPDATE를 직접 못 하고(§20260810000000_rsvp_dedupe_by_phone.sql)
-- upsert_rsvp_response RPC를 거쳐야 하므로, 그 함수 시그니처에 동의 버전 파라미터를 추가한다.
DROP FUNCTION IF EXISTS public.upsert_rsvp_response(uuid, text, text, text, boolean, integer, boolean, text, boolean);

CREATE FUNCTION public.upsert_rsvp_response(
  p_invitation_id uuid,
  p_guest_name text,
  p_phone text,
  p_side text,
  p_is_attending boolean,
  p_party_size integer,
  p_meal_required boolean,
  p_meal_choice text,
  p_shuttle_required boolean,
  p_consent_version text
) RETURNS public.rsvp_responses
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.rsvp_responses (
    invitation_id, guest_name, phone, side, is_attending, party_size,
    meal_required, meal_choice, shuttle_required, consent_agreed_at, consent_version
  ) VALUES (
    p_invitation_id, p_guest_name, p_phone, p_side, p_is_attending, p_party_size,
    p_meal_required, p_meal_choice, p_shuttle_required, now(), p_consent_version
  )
  ON CONFLICT (invitation_id, (regexp_replace(phone, '[^0-9]', '', 'g')))
  DO UPDATE SET
    guest_name = EXCLUDED.guest_name,
    phone = EXCLUDED.phone,
    side = EXCLUDED.side,
    is_attending = EXCLUDED.is_attending,
    party_size = EXCLUDED.party_size,
    meal_required = EXCLUDED.meal_required,
    meal_choice = EXCLUDED.meal_choice,
    shuttle_required = EXCLUDED.shuttle_required,
    consent_agreed_at = EXCLUDED.consent_agreed_at,
    consent_version = EXCLUDED.consent_version,
    created_at = now()
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_rsvp_response(uuid, text, text, text, boolean, integer, boolean, text, boolean, text)
  TO anon, authenticated;
