// 달력 칸·날짜 팝업에 붙는 손없는날·공휴일 표시 (달력 탭과 배정 탭이 같이 씀)
import { DayInfo, lunarLabel } from "@/lib/koreanCalendar";

/** 날짜 줄 왼쪽 손없는날 표시 — 폰은 칸이 좁아 "손" 한 글자, 넓은 화면은 길게 */
function SonEomneunBadge() {
  return (
    <span
      className="absolute top-1/2 -translate-y-1/2 left-0 md:left-0.5 px-[2px] py-[2px] rounded-sm bg-emerald-50 text-emerald-600 text-[8px] md:text-[9px] font-bold leading-none pointer-events-none"
      title="손없는날"
    >
      <span className="md:hidden">손</span>
      <span className="hidden md:inline lg:hidden">손없</span>
      <span className="hidden lg:inline">손없는날</span>
    </span>
  );
}

/**
 * 달력 칸 윗부분: 날짜 숫자 + 손없는날 + 공휴일 이름.
 * 넓은 화면은 공휴일 이름을 숫자 옆 같은 줄에 둬서 일정 시작 높이가 모든 칸에서 같다.
 * 폰은 숫자 옆에 자리가 없어 이름을 아래 줄에 두되, 같은 주 칸들이 높이를 맞추도록
 * 그 주에 공휴일이 하나라도 있으면 모든 칸에 이름 줄을 비워 둔다(reserveLine).
 */
export function DayHeader({ label, numberClass, holiday, sonEomneun, reserveLine }: {
  label: string;
  numberClass: string;
  holiday: string | null;
  sonEomneun: boolean;
  reserveLine: boolean;
}) {
  return (
    <>
      <div className="relative w-full h-5 shrink-0 flex justify-center">
        {sonEomneun && <SonEomneunBadge />}
        <span className={`inline-flex items-center justify-center w-5 h-5 text-xs rounded-full ${numberClass}`}>{label}</span>
        {holiday && (
          <span
            className="hidden md:block absolute top-1/2 -translate-y-1/2 left-[calc(50%+13px)] right-0.5 truncate text-left text-[9px] leading-none font-medium text-red-500"
            title={holiday}
          >
            {holiday}
          </span>
        )}
      </div>
      {reserveLine && (
        <span className="md:hidden w-full h-[10px] -mt-px shrink-0 text-center truncate text-[8px] leading-[10px] font-medium text-red-500">
          {holiday ?? ""}
        </span>
      )}
    </>
  );
}

/** 날짜 팝업 머리글 밑 한 줄: 공휴일 · 손없는날 · 음력 */
export function DayInfoLine({ info }: { info: DayInfo }) {
  if (!info.holiday && !info.sonEomneun && !info.lunar) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs">
      {info.holiday && <span className="font-bold text-red-500">{info.holiday}</span>}
      {info.sonEomneun && (
        <span className="px-1.5 py-px rounded bg-emerald-50 text-emerald-600 font-bold">손없는날</span>
      )}
      {info.lunar && <span className="text-gray-400">{lunarLabel(info.lunar)}</span>}
    </div>
  );
}
