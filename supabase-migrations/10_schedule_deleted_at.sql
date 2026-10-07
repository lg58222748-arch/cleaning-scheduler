-- 일정 삭제 시각(deleted_at) 컬럼 추가
-- 휴지통을 "최근에 삭제한 순" 으로 보여주기 위함.
-- softDeleteSchedule 에서 now() 기록, restoreSchedule 에서 null 로 초기화.
-- 기존 휴지통 건은 삭제 시각 기록이 없어 NULL 로 남고, 목록에서 기록된 건 아래에 날짜순으로 표시됨.
-- (이 컬럼이 없어도 앱은 정상 동작 — 삭제/복원은 그대로 되고 정렬만 날짜순)

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
