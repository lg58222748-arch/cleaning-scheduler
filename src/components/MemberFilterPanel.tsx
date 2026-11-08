"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { User } from "@/types";

// 달력 위 '팀원 필터' 패널 — 팀장이 많아 찾기 힘들어서 이름·지역 검색칸을 붙임.
// 검색어는 이 컴포넌트 안에만 둠 → 글자 칠 때마다 달력 전체가 다시 그려지지 않고,
// 패널을 닫았다 열면 검색어가 자동으로 비워짐.

const CHOSEONG = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const MEMBER_COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

// 검색 글자 하나 ↔ 이름 글자 하나: 같은 글자이거나, 초성(ㄱ·ㄴ…)만 쳤으면 그 초성으로 시작하는 글자
function charMatches(q: string, t: string): boolean {
  if (q === t) return true;
  const ci = CHOSEONG.indexOf(q);
  if (ci < 0) return false;
  const code = t.charCodeAt(0) - 0xac00;
  return code >= 0 && code < 11172 && Math.floor(code / 588) === ci;
}

// "김기", "기수", "ㄱㄱㅅ", "천안" 처럼 중간부터 쳐도 찾음 (띄어쓰기·대소문자 무시)
function matchesQuery(target: string, query: string): boolean {
  const t = [...target.replace(/\s+/g, "").toLowerCase()];
  const q = [...query.replace(/\s+/g, "").toLowerCase()];
  if (q.length === 0) return true;
  for (let i = 0; i + q.length <= t.length; i++) {
    let ok = true;
    for (let j = 0; j < q.length; j++) {
      if (!charMatches(q[j], t[i + j])) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

const branchShortOf = (u: User) => (u.branch || "").replace(/\[관리점\]/g, "").trim();

interface Props {
  allUsers: User[];
  selectedMemberIds: Set<string>;
  setSelectedMemberIds: Dispatch<SetStateAction<Set<string>>>;
  setFilterActive: Dispatch<SetStateAction<boolean>>;
  onClose: () => void;
}

export default function MemberFilterPanel({ allUsers, selectedMemberIds, setSelectedMemberIds, setFilterActive, onClose }: Props) {
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;

  const fieldUsers = allUsers.filter(u => u.role === "field");
  const allSelected = fieldUsers.length > 0 && fieldUsers.every(u => selectedMemberIds.has(u.id));

  // 현장팀 사용자 목록 — 지역(branch) 기준 묶음, 멤버 많은 지역부터
  const branchOf = (u: User) => branchShortOf(u) || "ZZZ";
  // 지역별 멤버 수 집계 (멤버 많은 지역이 먼저 보이도록)
  const branchCount: Record<string, number> = {};
  for (const u of fieldUsers) {
    const b = branchOf(u);
    branchCount[b] = (branchCount[b] || 0) + 1;
  }
  const sortedUsers = [...fieldUsers].sort((a, b) => {
    const ab = branchOf(a);
    const bb = branchOf(b);
    if (ab !== bb) {
      // 1차: 같은 지역의 멤버 수 desc
      const diff = (branchCount[bb] || 0) - (branchCount[ab] || 0);
      if (diff !== 0) return diff;
      // 동률이면 지역명 가나다순
      return ab.localeCompare(bb, "ko");
    }
    // 같은 지역 내에서는 이름 가나다순
    return (a.name || "").localeCompare(b.name || "", "ko");
  });
  // 검색 중이면 이름 또는 지역이 맞는 팀원만
  const visibleUsers = searching
    ? sortedUsers.filter(u => matchesQuery(u.name || "", query) || matchesQuery(branchShortOf(u), query))
    : sortedUsers;

  return (
    <div className="bg-white border-b border-gray-200 px-2 pb-2 z-30 max-h-[16vh] overflow-y-auto">
      {/* 헤더(팀원 필터 라벨 + 검색칸 + 닫기 버튼) 를 스크롤 시에도 고정되게 sticky */}
      <div className="sticky top-0 bg-white pt-2 pb-1.5 -mx-2 px-2 mb-1.5 flex items-center gap-2 border-b border-gray-100 z-10">
        <span className="text-xs font-bold text-gray-700 shrink-0">팀원 필터</span>
        <div className="relative flex-1 min-w-0 max-w-xs">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // 폰 키보드의 '검색' 키 → 키보드만 내림 (결과는 이미 아래에 보임)
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) e.currentTarget.blur(); }}
            enterKeyHint="search"
            placeholder="이름·지역 검색"
            aria-label="팀원 검색"
            className="w-full pl-7 pr-7 py-1 border border-gray-200 rounded-lg leading-5 outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 active:bg-gray-100"
              aria-label="검색어 지우기"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 ml-auto px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-bold active:bg-blue-600"
        >
          닫기
        </button>
      </div>
      {searching && visibleUsers.length === 0 ? (
        <p className="py-2 text-center text-xs text-gray-400">&quot;{query.trim()}&quot; 에 맞는 팀원이 없습니다</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-0.5">
          {/* 전체 토글 버튼 (개별 클릭처럼 동작) — 검색 중엔 숨김 (검색된 사람만이 아니라 모두가 선택돼 헷갈림) */}
          {!searching && (
            <button
              onClick={() => {
                if (allSelected) {
                  // 전체 해제 → 빈 달력
                  setSelectedMemberIds(new Set());
                  setFilterActive(true);
                } else {
                  // 전체 선택
                  setSelectedMemberIds(new Set(fieldUsers.map(u => u.id)));
                  setFilterActive(true);
                }
              }}
              className={`w-full flex items-center gap-1 px-1 py-1 rounded-md active:bg-gray-50 ${allSelected ? "bg-blue-50" : ""}`}
            >
              <div
                className="w-4 h-4 rounded flex items-center justify-center border-2 shrink-0"
                style={{
                  borderColor: "#3B82F6",
                  backgroundColor: allSelected ? "#3B82F6" : "transparent",
                }}
              >
                {allSelected && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-[11px] text-gray-800 font-medium truncate">전체</span>
            </button>
          )}
          {visibleUsers.map((u) => {
            const uid = u.id;
            const isSelected = selectedMemberIds.has(uid);
            // 색은 검색과 상관없이 원래 순서(현장팀 목록 순번) 기준 — 검색해도 색이 바뀌지 않음
            const userColor = MEMBER_COLORS[fieldUsers.indexOf(u) % MEMBER_COLORS.length];
            const branchShort = branchShortOf(u);
            const displayName = branchShort ? `${u.name}(${branchShort})` : u.name;
            return (
              <button
                key={uid}
                onClick={() => {
                  setSelectedMemberIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(uid)) next.delete(uid);
                    else next.add(uid);
                    setFilterActive(true);
                    return next;
                  });
                }}
                className={`w-full flex items-center gap-1 px-1 py-1 rounded-md active:bg-gray-50 ${isSelected ? "bg-gray-50" : ""}`}
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center border-2 shrink-0"
                  style={{
                    borderColor: userColor,
                    backgroundColor: isSelected ? userColor : "transparent",
                  }}
                >
                  {isSelected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-[11px] text-gray-800 truncate" title={displayName}>{displayName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
