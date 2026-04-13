import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return new Response(
      `<html><body><script>window.opener?.postMessage({type:'google-auth-error',error:'${error}'},'*');window.close();</script></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
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
    return new Response(
      `<html><body><script>window.opener?.postMessage({type:'google-auth-error',error:'토큰 교환 실패'},'*');window.close();</script></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // 부모 창에 토큰 전달 후 팝업 닫기
  return new Response(
    `<html><body><script>
      window.opener?.postMessage({
        type:'google-auth-success',
        accessToken:'${tokenData.access_token}',
        refreshToken:'${tokenData.refresh_token || ""}'
      },'*');
      window.close();
    </script></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
