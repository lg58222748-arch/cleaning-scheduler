"use client";

import { useState, useEffect } from "react";
import { ScheduleChecklist as ChecklistType } from "@/types";
import { fetchChecklist, toggleChecklistItem, submitChecklistApi } from "@/lib/api";

interface ScheduleChecklistProps {
  scheduleId: string;
  onComplete?: () => void;
}

export default function ScheduleChecklist({ scheduleId, onComplete }: ScheduleChecklistProps) {
  const [checklist, setChecklist] = useState<ChecklistType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadChecklist(); }, [scheduleId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadChecklist() {
    setLoading(true);
    const data = await fetchChecklist(scheduleId);
    setChecklist(data);
    setLoading(false);
  }

  function handleSelectAll(checked: boolean) {
    if (!checklist) return;
    const updated = {
      ...checklist,
      categories: checklist.categories.map((cat) => ({
        ...cat,
        items: cat.items.map((item) => ({ ...item, checked })),
      })),
    };
    updated.completedCount = checked ? updated.totalCount : 0;
    setChecklist(updated);
    // API 호출: 모든 아이템 토글
    for (const cat of checklist.categories) {
      for (const item of cat.items) {
        if (item.checked !== checked) {
          toggleChecklistItem(scheduleId, item.id, checked);
        }
      }
    }
  }

  function handleToggle(itemId: string, checked: boolean) {
    // 낙관적 업데이트: 즉시 UI 반영
    if (checklist) {
      const updated = {
        ...checklist,
        categories: checklist.categories.map((cat) => ({
          ...cat,
          items: cat.items.map((item) =>
            item.id === itemId ? { ...item, checked } : item
          ),
        })),
      };
      const done = updated.categories.reduce((sum, cat) => sum + cat.items.filter((i) => i.checked).length, 0);
      updated.completedCount = done;
      setChecklist(updated);
    }
    // API 백그라운드
    toggleChecklistItem(scheduleId, itemId, checked);
  }

  async function handleSubmit() {
    const data = await submitChecklistApi(scheduleId);
    setChecklist(data);
  }

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">로딩 중...</div>;
  if (!checklist) return null;

  const progress = checklist.totalCount > 0
    ? Math.round((checklist.completedCount / checklist.totalCount) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            검수 진행률: {checklist.completedCount}/{checklist.totalCount}
          </span>
          <span className={`text-sm font-bold ${progress === 100 ? "text-green-600" : "text-blue-600"}`}>
            {progress}%
          </span>
        </div>
        <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${progress === 100 ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        {checklist.submittedAt && (
          <div className="mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
            검수 완료됨 ({new Date(checklist.submittedAt).toLocaleString("ko")})
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="space-y-3 px-4">
        {checklist.categories.map((cat) => {
          const catCompleted = cat.items.filter((i) => i.checked).length;
          return (
            <div key={cat.id} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2.5 bg-gray-50 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {cat.icon} {cat.name}
                </span>
                <span className="text-xs text-gray-400">
                  {catCompleted}/{cat.items.length}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {cat.items.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2.5 active:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => handleToggle(item.id, e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-400 shrink-0"
                    />
                    <span className={`text-sm ${item.checked ? "text-gray-400 line-through" : "text-gray-700"}`}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 전체 선택 */}
      <div className="px-4">
        <label className="flex items-center gap-3 px-3 py-3 bg-blue-50 border border-blue-200 rounded-xl cursor-pointer active:bg-blue-100">
          <input
            type="checkbox"
            checked={progress === 100}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-400 shrink-0"
          />
          <span className="text-sm font-bold text-blue-700">전체 선택</span>
        </label>
      </div>

      {/* 검수 완료 버튼 */}
      <div className="px-4 pb-4">
        <button
          onClick={async () => {
            if (!checklist.submittedAt) await handleSubmit();
            onComplete?.();
          }}
          disabled={progress < 100}
          className={`w-full py-3 rounded-xl font-bold text-sm ${
            checklist.submittedAt
              ? "bg-blue-500 text-white active:bg-blue-600"
              : "bg-green-500 text-white active:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
          }`}
        >
          {checklist.submittedAt ? "정산으로 이동" : progress < 100 ? `${checklist.totalCount - checklist.completedCount}개 항목 남음` : "검수 완료"}
        </button>
      </div>
    </div>
  );
}
