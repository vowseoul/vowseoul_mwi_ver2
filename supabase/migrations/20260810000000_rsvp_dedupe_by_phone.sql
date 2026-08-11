-- ============================================================================
-- RSVP 중복 제출 방지
--
-- 지금까지 같은 하객이 참석 의사를 여러 번 제출할 수 있었고(폼에 아무 제약이
-- 없음), 신랑신부 대시보드의 참석 인원·식사·셔틀 집계가 그만큼 부풀려질 수
-- 있었다. (invitation_id, 전화번호) 조합을 유니크로 묶어 재발을 막는다.
--
-- 전화번호는 "010-1234-5678" / "01012345678"처럼 입력 형식이 제각각이라 원문
-- 그대로는 유니크 제약을 걸 수 없다 — 숫자만 뽑은 표현식 인덱스를 쓴다.
-- 화면에는 항상 사용자가 입력한 원문(phone 컬럼)을 그대로 보여주므로 표시
-- 형식은 바뀌지 않는다.
-- ============================================================================

-- 1) 기존 중복 정리 — 같은 (invitation_id, 숫자만 추출한 phone) 중 가장 최근
--    응답만 남긴다. 나중에 다시 제출한 응답이 더 정확한 최신 의사일 가능성이
--    높다.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY invitation_id, regexp_replace(phone, '[^0-9]', '', 'g')
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM public.rsvp_responses
)
DELETE FROM public.rsvp_responses
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) 재발 방지용 유니크 인덱스 (표현식 인덱스)
CREATE UNIQUE INDEX IF NOT EXISTS rsvp_responses_invitation_phone_key
  ON public.rsvp_responses (invitation_id, regexp_replace(phone, '[^0-9]', '', 'g'));

-- 3) 제출 경로를 insert-only에서 upsert로 바꾸는 RPC.
--    rsvp_responses는 RLS상 anon이 INSERT만 가능하고 SELECT/UPDATE는 불가능하다
--    (하객이 다른 하객의 응답을 읽거나 고칠 수 없어야 하므로) — 그래서 클라이언트가
--    "이미 있으면 UPDATE"를 직접 판단할 방법이 없다. SECURITY DEFINER로 그 판단을
--    서버 쪽 함수 안에서 안전하게 대신 처리한다.
CREATE OR REPLACE FUNCTION public.upsert_rsvp_response(
  p_invitation_id uuid,
  p_guest_name text,
  p_phone text,
  p_side text,
  p_is_attending boolean,
  p_party_size integer,
  p_meal_required boolean,
  p_meal_choice text,
  p_shuttle_required boolean
) RETURNS public.rsvp_responses
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.rsvp_responses (
    invitation_id, guest_name, phone, side, is_attending, party_size,
    meal_required, meal_choice, shuttle_required
  ) VALUES (
    p_invitation_id, p_guest_name, p_phone, p_side, p_is_attending, p_party_size,
    p_meal_required, p_meal_choice, p_shuttle_required
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
    created_at = now()
  RETURNING *;
$$;

-- anon/authenticated 모두 (하객 제출 + 관리자 화면 재사용 대비) 실행 가능해야 한다.
-- SECURITY DEFINER라 함수 내부에서는 RLS를 우회하지만, 실행 권한 자체는 별도로 부여해야 한다.
GRANT EXECUTE ON FUNCTION public.upsert_rsvp_response(uuid, text, text, text, boolean, integer, boolean, text, boolean)
  TO anon, authenticated;
