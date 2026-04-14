"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchGoogleEvents } from "@/lib/api";

interface GoogleCalendarSyncProps {
  onImport: (events: GoogleEvent[]) => void;
}

export interface GoogleEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  description?: string;
}

export default function GoogleCalendarSync({ onImport }: GoogleCalendarSyncProps) {
  const [connected, setConnected] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFetchEvents = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const now = new Date();
      const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      const data = await fetchGoogleEvents(
        token,
        now.toISOString(),
        sixtyDaysLater.toISOString()
      );
      if (data.items) {
        setEvents(data.items);
      }
    } catch {
      setError("일정을 가져오는데 실패했습니다");
    }
    setLoading(false);
  }, []);

  // URL에서 토큰 확인 (리디렉트 방식)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("google_token");
    if (token) {
      setAccessToken(token);
      setConnected(true);
      setError(null);
      handleFetchEvents(token);
      // URL에서 토큰 파라미터 제거
      const url = new URL(window.location.href);
      url.searchParams.delete("google_token");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [handleFetchEvents]);

  // sessionStorage에서 토큰 복원
  useEffect(() => {
    const saved = sessionStorage.getItem("google_access_token");
    if (saved && !accessToken) {
      setAccessToken(saved);
      setConnected(true);
      handleFetchEvents(saved);
    }
  }, [accessToken, handleFetchEvents]);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    // 새 탭으로 Google OAuth (현재 페이지 유지)
    const w = window.open("/api/calendar?action=auth-redirect", "_blank");
    // 새 탭에서 돌아오면 토큰 감지
    const check = setInterval(() => {
      const token = sessionStorage.getItem("google_access_token");
      if (token && !accessToken) {
        clearInterval(check);
        setAccessToken(token);
        setConnected(true);
        setLoading(false);
        handleFetchEvents(token);
      }
      // 탭이 닫혔는데 토큰 없으면 취소
      if (w?.closed && !sessionStorage.getItem("google_access_token")) {
        clearInterval(check);
        setLoading(false);
      }
    }, 500);
    // 30초 타임아웃
    setTimeout(() => { clearInterval(check); setLoading(false); }, 30000);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
          </svg>
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Google Calendar 연동</h3>
          <p className="text-sm text-gray-500">
            {connected ? "연결됨" : "구글 캘린더에서 일정을 가져옵니다"}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {!connected ? (
        <button
          onClick={handleConnect}
          disabled={loading}
          className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg active:border-blue-400 active:bg-blue-50 flex items-center justify-center gap-2 font-medium text-gray-700"
        >
          {loading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          Google Calendar 연결
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-green-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              연결됨
            </span>
            <button
              onClick={() => accessToken && handleFetchEvents(accessToken)}
              disabled={loading}
              className="text-sm px-3 py-1 bg-blue-50 text-blue-600 rounded-lg active:bg-blue-100"
            >
              {loading ? "가져오는 중..." : "새로고침"}
            </button>
          </div>

          {events.length > 0 && (
            <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
              {events.map((event) => (
                <div key={event.id} className="px-3 py-2.5 border-b border-gray-100 last:border-0">
                  <div className="text-sm font-medium text-gray-800">{event.summary}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {event.start.dateTime
                      ? new Date(event.start.dateTime).toLocaleDateString("ko", { month: "long", day: "numeric", weekday: "short" })
                      : event.start.date}
                  </div>
                </div>
              ))}
            </div>
          )}

          {events.length > 0 && (
            <button
              onClick={() => onImport(events)}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg active:bg-blue-600 text-sm font-medium"
            >
              {events.length}개 일정 가져오기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
