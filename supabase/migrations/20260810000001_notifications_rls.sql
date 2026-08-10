-- ============================================================================
-- notifications 테이블에 RLS 적용
--
-- 지금까지 이 테이블은 RLS가 꺼진 채 방치되어 있었다(관리자 인앱 알림 기능
-- 자체가 없어 아무도 안 쓰고 있었기 때문). 이번에 관리자 헤더 벨 아이콘에서
-- 브라우저(anon/authenticated 키)로 처음 읽고 쓰게 되므로, 다른 핵심 테이블에
-- 적용한 것과 동일한 최소 정책(관리자만 전체 접근, anon은 접근 불가)을 지금
-- 켠다 — 다른 테이블도 "처음 쓰기 시작하는 시점에" 조여왔던 것과 같은 순서다.
-- 시스템이 보내는 알림(폼 제출/만료 임박 등)은 service_role로 삽입하므로
-- RLS와 무관하게 항상 동작한다.
-- ============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications by admin" ON public.notifications;
CREATE POLICY "notifications by admin" ON public.notifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
