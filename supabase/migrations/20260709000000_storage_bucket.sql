-- Baseline snapshot — 이미 운영 DB에 적용된 스토리지 버킷 설정 (구 create_storage_bucket.sql 을 이관)
--
-- ⚠️ 주의: 아래 정책은 인증 없이 누구나 업로드/조회/삭제할 수 있도록 허용한다
-- (bucket_id 만 확인, auth.uid() 체크 없음). 운영 트래픽이 커지면 재검토가 필요하다.

-- 1. vow-seoul-storage 버킷 생성 (이미 존재하면 건너뜀)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vow-seoul-storage', 'vow-seoul-storage', true)
ON CONFLICT (id) DO NOTHING;

-- 2. 스토리지 파일 업로드(INSERT) 권한 허용 정책 생성
DROP POLICY IF EXISTS "Allow public insert to vow-seoul-storage" ON storage.objects;
CREATE POLICY "Allow public insert to vow-seoul-storage"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'vow-seoul-storage');

-- 3. 스토리지 파일 읽기(SELECT) 권한 허용 정책 생성
DROP POLICY IF EXISTS "Allow public select from vow-seoul-storage" ON storage.objects;
CREATE POLICY "Allow public select from vow-seoul-storage"
ON storage.objects FOR SELECT
USING (bucket_id = 'vow-seoul-storage');

-- 4. 스토리지 파일 삭제(DELETE) 권한 허용 정책 생성 (옵션)
DROP POLICY IF EXISTS "Allow public delete from vow-seoul-storage" ON storage.objects;
CREATE POLICY "Allow public delete from vow-seoul-storage"
ON storage.objects FOR DELETE
USING (bucket_id = 'vow-seoul-storage');
