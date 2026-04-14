"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { Schedule, Member } from "@/types";
import { assignScheduleApi } from "@/lib/api";
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

interface AssignTabProps {
  members: Member[];
  schedules: Schedule[];
  onAssigned: (scheduleId: string, memberId: string, memberName: string) => void;
}

export default function AssignTab({ members, schedules, onAssigned }: AssignTabProps) {
  // schedules prop이 이미 미배정만 담고 있음
  const unassigned = schedules;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayPopup, setShowDayPopup] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [slideDir, setSlideDir] = useState<"" | "left" | "right">("");
  const [animating, setAnimating] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  function handleAssign(schedule: Schedule) {
    if (!selectedMemberId) return;
    const member = members.find((m) => m.id === selectedMemberId);
    if (!member) return;
    // 팝업 즉시 닫기
    setShowDayPopup(false);
    setSelectedSchedule(null);
    setSelectedMemberId("");
    // 다음 프레임에서 상태 업데이트 (UI가 먼저 반응)
    requestAnimationFrame(() => {
      onAssigned(schedule.id, member.id, member.name);
    });
  }

  const activeMembers = useMemo(() => members.filter((m) => m.active), [members]);

  // 캘린더 주 배열
  // 항상 6주 고정
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

  // 날짜별 미배정 맵
  const scheduleMap = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const s of unassigned) {
      const existing = map.get(s.date) || [];
      existing.push(s);
      map.set(s.date, existing);
    }
    return map;
  }, [unassigned]);

  const daySchedules = useMemo(() => selectedDate
    ? (scheduleMap.get(format(selectedDate, "yyyy-MM-dd")) || [])
    : [], [selectedDate, scheduleMap]);

  function animateMonth(direction: "left" | "right", newMonth: Date) {
    if (animating) return;
    setAnimating(true);
    setSlideDir(direction);
    setTimeout(() => {
      setCurrentMonth(newMonth);
      setSlideDir(direction === "left" ? "right" : "left");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSlideDir("");
          setTimeout(() => setAnimating(false), 120);
        });
      });
    }, 120);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (animating) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) animateMonth("left", addMonths(currentMonth, 1));
      else animateMonth("right", subMonths(currentMonth, 1));
    }
  }

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  // 로딩 없음 - schedules는 이미 page.tsx에서 로드됨

  return (
    <div className="h-full flex flex-col" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* 미배정 캘린더 */}
      <div className="bg-white flex-1 flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <button onClick={() => animateMonth("right", subMonths(currentMonth, 1))} className="p-2 active:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="text-center">
            <h2 className="text-base font-bold text-gray-800">{format(currentMonth, "yyyy년 M월", { locale: ko })}</h2>
            <p className="text-[10px] text-orange-500 font-medium">미배정 {unassigned.length}건</p>
          </div>
          <button onClick={() => animateMonth("left", addMonths(currentMonth, 1))} className="p-2 active:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* 요일 */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {dayNames.map((name, i) => (
            <div key={name} className={`py-2 text-center text-sm font-medium ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"}`}>
              {name}
            </div>
          ))}
        </div>

        {/* 달력 그리드 */}
        <div className={`flex-1 divide-y divide-gray-50 transition-all duration-150 ease-in-out flex flex-col ${
          slideDir === "left" ? "-translate-x-4 opacity-0" : slideDir === "right" ? "translate-x-4 opacity-0" : "translate-x-0 opacity-100"
        }`}>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 divide-x divide-gray-50 flex-1">
              {week.map((d) => {
                const dateStr = format(d, "yyyy-MM-dd");
                const dayScheds = scheduleMap.get(dateStr) || [];
                const isSelected = selectedDate ? isSameDay(d, selectedDate) : false;
                const isCurrentMonth = isSameMonth(d, currentMonth);
                const dayOfWeek = d.getDay();

                return (
                  <button
                    key={dateStr}
                    onClick={() => { setSelectedDate(d); if (dayScheds.length > 0) setShowDayPopup(true); }}
                    className={`px-0.5 pt-0.5 pb-0 text-left relative flex flex-col ${
                      isSelected ? "bg-orange-50 ring-2 ring-orange-400 ring-inset" : "active:bg-gray-50"
                    } ${!isCurrentMonth ? "opacity-40" : ""}`}
                  >
                    <span className={`inline-flex items-center justify-center w-5 h-5 text-[11px] rounded-full ${
                      isToday(d) ? "bg-orange-500 text-white font-bold"
                        : dayOfWeek === 0 ? "text-red-500"
                        : dayOfWeek === 6 ? "text-blue-500"
                        : "text-gray-700"
                    }`}>
                      {format(d, "d")}
                    </span>
                    <div className="overflow-hidden flex-1 w-full relative">
                      {dayScheds.slice(0, 2).map((s) => {
                        const fullName = s.title.replace(/^\[.+?\]\s*/, "");
                        return (
                          <div
                            key={s.id}
                            className="text-[8px] leading-[1.2] py-0.5 rounded font-medium bg-orange-100 text-orange-700 overflow-hidden break-all mb-0.5"
                            style={{ maxHeight: "1.5em" }}
                          >
                            {fullName}
                          </div>
                        );
                      })}
                      {dayScheds.length > 2 && (
                        <div className="absolute bottom-0 right-0 text-[7px] text-gray-400 font-medium">+{dayScheds.length - 2}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 날짜 클릭 팝업 */}
      {showDayPopup && selectedDate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-8" onClick={(e) => { if (e.target === e.currentTarget) { setShowDayPopup(false); setSelectedSchedule(null); setSelectedMemberId(""); } }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[340px] animate-[modalIn_0.15s_ease-out]">
            <div className="px-5 pt-5 pb-2 flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{format(selectedDate, "d")}</span>
                <span className="text-sm text-gray-500">{format(selectedDate, "EEEE", { locale: ko })}</span>
              </div>
              <span className="text-xs px-2.5 py-1 bg-orange-500 text-white rounded-full font-bold">미배정</span>
            </div>

            <div className="px-4 pb-5 pt-1 space-y-2 max-h-[380px] overflow-y-auto">
              {daySchedules.map((s) => {
                const titleDisplay = s.title.replace(/^\[.+?\]\s*/, "").split("/")[0].replace(/^U/, "") || s.title;
                const isExpanded = selectedSchedule?.id === s.id;
                return (
                  <div key={s.id}>
                    <div
                      className="rounded-2xl cursor-pointer active:scale-[0.97] transition-transform bg-orange-100"
                      onClick={() => { setSelectedSchedule(isExpanded ? null : s); setSelectedMemberId(""); }}
                    >
                      <div className="px-4 py-3 flex items-center gap-3">
                        <span className="text-lg">📅</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-gray-900 truncate">{titleDisplay}</div>
                          <div className="text-xs text-gray-600 mt-0.5">하루 종일</div>
                        </div>
                        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                    {/* 펼침: 내용 + 배정 */}
                    {isExpanded && (
                      <div className="mt-1 mx-1 space-y-2">
                        {s.note && (
                          <div className="p-3 bg-white border border-orange-200 rounded-xl text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">
                            {s.note}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedMemberId}
                            onChange={(e) => setSelectedMemberId(e.target.value)}
                            className="flex-1 px-3 py-2 border border-orange-300 rounded-xl text-sm outline-none bg-white focus:ring-2 focus:ring-orange-400"
                          >
                            <option value="">팀장 선택</option>
                            {activeMembers.map((m) => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleAssign(s)}
                            disabled={!selectedMemberId}
                            className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium active:bg-orange-600 disabled:opacity-40 shrink-0"
                          >
                            배정
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
