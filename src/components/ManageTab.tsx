"use client";

import { useState, useEffect, useCallback } from "react";
import { Schedule } from "@/types";
import { fetchDeletedSchedules, restoreScheduleApi, emptyTrashApi, deleteAllSchedules, fetchSchedules, addUnassignedSchedule, assignScheduleApi } from "@/lib/api";

type ManageSubTab = "sales-stats" | "field" | "scheduler" | "ceo";

interface ManageTabProps {
  isAdmin: boolean;
  userRole: string;
  userName?: string;
  allUsers?: { id?: string; name: string; username?: string; role?: string }[];
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
    <div className="h-full overflow-y-auto bg-white">
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
  allUsers: { id?: string; name: string; username?: string; role?: string }[];
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
  allUsers: { id?: string; name: string; username?: string; role?: string }[];
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


/* ════════════ 구글 캘린더 가져오기 (대표 전용) ════════════ */
function GoogleCalendarImport({ allUsers, members, onImported }: {
  allUsers: { id?: string; name: string; username?: string; role?: string }[];
  members: { id: string; name: string; linkedUsername?: string }[];
  onImported: () => void;
}) {
  const [calendarId, setCalendarId] = useState(() => typeof window !== "undefined" ? localStorage.getItem("google_calendar_id") || "" : "");
  const [events, setEvents] = useState<{ id: string; summary: string; date: string; description?: string; selected: boolean; assignTo: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [error, setError] = useState("");

  async function handleFetchEvents() {
    if (!calendarId.trim()) { setError("캘린더 ID를 입력해주세요"); return; }
    setLoading(true);
    setError("");
    setImportDone(false);
    localStorage.setItem("google_calendar_id", calendarId.trim());

    try {
      const refreshToken = localStorage.getItem("google_refresh_token");
      if (!refreshToken) {
        const authRes = await fetch(`/api/calendar?action=auth-url`);
        const authData = await authRes.json();
        if (authData.needSetup) {
          setError("Google Calendar API가 설정되지 않았습니다. 환경변수(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)를 확인하세요.");
        } else if (authData.authUrl) {
          window.location.href = `/api/calendar?action=auth-redirect`;
        } else {
          setError("인증 URL 생성 실패");
        }
        setLoading(false);
        return;
      }

      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto-sync", refreshToken, calendarId: calendarId.trim() }),
      });
      const data = await res.json();

      if (data.needReauth) {
        localStorage.removeItem("google_refresh_token");
        setError("인증이 만료되었습니다. 다시 가져오기를 눌러주세요.");
        setLoading(false);
        return;
      }

      if (data.error) { setError(data.error); setLoading(false); return; }

      const items = (data.items || []).map((ev: { id: string; summary?: string; start?: { date?: string; dateTime?: string }; description?: string }) => ({
        id: ev.id,
        summary: ev.summary || "(제목 없음)",
        date: ev.start?.date || (ev.start?.dateTime ? ev.start.dateTime.slice(0, 10) : ""),
        description: ev.description || "",
        selected: true,
        assignTo: "", // "" = 배정탭으로, member id = 직접 배정
      }));
      setEvents(items);
    } catch {
      setError("캘린더 연결 실패");
    }
    setLoading(false);
  }

  async function handleImport() {
    const toImport = events.filter(e => e.selected);
    if (toImport.length === 0) return;
    setImporting(true);

    let count = 0;
    for (const ev of toImport) {
      try {
        // 1. 미배정 일정으로 등록
        const created = await addUnassignedSchedule({
          title: ev.summary,
          date: ev.date,
          startTime: "09:00",
          endTime: "18:00",
          note: ev.description || "",
        });
        // 2. 담당자가 선택된 경우 바로 배정
        if (ev.assignTo && created?.id) {
          const member = members.find(m => m.id === ev.assignTo);
          if (member) {
            await assignScheduleApi(created.id, member.id, member.name);
          }
        }
        count++;
      } catch { /* 개별 실패 무시 */ }
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

          {error && <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">{error}</div>}

          {/* 이벤트 목록 */}
          {events.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600">{events.filter(e => e.selected).length}/{events.length}건 선택</span>
                <div className="flex gap-2">
                  <button onClick={() => toggleAll(true)} className="text-xs text-blue-500 font-medium">전체선택</button>
                  <button onClick={() => toggleAll(false)} className="text-xs text-gray-400 font-medium">전체해제</button>
                </div>
              </div>

              {/* 일괄 배정 */}
              <div className="bg-white border border-gray-200 rounded-xl p-2.5">
                <label className="text-xs font-bold text-gray-500 mb-1 block">선택된 일정 일괄 배정</label>
                <select
                  onChange={(e) => setAllAssign(e.target.value)}
                  className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs outline-none bg-white"
                  defaultValue=""
                >
                  <option value="">배정탭으로 보내기 (미배정)</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>📅 {m.name} 달력에 직접 배정</option>
                  ))}
                </select>
              </div>

              <div className="max-h-[40vh] overflow-y-auto space-y-1.5">
                {events.map((ev, idx) => (
                  <div key={ev.id} className={`border rounded-xl p-2.5 ${ev.selected ? "border-blue-300 bg-blue-50/50" : "border-gray-200 bg-white"}`}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={ev.selected}
                        onChange={(e) => setEvents(prev => prev.map((x, i) => i === idx ? { ...x, selected: e.target.checked } : x))}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-500 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{ev.summary}</div>
                        <div className="text-xs text-gray-400">{ev.date}</div>
                      </div>
                    </div>
                    {ev.selected && (
                      <select
                        value={ev.assignTo}
                        onChange={(e) => setEvents(prev => prev.map((x, i) => i === idx ? { ...x, assignTo: e.target.value } : x))}
                        className="mt-2 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white"
                      >
                        <option value="">📋 배정탭으로 보내기</option>
                        {members.map(m => (
                          <option key={m.id} value={m.id}>📅 {m.name} 달력에 직접 배정</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={handleImport}
                disabled={importing || events.filter(e => e.selected).length === 0}
                className="w-full py-3 bg-blue-500 text-white rounded-xl text-sm font-bold active:bg-blue-600 disabled:opacity-50"
              >
                {importing ? `가져오는 중...` : `${events.filter(e => e.selected).length}건 가져오기`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
