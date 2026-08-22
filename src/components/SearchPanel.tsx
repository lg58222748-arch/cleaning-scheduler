"use client";

import { useState, useRef, useEffect } from "react";
import { Schedule } from "@/types";
import { searchSchedules } from "@/lib/api";

interface SearchPanelProps {
  onSelectSchedule: (schedule: Schedule) => void;
  onClose: () => void;
  // 역할별 필터 — 현장팀은 본인 일정만 검색되게. 없으면 전체 노출.
  filterResults?: (list: Schedule[]) => Schedule[];
}

export default function SearchPanel({ onSelectSchedule, onClose, filterResults }: SearchPanelProps) {
  const PAGE_SIZE = 50; // 서버 searchSchedules 페이지 크기와 동일
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // 지금까지 서버에서 받아온 raw 건수 (역할 필터로 걸러지기 전 기준 = 다음 offset)
  const rawOffsetRef = useRef(0);
  // 새 검색이 시작되면 진행중이던 더보기 응답은 버림 (검색어 바뀐 뒤 stale append 방지)
  const seqRef = useRef(0);

  useEffect(() => {
    inputRef.current?.focus();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  function runSearch(q: string, withDeleted: boolean) {
    if (timerRef.current) clearTimeout(timerRef.current);
    seqRef.current++;
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      setHasMore(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      const seq = ++seqRef.current;
      setLoading(true);
      const data = await searchSchedules(q.trim(), withDeleted);
      if (seq !== seqRef.current) return; // 그 사이 새 검색 시작됨 — 이 응답 버림
      rawOffsetRef.current = data.length;
      setHasMore(data.length === PAGE_SIZE);
      setResults(filterResults ? filterResults(data) : data);
      setSearched(true);
      setLoading(false);
    }, 300);
  }

  function handleSearch(q: string) {
    setQuery(q);
    runSearch(q, includeDeleted);
  }

  function toggleDeleted() {
    const next = !includeDeleted;
    setIncludeDeleted(next);
    // 현재 검색어 즉시 재검색 (debounce 없이 바로)
    if (query.trim()) {
      const seq = ++seqRef.current;
      setLoading(true);
      searchSchedules(query.trim(), next).then((data) => {
        if (seq !== seqRef.current) return;
        rawOffsetRef.current = data.length;
        setHasMore(data.length === PAGE_SIZE);
        setResults(filterResults ? filterResults(data) : data);
        setSearched(true);
        setLoading(false);
      });
    }
  }

  // 더보기 — 다음 50건 이어받아 아래에 붙임
  async function loadMore() {
    if (loadingMore || !query.trim()) return;
    const seq = seqRef.current;
    setLoadingMore(true);
    const data = await searchSchedules(query.trim(), includeDeleted, rawOffsetRef.current);
    if (seq !== seqRef.current) { setLoadingMore(false); return; } // 새 검색 시작됨
    rawOffsetRef.current += data.length;
    setHasMore(data.length === PAGE_SIZE);
    const filtered = filterResults ? filterResults(data) : data;
    setResults((prev) => {
      const seen = new Set(prev.map((s) => s.id));
      return [...prev, ...filtered.filter((s) => !seen.has(s.id))];
    });
    setLoadingMore(false);
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

      {/* 휴지통 포함 토글 */}
      <div className="px-4 py-2 border-b border-gray-50 flex items-center justify-between">
        <span className="text-xs text-gray-400">검색 범위</span>
        <button
          onClick={toggleDeleted}
          className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
            includeDeleted
              ? "bg-red-50 text-red-600 border-red-200"
              : "bg-gray-100 text-gray-500 border-transparent active:bg-gray-200"
          }`}
        >
          🗑️ 휴지통 포함 {includeDeleted ? "ON" : "OFF"}
        </button>
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
                  const isDeleted = s.status === "deleted";
                  // 미입금 일정은 보라 #E9D5FF (4번째) 으로 자동 표시. 삭제된 건 회색.
                  const schedColor = isDeleted ? "#D1D5DB" : (s.title.includes("/미입금") ? "#E9D5FF" : (s.color || "#FDDCCC"));
                  return (
                    <div
                      key={s.id}
                      className={`px-4 py-3 border-b border-gray-50 active:bg-gray-50 cursor-pointer flex items-center gap-3 ${isDeleted ? "bg-gray-50/60" : ""}`}
                      onClick={() => onSelectSchedule(s)}
                    >
                      <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: schedColor }} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium flex items-center gap-1.5 ${isDeleted ? "text-gray-400 line-through" : "text-gray-800"}`}>
                          <span className="truncate">{titleDisplay}</span>
                          {isDeleted && <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-500 no-underline font-bold">🗑️ 휴지통</span>}
                        </div>
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
            {/* 더보기 — 서버에서 50건 단위로 이어받기 */}
            {hasMore && (
              <div className="p-3">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold active:bg-gray-200 disabled:opacity-60"
                >
                  {loadingMore ? "불러오는 중..." : "더보기"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
