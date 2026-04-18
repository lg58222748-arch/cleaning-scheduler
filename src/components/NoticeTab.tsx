"use client";

import { useState, useEffect, useCallback } from "react";
import { Notification } from "@/types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  return `${days}일 전`;
}

const TEMPLATES = [
  { label: "서버 점검", title: "서버 점검 안내", body: "오늘 밤 00:00~02:00 서버 점검이 예정되어 있습니다. 해당 시간에는 앱 사용이 일시 제한될 수 있습니다." },
  { label: "업데이트 안내", title: "업데이트 안내", body: "새로운 기능이 추가되었습니다. 앱을 재시작해 주세요." },
  { label: "긴급 공지", title: "긴급 공지", body: "" },
];

export default function NoticeTab() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [notices, setNotices] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotices = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?notices=true");
      const json = await res.json();
      setNotices((json.notices as Notification[]) || []);
    } catch { /* 조회 실패 */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadNotices(); }, [loadNotices]);

  async function handleSend() {
    if (!title.trim() || !message.trim()) return;
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "systemNotice", title: title.trim(), message: message.trim() }),
      });
      if (res.ok) {
        setTitle("");
        setMessage("");
        await loadNotices();
      }
    } catch { /* 전송 실패 */ }
    setSending(false);
  }

  async function handleDelete(id: string) {
    setNotices((prev) => prev.filter((n) => n.id !== id));
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteNotice", id }),
      });
    } catch { /* 삭제 실패 - 낙관적 업데이트 유지 */ }
  }

  function applyTemplate(t: typeof TEMPLATES[number]) {
    setTitle(t.title);
    setMessage(t.body);
  }

  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-800">공지사항 발송</h1>
          <p className="text-xs text-gray-500">모든 사용자에게 푸시 알림과 함께 전달됩니다</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4">
        <div className="flex gap-2 flex-wrap mb-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              onClick={() => applyTemplate(t)}
              className="px-3 py-1.5 text-xs rounded-full bg-orange-50 text-orange-700 active:bg-orange-100 font-medium"
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="block text-xs font-medium text-gray-600 mb-1">제목</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 서버 점검 안내"
          maxLength={60}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 mb-3"
        />

        <label className="block text-xs font-medium text-gray-600 mb-1">내용</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="공지 내용을 입력하세요"
          rows={5}
          maxLength={500}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 resize-none mb-3"
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{message.length}/500</span>
          <button
            onClick={handleSend}
            disabled={!title.trim() || !message.trim() || sending}
            className="px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-bold active:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400"
          >
            {sending ? "전송 중..." : "공지 발송"}
          </button>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">최근 공지</h2>
        <button onClick={loadNotices} className="text-xs text-gray-400 active:text-gray-600">새로고침</button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 text-sm py-8">불러오는 중...</div>
      ) : notices.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-8 bg-white rounded-2xl border border-gray-100">
          발송된 공지가 없습니다
        </div>
      ) : (
        <div className="space-y-2">
          {notices.map((n) => (
            <div key={n.id} className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800">{n.title}</div>
                  <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap leading-relaxed">{n.message}</p>
                  <span className="text-xs text-gray-400 mt-1.5 block">{timeAgo(n.createdAt)}</span>
                </div>
                <button
                  onClick={() => handleDelete(n.id)}
                  className="text-xs text-red-400 px-2 py-1 active:text-red-600 active:bg-red-50 rounded"
                  aria-label="삭제"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
