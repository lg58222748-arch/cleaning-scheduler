"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { Schedule, Member } from "@/types";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ko } from "date-fns/locale";

interface CalendarProps {
  schedules: Schedule[];
  members: Member[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onMonthChange: (date: Date) => void;
}

export default function Calendar({
  schedules,
  members,
  selectedDate,
  onSelectDate,
  onMonthChange,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);
  const [slideDirection, setSlideDirection] = useState<"" | "left" | "right">("");
  const [animating, setAnimating] = useState(false);

  // 스와이프 감지
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const swiping = useRef(false);

  const animateMonth = useCallback((direction: "left" | "right", newMonth: Date) => {
    setSlideDirection(direction);
    setAnimating(true);
    setTimeout(() => {
      setCurrentMonth(newMonth);
      onMonthChange(newMonth);
      setSlideDirection(direction === "left" ? "right" : "left");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSlideDirection("");
          setTimeout(() => setAnimating(false), 200);
        });
      });
    }, 200);
  }, [onMonthChange]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swiping.current = false;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (animating) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      swiping.current = true;
      if (dx < 0) {
        animateMonth("left", addMonths(currentMonth, 1));
      } else {
        animateMonth("right", subMonths(currentMonth, 1));
      }
    }
  }, [currentMonth, animating, animateMonth]);

  // 주별 날짜 배열 메모이제이션 - 항상 6주 고정
  const weeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = calStart;
    // 항상 42일 (6주) 고정
    for (let i = 0; i < 42; i++) {
      days.push(day);
      day = addDays(day, 1);
    }

    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [currentMonth]);

  // 날짜별 일정 맵 메모이제이션
  const scheduleMap = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const s of schedules) {
      const existing = map.get(s.date) || [];
      existing.push(s);
      map.set(s.date, existing);
    }
    return map;
  }, [schedules]);

  // 멤버 색상 맵 메모이제이션
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      map.set(m.id, m.color);
    }
    return map;
  }, [members]);

  const handlePrev = useCallback(() => {
    if (animating) return;
    animateMonth("right", subMonths(currentMonth, 1));
  }, [currentMonth, animating, animateMonth]);

  const handleNext = useCallback(() => {
    if (animating) return;
    animateMonth("left", addMonths(currentMonth, 1));
  }, [currentMonth, animating, animateMonth]);

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 transform-gpu" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
        <button onClick={handlePrev} className="p-2 active:bg-gray-100 rounded-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className={`text-lg font-bold text-gray-800 transition-all duration-200 ease-in-out ${
          slideDirection === "left" ? "-translate-x-4 opacity-0" :
          slideDirection === "right" ? "translate-x-4 opacity-0" :
          "translate-x-0 opacity-100"
        }`}>
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
          <div
            key={name}
            className={`py-2 text-center text-sm font-medium ${
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"
            }`}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className={`divide-y divide-gray-50 transition-all duration-200 ease-in-out overflow-hidden ${
        slideDirection === "left" ? "-translate-x-8 opacity-0" :
        slideDirection === "right" ? "translate-x-8 opacity-0" :
        "translate-x-0 opacity-100"
      }`}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 divide-x divide-gray-50">
            {week.map((d) => {
              const dateStr = format(d, "yyyy-MM-dd");
              const daySchedules = scheduleMap.get(dateStr) || [];
              const isSelected = isSameDay(d, selectedDate);
              const isCurrentMonth = isSameMonth(d, currentMonth);
              const dayOfWeek = d.getDay();

              return (
                <button
                  key={dateStr}
                  onClick={() => onSelectDate(d)}
                  className={`min-h-[90px] p-1 text-left relative ${
                    isSelected
                      ? "bg-blue-50 ring-2 ring-blue-400 ring-inset"
                      : "active:bg-gray-50"
                  } ${!isCurrentMonth ? "opacity-40" : ""}`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 text-xs rounded-full ${
                      isToday(d)
                        ? "bg-blue-500 text-white font-bold"
                        : dayOfWeek === 0
                        ? "text-red-500"
                        : dayOfWeek === 6
                        ? "text-blue-500"
                        : "text-gray-700"
                    }`}
                  >
                    {format(d, "d")}
                  </span>
                  {/* 이벤트 바 - 셀 꽉 채움, 잘림 없이 */}
                  <div className="mt-0.5 overflow-hidden flex-1">
                    {daySchedules.slice(0, 1).map((s) => {
                      const fullName = s.title.replace(/^\[.+?\]\s*/, "");
                      const schedColor = s.color || "#FDDCCC";
                      return (
                        <div
                          key={s.id}
                          className="text-[8px] leading-[1.2] px-0.5 py-0.5 rounded font-medium overflow-hidden break-all"
                          style={{ backgroundColor: schedColor, color: "#555", maxHeight: "2.4em" }}
                        >
                          {fullName}
                        </div>
                      );
                    })}
                    {daySchedules.length > 1 && (
                      <div className="text-[7px] text-gray-400 px-0.5 mt-0.5">+{daySchedules.length - 1}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
