-- Baseline snapshot — 이미 운영 DB에 적용된 변경 (구 update_schema.sql 을 이관)
-- 원본 커밋: a336597 (2026-07-19, 폼 시스템 전면 리디자인)

-- 1. field_library 테이블의 카테고리 CHECK 제약 조건 삭제
ALTER TABLE public.field_library DROP CONSTRAINT IF EXISTS field_library_category_check;

-- 2. field_library 테이블의 필드타입 CHECK 제약 조건 삭제 (또는 rselect가 포함된 제약조건으로 변경)
ALTER TABLE public.field_library DROP CONSTRAINT IF EXISTS field_library_field_type_check;

-- 3. themes 테이블에 에셋 관리 편집용 필수 컬럼 추가
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS "thumbnail" text;
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS "tags" text[];
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS "layout" text;
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS "recommendedBgms" jsonb;
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS "styles" jsonb;
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS "colorSets" jsonb;
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS "fontSets" jsonb;

-- 4. settings 테이블 (공통 설정 값 저장용)이 존재하지 않을 경우 생성
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
