-- ============================================================================
-- QR 리디렉션 — 종이에 박힌 주소와 실제 목적지를 분리한다
--
-- 지금 QR 은 /w/{슬러그} 를 그대로 담는다. 종이에 인쇄된 뒤에는 그 주소가 고정되어,
-- 슬러그를 바꾸거나 청첩장을 새로 만들어 갈아끼우는 순간 인쇄물 전체가 못 쓰게 된다.
-- 청첩장은 예식 전에 얼마든지 갈아엎을 수 있는 물건인데, 종이는 그렇지 않다.
--
-- 그래서 한 겹을 둔다: QR 에는 /q/{코드} 를 담고, 그 코드가 "지금 어느 청첩장인지"를
-- 가리킨다. 청첩장을 바꾸면 이 표의 invitation_id 만 옮기면 되고 종이는 그대로 쓴다.
--
-- 코드는 짧게 잡는다(8자). QR 은 담는 글자가 적을수록 모듈이 성기어져서, 작게
-- 인쇄해도 잘 읽힌다 — 리디렉션이 스캔 성공률까지 같이 올려준다.
--
-- ON DELETE SET NULL: 청첩장이 파기돼도 코드 행은 남긴다. 그래야 그 QR 을 새 청첩장에
-- 다시 연결할 수 있다. 코드까지 함께 사라지면 인쇄물을 되살릴 방법이 없어진다.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.qr_links (
  code          text PRIMARY KEY,
  invitation_id uuid REFERENCES public.invitations(id) ON DELETE SET NULL,
  -- 우리 청첩장이 아닌 곳으로 보내야 할 때(외부 페이지, 임시 안내 등). 값이 있으면
  -- invitation_id 보다 우선한다 — 두 곳을 동시에 가리킬 수는 없으므로 우선순위를
  -- 코드가 아니라 데이터로 정해 둔다.
  target_url    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 이미 만든 표에 나중에 붙는 경우
ALTER TABLE public.qr_links ADD COLUMN IF NOT EXISTS target_url text;

CREATE INDEX IF NOT EXISTS idx_qr_links_invitation ON public.qr_links(invitation_id);

-- 발급·연결변경은 관리자 라우트(service_role)가, 조회는 /q/[code] 서버 라우트가 한다.
-- 브라우저가 직접 만질 이유가 없으므로 정책을 두지 않는다(전면 차단).
ALTER TABLE public.qr_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qr_links FROM anon;
REVOKE ALL ON public.qr_links FROM authenticated;

NOTIFY pgrst, 'reload schema';
