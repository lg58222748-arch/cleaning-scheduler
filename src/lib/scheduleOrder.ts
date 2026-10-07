import { Schedule } from "@/types";

// 하루 안 일정 표시 순서 — 달력 칸·날짜 팝업·배정탭이 모두 같은 규칙을 쓴다.
// 1) 직접 정한 순서(sortOrder)가 있는 일정이 먼저, 그 순서대로
// 2) 순서를 안 정한 일정은 시간대(오전→사이→오후) 순
// 3) 같은 시간대면 먼저 등록된 순 → 마지막으로 id (매번 같은 순서 보장)
const UNORDERED = 1_000_000_000;

export function compareScheduleOrder(a: Schedule, b: Schedule): number {
  const ao = a.sortOrder ?? UNORDERED;
  const bo = b.sortOrder ?? UNORDERED;
  if (ao !== bo) return ao - bo;
  const t = (a.startTime || "").localeCompare(b.startTime || "");
  if (t !== 0) return t;
  const c = (a.createdAt || "").localeCompare(b.createdAt || "");
  if (c !== 0) return c;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
