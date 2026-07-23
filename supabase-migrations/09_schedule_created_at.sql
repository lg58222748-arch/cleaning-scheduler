-- 일정 등록(접수) 시각 컬럼 추가
-- 영업팀 통계에서 "이번달에 몇 건 접수했나" 를 집계하기 위함.
--
-- 주의: ADD COLUMN ... DEFAULT now() 를 한 번에 하면 기존 행 전부가
-- 마이그레이션 실행 시각으로 채워져서 "오늘 전부 등록됨" 으로 왜곡된다.
-- 그래서 (1) 컬럼만 NULL 로 추가 → 기존 건은 '등록일 모름' 으로 남기고
--        (2) 그 다음 DEFAULT 를 걸어 앞으로 INSERT 되는 건만 자동 기록.

-- 1) 컬럼 추가 (기존 행은 NULL 유지)
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- 2) 이후 INSERT 부터 자동으로 현재 시각 기록
ALTER TABLE schedules
  ALTER COLUMN created_at SET DEFAULT now();
