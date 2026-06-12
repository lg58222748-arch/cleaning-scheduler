-- ============================================================
-- ⚠️ [구분] 이 파일은 "고객앱/통합앱(customer-app)" 전용 마이그레이션입니다.
--    파트너앱(cleaning-scheduler)과는 무관하며, 아래 SQL 을 Supabase 에서
--    직접 Run 하기 전까지는 어떤 DB/앱에도 영향이 없습니다 (단순 안내문).
--    파트너앱 코드는 customer_phone 컬럼을 사용하지 않습니다.
-- ============================================================
-- 07_customer_phone.sql
-- 일정에 고객 전화번호 컬럼 추가 — 통합앱(customer-app)이 본인 phone으로
-- 조회해서 D-Day/팀장 정보를 표시할 수 있게 함.
--
-- 상담원이 일정 입력 시 phone을 같이 넣으면, 고객은 앱 이용내역에서 본인 일정을
-- 자동으로 확인 가능 (phone 미입력 일정은 기존처럼 내부 관리용으로만 표시).
--
-- 적용:
--   Supabase Studio (스케줄러 프로젝트: peffdpjehpenqjdvzgzm) → SQL Editor
--   이 파일 전체 복붙 → Run
--
-- 안전성:
--   - 컬럼 추가만 (ADD COLUMN) → 기존 데이터·정책 영향 0
--   - 기본값 NULL → 기존 일정 전부 NULL (정상)
--   - 인덱스는 NULL 값 제외 (효율적)
-- ============================================================

-- 1) 컬럼 추가 (정규화된 phone 저장: 하이픈 제거된 11자리 숫자)
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;

COMMENT ON COLUMN schedules.customer_phone IS
  '통합앱 매칭용 고객 전화번호 (정규화: 숫자만 11자리). NULL = 미입력.';

-- 2) 인덱스 (phone 조회 성능)
CREATE INDEX IF NOT EXISTS idx_schedules_customer_phone
  ON schedules(customer_phone)
  WHERE customer_phone IS NOT NULL;

-- 3) 정규화 헬퍼 (선택 사용)
--    상담원이 010-1234-5678 입력 → 01012345678 로 저장하면 매칭 정확도 ↑
CREATE OR REPLACE FUNCTION public.normalize_phone(p TEXT)
RETURNS TEXT AS $$
BEGIN
  IF p IS NULL OR length(trim(p)) = 0 THEN
    RETURN NULL;
  END IF;
  -- 숫자만 추출
  RETURN regexp_replace(p, '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.normalize_phone(TEXT) IS
  '전화번호 정규화: 하이픈/공백 제거 후 숫자만 반환. 매칭 일관성용.';

-- ============================================================
-- 검증 쿼리:
--
--   1) 컬럼 추가 확인
--      SELECT column_name, data_type FROM information_schema.columns
--      WHERE table_name = 'schedules' AND column_name = 'customer_phone';
--
--   2) 정규화 함수 테스트
--      SELECT normalize_phone('010-1234-5678');  -- → '01012345678'
--      SELECT normalize_phone('010 1234 5678');  -- → '01012345678'
--
--   3) 기존 데이터 영향 확인 (phone 모두 NULL)
--      SELECT COUNT(*) FILTER (WHERE customer_phone IS NULL) AS without_phone,
--             COUNT(*) FILTER (WHERE customer_phone IS NOT NULL) AS with_phone
--      FROM schedules;
-- ============================================================
