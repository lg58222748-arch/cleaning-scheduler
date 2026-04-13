"use client";

import { Schedule, Member } from "@/types";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface ScheduleListProps {
  schedules: Schedule[];
  members: Member[];
  selectedDate: Date;
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: string) => void;
  onSwapSelect: (schedule: Schedule) => void;
  swapMode: boolean;
}

export default function ScheduleList({
  schedules,
  members,
  selectedDate,
  onEdit,
  onDelete,
  onSwapSelect,
  swapMode,
}: ScheduleListProps) {
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const daySchedules = schedules
    .filter((s) => s.date === dateStr)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  function getMemberColor(memberId: string): string {
    return members.find((m) => m.id === memberId)?.color || "#6B7280";
  }

  const statusLabels: Record<string, { text: string; className: string }> = {
    confirmed: { text: "확정", className: "bg-green-100 text-green-700" },
    pending: { text: "대기", className: "bg-yellow-100 text-yellow-700" },
    swapRequested: { text: "교환요청", className: "bg-orange-100 text-orange-700" },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="font-bold text-gray-800">
          {format(selectedDate, "M월 d일 (EEEE)", { locale: ko })} 일정
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {daySchedules.length}건의 일정
        </p>
      </div>

      {daySchedules.length === 0 ? (
        <div className="px-6 py-12 text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p>이 날에 배정된 일정이 없습니다</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {daySchedules.map((s) => {
            const status = statusLabels[s.status];
            return (
              <div
                key={s.id}
                className={`px-6 py-4 hover:bg-gray-50 transition-colors ${
                  swapMode ? "cursor-pointer ring-inset hover:ring-2 hover:ring-orange-300" : ""
                }`}
                onClick={() => swapMode && onSwapSelect(s)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-1 h-12 rounded-full flex-shrink-0 mt-1"
                    style={{ backgroundColor: getMemberColor(s.memberId) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-800">{s.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${status.className}`}>
                        {status.text}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {s.startTime} - {s.endTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {s.memberName}
                      </span>
                      {s.location && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          {s.location}
                        </span>
                      )}
                    </div>
                    {s.note && (
                      <p className="text-sm text-gray-400 mt-1">{s.note}</p>
                    )}
                  </div>
                  {!swapMode && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => onEdit(s)}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="수정"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDelete(s.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="삭제"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
