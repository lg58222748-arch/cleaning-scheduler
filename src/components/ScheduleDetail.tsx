"use client";

import { useState, useEffect } from "react";
import { Schedule, Member, Comment } from "@/types";
import { fetchComments, createComment, deleteCommentApi, updateSchedule as apiUpdateSchedule } from "@/lib/api";
import ScheduleChecklist from "./ScheduleChecklist";
import ScheduleSettlement from "./ScheduleSettlement";

interface ScheduleDetailProps {
  schedule: Schedule;
  members: Member[];
  isAdmin?: boolean;
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: string) => void;
  onUnassign?: (id: string) => void;
  onClose: () => void;
  onUpdated?: () => void;
}

type DetailTab = "info" | "checklist" | "settlement";

export default function ScheduleDetail({
  schedule,
  members,
  isAdmin,
  onEdit,
  onDelete,
  onUnassign,
  onClose,
  onUpdated,
}: ScheduleDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("info");
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [authorName, setAuthorName] = useState("팀장");
  const [loading, setLoading] = useState(false);
  const [preloadChecklist, setPreloadChecklist] = useState(false);
  const [preloadSettlement, setPreloadSettlement] = useState(false);

  // 인라인 편집 상태
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(schedule.note || "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState(schedule.title);
  const [saving, setSaving] = useState(false);
  const [noteChanged, setNoteChanged] = useState(false);
  const [schedColor, setSchedColor] = useState(schedule.color || "#FDDCCC");

  const SCHEDULE_COLORS = [
    { name: "살몬", value: "#FDDCCC" },
    { name: "하늘", value: "#DBEAFE" },
    { name: "연두", value: "#D1FAE5" },
    { name: "보라", value: "#E9D5FF" },
    { name: "노랑", value: "#FEF3C7" },
  ];

  const memberColor = members.find((m) => m.id === schedule.memberId)?.color || "#6B7280";

  useEffect(() => {
    loadComments();
    const t = setTimeout(() => {
      setPreloadChecklist(true);
      setPreloadSettlement(true);
    }, 100);
    return () => clearTimeout(t);
  }, [schedule.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadComments() {
    const data = await fetchComments(schedule.id);
    setComments(data);
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;
    setLoading(true);
    await createComment(schedule.id, authorName, newComment.trim());
    setNewComment("");
    await loadComments();
    setLoading(false);
  }

  async function handleDeleteComment(id: string) {
    await deleteCommentApi(id);
    await loadComments();
  }

  // 인라인 저장
  async function handleSaveNote() {
    setSaving(true);
    await apiUpdateSchedule(schedule.id, { note: noteText });
    schedule.note = noteText;
    setNoteChanged(false);
    setSaving(false);
    onUpdated?.();
  }

  async function handleSaveTitle() {
    setSaving(true);
    await apiUpdateSchedule(schedule.id, { title: titleText });
    schedule.title = titleText;
    setEditingTitle(false);
    setSaving(false);
    onUpdated?.();
  }

  async function handleColorChange(color: string) {
    setSchedColor(color);
    schedule.color = color;
    await apiUpdateSchedule(schedule.id, { color });
    onUpdated?.();
  }

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h < 12 ? "오전" : "오후";
    return `${ampm} ${h % 12 || 12}:${m}`;
  }

  const statusLabel = schedule.status === "confirmed" ? "확정" : schedule.status === "pending" ? "대기" : "교환요청";
  const statusClass = schedule.status === "confirmed" ? "bg-green-100 text-green-700" : schedule.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-orange-100 text-orange-700";

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const schedDate = new Date(schedule.date + "T00:00:00");
  const dayName = dayNames[schedDate.getDay()];
  const month = schedDate.getMonth() + 1;
  const day = schedDate.getDate();
  const dateDisplay = `${month}월 ${day}일 (${dayName})`;

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col animate-[modalIn_0.15s_ease-out]">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <button onClick={onClose} className="p-1.5 active:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {editingTitle ? (
            <div className="flex-1 mx-2 flex items-center gap-1">
              <input
                value={titleText}
                onChange={(e) => setTitleText(e.target.value)}
                className="flex-1 text-base font-bold text-gray-800 text-center border-b-2 border-blue-400 outline-none bg-transparent"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
              />
              <button onClick={handleSaveTitle} disabled={saving} className="text-xs px-2 py-1 bg-blue-500 text-white rounded-lg">저장</button>
            </div>
          ) : (
            <h3
              className="text-sm font-bold text-gray-800 flex-1 text-center cursor-pointer active:text-blue-600 break-all leading-tight"
              onClick={() => { setTitleText(schedule.title); setEditingTitle(true); }}
            >
              {schedule.title.replace(/^\[.+?\]\s*/, "") || schedule.title}
            </h3>
          )}
          <button onClick={() => { onDelete(schedule.id); onClose(); }} className="p-1.5 active:bg-red-50 rounded-lg">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {([
            ["info", "정보"],
            ["checklist", "검수"],
            ["settlement", "정산"],
          ] as [DetailTab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
                activeTab === tab
                  ? "text-blue-500 border-b-2 border-blue-500"
                  : "text-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "info" && (
            <>
              <div className="px-4 py-3 space-y-3">
                {/* 날짜 + 담당자 한줄 */}
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium">{dateDisplay}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ml-auto ${statusClass}`}>{statusLabel}</span>
                </div>

                {/* 담당자 */}
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>담당: <span className="font-medium">{schedule.memberName}</span></span>
                </div>

                {/* 위치 */}
                {schedule.location && (
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{schedule.location}</span>
                  </div>
                )}

                {/* 일정 색상 */}
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  <div className="flex gap-1">
                    {SCHEDULE_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => handleColorChange(c.value)}
                        className={`w-4 h-4 rounded-full border transition-all ${
                          schedColor === c.value ? "border-gray-700 scale-125" : "border-gray-300"
                        }`}
                        style={{ backgroundColor: c.value }}
                      />
                    ))}
                  </div>
                </div>

                {/* 본문 - 메모장처럼 항상 편집 가능, 화면 꽉 채움 */}
                <div className="flex items-start gap-3 flex-1">
                  <svg className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1 flex flex-col">
                    <textarea
                      value={noteText}
                      onChange={(e) => { setNoteText(e.target.value); setNoteChanged(true); }}
                      className="w-full text-sm text-gray-700 leading-relaxed bg-transparent outline-none resize-none flex-1 min-h-[400px]"
                      placeholder="내용을 입력하세요..."
                    />
                    {noteChanged && (
                      <button
                        onClick={handleSaveNote}
                        disabled={saving}
                        className="mt-1 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium w-full disabled:opacity-50"
                      >
                        {saving ? "저장 중..." : "저장"}
                      </button>
                    )}
                  </div>
                </div>

                {/* 액션 버튼 */}
                {isAdmin && schedule.status !== "unassigned" && onUnassign && (
                  <div className="pt-2 border-t border-gray-100">
                    <button onClick={() => { onUnassign(schedule.id); onClose(); }} className="w-full px-3 py-2.5 bg-orange-50 text-orange-600 rounded-xl text-sm font-medium active:bg-orange-100">반환</button>
                  </div>
                )}
              </div>

              {/* Comments */}
              <div className="border-t border-gray-100">
                <div className="px-4 py-3">
                  <h4 className="text-sm font-bold text-gray-800">
                    댓글 {comments.length > 0 && <span className="text-gray-400 font-normal">({comments.length})</span>}
                  </h4>
                </div>
                {comments.length > 0 && (
                  <div className="px-4 space-y-3 pb-3">
                    {comments.map((c) => (
                      <div key={c.id} className="flex items-start gap-2.5">
                        <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0">{c.authorName[0]}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-700">{c.authorName}</span>
                            <span className="text-[10px] text-gray-400">{formatTime(c.createdAt)}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5">{c.content}</p>
                        </div>
                        <button onClick={() => handleDeleteComment(c.id)} className="p-1 text-gray-300 active:text-red-500 shrink-0">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="px-4 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs text-gray-500">작성자:</label>
                    <select value={authorName} onChange={(e) => setAuthorName(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none">
                      <option value="팀장">팀장</option>
                      {members.filter(m => m.active).map((m) => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddComment()} placeholder="댓글을 입력하세요..." className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" />
                    <button onClick={handleAddComment} disabled={loading || !newComment.trim()} className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium active:bg-blue-600 disabled:opacity-50">등록</button>
                  </div>
                </div>
              </div>
            </>
          )}

          <div style={{ display: activeTab === "checklist" ? "block" : "none" }}>
            {preloadChecklist && <ScheduleChecklist scheduleId={schedule.id} />}
          </div>
          <div style={{ display: activeTab === "settlement" ? "block" : "none" }}>
            {preloadSettlement && <ScheduleSettlement scheduleId={schedule.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}
