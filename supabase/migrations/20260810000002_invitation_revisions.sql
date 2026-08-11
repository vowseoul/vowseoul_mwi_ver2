-- ============================================================================
-- 시안 검수 & 수정요청 워크플로
--
-- 지금까지 고객은 draft 상태 청첩장을 볼 방법이 없어서, 업체가 스크린샷을
-- 찍어 카톡으로 보내고 "여기 오타요" ↔ "어디요?" 왕복이 반복됐다. 고객이
-- 초안을 직접 보고 블록 단위로 수정 요청을 남길 수 있게 한다.
--
-- invitations.status(draft/published/paused/expired)는 "발행 상태"이고,
-- review_status는 "검수 상태"라 축이 다르다 — 기존 enum에 값을 끼워 넣으면
-- 발행 로직·필터·배지가 전부 영향을 받으므로 별도 컬럼으로 분리한다.
-- ============================================================================

CREATE TABLE public.invitation_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  round integer NOT NULL DEFAULT 1,
  block_key text,
  note text NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'resolved')) DEFAULT 'open',
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  resolved_at timestamp with time zone
);
CREATE INDEX invitation_revisions_invitation_status_idx
  ON public.invitation_revisions (invitation_id, status);

ALTER TABLE public.invitations
  ADD COLUMN review_status text
    CHECK (review_status IN ('none', 'in_review', 'changes_requested', 'approved'))
    DEFAULT 'none' NOT NULL,
  ADD COLUMN review_round integer DEFAULT 0 NOT NULL;

-- RLS: 하객(고객)은 Supabase 계정이 없는 익명 사용자라 여기서 직접 anon으로
-- 쓰지 않는다 — /api/review-submit이 dashboard-session 서명 쿠키로 인증한 뒤
-- service_role로 대신 쓴다(§app/api/dashboard-data/route.ts와 동일한 패턴).
-- anon 정책을 아예 만들지 않아 기본적으로 막힌다.
ALTER TABLE public.invitation_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invitation revisions by admin" ON public.invitation_revisions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
