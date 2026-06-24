"use client";

import { useEffect } from "react";

// Next.js 16 App Router 에러 바운더리 — page.tsx 하위 어디서 에러 나도 흰 화면 대신 이 화면 표시
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 에러 콘솔 출력 (Sentry 도입 시 여기서 자동 전송)
    console.error("[ErrorBoundary]", error);

    // stale chunk 자동 복구 — 새 배포로 옛 chunk 가 사라져 dynamic import 가 실패한 경우.
    // 옛 Service Worker 가 죽은 HTML/chunk 를 계속 물고 있으면 단순 reload 로는 안 풀리므로
    // SW unregister + 캐시 전체 삭제 후 reload 한다. 무한루프 방지 위해 세션당 1회만.
    const msg = `${error?.message || ""} ${error?.name || ""} ${error?.stack || ""}`;
    const isChunkError =
      /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically imported/i.test(msg);
    if (isChunkError && typeof window !== "undefined") {
      try {
        const KEY = "chunk-recover-at";
        const last = Number(sessionStorage.getItem(KEY) || 0);
        if (Date.now() - last > 15000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          // SW 해제 + 캐시 전체 삭제 후 강제 새로고침 (옛 chunk 캐시 완전 제거)
          const hardReload = () => window.location.reload();
          const clean = async () => {
            try {
              if ("serviceWorker" in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((r) => r.unregister()));
              }
              if ("caches" in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
              }
            } catch { /* 무시 */ }
            hardReload();
          };
          // 1.5초 안에 정리 안 끝나면 그냥 리로드 (블로킹 방지)
          const t = setTimeout(hardReload, 1500);
          clean().finally(() => clearTimeout(t));
        }
      } catch { /* sessionStorage 막힌 환경 무시 */ }
    }
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold mb-2">앗, 일시적인 오류가 발생했어요</h1>
        <p className="text-gray-600 text-sm mb-6">
          잠시 후 다시 시도해주세요.
          <br />
          계속 발생하면 관리자에게 문의해주세요.
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => reset()}
            className="w-full py-3 bg-[#3a9ad9] text-white rounded-lg font-medium active:bg-[#2d7eb5]"
          >
            다시 시도
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium active:bg-gray-200"
          >
            홈으로 이동
          </button>
        </div>

        {process.env.NODE_ENV === "development" && (
          <details className="mt-6 text-left bg-red-50 p-3 rounded-lg text-xs">
            <summary className="cursor-pointer font-medium text-red-700">개발자용: 에러 상세</summary>
            <pre className="mt-2 whitespace-pre-wrap text-red-600 overflow-auto max-h-64">
              {error.message}
              {error.digest && `\n\ndigest: ${error.digest}`}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
