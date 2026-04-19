"use client";

import { useState, useMemo, useCallback, useRef, memo } from "react";
import { Schedule, Member } from "@/types";
import {
  format,
  startOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ko } from "date-fns/locale";

// 빈 배열 stable 참조 — DayCell memo 깨뜨리지 않기 위해 전 셀이 동일 ref 를 공유
const EMPTY_SCHEDULES: Schedule[] = [];

interface CalendarProps {
  schedules: Schedule[];
  members: Member[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onScheduleClick?: (schedule: Schedule) => void;
  onMonthChange: (date: Date) => void;
}

// 개별 day cell 을 memo 컴포넌트로 분리 → 해당 날짜 schedules 가 바뀌지 않으면 리렌더 안 됨.
// 부모(Calendar) 가 리렌더돼도 42 셀 전부 다시 렌더되지 않도록 방어.
interface DayCellProps {
  day: Date;
  isSelected: boolean;
  isCurrentMonth: boolean;
  isTodayDay: boolean;
  dayOfWeek: number;
  daySchedules: Schedule[];
  isSnapping: boolean;
  onSelectDate: (d: Date) => void;
  onScheduleClick?: (s: Schedule) => void;
}
const DayCell = memo(function DayCell({
  day, isSelected, isCurrentMonth, isTodayDay, dayOfWeek, daySchedules, isSnapping, onSelectDate, onScheduleClick,
}: DayCellProps) {
  return (
    <button
      onClick={() => !isSnapping && onSelectDate(day)}
      className={`px-0.5 pt-0.5 pb-0 relative flex flex-col items-center ${
        isSelected ? "bg-blue-50 ring-2 ring-blue-400 ring-inset" : "active:bg-gray-50"
      } ${!isCurrentMonth ? "opacity-40" : ""}`}
    >
      <span className={`inline-flex items-center justify-center w-5 h-5 text-xs rounded-full ${
        isTodayDay ? "bg-blue-500 text-white font-bold"
          : dayOfWeek === 0 ? "text-red-500"
          : dayOfWeek === 6 ? "text-blue-500"
          : "text-gray-700"
      }`}>
        {format(day, "d")}
      </span>
      <div className="overflow-hidden flex-1 w-full relative">
        {daySchedules.slice(0, 2).map((s) => {
          const fullName = s.title;
          const schedColor = s.color || "#FDDCCC";
          return (
            <div key={s.id} className="text-[9px] md:text-[11px] leading-[1.2] md:leading-[1.4] px-0.5 py-0.5 rounded font-medium overflow-hidden mb-0.5 md:cursor-pointer md:hover:opacity-80"
              style={{ backgroundColor: s.status === "completed" ? "#D1FAE5" : schedColor, color: "#555", maxHeight: "4em", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const }}
              onClick={(e) => { if (onScheduleClick && window.innerWidth >= 768) { e.stopPropagation(); onScheduleClick(s); } }}>
              {fullName}
            </div>
          );
        })}
        {daySchedules.length > 2 && (
          <div className="absolute bottom-0 right-0 text-[10px] md:text-[12px] text-blue-600 font-bold bg-blue-100 px-1.5 py-0.5 rounded-full leading-none border border-blue-300">+{daySchedules.length - 2}</div>
        )}
      </div>
    </button>
  );
});

export default memo(function Calendar({
  schedules,
  members,
  selectedDate,
  onSelectDate,
  onScheduleClick,
  onMonthChange,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 월 변경
  const changeMonth = useCallback((direction: 1 | -1) => {
    const newMonth = direction === 1 ? addMonths(currentMonth, 1) : subMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    onMonthChange(newMonth);
  }, [currentMonth, onMonthChange]);

  // 터치 시작
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isSnapping) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    isHorizontal.current = null;
    setIsDragging(true);
  }, [isSnapping]);

  // 터치 이동 - 손가락 따라감
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || isSnapping) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    // 방향 결정 (첫 10px)
    if (isHorizontal.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }

    if (isHorizontal.current) {
      e.preventDefault();
      // 저항감 적용 (끝으로 갈수록 느려짐)
      const resistance = 0.4;
      setDragX(dx * resistance);
    }
  }, [isDragging, isSnapping]);

  // 터치 끝 - 스냅
  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const velocity = dragX / Math.max(1, Date.now() - touchStartTime.current) * 1000;
    const width = containerRef.current?.offsetWidth || 300;
    const threshold = width * 0.15;

    if (Math.abs(dragX) > threshold || Math.abs(velocity) > 300) {
      // 월 변경 스냅
      const direction = dragX > 0 ? -1 : 1;
      setIsSnapping(true);
      setDragX(direction === 1 ? -width * 0.5 : width * 0.5);

      setTimeout(() => {
        changeMonth(direction);
        setDragX(direction === 1 ? width * 0.3 : -width * 0.3);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setDragX(0);
            setTimeout(() => setIsSnapping(false), 250);
          });
        });
      }, 150);
    } else {
      // 원래 위치로 복귀
      setDragX(0);
    }
  }, [isDragging, dragX, changeMonth]);

  // 버튼 클릭 월 이동
  const handlePrev = useCallback(() => {
    if (isSnapping) return;
    const width = containerRef.current?.offsetWidth || 300;
    setIsSnapping(true);
    setDragX(width * 0.5);
    setTimeout(() => {
      changeMonth(-1);
      setDragX(-width * 0.3);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setDragX(0);
          setTimeout(() => setIsSnapping(false), 250);
        });
      });
    }, 120);
  }, [isSnapping, changeMonth]);

  const handleNext = useCallback(() => {
    if (isSnapping) return;
    const width = containerRef.current?.offsetWidth || 300;
    setIsSnapping(true);
    setDragX(-width * 0.5);
    setTimeout(() => {
      changeMonth(1);
      setDragX(width * 0.3);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setDragX(0);
          setTimeout(() => setIsSnapping(false), 250);
        });
      });
    }, 120);
  }, [isSnapping, changeMonth]);

  // 6주 고정
  const weeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const days: Date[] = [];
    let day = calStart;
    for (let i = 0; i < 42; i++) { days.push(day); day = addDays(day, 1); }
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) result.push(days.slice(i, i + 7));
    return result;
  }, [currentMonth]);

  const scheduleMap = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const s of schedules) {
      const existing = map.get(s.date) || [];
      existing.push(s);
      map.set(s.date, existing);
    }
    return map;
  }, [schedules]);

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const opacity = Math.max(0, 1 - Math.abs(dragX) / 200);

  return (
    <div
      ref={containerRef}
      className="bg-white h-full flex flex-col select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: isDragging && isHorizontal.current ? "none" : "pan-y" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
        <button onClick={handlePrev} className="p-2 active:bg-gray-100 rounded-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2
          className="text-lg font-bold text-gray-800 will-change-transform"
          style={{
            transform: `translateX(${dragX * 0.5}px)`,
            opacity,
            transition: isDragging ? "none" : "all 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {format(currentMonth, "yyyy년 M월", { locale: ko })}
        </h2>
        <button onClick={handleNext} className="p-2 active:bg-gray-100 rounded-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {dayNames.map((name, i) => (
          <div key={name} className={`py-2 text-center text-sm font-medium ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"}`}>
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid - 손가락 따라감 */}
      <div
        className="flex-1 divide-y divide-gray-50 overflow-hidden flex flex-col will-change-transform"
        style={{
          transform: `translateX(${dragX}px)`,
          opacity,
          transition: isDragging ? "none" : "all 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 divide-x divide-gray-50 flex-1">
            {week.map((d) => {
              const dateStr = format(d, "yyyy-MM-dd");
              const daySchedules = scheduleMap.get(dateStr) || EMPTY_SCHEDULES;
              return (
                <DayCell
                  key={dateStr}
                  day={d}
                  isSelected={isSameDay(d, selectedDate)}
                  isCurrentMonth={isSameMonth(d, currentMonth)}
                  isTodayDay={isToday(d)}
                  dayOfWeek={d.getDay()}
                  daySchedules={daySchedules}
                  isSnapping={isSnapping}
                  onSelectDate={onSelectDate}
                  onScheduleClick={onScheduleClick}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
})
