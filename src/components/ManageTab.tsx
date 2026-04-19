"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { Schedule } from "@/types";
import { fetchDeletedSchedules, restoreScheduleApi, emptyTrashApi, deleteAllSchedules, fetchSchedules, addUnassignedSchedule, assignScheduleApi, createSchedule } from "@/lib/api";
import { showAlert, showConfirm } from "@/lib/dialog";

const NoticeTab = dynamic(() => import("./NoticeTab"), { ssr: false });

type ManageSubTab = "sales-stats" | "field" | "scheduler" | "ceo";

interface ManageTabProps {
  isAdmin: boolean;
  userRole: string;
  userName?: string;
  allUsers?: { id?: string; name: string; username?: string; role?: string; address?: string; branch?: string }[];
  members?: { id: string; name: string; linkedUsername?: string }[];
  schedules?: Schedule[];
  onRefresh: () => void;
  onNavigateToAssign?: () => void;
  onNavigateToCalendar?: () => void;
}

export default function ManageTab({ isAdmin, userRole, userName = "", allUsers = [], members = [], schedules = [], onRefresh, onNavigateToAssign, onNavigateToCalendar }: ManageTabProps) {
  // 역할별 기본 탭
  const isTopAdmin = userRole === "ceo" || userRole === "admin";
  const defaultTab: ManageSubTab =
    isTopAdmin ? "ceo" :
    userRole === "sales" ? "sales-stats" :
    userRole === "field" ? "field" :
    userRole === "scheduler" ? "scheduler" : "sales-stats";

  const [activeSubTab, setActiveSubTab] = useState<ManageSubTab>(defaultTab);

  // 표시할 탭 결정
  const tabs: { id: ManageSubTab; label: string }[] = [];
  if (isTopAdmin) {
    tabs.push({ id: "ceo", label: userRole === "admin" ? "관리자" : "대표" });
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
        <CeoSection onRefresh={onRefresh} allUsers={allUsers} members={members} schedules={schedules} />
      )}

      {/* 영업팀 탭 */}
      {activeSubTab === "sales-stats" && (
        <SalesStatsSection userName={userName} userRole={userRole} allUsers={allUsers} schedules={schedules} />
      )}

      {/* 현장팀 탭 */}
      {activeSubTab === "field" && (
        <FieldStatsSection allUsers={allUsers} schedules={schedules} />
      )}

      {/* 일정관리 탭 */}
      {activeSubTab === "scheduler" && (
        <div className="px-4 py-6 space-y-2">
          <div className="text-xs font-bold text-gray-500 mb-2">빠른 이동</div>
          {onNavigateToAssign && (
            <button
              onClick={onNavigateToAssign}
              className="w-full px-4 py-4 bg-white border border-gray-200 rounded-xl flex items-center gap-3 active:bg-gray-50"
            >
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-bold text-gray-800">배정 탭으로 이동</div>
                <div className="text-xs text-gray-400">미배정 일정 배정하러 가기</div>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          {onNavigateToCalendar && (
            <button
              onClick={onNavigateToCalendar}
              className="w-full px-4 py-4 bg-white border border-gray-200 rounded-xl flex items-center gap-3 active:bg-gray-50"
            >
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-bold text-gray-800">달력 탭으로 이동</div>
                <div className="text-xs text-gray-400">전체 일정 캘린더 보기</div>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* 일정 통계 */}
          <div className="pt-4">
            <div className="text-xs font-bold text-gray-500 mb-2">일정 통계</div>
            <SchedulerStats />
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════ 일정 통계 섹션 ════════════ */
function SchedulerStats() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [unassignedAll, setUnassignedAll] = useState<Schedule[]>([]);
  const [assignedAll, setAssignedAll] = useState<Schedule[]>([]);
  const [monthsToShow, setMonthsToShow] = useState(6);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // /api/schedules (range 없음) = 전체 배정된 일정
      // /api/schedules?unassigned=true = 미배정 전체
      const [all, un] = await Promise.all([
        fetchSchedules(),
        fetch("/api/schedules?unassigned=true").then((r) => r.json()).catch(() => []),
      ]);
      // fetchSchedules()은 배정된 일정만 — 중복 방지용으로 unassigned 로 구분
      setAssignedAll(Array.isArray(all) ? all : []);
      setUnassignedAll(Array.isArray(un) ? un : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로딩 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const assignedCount = assignedAll.length;
    const unassignedCount = unassignedAll.length;
    const total = assignedCount + unassignedCount;

    // 월별 집계 (YYYY-MM → { assigned, unassigned, total })
    const byMonth = new Map<string, { assigned: number; unassigned: number }>();
    const ensure = (ym: string) => {
      if (!byMonth.has(ym)) byMonth.set(ym, { assigned: 0, unassigned: 0 });
      return byMonth.get(ym)!;
    };
    for (const s of assignedAll) {
      if (!s.date) continue;
      ensure(s.date.slice(0, 7)).assigned++;
    }
    for (const s of unassignedAll) {
      if (!s.date) continue;
      ensure(s.date.slice(0, 7)).unassigned++;
    }
    // 최신 월 먼저
    const monthly = [...byMonth.entries()]
      .map(([ym, v]) => ({ ym, assigned: v.assigned, unassigned: v.unassigned, total: v.assigned + v.unassigned }))
      .sort((a, b) => (a.ym < b.ym ? 1 : -1));

    return { assignedCount, unassignedCount, total, monthly };
  }, [assignedAll, unassignedAll]);

  if (loading) {
    return <div className="px-2 py-6 text-center text-xs text-gray-400">불러오는 중...</div>;
  }
  if (error) {
    return (
      <div className="px-2 py-4 text-center text-xs text-red-500">
        {error}
        <button onClick={load} className="ml-2 underline">다시 시도</button>
      </div>
    );
  }

  const visibleMonths = stats.monthly.slice(0, monthsToShow);
  const hasMore = stats.monthly.length > monthsToShow;

  return (
    <div className="space-y-2">
      {/* 총합 카드 3개 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
          <div className="text-[10px] font-medium text-orange-600">배정 탭 (미배정)</div>
          <div className="mt-1 text-xl font-bold text-orange-700">{stats.unassignedCount.toLocaleString("ko-KR")}</div>
          <div className="text-[10px] text-orange-500">건</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="text-[10px] font-medium text-blue-600">달력 (배정완료)</div>
          <div className="mt-1 text-xl font-bold text-blue-700">{stats.assignedCount.toLocaleString("ko-KR")}</div>
          <div className="text-[10px] text-blue-500">건</div>
        </div>
        <div className="rounded-xl border border-gray-300 bg-gray-50 p-3">
          <div className="text-[10px] font-medium text-gray-600">합계</div>
          <div className="mt-1 text-xl font-bold text-gray-800">{stats.total.toLocaleString("ko-KR")}</div>
          <div className="text-[10px] text-gray-500">건</div>
        </div>
      </div>

      {/* 월별 집계 */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700">월별</span>
          <button onClick={load} className="text-[11px] text-blue-500 active:underline">새로고침</button>
        </div>
        {visibleMonths.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-400">데이터 없음</div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-2 text-[10px] text-gray-400">
              <span>월</span>
              <span className="w-10 text-right">미배정</span>
              <span className="w-10 text-right">달력</span>
              <span className="w-12 text-right font-bold">합계</span>
            </div>
            {visibleMonths.map((m) => (
              <div key={m.ym} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-2 text-xs">
                <span className="text-gray-700 font-medium">{m.ym.replace("-", ".")}</span>
                <span className="w-10 text-right text-orange-600">{m.unassigned.toLocaleString("ko-KR")}</span>
                <span className="w-10 text-right text-blue-600">{m.assigned.toLocaleString("ko-KR")}</span>
                <span className="w-12 text-right font-bold text-gray-800">{m.total.toLocaleString("ko-KR")}</span>
              </div>
            ))}
          </div>
        )}
        {hasMore && (
          <button
            onClick={() => setMonthsToShow((n) => n + 12)}
            className="w-full py-2 text-xs text-blue-500 active:bg-blue-50"
          >
            더보기 ({stats.monthly.length - monthsToShow}개월 더)
          </button>
        )}
      </div>
    </div>
  );
}


/* ════════════ 대표 전용 섹션 ════════════ */
function CeoSection({ onRefresh, allUsers, members, schedules }: {
  onRefresh: () => void;
  allUsers: { id?: string; name: string; username?: string; role?: string; address?: string; branch?: string }[];
  members: { id: string; name: string; linkedUsername?: string }[];
  schedules: Schedule[];
}) {
  const [trashItems, setTrashItems] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showGoogleImport, setShowGoogleImport] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const totalCount = schedules.length;

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
    showAlert(`${result.deleted}건 삭제 완료`);
  }

  async function handleBackup() {
    const blob = new Blob([JSON.stringify(schedules, null, 2)], { type: "application/json" });
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

      {/* 공지사항 발송 */}
      <button onClick={() => setShowNotice(!showNotice)} className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-gray-50">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-gray-800">공지사항 발송</div>
          <div className="text-xs text-gray-400">서버 점검 등 전체 공지 + 푸시 알림</div>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${showNotice ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </button>

      {showNotice && (
        <div className="bg-gray-50"><NoticeTab /></div>
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
        onClick={() => { showConfirm(`전체 ${totalCount}건 일정을 모두 삭제합니다. 정말 삭제하시겠습니까?`).then((ok) => { if (ok) handleDeleteAll(); }); }}
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


/* ════════════ 현장팀 통계 섹션 ════════════ */
function FieldStatsSection({ allUsers, schedules }: {
  allUsers: { id?: string; name: string; username?: string; role?: string; address?: string; branch?: string }[];
  schedules: Schedule[];
}) {
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 이번달 일정만
  const monthScheds = useMemo(() => schedules.filter(s => s.date.startsWith(curMonth) && s.status !== "unassigned"), [schedules, curMonth]);

  // AS 판정: 제목에 "AS", "A/S", "재방문" 포함
  const isAS = (title: string) => /AS|A\/S|재방문/i.test(title);

  // 팀원별 통계 (현장팀 기준)
  const memberStats = useMemo(() => {
    const stats: Record<string, { name: string; total: number; as: number; completed: number; branch: string }> = {};
    const fieldUsers = allUsers.filter(u => u.role === "field");
    for (const u of fieldUsers) {
      const branch = (u.branch || "").replace(/\[관리점\]/, "").trim() || "미지정";
      stats[u.name] = { name: u.name, total: 0, as: 0, completed: 0, branch };
    }
    for (const s of monthScheds) {
      const name = s.memberName;
      if (!stats[name]) continue;
      stats[name].total++;
      if (isAS(s.title)) stats[name].as++;
      if (s.status === "completed") stats[name].completed++;
    }
    return Object.values(stats).filter(s => s.total > 0).sort((a, b) => b.total - a.total);
  }, [monthScheds, allUsers]);

  // 우수팀 TOP 3 (AS 발생률 낮고 + 작업 많은 순)
  const topTeam = useMemo(() => {
    return [...memberStats]
      .filter(s => s.total >= 1)
      .sort((a, b) => {
        const rateA = a.as / a.total;
        const rateB = b.as / b.total;
        if (rateA !== rateB) return rateA - rateB;
        return b.total - a.total;
      })
      .slice(0, 3);
  }, [memberStats]);

  // 관리점별 AS 집계
  const branchStats = useMemo(() => {
    const map: Record<string, { name: string; total: number; as: number }> = {};
    for (const m of memberStats) {
      if (!map[m.branch]) map[m.branch] = { name: m.branch, total: 0, as: 0 };
      map[m.branch].total += m.total;
      map[m.branch].as += m.as;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [memberStats]);

  return (
    <div className="px-4 py-4 space-y-5">
      {/* 이번달 헤더 */}
      <div className="text-center">
        <div className="text-xs text-gray-400">{curMonth.replace("-", "년 ")}월</div>
        <div className="text-lg font-extrabold text-gray-800">현장팀 실적</div>
      </div>

      {/* 우수팀 TOP 3 */}
      <div>
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">🏆 이번달 우수팀</div>
        {topTeam.length === 0 ? (
          <div className="py-6 text-center text-gray-400 text-sm bg-gray-50 rounded-xl">아직 집계된 실적이 없습니다</div>
        ) : (
          <div className="space-y-2">
            {topTeam.map((m, i) => {
              const medals = ["🥇", "🥈", "🥉"];
              const bgs = ["bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300", "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300", "bg-gradient-to-r from-orange-50 to-red-50 border-orange-300"];
              const asRate = m.total > 0 ? Math.round((m.as / m.total) * 100) : 0;
              return (
                <div key={m.name} className={`border rounded-xl p-3 ${bgs[i]}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{medals[i]}</span>
                      <div>
                        <div className="text-sm font-bold text-gray-800">{m.name}</div>
                        <div className="text-[10px] text-gray-500">{m.branch}[관리점]</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-extrabold text-gray-800">{m.total}건</div>
                      <div className="text-[10px] text-gray-500">AS {asRate}% ({m.as}건)</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 관리점별 AS 발생률 */}
      <div>
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">📍 관리점별 AS 발생률</div>
        {branchStats.length === 0 ? (
          <div className="py-6 text-center text-gray-400 text-sm bg-gray-50 rounded-xl">데이터 없음</div>
        ) : (
          <div className="space-y-2">
            {branchStats.map(b => {
              const rate = b.total > 0 ? (b.as / b.total) * 100 : 0;
              const rateStr = rate.toFixed(1);
              const rateColor = rate < 5 ? "bg-green-500" : rate < 10 ? "bg-yellow-500" : rate < 20 ? "bg-orange-500" : "bg-red-500";
              const rateText = rate < 5 ? "text-green-600" : rate < 10 ? "text-yellow-600" : rate < 20 ? "text-orange-600" : "text-red-600";
              return (
                <div key={b.name} className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-gray-800">{b.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{b.total}건</span>
                      <span className={`text-xs font-bold ${rateText}`}>AS {rateStr}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${rateColor} rounded-full transition-all`} style={{ width: `${Math.min(rate, 100)}%` }} />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    전체 {b.total}건 중 AS {b.as}건
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 팀원별 상세 */}
      <div>
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">👥 팀원별 현황</div>
        {memberStats.length === 0 ? (
          <div className="py-6 text-center text-gray-400 text-sm bg-gray-50 rounded-xl">데이터 없음</div>
        ) : (
          <div className="space-y-1.5">
            {memberStats.map(m => {
              const rate = m.total > 0 ? (m.as / m.total) * 100 : 0;
              return (
                <div key={m.name} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800 truncate">{m.name}</span>
                    <span className="text-[10px] text-gray-400">{m.branch}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    <span className="text-blue-600 font-medium">{m.total}건</span>
                    {m.as > 0 && <span className="text-red-500">AS {m.as}</span>}
                    <span className="text-gray-400">{rate.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-2 bg-blue-50 rounded-lg text-[10px] text-blue-600 text-center">
        ℹ️ AS 판정: 제목에 &quot;AS&quot;, &quot;A/S&quot;, &quot;재방문&quot; 포함 시
      </div>
    </div>
  );
}


/* ════════════ 영업팀 통계 섹션 ════════════ */
function SalesStatsSection({ userName, userRole, allUsers, schedules }: {
  userName: string;
  userRole: string;
  allUsers: { id?: string; name: string; username?: string; role?: string; address?: string; branch?: string }[];
  schedules: Schedule[];
}) {
  const [filterMode, setFilterMode] = useState<"month" | "date">("month");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  // 필터링된 일정
  const filteredSchedules = filterMode === "month"
    ? schedules.filter(s => s.date.startsWith(selectedMonth))
    : schedules.filter(s => s.date === selectedDate);

  const isCeo = userRole === "ceo" || userRole === "admin";

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
                if (targetCals.length === 0) { setError("캘린더를 선택해주세요"); return; }
                setImporting(true); setImportProgress(0); setError("");
                let count = 0;
                let total = 0;
                for (const cal of targetCals) {
                  try {
                    const data = await fetchFromCalendar(cal.id);
                    if (data.status === "ok" && data.items) total += data.items.length;
                  } catch {}
                }
                let done = 0;
                for (const cal of targetCals) {
                  try {
                    const data = await fetchFromCalendar(cal.id);
                    if (data.status === "ok" && data.items) {
                      for (const ev of data.items) {
                        try {
                          const created = await addUnassignedSchedule({ title: ev.summary || "(제목 없음)", date: ev.date || "", startTime: "09:00", endTime: "18:00", note: ev.description || "" });
                          // assignTo 가 있으면 달력탭으로 배정, 없으면 배정탭(미배정)으로 유지
                          if (created?.id && cal.assignTo) {
                            await assignScheduleApi(created.id, cal.assignTo, savedCalendars.find(c => c.id === cal.id)?.name || "");
                          }
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
              disabled={(() => { const t = checkedCals.size > 0 ? savedCalendars.filter(c => checkedCals.has(c.id)) : savedCalendars; return t.length === 0; })()}
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
  const [showCircles, setShowCircles] = useState(true);
  const [userRadii, setUserRadii] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("map_user_radii") || "{}"); } catch { return {}; }
  });
  const [customPositions, setCustomPositions] = useState<Record<string, { lat: number; lng: number }>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("map_custom_positions") || "{}"); } catch { return {}; }
  });
  const [hiddenPins, setHiddenPins] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set<string>(JSON.parse(localStorage.getItem("map_hidden_pins") || "[]")); } catch { return new Set(); }
  });
  const circlesRef = useRef<Record<string, unknown>>({});
  const markersRef = useRef<Record<string, unknown>>({});
  // 마커/원 전체 추적 - 동명이인이나 렌더 누적으로 인한 잔존 마커 방지
  const allMarkersRef = useRef<unknown[]>([]);
  const allCirclesRef = useRef<unknown[]>([]);

  function saveCustomPosition(name: string, lat: number, lng: number) {
    setCustomPositions(prev => {
      const next = { ...prev, [name]: { lat, lng } };
      localStorage.setItem("map_custom_positions", JSON.stringify(next));
      return next;
    });
  }

  function hidePin(name: string) {
    setHiddenPins(prev => {
      const next = new Set(prev); next.add(name);
      localStorage.setItem("map_hidden_pins", JSON.stringify(Array.from(next)));
      return next;
    });
    setSelectedUser(null);
  }

  function showAllPins() {
    setHiddenPins(new Set());
    localStorage.setItem("map_hidden_pins", "[]");
    mapInitialized.current = false;
    setReady(false);
    setTimeout(() => setReady(true), 50);
  }

  // 팀원 목록 - 모든 사용자 표시 (동명이인 포함, id 기반 구분)
  // 관리점 없어도 기본 위치 + 관리자가 드래그 가능
  const userList = useMemo(() => {
    // 동명이인 감지: 같은 이름 2회 이상이면 라벨에 구분자 붙임
    const nameCount: Record<string, number> = {};
    for (const u of allUsers) { nameCount[u.name] = (nameCount[u.name] || 0) + 1; }

    type Entry = { key: string; name: string; label: string; branch: string; lat: number; lng: number; color: string };
    const result: Entry[] = [];

    // 관리점별 그룹핑 (key = id || name)
    const branchGroups: Record<string, { key: string; name: string; label: string }[]> = {};
    const noBranchGroup: { key: string; name: string; label: string }[] = [];

    for (const u of allUsers) {
      const key = u.id || u.name;
      if (hiddenPins.has(key) || hiddenPins.has(u.name)) continue;
      const bname = u.branch ? u.branch.replace(/\[관리점\]/, "").trim() : "";
      const hasValidBranch = !!(bname && BRANCH_COORDS[bname]);
      // 동명이인이면 라벨에 관리점 표시 (ex. 김기수[천안], 김기수[평택])
      const label = nameCount[u.name] > 1
        ? `${u.name}[${bname || u.role || "?"}]`
        : u.name;
      if (hasValidBranch) {
        if (!branchGroups[bname]) branchGroups[bname] = [];
        branchGroups[bname].push({ key, name: u.name, label });
      } else {
        noBranchGroup.push({ key, name: u.name, label });
      }
    }

    const branches = Object.keys(branchGroups);
    branches.forEach((bname, bi) => {
      const coord = BRANCH_COORDS[bname];
      const users = branchGroups[bname];
      const color = BRANCH_COLORS[bi % BRANCH_COLORS.length];
      users.forEach((u, ui) => {
        const custom = customPositions[u.key] || customPositions[u.name];
        if (custom) {
          result.push({ key: u.key, name: u.name, label: u.label, branch: bname, lat: custom.lat, lng: custom.lng, color });
        } else {
          const angle = (2 * Math.PI * ui) / Math.max(users.length, 1) - Math.PI / 2;
          const spread = 0.025 + (ui % 3) * 0.01;
          result.push({ key: u.key, name: u.name, label: u.label, branch: bname, lat: coord.lat + Math.cos(angle) * spread, lng: coord.lng + Math.sin(angle) * spread * 1.3, color });
        }
      });
    });
    const defaultCoord = { lat: 37.5665, lng: 126.9780 };
    const defaultColor = "#6B7280";
    noBranchGroup.forEach((u, ui) => {
      const custom = customPositions[u.key] || customPositions[u.name];
      if (custom) {
        result.push({ key: u.key, name: u.name, label: u.label, branch: "미지정", lat: custom.lat, lng: custom.lng, color: defaultColor });
      } else {
        const angle = (2 * Math.PI * ui) / Math.max(noBranchGroup.length, 1);
        const spread = 0.03 + (ui % 4) * 0.01;
        result.push({
          key: u.key,
          name: u.name,
          label: u.label,
          branch: "미지정",
          lat: defaultCoord.lat + Math.cos(angle) * spread,
          lng: defaultCoord.lng + Math.sin(angle) * spread * 1.3,
          color: defaultColor,
        });
      }
    });
    return result;
  }, [allUsers, customPositions, hiddenPins]);

  useEffect(() => {
    const check = setInterval(() => {
      if (window.naver?.maps) { setReady(true); clearInterval(check); }
    }, 200);
    return () => clearInterval(check);
  }, []);

  // 지도 인스턴스 1회 생성
  const mapInstanceRef = useRef<unknown>(null);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (mapInitialized.current) return;
    mapInitialized.current = true;
    const N = window.naver.maps;
    mapInstanceRef.current = new N.Map(mapRef.current, {
      center: new N.LatLng(37.5665, 126.9780),
      zoom: 7,
      zoomControl: true,
      zoomControlOptions: { position: 3 },
      minZoom: 6,
    });
  }, [ready]);

  // 마커/원 rebuild - userList 변할 때마다 (신규 가입자, 숨긴 핀 반영)
  useEffect(() => {
    if (!ready || !mapInstanceRef.current) return;
    const N = window.naver.maps;
    const map = mapInstanceRef.current as { /* naver map */ };

    // 기존 마커/원 완전 제거 (동명이인이나 렌더 누적 대비 - 전체 배열 기준)
    allMarkersRef.current.forEach(m => {
      try { (m as { setMap: (v: null) => void }).setMap(null); } catch { /* */ }
    });
    allCirclesRef.current.forEach(c => {
      try { (c as { setMap: (v: null) => void }).setMap(null); } catch { /* */ }
    });
    allMarkersRef.current = [];
    allCirclesRef.current = [];
    markersRef.current = {};
    circlesRef.current = {};

    userList.forEach((u) => {
      const pos = new N.LatLng(u.lat, u.lng);
      const marker = new N.Marker({
        position: pos,
        map,
        draggable: isAdmin,
        icon: {
          content: `<div class="map-pin" data-key="${u.key}" style="background:#fff;color:${u.color};padding:3px 8px;border-radius:10px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.15);border:1.5px solid ${u.color};${isAdmin ? "cursor:grab;" : "cursor:pointer;"}user-select:none">${u.label}</div>`,
          anchor: { x: 20, y: 10 },
        },
      });
      markersRef.current[u.key] = marker;
      allMarkersRef.current.push(marker);

      N.Event.addListener(marker, "click", () => {
        if (isAdmin) setSelectedUser(prev => prev === u.key ? null : u.key);
      });

      const circle = new N.Circle({
        map,
        center: pos,
        radius: ((userRadii[u.key] ?? userRadii[u.name]) || 15) * 1000,
        strokeColor: u.color,
        strokeWeight: 2,
        strokeOpacity: 0.5,
        fillColor: u.color,
        fillOpacity: 0.08,
        visible: showCircles,
      });
      circlesRef.current[u.key] = circle;
      allCirclesRef.current.push(circle);

      if (isAdmin) {
        N.Event.addListener(marker, "dragend", () => {
          const p = (marker as unknown as { getPosition: () => NaverLatLng }).getPosition();
          saveCustomPosition(u.key, p.lat(), p.lng());
          (circle as unknown as { setCenter: (c: NaverLatLng) => void }).setCenter(p);
        });
      }
    });
  }, [ready, userList, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // 반경 실시간 반영 + 보기/끄기
  useEffect(() => {
    for (const [name, circle] of Object.entries(circlesRef.current)) {
      const c = circle as unknown as { setRadius: (r: number) => void; setVisible: (v: boolean) => void };
      c.setRadius((userRadii[name] || 15) * 1000);
      c.setVisible(showCircles);
    }
  }, [userRadii, showCircles]);

  const selRadius = selectedUser ? (userRadii[selectedUser] || 15) : 15;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* 지도 - 상단바(44px) + 하단바(56px) 제외한 전체 */}
      <div ref={mapRef} style={{ width: "100vw", height: "calc(100dvh - 100px)" }}>
        {!ready && <div className="flex items-center justify-center h-full text-gray-400 text-sm">지도 로딩 중...</div>}
      </div>
      {/* 활동범위 보기/끄기 */}
      <button
        onClick={() => setShowCircles(prev => !prev)}
        style={{ position: "absolute", top: 12, left: 12, zIndex: 10 }}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-md ${showCircles ? "bg-blue-500 text-white" : "bg-white text-gray-500 border border-gray-300"}`}
      >
        {showCircles ? "활동범위 끄기" : "활동범위 보기"}
      </button>
      {/* 숨긴 핀 전체 복원 - 관리자만 */}
      {isAdmin && hiddenPins.size > 0 && (
        <button
          onClick={showAllPins}
          style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}
          className="px-3 py-1.5 rounded-lg text-xs font-bold shadow-md bg-white text-gray-700 border border-gray-300 active:bg-gray-50"
        >
          숨긴 핀 복원 ({hiddenPins.size})
        </button>
      )}
      {/* 선택된 팀원 반경 조절 + 삭제 - 대표만 */}
      {isAdmin && selectedUser && (
        <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, zIndex: 10 }}>
          <div className="bg-white/95 backdrop-blur rounded-xl shadow-lg px-4 py-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700 shrink-0">{selectedUser}</span>
              <input type="range" min={5} max={50} step={5} value={selRadius} onChange={(e) => {
                const next = { ...userRadii, [selectedUser]: Number(e.target.value) };
                setUserRadii(next);
                localStorage.setItem("map_user_radii", JSON.stringify(next));
              }} className="flex-1 accent-blue-500" />
              <span className="text-xs font-bold text-blue-600 w-12 text-right">{selRadius}km</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 flex-1">드래그로 위치 이동 · 핀 삭제 가능</span>
              <button
                onClick={() => hidePin(selectedUser)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white active:bg-red-600"
              >
                핀 삭제
              </button>
            </div>
          </div>
        </div>
      )}
      {userList.length === 0 && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} className="text-gray-400 text-sm text-center">
          표시할 팀원이 없습니다
        </div>
      )}
    </div>
  );
}
