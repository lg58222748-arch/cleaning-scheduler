"use client";

import { useState, useEffect } from "react";
import { Schedule, Member } from "@/types";
import { format } from "date-fns";

interface ScheduleFormProps {
  members: Member[];
  selectedDate: Date;
  editingSchedule: Schedule | null;
  onSave: (data: Omit<Schedule, "id" | "status">) => void;
  onCancel: () => void;
}

type TimeSlot = "오전" | "오후" | "시무" | "사이";

export default function ScheduleForm({
  members,
  selectedDate,
  editingSchedule,
  onSave,
  onCancel,
}: ScheduleFormProps) {
  const SCHEDULE_COLORS = [
    { name: "살몬", value: "#FDDCCC" },
    { name: "하늘", value: "#DBEAFE" },
    { name: "연두", value: "#D1FAE5" },
    { name: "보라", value: "#E9D5FF" },
    { name: "노랑", value: "#FEF3C7" },
  ];

  const [memberId, setMemberId] = useState("");
  const [title, setTitle] = useState("");
  const [timeSlot, setTimeSlot] = useState<TimeSlot>("오전");
  const [date, setDate] = useState(format(selectedDate, "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const [color, setColor] = useState(SCHEDULE_COLORS[0].value);

  useEffect(() => {
    if (editingSchedule) {
      setMemberId(editingSchedule.memberId);
      // 제목에서 시간대 접두사 제거
      let t = editingSchedule.title;
      for (const slot of ["[오전]", "[오후]", "[시무]", "[사이]"]) {
        if (t.startsWith(slot + " ")) {
          setTimeSlot(slot.replace("[", "").replace("]", "") as TimeSlot);
          t = t.slice(slot.length + 1);
          break;
        }
      }
      setTitle(t);
      setDate(editingSchedule.date);
      setNote(editingSchedule.note || "");
      setColor(editingSchedule.color || SCHEDULE_COLORS[0].value);
      // 시간대 추정
      if (editingSchedule.startTime === "07:00") setTimeSlot("오전");
      else if (editingSchedule.startTime === "13:00") setTimeSlot("오후");
    } else {
      setDate(format(selectedDate, "yyyy-MM-dd"));
    }
  }, [editingSchedule, selectedDate]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const member = members.find((m) => m.id === memberId);

    const times: Record<TimeSlot, [string, string]> = {
      "오전": ["07:00", "12:00"],
      "오후": ["13:00", "18:00"],
      "시무": ["07:00", "18:00"],
      "사이": ["09:00", "15:00"],
    };
    const [startTime, endTime] = times[timeSlot];

    onSave({
      memberId: member?.id || "",
      memberName: member?.name || "미배정",
      title: `[${timeSlot}] ${title}`,
      location: "",
      date,
      startTime,
      endTime,
      note,
      color,
    });
  }

  const activeMembers = members.filter((m) => m.active);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-[modalIn_0.2s_ease-out] max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">
            {editingSchedule ? "일정 수정" : "새 일정 배정"}
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              담당 팀원
            </label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
            >
              <option value="">팀원 선택</option>
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              시간대 *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["오전", "오후", "시무", "사이"] as TimeSlot[]).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTimeSlot(slot)}
                  className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    timeSlot === slot
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 active:bg-gray-200"
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {timeSlot === "오전" && "7시~9시 사이 방문"}
              {timeSlot === "오후" && "13시~15시 사이 방문"}
              {timeSlot === "시무" && "오전 오후 상관없음"}
              {timeSlot === "사이" && "고객과 조율"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              캘린더 제목 *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="예: 홍길동 34평 입주청소"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
            />
            {title && (
              <p className="text-xs text-blue-500 mt-1 font-medium">
                미리보기: [{timeSlot}] {title}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              날짜 *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              일정 색상
            </label>
            <div className="flex gap-2.5">
              {SCHEDULE_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${
                    color === c.value ? "border-gray-800 scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c.value }}
                >
                  {color === c.value && (
                    <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              캘린더 본문 (예약양식)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={10}
              placeholder="예약양식 내용을 붙여넣으세요"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none resize-y text-sm leading-relaxed"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              {editingSchedule ? "수정" : "배정"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
