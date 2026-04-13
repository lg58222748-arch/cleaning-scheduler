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
    setEditingNote(false);
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
              className="text-base font-bold text-gray-800 flex-1 text-center cursor-pointer active:text-blue-600"
              onClick={() => { setTitleText(schedule.title); setEditingTitle(true); }}
            >
              {schedule.title.replace(/^\[.+?\]\s*/, "").split("/")[0] || schedule.title}
            </h3>
          )}
          <div className="w-8" />
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
              <div className="px-4 py-4 space-y-4">
                {/* 날짜 */}
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{dateDisplay}</span>
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span className="font-medium">{dateDisplay}</span>
                  </div>
                </div>

                {/* 담당자 */}
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>담당: <span className="font-medium">{schedule.memberName}</span></span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ml-auto ${statusClass}`}>{statusLabel}</span>
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

                {/* 본문 - 클릭하면 바로 편집 */}
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {editingNote ? (
                    <div className="flex-1">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        className="w-full text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-blue-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-400 resize-y min-h-[200px]"
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => setEditingNote(false)} className="flex-1 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">취소</button>
                        <button onClick={handleSaveNote} disabled={saving} className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">저장</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex-1 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed cursor-pointer active:bg-blue-50 rounded-lg p-1 -m-1"
                      onClick={() => { setNoteText(schedule.note || ""); setEditingNote(true); }}
                    >
                      {schedule.note || schedule.title}
                      <div className="text-[10px] text-blue-400 mt-1">터치하여 수정</div>
                    </div>
                  )}
                </div>

                {/* 액션 버튼 - 수정 제거, 반환+삭제만 */}
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  {isAdmin && schedule.status !== "unassigned" && onUnassign && (
                    <button onClick={() => { onUnassign(schedule.id); onClose(); }} className="flex-1 px-3 py-2.5 bg-orange-50 text-orange-600 rounded-xl text-sm font-medium active:bg-orange-100">반환</button>
                  )}
                  <button onClick={() => { onDelete(schedule.id); onClose(); }} className="flex-1 px-3 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-medium active:bg-red-100">삭제</button>
                </div>
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
