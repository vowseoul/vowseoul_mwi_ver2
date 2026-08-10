-- ============================================================================
-- 청첩장 단위 변경 이력 (감사 로그)
--
-- "이 청첩장 누가 언제 뭘 바꿨어요?" 에 답할 방법이 지금까지 전혀 없었다 — 관리자
-- 여러 명이 같은 청첩장을 만지거나, 고객 셀프 편집(§B2)까지 더해지면서 변경 주체가
-- 늘어난 만큼 필요성이 커졌다. 청첩장을 벗어난 범용 감사 로그(고객/폼/테마 등)는
-- 이번 범위가 아니다 — 실제로 반복되는 질문("이 청첩장")에 맞춰 invitation_id
-- 하나로 스코프를 좁혔다.
-- ============================================================================

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  actor_type text NOT NULL CHECK (actor_type IN ('admin', 'customer', 'system')),
  actor_label text,
  action text NOT NULL,
  summary text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX audit_logs_invitation_created_idx ON public.audit_logs (invitation_id, created_at DESC);

-- 관리자 브라우저 세션(authenticated)이 직접 쓰는 경로(customize-client.tsx)와
-- service_role 경로(고객 API 라우트) 둘 다 있다 — service_role은 RLS를 우회하므로
-- authenticated 정책만 있으면 충분하다. anon은 아예 접근 불가(정책 없음 = 기본 거부).
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit logs by admin" ON public.audit_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
