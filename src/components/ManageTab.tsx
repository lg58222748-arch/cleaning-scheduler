"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Schedule } from "@/types";
import { fetchDeletedSchedules, restoreScheduleApi, emptyTrashApi, deleteAllSchedules, fetchSchedules, addUnassignedSchedule, assignScheduleApi, createSchedule } from "@/lib/api";

type ManageSubTab = "sales-stats" | "field" | "scheduler" | "ceo";

interface ManageTabProps {
  isAdmin: boolean;
  userRole: string;
  userName?: string;
  allUsers?: { id?: string; name: string; username?: string; role?: string; address?: string; branch?: string }[];
  members?: { id: string; name: string; linkedUsername?: string }[];
  onRefresh: () => void;
}

export default function ManageTab({ isAdmin, userRole, userName = "", allUsers = [], members = [], onRefresh }: ManageTabProps) {
  // 역할별 기본 탭
  const defaultTab: ManageSubTab =
    userRole === "ceo" ? "ceo" :
    userRole === "sales" ? "sales-stats" :
    userRole === "field" ? "field" :
    userRole === "scheduler" ? "scheduler" : "sales-stats";

  const [activeSubTab, setActiveSubTab] = useState<ManageSubTab>(defaultTab);

  // 표시할 탭 결정
  const tabs: { id: ManageSubTab; label: string }[] = [];
  if (userRole === "ceo") {
    tabs.push({ id: "ceo", label: "대표" });
    tabs.push({ id: "sales-stats", label: "영업팀" });
    tabs.push({ id: "field", label: "현장팀" });
    tabs.push({ id: "scheduler", label: "일정관리" });
  } else if (userRole === "sales") {
    tabs.push({ id: "sales-stats", label: "영업팀" });
  } else if (userRole === "field") {
    tabs.push({ id: "field", label: "현장팀" });
  } else if (userRole === "scheduler") {
    tabs.push({ id: "scheduler", label: "일정관리" });
  }

  return (
    <div className="h-full overflow-y-auto bg-white pb-20">
      <div className="px-4 py-4 border-b border-gray-100">
        <h3 className="text-base font-bold text-gray-800">관리</h3>
      </div>

      {/* 역할별 서브탭 */}
      {tabs.length > 1 && (
        <div className="flex border-b border-gray-200 px-2 pt-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-bold text-center transition-colors ${
                activeSubTab === t.id
                  ? "text-blue-500 border-b-2 border-blue-500"
                  : "text-gray-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* 대표 탭 */}
      {activeSubTab === "ceo" && (
        <CeoSection onRefresh={onRefresh} allUsers={allUsers} members={members} />
      )}

      {/* 영업팀 탭 */}
      {activeSubTab === "sales-stats" && (
        <SalesStatsSection userName={userName} userRole={userRole} allUsers={allUsers} />
      )}

      {/* 현장팀 탭 */}
      {activeSubTab === "field" && (
        <div className="px-4 py-12 text-center text-gray-400 text-sm">
          <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="font-medium text-gray-500">현장팀 관리</p>
          <p className="text-xs text-gray-400 mt-1">추후 업데이트 예정</p>
        </div>
      )}

      {/* 일정관리자 탭 */}
      {activeSubTab === "scheduler" && (
        <div className="px-4 py-12 text-center text-gray-400 text-sm">
          <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="font-medium text-gray-500">일정관리자</p>
          <p className="text-xs text-gray-400 mt-1">추후 업데이트 예정</p>
        </div>
      )}
    </div>
  );
}


/* ════════════ 대표 전용 섹션 ════════════ */
function CeoSection({ onRefresh, allUsers, members }: {
  onRefresh: () => void;
  allUsers: { id?: string; name: string; username?: string; role?: string; address?: string; branch?: string }[];
  members: { id: string; name: string; linkedUsername?: string }[];
}) {
  const [trashItems, setTrashItems] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [showGoogleImport, setShowGoogleImport] = useState(false);

  useEffect(() => { loadCounts(); }, []);

  async function loadCounts() {
    const all = await fetchSchedules();
    setTotalCount(all.length);
  }

  async function loadTrash() {
    setLoading(true);
    const data = await fetchDeletedSchedules();
    setTrashItems(data);
    setLoading(false);
  }

  async function handleRestore(id: string) {
    setTrashItems((prev) => prev.filter((s) => s.id !== id));
    await restoreScheduleApi(id);
    onRefresh();
  }

  async function handleEmptyTrash() {
    await emptyTrashApi();
    setTrashItems([]);
  }

  async function handleDeleteAll() {
    const result = await deleteAllSchedules();
    onRefresh();
    loadCounts();
    alert(`${result.deleted}건 삭제 완료`);
  }

  async function handleBackup() {
    const all = await fetchSchedules();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schedule-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="divide-y divide-gray-100">
      <div className="px-4 py-3">
        <p className="text-xs text-gray-400">전체 일정 {totalCount}건</p>
      </div>

      {/* 구글 캘린더 가져오기 */}
      <button
        onClick={() => setShowGoogleImport(!showGoogleImport)}
        className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-gray-50"
      >
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm6.28 14.78h-4.56v4.56h-3.44v-4.56H5.72v-3.44h4.56V6.78h3.44v4.56h4.56v3.44z"/>
          </svg>
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-gray-800">구글 캘린더 가져오기</div>
          <div className="text-xs text-gray-400">캘린더 ID로 일정 가져와서 현장팀 배정</div>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${showGoogleImport ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {showGoogleImport && (
        <GoogleCalendarImport allUsers={allUsers} members={members} onImported={onRefresh} />
      )}

      {/* 휴지통 */}
      <button onClick={() => { setShowTrash(!showTrash); if (!showTrash) loadTrash(); }} className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-gray-50">
        <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-gray-800">휴지통</div>
          <div className="text-xs text-gray-400">삭제된 일정 보기 · 복원 가능</div>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${showTrash ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </button>

      {showTrash && (
        <div className="bg-gray-50">
          {loading ? <div className="py-6 text-center text-gray-400 text-sm">로딩 중...</div>
           : trashItems.length === 0 ? <div className="py-6 text-center text-gray-400 text-sm">휴지통이 비어있습니다</div>
           : <>
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-gray-500">{trashItems.length}건</span>
                <button onClick={handleEmptyTrash} className="text-xs text-red-500 font-medium">휴지통 비우기</button>
              </div>
              {trashItems.map((s) => (
                <div key={s.id} className="px-4 py-2.5 flex items-center gap-2 border-t border-gray-100">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-700 truncate">{s.title.replace(/^\[.+?\]\s*/, "")}</div>
                    <div className="text-xs text-gray-400">{s.date}</div>
                  </div>
                  <button onClick={() => handleRestore(s.id)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium active:bg-blue-100">복원</button>
                </div>
              ))}
            </>}
        </div>
      )}

      {/* 백업 */}
      <button onClick={handleBackup} className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-gray-50">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-gray-800">백업 다운로드</div>
          <div className="text-xs text-gray-400">전체 일정을 JSON 파일로 저장</div>
        </div>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </button>

      {/* 전체 삭제 */}
      <button
        onClick={() => { if (confirm(`전체 ${totalCount}건 일정을 모두 삭제합니다. 정말 삭제하시겠습니까?`)) handleDeleteAll(); }}
        className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-red-50"
      >
        <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.834-2.694-.834-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-red-600">전체 일정 삭제</div>
          <div className="text-xs text-gray-400">모든 일정을 영구 삭제합니다</div>
        </div>
      </button>
    </div>
  );
}


/* ════════════ 영업팀 통계 섹션 ════════════ */
function SalesStatsSection({ userName, userRole, allUsers }: {
  userName: string;
  userRole: string;
  allUsers: { id?: string; name: string; username?: string; role?: string; address?: string; branch?: string }[];
}) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<"month" | "date">("month");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => { loadSchedules(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSchedules() {
    setLoading(true);
    const all = await fetchSchedules();
    setSchedules(all);
    setLoading(false);
  }

  // 필터링된 일정
  const filteredSchedules = filterMode === "month"
    ? schedules.filter(s => s.date.startsWith(selectedMonth))
    : schedules.filter(s => s.date === selectedDate);

  const isCeo = userRole === "ceo";

  // 본인 일정만 필터 (대표는 전체)
  function getUserSchedules(name: string, source: Schedule[]) {
    return source.filter(s => {
      const title = s.title.replace(/^\[.+?\]\s*/, "");
      return title.includes(`/${name}/`) || title.includes(`/${name}[`) || title.endsWith(`/${name}`) || title.startsWith(`u${name}/`);
    });
  }

  // 대표: 전체 영업사원 / 그 외: 본인만
  const salesUsers = isCeo
    ? allUsers.filter(u => u.role === "sales" || u.role === "ceo")
    : [{ name: userName, role: userRole }];

  // 본인 기준 요약 (대표가 아닌 경우)
  const mySchedules = isCeo ? filteredSchedules : getUserSchedules(userName, filteredSchedules);
  const myConfirmed = mySchedules.filter(s => !s.title.includes("/미입금")).length;
  const myPending = mySchedules.filter(s => s.title.includes("/미입금")).length;

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">로딩 중...</div>;

  return (
    <div className="px-4 py-4 space-y-4">
      {/* 필터 모드 전환 */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200">
        <button onClick={() => setFilterMode("month")}
          className={`flex-1 py-2 text-xs font-bold ${filterMode === "month" ? "bg-blue-500 text-white" : "bg-white text-gray-500"}`}>
          월별 조회
        </button>
        <button onClick={() => setFilterMode("date")}
          className={`flex-1 py-2 text-xs font-bold ${filterMode === "date" ? "bg-blue-500 text-white" : "bg-white text-gray-500"}`}>
          날짜별 조회
        </button>
      </div>

      {/* 월/날짜 선택 */}
      <div className="flex items-center gap-2">
        {filterMode === "month" ? (
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" />
        ) : (
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" />
        )}
        <button onClick={loadSchedules} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold active:bg-blue-100">새로고침</button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <div className="text-lg font-extrabold text-blue-700">{mySchedules.length}</div>
          <div className="text-xs text-blue-500">{isCeo ? "전체" : "내"} 건수</div>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <div className="text-lg font-extrabold text-green-700">{myConfirmed}</div>
          <div className="text-xs text-green-500">입금확인</div>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <div className="text-lg font-extrabold text-red-700">{myPending}</div>
          <div className="text-xs text-red-500">미입금</div>
        </div>
      </div>

      {/* 영업사원별 상세 (대표만 전체, 나머진 본인만) */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          {isCeo ? "영업사원별 현황" : "내 영업 현황"}
        </div>
        {salesUsers.map((user) => {
          const userScheds = getUserSchedules(user.name, filteredSchedules);
          const confirmed = userScheds.filter(s => !s.title.includes("/미입금")).length;
          const pending = userScheds.filter(s => s.title.includes("/미입금")).length;
          const total = userScheds.length;

          return (
            <div key={user.name} className="border border-gray-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-800">{user.name}</span>
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">{total}건</span>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-green-600">✅ 입금확인 {confirmed}건</span>
                <span className="text-red-500">⏳ 미입금 {pending}건</span>
              </div>
              {total > 0 && (
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${Math.round((confirmed / total) * 100)}%` }} />
                </div>
              )}
            </div>
          );
        })}
        {salesUsers.length === 0 && (
          <div className="py-4 text-center text-gray-400 text-sm">영업팀 사용자가 없습니다</div>
        )}
      </div>
    </div>
  );
}


/* ════════════ 구글 캘린더 가져오기 (GAS 프록시, OAuth 불필요) ════════════ */
const GAS_URL = "https://script.google.com/macros/s/AKfycbzBMfzBsdC5YKHDPUhHVZuPLKqb2MTYKT_zTGoNVl_h8jhGTsAiqnkxBgtO414TzWdVEw/exec";

function GoogleCalendarImport({ allUsers, members, onImported }: {
  allUsers: { id?: string; name: string; username?: string; role?: string; address?: string; branch?: string }[];
  members: { id: string; name: string; linkedUsername?: string }[];
  onImported: () => void;
}) {
  const [calendarId, setCalendarId] = useState("");
  const [savedCalendars, setSavedCalendars] = useState<{ id: string; name: string; assignTo: string }[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("google_calendars") || "[]"); } catch { return []; }
  });
  const [events, setEvents] = useState<{ id: string; summary: string; date: string; description?: string; selected: boolean; assignTo: string; calName?: string }[]>([]);
  const [checkedCals, setCheckedCals] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState("");

  function saveCalendarId(id: string, name: string) {
    const existing = savedCalendars.find(c => c.id === id);
    const updated = savedCalendars.filter(c => c.id !== id);
    updated.push({ id, name, assignTo: existing?.assignTo || "" });
    setSavedCalendars(updated);
    localStorage.setItem("google_calendars", JSON.stringify(updated));
  }
  function updateCalendarAssign(calId: string, assignTo: string) {
    const updated = savedCalendars.map(c => c.id === calId ? { ...c, assignTo } : c);
    setSavedCalendars(updated);
    localStorage.setItem("google_calendars", JSON.stringify(updated));
  }
  function removeCalendarId(id: string) {
    const updated = savedCalendars.filter(c => c.id !== id);
    setSavedCalendars(updated);
    localStorage.setItem("google_calendars", JSON.stringify(updated));
  }

  async function fetchFromCalendar(cid: string) {
    const url = `${GAS_URL}?action=fetchEvents&calendarId=${encodeURIComponent(cid)}&days=60`;
    const res = await fetch(url);
    return res.json();
  }

  async function handleFetchEvents() {
    if (!calendarId.trim()) { setError("캘린더 ID를 입력해주세요"); return; }
    setLoading(true);
    setError("");
    setImportDone(false);

    try {
      const data = await fetchFromCalendar(calendarId.trim());
      if (data.status === "error") { setError(data.message || "캘린더 조회 실패"); setLoading(false); return; }
      const calName = data.calendarName || calendarId.trim();
      saveCalendarId(calendarId.trim(), calName);
      const items = (data.items || []).map((ev: { id: string; summary: string; date: string; description?: string }) => ({
        id: ev.id, summary: ev.summary || "(제목 없음)", date: ev.date || "", description: ev.description || "", selected: true, assignTo: "", calName,
      }));
      setEvents(items);
      if (items.length === 0) setError("가져올 일정이 없습니다 (향후 60일)");
    } catch { setError("GAS 연결 실패. 네트워크를 확인하세요."); }
    setLoading(false);
  }

  async function handleFetchAll() {
    if (savedCalendars.length === 0) { setError("저장된 캘린더가 없습니다. 먼저 캘린더 ID를 추가하세요."); return; }
    setLoading(true);
    setError("");
    setImportDone(false);
    const allItems: typeof events = [];
    for (const cal of savedCalendars) {
      try {
        const data = await fetchFromCalendar(cal.id);
        if (data.status === "ok" && data.items) {
          data.items.forEach((ev: { id: string; summary: string; date: string; description?: string }) => {
            allItems.push({ id: ev.id + cal.id, summary: ev.summary || "(제목 없음)", date: ev.date || "", description: ev.description || "", selected: true, assignTo: cal.assignTo || "", calName: cal.name });
          });
        }
      } catch { /* 개별 캘린더 실패 무시 */ }
    }
    setEvents(allItems);
    if (allItems.length === 0) setError("가져올 일정이 없습니다");
    setLoading(false);
  }

  async function handleImport() {
    const toImport = events.filter(e => e.selected);
    if (toImport.length === 0) return;
    setImporting(true);
    setImportProgress(0);

    let count = 0;
    for (let i = 0; i < toImport.length; i++) {
      const ev = toImport[i];
      try {
        if (ev.assignTo) {
          // 담당자 선택 → 달력에 직접 등록
          const member = members.find(m => m.id === ev.assignTo);
          const fieldUser = allUsers.find(u => (u.id === ev.assignTo || u.name === ev.assignTo) && u.role === "field");
          const assignId = member?.id || fieldUser?.id || ev.assignTo;
          const assignName = member?.name || fieldUser?.name || ev.assignTo;
          // 먼저 미배정으로 등록 후 배정 (createSchedule이 실패할 수 있어서)
          const created = await addUnassignedSchedule({
            title: ev.summary,
            date: ev.date,
            startTime: "09:00",
            endTime: "18:00",
            note: ev.description || "",
          });
          if (created?.id) {
            await assignScheduleApi(created.id, assignId, assignName);
          }
        } else {
          // 미선택 → 배정탭
          await addUnassignedSchedule({
            title: ev.summary,
            date: ev.date,
            startTime: "09:00",
            endTime: "18:00",
            note: ev.description || "",
          });
        }
        count++;
      } catch { /* 개별 실패 무시 */ }
      setImportProgress(Math.round(((i + 1) / toImport.length) * 100));
    }

    setImporting(false);
    setImportCount(count);
    setImportDone(true);
    setEvents([]);
    onImported();
  }

  function toggleAll(checked: boolean) {
    setEvents(prev => prev.map(e => ({ ...e, selected: checked })));
  }

  // 전체 일괄 배정 변경
  function setAllAssign(value: string) {
    setEvents(prev => prev.map(e => e.selected ? { ...e, assignTo: value } : e));
  }

  // 배정 가능한 사람 목록: members(팀원) + 현장팀 사용자 (중복 제거)
  const assignableList: { id: string; name: string; source: string }[] = [];
  // members 먼저
  members.forEach(m => {
    assignableList.push({ id: m.id, name: m.name, source: "팀원" });
  });
  // 현장팀 사용자 중 members에 없는 사람 추가
  allUsers.filter(u => u.role === "field").forEach(u => {
    if (!assignableList.find(a => a.name === u.name)) {
      assignableList.push({ id: u.id || u.name, name: u.name, source: "현장팀" });
    }
  });

  return (
    <div className="px-4 py-3 bg-gray-50 space-y-3">
      {/* 완료 메시지 */}
      {importDone && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-center">
          <div className="text-sm font-bold text-green-700">✅ {importCount}건 가져오기 완료!</div>
          <button onClick={() => setImportDone(false)} className="mt-2 text-xs text-blue-500 font-medium">다시 가져오기</button>
        </div>
      )}

      {/* 캘린더 ID 입력 */}
      {!importDone && (
        <>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500">구글 캘린더 ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                placeholder="example@gmail.com 또는 캘린더ID"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button onClick={handleFetchEvents} disabled={loading} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold active:bg-blue-600 disabled:opacity-50 shrink-0">
                {loading ? "로딩..." : "가져오기"}
              </button>
            </div>
            <p className="text-xs text-gray-400">구글 캘린더 설정 → 캘린더 통합 → 캘린더 ID 복사</p>
          </div>

          {/* 저장된 캘린더 목록 */}
          {savedCalendars.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-500">저장된 캘린더 ({savedCalendars.length})</label>
                  <button onClick={() => setCheckedCals(prev => prev.size === savedCalendars.length ? new Set() : new Set(savedCalendars.map(c => c.id)))} className="text-[10px] text-blue-500 font-medium">
                    {checkedCals.size === savedCalendars.length ? "전체해제" : "전체선택"}
                  </button>
                </div>
                <div className="flex gap-1.5">
                  {checkedCals.size > 0 && (
                    <button onClick={() => {
                      const selected = savedCalendars.filter(c => checkedCals.has(c.id));
                      if (selected.length === 0) return;
                      setLoading(true); setError(""); setImportDone(false);
                      (async () => {
                        const allItems: typeof events = [];
                        for (const cal of selected) {
                          try {
                            const data = await fetchFromCalendar(cal.id);
                            if (data.status === "ok" && data.items) {
                              data.items.forEach((ev: { id: string; summary: string; date: string; description?: string }) => {
                                allItems.push({ id: ev.id + cal.id, summary: ev.summary || "(제목 없음)", date: ev.date || "", description: ev.description || "", selected: true, assignTo: cal.assignTo || "", calName: cal.name });
                              });
                            }
                          } catch {}
                        }
                        setEvents(allItems);
                        if (allItems.length === 0) setError("가져올 일정이 없습니다");
                        setLoading(false);
                      })();
                    }} disabled={loading} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold active:bg-blue-600 disabled:opacity-50">
                      {loading ? "로딩..." : `선택 가져오기 (${checkedCals.size})`}
                    </button>
                  )}
                  <button onClick={handleFetchAll} disabled={loading} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold active:bg-green-600 disabled:opacity-50">
                    {loading ? "로딩..." : "전체 가져오기"}
                  </button>
                </div>
              </div>
              {savedCalendars.map(cal => {
                const isChecked = checkedCals.has(cal.id);
                return (
                <div key={cal.id} className={`bg-white border rounded-lg px-2 py-1.5 space-y-1 ${isChecked ? "border-blue-400 bg-blue-50/30" : "border-gray-200"}`}>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={isChecked} onChange={() => setCheckedCals(prev => { const n = new Set(prev); n.has(cal.id) ? n.delete(cal.id) : n.add(cal.id); return n; })} className="w-4 h-4 accent-blue-500 shrink-0" />
                    <span className="flex-1 text-xs text-gray-700 truncate">📅 {cal.name}</span>
                    <button onClick={() => removeCalendarId(cal.id)} className="text-gray-300 active:text-red-500 shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <select value={cal.assignTo || ""} onChange={(e) => updateCalendarAssign(cal.id, e.target.value)}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs outline-none bg-gray-50">
                    <option value="">📋 배정탭으로 보내기</option>
                    {assignableList.map(a => (
                      <option key={a.id} value={a.id}>📅 {a.name} 달력으로 이동</option>
                    ))}
                  </select>
                </div>
                );
              })}
            </div>
          )}

          {/* 이동 시작 버튼 */}
          {savedCalendars.length > 0 && !importing && (
            <button
              onClick={async () => {
                const targetCals = checkedCals.size > 0 ? savedCalendars.filter(c => checkedCals.has(c.id)) : savedCalendars;
                const calsWithAssign = targetCals.filter(c => c.assignTo);
                if (calsWithAssign.length === 0) { setError("담당자를 선택해주세요"); return; }
                setImporting(true); setImportProgress(0); setError("");
                let count = 0;
                let total = 0;
                for (const cal of calsWithAssign) {
                  try {
                    const data = await fetchFromCalendar(cal.id);
                    if (data.status === "ok" && data.items) total += data.items.length;
                  } catch {}
                }
                let done = 0;
                for (const cal of calsWithAssign) {
                  try {
                    const data = await fetchFromCalendar(cal.id);
                    if (data.status === "ok" && data.items) {
                      for (const ev of data.items) {
                        try {
                          const created = await addUnassignedSchedule({ title: ev.summary || "(제목 없음)", date: ev.date || "", startTime: "09:00", endTime: "18:00", note: ev.description || "" });
                          if (created?.id) await assignScheduleApi(created.id, cal.assignTo, savedCalendars.find(c => c.id === cal.id)?.name || "");
                          count++;
                        } catch {}
                        done++;
                        setImportProgress(total > 0 ? Math.round((done / total) * 100) : 0);
                      }
                    }
                  } catch {}
                }
                setImporting(false); setImportCount(count); setImportDone(true); onImported();
              }}
              disabled={(() => { const t = checkedCals.size > 0 ? savedCalendars.filter(c => checkedCals.has(c.id)) : savedCalendars; return t.filter(c => c.assignTo).length === 0; })()}
              className="w-full py-3 rounded-xl text-sm font-bold text-white active:opacity-90 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #00c473, #00a35e)" }}
            >
              {checkedCals.size > 0 ? `선택 ${checkedCals.size}개 이동 시작` : "이동 시작"}
            </button>
          )}

          {/* 진행률 */}
          {importing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-blue-600">이동 중...</span>
                <span className="font-bold text-blue-700">{importProgress}%</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
              </div>
            </div>
          )}

          {error && <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">{error}</div>}
        </>
      )}
    </div>
  );
}


/* ════════════ 활동 지역 지도 ════════════ */
declare global {
  interface Window {
    naver: {
      maps: {
        Map: new (el: HTMLElement, opts: Record<string, unknown>) => NaverMap;
        LatLng: new (lat: number, lng: number) => NaverLatLng;
        Marker: new (opts: Record<string, unknown>) => unknown;
        Circle: new (opts: Record<string, unknown>) => unknown;
        Event: { addListener: (instance: unknown, eventName: string, handler: () => void) => void };
        LatLngBounds: new (sw: NaverLatLng, ne: NaverLatLng) => NaverBounds;
      };
    };
  }
}
interface NaverLatLng { lat: () => number; lng: () => number }
interface NaverBounds { extend: (latlng: NaverLatLng) => void }
interface NaverMap { fitBounds: (bounds: NaverBounds, padding?: Record<string, number>) => void; setCenter: (latlng: NaverLatLng) => void; setZoom: (z: number) => void }

// 주요 관리점 기본 좌표 (주소 geocoding 실패 시 사용)
const BRANCH_COORDS: Record<string, { lat: number; lng: number }> = {
  "천안": { lat: 36.8151, lng: 127.1139 },
  "인천": { lat: 37.4563, lng: 126.7052 },
  "서울": { lat: 37.5665, lng: 126.9780 },
  "수원": { lat: 37.2636, lng: 127.0286 },
  "성남": { lat: 37.4200, lng: 127.1267 },
  "평택": { lat: 36.9920, lng: 127.0889 },
  "화성": { lat: 37.1994, lng: 126.8313 },
  "부천": { lat: 37.5034, lng: 126.7660 },
  "의정부": { lat: 37.7381, lng: 127.0337 },
  "춘천": { lat: 37.8813, lng: 127.7298 },
  "대전": { lat: 36.3504, lng: 127.3845 },
  "세종": { lat: 36.4800, lng: 127.2590 },
  "청주": { lat: 36.6424, lng: 127.4890 },
  "아산": { lat: 36.7898, lng: 127.0018 },
  "용인": { lat: 37.2411, lng: 127.1776 },
  "광주": { lat: 37.4095, lng: 127.2553 },
  "안양": { lat: 37.3943, lng: 126.9568 },
  "시흥": { lat: 37.3800, lng: 126.8030 },
  "김포": { lat: 37.6153, lng: 126.7156 },
  "파주": { lat: 37.7600, lng: 126.7800 },
  "고양": { lat: 37.6584, lng: 126.8320 },
  "일산": { lat: 37.6660, lng: 126.7695 },
};

const BRANCH_COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316", "#14B8A6", "#6366F1"];

function MapToggle({ allUsers }: { allUsers: { id?: string; name: string; role?: string; address?: string; branch?: string }[] }) {
  const [showMap, setShowMap] = useState(false);
  return (
    <div className="divide-y divide-gray-100">
      <button
        onClick={() => setShowMap(!showMap)}
        className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-gray-50"
      >
        <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-gray-800">활동 지역 지도</div>
          <div className="text-xs text-gray-400">관리점별 현장팀 활동 가능 지역</div>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${showMap ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </button>
      {showMap && <BranchMap allUsers={allUsers} />}
    </div>
  );
}

export function BranchMap({ allUsers, isAdmin = false }: { allUsers: { id?: string; name: string; role?: string; address?: string; branch?: string }[]; isAdmin?: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInitialized = useRef(false);
  const [ready, setReady] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userRadii, setUserRadii] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("map_user_radii") || "{}"); } catch { return {}; }
  });
  const [customPositions, setCustomPositions] = useState<Record<string, { lat: number; lng: number }>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("map_custom_positions") || "{}"); } catch { return {}; }
  });
  const circlesRef = useRef<Record<string, unknown>>({});

  function saveCustomPosition(name: string, lat: number, lng: number) {
    setCustomPositions(prev => {
      const next = { ...prev, [name]: { lat, lng } };
      localStorage.setItem("map_custom_positions", JSON.stringify(next));
      return next;
    });
  }

  // 팀원 목록 (관리점 기준 분산 좌표)
  const userList = useMemo(() => {
    const branchUsers: Record<string, string[]> = {};
    for (const u of allUsers) {
      if (!u.branch) continue;
      const bname = u.branch.replace(/\[관리점\]/, "").trim();
      if (!bname || !BRANCH_COORDS[bname]) continue;
      if (!branchUsers[bname]) branchUsers[bname] = [];
      branchUsers[bname].push(u.name);
    }
    const result: { name: string; branch: string; lat: number; lng: number; color: string }[] = [];
    const branches = Object.keys(branchUsers);
    branches.forEach((bname, bi) => {
      const coord = BRANCH_COORDS[bname];
      const users = branchUsers[bname];
      const color = BRANCH_COLORS[bi % BRANCH_COLORS.length];
      users.forEach((uname, ui) => {
        const custom = customPositions[uname];
        if (custom) {
          result.push({ name: uname, branch: bname, lat: custom.lat, lng: custom.lng, color });
        } else {
          const angle = (2 * Math.PI * ui) / Math.max(users.length, 1) - Math.PI / 2;
          const spread = 0.025 + (ui % 3) * 0.01;
          result.push({ name: uname, branch: bname, lat: coord.lat + Math.cos(angle) * spread, lng: coord.lng + Math.sin(angle) * spread * 1.3, color });
        }
      });
    });
    return result;
  }, [allUsers, customPositions]);

  useEffect(() => {
    const check = setInterval(() => {
      if (window.naver?.maps) { setReady(true); clearInterval(check); }
    }, 200);
    return () => clearInterval(check);
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || userList.length === 0) return;
    if (mapInitialized.current) return; // 한 번만 생성
    mapInitialized.current = true;
    const N = window.naver.maps;

    const map = new N.Map(mapRef.current, {
      center: new N.LatLng(37.5665, 126.9780),
      zoom: 7,
      zoomControl: true,
      zoomControlOptions: { position: 3 },
      minZoom: 6,
    });

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

    userList.forEach((u) => {
      if (u.lat < minLat) minLat = u.lat;
      if (u.lat > maxLat) maxLat = u.lat;
      if (u.lng < minLng) minLng = u.lng;
      if (u.lng > maxLng) maxLng = u.lng;

      const pos = new N.LatLng(u.lat, u.lng);
      const marker = new N.Marker({
        position: pos,
        map,
        draggable: isAdmin,
        icon: {
          content: `<div class="map-pin" data-name="${u.name}" style="background:#fff;color:${u.color};padding:3px 8px;border-radius:10px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.15);border:1.5px solid ${u.color};${isAdmin ? "cursor:grab;" : "cursor:pointer;"}user-select:none">${u.name}</div>`,
          anchor: { x: 20, y: 10 },
        },
      });

      // 클릭 → 활동반경 원 표시/숨김
      N.Event.addListener(marker, "click", () => {
        setSelectedUser(prev => prev === u.name ? null : u.name);
      });

      // 활동반경 원 (숨김 상태로 생성)
      const circle = new N.Circle({
        map,
        center: pos,
        radius: (userRadii[u.name] || 15) * 1000,
        strokeColor: u.color,
        strokeWeight: 2,
        strokeOpacity: 0.5,
        fillColor: u.color,
        fillOpacity: 0.08,
        visible: false,
      });
      circlesRef.current[u.name] = circle;

      if (isAdmin) {
        N.Event.addListener(marker, "dragend", () => {
          const p = (marker as unknown as { getPosition: () => NaverLatLng }).getPosition();
          saveCustomPosition(u.name, p.lat(), p.lng());
          // 원도 이동
          (circle as unknown as { setCenter: (c: NaverLatLng) => void }).setCenter(p);
        });
      }
    });

    // 서울 중심 고정 (fitBounds 사용 안 함)
  }, [ready, userList]); // eslint-disable-line react-hooks/exhaustive-deps

  // 선택된 유저 원 표시/숨김
  useEffect(() => {
    for (const [name, circle] of Object.entries(circlesRef.current)) {
      const c = circle as unknown as { setVisible: (v: boolean) => void; setRadius: (r: number) => void };
      c.setVisible(name === selectedUser);
      if (name === selectedUser) c.setRadius((userRadii[name] || 15) * 1000);
    }
  }, [selectedUser, userRadii]);

  const selRadius = selectedUser ? (userRadii[selectedUser] || 15) : 15;

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 110px)" }}>
      {/* 지도 */}
      <div ref={mapRef} className="w-full flex-1">
        {!ready && <div className="flex items-center justify-center h-full text-gray-400 text-sm">지도 로딩 중...</div>}
      </div>
      {/* 선택된 팀원 반경 조절 - 대표만 슬라이더, 다른 사용자는 이름만 */}
      {selectedUser && !isAdmin && (
        <div className="px-4 py-2.5 bg-white border-t border-gray-200">
          <span className="text-xs font-bold text-gray-700">{selectedUser} · 활동반경 {userRadii[selectedUser] || 15}km</span>
        </div>
      )}
      {isAdmin && selectedUser && (
        <div className="px-4 py-3 bg-white border-t border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700">{selectedUser}</span>
            <input type="range" min={5} max={50} step={5} value={selRadius} onChange={(e) => {
              const next = { ...userRadii, [selectedUser]: Number(e.target.value) };
              setUserRadii(next);
              localStorage.setItem("map_user_radii", JSON.stringify(next));
            }} className="flex-1 accent-blue-500" />
            <span className="text-xs font-bold text-blue-600 w-12 text-right">{selRadius}km</span>
          </div>
        </div>
      )}
      {userList.length === 0 && (
        <div className="py-8 text-center text-gray-400 text-sm">
          관리점이 설정된 현장팀이 없습니다
        </div>
      )}
    </div>
  );
}
