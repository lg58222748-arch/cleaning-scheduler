-- ============================================================
-- 06_app_settings.sql
-- 앱 전역 설정 저장용 key/value 테이블 (활동범위 지도 설정 공유 등)
--
-- 실행 방법:
--   Supabase Dashboard → SQL Editor → 아래 전체 붙여넣기 → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);

-- 최초 행 — 지도 설정 (관리자가 첫 저장 전이라도 GET 시 빈 객체 반환되도록)
INSERT INTO app_settings (key, value)
VALUES ('map', '{"radii":{},"positions":{},"hiddenPins":[]}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 검증
-- SELECT * FROM app_settings;
