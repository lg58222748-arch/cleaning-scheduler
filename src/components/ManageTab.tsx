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
  unassignedSchedules?: Schedule[];
  onRefresh: () => void;
  onNavigateToAssign?: () => void;
  onNavigateToCalendar?: () => void;
}

export default function ManageTab({ isAdmin, userRole, userName = "", allUsers = [], members = [], schedules = [], unassignedSchedules = [], onRefresh, onNavigateToAssign, onNavigateToCalendar }: ManageTabProps) {
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
        <SalesStatsSection userName={userName} userRole={userRole} allUsers={allUsers} schedules={schedules} unassignedSchedules={unassignedSchedules} />
      )}

      {/* 현장팀 탭 — 통계는 일정관리 탭으로 이동 */}
      {activeSubTab === "field" && <FieldTeamGuide />}

      {/* 일정관리 탭 — 일정관리자/대표/관리자 전용 */}
      {activeSubTab === "scheduler" && (
        <div className="px-4 py-6 space-y-6">
          {/* 일정 통계 */}
          <div>
            <div className="text-xs font-bold text-gray-500 mb-2">일정 통계</div>
            <SchedulerStats />
          </div>
          {/* 팀원별 건수 (구 현장팀 탭) */}
          <div>
            <div className="text-xs font-bold text-gray-500 mb-2">팀원별 등록된 일정</div>
            <FieldStatsSection allUsers={allUsers} schedules={schedules} />
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
  const [monthsToShow, setMonthsToShow] = useState(12);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // /api/schedules (range 없음) = status≠deleted 인 전체 (미배정 포함)
      // /api/schedules?unassigned=true = 미배정(status=unassigned)만
      const [all, un] = await Promise.all([
        fetchSchedules(),
        fetch("/api/schedules?unassigned=true").then((r) => r.json()).catch(() => []),
      ]);
      // 이중 계산 방지: 달력 카운트에서 unassigned 제외
      const assignedOnly = (Array.isArray(all) ? all : []).filter((s) => s.status !== "unassigned");
      setAssignedAll(assignedOnly);
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


/* ════════════ 현장팀 사용 가이드 섹션 ════════════ */
function FieldTeamGuide() {
  const [openId, setOpenId] = useState<string | null>("calendar");

  const Section = ({ id, icon, title, children }: { id: string; icon: string; title: string; children: React.ReactNode }) => {
    const isOpen = openId === id;
    return (
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <button
          onClick={() => setOpenId(isOpen ? null : id)}
          className="w-full px-4 py-3 flex items-center justify-between active:bg-gray-50"
        >
          <span className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <span className="text-sm font-bold text-gray-800">{title}</span>
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {isOpen && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-sm text-gray-700 leading-relaxed space-y-3">
            {children}
          </div>
        )}
      </div>
    );
  };

  const Step = ({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) => (
    <div className="flex gap-3">
      <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">{n}</span>
      <div className="flex-1">
        <div className="text-sm font-bold text-gray-800">{title}</div>
        {children && <div className="text-xs text-gray-600 mt-1 leading-relaxed">{children}</div>}
      </div>
    </div>
  );

  const Tip = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-blue-50 border-l-4 border-blue-400 px-3 py-2 rounded-r-lg text-xs text-blue-900">
      💡 {children}
    </div>
  );

  const Warn = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-amber-50 border-l-4 border-amber-400 px-3 py-2 rounded-r-lg text-xs text-amber-900">
      ⚠️ {children}
    </div>
  );

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="text-center pb-2">
        <h2 className="text-base font-bold text-gray-800">현장팀 사용 가이드</h2>
        <p className="text-xs text-gray-500 mt-1">달력 / 검수 / 정산 / 고객 안내까지 단계별로</p>
      </div>

      {/* 1. 달력 사용법 */}
      <Section id="calendar" icon="📅" title="1. 달력 사용법">
        <Step n={1} title="달력 탭 → 본인 일정 확인">
          하단 메뉴 <b>달력</b> 탭에서 이번 달 본인 일정만 보입니다.<br/>
          (현장팀은 다른 팀원 일정 못 봄 — 본인 일정만)
        </Step>
        <Step n={2} title="일정 칩 색상 의미">
          • <span className="px-1 rounded" style={{ background: "#FDDCCC" }}>살몬</span> 일반 일정<br/>
          • <span className="px-1 rounded" style={{ background: "#D1FAE5" }}>연두</span> 완료된 일정<br/>
          • <span className="px-1 rounded" style={{ background: "#E9D5FF" }}>보라</span> 미입금 (제목에 /미입금 포함)
        </Step>
        <Step n={3} title="일정 클릭 → 상세 화면">
          일정 칩 탭하면 상세 화면 열림. 제목·메모·시간 등 확인.<br/>
          본인 일정이면 제목·메모 직접 수정 가능.
        </Step>
        <Step n={4} title="날짜 추가 (← 달력 아래 + 버튼)">
          날짜 칸 누르고 우측 상단 <b>+</b> → 새 일정 등록.<br/>
          시간대(오전/오후/시무) 선택 → 저장.
        </Step>
        <Tip>
          가까운 미래 한 달은 항상 빠르게 표시됩니다. 먼 미래(예: 3개월 후) 보려면 달력 위/아래 스와이프 하시면 됩니다.
        </Tip>
      </Section>

      {/* 2. 검수 (체크리스트) */}
      <Section id="checklist" icon="✅" title="2. 검수 (체크리스트)">
        <Step n={1} title="일정 상세 → '체크리스트' 탭">
          작업 끝나면 본인 일정 열고 <b>체크리스트</b> 탭으로 이동.
        </Step>
        <Step n={2} title="항목별 체크 + 사진 첨부">
          현관·거실·주방·욕실 등 항목별로 깨끗하게 했는지 체크.<br/>
          필요하면 사진도 첨부 (스마트폰 카메라 바로 호출).
        </Step>
        <Step n={3} title="특이사항 메모">
          현장에서 추가 작업 / 손상 발견 / 부재 시 안내 등 메모.<br/>
          (정산할 때 그대로 활용됨)
        </Step>
        <Step n={4} title="작업 완료 처리">
          모든 항목 체크 + 저장 → 일정 상태가 <b>완료(연두색)</b> 로 바뀜.
        </Step>
        <Warn>
          체크리스트 미완료 = 정산 못 함. 작업 끝나면 <b>꼭 그 자리에서</b> 체크 마무리하세요.
        </Warn>
      </Section>

      {/* 3. 정산서 발행 */}
      <Section id="settlement" icon="💰" title="3. 정산서 발행">
        <Step n={1} title="일정 상세 → '정산' 탭">
          체크리스트 끝낸 후 같은 화면에서 <b>정산</b> 탭으로 이동.
        </Step>
        <Step n={2} title="금액 확인 / 수정">
          영업팀이 미리 입력한 견적·예약금이 자동으로 들어와있음.<br/>
          현장 특이사항 비용 있으면 그 자리에서 추가 입력.
        </Step>
        <Step n={3} title="결제 방식 / 현금영수증">
          고객이 어떻게 결제할지 선택: 계좌이체 / 현금 / 카드.<br/>
          현금영수증 신청 여부도 체크 (부가세 자동 계산됨).
        </Step>
        <Step n={4} title="계좌 정보 입력 (한 번만)">
          본인 계좌 정보(은행/계좌번호/입금주)를 한 번 저장해두면 다음부터 자동으로 들어감.
        </Step>
        <Step n={5} title="정산서 발행 버튼 클릭">
          최종 금액 확인 후 <b>정산서 발행</b> 누르면 DB에 정산 데이터 저장 + 공유 모달 자동으로 열림.
        </Step>
        <Tip>
          정산서 발행을 누르지 않으면 DB에 정산 기록이 안 남아요. <b>꼭 발행 누르고 마무리</b>하세요.
        </Tip>
      </Section>

      {/* 4. 고객에게 정산서 전송 */}
      <Section id="send-customer" icon="📤" title="4. 고객에게 정산서 전송">
        <Step n={1} title="공유 모달 확인">
          정산서 발행 누르면 자동으로 모달 뜨고 미리보기 텍스트가 보임.<br/>
          금액·계좌·고객명 다 확인 후 다음 단계로.
        </Step>
        <Step n={2} title="문자 전송 OR 카카오톡 전송 선택">
          <div className="mt-1 space-y-1">
            <div>📩 <b>문자 전송</b>: 고객 연락처가 자동으로 들어간 문자 앱이 열림 → 보내기</div>
            <div>💛 <b>카카오톡 전송</b>: 카톡 공유 시트 열림 → 고객 채팅방 선택 → 전송</div>
          </div>
        </Step>
        <Step n={3} title="복사가 안 될 때">
          공유 안 되면 미리보기 텍스트가 자동으로 복사돼있음. 카톡 들어가서 <b>붙여넣기</b> 만 하면 됨.
        </Step>
        <Step n={4} title="잔금 받기">
          고객이 입금하면 정산서에서 <b>입금확인</b> 버튼 누름 → 제목에서 "/미입금" 빠지고 색상도 일반으로 돌아옴.
        </Step>
        <Warn>
          고객 연락처가 비어있으면 문자/카톡 보내는 사람 정보가 없어 직접 입력해야 합니다. 영업팀이 미리 입력하도록 부탁하세요.
        </Warn>
      </Section>

      {/* 5. 자주 묻는 질문 */}
      <Section id="faq" icon="❓" title="5. 자주 묻는 질문">
        <div className="space-y-3">
          <div>
            <div className="font-bold text-gray-800 text-sm">Q. 일정이 갑자기 안 보여요</div>
            <div className="text-xs text-gray-600 mt-1">
              앱 강제 종료 → 재실행 한 번 해보세요. 데이터는 서버에 있으니 절대 사라지지 않아요. 그래도 안 보이면 인터넷 연결 확인.
            </div>
          </div>
          <div>
            <div className="font-bold text-gray-800 text-sm">Q. 다른 팀장 일정도 보고 싶어요</div>
            <div className="text-xs text-gray-600 mt-1">
              현장팀끼리는 서로 일정 못 보게 설계됨. 본인 일정 + 본인이 배정된 일정만 보입니다.
            </div>
          </div>
          <div>
            <div className="font-bold text-gray-800 text-sm">Q. 일정 시간을 잘못 등록했어요</div>
            <div className="text-xs text-gray-600 mt-1">
              일정 클릭 → 상세에서 제목·시간·날짜 직접 수정 가능. 저장 누르면 다른 사람한테도 자동 반영.
            </div>
          </div>
          <div>
            <div className="font-bold text-gray-800 text-sm">Q. 카톡으로 정산서를 받았는데 못 봤다고 해요</div>
            <div className="text-xs text-gray-600 mt-1">
              스팸 처리됐을 수 있어요. 문자로 다시 보내거나, 직접 전화해서 카톡 확인 요청.
            </div>
          </div>
          <div>
            <div className="font-bold text-gray-800 text-sm">Q. 알림이 안 와요</div>
            <div className="text-xs text-gray-600 mt-1">
              핸드폰 설정 → 새집느낌 파트너 앱 → 알림 권한 ON 확인. 잠금화면·진동 권한도 같이 켜주세요.
            </div>
          </div>
        </div>
      </Section>

      <div className="text-center text-[10px] text-gray-400 pt-2">
        문제 있으면 관리자(대표)에게 카톡으로 문의해주세요 🙏
      </div>
    </div>
  );
}

/* ════════════ 현장팀 통계 섹션 ════════════ */
// 지역 정렬 우선순위 — 수도권 → 충청 → 영남 순. 미지정은 항상 맨 마지막.
const REGION_PRIORITY = [
  "서울", "경기", "인천",
  "수원", "화성", "동탄", "오산", "안산", "평택",
  "천안", "아산",
  "대전", "청주",
  "부산", "대구", "울산",
];
function regionRank(branch: string): number {
  const b = (branch || "").trim();
  if (!b || b === "미지정") return 9999; // 맨 마지막
  for (let i = 0; i < REGION_PRIORITY.length; i++) {
    if (b.includes(REGION_PRIORITY[i])) return i;
  }
  return 9998; // 기타 지역 — 미지정 바로 위
}

// 팀장별 월간 희망 배정 갯수 (이름 끝부분으로 매칭 — 예: "이동환" → "동환" → 250)
const DESIRED_COUNTS: Record<string, number> = {
  "동환": 250, "기열": 50, "지혜": 50, "성원": 50, "승우": 50,
  "진관": 50, "예완": 40, "형욱": 40, "상태": 50, "규민": 44,
  "두용": 50, "인범": 44, "진희": 44, "인혁": 30, "인홍": 50,
  "로운": 50, "조용": 50,
  "요석": 50, "근환": 50, "재준": 50,
};
function getDesiredCount(fullName: string): number {
  if (DESIRED_COUNTS[fullName] !== undefined) return DESIRED_COUNTS[fullName];
  for (const short of Object.keys(DESIRED_COUNTS)) {
    if (fullName.endsWith(short)) return DESIRED_COUNTS[short];
  }
  return 0;
}

// 일정의 memberName 을 회원 이름으로 정규화
// 예: "A서승우(화성)" → ["서승우"], "A김상준,김지혜(의정부)" → ["김상준","김지혜"], "이동환(충경)" → ["이동환"]
function normalizeMemberName(raw: string): string[] {
  const cleaned = raw
    .replace(/^[A-Z]\s*/, "")     // 선두 영문 prefix (A/T/Z 등) 제거
    .replace(/\([^)]*\)/g, "")     // 괄호 안 지역 표기 제거
    .trim();
  return cleaned.split(",").map((s) => s.trim()).filter(Boolean);
}

// 카운트에서 제외할 일정 판별 (제목에 "휴무" 또는 "마감" 포함)
function isOffDay(title: string | null | undefined): boolean {
  return !!title && /휴무|마감/.test(title);
}

function FieldStatsSection({ allUsers }: {
  allUsers: { id?: string; name: string; username?: string; role?: string; address?: string; branch?: string }[];
  schedules: Schedule[];
}) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(false);
  const [monthSchedules, setMonthSchedules] = useState<Schedule[]>([]);
  // 정렬 모드: count(현재배정 많은 순) | branch(지역 가나다 순)
  const [sortMode, setSortMode] = useState<"count" | "branch">("count");
  // 보기 모드: month(팀원별 합계) | day(일별)
  const [viewMode, setViewMode] = useState<"month" | "day">("month");
  // 일별 보기에서 펼친 날짜
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  // 일별 펼침 안 팀장 그룹 정렬: count | branch
  const [dayGroupSort, setDayGroupSort] = useState<"count" | "branch">("count");
  // 일별 펼침 안 지역 필터 (빈 문자열 = 전체)
  const [dayRegionFilter, setDayRegionFilter] = useState<string>("");

  const monthLabel = `${selectedMonth.slice(0, 4)}년 ${Number(selectedMonth.slice(5))}월`;

  // 선택한 월의 일정 직접 조회 (props 의 ±1 달 한계 회피)
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const year = Number(selectedMonth.slice(0, 4));
      const mon = Number(selectedMonth.slice(5));
      const start = `${selectedMonth}-01`;
      const lastDay = new Date(year, mon, 0).getDate();
      const end = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;
      const data = await fetchSchedules(start, end);
      setMonthSchedules(data || []);
    } catch {
      setMonthSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => { load(); }, [load]);

  // 달력에 있는 일정 (미배정 + 휴무/마감 제외 = 실제 작업 일정)
  const inCalendar = useMemo(
    () => monthSchedules.filter((s) => s.status !== "unassigned" && !isOffDay(s.title)),
    [monthSchedules]
  );

  // 팀원 이름 → 지역 매핑 (field role 사용자 기준, 정규화된 이름 → branch)
  const memberBranchMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of allUsers) {
      if (u.role !== "field" && u.role !== "ceo") continue;
      const branch = (u.branch || "").replace(/\[관리점\]/, "").trim() || "미지정";
      map.set(u.name, branch);
    }
    return map;
  }, [allUsers]);

  // 사용 가능한 모든 지역 목록 (필터 드롭다운용) — 우선순위 정렬
  const allRegions = useMemo(() => {
    const set = new Set<string>();
    for (const u of allUsers) {
      if (u.role !== "field" && u.role !== "ceo") continue;
      const branch = (u.branch || "").replace(/\[관리점\]/, "").trim();
      if (branch) set.add(branch);
    }
    return Array.from(set).sort((a, b) => {
      const ra = regionRank(a);
      const rb = regionRank(b);
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b, "ko");
    });
  }, [allUsers]);

  // 현장팀 팀원별 달력 건수 (이름 표기 정규화 — "A서승우(화성)" 등 변형도 같은 사람으로 카운트)
  const memberRows = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of inCalendar) {
      if (!s.memberName) continue;
      const names = normalizeMemberName(s.memberName);
      for (const n of names) {
        counts[n] = (counts[n] || 0) + 1;
      }
    }
    const fieldUsers = allUsers.filter((u) => u.role === "field");
    const rows = fieldUsers.map((u) => ({
      name: u.name,
      branch: (u.branch || "").replace(/\[관리점\]/, "").trim() || "미지정",
      count: counts[u.name] || 0,
      desired: getDesiredCount(u.name),
    }));
    if (sortMode === "branch") {
      // 지역 우선순위(서울→경기→천안...→미지정 마지막) → 같은 지역은 건수 많은 순
      return rows.sort((a, b) => {
        const ra = regionRank(a.branch);
        const rb = regionRank(b.branch);
        if (ra !== rb) return ra - rb;
        return b.count - a.count;
      });
    }
    // 기본: 건수 많은 순
    return rows.sort((a, b) => b.count - a.count);
  }, [inCalendar, allUsers, sortMode]);

  // 일별 집계 (날짜순) — 각 날짜의 일정 수 + 팀원별 분포
  const dayRows = useMemo(() => {
    const dayMap = new Map<string, { count: number; perMember: Record<string, number>; schedules: Schedule[] }>();
    for (const s of inCalendar) {
      if (!s.date) continue;
      const entry = dayMap.get(s.date) || { count: 0, perMember: {}, schedules: [] };
      entry.count++;
      const names = normalizeMemberName(s.memberName || "");
      for (const n of names) {
        if (!n) continue;
        entry.perMember[n] = (entry.perMember[n] || 0) + 1;
      }
      entry.schedules.push(s);
      dayMap.set(s.date, entry);
    }
    return Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, info]) => ({ date, ...info }));
  }, [inCalendar]);

  const total = inCalendar.length;

  return (
    <div className="px-4 py-4 space-y-4">
      {/* 월 선택 */}
      <div className="flex items-center gap-2">
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 text-xs font-bold text-blue-600 border border-blue-200 rounded-lg active:bg-blue-50 disabled:text-gray-300 disabled:border-gray-200"
        >
          {loading ? "..." : "새로고침"}
        </button>
      </div>

      {/* 헤더 */}
      <div className="text-center">
        <div className="text-xs text-gray-400">{monthLabel}</div>
        <div className="text-2xl font-extrabold text-gray-800 mt-1">
          {loading ? "..." : `${total.toLocaleString("ko-KR")}건`}
        </div>
        <div className="text-[11px] text-gray-400 mt-0.5">달력에 등록된 일정 (휴무·마감 제외)</div>
      </div>

      {/* 월/일 보기 토글 */}
      <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-bold">
        <button
          onClick={() => setViewMode("month")}
          className={`flex-1 py-2 ${viewMode === "month" ? "bg-blue-500 text-white" : "bg-white text-gray-500 active:bg-gray-50"}`}
        >
          팀원별 (월)
        </button>
        <button
          onClick={() => { setViewMode("day"); setExpandedDate(null); }}
          className={`flex-1 py-2 ${viewMode === "day" ? "bg-blue-500 text-white" : "bg-white text-gray-500 active:bg-gray-50"}`}
        >
          날짜별 (일)
        </button>
      </div>

      {/* 월 모드: 팀원별 건수 */}
      {viewMode === "month" && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-gray-700 shrink-0">팀원별 건수</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setSortMode((m) => (m === "count" ? "branch" : "count"))}
                className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium active:bg-blue-100"
                aria-label="정렬 방식 변경"
              >
                {sortMode === "count" ? "건수순" : "지역순"}
              </button>
              <span className="text-[10px] text-gray-400">희망 / 현재배정</span>
            </div>
          </div>
          {loading ? (
            <div className="py-6 text-center text-gray-400 text-sm">불러오는 중...</div>
          ) : memberRows.length === 0 ? (
            <div className="py-6 text-center text-gray-400 text-sm">현장팀 회원이 없습니다</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {memberRows.map((m) => (
                <div key={m.name} className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800 truncate">{m.name}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">{m.branch}</span>
                  </div>
                  <div className="flex items-baseline gap-2 shrink-0">
                    <span className="text-xs text-gray-400 tabular-nums w-10 text-right">
                      {m.desired > 0 ? m.desired : "-"}
                    </span>
                    <span className="text-gray-300 text-xs">/</span>
                    <span className={`text-sm font-bold tabular-nums w-12 text-right ${m.count > 0 ? "text-blue-600" : "text-gray-300"}`}>
                      {m.count}건
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 일 모드: 날짜별 건수 — 클릭 시 그날 팀원별 + 일정 목록 펼치기 */}
      {viewMode === "day" && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700">날짜별 건수</span>
            <span className="text-[10px] text-gray-400">날짜 / 건수 (탭하면 상세)</span>
          </div>
          {loading ? (
            <div className="py-6 text-center text-gray-400 text-sm">불러오는 중...</div>
          ) : dayRows.length === 0 ? (
            <div className="py-6 text-center text-gray-400 text-sm">이 달에 등록된 일정이 없습니다</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {dayRows.map((d) => {
                const isOpen = expandedDate === d.date;
                const day = Number(d.date.slice(8));
                const dow = ["일", "월", "화", "수", "목", "금", "토"][new Date(d.date + "T00:00:00").getDay()];
                const memberList = Object.entries(d.perMember).sort((a, b) => b[1] - a[1]);
                return (
                  <div key={d.date}>
                    <button
                      onClick={() => setExpandedDate(isOpen ? null : d.date)}
                      className="w-full flex items-center justify-between px-3 py-2.5 active:bg-gray-50"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold text-gray-800 tabular-nums w-6 text-right">{day}</span>
                        <span className={`text-[10px] font-medium ${dow === "일" ? "text-red-500" : dow === "토" ? "text-blue-500" : "text-gray-400"}`}>({dow})</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-bold tabular-nums ${d.count > 0 ? "text-blue-600" : "text-gray-300"}`}>{d.count}건</span>
                        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                    {isOpen && (() => {
                      // 시간을 오전/오후/그외로 라벨링 (07~09=오전, 13~15=오후)
                      const timeLabel = (t?: string): string => {
                        if (!t) return "-";
                        const h = parseInt(t.split(":")[0]);
                        if (Number.isNaN(h)) return t;
                        if (h >= 7 && h <= 9) return "오전";
                        if (h >= 13 && h <= 15) return "오후";
                        return t;
                      };
                      // 팀원별 그룹 — 이름 정규화 (T/A 등 prefix 제거 + (부산) 등 지역 표기 제거)
                      // → 'T김기열(부산)' 과 '김기열' 이 같은 사람으로 묶임
                      const byMember = new Map<string, typeof d.schedules>();
                      for (const s of d.schedules) {
                        const names = normalizeMemberName(s.memberName || "");
                        const keys = names.length > 0 ? names : ["미배정"];
                        for (const name of keys) {
                          if (!name) continue;
                          const arr = byMember.get(name) || [];
                          arr.push(s);
                          byMember.set(name, arr);
                        }
                      }
                      // 1) 지역 필터 적용 (dayRegionFilter 빈 문자열이면 전체)
                      // 2) 정렬 (count 또는 branch 순)
                      let grouped = Array.from(byMember.entries()).map(([name, scheds]) => ({
                        name,
                        scheds,
                        branch: memberBranchMap.get(name) || "미지정",
                      }));
                      if (dayRegionFilter) {
                        grouped = grouped.filter((g) => g.branch === dayRegionFilter);
                      }
                      if (dayGroupSort === "branch") {
                        // 우선순위 정렬 (서울→경기→천안...→미지정 마지막) + 같은 지역 안은 건수 많은 순
                        grouped.sort((a, b) => {
                          const ra = regionRank(a.branch);
                          const rb = regionRank(b.branch);
                          if (ra !== rb) return ra - rb;
                          return b.scheds.length - a.scheds.length;
                        });
                      } else {
                        grouped.sort((a, b) => b.scheds.length - a.scheds.length);
                      }
                      return (
                        <div className="bg-blue-50/40 px-3 py-2 space-y-3">
                          {/* 컨트롤 — 지역 필터 드롭다운 + 정렬 토글 */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <select
                              value={dayRegionFilter}
                              onChange={(e) => setDayRegionFilter(e.target.value)}
                              className="text-[10px] px-2 py-1 rounded border border-gray-200 bg-white text-gray-700 outline-none"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="">전체 지역</option>
                              {allRegions.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDayGroupSort((m) => (m === "count" ? "branch" : "count")); }}
                              className="text-[10px] px-2 py-1 rounded-full bg-white border border-gray-200 text-gray-700 font-medium active:bg-blue-100"
                            >
                              {dayGroupSort === "count" ? "건수순" : "지역순"}
                            </button>
                          </div>
                          {/* 팀원별 분포 칩 */}
                          {memberList.length > 0 && !dayRegionFilter && (
                            <div className="flex flex-wrap gap-1">
                              {memberList.map(([name, cnt]) => (
                                <span key={name} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700">
                                  {name} <span className="font-bold text-blue-600">{cnt}</span>
                                </span>
                              ))}
                            </div>
                          )}
                          {/* 팀원별 그룹 일정 목록 */}
                          <div className="space-y-2">
                            {grouped.length === 0 ? (
                              <div className="text-[11px] text-gray-400 text-center py-3">선택한 지역에 해당하는 팀장이 없습니다</div>
                            ) : grouped.map(({ name, scheds, branch }) => (
                              <div key={name} className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                                <div className="px-2.5 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-gray-800">{name}</span>
                                    <span className="text-[10px] text-gray-400">{branch}</span>
                                  </span>
                                  <span className="text-[10px] text-gray-500">{scheds.length}건</span>
                                </div>
                                <div className="divide-y divide-gray-50">
                                  {scheds.map((s) => (
                                    <div key={s.id} className="text-[11px] flex items-center gap-2 px-2.5 py-1">
                                      <span className="text-gray-400 shrink-0 w-9 font-medium">{timeLabel(s.startTime)}</span>
                                      <span className="text-gray-800 truncate flex-1">{s.title}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/* ════════════ 영업팀 미입금 섹션 ════════════ */
function SalesStatsSection({ userName, userRole, schedules, unassignedSchedules = [] }: {
  userName: string;
  userRole: string;
  allUsers: { id?: string; name: string; username?: string; role?: string; address?: string; branch?: string }[];
  schedules: Schedule[];
  unassignedSchedules?: Schedule[];
}) {
  const isCeo = userRole === "ceo" || userRole === "admin";

  // 미입금 = 제목에 "/미입금" 포함
  const isUnpaid = (title: string) => title.includes("/미입금");

  // 제목에서 고객명 추출 (간단 휴리스틱 — 실패시 전체 제목)
  // 예: "U오전/미입금/예완/손경순/마포구/김은미/인테리어청소" → "손경순"
  const extractCustomer = (title: string): string => {
    const clean = title.replace(/^\[.+?\]\s*/, "");
    const parts = clean.split("/").map((p) => p.trim()).filter(Boolean);
    const skipTokens = new Set([
      "A", "U", "A오전", "A오후", "U오전", "U오후",
      "오전", "오후", "미입금", "휴무",
    ]);
    for (const p of parts) {
      if (skipTokens.has(p)) continue;
      if (/^[AU]$/.test(p)) continue;
      if (!/[가-힣]/.test(p) && !/[a-zA-Z]{3,}/.test(p)) continue;
      return p;
    }
    return clean.slice(0, 30);
  };

  // 미입금 일정 — 배정/미배정 합쳐서 전부 (날짜 제한 없음)
  // 영업 role 이면 본인 명의(/이름/, u이름/)만 필터, 그 외(대표/admin)는 전체
  const unpaidSchedules = useMemo(() => {
    const allUnpaid = [...schedules, ...unassignedSchedules].filter((s) => isUnpaid(s.title));
    // 중복 제거 (혹시 schedules + unassigned 둘 다 들어간 경우)
    const seen = new Set<string>();
    const dedup = allUnpaid.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    if (isCeo) return dedup.sort((a, b) => (a.date < b.date ? -1 : 1));
    // 영업: 본인 명의만
    return dedup.filter((s) => {
      const title = s.title.replace(/^\[.+?\]\s*/, "");
      return (
        title.includes(`/${userName}/`) ||
        title.includes(`/${userName}[`) ||
        title.endsWith(`/${userName}`) ||
        title.startsWith(`u${userName}/`)
      );
    }).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [schedules, unassignedSchedules, isCeo, userName]);

  return (
    <div className="px-4 py-4 space-y-3">
      {/* 헤더 */}
      <div className="text-center">
        <div className="mt-1 text-2xl font-extrabold text-gray-800">
          미입금 <span className="text-red-500">{unpaidSchedules.length}</span>건
        </div>
      </div>

      {/* 미입금 일정 목록 */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 text-xs font-bold text-gray-700">
          {isCeo ? "전체 미입금" : "내 미입금"}
        </div>
        {unpaidSchedules.length === 0 ? (
          <div className="py-6 text-center text-gray-400 text-sm">미입금 없음</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {unpaidSchedules.map((s) => (
              <div key={s.id} className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0 font-medium">{s.date.slice(5)}</span>
                  <span className="text-sm font-medium text-gray-800 truncate">{extractCustomer(s.title)}</span>
                </div>
                <div className="text-[10px] text-gray-400 truncate mt-0.5">{s.title}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-[10px] text-gray-400 text-center">
        ℹ️ 미입금 판정: 일정 제목에 &quot;/미입금&quot; 포함 시
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
  const [events, setEvents] = useState<{ id: string; googleEventId: string; summary: string; date: string; description?: string; selected: boolean; assignTo: string; calName?: string }[]>([]);
  const [checkedCals, setCheckedCals] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState("");
  const [fetchDays, setFetchDays] = useState(365);

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
    const url = `${GAS_URL}?action=fetchEvents&calendarId=${encodeURIComponent(cid)}&days=${fetchDays}`;
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
        id: ev.id, googleEventId: ev.id, summary: ev.summary || "(제목 없음)", date: ev.date || "", description: ev.description || "", selected: true, assignTo: "", calName,
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
            allItems.push({ id: ev.id + cal.id, googleEventId: ev.id, summary: ev.summary || "(제목 없음)", date: ev.date || "", description: ev.description || "", selected: true, assignTo: cal.assignTo || "", calName: cal.name });
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
    let skipped = 0;
    for (let i = 0; i < toImport.length; i++) {
      const ev = toImport[i];
      try {
        const googleEventId = ev.googleEventId;
        const created = await addUnassignedSchedule({
          title: ev.summary,
          date: ev.date,
          startTime: "09:00",
          endTime: "18:00",
          note: ev.description || "",
          googleEventId,
        });
        // created.id 없으면 중복(서버 dedup) 이거나 실패 → skip 처리
        if (!created?.id) {
          skipped++;
        } else {
          if (ev.assignTo) {
            const member = members.find(m => m.id === ev.assignTo);
            const fieldUser = allUsers.find(u => (u.id === ev.assignTo || u.name === ev.assignTo) && u.role === "field");
            const assignId = member?.id || fieldUser?.id || ev.assignTo;
            const assignName = member?.name || fieldUser?.name || ev.assignTo;
            await assignScheduleApi(created.id, assignId, assignName);
          }
          count++;
        }
      } catch { skipped++; /* 개별 실패는 skip 으로 집계 */ }
      setImportProgress(Math.round(((i + 1) / toImport.length) * 100));
    }

    setImporting(false);
    setImportCount(count);
    setSkippedCount(skipped);
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
          <div className="text-sm font-bold text-green-700">
            ✅ {importCount}건 가져오기 완료
            {skippedCount > 0 && <span className="text-gray-500 font-medium"> · 중복 {skippedCount}건 건너뜀</span>}
          </div>
          <button onClick={() => { setImportDone(false); setSkippedCount(0); }} className="mt-2 text-xs text-blue-500 font-medium">다시 가져오기</button>
        </div>
      )}

      {/* 캘린더 ID 입력 */}
      {!importDone && (
        <>
          {/* 조회 기간 선택 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 shrink-0">조회 기간</label>
            <select
              value={fetchDays}
              onChange={(e) => setFetchDays(Number(e.target.value))}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value={60}>향후 2개월 (60일)</option>
              <option value={90}>향후 3개월 (90일)</option>
              <option value={180}>향후 6개월 (180일)</option>
              <option value={365}>향후 1년 (365일)</option>
              <option value={730}>향후 2년 (730일)</option>
            </select>
          </div>

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
                                allItems.push({ id: ev.id + cal.id, googleEventId: ev.id, summary: ev.summary || "(제목 없음)", date: ev.date || "", description: ev.description || "", selected: true, assignTo: cal.assignTo || "", calName: cal.name });
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
