"use client";

import { useEffect, useState } from "react";

// 브라우저 기본 alert/confirm 은 URL 도메인을 표시 → 커스텀 모달로 대체
// 사용: await showAlert("메시지") / await showConfirm("질문") -> true/false

type DialogItem = {
  id: number;
  type: "alert" | "confirm";
  message: string;
  resolve: (v: boolean) => void;
};

let counter = 0;
const listeners = new Set<(items: DialogItem[]) => void>();
let queue: DialogItem[] = [];

function publish() {
  listeners.forEach((l) => l([...queue]));
}

export function showAlert(message: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    queue.push({ id: ++counter, type: "alert", message, resolve });
    publish();
  });
}

export function showConfirm(message: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    queue.push({ id: ++counter, type: "confirm", message, resolve });
    publish();
  });
}

export function DialogHost() {
  const [items, setItems] = useState<DialogItem[]>([]);

  useEffect(() => {
    const cb = (next: DialogItem[]) => setItems(next);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);

  if (items.length === 0) return null;
  const current = items[0];

  function close(value: boolean) {
    current.resolve(value);
    queue = queue.filter((i) => i.id !== current.id);
    publish();
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center px-6" onClick={(e) => { if (e.target === e.currentTarget && current.type === "alert") close(true); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-[modalIn_0.15s_ease-out]">
        <div className="px-5 pt-5 pb-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
          {current.message}
        </div>
        <div className="flex border-t border-gray-100">
          {current.type === "confirm" && (
            <button
              onClick={() => close(false)}
              className="flex-1 py-3 text-sm font-medium text-gray-500 active:bg-gray-50 border-r border-gray-100"
            >
              취소
            </button>
          )}
          <button
            onClick={() => close(true)}
            className="flex-1 py-3 text-sm font-bold text-blue-600 active:bg-blue-50"
            autoFocus
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
