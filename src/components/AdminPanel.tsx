"use client";

import { useState, useEffect } from "react";
import { Schedule } from "@/types";
import { fetchDeletedSchedules, restoreScheduleApi, emptyTrashApi, deleteAllSchedules, softDeleteSchedule } from "@/lib/api";

interface AdminPanelProps {
  onClose: () => void;
  onRefresh?: () => void;
}

export default function AdminPanel({ onClose, onRefresh }: AdminPanelProps) {
  const [tab, setTab] = useState<"settings" | "trash">("settings");
  const [deletedSchedules, setDeletedSchedules] = useState<Schedule[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("notificationsEnabled") !== "false";
  });

  useEffect(() => {
    if (tab === "trash") loadTrash();
  }, [tab]);

  async function loadTrash() {
    setLoadingTrash(true);
    const data = await fetchDeletedSchedules();
    setDeletedSchedules(data);
    setLoadingTrash(false);
  }

  function toggleNotifications() {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    localStorage.setItem("notificationsEnabled", String(next));
  }

  async function handleMoveAllToTrash() {
    if (!confirm("모든 일정을 휴지통으로 이동하시겠습니까?\n(영구 삭제가 아닙니다. 휴지통에서 복원 가능합니다)")) return;
    await deleteAllSchedules();
    onRefresh?.();
  }

  async function handleRestore(id: string) {
    await restoreScheduleApi(id);
    setDeletedSchedules(prev => prev.filter(s => s.id !== id));
    onRefresh?.();
  }

  async function handlePermanentDelete(id: string) {
    if (!confirm("이 일정을 영구 삭제하시겠습니까?\n복원할 수 없습니다.")) return;
    // soft delete된 것을 영구 삭제하는 API 호출
    const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDeletedSchedules(prev => prev.filter(s => s.id !== id));
    }
  }

  async function handleEmptyTrash() {
    if (!confirm("휴지통을 비우시겠습니까?\n모든 삭제된 일정이 영구 삭제됩니다.")) return;
    await emptyTrashApi();
    setDeletedSchedules([]);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[85vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-800">설정</h3>
          <button onClick={onClose} className="p-1 active:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab("settings")}
            className={`flex-1 py-2.5 text-sm font-medium text-center ${tab === "settings" ? "text-blue-500 border-b-2 border-blue-500" : "text-gray-400"}`}
          >
            설정
          </button>
          <button
            onClick={() => setTab("trash")}
            className={`flex-1 py-2.5 text-sm font-medium text-center ${tab === "trash" ? "text-blue-500 border-b-2 border-blue-500" : "text-gray-400"}`}
          >
            휴지통 {deletedSchedules.length > 0 ? `(${deletedSchedules.length})` : ""}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === "settings" && (
            <>
              {/* 알림 설정 */}
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-800">알림</div>
                    <div className="text-xs text-gray-400 mt-0.5">배정/반납 알림을 받습니다</div>
                  </div>
                  <button
                    onClick={toggleNotifications}
                    className={`relative w-12 h-7 rounded-full transition-colors ${notificationsEnabled ? "bg-blue-500" : "bg-gray-300"}`}
                  >
                    <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${notificationsEnabled ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
              </div>

              {/* 전체 일정 삭제 (휴지통으로) */}
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-800">전체 일정 삭제</div>
                    <div className="text-xs text-gray-400 mt-0.5">모든 일정을 휴지통으로 이동</div>
                  </div>
                  <button
                    onClick={handleMoveAllToTrash}
                    className="px-4 py-2 bg-red-50 text-red-500 rounded-lg text-xs font-medium active:bg-red-100"
                  >
                    삭제
                  </button>
                </div>
              </div>

              {/* 휴지통 바로가기 */}
              <button
                onClick={() => setTab("trash")}
                className="w-full border border-gray-200 rounded-xl p-4 flex items-center justify-between active:bg-gray-50"
              >
                <div>
                  <div className="text-sm font-medium text-gray-800 text-left">휴지통</div>
                  <div className="text-xs text-gray-400 mt-0.5">삭제된 일정 관리</div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {tab === "trash" && (
            <>
              {loadingTrash ? (
                <div className="py-8 text-center text-gray-400 text-sm">로딩 중...</div>
              ) : deletedSchedules.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">휴지통이 비어있습니다</div>
              ) : (
                <>
                  {/* 휴지통 비우기 */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleEmptyTrash}
                      className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium active:bg-red-100"
                    >
                      휴지통 비우기
                    </button>
                  </div>

                  <div className="space-y-2">
                    {deletedSchedules.map((s) => (
                      <div key={s.id} className="border border-gray-200 rounded-xl p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{s.title}</div>
                            <div className="text-xs text-gray-400">{s.date} · {s.memberName || "미배정"}</div>
                          </div>
                          <button
                            onClick={() => handleRestore(s.id)}
                            className="px-3 py-1.5 bg-blue-50 text-blue-500 rounded-lg text-xs font-medium active:bg-blue-100 shrink-0"
                          >
                            복원
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(s.id)}
                            className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium active:bg-red-100 shrink-0"
                          >
                            영구삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
