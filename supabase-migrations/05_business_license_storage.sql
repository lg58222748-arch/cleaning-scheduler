-- ============================================================
-- 05_business_license_storage.sql
-- 사업자등록증 파일 저장용 Storage bucket 생성
--
-- 실행 방법:
--   Supabase Dashboard → SQL Editor → 새 쿼리 → 아래 전체 붙여넣기 → Run
--
-- 결과:
--   - bucket 'business-licenses' 생성 (비공개, 5MB 제한)
--   - 허용 MIME: 이미지(jpg/png/heic/webp) + pdf
--   - 서버 service-role 만 업로드/다운로드 가능 (anon 차단)
-- ============================================================

-- 1) Bucket 생성 (이미 있으면 무시)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-licenses',
  'business-licenses',
  false,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) RLS 정책 — anon 차단, service_role 만 접근
-- 기본 storage.objects 에는 RLS 가 켜져있음. 추가 정책 없으면 service_role 외 차단됨.
-- 명시적으로 차단 정책을 추가하고 싶으면 아래 주석 해제.

-- DROP POLICY IF EXISTS "block_anon_business_licenses" ON storage.objects;
-- CREATE POLICY "block_anon_business_licenses" ON storage.objects
--   FOR ALL TO anon USING (bucket_id <> 'business-licenses')
--   WITH CHECK (bucket_id <> 'business-licenses');

-- ============================================================
-- 검증:
--   SELECT * FROM storage.buckets WHERE id = 'business-licenses';
-- ============================================================
