"use client";

import { useState, useMemo, useRef, useCallback, memo } from "react";
import { Schedule, Member } from "@/types";
import { assignScheduleApi, softDeleteSchedule, fetchDeletedSchedules, restoreScheduleApi, emptyTrashApi } from "@/lib/api";
import { showConfirm } from "@/lib/dialog";
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
  onDeleted?: (id: string) => void;
  onOpenDetail?: (schedule: Schedule) => void;
  onAddSchedule?: (date: Date) => void;
}

function AssignTab({ members, schedules, onAssigned, onDeleted, onOpenDetail, onAddSchedule }: AssignTabProps) {
  const unassigned = schedules;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayPopup, setShowDayPopup] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [showTrash, setShowTrash] = useState(false);
  const [trashItems, setTrashItems] = useState<Schedule[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [slideDir, setSlideDir] = useState<"" | "left" | "right">("");
  const [animating, setAnimating] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  // 같은 schedule 을 1-2 프레임 안에 더블탭했을 때 onAssigned 2회 호출 방지
  const assigningRef = useRef<string | null>(null);

  function handleAssign(schedule: Schedule) {
    if (!selectedMemberId) return;
    if (assigningRef.current === schedule.id) return;
    const member = members.find((m) => m.id === selectedMemberId);
    if (!member) return;
    assigningRef.current = schedule.id;
    // 팝업 즉시 닫기
    setShowDayPopup(false);
    setSelectedSchedule(null);
    setSelectedMemberId("");
    // 다음 프레임에서 상태 업데이트 (UI가 먼저 반응)
    requestAnimationFrame(() => {
      onAssigned(schedule.id, member.id, member.name);
      requestAnimationFrame(() => { assigningRef.current = null; });
    });
  }

  function handleDelete(id: string) {
    softDeleteSchedule(id);
    onDeleted?.(id);
    setShowDayPopup(false);
    setSelectedSchedule(null);
  }

  async function loadTrash() {
    setTrashLoading(true);
    const data = await fetchDeletedSchedules();
    setTrashItems(data);
    setTrashLoading(false);
  }

  async function handleRestore(id: string) {
    setTrashItems((prev) => prev.filter((s) => s.id !== id));
    await restoreScheduleApi(id);
  }

  async function handleEmptyTrash() {
    await emptyTrashApi();
    setTrashItems([]);
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
        {/* 헤더 — 달력 탭과 동일 사이즈 */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-gray-100">
          <button onClick={() => animateMonth("right", subMonths(currentMonth, 1))} className="p-1.5 active:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="text-center">
            <h2 className="text-base font-bold text-gray-800">{format(currentMonth, "yyyy년 M월", { locale: ko })}</h2>
            <p className="text-xs text-orange-500 font-medium">미배정 {unassigned.length}건</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { setShowTrash(true); loadTrash(); }} className="p-1.5 active:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            <button onClick={() => animateMonth("left", addMonths(currentMonth, 1))} className="p-1.5 active:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        {/* 요일 — 달력 탭과 동일 사이즈 */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {dayNames.map((name, i) => (
            <div key={name} className={`py-1 text-center text-xs font-medium ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"}`}>
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
                    onClick={() => { setSelectedDate(d); setShowDayPopup(true); }}
                    className={`px-0.5 pt-0.5 pb-0 relative flex flex-col items-center ${
                      isSelected ? "bg-orange-50 ring-2 ring-orange-400 ring-inset" : "active:bg-gray-50"
                    } ${!isCurrentMonth ? "opacity-40" : ""}`}
                  >
                    <span className={`inline-flex items-center justify-center w-5 h-5 text-xs rounded-full ${
                      isToday(d) ? "bg-orange-500 text-white font-bold"
                        : dayOfWeek === 0 ? "text-red-500"
                        : dayOfWeek === 6 ? "text-blue-500"
                        : "text-gray-700"
                    }`}>
                      {format(d, "d")}
                    </span>
                    <div className="overflow-hidden flex-1 w-full relative">
                      {dayScheds.slice(0, 2).map((s) => {
                        const fullName = s.title;
                        const schedColor = s.color || "#FFEDD5"; // 미배정 기본 주황 (달력탭과 동일 스타일)
                        return (
                          <div
                            key={s.id}
                            className="text-[9px] md:text-[11px] leading-[1.2] md:leading-[1.4] px-0.5 py-0.5 rounded font-medium overflow-hidden mb-0.5"
                            style={{ backgroundColor: schedColor, color: "#9a3412", maxHeight: "2.6em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}
                          >
                            {fullName}
                          </div>
                        );
                      })}
                      {dayScheds.length > 2 && (
                        <div className="absolute bottom-0 right-0 text-[8px] md:text-[10px] text-blue-600 font-bold bg-blue-100 px-1 py-0 rounded-full leading-none border border-blue-300">+{dayScheds.length - 2}</div>
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
              <div className="flex items-center gap-2">
                {daySchedules.length > 0 && (
                  <span className="text-xs px-2.5 py-1 bg-orange-500 text-white rounded-full font-bold">미배정 {daySchedules.length}</span>
                )}
                {onAddSchedule && (
                  <button
                    onClick={() => {
                      const d = selectedDate;
                      setShowDayPopup(false);
                      setSelectedSchedule(null);
                      setSelectedMemberId("");
                      setTimeout(() => onAddSchedule(d), 150);
                    }}
                    className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:bg-orange-100"
                    aria-label="일정 추가"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="px-4 pb-5 pt-1 space-y-2 max-h-[380px] overflow-y-auto">
              {daySchedules.length === 0 && (
                <div className="py-6 text-center text-xs text-gray-400">
                  이 날짜엔 미배정 일정이 없습니다.
                  {onAddSchedule && <div className="mt-1 text-gray-500">우측 상단 + 로 일정 추가</div>}
                </div>
              )}
              {daySchedules.map((s) => {
                const titleDisplay = s.title;
                return (
                  <div key={s.id}>
                    <div
                      className="rounded-2xl cursor-pointer active:scale-[0.97] transition-transform bg-orange-100"
                      onClick={() => {
                        setShowDayPopup(false);
                        setSelectedSchedule(null);
                        setSelectedMemberId("");
                        onOpenDetail?.(s);
                      }}
                    >
                      <div className="px-4 py-3 flex items-center gap-3">
                        <span className="text-lg">📅</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-gray-900 truncate">{titleDisplay}</div>
                          <div className="text-xs text-gray-600 mt-0.5">{s.title.match(/^\[(.+?)\]/)?.[1] || "하루 종일"}</div>
                        </div>
                        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 휴지통 모달 */}
      {showTrash && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-[modalIn_0.15s_ease-out]">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <button onClick={() => setShowTrash(false)} className="p-1.5 active:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h3 className="text-base font-bold text-gray-800">휴지통에 있는 일정</h3>
            <button onClick={handleEmptyTrash} className="text-xs text-red-500 font-bold active:text-red-700">비우기</button>
          </div>
          <div className="text-xs text-gray-400 px-4 py-2">30일 후 삭제됩니다</div>
          <div className="flex-1 overflow-y-auto">
            {trashLoading ? (
              <div className="py-12 text-center text-gray-400 text-sm">로딩 중...</div>
            ) : trashItems.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">휴지통이 비어있습니다</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {trashItems.map((s) => (
                  <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-800 truncate">{s.title.replace(/^\[.+?\]\s*/, "")}</div>
                      <div className="text-xs text-gray-400">{s.date} · {s.memberName}</div>
                    </div>
                    <button onClick={() => handleRestore(s.id)} className="p-1.5 active:bg-blue-50 rounded-lg" title="복원">
                      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    </button>
                    <button
                      onClick={() => {
                        showConfirm(`"${s.title}"\n\n정말 영구 삭제하시겠습니까?\n(복원 불가)`).then((ok) => {
                          if (ok) setTrashItems((prev) => prev.filter((t) => t.id !== s.id));
                        });
                      }}
                      className="p-1.5 active:bg-red-50 rounded-lg"
                      title="영구삭제"
                    >
                      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(AssignTab);
