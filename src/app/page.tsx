"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Member, Schedule, SwapRequest, Notification as AppNotification, User, UserRole } from "@/types";
type Notification = AppNotification;
import Calendar from "@/components/Calendar";
import LoginPage from "@/components/LoginPage";

// 동적 로딩 - 필요할 때만 로드
const ScheduleDetail = dynamic(() => import("@/components/ScheduleDetail"), { ssr: false });
const ScheduleForm = dynamic(() => import("@/components/ScheduleForm"), { ssr: false });
const MemberManager = dynamic(() => import("@/components/MemberManager"), { ssr: false });
const SwapPanel = dynamic(() => import("@/components/SwapPanel"), { ssr: false });
const NotificationPanel = dynamic(() => import("@/components/NotificationPanel"), { ssr: false });
const AdminPanel = dynamic(() => import("@/components/AdminPanel"), { ssr: false });
const AssignTab = dynamic(() => import("@/components/AssignTab"), { ssr: false });
const SearchPanel = dynamic(() => import("@/components/SearchPanel"), { ssr: false });
const ManageTab = dynamic(() => import("@/components/ManageTab"), { ssr: false });
const SalesTab = dynamic(() => import("@/components/SalesTab"), { ssr: false });
const BranchMapSection = dynamic(() => import("@/components/ManageTab").then(m => ({ default: m.BranchMap })), { ssr: false });
import { sbClient } from "@/lib/supabase-client";
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
  fetchUsers,
  approveUserApi,
  rejectUserApi,
  changeUserRoleApi,
  deleteUserApi,
  updateUserInfoApi,
} from "@/lib/api";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { showAlert, showConfirm } from "@/lib/dialog";
import { ko } from "date-fns/locale";

type TabMode = "calendar" | "manage" | "assign" | "members" | "sales" | "area";

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [appReady, setAppReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // 클라이언트에서만 localStorage 복원 + 캐시 즉시 로드
  useEffect(() => {
    let hasCachedData = false;
    try {
      const saved = localStorage.getItem("currentUser");
      if (saved) setCurrentUser(JSON.parse(saved));
      const cm = localStorage.getItem("cached_members");
      if (cm) { setMembers(JSON.parse(cm)); hasCachedData = true; }
      const cs = localStorage.getItem("cached_schedules");
      if (cs) { setSchedules(JSON.parse(cs)); hasCachedData = true; }
      const cu = localStorage.getItem("cached_users");
      if (cu) { const d = JSON.parse(cu); setAllUsers(d.users || []); setPendingUsers(d.pendingUsers || []); hasCachedData = true; }
    } catch {}
    // 캐시 있으면 즉시, 없을 땐 아주 짧게만. 인위적 지연은 체감 로딩 속도의 주범.
    if (hasCachedData) {
      setShowSplash(false);
      setAppReady(true);
      return;
    }
    const t = setTimeout(() => {
      setShowSplash(false);
      setAppReady(true);
    }, 200);
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
  const [userOrder, setUserOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { const s = localStorage.getItem("userOrder"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const defaults = { self: false, ceo: false, admin: false, scheduler: false, sales: false, field: false, pending: false };
    if (typeof window === "undefined") return defaults;
    try { const s = localStorage.getItem("userGroupsOpen"); return s ? JSON.parse(s) : defaults; } catch { return defaults; }
  });
  function toggleGroup(key: string) {
    setOpenGroups(prev => { const next = { ...prev, [key]: !prev[key] }; localStorage.setItem("userGroupsOpen", JSON.stringify(next)); return next; });
  }
  const [dragUserId, setDragUserId] = useState<string | null>(null);
  const [membersSubTab, setMembersSubTab] = useState<"users" | "map">("users");
  const [dragOverUserId, setDragOverUserId] = useState<string | null>(null);
  const dragStartY = useRef(0);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [showDayPopup, setShowDayPopup] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showMemberFilter, setShowMemberFilter] = useState(false);
  // 필터 상태는 사용자별 분리 (localStorage 키에 username 포함) - 로그인 후 로드
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set<string>());
  const [filterActive, setFilterActive] = useState(false);
  const filterLoadedRef = useRef(false);
  const [returnAlerts, setReturnAlerts] = useState<{ id: string; title: string; date: string; reason: string }[]>([]);
  // 알림 액션 중엔 외부 reload 억제 (모두읽음/지우기 깜빡임 방지)
  const notifReloadSuppressRef = useRef(0);
  // 일정 액션(생성/수정/반환/삭제) 중엔 schedule reload 억제 (낙관적 업데이트 보호)
  const scheduleReloadSuppressRef = useRef(0);
  // 현재 달력에서 보고 있는 월 (selectedDate 와 별개, 스크롤 시 변경)
  // Realtime reload 가 이 달 기준으로 ±1 달 범위 fetch → 먼 달로 스크롤해도 안 깜빡임
  const viewingMonthRef = useRef<Date>(new Date());
  // 로컬에서 삭제한 알림 ID - 재동기화 시 다시 나타나지 않게
  // 사용자별 localStorage 로 영구 보존 (DB 공용이라 공유되는 것 방지)
  const deletedNotifIdsRef = useRef<Set<string>>(new Set<string>());
  // 배너에서 X 로 닫은 반환 알림 ID - 재동기화 시 다시 뜨지 않게
  const dismissedReturnIdsRef = useRef<Set<string>>(new Set<string>());
  // 로컬 읽음 처리 ID (DB 공용 read 상태와 분리 - 사용자별)
  const localReadIdsRef = useRef<Set<string>>(new Set<string>());
  // 알림 숨김/읽음 로딩 완료 여부
  const notifHiddenLoadedRef = useRef(false);

  // 상태 ref — 콜백 안에서 항상 최신 상태 읽기 (useCallback 을 안정 deps 로 유지하기 위함)
  const unassignedSchedulesRef = useRef<Schedule[]>([]);
  const schedulesRef = useRef<Schedule[]>([]);
  const currentUserRef = useRef<User | null>(null);
  // 월 이동 race 방어: 마지막으로 시작된 fetch 의 seq 만 setSchedules 허용.
  // 예) 4월→5월→4월 빠르게 클릭하면 먼저 쏜 4월 응답이 5월 응답을 덮어써 깜빡이는 현상 방지.
  const loadSeqRef = useRef(0);

  const loadData = useCallback(async (monthDate?: Date, fullRefresh = false) => {
    const seq = ++loadSeqRef.current;
    try {
      // 우선순위: 명시적 monthDate > 현재 보고 있는 달력 월 > selectedDate
      const d = monthDate || viewingMonthRef.current || selectedDate;
      // 다음 reload 들도 동일 월 기준으로 찾게 ref 업데이트
      viewingMonthRef.current = d;
      // ±3개월 range — 월 스와이프 시 대부분의 탐색이 캐시 히트. 첫 로드는 조금 더 받지만 이후 즉시.
      const start = format(startOfMonth(subMonths(d, 3)), "yyyy-MM-dd");
      const end = format(endOfMonth(addMonths(d, 3)), "yyyy-MM-dd");

      if (fullRefresh) {
        const [m, rangeScheds, unassignedScheds, sw, notif, usersData] = await Promise.all([
          fetchMembers(),
          fetchSchedules(start, end),
          fetchUnassignedSchedules(),
          fetchSwapRequests(),
          fetchNotifications(),
          fetchUsers(),
        ]);
        // stale 응답이면 schedule 관련은 덮어쓰지 않음 (월 이동 race)
        const isStale = seq !== loadSeqRef.current;
        setMembers(m);
        // 일정 액션 중이거나 stale 이면 schedule 덮어쓰지 않음
        if (!isStale && Date.now() >= scheduleReloadSuppressRef.current) {
          setSchedules(rangeScheds);
          setUnassignedSchedules(unassignedScheds);
        }
        setSwapRequests(sw);
        // 알림 액션(모두읽음/지우기) 직후엔 loadData 결과로 덮어쓰지 않음 (깜빡임 방지)
        if (Date.now() >= notifReloadSuppressRef.current) {
          // 알림 필터:
          // - 가입 시점 이전 알림은 신규 가입자에게 안 보여줌 (누적된 히스토리 제외)
          // - system_notice: 모두
          // - 일정 반환: 대표/admin/일정관리자/영업팀 (현장팀 제외)
          // - 그 외: 본인 이름 포함된 것만 (현장팀 포함)
          const allNotifs = notif.notifications as Notification[];
          const uName = currentUser?.name || "";
          const uRole = currentUser?.role || "";
          const uCreatedAt = currentUser?.createdAt || "";
          const deleted = deletedNotifIdsRef.current;
          const isReturn = (n: Notification) => n.type === "schedule_returned" || n.title === "일정 반환";
          const isAdminOrScheduler = uRole === "ceo" || uRole === "admin" || uRole === "scheduler";
          const localRead = localReadIdsRef.current;
          const myNotifs = allNotifs.filter(n => {
            if (deleted.has(n.id)) return false;
            // 가입 이전 알림 제외 (ISO 날짜 문자열 비교)
            if (uCreatedAt && n.createdAt && n.createdAt < uCreatedAt) return false;
            if (n.type === "system_notice") return true; // 전체공지는 모두(영업 포함)
            if (uRole === "sales") return false; // 영업: 전체공지 외 모두 제외
            if (isReturn(n)) {
              if (isAdminOrScheduler) return true;
              if (uName && n.message.includes(uName)) return true;
              return false;
            }
            if (n.type === "happy_call_reminder") return isAdminOrScheduler;
            if (isAdminOrScheduler) return true;
            return uName && (n.message.includes(uName) || n.title.includes(uName));
          }).map(n => localRead.has(n.id) ? { ...n, read: true } : n);
          setNotifications(myNotifs);
          setUnreadCount(myNotifs.filter(n => !n.read).length);
        }
        setAllUsers(usersData.users);
        setPendingUsers(usersData.pendingUsers);
        // 캐시 저장 — 비동기로 (메인 스레드 양보, 대용량 JSON.stringify 지연 숨김)
        setTimeout(() => {
          try {
            localStorage.setItem("cached_members", JSON.stringify(m));
            localStorage.setItem("cached_users", JSON.stringify(usersData));
            // schedules 캐시는 최근 3개월분만 (과거 1달 / 미래 2달) — WebView JSON.parse 부담 경감
            const todayMs = Date.now();
            const minMs = todayMs - 31 * 24 * 60 * 60 * 1000;
            const maxMs = todayMs + 62 * 24 * 60 * 60 * 1000;
            const trimmed = rangeScheds.filter((s) => {
              const t = Date.parse(s.date);
              return !Number.isNaN(t) && t >= minMs && t <= maxMs;
            });
            localStorage.setItem("cached_schedules", JSON.stringify(trimmed));
          } catch {}
        }, 0);
      } else {
        const rangeScheds = await fetchSchedules(start, end);
        if (seq !== loadSeqRef.current) return; // stale 응답 무시
        if (Date.now() >= scheduleReloadSuppressRef.current) {
          setSchedules(rangeScheds);
        }
      }
    } catch {
      // 데이터 로드 실패 - 자동 재시도됨
    }
  }, [selectedDate]);

  // 필터 상태: 로그인한 사용자별로 localStorage 분리
  useEffect(() => {
    if (!currentUser) return;
    const key = `filter_v2_${currentUser.username}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSelectedMemberIds(new Set(parsed.members || []));
        setFilterActive(Boolean(parsed.active));
      } else {
        setSelectedMemberIds(new Set<string>());
        setFilterActive(false);
      }
    } catch {
      setSelectedMemberIds(new Set<string>());
      setFilterActive(false);
    }
    filterLoadedRef.current = true;
  }, [currentUser?.username]); // eslint-disable-line react-hooks/exhaustive-deps

  // 필터 변경 시 사용자별 키로 저장 (초기 로드 전엔 저장 안 함)
  useEffect(() => {
    if (!currentUser || !filterLoadedRef.current) return;
    const key = `filter_v2_${currentUser.username}`;
    localStorage.setItem(key, JSON.stringify({
      members: [...selectedMemberIds],
      active: filterActive,
    }));
  }, [selectedMemberIds, filterActive, currentUser]);

  // 알림 숨김 목록 & 로컬 읽음 상태: 사용자별 localStorage (DB 공용이라 분리 필요)
  useEffect(() => {
    if (!currentUser) return;
    const hKey = `notif_hidden_${currentUser.username}`;
    const rKey = `notif_localread_${currentUser.username}`;
    try {
      const h = localStorage.getItem(hKey);
      deletedNotifIdsRef.current = h ? new Set(JSON.parse(h)) : new Set();
    } catch { deletedNotifIdsRef.current = new Set(); }
    try {
      const r = localStorage.getItem(rKey);
      localReadIdsRef.current = r ? new Set(JSON.parse(r)) : new Set();
    } catch { localReadIdsRef.current = new Set(); }
    notifHiddenLoadedRef.current = true;
  }, [currentUser?.username]); // eslint-disable-line react-hooks/exhaustive-deps

  function persistNotifHidden() {
    if (!currentUser) return;
    localStorage.setItem(`notif_hidden_${currentUser.username}`, JSON.stringify(Array.from(deletedNotifIdsRef.current)));
  }
  function persistLocalRead() {
    if (!currentUser) return;
    localStorage.setItem(`notif_localread_${currentUser.username}`, JSON.stringify(Array.from(localReadIdsRef.current)));
  }

  // 초기 로딩: 백그라운드로 최신 데이터 갱신 (캐시는 이미 위에서 복원됨)
  // loadData 내부에서 schedules 캐시도 저장하므로 중복 fetch 안 함.
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

  // 푸시 알림 등록
  useEffect(() => {
    if (!currentUser) return;
    // 토글 OFF 여도 구독은 등록하되 enabled=false 로 저장 → 서버가 발송 대상에서 제외
    const notificationsEnabled = localStorage.getItem("notificationsEnabled") !== "false";

    async function registerNativePush() {
      // Capacitor 네이티브 APK: FCM 기반 (백그라운드에서도 수신 가능)
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return false;
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const status = await PushNotifications.checkPermissions();
        let receive = status.receive;
        if (receive === "prompt" || receive === "prompt-with-rationale") {
          const res = await PushNotifications.requestPermissions();
          receive = res.receive;
        }
        if (receive !== "granted") { console.log("[FCM] 권한 거절"); return true; }
        await PushNotifications.removeAllListeners();
        // 알림 채널 생성 — 잠금화면/Doze 모드에서도 진동+소리 울리도록 importance: 5 (HIGH)
        // 이미 동일 id 채널이 있으면 무시됨. 사용자가 수동으로 설정에서 알림 토글 끈 건 유지.
        try {
          await PushNotifications.createChannel({
            id: "default",
            name: "새집느낌 파트너",
            description: "일정 배정 · 반환 · 알림",
            importance: 5, // IMPORTANCE_HIGH
            visibility: 1, // VISIBILITY_PUBLIC
            sound: "default",
            vibration: true,
            lights: true,
            lightColor: "#3a9ad9",
          });
        } catch (e) { console.warn("[FCM] createChannel 실패 (구 Android 일 수 있음):", e); }
        await PushNotifications.register();
        PushNotifications.addListener("registration", async (token) => {
          console.log("[FCM] 토큰 획득:", token.value.slice(0, 20) + "...");
          try {
            await fetch("/api/push", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "subscribe-fcm", token: token.value, userId: currentUser?.id, userName: currentUser?.name, enabled: notificationsEnabled }),
            });
          } catch (e) { console.error("[FCM] 서버 저장 실패:", e); }
        });
        PushNotifications.addListener("registrationError", (err) => {
          console.error("[FCM] 등록 실패:", err);
        });
        PushNotifications.addListener("pushNotificationReceived", (notif) => {
          console.log("[FCM] 수신 (앱 포그라운드):", notif);
        });
        PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          console.log("[FCM] 탭 액션:", action);
        });
        return true;
      } catch (e) {
        console.log("[FCM] 플러그인 미사용 (웹 환경)", e);
        return false;
      }
    }

    async function registerWebPush() {
      // 웹/PWA: Web Push API
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) { console.log("[Push] SW/PushManager 미지원"); return; }
        const permission = await Notification.requestPermission();
        console.log("[Push] 권한:", permission);
        if (permission !== "granted") return;
        const reg = await navigator.serviceWorker.ready;
        const vapidKey = "BIFAj9bQTWPRvMdMvDc5RTF4Qyof08lZR2SkI3vHwmhmUZwWbVJt7_SKEczBy_9ul88kmvfmqzr14-TecTwRBwc";
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey });
        }
        console.log("[Push] 구독 완료:", sub.endpoint.slice(0, 50));
        await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "subscribe", subscription: sub.toJSON(), userId: currentUser?.id, userName: currentUser?.name, enabled: notificationsEnabled }),
        });
      } catch (e) { console.error("[Push] 실패:", e); }
    }

    (async () => {
      const registeredNative = await registerNativePush();
      if (!registeredNative) await registerWebPush();
    })();

    // SW에 알림 ON/OFF 상태 전달
    navigator.serviceWorker?.ready.then(reg => {
      const enabled = localStorage.getItem("notificationsEnabled") !== "false";
      reg.active?.postMessage({ type: "SET_NOTIFICATIONS_ENABLED", enabled });
    }).catch(() => {});
  }, [currentUser]);

  // Realtime + 경량 폴링 (알림만 30초, 일정은 Realtime으로)
  useEffect(() => {
    if (!currentUser) return;
    const uName = currentUser?.name || "";
    const uRole = currentUser?.role || "";

    function reloadSchedules() {
      // 일정 액션(반환/배정/생성/수정/삭제) 중엔 억제 - 낙관적 업데이트가 stale fetch 에 덮이는 것 방지
      if (Date.now() < scheduleReloadSuppressRef.current) return;
      // 현재 보고 있는 달력 월 기준 (스크롤해서 먼 달 보고 있어도 해당 월 데이터 유지)
      // loadData 와 동일하게 ±3개월 range — realtime reload 가 범위를 좁혀서 캐시가 축소되는 것 방지
      const d = viewingMonthRef.current || selectedDate;
      const start = format(startOfMonth(subMonths(d, 3)), "yyyy-MM-dd");
      const end = format(endOfMonth(addMonths(d, 3)), "yyyy-MM-dd");
      const seq = ++loadSeqRef.current;
      fetchSchedules(start, end).then(s => {
        if (seq !== loadSeqRef.current) return; // 더 최근 fetch 가 있으면 stale 응답 버림
        if (Date.now() < scheduleReloadSuppressRef.current) return;
        setSchedules(s);
      }).catch(() => {});
      fetchUnassignedSchedules().then(s => {
        // unassigned 는 월 범위 안 타므로 seq 가드 생략
        if (Date.now() < scheduleReloadSuppressRef.current) return;
        setUnassignedSchedules(s);
      }).catch(() => {});
    }
    function reloadNotifications() {
      // 알림 액션 중이면 reload 억제
      if (Date.now() < notifReloadSuppressRef.current) return;
      fetchNotifications().then(notif => {
        // fetch 응답 도착 시점에도 재확인 (in-flight 중 액션 발생 케이스 방어)
        if (Date.now() < notifReloadSuppressRef.current) return;
        const allNotifs = notif.notifications as Notification[];
        const uCreatedAt = currentUser?.createdAt || "";
        const deleted = deletedNotifIdsRef.current;
        const isReturn = (n: Notification) => n.type === "schedule_returned" || n.title === "일정 반환";
        const isAdminOrScheduler = uRole === "ceo" || uRole === "admin" || uRole === "scheduler";
        const localRead = localReadIdsRef.current;
        const myNotifs = allNotifs.filter(n => {
          if (deleted.has(n.id)) return false;
          // 가입 이전 알림 제외
          if (uCreatedAt && n.createdAt && n.createdAt < uCreatedAt) return false;
          if (n.type === "system_notice") return true; // 전체공지는 모두(영업 포함)
          if (uRole === "sales") return false;
          if (isReturn(n)) {
            if (isAdminOrScheduler) return true;
            if (uName && n.message.includes(uName)) return true;
            return false;
          }
          if (n.type === "happy_call_reminder") return isAdminOrScheduler;
          if (isAdminOrScheduler) return true;
          return uName && (n.message.includes(uName) || n.title.includes(uName));
        }).map(n => localRead.has(n.id) ? { ...n, read: true } : n);
        setNotifications(myNotifs);
        setUnreadCount(myNotifs.filter(n => !n.read).length);
      }).catch(() => {});
    }
    function reloadUsers() {
      fetchUsers().then(d => { setAllUsers(d.users); setPendingUsers(d.pendingUsers); }).catch(() => {});
    }
    function reloadMembers() {
      fetchMembers().then(m => setMembers(m)).catch(() => {});
    }
    function reloadAll() {
      reloadSchedules();
      reloadNotifications();
      reloadUsers();
      reloadMembers();
    }

    // 폴링 인터벌 (Realtime 실패 시에만 활성화)
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    // Realtime 성공 여부 — fallback 에서 "구독된 상태면 폴링 금지" 판정용
    let realtimeConnected = false;
    function startPolling() {
      if (pollInterval) return;
      if (realtimeConnected) return; // 리얼타임 멀쩡한데 폴링 돌리지 말기 (중복 갱신 방지)
      console.log("[RT] 폴링 시작 (Realtime 실패)");
      pollInterval = setInterval(reloadAll, 8000);
    }
    function stopPolling() {
      if (pollInterval) { console.log("[RT] 폴링 중지 (Realtime 복구)"); clearInterval(pollInterval); pollInterval = null; }
    }

    // 이벤트 폭주 방지: 연속 이벤트를 300ms 한 덩어리로 합쳐서 1회만 fetch.
    let schedDebTimer: ReturnType<typeof setTimeout> | null = null;
    let notifDebTimer: ReturnType<typeof setTimeout> | null = null;
    let memberDebTimer: ReturnType<typeof setTimeout> | null = null;
    let userDebTimer: ReturnType<typeof setTimeout> | null = null;
    const debSched = () => {
      if (schedDebTimer) clearTimeout(schedDebTimer);
      schedDebTimer = setTimeout(() => { schedDebTimer = null; reloadSchedules(); }, 300);
    };
    const debNotif = () => {
      if (notifDebTimer) clearTimeout(notifDebTimer);
      notifDebTimer = setTimeout(() => { notifDebTimer = null; reloadNotifications(); }, 300);
    };
    const debMembers = () => {
      if (memberDebTimer) clearTimeout(memberDebTimer);
      memberDebTimer = setTimeout(() => { memberDebTimer = null; reloadMembers(); }, 300);
    };
    const debUsers = () => {
      if (userDebTimer) clearTimeout(userDebTimer);
      userDebTimer = setTimeout(() => { userDebTimer = null; reloadUsers(); }, 300);
    };

    // Supabase Realtime 구독 (즉시 반영, debounce 적용)
    const channel = sbClient.channel("all-db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "schedules" }, () => { console.log("[RT] schedules changed"); debSched(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => { console.log("[RT] notifications changed"); debNotif(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "members" }, () => { console.log("[RT] members changed"); debMembers(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => { console.log("[RT] users changed (가입/승인)"); debUsers(); })
      .subscribe((status: string) => {
        console.log("[RT] status:", status);
        if (status === "SUBSCRIBED") {
          realtimeConnected = true;
          stopPolling();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          realtimeConnected = false;
          startPolling();
        }
      });

    // Realtime 이 오래 안 켜지면(10초 후) 폴링 강제 시작 — 이미 성공했으면 skip.
    const fallbackTimer = setTimeout(() => {
      if (realtimeConnected) return;
      if (!pollInterval) startPolling();
    }, 10000);

    // 앱이 백그라운드 → 포그라운드로 돌아올 때 강제 전체 갱신
    // (Chrome/WebView 는 백그라운드에서 Realtime 연결을 끊음 → 복귀 시 스냅샷 동기화 필요)
    // 단, 직전 낙관적 업데이트(배정/해제/삭제) 보호 구간이면 schedules reload 는 스킵.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() < scheduleReloadSuppressRef.current) {
        console.log("[VIS] 포그라운드 복귀 → schedules 보호중, 그 외만 갱신");
        reloadNotifications();
        reloadUsers();
        reloadMembers();
      } else {
        console.log("[VIS] 포그라운드 복귀 → 전체 갱신");
        reloadAll();
      }
      // Realtime 채널도 재구독 유도
      try {
        (channel as unknown as { state?: string }).state !== "joined" && sbClient.channel("all-db-changes");
      } catch {}
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);

    return () => {
      clearTimeout(fallbackTimer);
      if (schedDebTimer) clearTimeout(schedDebTimer);
      if (notifDebTimer) clearTimeout(notifDebTimer);
      if (memberDebTimer) clearTimeout(memberDebTimer);
      if (userDebTimer) clearTimeout(userDebTimer);
      stopPolling();
      sbClient.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [currentUser, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // PWA 서비스워커 등록 + 설치 배너
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInApp, setIsInApp] = useState(false);

  // APK 자동 업데이트 체크 — Capacitor 앱에서만. 웹/PWA 는 Vercel 이 자동이라 불필요.
  const [appUpdate, setAppUpdate] = useState<{ currentVer: string; latestVer: string; apkUrl: string } | null>(null);
  const [appUpdateDismissed, setAppUpdateDismissed] = useState(false);
  // 모달: "기존 앱 삭제 → APK 설치" 2단계 가이드 (서명 키 불일치 케이스용)
  const [showUpdateModal, setShowUpdateModal] = useState(false);

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

  // APK 업데이트 체크: 네이티브 앱이면 현재 버전 읽고, 서버에서 최신 버전과 비교.
  // 최신 > 현재 이면 상단에 "업데이트" 배너 띄움. 세션 동안만 dismiss 가능.
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return; // 웹/PWA 는 Vercel 자동 배포 — 스킵
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        const currentVer = info.version || "";
        const res = await fetch("/api/app-version");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.latest || !data.apkUrl) return;
        // 버전 비교 (1.3 vs 1.2 → 숫자별로)
        const cmp = (a: string, b: string): number => {
          const pa = a.split(".").map((x) => parseInt(x, 10) || 0);
          const pb = b.split(".").map((x) => parseInt(x, 10) || 0);
          const n = Math.max(pa.length, pb.length);
          for (let i = 0; i < n; i++) {
            const d = (pa[i] || 0) - (pb[i] || 0);
            if (d !== 0) return d;
          }
          return 0;
        };
        if (cmp(String(data.latest), currentVer) > 0) {
          setAppUpdate({ currentVer, latestVer: String(data.latest), apkUrl: String(data.apkUrl) });
        }
      } catch (e) {
        console.warn("[update-check] 실패:", e);
      }
    })();
  }, [currentUser]);

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

    // 종료 확인
    const handleBackPress = () => {
      // 해시 스택이 있으면 뒤로가기
      if (hashStackRef.current.length > 0) {
        const handled = doBack();
        if (handled) {
          if (hashStackRef.current.length > 0) hashStackRef.current.pop();
          return true;
        }
      }
      // 모달이 열려있으면 닫기
      const handled = doBack();
      if (handled) return true;
      // 아무것도 안 열려있음 → 종료
      return false;
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
        if (prevent) {
          history.pushState(null, "", "#home");
        } else {
          // 앱 종료
          try { import("@capacitor/app").then(({ App }) => App.exitApp()).catch(() => {}); } catch {}
        }
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

  // 매 렌더마다 최신 상태를 ref 에 반영 → 아래 useCallback 이 empty deps 로도 항상 최신 읽음
  unassignedSchedulesRef.current = unassignedSchedules;
  schedulesRef.current = schedules;
  currentUserRef.current = currentUser;

  // === 안정 콜백 (props 참조가 바뀌지 않아 memo 자식이 불필요하게 리렌더 안 됨) ===
  const handleAssigned = useCallback((scheduleId: string, memberId: string, memberName: string) => {
    scheduleReloadSuppressRef.current = Date.now() + 4000;
    const target = unassignedSchedulesRef.current.find((s) => s.id === scheduleId);
    if (!target) return;
    setUnassignedSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
    setSchedules((prev) => {
      const idx = prev.findIndex((s) => s.id === scheduleId);
      const assigned = { ...target, memberId, memberName, status: "confirmed" as const };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = assigned;
        return next;
      }
      return [...prev, assigned];
    });
    assignScheduleApi(scheduleId, memberId, memberName).catch((err) => {
      console.error("[assign] 실패, 롤백:", err);
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
      setUnassignedSchedules((prev) =>
        prev.find((s) => s.id === scheduleId) ? prev : [...prev, target]
      );
      showAlert("배정 실패. 다시 시도해주세요.");
    });
  }, []);

  const handleAssignDeleted = useCallback((id: string) => {
    scheduleReloadSuppressRef.current = Date.now() + 4000;
    setUnassignedSchedules((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleAssignOpenDetail = useCallback((s: Schedule) => {
    setDetailMode("assign");
    openDetailSchedule(s);
  }, [openDetailSchedule]);

  const handleAssignAddSchedule = useCallback((d: Date) => {
    setSelectedDate(d);
    setEditingSchedule(null);
    openModal(setShowScheduleForm);
  }, [openModal]);

  const handleCalendarSelectDate = useCallback((d: Date) => {
    setSelectedDate(d);
    pushHash("day");
    setShowDayPopup(true);
  }, [pushHash]);

  const handleCalendarScheduleClick = useCallback((s: Schedule) => {
    setDetailSchedule(s);
    setDetailMode("calendar");
    pushHash("detail");
  }, [pushHash]);

  const handleCalendarMonthChange = useCallback((d: Date) => {
    viewingMonthRef.current = d;
    loadData(d);
  }, [loadData]);

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
  const isAdmin = role === "ceo" || role === "scheduler" || role === "admin";
  const canSales = role === "ceo" || role === "admin" || role === "sales";
  const canAssign = role === "ceo" || role === "admin" || role === "scheduler" || role === "sales";
  const canManage = role === "ceo" || role === "admin" || role === "sales" || role === "field" || role === "scheduler";
  const canManageAdvanced = role === "ceo" || role === "admin";
  const canApprovePending = role === "ceo" || role === "admin" || role === "scheduler";

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
  function handleSaveSchedule(data: Omit<Schedule, "id" | "status">) {
    setShowScheduleForm(false);
    setEditingSchedule(null);
    consumeHash();
    // 낙관적 업데이트 보호
    scheduleReloadSuppressRef.current = Date.now() + 4000;

    if (editingSchedule) {
      // 수정: UI 즉시 반영
      setSchedules((prev) => prev.map((s) => s.id === editingSchedule.id ? { ...s, ...data } : s));
      apiUpdateSchedule(editingSchedule.id, data).catch(() => {});
    } else if (activeTab === "calendar") {
      // 달력탭에서 생성 → 현재 사용자 정보로 설정
      const tempId = "temp-" + Date.now();
      const linkedMember = members.find(m => m.linkedUsername === currentUser?.username);
      const calData = {
        ...data,
        memberId: linkedMember?.id || data.memberId || "",
        memberName: linkedMember?.name || currentUser?.name || "미배정",
        assignedTo: currentUser?.id || "",
        assignedToName: currentUser?.name || "",
      };
      const tempSchedule: Schedule = { id: tempId, ...calData, status: "confirmed", location: data.location || "" };
      setSchedules((prev) => [...prev, tempSchedule]);
      // 저장 후 바로 상세화면 열기
      setDetailMode("calendar");
      setDetailSchedule(tempSchedule);
      pushHash("d");
      createSchedule(calData).then(ns => {
        if (ns?.id) {
          // temp 제거 후 realtime 이 이미 real row 를 추가했으면 중복 insert 하지 않음
          setSchedules(prev => {
            const withoutTemp = prev.filter(s => s.id !== tempId);
            if (withoutTemp.findIndex(s => s.id === ns.id) >= 0) return withoutTemp;
            return [...withoutTemp, ns];
          });
          setDetailSchedule(ns);
        } else if (ns?.error) {
          setSchedules(prev => prev.filter(s => s.id !== tempId));
          setDetailSchedule(null);
          showAlert("일정 저장 실패: " + (ns.detail || ns.error));
        }
      }).catch((err) => {
        setSchedules(prev => prev.filter(s => s.id !== tempId));
        setDetailSchedule(null);
        showAlert("일정 저장에 실패했습니다: " + (err?.message || "네트워크 오류"));
      });
    } else {
      // 배정탭에서 생성
      const tempId = "temp-" + Date.now();
      const temp: Schedule = { id: tempId, memberId: "", memberName: "미배정", title: data.title, location: "", date: data.date, startTime: data.startTime || "09:00", endTime: data.endTime || "18:00", status: "unassigned", note: data.note || "" };
      setUnassignedSchedules((prev) => [...prev, temp]);
      addUnassignedSchedule({ title: data.title, date: data.date, startTime: data.startTime, endTime: data.endTime, note: data.note || "", color: data.color })
        .then(ns => {
          if (!ns?.id) {
            // DB 중복으로 null 리턴된 경우: temp 만 제거 (real 은 realtime 이 이미 추가했을 수 있음)
            setUnassignedSchedules(prev => prev.filter(s => s.id !== tempId));
            return;
          }
          setUnassignedSchedules(prev => {
            const withoutTemp = prev.filter(s => s.id !== tempId);
            if (withoutTemp.findIndex(s => s.id === ns.id) >= 0) return withoutTemp;
            return [...withoutTemp, ns];
          });
        })
        .catch(() => {});
    }
  }
  function handleDeleteSchedule(id: string) {
    scheduleReloadSuppressRef.current = Date.now() + 4000;
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    setUnassignedSchedules((prev) => prev.filter((s) => s.id !== id));
    softDeleteSchedule(id).catch(() => {});
  }

  function handleUnassignSchedule(id: string, reason: string = "") {
    // 낙관적 업데이트 보호: 4초간 reload 무시 (stale fetch 가 이미 제거한 스케줄을 되돌리는 것 방지)
    scheduleReloadSuppressRef.current = Date.now() + 4000;
    // target 은 schedules 에 있을 수도 있고, 이미 unassigned 상태에서 재진입할 수도 있음 — 양쪽 다 뒤짐
    const target = schedules.find((s) => s.id === id) || unassignedSchedules.find((s) => s.id === id);
    if (!target) return;
    // assignedTo/assignedToName 도 반드시 지움 — 빠뜨리면 로컬에 유령 배정 상태로 남아서
    // 이후 제목/내용 수정 + 리로드 때 이상하게 보임
    const unassigned = {
      ...target,
      memberId: "",
      memberName: "미배정",
      status: "unassigned" as const,
      assignedTo: undefined,
      assignedToName: undefined,
    };
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    // 중복 방지: 이미 unassignedSchedules 에 있으면 덮어쓰고, 없을 때만 추가
    setUnassignedSchedules((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx >= 0) { const next = [...prev]; next[idx] = unassigned; return next; }
      return [...prev, unassigned];
    });
    unassignScheduleApi(id, currentUser?.name || "", reason).catch((err) => {
      console.error("[unassign] 실패, 롤백:", err);
      setSchedules((prev) => prev.find((s) => s.id === id) ? prev : [...prev, target]);
      setUnassignedSchedules((prev) => prev.filter((s) => s.id !== id));
      showAlert("배정 해제 실패. 다시 시도해주세요.");
    });
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

  // Notifications — 사용자별 로컬 처리 (DB 공용이라 다른 사용자와 분리)
  async function handleMarkRead(id: string) {
    notifReloadSuppressRef.current = Date.now() + 6000;
    // 로컬 읽음 기록 (DB 공용 read 상태와 별개)
    localReadIdsRef.current.add(id);
    persistLocalRead();
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  }
  async function handleClearAllNotifications() {
    // 지우기 = 본인 화면에서만 숨김. DB 는 건드리지 않음 → 다른 사용자 영향 없음
    const allIds = notifications.map((n) => n.id);
    allIds.forEach((id) => {
      deletedNotifIdsRef.current.add(id);
      localReadIdsRef.current.add(id);
    });
    persistNotifHidden();
    persistLocalRead();
    notifReloadSuppressRef.current = Date.now() + 6000;
    setNotifications([]);
    setUnreadCount(0);
  }

  // Google Calendar 제거됨 - 직접 등록/영업탭으로 대체

  // Derived - 역할별 일정 필터 (타인 일정 안 보이게)
  const myLinkedMember = members.find((m) => m.linkedUsername === currentUser.username);
  const baseCalendarSchedules = (() => {
    // 관리자(대표/admin/일정관리자): 전체 일정 조회
    if (role === "ceo" || role === "admin" || role === "scheduler") return schedules;
    // 현장팀: 본인 일정만
    if (role === "field") {
      return schedules.filter((s) =>
        s.memberName === currentUser.name ||
        s.assignedToName === currentUser.name ||
        s.assignedTo === currentUser.id ||
        (myLinkedMember && s.memberId === myLinkedMember.id)
      );
    }
    // 영업팀: 본인이 상담/등록한 일정만 (제목에 username 포함)
    if (role === "sales") {
      const u = currentUser.username;
      const name = currentUser.name;
      return schedules.filter((s) =>
        s.title.includes(`/${u}/`) ||
        s.title.includes(`/${u}[`) ||
        s.title.endsWith(`/${u}`) ||
        s.title.startsWith(`u${u}/`) ||
        s.memberName === name ||
        s.assignedToName === name
      );
    }
    return [];
  })();
  // 팀원 필터 적용 (현장팀/영업팀은 이미 자기 일정만 보이므로 필터 무시)
  // 본인 일정은 항상 표시, 필터에 선택된 팀원 일정도 추가 표시
  // 선택 0명이면 본인 일정만 표시 — "전체" 체크박스 해제 시 일정 다 사라지는 게 의도된 동작.
  const calendarSchedules = (() => {
    if (!filterActive || role === "field" || role === "sales") return baseCalendarSchedules;
    const filterNames = new Set<string>();
    allUsers.filter(u => u.role === "field").forEach(u => {
      if (selectedMemberIds.has(u.id)) filterNames.add(u.name);
    });
    const myName = currentUser.name;
    const myId = currentUser.id;
    const myLinkedId = myLinkedMember?.id;
    return baseCalendarSchedules.filter((s) =>
      // 본인(대표/admin/scheduler) 관련 일정은 항상 표시
      s.memberName === myName ||
      s.assignedToName === myName ||
      s.assignedTo === myId ||
      (myLinkedId && s.memberId === myLinkedId) ||
      // 필터에 선택된 팀원의 일정
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

  // 반환 배너: 본인 포함 모든 관리자에게 표시. 24시간 이내 반환만 노출.
  // read 상태와 무관하게 유지 → 읽음/재동기화 경주로 인한 깜빡임 차단.
  // 사용자가 X 로 명시적으로 닫은 것만 숨김.
  const returnBannerNotifs = (() => {
    const dismissed = dismissedReturnIdsRef.current;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return notifications.filter(n => {
      const isRet = n.type === "schedule_returned" || n.title === "일정 반환";
      if (!isRet) return false;
      if (dismissed.has(n.id)) return false;
      const ts = new Date(n.createdAt).getTime();
      if (!isNaN(ts) && ts < cutoff) return false;
      return true;
    });
  })();

  return (
    <div className="h-[100dvh] bg-white pb-14 flex flex-col overflow-hidden" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      {/* 업데이트 배너·모달 비활성 — 팀원 재설치 부담 때문에 잠정 숨김.
          appUpdate 상태와 체크 로직은 그대로 둠 (나중에 다시 켤 때 UI 만 복구). */}

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
                showAlert("주소가 복사되었습니다!\n사파리에 붙여넣기 해주세요.");
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
      {/* 반환 알림 배너 제거됨 (사용자 요청 — 노이즈로 인식). 알림 자체는 /notifications 에서 확인 가능. */}
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
            {/* Member filter - 대표/일정관리자/영업팀 */}
            {canAssign && activeTab === "calendar" && (
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
            {/* 설정 버튼 - 모든 사용자 */}
            <button onClick={() => openModal(setShowAdminPanel)} className="p-2 text-gray-400 active:bg-purple-50 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            {/* Logout */}
            <button onClick={() => { localStorage.removeItem("currentUser"); setCurrentUser(null); }} className="p-1.5 text-gray-400 active:bg-red-50 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </header>

      {/* 팀원 필터 패널 - 달력에서만 */}
      {showMemberFilter && canAssign && activeTab === "calendar" && (
        <div className="bg-white border-b border-gray-200 px-4 pb-3 z-30 max-h-[50vh] overflow-y-auto">
          {/* 헤더(팀원 필터 라벨 + 닫기 버튼) 를 스크롤 시에도 고정되게 sticky */}
          <div className="sticky top-0 bg-white pt-3 pb-2 -mx-4 px-4 mb-2 flex items-center justify-between border-b border-gray-100 z-10">
            <span className="text-xs font-bold text-gray-700">팀원 필터</span>
            <button
              onClick={() => { setShowMemberFilter(false); consumeHash(); }}
              className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold active:bg-blue-600"
            >
              닫기
            </button>
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
                      // 전체 해제 → 빈 달력
                      setSelectedMemberIds(new Set());
                      setFilterActive(true);
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
                      setFilterActive(true);
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
            onSelectDate={handleCalendarSelectDate}
            onScheduleClick={handleCalendarScheduleClick}
            onMonthChange={handleCalendarMonthChange}
          />
        </div>

        <div className="h-full" style={{ display: activeTab === "manage" ? "block" : "none" }}>
          <ManageTab
            isAdmin={canManageAdvanced}
            userRole={role}
            userName={currentUser.name}
            allUsers={allUsers.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role, address: u.address, branch: u.branch }))}
            members={members.map(m => ({ id: m.id, name: m.name, linkedUsername: m.linkedUsername }))}
            schedules={schedules}
            onRefresh={() => loadData(undefined, true)}
            onNavigateToAssign={() => switchTab("assign")}
            onNavigateToCalendar={() => switchTab("calendar")}
          />
        </div>

        {canAssign && (
          <div className="h-full" style={{ display: activeTab === "assign" ? "block" : "none" }}>
            <AssignTab
              members={members}
              schedules={unassignedSchedules}
              onAssigned={handleAssigned}
              onDeleted={handleAssignDeleted}
              onOpenDetail={handleAssignOpenDetail}
              onAddSchedule={handleAssignAddSchedule}
            />
          </div>
        )}

        {/* 활동범위 탭 */}
        <div className="h-full overflow-hidden relative" style={{ display: activeTab === "area" ? "block" : "none" }}>
          <BranchMapSection allUsers={allUsers.filter(u => u.role === "field" || u.role === "scheduler").map(u => ({ id: u.id, name: u.name, role: u.role, address: u.address, branch: u.branch }))} isAdmin={role === "ceo" || role === "admin" || role === "scheduler"} />
        </div>

        {/* 사용자 탭 */}
        <div className="h-full overflow-y-auto" style={{ display: activeTab === "members" ? "block" : "none" }}>
          <div className="p-3 space-y-2 pb-20">
            {(() => {
              const roleLabels: Record<string, string> = { ceo: "대표", admin: "관리자", scheduler: "일정관리자", sales: "영업팀", field: "현장팀", pending: "대기" };
              const roleColors: Record<string, string> = { ceo: "bg-purple-100 text-purple-700", admin: "bg-purple-100 text-purple-700", scheduler: "bg-blue-100 text-blue-700", sales: "bg-green-100 text-green-700", field: "bg-orange-100 text-orange-700", pending: "bg-gray-100 text-gray-500" };
              const groupColors: Record<string, string> = { self: "border-blue-200 bg-blue-50/50", ceo: "border-purple-200 bg-purple-50/30", admin: "border-purple-200 bg-purple-50/30", scheduler: "border-blue-200 bg-blue-50/30", sales: "border-green-200 bg-green-50/30", field: "border-orange-200 bg-orange-50/30", pending: "border-orange-300 bg-orange-50/40" };

              // 전체 사용자 → userOrder 로 정렬
              const sortedAll = [...allUsers].filter(u => u.username !== "admin").sort((a, b) => {
                const ai = userOrder.indexOf(a.id);
                const bi = userOrder.indexOf(b.id);
                if (ai === -1 && bi === -1) return 0;
                if (ai === -1) return 1;
                if (bi === -1) return 1;
                return ai - bi;
              });
              const me = sortedAll.find(u => u.username === currentUser.username);
              const others = sortedAll.filter(u => u.username !== currentUser.username);

              // 그룹 정의
              const groups: { key: string; title: string; users: typeof sortedAll }[] = [];
              if (me) groups.push({ key: "self", title: "본인", users: [me] });
              const ceoUsers = others.filter(u => u.role === "ceo");
              if (ceoUsers.length > 0) groups.push({ key: "ceo", title: "대표", users: ceoUsers });
              const adminUsers = others.filter(u => u.role === "admin");
              if (adminUsers.length > 0) groups.push({ key: "admin", title: "관리자", users: adminUsers });
              const schUsers = others.filter(u => u.role === "scheduler");
              if (schUsers.length > 0) groups.push({ key: "scheduler", title: "일정관리자", users: schUsers });
              const salesUsers = others.filter(u => u.role === "sales");
              if (salesUsers.length > 0) groups.push({ key: "sales", title: "영업팀", users: salesUsers });
              const fieldUsers = others.filter(u => u.role === "field");
              if (fieldUsers.length > 0) groups.push({ key: "field", title: "현장팀", users: fieldUsers });
              // 대표/admin/일정관리자 는 가입 신청 대기 볼 수 있음
              if (canApprovePending) groups.push({ key: "pending", title: `가입 신청 대기${pendingUsers.length > 0 ? ` (${pendingUsers.length})` : ""}`, users: pendingUsers });

              const allInSortedList = [...(me ? [me] : []), ...others, ...(canManageAdvanced ? pendingUsers : [])];

              function renderCard(u: typeof sortedAll[0]) {
                const isMe = u.username === currentUser!.username;
                return (
                  <div
                    key={u.id}
                    className={`border rounded-xl p-3 transition-all ${isMe ? "border-blue-300 bg-blue-50/30" : u.status === "pending" ? "border-orange-300 bg-orange-50/30" : "border-gray-200 bg-white"} ${dragOverUserId === u.id && dragUserId !== u.id ? "border-blue-500 border-dashed bg-blue-50/50" : ""} ${dragUserId === u.id ? "opacity-40 scale-95" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); if (!isMe && canManageAdvanced) setDragOverUserId(u.id); }}
                    data-userid={u.id}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!dragUserId || dragUserId === u.id || isMe) return;
                      const ids = allInSortedList.filter(x => x.username !== currentUser!.username).map(x => x.id);
                      const fromIdx = ids.indexOf(dragUserId);
                      const toIdx = ids.indexOf(u.id);
                      if (fromIdx < 0 || toIdx < 0) return;
                      ids.splice(fromIdx, 1);
                      ids.splice(toIdx, 0, dragUserId);
                      setUserOrder(ids);
                      localStorage.setItem("userOrder", JSON.stringify(ids));
                      setDragUserId(null);
                      setDragOverUserId(null);
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      {canManageAdvanced && !isMe && u.status !== "pending" ? (
                        <div
                          draggable
                          onDragStart={(e) => { setDragUserId(u.id); e.dataTransfer.effectAllowed = "move"; }}
                          onDragEnd={() => { setDragUserId(null); setDragOverUserId(null); }}
                          onTouchStart={(e) => { setDragUserId(u.id); dragStartY.current = e.touches[0].clientY; dragNodeRef.current = e.currentTarget.parentElement?.parentElement as HTMLDivElement; }}
                          onTouchMove={(e) => {
                            if (!dragUserId) return;
                            const touch = e.touches[0];
                            const els = document.elementsFromPoint(touch.clientX, touch.clientY);
                            for (const el of els) {
                              const card = (el as HTMLElement).closest("[data-userid]");
                              if (card) { setDragOverUserId(card.getAttribute("data-userid") || null); break; }
                            }
                          }}
                          onTouchEnd={() => {
                            if (dragUserId && dragOverUserId && dragUserId !== dragOverUserId) {
                              const ids = allInSortedList.filter(x => x.username !== currentUser!.username).map(x => x.id);
                              const fromIdx = ids.indexOf(dragUserId);
                              const toIdx = ids.indexOf(dragOverUserId);
                              if (fromIdx >= 0 && toIdx >= 0) {
                                ids.splice(fromIdx, 1);
                                ids.splice(toIdx, 0, dragUserId);
                                setUserOrder(ids);
                                localStorage.setItem("userOrder", JSON.stringify(ids));
                              }
                            }
                            setDragUserId(null);
                            setDragOverUserId(null);
                          }}
                          className="w-7 h-9 flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0 touch-none"
                        >
                          <svg className="w-4 h-5 text-gray-300" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
                        </div>
                      ) : null}
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
                          <option value="admin">관리자</option>
                          <option value="ceo">대표</option>
                        </select>
                        <button onClick={() => openProfileUser(u)} className="p-1.5 active:bg-gray-100 rounded-lg border border-gray-200">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                        <button onClick={async () => {
                          if (!(await showConfirm(u.name + "님을 탈퇴시키겠습니까?"))) return;
                          setAllUsers(prev => prev.filter(x => x.id !== u.id));
                          deleteUserApi(u.id).then(() => loadData(undefined, true));
                        }} className="p-1.5 active:bg-red-50 rounded-lg border border-gray-200">
                          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )}
                    {u.status === "pending" && canApprovePending && (
                      <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
                        <button onClick={() => { setPendingUsers(prev => prev.filter(x => x.id !== u.id)); setAllUsers(prev => [...prev, { ...u, status: "approved" as const, role: "field" as const }]); approveUserApi(u.id).catch(() => {}); }} className="flex-1 py-2 bg-green-500 text-white rounded-lg text-xs font-bold active:bg-green-600">승인</button>
                        <button onClick={() => { setPendingUsers(prev => prev.filter(x => x.id !== u.id)); deleteUserApi(u.id).catch(() => {}); }} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-xs font-bold active:bg-red-600">거절</button>
                      </div>
                    )}
                  </div>
                );
              }

              return groups.map(g => {
                const isOpen = openGroups[g.key] === true;
                return (
                  <div key={g.key} className={`rounded-xl border ${groupColors[g.key] || "border-gray-200 bg-white"} overflow-hidden`}>
                    <button onClick={() => toggleGroup(g.key)} className="w-full px-4 py-3 flex items-center justify-between active:bg-black/5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-800">{g.title}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/80 text-gray-600 font-medium">{g.users.length}명</span>
                      </div>
                      <svg className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 space-y-2">
                        {g.users.length === 0 ? (
                          <div className="py-4 text-center text-xs text-gray-400">
                            {g.key === "pending" ? "가입 신청 대기 중인 사용자가 없습니다" : "사용자가 없습니다"}
                          </div>
                        ) : g.key === "pending" && !canApprovePending ? (
                          <div className="py-4 text-center text-xs text-gray-500 bg-white rounded-lg">
                            <div className="text-base font-bold text-orange-600 mb-1">{g.users.length}명 대기 중</div>
                            <div>상세 정보 및 승인은 대표만 가능합니다</div>
                          </div>
                        ) : (
                          g.users.map(u => renderCard(u))
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Sales tab */}
        {canSales && (
          <div className="h-full flex flex-col" style={{ display: activeTab === "sales" ? "flex" : "none" }}>
            <SalesTab userName={currentUser.name} onCreated={() => loadData(undefined, true)} isAdmin={canManageAdvanced} canEditTemplates={canSales} />
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
            className={`flex flex-col items-center justify-center gap-0.5 w-14 h-full ${
              activeTab === "members" ? "text-blue-500" : "text-gray-400"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === "members" ? 2.5 : 1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[10px] font-medium">사용자</span>
          </button>

          {/* 활동범위 */}
          <button
            onClick={() => switchTab("area")}
            className={`flex flex-col items-center justify-center gap-0.5 w-14 h-full ${
              activeTab === "area" ? "text-blue-500" : "text-gray-400"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === "area" ? 2.5 : 1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === "area" ? 2.5 : 1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[10px] font-medium">활동범위</span>
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
                onClick={() => { setShowDayPopup(false); consumeHash(); setEditingSchedule(null); setTimeout(() => openModal(setShowScheduleForm), 150); }}
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
          canAssignMember={role === "ceo" || role === "admin" || role === "scheduler"}
          mode={detailMode}
          currentUserName={currentUser.name}
          allUsers={allUsers.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role }))}
          onRegisterBackHandler={(fn) => { detailBackRef.current = fn; }}
          memberBranch={allUsers.find(u => u.name === (detailSchedule?.memberName))?.branch || ""}
          onEdit={(s) => { setDetailSchedule(null); consumeHash(); handleEditSchedule(s); }}
          onDelete={(id) => { handleDeleteSchedule(id); setDetailSchedule(null); consumeHash(); }}
          onUnassign={(id, reason) => { setDetailSchedule(null); consumeHash(); handleUnassignSchedule(id, reason); }}
          onAssign={(scheduleId, memberId, memberName) => {
            scheduleReloadSuppressRef.current = Date.now() + 4000;
            const target = unassignedSchedules.find((s) => s.id === scheduleId);
            if (target) {
              setUnassignedSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
              // 중복 방지: 같은 scheduleId 가 이미 있으면 덮어쓰고, 없을 때만 추가
              setSchedules((prev) => {
                const idx = prev.findIndex((s) => s.id === scheduleId);
                const assigned = { ...target, memberId, memberName, status: "confirmed" as const };
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = assigned;
                  return next;
                }
                return [...prev, assigned];
              });
              assignScheduleApi(scheduleId, memberId, memberName).catch((err) => {
                console.error("[assign] 실패, 롤백:", err);
                setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
                setUnassignedSchedules((prev) =>
                  prev.find((s) => s.id === scheduleId) ? prev : [...prev, target]
                );
                showAlert("배정 실패. 다시 시도해주세요.");
              });
            } else {
              assignScheduleApi(scheduleId, memberId, memberName).catch((err) => {
                console.error("[assign] 실패:", err);
                showAlert("배정 실패. 다시 시도해주세요.");
              });
            }
            setDetailSchedule(null);
            consumeHash();
          }}
          onClose={() => { setDetailSchedule(null); consumeHash(); }}
          onUpdated={(patch) => {
            // 전체 리로드 대신 해당 일정만 로컬 갱신
            // realtime 리로드가 낙관적 업데이트 덮어쓰는 걸 4초간 차단
            scheduleReloadSuppressRef.current = Date.now() + 4000;
            // patch 우선 사용 — closure 의 detailSchedule 에 의존 X
            // (onClose 먼저 불려서 null 되어도 patch 만 있으면 정확히 반영됨)
            if (patch && patch.id) {
              const id = patch.id;
              setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
              setUnassignedSchedules(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
            } else if (detailSchedule) {
              // 인자 없이 호출된 legacy 경로 (색상 등) — 전체 detailSchedule 로 merge
              setSchedules(prev => prev.map(s => s.id === detailSchedule.id ? { ...s, ...detailSchedule } : s));
              setUnassignedSchedules(prev => prev.map(s => s.id === detailSchedule.id ? { ...s, ...detailSchedule } : s));
            }
          }}
        />
      )}
      {showAdminPanel && (
        <AdminPanel onClose={() => { setShowAdminPanel(false); consumeHash(); }} onRefresh={() => loadData(undefined, true)} />
      )}
      {showSearch && (
        <SearchPanel
          onSelectSchedule={(s) => {
            setShowSearch(false);
            consumeHash();
            // 검색한 탭에 따라 상세 모드 결정 (배정탭 검색 → 배정 양식, 그 외 → 달력 양식)
            setDetailMode(activeTab === "assign" ? "assign" : "calendar");
            // 검색 패널 닫힘 완료 후 상세 열기 (해시 충돌 방지)
            setTimeout(() => openDetailSchedule(s), 100);
          }}
          onClose={() => { setShowSearch(false); consumeHash(); }}
        />
      )}
      {/* 신상정보 팝업 */}
      {profileUser && (() => {
        const pu = profileUser;
        const canEdit = isAdmin && pu.username !== currentUser.username;
        return (
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
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">{pu.name[0]}</div>
                <div>
                  <div className="text-base font-bold text-gray-800">{pu.name}</div>
                  <div className="text-xs text-gray-500">{pu.username}</div>
                </div>
              </div>
              {[
                ["아이디", pu.username],
                ["비밀번호", pu.password],
                ["연락처", pu.phone],
                ["관리점", pu.branch ? `${pu.branch}[관리점]` : ""],
                ["주민등록번호", pu.residentNumber],
                ["사업자등록증", pu.businessLicenseFile],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
                  <span className="text-sm text-gray-800">{value}</span>
                </div>
              ))}
              {/* 주소 — 대표만 수정 가능 */}
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-500 w-20 shrink-0 pt-1.5">주소</span>
                {canEdit ? (
                  <div className="flex-1 flex gap-1.5">
                    <input
                      defaultValue={pu.address}
                      onBlur={async (e) => {
                        const newAddr = e.target.value.trim();
                        if (newAddr === pu.address) return;
                        setAllUsers(prev => prev.map(u => u.id === pu.id ? { ...u, address: newAddr } : u));
                        setProfileUser({ ...pu, address: newAddr });
                        await updateUserInfoApi(pu.id, { address: newAddr });
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className="flex-1 text-sm text-gray-800 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="주소 입력"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-gray-800">{pu.address || "-"}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
