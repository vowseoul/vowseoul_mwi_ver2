-- =========================================================================
-- B(하이브리드) + iframe 테마 구조를 위한 themes 테이블 컬럼 추가
-- Supabase Dashboard -> SQL Editor 에 복사하여 실행해 주세요.
--
-- 배경: 기존 테마는 하드코딩 렌더러(invitation-client.tsx) + styles jsonb 로 동작한다.
--       새 구조는 테마가 자체 HTML/CSS(템플릿)를 갖고, 필요한 기능(슬롯)만 선언하며,
--       InvitationFrame 이 이를 iframe 안에서 렌더링한다.
--       두 방식을 render_engine 플래그로 구분해 무중단 점진 이행한다.
-- =========================================================================

-- 1. 테마가 소유하는 마크업/스타일 (디자이너 export 결과)
--    template_html : [data-field="키"] / [data-slot="키"] 마커가 포함된 HTML
--    template_css  : iframe 내부에 주입되는 스코프 CSS (var(--토큰) 사용)
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS "template_html" text;
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS "template_css" text;

-- 2. 매니페스트
--    slot_manifest  : 이 테마가 사용하는 기능(슬롯) 키 배열  예) ["bgm","gallery","account","rsvp","guestbook"]
--    field_manifest : 이 템플릿이 참조하는 필드키 배열       예) ["groom_name","bride_name","venue_name", ...]
--                     (폼-테마 매핑 검증 및 편집 UI 용)
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS "slot_manifest" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS "field_manifest" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. 렌더 엔진 플래그 (무중단 점진 이행의 핵심)
--    'legacy'   : 기존 하드코딩 렌더러 사용 (기본값 — 기존 테마 영향 없음)
--    'template' : 새 InvitationFrame(iframe) 렌더러 사용
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS "render_engine" text NOT NULL DEFAULT 'legacy';

-- 3-1. 값 무결성 제약 (재실행 안전: 먼저 삭제 후 재생성)
ALTER TABLE public.themes DROP CONSTRAINT IF EXISTS themes_render_engine_check;
ALTER TABLE public.themes ADD CONSTRAINT themes_render_engine_check
  CHECK (render_engine IN ('legacy', 'template'));

-- 4. 확인용 조회 (선택)
-- SELECT id, name, render_engine, slot_manifest, field_manifest,
--        (template_html IS NOT NULL) AS has_html
-- FROM public.themes ORDER BY created_at DESC;
