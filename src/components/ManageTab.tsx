"use client";

import { useState, useEffect } from "react";
import { Schedule } from "@/types";
import { fetchDeletedSchedules, restoreScheduleApi, emptyTrashApi, deleteAllSchedules, fetchSchedules } from "@/lib/api";

interface ManageTabProps {
  isAdmin: boolean;
  onRefresh: () => void;
}

export default function ManageTab({ isAdmin, onRefresh }: ManageTabProps) {
  const [trashItems, setTrashItems] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadCounts();
  }, []);

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
    <div className="h-full overflow-y-auto bg-white">
      <div className="px-4 py-4 border-b border-gray-100">
        <h3 className="text-base font-bold text-gray-800">{isAdmin ? "관리" : "더보기"}</h3>
        <p className="text-xs text-gray-400 mt-0.5">전체 일정 {totalCount}건</p>
      </div>

      <div className="divide-y divide-gray-100">
        {/* 휴지통 */}
        <button
          onClick={() => { setShowTrash(!showTrash); if (!showTrash) loadTrash(); }}
          className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-gray-50"
        >
          <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-gray-800">휴지통</div>
            <div className="text-xs text-gray-400">삭제된 일정 보기 · 복원 가능</div>
          </div>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${showTrash ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* 휴지통 목록 */}
        {showTrash && (
          <div className="bg-gray-50">
            {loading ? (
              <div className="py-6 text-center text-gray-400 text-sm">로딩 중...</div>
            ) : trashItems.length === 0 ? (
              <div className="py-6 text-center text-gray-400 text-sm">휴지통이 비어있습니다</div>
            ) : (
              <>
                <div className="px-4 py-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500">{trashItems.length}건</span>
                  {isAdmin && (
                    <button onClick={handleEmptyTrash} className="text-xs text-red-500 font-medium">휴지통 비우기</button>
                  )}
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
              </>
            )}
          </div>
        )}

        {/* 백업 */}
        <button
          onClick={handleBackup}
          className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-gray-50"
        >
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-gray-800">백업 다운로드</div>
            <div className="text-xs text-gray-400">전체 일정을 JSON 파일로 저장</div>
          </div>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* 관리자 전용 */}
        {isAdmin && (
          <button
            onClick={() => { if (confirm(`전체 ${totalCount}건 일정을 모두 삭제합니다. 정말 삭제하시겠습니까?`)) handleDeleteAll(); }}
            className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-red-50"
          >
            <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.834-2.694-.834-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-red-600">전체 일정 삭제</div>
              <div className="text-xs text-gray-400">모든 일정을 영구 삭제합니다</div>
            </div>
          </button>
        )}

        {/* Google Calendar */}
        <button
          onClick={() => {/* handled elsewhere */}}
          className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-gray-50 opacity-50"
        >
          <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-gray-800">Google 캘린더 동기화</div>
            <div className="text-xs text-gray-400">팀원 탭에서 설정 가능</div>
          </div>
        </button>
      </div>
    </div>
  );
}
