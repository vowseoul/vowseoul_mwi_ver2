-- 1. vow-seoul-storage 버킷 생성 (이미 존재하면 건너뜀)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vow-seoul-storage', 'vow-seoul-storage', true)
ON CONFLICT (id) DO NOTHING;

-- 2. 스토리지 파일 업로드(INSERT) 권한 허용 정책 생성
CREATE POLICY "Allow public insert to vow-seoul-storage"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'vow-seoul-storage');

-- 3. 스토리지 파일 읽기(SELECT) 권한 허용 정책 생성
CREATE POLICY "Allow public select from vow-seoul-storage"
ON storage.objects FOR SELECT
USING (bucket_id = 'vow-seoul-storage');

-- 4. 스토리지 파일 삭제(DELETE) 권한 허용 정책 생성 (옵션)
CREATE POLICY "Allow public delete from vow-seoul-storage"
ON storage.objects FOR DELETE
USING (bucket_id = 'vow-seoul-storage');
