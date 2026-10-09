// 달력 칸·날짜 팝업에 붙는 손없는날·공휴일 표시 (달력 탭과 배정 탭이 같이 씀)
import { DayInfo, lunarLabel } from "@/lib/koreanCalendar";

/** 달력 칸 왼쪽 위 손없는날 표시 — 폰은 칸이 좁아 "손" 한 글자, 넓은 화면은 길게 */
export function SonEomneunBadge() {
  return (
    <span
      className="absolute top-0.5 left-0.5 md:top-1 md:left-1 px-[2px] md:px-1 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 text-[8px] md:text-[10px] font-bold leading-[1.15] pointer-events-none"
      title="손없는날"
    >
      <span className="md:hidden">손</span>
      <span className="hidden md:inline lg:hidden">손없</span>
      <span className="hidden lg:inline">손없는날</span>
    </span>
  );
}

/** 달력 칸 날짜 밑 공휴일 이름 */
export function HolidayLabel({ name }: { name: string }) {
  return (
    <span className="w-full -mt-0.5 text-center truncate text-[8px] md:text-[10px] leading-tight font-medium text-red-500">
      {name}
    </span>
  );
}

/** 날짜 팝업 머리글 밑 한 줄: 공휴일 · 손없는날 · 음력 */
export function DayInfoLine({ info }: { info: DayInfo }) {
  if (!info.holiday && !info.sonEomneun && !info.lunar) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs">
      {info.holiday && <span className="font-bold text-red-500">{info.holiday}</span>}
      {info.sonEomneun && (
        <span className="px-1.5 py-px rounded border border-emerald-300 bg-emerald-50 text-emerald-700 font-bold">손없는날</span>
      )}
      {info.lunar && <span className="text-gray-400">{lunarLabel(info.lunar)}</span>}
    </div>
  );
}
