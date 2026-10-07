-- 같은 날 일정 표시 순서(sort_order) 컬럼 추가
-- 날짜 팝업의 [순서] → ▲▼ 로 정한 순서를 저장. 달력 칸·팝업·배정탭이 이 순서대로 표시.
-- 기존 일정은 NULL(직접 정한 순서 없음) → 시간대(오전→사이→오후)·등록순으로 표시.
-- 이 컬럼이 없어도 앱은 정상 동작 (순서 저장만 안 됨).

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;
