-- Seed Data for VOW SEOUL (v2.1)
-- 이 쿼리를 Supabase SQL Editor에 복사하여 실행하세요.

-- 1. auth.users 및 public.profiles 생성
-- (auth.users 가 충돌나지 않도록 uuid 및 email로 검사)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('e1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'vovvseoul@gmail.com', crypt('admin1234', gen_salt('bf')), now(), 'authenticated', '{"provider":"email","providers":["email"]}', '{"name":"운영자"}', now(), now()),
  ('f6e5d4c3-b2a1-0f9e-8d7c-6b5a4f3e2d1c', 'designer@vowseoul.com', crypt('designer1234', gen_salt('bf')), now(), 'authenticated', '{"provider":"email","providers":["email"]}', '{"name":"디자이너"}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, role, name, created_at)
VALUES
  ('e1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'vovvseoul@gmail.com', 'ADMIN', '운영자', now()),
  ('f6e5d4c3-b2a1-0f9e-8d7c-6b5a4f3e2d1c', 'designer@vowseoul.com', 'DESIGNER', '디자이너', now())
ON CONFLICT (id) DO NOTHING;

-- 2. field_library (글로벌 필드 정의)
INSERT INTO public.field_library (id, field_key, label, help_text, field_type, category, is_system, validation_rules)
VALUES
  ('f0101000-0000-0000-0000-000000000001', 'groom_name', '신랑 이름 (한글)', '신랑의 한글 이름을 입력하세요.', 'text', '신랑 정보', true, '{"minLength": 2, "maxLength": 10}'),
  ('f0101000-0000-0000-0000-000000000002', 'groom_name_en', '신랑 이름 (영문)', '신랑의 영문 이름을 입력하세요.', 'text', '신랑 정보', true, '{"regex": "^[a-zA-Z\\s]+$"}'),
  ('f0101000-0000-0000-0000-000000000003', 'groom_phone', '신랑 연락처', '신랑의 휴대전화 번호를 입력하세요.', 'phone', '신랑 정보', true, '{}'),
  ('f0101000-0000-0000-0000-000000000004', 'groom_birth_order', '신랑 서열', '부모님과의 관계에서의 서열을 선택하세요.', 'select', '신랑 정보', true, '{}'),
  ('f0101000-0000-0000-0000-000000000005', 'groom_relationship', '신랑측 관계 표기', '인사말 등에서 쓰일 서열의 직접 입력 텍스트입니다.', 'text', '신랑 정보', true, '{}'),
  ('f0101000-0000-0000-0000-000000000006', 'groom_photo', '신랑 개별 사진', '일부 테마에 들어갈 신랑 사진을 등록하세요.', 'image', '신랑 정보', true, '{}'),
  ('f0101000-0000-0000-0000-000000000007', 'groom_sns_instagram', '신랑 인스타그램', '신랑 인스타그램 아이디를 입력하세요.', 'text', '신랑 정보', true, '{}'),
  ('f0101000-0000-0000-0000-000000000008', 'groom_show_phone', '신랑 연락처 노출 여부', '청첩장에서 연락처를 숨기려면 해제하세요.', 'text', '신랑 정보', true, '{}'),

  ('f0102000-0000-0000-0000-000000000001', 'bride_name', '신부 이름 (한글)', '신부의 한글 이름을 입력하세요.', 'text', '신부 정보', true, '{"minLength": 2, "maxLength": 10}'),
  ('f0102000-0000-0000-0000-000000000002', 'bride_name_en', '신부 이름 (영문)', '신부의 영문 이름을 입력하세요.', 'text', '신부 정보', true, '{"regex": "^[a-zA-Z\\s]+$"}'),
  ('f0102000-0000-0000-0000-000000000003', 'bride_phone', '신부 연락처', '신부의 휴대전화 번호를 입력하세요.', 'phone', '신부 정보', true, '{}'),
  ('f0102000-0000-0000-0000-000000000004', 'bride_birth_order', '신부 서열', '부모님과의 관계에서의 서열을 선택하세요.', 'select', '신부 정보', true, '{}'),
  ('f0102000-0000-0000-0000-000000000005', 'bride_relationship', '신부측 관계 표기', '인사말 등에서 쓰일 서열의 직접 입력 텍스트입니다.', 'text', '신부 정보', true, '{}'),
  ('f0102000-0000-0000-0000-000000000006', 'bride_photo', '신부 개별 사진', '일부 테마에 들어갈 신부 사진을 등록하세요.', 'image', '신부 정보', true, '{}'),
  ('f0102000-0000-0000-0000-000000000007', 'bride_sns_instagram', '신부 인스타그램', '신부 인스타그램 아이디를 입력하세요.', 'text', '신부 정보', true, '{}'),
  ('f0102000-0000-0000-0000-000000000008', 'bride_show_phone', '신부 연락처 노출 여부', '청첩장에서 연락처를 숨기려면 해제하세요.', 'text', '신부 정보', true, '{}'),

  ('f0103000-0000-0000-0000-000000000001', 'groom_father_name', '신랑 아버지 이름', '신랑 아버님의 한글 이름을 입력하세요.', 'text', '혼주 정보', true, '{}'),
  ('f0103000-0000-0000-0000-000000000002', 'groom_father_deceased', '신랑 아버지 고인 여부', '아버님이 돌아가신 경우 체크하세요.', 'text', '혼주 정보', true, '{}'),
  ('f0103000-0000-0000-0000-000000000003', 'groom_mother_name', '신랑 어머니 이름', '신랑 어머님의 한글 이름을 입력하세요.', 'text', '혼주 정보', true, '{}'),
  ('f0103000-0000-0000-0000-000000000004', 'groom_mother_deceased', '신랑 어머니 고인 여부', '어머님이 돌아가신 경우 체크하세요.', 'text', '혼주 정보', true, '{}'),

  ('f0104000-0000-0000-0000-000000000001', 'bride_father_name', '신부 아버지 이름', '신부 아버님의 한글 이름을 입력하세요.', 'text', '혼주 정보', true, '{}'),
  ('f0104000-0000-0000-0000-000000000002', 'bride_father_deceased', '신부 아버지 고인 여부', '아버님이 돌아가신 경우 체크하세요.', 'text', '혼주 정보', true, '{}'),
  ('f0104000-0000-0000-0000-000000000003', 'bride_mother_name', '신부 어머니 이름', '신부 어머님의 한글 이름을 입력하세요.', 'text', '혼주 정보', true, '{}'),
  ('f0104000-0000-0000-0000-000000000004', 'bride_mother_deceased', '신부 어머니 고인 여부', '어머님이 돌아가신 경우 체크하세요.', 'text', '혼주 정보', true, '{}'),

  ('f0105000-0000-0000-0000-000000000001', 'wedding_date', '예식 날짜', '결혼식 날짜를 선택하세요.', 'date', '예식 정보', true, '{}'),
  ('f0105000-0000-0000-0000-000000000002', 'wedding_time', '예식 시간', '결혼식 시작 시간을 선택하세요.', 'time', '예식 정보', true, '{}'),
  ('f0105000-0000-0000-0000-000000000003', 'venue_name', '예식장 이름', '결혼식장 건물명/홀 이름을 입력하세요.', 'text', '예식 정보', true, '{}'),
  ('f0105000-0000-0000-0000-000000000004', 'venue_address', '도로명 주소', '결혼식장 주소를 검색하여 선택하세요.', 'address', '예식 정보', true, '{}'),
  ('f0105000-0000-0000-0000-000000000005', 'venue_coordinates', '위도/경도 좌표', '주소 검색 시 자동으로 계산되는 위경도 값입니다.', 'text', '예식 정보', true, '{}'),

  ('f0106000-0000-0000-0000-000000000001', 'greeting_message', '초대 인사말', '모실 글 내용을 입력하세요.', 'textarea', '예식 정보', true, '{}'),
  ('f0107000-0000-0000-0000-000000000001', 'main_image', '메인 커버 이미지', '청첩장의 대문에 표시될 이미지 1장을 등록하세요.', 'image', '이미지', true, '{}'),
  ('f0107000-0000-0000-0000-000000000002', 'gallery_images', '포토 갤러리 이미지 목록', '갤러리에 들어갈 이미지들을 등록하세요.', 'image', '이미지', true, '{}'),

  ('f0108000-0000-0000-0000-000000000001', 'account_groom_bank', '신랑 은행명', '신랑의 은행명을 선택하세요.', 'select', '계좌 정보', true, '{}'),
  ('f0108000-0000-0000-0000-000000000002', 'account_groom_number', '신랑 계좌번호', '신랑의 계좌번호를 입력하세요.', 'text', '계좌 정보', true, '{}'),
  ('f0108000-0000-0000-0000-000000000003', 'account_groom_holder', '신랑 예금주', '신랑의 예금주명을 입력하세요.', 'text', '계좌 정보', true, '{}'),
  ('f0108000-0000-0000-0000-000000000004', 'account_bride_bank', '신부 은행명', '신부의 은행명을 선택하세요.', 'select', '계좌 정보', true, '{}'),
  ('f0108000-0000-0000-0000-000000000005', 'account_bride_number', '신부 계좌번호', '신부의 계좌번호를 입력하세요.', 'text', '계좌 정보', true, '{}'),
  ('f0108000-0000-0000-0000-000000000006', 'account_bride_holder', '신부 예금주', '신부의 예금주명을 입력하세요.', 'text', '계좌 정보', true, '{}')
ON CONFLICT (id) DO NOTHING;

-- 3. block_library (블럭 정의)
INSERT INTO public.block_library (id, block_key, name, description, icon_name, is_required, allow_duplicate, recommended_position, default_data, default_style)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'cover', '메인 커버', '청첩장의 대문 이미지와 부부 이름, 날짜 등을 나타내는 최상단 블럭입니다.', 'Home', true, false, 1, '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000002', 'greeting', '인사말', '초대의 글과 인사말을 보여주는 블럭입니다.', 'FileText', true, false, 2, '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000003', 'couple-info', '신랑신부 정보', '신랑 신부 및 혼주 연락처와 관계를 나타냅니다.', 'Users', true, false, 3, '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000004', 'event-info', '예식 정보', '예식 시간, 요일, 홀 상세 정보를 표기합니다.', 'Calendar', true, false, 4, '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000005', 'gallery', '포토 갤러리', '슬라이드 혹은 바둑판 배열의 웨딩 사진첩 블럭입니다.', 'Image', false, false, 5, '{"layout": "slide"}', '{}'),
  ('b0000000-0000-0000-0000-000000000006', 'map', '오시는 길 (지도)', '지도 및 대중교통, 주차 등 찾아오시는 길 정보를 표기합니다.', 'MapPin', true, false, 6, '{"transport_subway": "지하철 노선 정보", "transport_bus": "버스 노선 정보"}', '{}'),
  ('b0000000-0000-0000-0000-000000000007', 'account', '축의금 송금', '부부 및 혼주의 축의금 송금 은행 및 계좌번호 복사 기능을 제공합니다.', 'CreditCard', false, false, 7, '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000008', 'rsvp', 'RSVP 하객 응답', '하객들이 직접 참석 의사와 식사 여부를 등록할 수 있는 응답 폼입니다.', 'CheckSquare', false, false, 8, '{"rsvp_enabled": true}', '{}'),
  ('b0000000-0000-0000-0000-000000000009', 'guestbook', '축하 방명록', '하객들이 남기는 덕담 방명록 한 칸입니다.', 'MessageCircle', false, false, 9, '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000010', 'bgm', '배경음악 (BGM)', '청첩장 실행 시 흐르는 잔잔한 오디오 연주 설정입니다.', 'Music', false, false, 0, '{}', '{}')
ON CONFLICT (id) DO NOTHING;

-- 4. block_variants (블럭 변형 정의)
INSERT INTO public.block_variants (id, block_library_id, variant_key, name, description, preview_image_url, react_component_name)
VALUES
  ('ba000001-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'type_a', '풀스크린 메인', '화면 전체에 메인 사진이 가득 차는 클래식 레이아웃', '/previews/cover_type_a.jpg', 'CoverTypeA'),
  ('ba000001-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'type_b', '텍스트 오버레이', '메인 사진 위에 감각적인 세리프 텍스트가 겹쳐진 디자인', '/previews/cover_type_b.jpg', 'CoverTypeB'),
  ('ba000001-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'type_c', '분할 레이아웃', '사진과 텍스트 영역이 상하로 명확히 분할된 미니멀 레이아웃', '/previews/cover_type_c.jpg', 'CoverTypeC'),

  ('ba000002-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'type_a', '기본 인사말', '심플하고 정갈한 인사말', '/previews/greeting_type_a.jpg', 'GreetingTypeA'),
  ('ba000002-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'type_b', '장식 프레임형', '인사말 주변에 우아한 골드 테두리가 둘러진 형태', '/previews/greeting_type_b.jpg', 'GreetingTypeB'),

  ('ba000003-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'type_a', '기본 수직형', '양가 이름과 정보가 중앙 정렬로 심플하게 나열되는 리스트', '/previews/couple_info_type_a.jpg', 'CoupleInfoTypeA'),
  ('ba000003-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'type_b', '좌우 분할 카드형', '신랑측과 신부측 정보가 두 개 카드 형태로 깔끔하게 나눠진 레이아웃', '/previews/couple_info_type_b.jpg', 'CoupleInfoTypeB'),

  ('ba000004-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'type_a', '심플 정보형', '예식 시간과 날짜, 홀 정보가 수직으로 정렬되는 깔끔한 디자인', '/previews/event_info_type_a.jpg', 'EventInfoTypeA'),
  ('ba000004-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004', 'type_b', 'D-day 카운트다운형', '예식일 D-Day 카운터 위젯이 포함되어 다이내믹하게 날짜를 표시하는 레이아웃', '/previews/event_info_type_b.jpg', 'EventInfoTypeB'),

  ('ba000005-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005', 'slide', '가로 슬라이드형', '좌우로 스와이프하며 한 장씩 감상하는 갤러리', '/previews/gallery_slide.jpg', 'GallerySlide'),
  ('ba000005-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000005', 'grid', '바둑판 그리드형', '3열 바둑판 형태로 한 눈에 썸네일을 모아보는 갤러리', '/previews/gallery_grid.jpg', 'GalleryGrid'),

  ('ba000007-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000007', 'type_a', '계좌 목록형', '모든 계좌번호 정보가 한 번에 다 열려있는 나열형', '/previews/account_type_a.jpg', 'AccountTypeA'),
  ('ba000007-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000007', 'type_b', '접이식 아코디언형', '신랑측 / 신부측 계좌 탭을 누르면 아래로 펼쳐지는 아코디언 접이식', '/previews/account_type_b.jpg', 'AccountTypeB')
ON CONFLICT (id) DO NOTHING;

-- BGM, RSVP 등 단일 변형 블록의 기본 변형도 명시적으로 삽입
INSERT INTO public.block_variants (id, block_library_id, variant_key, name, description, preview_image_url, react_component_name)
VALUES
  ('ba000006-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000006', 'default', '기본 지도', '카카오맵 연동 지도와 교통수단 안내', '/previews/map_default.jpg', 'MapSection'),
  ('ba000008-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000008', 'default', 'RSVP 기본폼', '하객 응답 접수 기본 양식', '/previews/rsvp_default.jpg', 'RSVPForm'),
  ('ba000009-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000009', 'default', '방명록 기본형', '방명록 축하 댓글 타일', '/previews/guestbook_default.jpg', 'GuestbookSection'),
  ('ba000010-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000010', 'default', 'BGM 기본플레이어', '우측 상단 플로팅 플레이어', '/previews/bgm_default.jpg', 'BGMPlayer')
ON CONFLICT (id) DO NOTHING;

-- 5. form_templates (기본 폼 템플릿)
INSERT INTO public.form_templates (id, name, description, category, current_version, is_active, created_by)
VALUES
  ('e0000000-0000-0000-0000-000000000001', '기본 화이트 지류 연동 폼', 'VOW SEOUL의 베이직한 지류 청첩장 주문 고객용 기본 정보 수집 폼입니다.', '클래식 화이트 라인', 1, true, 'e1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'),
  ('e0000000-0000-0000-0000-000000000002', '프리미엄 사진 인쇄 연동 폼', '포토 갤러리 및 상세한 정보가 들어가는 프리미엄 폼 템플릿입니다.', '프리미엄 시그니처 포토', 1, true, 'e1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d')
ON CONFLICT (id) DO NOTHING;

-- 6. form_template_fields (각 템플릿에 필드 배치)
INSERT INTO public.form_template_fields (template_id, field_library_id, is_required, sort_order)
VALUES
  -- 1번 템플릿 (기본 화이트)
  ('e0000000-0000-0000-0000-000000000001', 'f0101000-0000-0000-0000-000000000001', true, 1), -- 신랑이름
  ('e0000000-0000-0000-0000-000000000001', 'f0101000-0000-0000-0000-000000000003', true, 2), -- 신랑연락처
  ('e0000000-0000-0000-0000-000000000001', 'f0102000-0000-0000-0000-000000000001', true, 3), -- 신부이름
  ('e0000000-0000-0000-0000-000000000001', 'f0102000-0000-0000-0000-000000000003', true, 4), -- 신부연락처
  ('e0000000-0000-0000-0000-000000000001', 'f0105000-0000-0000-0000-000000000001', true, 5), -- 예식날짜
  ('e0000000-0000-0000-0000-000000000001', 'f0105000-0000-0000-0000-000000000002', true, 6), -- 예식시간
  ('e0000000-0000-0000-0000-000000000001', 'f0105000-0000-0000-0000-000000000003', true, 7), -- 예식장이름
  ('e0000000-0000-0000-0000-000000000001', 'f0105000-0000-0000-0000-000000000004', true, 8), -- 주소
  ('e0000000-0000-0000-0000-000000000001', 'f0106000-0000-0000-0000-000000000001', true, 9)  -- 인사말
ON CONFLICT (template_id, field_library_id) DO NOTHING;

-- 7. themes (기본 테마)
INSERT INTO public.themes (id, name, description, thumbnail_url, created_by, is_active)
VALUES
  ('de000000-0000-0000-0000-000000000001', '봄날의 세레나데 (Spring Serenade)', '따뜻한 아이보리와 골드 악센트로 피어나는 봄날의 감성을 나타냅니다.', '/themes/spring_serenade.jpg', 'f6e5d4c3-b2a1-0f9e-8d7c-6b5a4f3e2d1c', true),
  ('de000000-0000-0000-0000-000000000002', '모던 에센스 (Modern Essence)', '절제된 타이포그래피와 대담한 색상 반전이 특징인 듀오톤 현대식 테마입니다.', '/themes/modern_essence.jpg', 'f6e5d4c3-b2a1-0f9e-8d7c-6b5a4f3e2d1c', true)
ON CONFLICT (id) DO NOTHING;

-- 8. theme_versions (기본 테마 버전 & 디자인 토큰 설정)
INSERT INTO public.theme_versions (id, theme_id, version_number, design_tokens, block_variant_selections, default_block_order, default_block_visibility, interaction_settings, status, change_note)
VALUES
  (
    'da000001-0000-0000-0000-000000000001',
    'de000000-0000-0000-0000-000000000001',
    1,
    '{
      "colors": {
        "primary": "#c4a574",
        "secondary": "#f5e6d3",
        "background": "#faf9f7",
        "text": "#3d3d3d",
        "textMuted": "#8a8a8a",
        "border": "#ececec",
        "accent": "#b29363"
      },
      "typography": {
        "heading": { "fontFamily": "Playfair Display, Noto Serif KR, serif", "fontWeight": 400 },
        "body": { "fontFamily": "Inter, Noto Sans KR, sans-serif", "fontWeight": 400 }
      },
      "spacing": { "sectionGap": "48px", "contentPadding": "24px" },
      "border": { "radius": "8px" }
    }'::jsonb,
    '{
      "cover": "type_a",
      "greeting": "type_a",
      "couple-info": "type_a",
      "event-info": "type_a",
      "gallery": "slide",
      "account": "type_b",
      "map": "default",
      "rsvp": "default",
      "guestbook": "default",
      "bgm": "default"
    }'::jsonb,
    '["cover", "greeting", "couple-info", "event-info", "gallery", "map", "account", "rsvp", "guestbook"]'::jsonb,
    '{"cover": true, "greeting": true, "couple-info": true, "event-info": true, "gallery": true, "map": true, "account": true, "rsvp": true, "guestbook": true, "bgm": false}'::jsonb,
    '{"map_provider": "kakao", "rsvp_meal": true, "guestbook_visible_default": true}'::jsonb,
    'active',
    '초기 버전 배포'
  ),
  (
    'da000001-0000-0000-0000-000000000002',
    'de000000-0000-0000-0000-000000000002',
    1,
    '{
      "colors": {
        "primary": "#CCECFF",
        "secondary": "#361623",
        "background": "#361623",
        "text": "#CCECFF",
        "textMuted": "#CCECFF",
        "border": "#CCECFF",
        "accent": "#CCECFF"
      },
      "typography": {
        "heading": { "fontFamily": "Playfair Display, Noto Serif KR, serif", "fontWeight": 400 },
        "body": { "fontFamily": "Inter, Noto Sans KR, sans-serif", "fontWeight": 400 }
      },
      "spacing": { "sectionGap": "64px", "contentPadding": "32px" },
      "border": { "radius": "0px" }
    }'::jsonb,
    '{
      "cover": "type_b",
      "greeting": "type_b",
      "couple-info": "type_b",
      "event-info": "type_b",
      "gallery": "grid",
      "account": "type_a",
      "map": "default",
      "rsvp": "default",
      "guestbook": "default",
      "bgm": "default"
    }'::jsonb,
    '["cover", "greeting", "couple-info", "event-info", "gallery", "map", "account", "rsvp", "guestbook"]'::jsonb,
    '{"cover": true, "greeting": true, "couple-info": true, "event-info": true, "gallery": true, "map": true, "account": true, "rsvp": true, "guestbook": true, "bgm": false}'::jsonb,
    '{"map_provider": "kakao", "rsvp_meal": true, "guestbook_visible_default": true}'::jsonb,
    'active',
    '듀오톤 테마 1차 시안 배포'
  )
ON CONFLICT (id) DO NOTHING;
