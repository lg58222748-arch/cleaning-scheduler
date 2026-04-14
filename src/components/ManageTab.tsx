"use client";

import { useState, useEffect } from "react";
import { Schedule } from "@/types";
import { fetchDeletedSchedules, restoreScheduleApi, emptyTrashApi, deleteAllSchedules, fetchSchedules, addUnassignedSchedule } from "@/lib/api";

interface ManageTabProps {
  isAdmin: boolean;
  onRefresh: () => void;
}

export default function ManageTab({ isAdmin, onRefresh }: ManageTabProps) {
  const [trashItems, setTrashItems] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().slice(0, 10));
  const [bulkAdding, setBulkAdding] = useState(false);
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

  async function handleBulkAdd() {
    if (!bulkText.trim()) return;
    setBulkAdding(true);
    // 줄바꿈으로 구분 - 각 줄이 하나의 일정 제목
    // 또는 전체를 하나의 일정 본문으로 등록
    const lines = bulkText.trim().split("\n").filter((l) => l.trim());

    if (lines.length === 1 || bulkText.includes("1)") || bulkText.includes("성함")) {
      // 전체가 하나의 일정 (예약양식 붙여넣기)
      const titleLine = lines[0].slice(0, 50);
      await addUnassignedSchedule({
        title: titleLine,
        date: bulkDate,
        startTime: "09:00",
        endTime: "18:00",
        note: bulkText.trim(),
      });
    } else {
      // 여러 줄 → 각각 별도 일정
      for (const line of lines) {
        if (line.trim()) {
          await addUnassignedSchedule({
            title: line.trim(),
            date: bulkDate,
            startTime: "09:00",
            endTime: "18:00",
            note: "",
          });
        }
      }
    }
    setBulkText("");
    setBulkAdding(false);
    setShowBulkAdd(false);
    onRefresh();
    loadCounts();
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
        {!isAdmin && (
          <div className="px-4 py-12 text-center text-gray-400 text-sm">
            관리 기능은 관리자만 사용할 수 있습니다
          </div>
        )}

        {isAdmin && (
          <>
            {/* 일정 직접 등록 */}
            <button
              onClick={() => setShowBulkAdd(!showBulkAdd)}
              className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-gray-50"
            >
              <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-gray-800">일정 직접 등록</div>
                <div className="text-xs text-gray-400">예약양식 붙여넣기로 등록</div>
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${showBulkAdd ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {showBulkAdd && (
              <div className="px-4 py-3 bg-gray-50 space-y-3">
                <input
                  type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400"
                />
                <textarea
                  value={bulkText} onChange={(e) => setBulkText(e.target.value)}
                  rows={8} placeholder={"예약양식을 붙여넣으세요\n\n예시:\n1)성함: 홍길동\n2)주소: 서울시 강남구...\n3)연락처: 010-1234-5678\n\n또는 여러 건은 줄마다 제목 입력"}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400 resize-y"
                />
                <button
                  onClick={handleBulkAdd} disabled={bulkAdding || !bulkText.trim()}
                  className="w-full py-2.5 bg-green-500 text-white rounded-lg text-sm font-bold active:bg-green-600 disabled:opacity-50"
                >
                  {bulkAdding ? "등록 중..." : "배정탭에 등록"}
                </button>
              </div>
            )}

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
                  </>
                )}
              </div>
            )}

            {/* 백업 */}
            <button onClick={handleBackup} className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-gray-50">
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

            {/* 전체 삭제 */}
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
          </>
        )}
      </div>
    </div>
  );
}
