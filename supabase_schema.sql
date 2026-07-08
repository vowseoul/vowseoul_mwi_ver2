-- Supabase SQL Schema for VOW SEOUL (v2.1)
-- 이 쿼리를 Supabase SQL Editor에 복사하여 실행하세요.

-- 0. 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. profiles 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('ADMIN', 'DESIGNER')),
  name text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =========================================================================
-- 2. customers 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  groom_name text NOT NULL,
  bride_name text NOT NULL,
  phone text,
  wedding_date date NOT NULL,
  venue_name text NOT NULL,
  venue_address text NOT NULL,
  venue_coordinates jsonb,
  transportation_info text,
  status text NOT NULL CHECK (status IN ('registered', 'form_sent', 'form_completed', 'draft', 'published', 'expired')) DEFAULT 'registered',
  memo text,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =========================================================================
-- 3. field_library 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.field_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key text UNIQUE NOT NULL,
  label text NOT NULL,
  help_text text,
  field_type text NOT NULL CHECK (field_type IN ('text', 'date', 'time', 'select', 'address', 'phone', 'image', 'textarea', 'number')),
  validation_rules jsonb,
  category text NOT NULL CHECK (category IN ('신랑 정보', '신부 정보', '예식 정보', '혼주 정보', '계좌 정보', '이미지', 'BGM', 'RSVP 설정', '카카오 공유', '영상', '지류 전용')),
  is_system boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =========================================================================
-- 4. form_templates 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL, -- 지류 청첩장 종류
  current_version integer DEFAULT 1 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =========================================================================
-- 5. form_template_versions 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.form_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  fields_snapshot jsonb NOT NULL, -- 해당 버전의 필드 구성 목록 스냅샷
  change_note text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (template_id, version_number)
);

-- =========================================================================
-- 6. form_template_fields 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.form_template_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  field_library_id uuid NOT NULL REFERENCES public.field_library(id) ON DELETE CASCADE,
  label_override text,
  help_text_override text,
  is_required boolean DEFAULT false NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  options jsonb, -- 선택지 (select 필드용)
  UNIQUE (template_id, field_library_id)
);

-- =========================================================================
-- 7. form_instances 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.form_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.form_templates(id) ON DELETE SET NULL,
  fields_snapshot jsonb NOT NULL, -- 생성 시점의 템플릿 필드 구성 스냅샷 고정
  unique_url_slug text UNIQUE NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'active', 'completed', 'expired')) DEFAULT 'draft',
  access_password text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =========================================================================
-- 8. form_submissions 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_instance_id uuid NOT NULL REFERENCES public.form_instances(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  data jsonb NOT NULL, -- 제출된 정보 { key: value }
  missing_fields jsonb DEFAULT '[]'::jsonb NOT NULL, -- 누락된 필수 필드 리스트
  is_complete boolean DEFAULT false NOT NULL,
  submitted_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (form_instance_id)
);

-- =========================================================================
-- 9. block_library 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.block_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_key text UNIQUE NOT NULL, -- 'cover', 'greeting', 'gallery' 등
  name text NOT NULL,
  description text,
  icon_name text,
  is_required boolean DEFAULT false NOT NULL,
  allow_duplicate boolean DEFAULT false NOT NULL,
  recommended_position integer DEFAULT 0 NOT NULL,
  default_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  default_style jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =========================================================================
-- 10. block_variants 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.block_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_library_id uuid NOT NULL REFERENCES public.block_library(id) ON DELETE CASCADE,
  variant_key text NOT NULL, -- 'type_a', 'type_b', 'slide', 'grid' 등
  name text NOT NULL,
  description text,
  preview_image_url text,
  react_component_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (block_library_id, variant_key)
);

-- =========================================================================
-- 11. themes 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  thumbnail_url text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true NOT NULL,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =========================================================================
-- 12. theme_versions 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.theme_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES public.themes(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  design_tokens jsonb NOT NULL, -- 디자인 토큰 JSON (색상, 폰트, 여백 등)
  block_variant_selections jsonb NOT NULL, -- 블록별 기본 변형 선택 { "cover": "type_a" }
  default_block_order jsonb NOT NULL, -- 기본 블록 순서 배열 ["cover", "greeting"]
  default_block_visibility jsonb DEFAULT '{}'::jsonb NOT NULL,
  interaction_settings jsonb DEFAULT '{}'::jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'active', 'deprecated')) DEFAULT 'draft',
  change_note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (theme_id, version_number)
);

-- =========================================================================
-- 13. invitations 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  theme_version_id uuid REFERENCES public.theme_versions(id) ON DELETE SET NULL,
  public_slug text UNIQUE NOT NULL,
  dashboard_slug text UNIQUE NOT NULL,
  dashboard_password text NOT NULL, -- 기본 연락처 뒷4자리
  content_data jsonb DEFAULT '{}'::jsonb NOT NULL, -- 가공된 폼 입력값 및 내용
  customization_overrides jsonb DEFAULT '{}'::jsonb NOT NULL, -- 개별 토큰 덮어쓰기
  block_order jsonb NOT NULL, -- 청첩장 개별 블록 순서 배열
  status text NOT NULL CHECK (status IN ('draft', 'published', 'paused', 'expired')) DEFAULT 'draft',
  og_meta jsonb DEFAULT '{}'::jsonb NOT NULL,
  bgm_url text,
  published_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =========================================================================
-- 14. invitation_blocks 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.invitation_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  block_library_id uuid NOT NULL REFERENCES public.block_library(id) ON DELETE RESTRICT,
  block_variant_id uuid NOT NULL REFERENCES public.block_variants(id) ON DELETE RESTRICT,
  sort_order integer DEFAULT 0 NOT NULL,
  is_visible boolean DEFAULT true NOT NULL,
  use_data_binding boolean DEFAULT true NOT NULL, -- true면 폼 데이터 바인딩, false면 직접 입력
  block_data jsonb DEFAULT '{}'::jsonb NOT NULL, -- 직접 입력 시 저장되는 텍스트/이미지 등
  style_overrides jsonb DEFAULT '{}'::jsonb NOT NULL
);

-- =========================================================================
-- 15. rsvp_responses 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.rsvp_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  phone text NOT NULL,
  side text NOT NULL CHECK (side IN ('groom', 'bride')),
  is_attending boolean DEFAULT true NOT NULL,
  party_size integer DEFAULT 1 NOT NULL,
  meal_required boolean DEFAULT true NOT NULL,
  meal_choice text,
  shuttle_required boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =========================================================================
-- 16. guestbook_entries 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.guestbook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  message text NOT NULL,
  password_hash text NOT NULL, -- bcrypt
  is_visible boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =========================================================================
-- 17. visit_logs 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.visit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  ip_hash text NOT NULL, -- SHA-256
  user_agent text,
  referrer text,
  visited_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =========================================================================
-- 18. visit_daily_stats 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.visit_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  visit_date date NOT NULL,
  total_visits integer DEFAULT 0 NOT NULL,
  unique_visitors integer DEFAULT 0 NOT NULL,
  UNIQUE (invitation_id, visit_date)
);

-- =========================================================================
-- 19. account_info 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.account_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('groom', 'bride', 'groom_father', 'groom_mother', 'bride_father', 'bride_mother')),
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL
);

-- =========================================================================
-- 20. archived_invitations 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.archived_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_invitation_id uuid NOT NULL,
  full_snapshot jsonb NOT NULL,
  rsvp_snapshot jsonb,
  guestbook_snapshot jsonb,
  visit_stats_snapshot jsonb,
  archived_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =========================================================================
-- 21. notifications 테이블
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('form_submitted', 'draft_failed', 'link_expiring', 'theme_error')),
  title text NOT NULL,
  message text NOT NULL,
  link_to text,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =========================================================================
-- INDEXES & TRIGGERS
-- =========================================================================

-- updated_at 트리거 함수 생성
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 바인딩
CREATE TRIGGER set_customers_updated_at BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_form_templates_updated_at BEFORE UPDATE ON public.form_templates
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_form_submissions_updated_at BEFORE UPDATE ON public.form_submissions
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_invitations_updated_at BEFORE UPDATE ON public.invitations
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_customers_wedding_date ON public.customers(wedding_date);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);
CREATE INDEX IF NOT EXISTS idx_invitations_public_slug ON public.invitations(public_slug);
CREATE INDEX IF NOT EXISTS idx_invitations_dashboard_slug ON public.invitations(dashboard_slug);
CREATE INDEX IF NOT EXISTS idx_form_instances_slug ON public.form_instances(unique_url_slug);
CREATE INDEX IF NOT EXISTS idx_rsvp_responses_invitation ON public.rsvp_responses(invitation_id);
CREATE INDEX IF NOT EXISTS idx_guestbook_entries_invitation ON public.guestbook_entries(invitation_id);
CREATE INDEX IF NOT EXISTS idx_visit_daily_stats_inv_date ON public.visit_daily_stats(invitation_id, visit_date);
