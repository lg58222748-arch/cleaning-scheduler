"use client";

import { useState, useEffect, useCallback } from "react";
import { Member, Schedule, SwapRequest, Notification, User, UserRole } from "@/types";
import Calendar from "@/components/Calendar";
import ScheduleForm from "@/components/ScheduleForm";
import MemberManager from "@/components/MemberManager";
import SwapPanel from "@/components/SwapPanel";
// GoogleCalendarSync 제거 - 직접 등록으로 전환
import NotificationPanel from "@/components/NotificationPanel";
import ScheduleDetail from "@/components/ScheduleDetail";
import LoginPage from "@/components/LoginPage";
import AdminPanel from "@/components/AdminPanel";
import AssignTab from "@/components/AssignTab";
import SearchPanel from "@/components/SearchPanel";
import ManageTab from "@/components/ManageTab";
import SalesTab from "@/components/SalesTab";
import {
  fetchMembers,
  createMember,
  updateMember as apiUpdateMember,
  deleteMember as apiDeleteMember,
  fetchSchedules,
  fetchUnassignedSchedules,
  createSchedule,
  updateSchedule as apiUpdateSchedule,
  softDeleteSchedule,
  deleteAllSchedules,
  fetchDeletedSchedules,
  restoreScheduleApi,
  emptyTrashApi,
  unassignScheduleApi,
  assignScheduleApi,
  fetchSwapRequests,
  createSwapRequest,
  approveSwapRequest,
  rejectSwapRequest,
  addUnassignedSchedule,
  fetchNotifications,
  markNotificationRead as apiMarkRead,
  markAllNotificationsRead as apiMarkAllRead,
  autoSyncGoogleCalendar,
  fetchUsers,
  approveUserApi,
  rejectUserApi,
  changeUserRoleApi,
  deleteUserApi,
} from "@/lib/api";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";

type TabMode = "calendar" | "manage" | "assign" | "members" | "sales";

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // 클라이언트에서만 localStorage 복원 (hydration mismatch 방지)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("currentUser");
      if (saved) setCurrentUser(JSON.parse(saved));
    } catch {}
  }, []);
  const [members, setMembers] = useState<Member[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [unassignedSchedules, setUnassignedSchedules] = useState<Schedule[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<TabMode>("calendar");
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [showMemberManager, setShowMemberManager] = useState(false);
  const [showSwapPanel, setShowSwapPanel] = useState(false);
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirstSchedule, setSwapFirstSchedule] = useState<Schedule | null>(null);
  // showGoogleSync 제거됨
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [detailSchedule, setDetailSchedule] = useState<Schedule | null>(null);
  const [detailMode, setDetailMode] = useState<"calendar" | "assign">("calendar");
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [showDayPopup, setShowDayPopup] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [returnAlerts, setReturnAlerts] = useState<{ id: string; title: string; date: string; reason: string }[]>([]);

  const loadData = useCallback(async (monthDate?: Date, fullRefresh = false) => {
    const d = monthDate || selectedDate;
    const start = format(startOfMonth(subMonths(d, 1)), "yyyy-MM-dd");
    const end = format(endOfMonth(addMonths(d, 1)), "yyyy-MM-dd");

    if (fullRefresh) {
      const [m, rangeScheds, unassignedScheds, sw, notif, usersData] = await Promise.all([
        fetchMembers(),
        fetchSchedules(start, end),
        fetchUnassignedSchedules(),
        fetchSwapRequests(),
        fetchNotifications(),
        fetchUsers(),
      ]);
      setMembers(m);
      setSchedules(rangeScheds); // 달력용: 배정된 일정만
      setUnassignedSchedules(unassignedScheds); // 배정탭용: 미배정만
      setSwapRequests(sw);
      setNotifications(notif.notifications);
      setUnreadCount(notif.unreadCount);
      setAllUsers(usersData.users);
      setPendingUsers(usersData.pendingUsers);
    } else {
      // 월 이동 시에는 배정된 일정만 빠르게
      const rangeScheds = await fetchSchedules(start, end);
      setSchedules(rangeScheds);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (currentUser) loadData(undefined, true);
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // PWA 서비스워커 등록 + 설치 배너
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInApp, setIsInApp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
    // 카카오톡/네이버 인앱브라우저 감지
    const ua = navigator.userAgent || "";
    if (/KAKAOTALK|NAVER|Instagram|FB_IAB|Line/i.test(ua)) {
      setIsInApp(true);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // 뒤로가기 버튼 처리 - 팝업/모달 닫기
  useEffect(() => {
    const handlePop = () => {
      // 열려있는 모달을 순서대로 닫기
      if (detailSchedule) { setDetailSchedule(null); return; }
      if (showDayPopup) { setShowDayPopup(false); return; }
      if (showNotifications) { setShowNotifications(false); return; }
      if (showScheduleForm) { setShowScheduleForm(false); setEditingSchedule(null); return; }
      if (showMemberManager) { setShowMemberManager(false); return; }
      if (showAdminPanel) { setShowAdminPanel(false); return; }
      if (showSearch) { setShowSearch(false); return; }
      if (profileUser) { setProfileUser(null); return; }
      // 아무 팝업도 없으면 히스토리 복원
      history.pushState(null, "");
    };
    // 앱 시작 시 기본 히스토리 추가
    history.pushState(null, "");
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }); // 매 렌더마다 최신 state 참조

  // Login gate - must be AFTER all hooks
  if (!currentUser) {
    return <LoginPage onLogin={(user) => {
      localStorage.setItem("currentUser", JSON.stringify(user));
      setCurrentUser(user);
    }} />;
  }

  const role = currentUser.role;
  const isAdmin = role === "ceo"; // 하위 호환
  const isSales = role === "ceo" || role === "sales";
  const canSales = role === "ceo" || role === "sales";
  const canAssign = role === "ceo" || role === "scheduler" || role === "sales";
  const canMembers = role === "ceo" || role === "scheduler";
  const canManage = role === "ceo" || role === "field" || role === "scheduler";
  const canManageAdvanced = role === "ceo";

  // Members — 낙관적 업데이트
  async function handleAddMember(data: { name: string; phone: string; availableDays: number[] }) {
    const newMember = await createMember(data);
    setMembers((prev) => [...prev, newMember]);
  }
  async function handleUpdateMember(id: string, data: Partial<Member>) {
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, ...data } : m));
    await apiUpdateMember(id, data);
  }
  async function handleDeleteMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    await apiDeleteMember(id);
  }

  // Schedules — 낙관적 업데이트
  async function handleSaveSchedule(data: Omit<Schedule, "id" | "status">) {
    setShowScheduleForm(false);
    setEditingSchedule(null);
    if (editingSchedule) {
      setSchedules((prev) => prev.map((s) => s.id === editingSchedule.id ? { ...s, ...data } : s));
      await apiUpdateSchedule(editingSchedule.id, data);
    } else if (activeTab === "calendar" && data.memberId) {
      // 달력탭 + 팀원 선택 → 달력에 바로 등록
      try {
        const newSchedule = await createSchedule(data);
        if (newSchedule?.id) setSchedules((prev) => [...prev, newSchedule]);
      } catch {
        // fallback: 배정탭으로
        const ns = await addUnassignedSchedule({ title: data.title, date: data.date, startTime: data.startTime, endTime: data.endTime, note: data.note || "", color: data.color });
        if (ns?.id) setUnassignedSchedules((prev) => [...prev, ns]);
      }
    } else {
      // 배정탭 또는 팀원 미선택 → 배정탭(미배정)으로
      const newSchedule = await addUnassignedSchedule({
        title: data.title, date: data.date, startTime: data.startTime, endTime: data.endTime, note: data.note || "", color: data.color,
      });
      if (newSchedule?.id) setUnassignedSchedules((prev) => [...prev, newSchedule]);
    }
    loadData(undefined, true);
  }
  async function handleDeleteSchedule(id: string) {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    setUnassignedSchedules((prev) => prev.filter((s) => s.id !== id));
    await softDeleteSchedule(id);
  }

  async function handleUnassignSchedule(id: string, reason: string = "") {
    const target = schedules.find((s) => s.id === id);
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    if (target) {
      setUnassignedSchedules((prev) => [...prev, { ...target, memberId: "", memberName: "미배정", status: "unassigned" as const }]);
      setReturnAlerts((prev) => [...prev, { id: target.id, title: target.title.replace(/^\[.+?\]\s*/, ""), date: target.date, reason }]);
    }
    await unassignScheduleApi(id);
  }
  function handleEditSchedule(schedule: Schedule) {
    setEditingSchedule(schedule);
    setShowScheduleForm(true);
  }

  // Swap select
  function handleSwapSelect(schedule: Schedule) {
    if (!swapFirstSchedule) {
      setSwapFirstSchedule(schedule);
    } else {
      if (swapFirstSchedule.id !== schedule.id) {
        createSwapRequest(swapFirstSchedule.id, schedule.id).then(() => {
          loadData(undefined, true);
          setSwapMode(false);
          setSwapFirstSchedule(null);
        });
      }
    }
  }

  // Swap — 낙관적 업데이트
  async function handleApproveSwap(swapId: string) {
    setSwapRequests((prev) => prev.map((r) => r.id === swapId ? { ...r, status: "approved" as const } : r));
    await approveSwapRequest(swapId);
    loadData(undefined, true);
  }
  async function handleRejectSwap(swapId: string) {
    setSwapRequests((prev) => prev.map((r) => r.id === swapId ? { ...r, status: "rejected" as const } : r));
    await rejectSwapRequest(swapId);
  }

  // Notifications — 낙관적 업데이트
  async function handleMarkRead(id: string) {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
    await apiMarkRead(id);
  }
  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await apiMarkAllRead();
  }
  function handleClearAllNotifications() {
    setNotifications([]);
    setUnreadCount(0);
  }

  // Google Calendar 제거됨 - 직접 등록/영업탭으로 대체

  // Derived - schedules는 이미 배정된 것만 (DB레벨 분리)
  const myLinkedMember = members.find((m) => m.linkedUsername === currentUser.username);
  const calendarSchedules = canManageAdvanced
    ? schedules
    : schedules.filter((s) =>
        s.memberName === currentUser.name ||
        s.assignedToName === currentUser.name ||
        s.assignedTo === currentUser.id ||
        (myLinkedMember && s.memberId === myLinkedMember.id)
      );
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const daySchedules = calendarSchedules
    .filter((s) => s.date === dateStr)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const pendingSwapCount = swapRequests.filter((r) => r.status === "pending").length;

  return (
    <div className="h-screen bg-white pb-16 flex flex-col overflow-hidden">
      {/* 카카오톡 인앱브라우저 감지 → 외부 브라우저 이동 */}
      {isInApp && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 text-center max-w-sm w-full">
            <div className="text-3xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">외부 브라우저에서 열어주세요</h2>
            <p className="text-sm text-gray-500 mb-4">카카오톡/네이버 브라우저에서는<br/>앱 설치가 제한됩니다.</p>
            <button onClick={() => {
              const url = window.location.href;
              if (/Android/i.test(navigator.userAgent)) {
                window.location.href = "intent://" + url.replace(/https?:\/\//, "") + "#Intent;scheme=https;package=com.android.chrome;end";
              } else {
                navigator.clipboard?.writeText(url);
                alert("주소가 복사되었습니다!\n사파리에 붙여넣기 해주세요.");
              }
            }} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm mb-2">
              크롬/사파리로 열기
            </button>
            <button onClick={() => setIsInApp(false)} className="text-xs text-gray-400">그냥 사용하기</button>
          </div>
        </div>
      )}

      {/* PWA 설치 - 대문짝만하게 */}
      {showInstallBanner && !isInApp && (
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 text-center max-w-sm w-full">
            <div className="text-4xl mb-3">📲</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">새집느낌 앱 설치</h2>
            <p className="text-sm text-gray-500 mb-5">홈 화면에 추가하면<br/>앱처럼 빠르게 사용할 수 있어요!</p>
            <button
              onClick={async () => {
                if (installPrompt && "prompt" in installPrompt) {
                  (installPrompt as unknown as { prompt: () => void }).prompt();
                }
                setShowInstallBanner(false);
              }}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-base mb-3"
            >
              설치하기
            </button>
            <button onClick={() => setShowInstallBanner(false)} className="text-sm text-gray-400">
              나중에 하기
            </button>
          </div>
        </div>
      )}
      {/* 반환 알림 배너 - 관리자만 */}
      {canAssign && returnAlerts.length > 0 && (
        <div className="bg-orange-500 text-white z-50 animate-[slideDown_0.3s_ease-out]">
          {returnAlerts.slice(0, 5).map((alert) => (
            <div key={alert.id} className="px-3 py-1.5 flex items-center gap-2 border-b border-orange-400/30 last:border-0">
              <span className="text-[10px]">↩</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium truncate">{alert.title}</div>
                <div className="text-[9px] opacity-70">{alert.date} · {alert.reason}</div>
              </div>
              <button onClick={() => setReturnAlerts((prev) => prev.filter((a) => a.id !== alert.id))} className="text-white/60 active:text-white ml-1 shrink-0">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
          {returnAlerts.length > 5 && (
            <div className="px-3 py-1 text-[10px] opacity-80 text-center">+{returnAlerts.length - 5}건 더</div>
          )}
          <button onClick={() => { setReturnAlerts([]); setActiveTab("assign"); }} className="w-full py-1.5 text-[11px] font-medium bg-orange-600/50 active:bg-orange-600">
            배정탭에서 처리 →
          </button>
        </div>
      )}
      {/* Compact mobile header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="text-sm font-bold text-gray-800 truncate">새집느낌</h1>
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium shrink-0">{currentUser.name}</span>
          </div>
          <div className="flex items-center shrink-0">
            {/* Search */}
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 text-gray-400 active:bg-blue-50 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            {/* Notification bell */}
            <button
              onClick={() => { setShowDayPopup(false); setShowNotifications(true); }}
              className="p-2 text-gray-400 active:bg-yellow-50 rounded-lg relative"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            {/* Admin button */}
            {canManageAdvanced && (
              <button onClick={() => setShowAdminPanel(true)} className="p-2 text-gray-400 active:bg-purple-50 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            )}
            {/* Logout */}
            <button onClick={() => { localStorage.removeItem("currentUser"); setCurrentUser(null); }} className="p-1.5 text-gray-400 active:bg-red-50 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Google Calendar 제거됨 */}

      {/* Swap mode banner */}
      {swapMode && (
        <div className="mx-4 mt-3 p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-orange-700 flex-1">
            {swapFirstSchedule
              ? `"${swapFirstSchedule.memberName}" 선택됨 → 교환할 일정 선택`
              : "교환할 첫 번째 일정을 선택하세요"}
          </span>
          <button
            onClick={() => { setSwapMode(false); setSwapFirstSchedule(null); }}
            className="text-xs px-2.5 py-1 bg-orange-100 text-orange-700 rounded-lg shrink-0"
          >
            취소
          </button>
        </div>
      )}

      {/* Main content area */}
      <main className="flex-1 overflow-hidden">
        {/* Calendar tab - 삼성 캘린더 스타일 */}
        {/* 모든 탭 항상 마운트, display로 전환 → 즉시 전환 */}
        <div className="h-full" style={{ display: activeTab === "calendar" ? "block" : "none" }}>
          <Calendar
            schedules={calendarSchedules}
            members={members}
            selectedDate={selectedDate}
            onSelectDate={(d) => { setSelectedDate(d); setShowDayPopup(true); }}
            onMonthChange={(d) => loadData(d)}
          />
        </div>

        <div style={{ display: activeTab === "manage" ? "block" : "none" }}>
          <ManageTab isAdmin={canManageAdvanced} onRefresh={() => loadData(undefined, true)} />
        </div>

        {canAssign && (
          <div className="h-full" style={{ display: activeTab === "assign" ? "block" : "none" }}>
            <AssignTab members={members} schedules={unassignedSchedules} onAssigned={(scheduleId, memberId, memberName) => {
              // 낙관적 업데이트: 즉시 UI 반영
              const target = unassignedSchedules.find((s) => s.id === scheduleId);
              if (target) {
                // 배정탭에서 제거
                setUnassignedSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
                // 달력에 추가
                setSchedules((prev) => [...prev, { ...target, memberId, memberName, status: "confirmed" as const }]);
              }
              // API는 백그라운드 (안 기다림)
              assignScheduleApi(scheduleId, memberId, memberName);
            }} onDeleted={(id) => {
              setUnassignedSchedules((prev) => prev.filter((s) => s.id !== id));
            }} onOpenDetail={(s) => {
              setDetailMode("assign");
              setDetailSchedule(s);
            }} />
          </div>
        )}

        {/* 팀원 탭 */}
        <div style={{ display: activeTab === "members" ? "block" : "none" }}>
          <div className="h-full overflow-y-auto p-3 space-y-3">
            {/* 전체 팀원 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-bold text-gray-800 mb-3">팀원 ({allUsers.length}{canManageAdvanced && pendingUsers.length > 0 ? ` + 대기 ${pendingUsers.length}` : ""})</h3>
              <div className="space-y-2.5">
                {[...allUsers, ...(canManageAdvanced ? pendingUsers : [])].sort((a, b) => {
                  if (a.username === currentUser.username) return -1;
                  if (b.username === currentUser.username) return 1;
                  return 0;
                }).map((u) => {
                  const isMe = u.username === currentUser.username;
                  const roleLabels: Record<string, string> = { ceo: "대표", scheduler: "일정관리자", sales: "영업팀", field: "현장팀", pending: "대기" };
                  const roleColors: Record<string, string> = { ceo: "bg-purple-100 text-purple-700", scheduler: "bg-blue-100 text-blue-700", sales: "bg-green-100 text-green-700", field: "bg-orange-100 text-orange-700", pending: "bg-gray-100 text-gray-500" };
                  return (
                    <div key={u.id} className={`border rounded-xl p-3 ${isMe ? "border-blue-300 bg-blue-50/30" : u.status === "pending" ? "border-orange-300 bg-orange-50/30" : "border-gray-200"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${isMe ? "bg-blue-500 text-white" : u.status === "pending" ? "bg-orange-200 text-orange-700" : "bg-blue-100 text-blue-600"}`}>{u.name[0]}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-gray-800">{u.name}</span>
                            {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500 text-white">본인</span>}
                            {u.status === "pending"
                              ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">승인대기</span>
                              : <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${roleColors[u.role] || "bg-gray-100 text-gray-500"}`}>{roleLabels[u.role] || u.role}</span>
                            }
                          </div>
                          <div className="text-xs text-gray-400">{u.phone || "연락처 없음"}{u.branch ? ` · ${u.branch}[관리점]` : ""}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {canManageAdvanced && !isMe && u.status !== "pending" && (
                            <select
                              value={u.role}
                              onChange={async (e) => {
                                const newRole = e.target.value as UserRole;
                                setAllUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x));
                                await changeUserRoleApi(u.id, newRole);
                              }}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none bg-white"
                            >
                              <option value="field">현장팀</option>
                              <option value="sales">영업팀</option>
                              <option value="scheduler">일정관리자</option>
                              <option value="ceo">대표</option>
                            </select>
                          )}
                          {canManageAdvanced && !isMe && u.status !== "pending" && (
                            <>
                              <button onClick={() => setProfileUser(u)} className="p-1.5 active:bg-gray-100 rounded-lg">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              </button>
                              <button onClick={() => {
                                if (!confirm(u.name + "님을 탈퇴시키겠습니까?")) return;
                                setAllUsers(prev => prev.filter(x => x.id !== u.id));
                                deleteUserApi(u.id).then(() => loadData(undefined, true));
                              }} className="p-1.5 active:bg-red-50 rounded-lg">
                                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {/* 승인 대기 - 대표만 승인/거절 */}
                      {u.status === "pending" && canManageAdvanced && (
                        <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
                          <button onClick={async () => { await approveUserApi(u.id); loadData(undefined, true); }} className="flex-1 py-2 bg-green-500 text-white rounded-lg text-xs font-bold active:bg-green-600">승인</button>
                          <button onClick={async () => { await rejectUserApi(u.id); loadData(undefined, true); }} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-xs font-bold active:bg-red-600">거절</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Sales tab */}
        {canSales && (
          <div className="h-full" style={{ display: activeTab === "sales" ? "block" : "none" }}>
            <SalesTab userName={currentUser.name} onCreated={() => loadData(undefined, true)} />
          </div>
        )}
      </main>

      {/* FAB + 버튼 - 달력/배정에서만 */}
      {(activeTab === "calendar" || activeTab === "assign") && canAssign && (
        <button
          onClick={() => { setEditingSchedule(null); setShowScheduleForm(true); }}
          className="fixed bottom-20 right-4 w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg active:bg-blue-600 z-30"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* Bottom tab bar - mobile style */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-bottom">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {/* 영업 */}
          {canSales && (
            <button
              onClick={() => setActiveTab("sales")}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full ${
                activeTab === "sales" ? "text-blue-500" : "text-gray-400"
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === "sales" ? 2.5 : 1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-[10px] font-medium">영업</span>
            </button>
          )}

          {/* 배정 */}
          {canAssign && (
            <button
              onClick={() => setActiveTab("assign")}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full ${
                activeTab === "assign" ? "text-blue-500" : "text-gray-400"
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === "assign" ? 2.5 : 1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-[10px] font-medium">배정</span>
            </button>
          )}

          {/* 달력 */}
          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full ${
              activeTab === "calendar" ? "text-blue-500" : "text-gray-400"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === "calendar" ? 2.5 : 1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px] font-medium">달력</span>
          </button>

          {/* 팀원 */}
          <button
            onClick={() => setActiveTab("members")}
            className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full ${
              activeTab === "members" ? "text-blue-500" : "text-gray-400"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === "members" ? 2.5 : 1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[10px] font-medium">팀원</span>
          </button>

          {/* 관리 */}
          {canManage && (
          <button
            onClick={() => setActiveTab("manage")}
            className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full ${
              activeTab === "manage" ? "text-blue-500" : "text-gray-400"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === "manage" ? 2.5 : 1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span className="text-[10px] font-medium">{canManageAdvanced ? "관리" : "더보기"}</span>
          </button>
          )}
        </div>
      </nav>

      {/* Modals */}
      {showScheduleForm && (
        <ScheduleForm
          members={members}
          selectedDate={selectedDate}
          editingSchedule={editingSchedule}
          onSave={handleSaveSchedule}
          onCancel={() => { setShowScheduleForm(false); setEditingSchedule(null); }}
        />
      )}
      {showMemberManager && (
        <MemberManager
          members={members}
          onAdd={handleAddMember}
          onUpdate={handleUpdateMember}
          onDelete={handleDeleteMember}
          onClose={() => setShowMemberManager(false)}
        />
      )}
      {showSwapPanel && (
        <SwapPanel
          swapRequests={swapRequests}
          schedules={schedules}
          members={members}
          onApprove={handleApproveSwap}
          onReject={handleRejectSwap}
          onClose={() => setShowSwapPanel(false)}
        />
      )}
      {showNotifications && (
        <NotificationPanel
          notifications={notifications}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onClearAll={handleClearAllNotifications}
          onClose={() => setShowNotifications(false)}
        />
      )}
      {/* 날짜 클릭 팝업 - 삼성 캘린더 스타일 (달력탭에서만) */}
      {showDayPopup && activeTab === "calendar" && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-5" onClick={(e) => { if (e.target === e.currentTarget) setShowDayPopup(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[380px] animate-[modalIn_0.15s_ease-out]">
            {/* 날짜 헤더 */}
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{format(selectedDate, "d")}</span>
                <span className="text-sm text-gray-500">{format(selectedDate, "EEEE", { locale: ko })}</span>
              </div>
              <button
                onClick={() => { setShowDayPopup(false); setEditingSchedule(null); setShowScheduleForm(true); }}
                className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:bg-blue-100"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {/* 일정 목록 */}
            <div className="px-4 pb-6 pt-1 space-y-3 overflow-y-auto" style={{ minHeight: "340px", maxHeight: "480px" }}>
              {daySchedules.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm" style={{ minHeight: "300px" }}>
                  일정이 없습니다
                </div>
              ) : (
                daySchedules.map((s) => {
                  const titleDisplay = s.title.replace(/^\[.+?\]\s*/, "").replace(/^U/, "") || s.title;
                  const schedColor = s.color || "#FDDCCC";
                  return (
                    <div
                      key={s.id}
                      className="rounded-2xl cursor-pointer active:scale-[0.97] transition-transform"
                      style={{ backgroundColor: schedColor }}
                      onClick={() => { setShowDayPopup(false); swapMode ? handleSwapSelect(s) : (() => { setDetailMode("calendar"); setDetailSchedule(s); })(); }}
                    >
                      <div className="px-4 py-4 flex items-center gap-3">
                        <span className="text-xl">📅</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] font-bold text-gray-900 truncate">{titleDisplay}</div>
                          <div className="text-xs text-gray-600 mt-0.5">{s.title.match(/^\[(.+?)\]/)?.[1] || "하루 종일"}</div>
                        </div>
                        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      {detailSchedule && (
        <ScheduleDetail
          schedule={detailSchedule}
          members={members}
          isAdmin={canAssign}
          mode={detailMode}
          currentUserName={currentUser.name}
          allUsers={allUsers.map(u => ({ name: u.name }))}
          onEdit={(s) => { setDetailSchedule(null); handleEditSchedule(s); }}
          onDelete={(id) => { handleDeleteSchedule(id); setDetailSchedule(null); }}
          onUnassign={(id, reason) => { handleUnassignSchedule(id, reason); setDetailSchedule(null); }}
          onAssign={(scheduleId, memberId, memberName) => {
            const target = unassignedSchedules.find((s) => s.id === scheduleId);
            if (target) {
              setUnassignedSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
              setSchedules((prev) => [...prev, { ...target, memberId, memberName, status: "confirmed" as const }]);
            }
            assignScheduleApi(scheduleId, memberId, memberName);
            setDetailSchedule(null);
          }}
          onClose={() => setDetailSchedule(null)}
          onUpdated={() => loadData(undefined, true)}
        />
      )}
      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
      {showSearch && (
        <SearchPanel
          onSelectSchedule={(s) => { setShowSearch(false); setDetailMode("calendar"); setDetailSchedule(s); }}
          onClose={() => setShowSearch(false)}
        />
      )}
      {/* 신상정보 팝업 */}
      {profileUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-6" onClick={(e) => { if (e.target === e.currentTarget) setProfileUser(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-[modalIn_0.15s_ease-out]">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800">신상정보</h3>
              <button onClick={() => setProfileUser(null)} className="p-1 active:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 pb-5 space-y-3">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">{profileUser.name[0]}</div>
                <div>
                  <div className="text-base font-bold text-gray-800">{profileUser.name}</div>
                  <div className="text-xs text-gray-500">{profileUser.username}</div>
                </div>
              </div>
              {[
                ["아이디", profileUser.username],
                ["비밀번호", profileUser.password],
                ["연락처", profileUser.phone],
                ["주소", profileUser.address],
                ["관리점", profileUser.branch ? `${profileUser.branch}[관리점]` : ""],
                ["주민등록번호", profileUser.residentNumber],
                ["사업자등록증", profileUser.businessLicenseFile],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
                  <span className="text-sm text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
