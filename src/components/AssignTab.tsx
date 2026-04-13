"use client";

import { useState, useEffect, useCallback } from "react";
import { Schedule, Member } from "@/types";
import { fetchUnassignedSchedules, assignScheduleApi } from "@/lib/api";

interface AssignTabProps {
  members: Member[];
  onAssigned: () => void;
}

export default function AssignTab({ members, onAssigned }: AssignTabProps) {
  const [unassigned, setUnassigned] = useState<Schedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [loading, setLoading] = useState(true);

  const loadUnassigned = useCallback(async () => {
    setLoading(true);
    const data = await fetchUnassignedSchedules();
    setUnassigned(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadUnassigned(); }, [loadUnassigned]);

  async function handleAssign() {
    if (!selectedSchedule || !selectedMemberId) return;
    const member = members.find((m) => m.id === selectedMemberId);
    if (!member) return;
    await assignScheduleApi(selectedSchedule.id, member.id, member.name);
    setSelectedSchedule(null);
    setSelectedMemberId("");
    await loadUnassigned();
    onAssigned();
  }

  const activeMembers = members.filter((m) => m.active);

  if (loading) return <div className="py-12 text-center text-gray-400 text-sm">로딩 중...</div>;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-800">미배정 대기 일정</h3>
            <p className="text-xs text-gray-400">{unassigned.length}건 대기 중</p>
          </div>
          <button
            onClick={loadUnassigned}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium active:bg-gray-200"
          >
            새로고침
          </button>
        </div>

        {unassigned.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-gray-400">모든 일정이 배정되었습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {unassigned.map((s) => (
                <div key={s.id} className="px-4 py-3">
                  {/* 제목 + 날짜 */}
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                    <span className="text-sm font-bold text-gray-800 flex-1 truncate">{s.title}</span>
                    <span className="text-xs px-2.5 py-1 bg-orange-500 text-white rounded-full shrink-0 font-bold">미배정</span>
                  </div>
                  <div className="text-xs text-gray-500 ml-4 mb-1.5">
                    {s.date} · {s.startTime}-{s.endTime}
                  </div>
                  {/* 본문 */}
                  {s.note && (
                    <div className="ml-4 p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 whitespace-pre-wrap leading-relaxed mb-2.5">
                      {s.note}
                    </div>
                  )}
                  {/* 배정 UI - 항상 표시 */}
                  <div className="ml-4 flex items-center gap-2">
                    <select
                      value={selectedSchedule?.id === s.id ? selectedMemberId : ""}
                      onChange={(e) => { setSelectedSchedule(s); setSelectedMemberId(e.target.value); }}
                      className="flex-1 px-3 py-2.5 border border-blue-300 rounded-lg text-sm outline-none bg-white focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">팀장 선택</option>
                      {activeMembers.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => { setSelectedSchedule(s); handleAssign(); }}
                      disabled={!(selectedSchedule?.id === s.id && selectedMemberId)}
                      className="px-4 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium active:bg-blue-600 disabled:opacity-40 shrink-0"
                    >
                      배정
                    </button>
                  </div>
                </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
