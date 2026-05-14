"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { Schedule, Member, Comment } from "@/types";
import { fetchComments, createComment, deleteCommentApi, updateSchedule as apiUpdateSchedule } from "@/lib/api";
import { showConfirm, showAlert } from "@/lib/dialog";
import { POST_PAYMENT_MESSAGES } from "@/lib/customerMessages";
import ScheduleChecklist from "./ScheduleChecklist";
import ScheduleSettlement from "./ScheduleSettlement";

interface ScheduleDetailProps {
  schedule: Schedule;
  members: Member[];
  isAdmin?: boolean;
  canAssignMember?: boolean; // 배정 버튼 노출 여부 (영업은 false, 관리자/대표/일정관리자는 true)
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
  onUpdated?: (patch?: Partial<Schedule>) => void;
}

type DetailTab = "info" | "checklist" | "settlement";

export default function ScheduleDetail({
  schedule,
  members,
  isAdmin,
  canAssignMember = true,
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
  // 입금확인 버튼 누르면 뜨는 안내 메시지 복사 팝업
  const [showPostPaymentModal, setShowPostPaymentModal] = useState(false);
  const [copiedPostMsgs, setCopiedPostMsgs] = useState<Set<number>>(new Set());

  // 탭 히스토리 (뒤로가기 지원)
  const tabHistoryRef = useRef<DetailTab[]>([]);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  // 본문 textarea 높이 조정 - noteText 실제로 바뀔 때만 실행
  // (이전엔 ref callback 이 매 렌더마다 실행돼서 스크롤이 위로 튕기는 버그 있었음)
  useEffect(() => {
    const el = noteTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [noteText]);

  // 날짜 input native touch 이벤트 stopPropagation.
  // Hammer.js(모달 root native 리스너)가 swipe 감지에 touch 이벤트를 씀.
  // React synthetic stopPropagation 은 native 리스너보다 늦게 받아 못 막으므로
  // 직접 DOM 리스너로 붙여 bubble 단계에서 차단.
  //
  // [중요] touch 이벤트만 차단한다. click/mousedown/pointerdown/pointerup 까지
  // stopPropagation 하면 브라우저가 native date picker 기본 동작을 취소해버려서
  // picker 가 열리지 않는 현상 발생 (PC/모바일 간헐적 먹통의 근본 원인).
  // Hammer 는 touch 만 쓰고, click/pointer/mouse 는 picker 기본 동작에 필요.
  //
  // useLayoutEffect: paint 전에 동기적으로 listener 부착 → 첫 user interaction 전에
  // 확실히 attach 보장. concurrent render 에서 effect 가 지연 실행되어 listener
  // 미부착 상태로 클릭이 들어오는 race condition 방지.
  //
  // [schedule.id] deps: 반환 후 배정탭 재진입 같은 플로우에서 schedule 이 바뀌어도
  // listener 재부착. (상위에 key={schedule.id} 도 있지만 이중 안전망.)
  useLayoutEffect(() => {
    const el = dateInputRef.current;
    if (!el) return;
    const stop = (e: Event) => { e.stopPropagation(); };
    el.addEventListener("touchstart", stop, { passive: true });
    el.addEventListener("touchend", stop, { passive: true });
    el.addEventListener("touchmove", stop, { passive: true });
    return () => {
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("touchend", stop);
      el.removeEventListener("touchmove", stop);
    };
  }, [schedule.id]);

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
  // 로컬 UI 는 즉시, 부모 상태/서버 동기화는 setTimeout(0) 으로 다음 tick 에 처리
  // (리스트 수백 개 재렌더가 현재 상호작용을 블로킹하지 않게)
  async function handleSaveNote() {
    schedule.note = noteText;
    setNoteChanged(false);
    setTimeout(() => {
      onUpdated?.({ id: schedule.id, note: noteText });
      apiUpdateSchedule(schedule.id, { note: noteText })
        .catch((err) => { console.error("[note] 저장 실패:", err); });
    }, 0);
  }

  async function handleSaveTitle() {
    schedule.title = titleText;
    setEditingTitle(false);
    setTimeout(() => {
      onUpdated?.({ id: schedule.id, title: titleText });
      apiUpdateSchedule(schedule.id, { title: titleText })
        .catch((err) => { console.error("[title] 저장 실패:", err); });
    }, 0);
  }

  async function handleTimeSlotChange(slot: string) {
    const newSlot = timeSlot === slot ? "" : slot; // 토글
    setTimeSlot(newSlot);
    const bare = schedule.title.replace(/^\[.+?\]\s*/, "");
    const newTitle = newSlot ? `[${newSlot}] ${bare}` : bare;
    schedule.title = newTitle;
    setTitleText(newTitle);
    setTimeout(() => {
      onUpdated?.({ id: schedule.id, title: newTitle });
      apiUpdateSchedule(schedule.id, { title: newTitle })
        .catch((err) => { console.error("[timeSlot] 저장 실패:", err); });
    }, 0);
  }

  async function handleColorChange(color: string) {
    setSchedColor(color);
    schedule.color = color;
    // 부모 state 즉시 갱신 (달력 셀 색상 반영) + realtime 리로드 suppress 트리거
    onUpdated?.({ id: schedule.id, color });
    apiUpdateSchedule(schedule.id, { color })
      .catch((err) => { console.error("[color] 저장 실패:", err); });
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
              <textarea
                value={titleText}
                onChange={(e) => {
                  setTitleText(e.target.value);
                  setNoteChanged(true);
                  // 자동 높이 조정 — 내용에 맞춰 줄 수 늘어남
                  const t = e.target;
                  t.style.height = "auto";
                  t.style.height = t.scrollHeight + "px";
                }}
                ref={(el) => {
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = el.scrollHeight + "px";
                  }
                }}
                onKeyDown={(e) => {
                  // Enter 누르면 줄바꿈 대신 저장 (blur)
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                rows={1}
                className="w-full text-sm font-bold text-gray-800 text-left border-b-2 border-blue-400 outline-none bg-transparent resize-none overflow-hidden leading-snug py-1"
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
          <button
            onClick={() => {
              showConfirm(`"${schedule.title}"\n\n정말 삭제하시겠습니까?\n(휴지통으로 이동되며 복원 가능합니다)`).then((ok) => {
                if (ok) { onDelete(schedule.id); onClose(); }
              });
            }}
            className="p-1.5 active:bg-red-50 rounded-lg"
          >
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

                {/* 날짜 + 상태 - 모든 사용자 변경 가능 */}
                {/* [iPhone Safari tap 묵음 버그 최종 수정]
                    기존: button onClick → showPicker() 호출 + input 은 pointer-events-none
                    문제:
                     1. Hammer.js swipe 리스너가 모달 root(detailRef) 에 native addEventListener
                        로 붙어있어, React synthetic stopPropagation 보다 먼저 touch 이벤트를
                        먹음 → iOS "user activation" 컨텍스트 손실 → showPicker() 조용히 실패
                     2. iOS 15 이하는 showPicker 자체가 없어 fallback(input.click) 으로 가는데
                        pointer-events-none input 은 프로그램 click 으로 picker 안 열림
                    해결: 투명 <input type="date"> 를 직접 탭 타겟으로 사용. native picker 가
                    OS 레벨에서 뜨므로 JS API 의존도 0. Hammer 간섭은 useEffect 에서 native
                    listener 로 capture 단계 stopPropagation → 원천 차단. */}
                <div className="flex items-center gap-3 text-xs text-gray-700">
                  <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <label
                    // label 여백 (input overlay 벗어난 영역) 을 탭했을 때도 Hammer.js
                    // 가 먹지 못하도록 추가 차단. input 에 붙은 native listener 와 병행.
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="relative inline-flex items-center font-medium cursor-pointer text-blue-600 hover:bg-blue-50 active:bg-blue-50 active:text-blue-800 underline underline-offset-2 decoration-dotted text-sm px-2 py-1.5 -my-1 rounded-md touch-manipulation"
                  >
                    {dateDisplay}
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={localDate}
                      onClick={(e) => {
                        // 투명 input 탭만으로 picker 가 안 뜨는 브라우저 (iOS 15 이하 Safari,
                        // opacity:0 input 에 picker UI anchor 실패하는 Chrome 구버전 등) 대비.
                        // 정상 동작하는 브라우저에선 default 와 중복 호출되지만 두 번째는 no-op.
                        const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                        if (typeof el.showPicker === "function") {
                          try { el.showPicker(); } catch { /* 이미 열렸거나 gesture 손실 — 무시 */ }
                        }
                      }}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        if (!newDate || newDate === localDate) return;
                        // 즉시 반영: 로컬/공유 객체/부모 상태 모두 먼저 업데이트, API 는 백그라운드
                        setLocalDate(newDate);
                        schedule.date = newDate;
                        onUpdated?.({ id: schedule.id, date: newDate });
                        apiUpdateSchedule(schedule.id, { date: newDate }).catch((err) => {
                          console.error("[날짜 수정] 서버 동기화 실패:", err);
                        });
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      aria-label="날짜 변경"
                    />
                  </label>
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
                      ref={noteTextareaRef}
                      value={noteText}
                      onChange={(e) => { setNoteText(e.target.value); setNoteChanged(true); }}
                      style={{ fontSize: "14px" }}
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
        {mode === "assign" && canAssignMember && (
          <>
            {/* 미입금 일정 경고 — 배정 차단 */}
            {titleText.includes("/미입금") && (
              <div className="px-4 pb-1">
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                  ⚠️ 미입금 일정은 배정할 수 없습니다. 먼저 <b>입금확인</b> 후 배정해주세요.
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 px-4 pb-1">
              <select
                value={assignMemberId}
                onChange={(e) => setAssignMemberId(e.target.value)}
                disabled={titleText.includes("/미입금")}
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none bg-white focus:ring-2 focus:ring-orange-400 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <option value="">배정 팀장 선택</option>
                {(allUsers || []).filter(u => u.role === "field").map((u) => (
                  <option key={u.id || u.name} value={`user:${u.id || ""}:${u.name}`}>{u.name}</option>
                ))}
              </select>
            </div>
          </>
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
          {mode === "assign" && canAssignMember && (
            <button
              onClick={() => {
                if (!assignMemberId || !onAssign) return;
                // 미입금 일정은 배정 차단 (이중 방어 — 위 UI 도 disabled 상태)
                if (titleText.includes("/미입금")) {
                  showAlert("미입금 일정은 배정할 수 없습니다.\n먼저 입금확인 후 배정해주세요.");
                  return;
                }

                // 1) 펜딩 편집(제목/본문) 먼저 로컬 반영 — 부모가 새 제목으로 리스트 렌더하도록
                const updates: Partial<Schedule> = {};
                if (titleText !== schedule.title) { updates.title = titleText; schedule.title = titleText; setEditingTitle(false); }
                if (noteChanged) { updates.note = noteText; schedule.note = noteText; setNoteChanged(false); }

                // 2) 배정 실행
                let assigned = false;
                if (assignMemberId.startsWith("user:")) {
                  const parts = assignMemberId.split(":");
                  const userId = parts[1];
                  const userName = parts.slice(2).join(":");
                  onAssign(schedule.id, userId, userName);
                  assigned = true;
                } else {
                  const member = members.find(m => m.id === assignMemberId);
                  if (member) { onAssign(schedule.id, member.id, member.name); assigned = true; }
                }
                if (!assigned) return;

                // 3) 모달 닫기 + 제목/본문 서버 동기화 (배정 API 와 다른 컬럼이라 충돌 없음)
                onClose();
                if (Object.keys(updates).length > 0) {
                  const patch = { ...updates, id: schedule.id } as Partial<Schedule>;
                  setTimeout(() => {
                    onUpdated?.(patch);
                    apiUpdateSchedule(schedule.id, updates).catch((err) => {
                      console.error("[배정+저장] 서버 동기화 실패:", err);
                    });
                  }, 0);
                }
              }}
              disabled={!assignMemberId || titleText.includes("/미입금")}
              className="flex-1 py-3 bg-orange-500 text-white rounded-xl text-sm font-bold active:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {titleText.includes("/미입금") ? "미입금(배정불가)" : "배정"}
            </button>
          )}
          {/* 입금확인 버튼 - 배정 모드에서만. 미입금/입금완료 선택은 5종 메시지 복사 후 모달 안에서 */}
          {mode === "assign" && (
            <>
              <button
                onClick={() => {
                  // 5종 메시지 모두 복사해야 미입금/입금완료 선택지 노출 (강제 가이드)
                  setCopiedPostMsgs(new Set());
                  setShowPostPaymentModal(true);
                }}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white active:opacity-90"
                style={{ background: "linear-gradient(135deg, #00c473, #00a35e)" }}
              >
                입금확인
              </button>
              {/* 미입금 즉시 토글 버튼 제거 — 모든 상태 변경은 입금확인 모달에서 5종 메시지 복사 후 진행 */}
            </>
          )}
          <button
            onClick={() => {
              const updates: Partial<Schedule> = {};
              if (titleText !== schedule.title) { updates.title = titleText; schedule.title = titleText; setEditingTitle(false); }
              if (noteChanged) { updates.note = noteText; schedule.note = noteText; setNoteChanged(false); }
              // ★ UX 우선순위: 모달 즉시 닫기 → 리스트 갱신은 다음 tick → 서버는 백그라운드
              // 리스트 re-render 가 무겁기 때문에 (수백 개) 모달 close 부터 먼저 paint 해야 반응 느낌
              onClose();
              if (Object.keys(updates).length > 0) {
                const patch = { ...updates, id: schedule.id } as Partial<Schedule>;
                setTimeout(() => {
                  onUpdated?.(patch);
                  apiUpdateSchedule(schedule.id, updates).catch((err) => {
                    console.error("[저장] 서버 동기화 실패:", err);
                  });
                }, 0);
              }
            }}
            className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-xs font-bold active:bg-blue-600"
          >
            저장
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
      {/* 입금확인 후 안내 메시지 복사 팝업 - 4종 메시지를 순서대로 복사해서 고객에게 전송 */}
      {showPostPaymentModal && (
        <div
          className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPostPaymentModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col animate-[modalIn_0.15s_ease-out]">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">입금 확인 - 고객 안내 메시지 복사</h3>
              <button
                onClick={() => setShowPostPaymentModal(false)}
                className="p-1 -mr-1 active:bg-gray-100 rounded-lg"
                aria-label="닫기"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 space-y-3">
              <p className="text-xs text-gray-500 leading-relaxed">
                고객에게 순서대로 복사 → 붙여넣어 전송해주세요.
              </p>
              {POST_PAYMENT_MESSAGES.map((msg, i) => (
                <div
                  key={i}
                  className={`border rounded-xl p-3 ${copiedPostMsgs.has(i) ? "border-green-300 bg-green-50" : "border-gray-200"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${copiedPostMsgs.has(i) ? "text-green-600" : "text-green-800"}`}>
                      {copiedPostMsgs.has(i) ? "✅ " : ""}{msg.label}
                    </span>
                    <button
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(msg.text); } catch {
                          const ta = document.createElement("textarea");
                          ta.value = msg.text;
                          document.body.appendChild(ta);
                          ta.select();
                          document.execCommand("copy");
                          document.body.removeChild(ta);
                        }
                        setCopiedPostMsgs((prev) => new Set(prev).add(i));
                      }}
                      className="px-3 py-1 bg-green-700 text-white rounded-lg text-xs font-bold active:bg-green-800"
                    >
                      {copiedPostMsgs.has(i) ? "✅" : "📋 복사"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 px-5 py-3 space-y-2">
              {/* 5종 메시지 모두 복사해야 입금완료/미입금 처리 가능 */}
              {copiedPostMsgs.size < POST_PAYMENT_MESSAGES.length ? (
                <>
                  <div className="w-full py-2.5 rounded-xl text-sm font-bold bg-gray-200 text-gray-500 text-center">
                    📋 5종 메시지 복사 후 선택지 표시 ({copiedPostMsgs.size}/{POST_PAYMENT_MESSAGES.length})
                  </div>
                  <button
                    onClick={() => setShowPostPaymentModal(false)}
                    className="w-full py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold active:bg-gray-200"
                  >
                    취소
                  </button>
                </>
              ) : (
                // 5종 다 복사함 → 입금완료 / 미입금 두 선택지 노출
                <>
                  <div className="text-[11px] text-gray-500 text-center pb-1">
                    고객 결제 상태에 맞춰 선택해주세요
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // 입금완료 처리 — title 에서 /미입금 제거 (없으면 변화 X)
                        const originalMatch = schedule.note?.match(/원래제목:\s*(.+)/);
                        const newTitle = originalMatch
                          ? originalMatch[1].trim()
                          : titleText.replace(/\/미입금/g, "");
                        if (newTitle !== titleText) {
                          schedule.title = newTitle;
                          setTitleText(newTitle);
                          setTimeout(() => {
                            onUpdated?.({ id: schedule.id, title: newTitle });
                            apiUpdateSchedule(schedule.id, { title: newTitle }).catch((err) => {
                              console.error("[입금완료] 저장 실패:", err);
                            });
                          }, 0);
                        }
                        setShowPostPaymentModal(false);
                      }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-green-600 text-white active:bg-green-700"
                    >
                      ✅ 입금완료
                    </button>
                    <button
                      onClick={() => {
                        // 미입금 처리 — title 끝에 /미입금 추가 (이미 있으면 변화 X)
                        if (!titleText.includes("/미입금")) {
                          const newTitle = `${titleText}/미입금`;
                          schedule.title = newTitle;
                          setTitleText(newTitle);
                          setTimeout(() => {
                            onUpdated?.({ id: schedule.id, title: newTitle });
                            apiUpdateSchedule(schedule.id, { title: newTitle }).catch((err) => {
                              console.error("[미입금] 저장 실패:", err);
                            });
                          }, 0);
                        }
                        setShowPostPaymentModal(false);
                      }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-red-600 bg-red-50 border border-red-300 active:bg-red-100"
                    >
                      ⚠️ 미입금
                    </button>
                  </div>
                  <button
                    onClick={() => setShowPostPaymentModal(false)}
                    className="w-full py-1.5 text-xs text-gray-400 active:text-gray-600"
                  >
                    나중에 결정
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
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
