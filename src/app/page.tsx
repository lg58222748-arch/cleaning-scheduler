"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Member, Schedule, SwapRequest, Notification, User, UserRole } from "@/types";
import Calendar from "@/components/Calendar";
import LoginPage from "@/components/LoginPage";
import ScheduleDetail from "@/components/ScheduleDetail";

// 동적 로딩 - 필요할 때만 로드
const ScheduleForm = dynamic(() => import("@/components/ScheduleForm"), { ssr: false });
const MemberManager = dynamic(() => import("@/components/MemberManager"), { ssr: false });
const SwapPanel = dynamic(() => import("@/components/SwapPanel"), { ssr: false });
const NotificationPanel = dynamic(() => import("@/components/NotificationPanel"), { ssr: false });
const AdminPanel = dynamic(() => import("@/components/AdminPanel"), { ssr: false });
const AssignTab = dynamic(() => import("@/components/AssignTab"), { ssr: false });
const SearchPanel = dynamic(() => import("@/components/SearchPanel"), { ssr: false });
const ManageTab = dynamic(() => import("@/components/ManageTab"), { ssr: false });
const SalesTab = dynamic(() => import("@/components/SalesTab"), { ssr: false });
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
  const [appReady, setAppReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // 클라이언트에서만 localStorage 복원
  useEffect(() => {
    try {
      const saved = localStorage.getItem("currentUser");
      if (saved) setCurrentUser(JSON.parse(saved));
    } catch {}
    // 스플래시 1초 후 앱 표시
    const t = setTimeout(() => {
      setShowSplash(false);
      setAppReady(true);
    }, 1500);
    return () => clearTimeout(t);
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
  const [showMemberFilter, setShowMemberFilter] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [filterActive, setFilterActive] = useState(false); // 필터 사용 여부
  const [returnAlerts, setReturnAlerts] = useState<{ id: string; title: string; date: string; reason: string }[]>([]);

  const loadData = useCallback(async (monthDate?: Date, fullRefresh = false) => {
    try {
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
        setSchedules(rangeScheds);
        setUnassignedSchedules(unassignedScheds);
        setSwapRequests(sw);
        // 알림: 대표는 전체, 나머지는 본인 이름 포함된 것만
        const allNotifs = notif.notifications as Notification[];
        const uName = currentUser?.name || "";
        const uRole = currentUser?.role || "";
        const myNotifs = (uRole === "ceo" || uRole === "scheduler")
          ? allNotifs
          : allNotifs.filter(n => n.message.includes(uName) || n.title.includes(uName));
        setNotifications(myNotifs);
        setUnreadCount(myNotifs.filter(n => !n.read).length);
        setAllUsers(usersData.users);
        setPendingUsers(usersData.pendingUsers);
      } else {
        const rangeScheds = await fetchSchedules(start, end);
        setSchedules(rangeScheds);
      }
    } catch {
      // 데이터 로드 실패 - 자동 재시도됨
    }
  }, [selectedDate]);

  useEffect(() => {
    if (currentUser) {
      loadData(undefined, true);
      // 역할별 기본 탭
      const r = currentUser.role;
      if (r === "sales") setActiveTab("sales");
      else if (r === "scheduler") setActiveTab("assign");
      else if (r === "field") setActiveTab("calendar");
      else if (r === "ceo") setActiveTab("members");
    }
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

  // 뒤로가기 처리 - 모달/탭 열 때 pushState, popstate에서 닫기
  const prevTabRef = useRef<TabMode>("calendar");
  const detailBackRef = useRef<(() => boolean) | null>(null);
  const stateRef = useRef({
    detailSchedule: null as Schedule | null,
    showDayPopup: false,
    showNotifications: false,
    showScheduleForm: false,
    showMemberManager: false,
    showAdminPanel: false,
    showSearch: false,
    showMemberFilter: false,
    profileUser: null as User | null,
    activeTab: "calendar" as TabMode,
  });

  stateRef.current = {
    detailSchedule, showDayPopup, showNotifications, showScheduleForm,
    showMemberManager, showAdminPanel, showSearch, showMemberFilter,
    profileUser, activeTab,
  };

  // 해시 라우팅: 스택으로 정확한 앞으로/뒤로 구분
  const hashStackRef = useRef<string[]>([]);

  const pushHash = useCallback((tag: string) => {
    const id = `${tag}-${Date.now()}`;
    hashStackRef.current.push(id);
    window.location.hash = id;
  }, []);

  // 직접 닫기 시 해시 스택에서 1개 제거 + history.back()으로 해시 소비
  const consumeHash = useCallback(() => {
    if (hashStackRef.current.length > 0) {
      hashStackRef.current.pop();
      // history.back()은 hashchange를 트리거하므로, 이미 닫힌 상태에서 doBack이 또 호출되지 않도록
      // 스택에서 먼저 pop하고, 해시만 정리
      if (hashStackRef.current.length === 0) {
        history.replaceState(null, "", window.location.pathname);
      } else {
        // 이전 해시로 돌아가기
        history.replaceState(null, "", `#${hashStackRef.current[hashStackRef.current.length - 1]}`);
      }
    }
  }, []);

  const openModal = useCallback((setter: (v: boolean) => void) => {
    pushHash("m");
    setter(true);
  }, [pushHash]);

  const openDetailSchedule = useCallback((s: Schedule | null) => {
    if (s) pushHash("d");
    setDetailSchedule(s);
  }, [pushHash]);

  const openProfileUser = useCallback((u: User | null) => {
    if (u) pushHash("p");
    setProfileUser(u);
  }, [pushHash]);

  const tabHashPushed = useRef(false);
  const switchTab = useCallback((tab: TabMode) => {
    if (tab !== stateRef.current.activeTab) {
      prevTabRef.current = stateRef.current.activeTab;
      if (!tabHashPushed.current) {
        // 첫 탭 이동만 해시 push (뒤로가기 1번으로 달력 복귀)
        pushHash("t");
        tabHashPushed.current = true;
      } else {
        // 이후 탭 이동은 replace (해시 스택 안 쌓임)
        const id = `t-${Date.now()}`;
        hashStackRef.current[hashStackRef.current.length - 1] = id;
        history.replaceState(null, "", `#${id}`);
      }
      setActiveTab(tab);
      setShowMemberFilter(false);
    }
  }, [pushHash]);

  // ★ 뒤로가기 + 당겨서 새로고침 방지

  useEffect(() => {
    // 당겨서 새로고침 차단 (CSS only)
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";

    const doBack = (): boolean => {
      const s = stateRef.current;
      if (s.detailSchedule) {
        if (detailBackRef.current && detailBackRef.current()) return true;
        setDetailSchedule(null); return true;
      }
      if (s.showDayPopup) { setShowDayPopup(false); return true; }
      if (s.showNotifications) { setShowNotifications(false); return true; }
      if (s.showScheduleForm) { setShowScheduleForm(false); setEditingSchedule(null); return true; }
      if (s.showMemberManager) { setShowMemberManager(false); return true; }
      if (s.showAdminPanel) { setShowAdminPanel(false); return true; }
      if (s.showSearch) { setShowSearch(false); return true; }
      if (s.showMemberFilter) { setShowMemberFilter(false); return true; }
      if (s.profileUser) { setProfileUser(null); return true; }
      if (s.activeTab !== "calendar") { setActiveTab("calendar"); tabHashPushed.current = false; return true; }
      return false; // 아무것도 안 열려있음
    };

    // 종료 확인 팝업
    const handleBackPress = () => {
      const handled = doBack();
      if (!handled) {
        // 아무것도 안 열려있음 → 종료 확인
        if (confirm("앱을 종료하시겠습니까?")) {
          return false; // 종료 허용
        }
        return true; // 종료 방지
      }
      return true;
    };

    // 1. Capacitor 네이티브 뒤로가기 (APK에서 동작)
    let capCleanup: (() => void) | null = null;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("backButton", () => {
          const prevent = handleBackPress();
          if (!prevent) App.exitApp();
        });
        capCleanup = () => listener.remove();
      } catch { /* Capacitor 없으면 무시 */ }
    })();

    // 2. Navigation API (Chrome PWA)
    const nav = (window as unknown as Record<string, unknown>).navigation as {
      addEventListener(t: string, fn: (e: Record<string, unknown>) => void): void;
      removeEventListener(t: string, fn: (e: Record<string, unknown>) => void): void;
    } | undefined;
    const onNav = (e: Record<string, unknown>) => {
      if (e.navigationType === "traverse" && e.canIntercept) {
        const shouldPrevent = handleBackPress();
        if (shouldPrevent) {
          // 앱 유지 → intercept
          (e.intercept as (o: { handler: () => Promise<void> }) => void)({
            handler: async () => {}
          });
        }
        // shouldPrevent=false → intercept 안 함 → 브라우저가 앱 종료
      }
    };
    if (nav) nav.addEventListener("navigate", onNav);

    // 3. 해시 벽 + hashchange/popstate fallback
    if (!window.location.hash || window.location.hash === "#") {
      history.replaceState(null, "", "#home");
    }
    const onHashPop = () => {
      const h = window.location.hash;
      if (!h || h === "#") {
        const prevent = handleBackPress();
        if (prevent) history.pushState(null, "", "#home");
        return;
      }
      const current = h.slice(1);
      const top = hashStackRef.current[hashStackRef.current.length - 1];
      if (current === top) return;
      if (hashStackRef.current.length > 0) hashStackRef.current.pop();
      doBack();
    };
    window.addEventListener("hashchange", onHashPop);
    window.addEventListener("popstate", onHashPop);

    return () => {
      capCleanup?.();
      if (nav) nav.removeEventListener("navigate", onNav);
      window.removeEventListener("hashchange", onHashPop);
      window.removeEventListener("popstate", onHashPop);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 스플래시: 1초, 로고 이미지 배경과 동일 색상
  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <img src="/logo.jpg" alt="새집느낌" className="w-64 h-64 object-contain" loading="eager" />
        <span className="text-2xl font-bold text-[#3a9ad9] mt-2 tracking-wider">파트너</span>
      </div>
    );
  }
  if (!appReady) return null;

  // Login gate - must be AFTER all hooks
  if (!currentUser) {
    return <LoginPage onLogin={(user) => {
      localStorage.setItem("currentUser", JSON.stringify(user));
      setCurrentUser(user);
    }} />;
  }

  const role = currentUser.role;
  const isAdmin = role === "ceo" || role === "scheduler";
  const canSales = role === "ceo" || role === "sales";
  const canAssign = role === "ceo" || role === "scheduler" || role === "sales";
  const canManage = role === "ceo" || role === "sales" || role === "field" || role === "scheduler";
  const canManageAdvanced = role === "ceo";

  // Members — 낙관적 업데이트
  async function handleAddMember(data: { name: string; phone: string; availableDays: number[] }) {
    try {
      const newMember = await createMember(data);
      setMembers((prev) => [...prev, newMember]);
    } catch { /* safeFetch가 이미 로깅 */ }
  }
  async function handleUpdateMember(id: string, data: Partial<Member>) {
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, ...data } : m));
    try { await apiUpdateMember(id, data); } catch { /* 낙관적 업데이트 유지 */ }
  }
  async function handleDeleteMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    try { await apiDeleteMember(id); } catch { /* 낙관적 업데이트 유지 */ }
  }

  // Schedules — 낙관적 업데이트
  async function handleSaveSchedule(data: Omit<Schedule, "id" | "status">) {
    setShowScheduleForm(false);
    setEditingSchedule(null);
    consumeHash();
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
    await unassignScheduleApi(id, currentUser?.name || "", reason);
  }
  function handleEditSchedule(schedule: Schedule) {
    setEditingSchedule(schedule);
    openModal(setShowScheduleForm);
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
  const baseCalendarSchedules = canManageAdvanced
    ? schedules
    : schedules.filter((s) =>
        s.memberName === currentUser.name ||
        s.assignedToName === currentUser.name ||
        s.assignedTo === currentUser.id ||
        (myLinkedMember && s.memberId === myLinkedMember.id)
      );
  // 팀원 필터 적용 (현장팀 User ID 기준, 이름으로도 매칭)
  const calendarSchedules = (() => {
    if (!filterActive || selectedMemberIds.size === 0) return baseCalendarSchedules;
    const filterNames = new Set<string>();
    allUsers.filter(u => u.role === "field").forEach(u => {
      if (selectedMemberIds.has(u.id)) filterNames.add(u.name);
    });
    return baseCalendarSchedules.filter((s) =>
      selectedMemberIds.has(s.assignedTo || "") ||
      selectedMemberIds.has(s.memberId) ||
      filterNames.has(s.assignedToName || "") ||
      filterNames.has(s.memberName)
    );
  })();
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const daySchedules = calendarSchedules
    .filter((s) => s.date === dateStr)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="h-[100dvh] bg-white pb-14 flex flex-col overflow-hidden" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      {/* 카카오톡 인앱브라우저 감지 → 외부 브라우저 이동 */}
      {isInApp && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
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
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-6" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <div className="bg-white rounded-2xl p-6 text-center max-w-sm w-full">
            <div className="text-4xl mb-3">📲</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">새집느낌 파트너 설치</h2>
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
              <span className="text-xs">↩</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{alert.title}</div>
                <div className="text-xs opacity-70">{alert.date} · {alert.reason}</div>
              </div>
              <button onClick={() => setReturnAlerts((prev) => prev.filter((a) => a.id !== alert.id))} className="text-white/60 active:text-white ml-1 shrink-0">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
          {returnAlerts.length > 5 && (
            <div className="px-3 py-1 text-xs opacity-80 text-center">+{returnAlerts.length - 5}건 더</div>
          )}
          <button onClick={() => { setReturnAlerts([]); switchTab("assign"); }} className="w-full py-1.5 text-xs font-medium bg-orange-600/50 active:bg-orange-600">
            배정탭에서 처리 →
          </button>
        </div>
      )}
      {/* Compact mobile header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 flex items-center justify-between h-11">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="text-sm font-bold text-gray-800 truncate">새집느낌 파트너</h1>
            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium shrink-0">{currentUser.name}</span>
          </div>
          <div className="flex items-center shrink-0">
            {/* Search */}
            <button
              onClick={() => openModal(setShowSearch)}
              className="p-2 text-gray-400 active:bg-blue-50 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            {/* Member filter - 관리자만 */}
            {canManageAdvanced && activeTab === "calendar" && (
              <button
                onClick={() => { showMemberFilter ? (setShowMemberFilter(false), consumeHash()) : openModal(setShowMemberFilter); }}
                className={`p-2 rounded-lg relative ${showMemberFilter || filterActive ? "text-blue-500 bg-blue-50" : "text-gray-400 active:bg-blue-50"}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                {filterActive && selectedMemberIds.size > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {selectedMemberIds.size}
                  </span>
                )}
              </button>
            )}
            {/* Notification bell */}
            <button
              onClick={() => { if (showDayPopup) { setShowDayPopup(false); consumeHash(); } openModal(setShowNotifications); }}
              className="p-2 text-gray-400 active:bg-yellow-50 rounded-lg relative"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            {/* Admin button */}
            {canManageAdvanced && (
              <button onClick={() => openModal(setShowAdminPanel)} className="p-2 text-gray-400 active:bg-purple-50 rounded-lg">
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

      {/* 팀원 필터 패널 - 달력에서만 */}
      {showMemberFilter && canManageAdvanced && activeTab === "calendar" && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 z-30 max-h-[50vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-700">팀원 필터</span>
            <div className="flex gap-2">
              <button
                onClick={() => { setSelectedMemberIds(new Set()); setFilterActive(false); }}
                className="text-xs text-blue-500 font-medium"
              >
                초기화
              </button>
              <button
                onClick={() => { setShowMemberFilter(false); consumeHash(); }}
                className="text-xs text-gray-400"
              >
                닫기
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {/* 전체 토글 버튼 (개별 클릭처럼 동작) */}
            {(() => {
              const fieldUsers = allUsers.filter(u => u.role === "field");
              const allSelected = fieldUsers.length > 0 && fieldUsers.every(u => selectedMemberIds.has(u.id));
              return (
                <button
                  onClick={() => {
                    if (allSelected) {
                      // 전체 해제 → 필터 비활성
                      setSelectedMemberIds(new Set());
                      setFilterActive(false);
                    } else {
                      // 전체 선택
                      setSelectedMemberIds(new Set(fieldUsers.map(u => u.id)));
                      setFilterActive(true);
                    }
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg active:bg-gray-50 ${allSelected ? "bg-blue-50" : ""}`}
                >
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center border-2 shrink-0"
                    style={{
                      borderColor: "#3B82F6",
                      backgroundColor: allSelected ? "#3B82F6" : "transparent",
                    }}
                  >
                    {allSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-800 font-medium">전체</span>
                </button>
              );
            })()}
            {/* 현장팀 사용자 목록 */}
            {allUsers.filter(u => u.role === "field").map((u) => {
              const uid = u.id;
              const isSelected = selectedMemberIds.has(uid);
              const colors = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];
              const colorIdx = allUsers.filter(x => x.role === "field").indexOf(u);
              const userColor = colors[colorIdx % colors.length];
              return (
                <button
                  key={uid}
                  onClick={() => {
                    setSelectedMemberIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(uid)) next.delete(uid);
                      else next.add(uid);
                      setFilterActive(next.size > 0);
                      return next;
                    });
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg active:bg-gray-50 ${isSelected ? "bg-gray-50" : ""}`}
                >
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center border-2 shrink-0"
                    style={{
                      borderColor: userColor,
                      backgroundColor: isSelected ? userColor : "transparent",
                    }}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-800">{u.name}</span>
                </button>
              );
            })}
          </div>
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
      <main className="flex-1 overflow-hidden">
        {/* Calendar tab - 삼성 캘린더 스타일 */}
        {/* 모든 탭 항상 마운트, display로 전환 → 즉시 전환 */}
        <div className="h-full" style={{ display: activeTab === "calendar" ? "block" : "none" }}>
          <Calendar
            schedules={calendarSchedules}
            members={members}
            selectedDate={selectedDate}
            onSelectDate={(d) => { setSelectedDate(d); pushHash("day"); setShowDayPopup(true); }}
            onScheduleClick={(s) => { setDetailSchedule(s); setDetailMode("calendar"); pushHash("detail"); }}
            onMonthChange={(d) => loadData(d)}
          />
        </div>

        <div className="h-full" style={{ display: activeTab === "manage" ? "block" : "none" }}>
          <ManageTab
            isAdmin={canManageAdvanced}
            userRole={role}
            userName={currentUser.name}
            allUsers={allUsers.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role }))}
            members={members.map(m => ({ id: m.id, name: m.name, linkedUsername: m.linkedUsername }))}
            onRefresh={() => loadData(undefined, true)}
          />
        </div>

        {canAssign && (
          <div className="h-full" style={{ display: activeTab === "assign" ? "block" : "none" }}>
            <AssignTab members={members} schedules={unassignedSchedules} onAssigned={(scheduleId, memberId, memberName) => {
              // 낙관적 업데이트: 즉시 UI 반영
              const target = unassignedSchedules.find((s) => s.id === scheduleId);
              if (target) {
                // 배정탭에서 제거
                setUnassignedSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
                // 달력에 추가 (제목 그대로 유지)
                setSchedules((prev) => [...prev, { ...target, memberId, memberName, status: "confirmed" as const }]);
              }
              // API는 백그라운드 (안 기다림)
              assignScheduleApi(scheduleId, memberId, memberName);
            }} onDeleted={(id) => {
              setUnassignedSchedules((prev) => prev.filter((s) => s.id !== id));
            }} onOpenDetail={(s) => {
              setDetailMode("assign");
              openDetailSchedule(s);
            }} />
          </div>
        )}

        {/* 사용자 탭 */}
        <div className="h-full overflow-y-auto" style={{ display: activeTab === "members" ? "block" : "none" }}>
          <div className="p-3 space-y-3 pb-20">
            {/* 전체 사용자 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-bold text-gray-800 mb-3">사용자 ({allUsers.filter(u => u.username !== "admin").length}{canManageAdvanced && pendingUsers.length > 0 ? ` + 대기 ${pendingUsers.length}` : ""})</h3>
              <div className="space-y-2.5">
                {[...allUsers, ...(canManageAdvanced ? pendingUsers : [])].filter(u => u.username !== "admin").sort((a, b) => {
                  if (a.username === currentUser.username) return -1;
                  if (b.username === currentUser.username) return 1;
                  return 0;
                }).map((u) => {
                  const isMe = u.username === currentUser.username;
                  const roleLabels: Record<string, string> = { ceo: "대표", scheduler: "일정관리자", sales: "영업팀", field: "현장팀", pending: "대기" };
                  const roleColors: Record<string, string> = { ceo: "bg-purple-100 text-purple-700", scheduler: "bg-blue-100 text-blue-700", sales: "bg-green-100 text-green-700", field: "bg-orange-100 text-orange-700", pending: "bg-gray-100 text-gray-500" };
                  return (
                    <div key={u.id} className={`border rounded-xl p-3 ${isMe ? "border-blue-300 bg-blue-50/30" : u.status === "pending" ? "border-orange-300 bg-orange-50/30" : "border-gray-200"}`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${isMe ? "bg-blue-500 text-white" : u.status === "pending" ? "bg-orange-200 text-orange-700" : "bg-blue-100 text-blue-600"}`}>{u.name[0]}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-gray-800">{u.name}</span>
                            {isMe && <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500 text-white">본인</span>}
                            {u.status === "pending"
                              ? <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">승인대기</span>
                              : <span className={`text-xs px-1.5 py-0.5 rounded-full ${roleColors[u.role] || "bg-gray-100 text-gray-500"}`}>{roleLabels[u.role] || u.role}</span>
                            }
                          </div>
                          <div className="text-xs text-gray-400">{u.phone || "연락처 없음"}</div>
                          {u.branch && <div className="text-xs text-gray-400">{u.branch}[관리점]</div>}
                        </div>
                      </div>
                      {/* 관리 버튼 - 대표만 */}
                      {canManageAdvanced && !isMe && u.status !== "pending" && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                          <select
                            value={u.role}
                            onChange={async (e) => {
                              const newRole = e.target.value as UserRole;
                              setAllUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x));
                              await changeUserRoleApi(u.id, newRole);
                            }}
                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none bg-white"
                          >
                            <option value="field">현장팀</option>
                            <option value="sales">영업팀</option>
                            <option value="scheduler">일정관리자</option>
                            <option value="ceo">대표</option>
                          </select>
                          <button onClick={() => openProfileUser(u)} className="p-1.5 active:bg-gray-100 rounded-lg border border-gray-200">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </button>
                          <button onClick={() => {
                            if (!confirm(u.name + "님을 탈퇴시키겠습니까?")) return;
                            setAllUsers(prev => prev.filter(x => x.id !== u.id));
                            deleteUserApi(u.id).then(() => loadData(undefined, true));
                          }} className="p-1.5 active:bg-red-50 rounded-lg border border-gray-200">
                            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      )}
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
          <div className="h-full flex flex-col" style={{ display: activeTab === "sales" ? "flex" : "none" }}>
            <SalesTab userName={currentUser.name} onCreated={() => loadData(undefined, true)} />
          </div>
        )}
      </main>


      {/* Bottom tab bar - mobile style */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
          {/* 영업 */}
          {canSales && (
            <button
              onClick={() => switchTab("sales")}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full ${
                activeTab === "sales" ? "text-blue-500" : "text-gray-400"
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === "sales" ? 2.5 : 1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs font-medium">영업</span>
            </button>
          )}

          {/* 배정 */}
          {canAssign && (
            <button
              onClick={() => switchTab("assign")}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full ${
                activeTab === "assign" ? "text-blue-500" : "text-gray-400"
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === "assign" ? 2.5 : 1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-xs font-medium">배정</span>
            </button>
          )}

          {/* 달력 */}
          <button
            onClick={() => switchTab("calendar")}
            className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full ${
              activeTab === "calendar" ? "text-blue-500" : "text-gray-400"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === "calendar" ? 2.5 : 1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-medium">달력</span>
          </button>

          {/* 사용자 */}
          <button
            onClick={() => switchTab("members")}
            className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full ${
              activeTab === "members" ? "text-blue-500" : "text-gray-400"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === "members" ? 2.5 : 1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs font-medium">사용자</span>
          </button>

          {/* 관리 */}
          {canManage && (
          <button
            onClick={() => switchTab("manage")}
            className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full ${
              activeTab === "manage" ? "text-blue-500" : "text-gray-400"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === "manage" ? 2.5 : 1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span className="text-xs font-medium">{canManageAdvanced ? "관리" : "더보기"}</span>
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
          onCancel={() => { setShowScheduleForm(false); setEditingSchedule(null); consumeHash(); }}
        />
      )}
      {showMemberManager && (
        <MemberManager
          members={members}
          onAdd={handleAddMember}
          onUpdate={handleUpdateMember}
          onDelete={handleDeleteMember}
          onClose={() => { setShowMemberManager(false); consumeHash(); }}
        />
      )}
      {showSwapPanel && (
        <SwapPanel
          swapRequests={swapRequests}
          schedules={schedules}
          members={members}
          onApprove={handleApproveSwap}
          onReject={handleRejectSwap}
          onClose={() => { setShowSwapPanel(false); consumeHash(); }}
        />
      )}
      {showNotifications && (
        <NotificationPanel
          notifications={notifications}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onClearAll={handleClearAllNotifications}
          onClose={() => { setShowNotifications(false); consumeHash(); }}
        />
      )}
      {/* 날짜 클릭 팝업 - 삼성 캘린더 스타일 (달력탭에서만) */}
      {showDayPopup && activeTab === "calendar" && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-5" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }} onClick={(e) => { if (e.target === e.currentTarget) { setShowDayPopup(false); consumeHash(); } }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[380px] animate-[modalIn_0.15s_ease-out]">
            {/* 날짜 헤더 */}
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{format(selectedDate, "d")}</span>
                <span className="text-sm text-gray-500">{format(selectedDate, "EEEE", { locale: ko })}</span>
              </div>
              <button
                onClick={() => { setShowDayPopup(false); consumeHash(); setEditingSchedule(null); openModal(setShowScheduleForm); }}
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
                      onClick={() => { setShowDayPopup(false); swapMode ? (consumeHash(), handleSwapSelect(s)) : (() => { setDetailMode("calendar"); /* dayPopup 해시를 detail 해시로 교체 */ if (hashStackRef.current.length > 0) hashStackRef.current.pop(); setDetailSchedule(s); pushHash("d"); })(); }}
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
          allUsers={allUsers.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role }))}
          onRegisterBackHandler={(fn) => { detailBackRef.current = fn; }}
          memberBranch={allUsers.find(u => u.name === (detailSchedule?.memberName))?.branch || ""}
          onEdit={(s) => { setDetailSchedule(null); consumeHash(); handleEditSchedule(s); }}
          onDelete={(id) => { handleDeleteSchedule(id); setDetailSchedule(null); consumeHash(); }}
          onUnassign={(id, reason) => { handleUnassignSchedule(id, reason); setDetailSchedule(null); consumeHash(); }}
          onAssign={(scheduleId, memberId, memberName) => {
            const target = unassignedSchedules.find((s) => s.id === scheduleId);
            if (target) {
              setUnassignedSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
              setSchedules((prev) => [...prev, { ...target, memberId, memberName, status: "confirmed" as const }]);
            }
            assignScheduleApi(scheduleId, memberId, memberName);
            setDetailSchedule(null);
            consumeHash();
          }}
          onClose={() => { setDetailSchedule(null); consumeHash(); }}
          onUpdated={() => {
            // 전체 리로드 대신 해당 일정만 로컬 갱신
            if (detailSchedule) {
              setSchedules(prev => prev.map(s => s.id === detailSchedule.id ? { ...detailSchedule } : s));
            }
          }}
        />
      )}
      {showAdminPanel && (
        <AdminPanel onClose={() => { setShowAdminPanel(false); consumeHash(); }} onRefresh={() => loadData(undefined, true)} />
      )}
      {showSearch && (
        <SearchPanel
          onSelectSchedule={(s) => { setShowSearch(false); consumeHash(); setDetailMode("calendar"); openDetailSchedule(s); }}
          onClose={() => { setShowSearch(false); consumeHash(); }}
        />
      )}
      {/* 신상정보 팝업 */}
      {profileUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-6" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }} onClick={(e) => { if (e.target === e.currentTarget) { setProfileUser(null); consumeHash(); } }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-[modalIn_0.15s_ease-out]">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800">신상정보</h3>
              <button onClick={() => { setProfileUser(null); consumeHash(); }} className="p-1 active:bg-gray-100 rounded-lg">
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
