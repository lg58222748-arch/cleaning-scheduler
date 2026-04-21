-- 일정 색상 컬럼 추가
-- ScheduleDetail 모달에서 색상 선택 가능하지만, 컬럼이 없어서 저장이 무시되고 있었음.
-- Supabase 는 알 수 없는 컬럼으로 update 하면 조용히 무시/실패하므로 UI 만 바뀌고 리로드 시 원복.

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS color TEXT;
