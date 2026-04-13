"use client";

import { useState } from "react";
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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let day = calStart;
  while (day <= calEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  function getMemberColor(memberId: string): string {
    return members.find((m) => m.id === memberId)?.color || "#6B7280";
  }

  function getSchedulesForDay(d: Date): Schedule[] {
    const dateStr = format(d, "yyyy-MM-dd");
    return schedules.filter((s) => s.date === dateStr);
  }

  function handlePrev() {
    const prev = subMonths(currentMonth, 1);
    setCurrentMonth(prev);
    onMonthChange(prev);
  }

  function handleNext() {
    const next = addMonths(currentMonth, 1);
    setCurrentMonth(next);
    onMonthChange(next);
  }

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <button
          onClick={handlePrev}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-gray-800">
          {format(currentMonth, "yyyy년 M월", { locale: ko })}
        </h2>
        <button
          onClick={handleNext}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
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
      <div className="divide-y divide-gray-50">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 divide-x divide-gray-50">
            {week.map((d) => {
              const daySchedules = getSchedulesForDay(d);
              const isSelected = isSameDay(d, selectedDate);
              const isCurrentMonth = isSameMonth(d, currentMonth);
              const dayOfWeek = d.getDay();

              return (
                <button
                  key={d.toISOString()}
                  onClick={() => onSelectDate(d)}
                  className={`min-h-[100px] p-1 text-left transition-colors relative ${
                    isSelected
                      ? "bg-blue-50 ring-2 ring-blue-400 ring-inset"
                      : "hover:bg-gray-50"
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
                  <div className="mt-0.5 space-y-0.5">
                    {daySchedules.map((s) => {
                      const timeMatch = s.title.match(/^\[(.+?)\]/);
                      const time = timeMatch ? timeMatch[1] : "";
                      const rest = s.title.replace(/^\[.+?\]\s*/, "");
                      const name = rest.split("/")[0].replace(/^U/, "");
                      return (
                        <div
                          key={s.id}
                          className="text-[10px] leading-tight px-1 py-0.5 rounded text-white"
                          style={{ backgroundColor: getMemberColor(s.memberId) }}
                        >
                          {time && <div className="font-medium">({time})</div>}
                          <div className="truncate">{name || s.title.slice(0, 6)}</div>
                        </div>
                      );
                    })}
                    {daySchedules.length > 3 && (
                      <div className="text-[9px] text-gray-400 px-0.5">
                        +{daySchedules.length - 3}
                      </div>
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
