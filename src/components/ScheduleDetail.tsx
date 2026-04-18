"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Schedule, Member, Comment } from "@/types";
import { fetchComments, createComment, deleteCommentApi, updateSchedule as apiUpdateSchedule } from "@/lib/api";
import ScheduleChecklist from "./ScheduleChecklist";
import ScheduleSettlement from "./ScheduleSettlement";

interface ScheduleDetailProps {
  schedule: Schedule;
  members: Member[];
  isAdmin?: boolean;
  mode?: "calendar" | "assign";
  currentUserName?: string;
  allUsers?: { id?: string; name: string; username?: string; role?: string }[];
  onRegisterBackHandler?: (handler: (() => boolean) | null) => void;
  memberBranch?: string;
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: string) => void;
  onUnassign?: (id: string, reason: string) => void;
  onAssign?: (scheduleId: string, memberId: string, memberName: string) => void;
  onClose: () => void;
  onUpdated?: () => void;
}

type DetailTab = "info" | "checklist" | "settlement";

export default function ScheduleDetail({
  schedule,
  members,
  isAdmin,
  mode = "calendar",
  currentUserName = "",
  allUsers = [],
  onRegisterBackHandler,
  memberBranch = "",
  onEdit,
  onDelete,
  onUnassign,
  onAssign,
  onClose,
  onUpdated,
}: ScheduleDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("info");
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [authorName, setAuthorName] = useState(currentUserName || "팀장");
  const [loading, setLoading] = useState(false);
  const [preloadChecklist, setPreloadChecklist] = useState(false);
  const [preloadSettlement, setPreloadSettlement] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);

  // 인라인 편집 상태
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(schedule.note || "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState(schedule.title);
  const [saving, setSaving] = useState(false);
  const [noteChanged, setNoteChanged] = useState(false);
  const [schedColor, setSchedColor] = useState(schedule.color || "#FDDCCC");
  const [localDate, setLocalDate] = useState(schedule.date);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [assignMemberId, setAssignMemberId] = useState("");

  // 탭 히스토리 (뒤로가기 지원)
  const tabHistoryRef = useRef<DetailTab[]>([]);

  useEffect(() => {
    const handler = (): boolean => {
      if (tabHistoryRef.current.length > 0) {
        const prevTab = tabHistoryRef.current.pop()!;
        setActiveTab(prevTab);
        return true;
      }
      return false;
    };
    onRegisterBackHandler?.(handler);
    return () => onRegisterBackHandler?.(null);
  }, [onRegisterBackHandler]);

  // 시간대 (제목 앞에 [오전] 등)
  const TIME_SLOTS = ["오전", "오후", "시무", "사이"] as const;
  const extractTimeSlot = () => {
    const m = schedule.title.match(/^\[(.+?)\]/);
    return m ? m[1] : "";
  };
  const [timeSlot, setTimeSlot] = useState(extractTimeSlot());

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
    return () => { clearTimeout(t); };
  }, [schedule.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadComments() {
    const data = await fetchComments(schedule.id);
    setComments(data);
  }

  function handleAddComment() {
    if (!newComment.trim()) return;
    // 낙관적: 즉시 표시
    const tempComment: Comment = {
      id: "temp-" + Date.now(),
      scheduleId: schedule.id,
      authorName,
      content: newComment.trim(),
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [...prev, tempComment]);
    const text = newComment.trim();
    setNewComment("");
    // API 백그라운드
    createComment(schedule.id, authorName, text);
  }

  function handleDeleteComment(id: string) {
    // 즉시 UI 제거
    setComments((prev) => prev.filter((c) => c.id !== id));
    deleteCommentApi(id);
  }

  // 인라인 저장
  async function handleSaveNote() {
    setSaving(true);
    schedule.note = noteText;
    setNoteChanged(false);
    setSaving(false);
    apiUpdateSchedule(schedule.id, { note: noteText }).then(() => onUpdated?.()).catch(() => {});
  }

  async function handleSaveTitle() {
    setSaving(true);
    schedule.title = titleText;
    setEditingTitle(false);
    setSaving(false);
    apiUpdateSchedule(schedule.id, { title: titleText }).then(() => onUpdated?.()).catch(() => {});
  }

  async function handleTimeSlotChange(slot: string) {
    const newSlot = timeSlot === slot ? "" : slot; // 토글
    setTimeSlot(newSlot);
    const bare = schedule.title.replace(/^\[.+?\]\s*/, "");
    const newTitle = newSlot ? `[${newSlot}] ${bare}` : bare;
    schedule.title = newTitle;
    setTitleText(newTitle);
    apiUpdateSchedule(schedule.id, { title: newTitle }).catch(() => {});
  }

  async function handleColorChange(color: string) {
    setSchedColor(color);
    schedule.color = color;
    apiUpdateSchedule(schedule.id, { color }).catch(() => {});
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
  const schedDate = new Date(localDate + "T00:00:00");
  const dayName = dayNames[schedDate.getDay()];
  const month = schedDate.getMonth() + 1;
  const day = schedDate.getDate();
  const dateDisplay = `${month}월 ${day}일 (${dayName})`;

  // 스와이프 뒤로가기 (오른쪽 스와이프 → 닫기)
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!detailRef.current) return;
    let mc: InstanceType<typeof import("hammerjs")> | null = null;
    import("hammerjs").then((Hammer) => {
      if (!detailRef.current) return;
      mc = new Hammer.default(detailRef.current);
      mc.get("swipe").set({ direction: Hammer.default.DIRECTION_RIGHT });
      mc.on("swiperight", () => {
        if (tabHistoryRef.current.length > 0) {
          const prev = tabHistoryRef.current.pop()!;
          setActiveTab(prev);
        } else {
          onClose();
        }
      });
    });
    return () => { mc?.destroy(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={detailRef} className="fixed inset-0 z-50 md:flex md:items-center md:justify-center md:bg-black/30 animate-[modalIn_0.15s_ease-out]" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="h-full w-full md:h-[85vh] md:w-[480px] md:rounded-2xl md:shadow-2xl bg-white flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-1.5 border-b border-gray-100 flex items-center justify-between">
          <button onClick={onClose} className="p-1.5 active:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {editingTitle ? (
            <div className="flex-1 mx-2">
              <input
                value={titleText}
                onChange={(e) => { setTitleText(e.target.value); setNoteChanged(true); }}
                className="w-full text-sm font-bold text-gray-800 text-center border-b-2 border-blue-400 outline-none bg-transparent"
                autoFocus
                onBlur={() => setEditingTitle(false)}
              />
            </div>
          ) : (
            <h3
              className="text-sm font-bold text-gray-800 flex-1 text-center cursor-pointer active:text-blue-600 break-all leading-tight"
              onClick={() => { setTitleText(schedule.title); setEditingTitle(true); }}
            >
              {timeSlot ? `[${timeSlot}] ` : ""}{titleText.replace(/^\[.+?\]\s*/, "")}
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
              onClick={() => {
                if (tab !== activeTab) {
                  tabHistoryRef.current.push(activeTab);
                }
                setActiveTab(tab);
              }}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
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
          {/* 고객/관리사 정보 - 검수/정산 탭에서만 */}
          {activeTab !== "info" && (
          <div className="px-4 pt-3 pb-1 space-y-2">
            {(() => {
              const note = schedule.note || "";
              const titleParts = schedule.title.replace(/^\[.+?\]\s*/, "").split("/");
              // note에서 성함/고객명 우선, 없으면 제목에서 파싱
              const customerName =
                note.match(/1\)성함\s*[:：]\s*(.+)/)?.[1]?.trim()
                || note.match(/고객명\s*[:：]\s*(.+)/)?.[1]?.trim()
                || note.match(/성함\s*[:：]\s*(.+)/)?.[1]?.trim()
                || titleParts.find(p => /^U.+$/.test(p))?.replace(/^U/, "")
                || titleParts[0]
                || "";
              const phoneMatch = note.match(/(01[0-9][-.\s]?\d{3,4}[-.\s]?\d{4})/);
              const customerPhone = phoneMatch ? phoneMatch[1] : "";
              const locationPart = titleParts.find(p => /[시구동]/.test(p)) || schedule.location || "";
              if (customerName || customerPhone) {
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="font-bold text-blue-800">고객: {customerName}</span>
                      {customerPhone && <span className="text-blue-600 text-xs ml-auto">{customerPhone}</span>}
                    </div>
                    {locationPart && (
                      <div className="flex items-center gap-2 text-xs text-blue-600">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        <span>{locationPart}</span>
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })()}
            {schedule.memberName && schedule.memberName !== "미배정" && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: memberColor }}>
                    {schedule.memberName[0]}
                  </div>
                  <span className="font-medium text-gray-800">{memberBranch ? `${memberBranch} 관리점` : ""} {schedule.memberName}</span>
                </div>
                {(() => {
                  const member = members.find(m => m.id === schedule.memberId);
                  const phone = member?.phone;
                  return phone ? (
                    <div className="text-xs text-gray-500 ml-8">{phone}</div>
                  ) : null;
                })()}
              </div>
            )}
          </div>
          )}

          {activeTab === "info" && (
            <>
              <div className="px-4 py-3 space-y-3">
                {/* 시간대 선택 */}
                <div className="flex gap-1.5">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => handleTimeSlotChange(slot)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                        timeSlot === slot ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500 active:bg-gray-200"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>

                {/* 날짜 + 상태 */}
                <div className="flex items-center gap-3 text-xs text-gray-700">
                  <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {isAdmin ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={localDate}
                        onChange={(e) => {
                          const newDate = e.target.value;
                          if (!newDate || newDate === localDate) return;
                          setLocalDate(newDate);         // 화면 즉시 갱신
                          schedule.date = newDate;        // prop 동기화
                          apiUpdateSchedule(schedule.id, { date: newDate }).then(() => onUpdated?.()).catch(() => {});
                        }}
                        className="font-medium text-xs px-2 py-1 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                      />
                      <span className="text-gray-500">({dayName})</span>
                    </div>
                  ) : (
                    <span className="font-medium">{dateDisplay}</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${statusClass}`}>{statusLabel}</span>
                </div>

                {/* 담당자 */}
                <div className="flex items-center gap-3 text-xs text-gray-700">
                  <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>담당: <span className="font-medium">{schedule.memberName}</span></span>
                </div>

                {/* 위치 */}
                {schedule.location && (
                  <div className="flex items-center gap-3 text-xs text-gray-700">
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
                      ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                      value={noteText}
                      onChange={(e) => { setNoteText(e.target.value); setNoteChanged(true); const t = e.target; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
                      style={{ fontSize: "12px" }}
                      className="w-full text-gray-700 leading-relaxed bg-transparent outline-none resize-none min-h-[60px]"
                      placeholder="내용을 입력하세요..."
                    />
                  </div>
                </div>

              </div>
            </>
          )}

          <div style={{ display: activeTab === "checklist" ? "block" : "none" }}>
            {preloadChecklist && <ScheduleChecklist scheduleId={schedule.id} onComplete={() => setActiveTab("settlement")} />}
          </div>
          <div style={{ display: activeTab === "settlement" ? "block" : "none" }}>
            {preloadSettlement && <ScheduleSettlement
              scheduleId={schedule.id}
              scheduleTitle={schedule.title}
              scheduleNote={schedule.note}
              customerNameFromSchedule={
                schedule.note?.match(/1\)성함\s*[:：]\s*(.+)/)?.[1]?.trim()
                || schedule.note?.match(/고객명\s*[:：]\s*(.+)/)?.[1]?.trim()
                || schedule.title.replace(/^\[.+?\]\s*/, "").match(/^U(.+?)\//)?.[1]
                || ""
              }
              customerPhoneFromSchedule={
                schedule.note?.match(/3\)연락처\s*[:：]\s*(.+)/)?.[1]?.trim()
                || schedule.note?.match(/(01[0-9][-.\s]?\d{3,4}[-.\s]?\d{4})/)?.[1]
                || ""
              }
              memberName={schedule.memberName}
              memberBranch={memberBranch}
              onCompleted={() => { schedule.status = "completed"; }}
            />}
          </div>
        </div>

      {/* 하단 고정 - 정보탭에서만 표시 */}
      {activeTab === "info" && (
      <div className="border-t border-gray-200 bg-white safe-area-bottom">
        {/* 댓글 */}
        {comments.length > 0 && (
          <div className="px-4 pt-2 max-h-[80px] overflow-y-auto border-b border-gray-100">
            <div className="space-y-1.5 pb-1.5">
              {(showAllComments ? [...comments].reverse() : [...comments].reverse().slice(0, 2)).map((c) => (
                <div key={c.id} className="flex items-start gap-1.5">
                  <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 mt-0.5">{c.authorName[0]}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-gray-700">{c.authorName}</span>
                    <span className="text-xs text-gray-400 ml-1">{formatTime(c.createdAt)}</span>
                    <p className="text-xs text-gray-600 leading-tight">{c.content}</p>
                  </div>
                  <button onClick={() => handleDeleteComment(c.id)} className="p-0.5 text-gray-300 active:text-red-500 shrink-0">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              {comments.length > 2 && !showAllComments && (
                <button onClick={() => setShowAllComments(true)} className="text-xs text-blue-500 font-medium mt-1 active:text-blue-700">
                  +{comments.length - 2}개 이전 댓글 더보기
                </button>
              )}
            </div>
          </div>
        )}
        {/* 댓글 입력 */}
        <div className="flex items-center gap-2 px-4 py-2">
          <input value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddComment()} placeholder="댓글 입력..." className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" />
          <button onClick={handleAddComment} disabled={loading || !newComment.trim()} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium active:bg-blue-600 disabled:opacity-50 shrink-0">등록</button>
        </div>
        {mode === "assign" && (
          <div className="flex items-center gap-2 px-4 pb-1">
            <select
              value={assignMemberId}
              onChange={(e) => setAssignMemberId(e.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none bg-white focus:ring-2 focus:ring-orange-400"
            >
              <option value="">배정 팀장 선택</option>
              {(allUsers || []).filter(u => u.role === "field").map((u) => (
                <option key={u.id || u.name} value={`user:${u.id || ""}:${u.name}`}>{u.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2 px-4 py-2">
          {mode === "calendar" && schedule.status !== "unassigned" && onUnassign && (
            <button
              onClick={() => { setReturnReason(""); setShowReturnModal(true); }}
              className="flex-1 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold active:bg-orange-600"
            >
              반환
            </button>
          )}
          {mode === "assign" && (
            <button
              onClick={() => {
                if (!assignMemberId || !onAssign) return;
                if (assignMemberId.startsWith("user:")) {
                  const parts = assignMemberId.split(":");
                  const userId = parts[1];
                  const userName = parts.slice(2).join(":");
                  onAssign(schedule.id, userId, userName);
                  onClose();
                } else {
                  const member = members.find(m => m.id === assignMemberId);
                  if (member) { onAssign(schedule.id, member.id, member.name); onClose(); }
                }
              }}
              disabled={!assignMemberId}
              className="flex-1 py-3 bg-orange-500 text-white rounded-xl text-sm font-bold active:bg-orange-600 disabled:opacity-40"
            >
              배정
            </button>
          )}
          {/* 입금확인/미입금 버튼 - 배정 모드에서만 */}
          {mode === "assign" && (
            <>
              <button
                onClick={() => {
                  if (titleText.includes("/미입금")) {
                    const originalMatch = schedule.note?.match(/원래제목:\s*(.+)/);
                    const newTitle = originalMatch ? originalMatch[1].trim() : titleText.replace(/\/미입금/g, "");
                    schedule.title = newTitle;
                    setTitleText(newTitle);
                    apiUpdateSchedule(schedule.id, { title: newTitle }).catch(() => {});
                  }
                }}
                className={`flex-1 py-3 rounded-xl text-sm font-bold active:opacity-90 ${titleText.includes("/미입금") ? "text-white" : "text-green-600 bg-green-50 border border-green-200"}`}
                style={titleText.includes("/미입금") ? { background: "linear-gradient(135deg, #00c473, #00a35e)" } : {}}
              >
                {titleText.includes("/미입금") ? "입금확인" : "입금완료"}
              </button>
              {!titleText.includes("/미입금") && (
                <button
                  onClick={() => {
                    const newTitle = `${titleText}/미입금`;
                    schedule.title = newTitle;
                    setTitleText(newTitle);
                    apiUpdateSchedule(schedule.id, { title: newTitle }).catch(() => {});
                  }}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-red-500 bg-red-50 border border-red-200 active:opacity-90"
                >
                  미입금
                </button>
              )}
            </>
          )}
          <button
            onClick={() => {
              setSaving(true);
              const updates: Record<string, unknown> = {};
              if (titleText !== schedule.title) { updates.title = titleText; schedule.title = titleText; setEditingTitle(false); }
              if (noteChanged) { updates.note = noteText; schedule.note = noteText; setNoteChanged(false); }
              setSaving(false);
              onClose();
              // API + 리로드는 닫은 후 백그라운드
              if (Object.keys(updates).length > 0) {
                apiUpdateSchedule(schedule.id, updates as Partial<import("@/types").Schedule>).then(() => onUpdated?.()).catch(() => {});
              } else {
                onUpdated?.();
              }
            }}
            disabled={saving}
            className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-xs font-bold active:bg-blue-600 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold active:bg-gray-200"
          >
            취소
          </button>
        </div>
      </div>
      )}
      </div>
      {/* 반환 사유 모달 */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-6" onClick={(e) => { if (e.target === e.currentTarget) setShowReturnModal(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3 animate-[modalIn_0.15s_ease-out]">
            <h3 className="text-sm font-bold text-gray-800">반환 사유를 입력하세요</h3>
            <input
              autoFocus
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setShowReturnModal(false);
                  onClose();
                  setTimeout(() => onUnassign?.(schedule.id, returnReason.trim() || "사유 없음"), 50);
                }
              }}
              placeholder="반환 사유를 입력하세요"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowReturnModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold active:bg-gray-200">취소</button>
              <button onClick={() => {
                setShowReturnModal(false);
                onClose();
                setTimeout(() => onUnassign?.(schedule.id, returnReason.trim() || "사유 없음"), 50);
              }} className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-xs font-bold active:bg-orange-600">반환</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
