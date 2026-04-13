"use client";

import { useState, useEffect } from "react";
import { Schedule, Member, Comment } from "@/types";
import { fetchComments, createComment, deleteCommentApi } from "@/lib/api";
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
}: ScheduleDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("info");
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [authorName, setAuthorName] = useState("팀장");
  const [loading, setLoading] = useState(false);

  const memberColor = members.find((m) => m.id === schedule.memberId)?.color || "#6B7280";

  useEffect(() => { loadComments(); }, [schedule.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h < 12 ? "오전" : "오후";
    return `${ampm} ${h % 12 || 12}:${m}`;
  }

  const statusLabel = schedule.status === "confirmed" ? "확정" : schedule.status === "pending" ? "대기" : "교환요청";
  const statusClass = schedule.status === "confirmed" ? "bg-green-100 text-green-700" : schedule.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-orange-100 text-orange-700";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-800">{schedule.title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
              {/* Schedule info */}
              <div className="px-4 py-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-1.5 min-h-[40px] rounded-full" style={{ backgroundColor: memberColor }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusClass}`}>{statusLabel}</span>
                    </div>
                    <div className="mt-2 space-y-1.5 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {schedule.date}
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        {schedule.memberName}
                      </div>
                      {schedule.location && (
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                          {schedule.location}
                        </div>
                      )}
                      {schedule.note && (
                        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <div className="text-[11px] font-medium text-gray-400 mb-1.5">캘린더 본문</div>
                          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{schedule.note}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  {isAdmin && schedule.status !== "unassigned" && onUnassign && (
                    <button onClick={() => { onUnassign(schedule.id); onClose(); }} className="flex-1 px-3 py-2 bg-orange-50 text-orange-600 rounded-lg text-sm font-medium active:bg-orange-100">반환</button>
                  )}
                  <button onClick={() => onEdit(schedule)} className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium active:bg-blue-100">수정</button>
                  <button onClick={() => { onDelete(schedule.id); onClose(); }} className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium active:bg-red-100">삭제</button>
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

          {activeTab === "checklist" && (
            <ScheduleChecklist scheduleId={schedule.id} />
          )}

          {activeTab === "settlement" && (
            <ScheduleSettlement scheduleId={schedule.id} />
          )}
        </div>
      </div>
    </div>
  );
}
