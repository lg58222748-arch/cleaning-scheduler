import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const baseUrl = process.env.GOOGLE_REDIRECT_URI
    ? new URL(process.env.GOOGLE_REDIRECT_URI).origin
    : "http://localhost:3000";

  if (error) {
    return Response.redirect(`${baseUrl}/?google_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return Response.json({ error: "No code provided" }, { status: 400 });
  }

  // 코드를 토큰으로 교환
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/calendar/callback",
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    return Response.redirect(`${baseUrl}/?google_error=token_exchange_failed`);
  }

  // 토큰을 sessionStorage에 저장하는 HTML 페이지로 리디렉트
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body>
<script>
  sessionStorage.setItem("google_access_token", "${tokenData.access_token}");
  ${tokenData.refresh_token ? `localStorage.setItem("google_refresh_token", "${tokenData.refresh_token}");` : ""}
  ${tokenData.refresh_token ? `sessionStorage.setItem("google_refresh_token", "${tokenData.refresh_token}");` : ""}
  window.location.href = "/?google_token=${tokenData.access_token}";
</script>
<p>연결 중...</p>
</body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
