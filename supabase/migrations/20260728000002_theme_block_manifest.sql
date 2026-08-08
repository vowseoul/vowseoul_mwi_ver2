-- 청첩장 세부 디자인 편집 기능 (PLAN_DESIGN_CONTROLS.md) — 블럭 계약 컬럼 추가
--
-- 배경: slot_manifest 가 "이 테마가 지원하는 기능"을 선언하는 것과 같은 방식으로,
--       block_manifest 는 "이 테마가 지원하는 블럭(섹션)과 그 블럭의 편집 가능 범위"를 선언한다.
--       템플릿 HTML의 [data-block="키"] 마커와 짝을 이루며, 편집기가 블럭별 여백/타이틀
--       컨트롤을 보여줄지 판단하는 근거가 된다. THEME_TOKEN_GUIDE.md §2 참조.
--
--       block_manifest 항목 형태: { key, label, title, padding }
--       예) { "key": "gallery", "label": "갤러리", "title": true, "padding": true }
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS "block_manifest" jsonb NOT NULL DEFAULT '[]'::jsonb;
