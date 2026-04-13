"use client";

import { useState, useEffect, useCallback } from "react";
import { Member, Schedule, SwapRequest, Notification, User } from "@/types";
import Calendar from "@/components/Calendar";
import ScheduleForm from "@/components/ScheduleForm";
import MemberManager from "@/components/MemberManager";
import SwapPanel from "@/components/SwapPanel";
import GoogleCalendarSync, { GoogleEvent } from "@/components/GoogleCalendarSync";
import NotificationPanel from "@/components/NotificationPanel";
import ScheduleDetail from "@/components/ScheduleDetail";
import LoginPage from "@/components/LoginPage";
import AdminPanel from "@/components/AdminPanel";
import AssignTab from "@/components/AssignTab";
import {
  fetchMembers,
  createMember,
  updateMember as apiUpdateMember,
  deleteMember as apiDeleteMember,
  fetchSchedules,
  createSchedule,
  updateSchedule as apiUpdateSchedule,
  deleteSchedule as apiDeleteSchedule,
  unassignScheduleApi,
  fetchSwapRequests,
  createSwapRequest,
  approveSwapRequest,
  rejectSwapRequest,
  addUnassignedSchedule,
  fetchNotifications,
  markNotificationRead as apiMarkRead,
  markAllNotificationsRead as apiMarkAllRead,
} from "@/lib/api";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";

type TabMode = "calendar" | "list" | "assign" | "members";

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<TabMode>("calendar");
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [showMemberManager, setShowMemberManager] = useState(false);
  const [showSwapPanel, setShowSwapPanel] = useState(false);
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirstSchedule, setSwapFirstSchedule] = useState<Schedule | null>(null);
  const [showGoogleSync, setShowGoogleSync] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [detailSchedule, setDetailSchedule] = useState<Schedule | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showDayPopup, setShowDayPopup] = useState(false);

  const loadData = useCallback(async (monthDate?: Date) => {
    const d = monthDate || selectedDate;
    const start = format(startOfMonth(subMonths(d, 1)), "yyyy-MM-dd");
    const end = format(endOfMonth(addMonths(d, 1)), "yyyy-MM-dd");

    const [m, s, sw, notif] = await Promise.all([
      fetchMembers(),
      fetchSchedules(start, end),
      fetchSwapRequests(),
      fetchNotifications(),
    ]);
    setMembers(m);
    setSchedules(s);
    setSwapRequests(sw);
    setNotifications(notif.notifications);
    setUnreadCount(notif.unreadCount);
  }, [selectedDate]);

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // PWA 서비스워커 등록 + 설치 배너
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Login gate - must be AFTER all hooks
  if (!currentUser) {
    return <LoginPage onLogin={(user) => setCurrentUser(user)} />;
  }

  const isAdmin = currentUser.role === "admin";

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
    } else {
      const newSchedule = await createSchedule(data);
      setSchedules((prev) => [...prev, newSchedule]);
    }
    loadData(); // 백그라운드 동기화
  }
  async function handleDeleteSchedule(id: string) {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    await apiDeleteSchedule(id);
  }
  async function handleUnassignSchedule(id: string) {
    setSchedules((prev) => prev.map((s) => s.id === id ? { ...s, memberId: "", memberName: "미배정", status: "unassigned" as const } : s));
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
          loadData();
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
    loadData();
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

  // Google Calendar Import - 미배정 상태로 대기 목록에 추가
  function handleGoogleImport(events: GoogleEvent[]) {
    events.forEach(async (event) => {
      const startDt = event.start.dateTime
        ? new Date(event.start.dateTime)
        : new Date(event.start.date + "T09:00:00");
      const endDt = event.end.dateTime
        ? new Date(event.end.dateTime)
        : new Date(event.end.date + "T12:00:00");
      await addUnassignedSchedule({
        title: event.summary || "캘린더 일정",
        date: format(startDt, "yyyy-MM-dd"),
        startTime: format(startDt, "HH:mm"),
        endTime: format(endDt, "HH:mm"),
        note: event.description || "",
      });
    });
    setShowGoogleSync(false);
    setActiveTab("assign");
    setTimeout(() => loadData(), 500);
  }

  // Derived
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const daySchedules = schedules
    .filter((s) => s.date === dateStr)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const allSchedulesSorted = [...schedules].sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    return dateComp !== 0 ? dateComp : a.startTime.localeCompare(b.startTime);
  });
  const pendingSwapCount = swapRequests.filter((r) => r.status === "pending").length;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* PWA 설치 배너 */}
      {showInstallBanner && (
        <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between z-50 relative">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏠</span>
            <span className="text-sm font-medium">앱으로 설치하면 더 편해요!</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (installPrompt && "prompt" in installPrompt) {
                  (installPrompt as unknown as { prompt: () => void }).prompt();
                }
                setShowInstallBanner(false);
              }}
              className="bg-white text-blue-600 px-3 py-1 rounded-lg text-xs font-bold"
            >
              설치
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              className="text-blue-200 text-xs"
            >
              닫기
            </button>
          </div>
        </div>
      )}
      {/* Compact mobile header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="text-sm font-bold text-gray-800 truncate">일정관리</h1>
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium shrink-0">{currentUser.name}</span>
          </div>
          <div className="flex items-center shrink-0">
            {/* Notification bell */}
            <button
              onClick={() => setShowNotifications(true)}
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
            {isAdmin && (
              <button onClick={() => setShowAdminPanel(true)} className="p-2 text-gray-400 active:bg-purple-50 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            )}
            {/* Logout */}
            <button onClick={() => setCurrentUser(null)} className="p-1.5 text-gray-400 active:bg-red-50 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Google Calendar Sync */}
      {showGoogleSync && (
        <div className="px-4 pt-3">
          <GoogleCalendarSync onImport={handleGoogleImport} />
        </div>
      )}

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
      <main className="px-3 pt-2 pb-2">
        {/* Calendar tab - 삼성 캘린더 스타일 */}
        {activeTab === "calendar" && (
          <div>
            <Calendar
              schedules={schedules}
              members={members}
              selectedDate={selectedDate}
              onSelectDate={(d) => { setSelectedDate(d); setShowDayPopup(true); }}
              onMonthChange={(d) => loadData(d)}
            />
          </div>
        )}

        {/* List tab */}
        {activeTab === "list" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-800">전체 일정</h3>
                <p className="text-xs text-gray-400">{allSchedulesSorted.length}건</p>
              </div>
              <button
                onClick={() => { setEditingSchedule(null); setShowScheduleForm(true); }}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium active:bg-blue-600"
              >
                + 배정
              </button>
            </div>
            <div className="divide-y divide-gray-50 max-h-[calc(100vh-200px)] overflow-y-auto">
              {allSchedulesSorted.length === 0 ? (
                <div className="px-4 py-12 text-center text-gray-400 text-sm">
                  등록된 일정이 없습니다
                </div>
              ) : (
                allSchedulesSorted.map((s) => {
                  const color = members.find((m) => m.id === s.memberId)?.color || "#6B7280";
                  return (
                    <div key={s.id} className="px-4 py-3 active:bg-gray-50 flex items-center gap-2.5">
                      <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-800 truncate">{s.title}</span>
                          <span className="text-xs text-gray-400 shrink-0">{s.memberName}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {s.date} {s.startTime}-{s.endTime}
                          {s.location && ` · ${s.location}`}
                        </div>
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        <button onClick={() => handleEditSchedule(s)} className="p-1.5 text-gray-400 active:text-blue-500 rounded">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteSchedule(s.id)} className="p-1.5 text-gray-400 active:text-red-500 rounded">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Assign tab */}
        {activeTab === "assign" && (
          <AssignTab members={members} onAssigned={() => loadData()} />
        )}

        {/* Members tab */}
        {activeTab === "members" && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800">팀원 목록</h3>
                <button
                  onClick={() => setShowMemberManager(true)}
                  className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium"
                >
                  관리
                </button>
              </div>
              <div className="space-y-2.5">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                      style={{ backgroundColor: m.active ? m.color : "#9CA3AF" }}
                    >
                      {m.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-800">{m.name}</span>
                        {!m.active && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">비활성</span>}
                      </div>
                      <div className="text-xs text-gray-400">{m.phone || "연락처 없음"}</div>
                    </div>
                    <div className="flex gap-0.5">
                      {["일","월","화","수","목","금","토"].map((name, i) => (
                        <span key={i} className={`text-[9px] w-4 h-4 flex items-center justify-center rounded-full ${m.availableDays.includes(i) ? "bg-blue-100 text-blue-600 font-medium" : "text-gray-300"}`}>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Google Calendar section */}
            <GoogleCalendarSync onImport={handleGoogleImport} />
          </div>
        )}
      </main>

      {/* Bottom tab bar - mobile style */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-bottom">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
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

          {isAdmin && (
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

          {/* Center FAB - add schedule */}
          <button
            onClick={() => { setEditingSchedule(null); setShowScheduleForm(true); }}
            className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center shadow-lg -mt-5 active:bg-blue-600"
          >
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>

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

          <button
            onClick={() => setActiveTab("list")}
            className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full ${
              activeTab === "list" ? "text-blue-500" : "text-gray-400"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === "list" ? 2.5 : 1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span className="text-[10px] font-medium">더보기</span>
          </button>
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
          onClose={() => setShowNotifications(false)}
        />
      )}
      {/* 날짜 클릭 팝업 - 삼성 캘린더 스타일 */}
      {showDayPopup && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-8" onClick={(e) => { if (e.target === e.currentTarget) setShowDayPopup(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[340px] animate-[modalIn_0.15s_ease-out]">
            {/* 날짜 헤더 */}
            <div className="px-5 pt-5 pb-2 flex items-center justify-between">
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

            {/* 일정 목록 - 4개까지 편하게 보이는 사이즈 */}
            {daySchedules.length === 0 ? (
              <div className="px-5 pb-6 pt-3 text-center text-gray-400 text-sm">
                일정이 없습니다
              </div>
            ) : (
              <div className="px-4 pb-5 pt-1 space-y-2 max-h-[380px] overflow-y-auto">
                {daySchedules.map((s) => {
                  const titleDisplay = s.title.replace(/^\[.+?\]\s*/, "").split("/")[0].replace(/^U/, "") || s.title;
                  const schedColor = s.color || "#FDDCCC";
                  return (
                    <div
                      key={s.id}
                      className="rounded-2xl cursor-pointer active:scale-[0.97] transition-transform"
                      style={{ backgroundColor: schedColor }}
                      onClick={() => { setShowDayPopup(false); swapMode ? handleSwapSelect(s) : setDetailSchedule(s); }}
                    >
                      <div className="px-4 py-3 flex items-center gap-3">
                        <span className="text-lg">📅</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-gray-900 truncate">{titleDisplay}</div>
                          <div className="text-xs text-gray-600 mt-0.5">하루 종일</div>
                        </div>
                        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {detailSchedule && (
        <ScheduleDetail
          schedule={detailSchedule}
          members={members}
          isAdmin={isAdmin}
          onEdit={(s) => { setDetailSchedule(null); handleEditSchedule(s); }}
          onDelete={(id) => { handleDeleteSchedule(id); setDetailSchedule(null); }}
          onUnassign={(id) => { handleUnassignSchedule(id); setDetailSchedule(null); }}
          onClose={() => setDetailSchedule(null)}
        />
      )}
      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
    </div>
  );
}
