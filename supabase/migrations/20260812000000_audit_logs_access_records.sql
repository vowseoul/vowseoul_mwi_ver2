-- ============================================================================
-- 개인정보취급자 접속기록 대응 (개인정보의 안전성 확보조치 기준 고시 제8조)
--
-- 지금까지 audit_logs는 "이 청첩장을 누가 언제 고쳤나"만 기록했다(§A5). 고시는
-- 그보다 넓게 "개인정보취급자가 개인정보처리시스템에 접속한 기록"을 1년 이상
-- 보관하도록 요구하는데, 여기엔 청첩장 한 건에 묶이지 않는 행위도 있다
-- (예: 고객 목록 전체 CSV 내보내기, 고객 상세 열람). 새 테이블을 만드는 대신
-- 같은 audit_logs를 확장한다 — invitation_id를 nullable로 바꾸고, 그 값이 없는
-- 행은 "청첩장 단위가 아닌 접속기록"으로 취급한다.
--
-- FK를 CASCADE에서 SET NULL로 바꾸는 이유: 지금까지는 청첩장이 하드 삭제되면
-- 그 이력도 같이 사라지는 게 맞았다(변경 이력 조회 대상 자체가 없어지므로).
-- 하지만 이 마이그레이션 이후로는 같은 테이블에 "접속기록"도 함께 담기고,
-- 접속기록은 청첩장 존재 여부와 무관하게 1년은 남아 있어야 한다 — CASCADE로
-- 지워지면 안 된다. invitation_id만 NULL로 비우고 행 자체(누가·언제·무엇을
-- 조회했는지)는 그대로 남긴다.
-- ============================================================================

ALTER TABLE public.audit_logs
  ALTER COLUMN invitation_id DROP NOT NULL;

ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_invitation_id_fkey;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_invitation_id_fkey
    FOREIGN KEY (invitation_id) REFERENCES public.invitations(id) ON DELETE SET NULL;
