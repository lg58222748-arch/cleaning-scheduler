"use client";

import { Notification } from "@/types";

interface NotificationPanelProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll?: () => void;
  onClose: () => void;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  schedule_created: { icon: "M12 4v16m8-8H4", color: "text-green-600", bg: "bg-green-100" },
  schedule_cancelled: { icon: "M6 18L18 6M6 6l12 12", color: "text-red-600", bg: "bg-red-100" },
  schedule_updated: { icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", color: "text-blue-600", bg: "bg-blue-100" },
  happy_call_reminder: { icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z", color: "text-orange-600", bg: "bg-orange-100" },
  swap_requested: { icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", color: "text-purple-600", bg: "bg-purple-100" },
  swap_approved: { icon: "M5 13l4 4L19 7", color: "text-green-600", bg: "bg-green-100" },
  swap_rejected: { icon: "M6 18L18 6M6 6l12 12", color: "text-red-600", bg: "bg-red-100" },
};

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

export default function NotificationPanel({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onClose,
}: NotificationPanelProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 bg-black/30 z-50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-b-2xl shadow-xl w-full max-w-md mx-auto max-h-[70vh] flex flex-col animate-[slideDown_0.25s_ease-out]">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-gray-800">알림</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-medium">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button onClick={onMarkAllRead} className="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg font-medium active:bg-blue-100">
                모두 읽음
              </button>
            )}
            {notifications.length > 0 && onClearAll && (
              <button onClick={onClearAll} className="text-xs px-2.5 py-1 bg-red-50 text-red-500 rounded-lg font-medium active:bg-red-100">
                지우기
              </button>
            )}
            <button onClick={onClose} className="p-1.5 active:bg-gray-100 rounded-lg ml-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400 text-sm">
              <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              알림이 없습니다
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.schedule_created;
                return (
                  <div
                    key={n.id}
                    className={`px-4 py-3 active:bg-gray-50 ${!n.read ? "bg-blue-50/50" : ""}`}
                    onClick={() => !n.read && onMarkRead(n.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}>
                        <svg className={`w-4 h-4 ${cfg.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cfg.icon} />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{n.title}</span>
                          {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                        <span className="text-[10px] text-gray-400 mt-1 block">{timeAgo(n.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
