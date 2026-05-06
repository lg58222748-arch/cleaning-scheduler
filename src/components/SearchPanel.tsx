"use client";

import { useState, useRef, useEffect } from "react";
import { Schedule } from "@/types";
import { searchSchedules } from "@/lib/api";

interface SearchPanelProps {
  onSelectSchedule: (schedule: Schedule) => void;
  onClose: () => void;
}

export default function SearchPanel({ onSelectSchedule, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  function handleSearch(q: string) {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      const data = await searchSchedules(q.trim());
      setResults(data);
      setSearched(true);
      setLoading(false);
    }, 300);
  }

  // 날짜별 그룹핑
  const grouped = results.reduce<Record<string, Schedule[]>>((acc, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {});

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  function formatDateLabel(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const dow = dayNames[d.getDay()];
    return `${y}년 ${m}월 ${day}일 (${dow})`;
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col animate-[modalIn_0.15s_ease-out]" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {/* 검색 헤더 */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <button onClick={onClose} className="p-1.5 active:bg-gray-100 rounded-lg shrink-0">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="일정 검색 (이름, 주소, 내용...)"
            className="w-full px-4 py-2.5 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white border border-transparent focus:border-blue-300"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setResults([]); setSearched(false); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 검색 결과 */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="py-12 text-center text-gray-400 text-sm">검색 중...</div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">
            검색 결과가 없습니다
          </div>
        )}

        {!loading && !searched && (
          <div className="py-12 text-center text-gray-400 text-sm">
            이름, 주소, 내용으로 검색하세요
          </div>
        )}

        {!loading && results.length > 0 && (
          <div>
            {Object.entries(grouped).map(([date, schedules]) => (
              <div key={date}>
                <div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500">
                  {formatDateLabel(date)}
                </div>
                {schedules.map((s) => {
                  const titleDisplay = s.title.replace(/^\[.+?\]\s*/, "");
                  // 미입금 일정은 2번째 색상(하늘 #DBEAFE)으로 자동 표시
                  const schedColor = s.title.includes("/미입금") ? "#DBEAFE" : (s.color || "#FDDCCC");
                  return (
                    <div
                      key={s.id}
                      className="px-4 py-3 border-b border-gray-50 active:bg-gray-50 cursor-pointer flex items-center gap-3"
                      onClick={() => onSelectSchedule(s)}
                    >
                      <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: schedColor }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800">{titleDisplay}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {s.memberName} · 하루 종일
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
