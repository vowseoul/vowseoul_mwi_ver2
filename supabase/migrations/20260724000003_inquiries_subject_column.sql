-- 이전 마이그레이션(20260724000002)에서 신설한 테이블들이 실제 admin UI가
-- 수집하는 필드와 어긋나 있던 부분을 보정한다 — 테이블이 막 생성되어 비어있는
-- 상태라 컬럼 추가에 데이터 손실 위험이 없다.

-- app/contact/page.tsx 의 문의 폼이 실제로 수집하는 'subject'(문의 제목) 컬럼 추가
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS subject text;

-- app/admin/(dashboard)/assets/page.tsx 의 BGM 등록 폼이 실제로 수집하는 컬럼 추가
ALTER TABLE public.bgms ADD COLUMN IF NOT EXISTS genre text;
ALTER TABLE public.bgms ADD COLUMN IF NOT EXISTS hashtags text;
