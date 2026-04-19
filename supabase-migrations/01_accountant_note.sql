-- settlements 에 세무사 특이사항 컬럼 추가 (세무사 ↔ 관리자 간 메모/질문)
-- 기존 note 컬럼은 현장/본사 정산 노트라 별도 컬럼으로 분리

alter table settlements
  add column if not exists accountant_note text default '';
