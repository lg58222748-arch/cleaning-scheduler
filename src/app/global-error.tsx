"use client";

import { useEffect } from "react";

// 최상위 layout 에러까지 잡는 글로벌 에러 바운더리 — html/body 직접 포함 필수
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalErrorBoundary]", error);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "#fff",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>앱에 문제가 발생했어요</h1>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
            앱을 다시 시작해주세요.
            <br />
            계속 발생하면 관리자에게 문의해주세요.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "12px 24px",
              background: "#3a9ad9",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 500,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            앱 다시 시작
          </button>
        </div>
      </body>
    </html>
  );
}
