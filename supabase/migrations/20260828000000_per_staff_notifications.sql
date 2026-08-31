-- ============================================================================
-- 담당자별 알림 — 텔레그램 개인 채팅 + 웹 푸시(PWA)
--
-- 지금까지 알림은 TELEGRAM_CHAT_ID 하나로만 갔다. 방 하나에 전부 쌓이니
-- 누가 볼 일인지 알 수 없고, 담당이 나뉘어도 알림은 나뉘지 않았다.
--
-- 두 갈래를 만든다.
--  1. profiles.telegram_chat_id — 직원 각자의 개인 채팅
--  2. push_subscriptions        — 브라우저 웹 푸시 구독(기기 단위)
--
-- 텔레그램을 원하지 않는 직원을 위해 웹 푸시를 함께 둔다. 전원이 아이폰이라
-- 홈 화면에 추가해야만 도착하지만(iOS 16.4+ 제약), 선택지는 있어야 한다.
--
-- 받는 사람 결정은 §lib/notify-recipients.ts 한 곳에서 한다: 고객에 담당자가
-- 지정돼 있으면 그 사람에게만, 아니면 전 직원에게. 지정된 담당자가 더 이상
-- 직원이 아니면 전 직원으로 되돌린다 — 알림이 조용히 사라지는 것이 가장 나쁘다.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 직원 개인 텔레그램 채팅 ID
--
-- 봇과 1:1 대화를 시작(/start)한 뒤 받은 숫자를 각자 넣는다. 비워두면 그 직원은
-- 텔레그램으로 받지 않는다(웹 푸시만 쓰거나, 아무것도 안 쓰거나).
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- ---------------------------------------------------------------------------
-- 2. 웹 푸시 구독 — 기기마다 한 행
--
-- endpoint 가 브라우저가 발급하는 고유 주소다. UNIQUE 로 잡아 같은 기기가
-- 다시 구독해도 행이 늘지 않게 한다(브라우저는 권한을 다시 물어보지 않고
-- 같은 구독을 돌려주지만, 키 회전 시 endpoint 가 바뀔 수 있다).
--
-- 만료된 구독은 발송 시 404/410 으로 드러나므로 그때 지운다(§lib/web-push.ts).
-- 미리 정리할 방법이 없다 — 브라우저가 알려주지 않는다.
--
-- RLS: 정책을 두지 않는다. 구독 생성·삭제·조회 전부 서버 라우트(service_role)를
-- 지나가므로 anon 도 authenticated 도 이 표를 직접 만질 이유가 없다.
-- 폼 표들을 서버 경유로 옮긴 것과 같은 방침이다(§20260820010000).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.push_subscriptions FROM anon;
REVOKE ALL ON public.push_subscriptions FROM authenticated;

NOTIFY pgrst, 'reload schema';
