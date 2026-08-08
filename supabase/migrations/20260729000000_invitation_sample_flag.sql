-- =========================================================================
-- 청첩장 "샘플용" 플래그
-- =========================================================================
-- 데이터 자동 파기 정책(예식일 + 보관일수 경과 시 자동 삭제)이 데모/샘플
-- 청첩장까지 지워버리지 않도록, 샘플로 지정된 청첩장은 예식일과 무관하게
-- 파기 대상에서 항상 제외한다. §app/api/cron/purge-expired-invitations
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
