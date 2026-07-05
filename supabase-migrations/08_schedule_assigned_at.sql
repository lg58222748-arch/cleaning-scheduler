-- 배정 시각(assigned_at) 컬럼 추가
-- 배정탭 → 달력으로 일정이 배정된 순간의 시각을 기록해서, 일정 상세에
-- "O월 O일 O시 배정" 으로 보여주기 위함.
-- assignSchedule 에서 now() 를 기록하고, unassignSchedule 에서 null 로 초기화한다.
-- (이 마이그레이션 실행 전 배정된 일정은 기록이 없어 표시되지 않음 — 앞으로 배정되는 건부터 표시됨)

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
