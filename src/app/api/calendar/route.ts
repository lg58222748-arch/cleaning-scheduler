import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "auth-redirect") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return Response.json({
        error: "Google Calendar API가 설정되지 않았습니다.",
        needSetup: true,
      }, { status: 400 });
    }

    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/calendar/callback";
    const scope = encodeURIComponent("https://www.googleapis.com/auth/calendar.readonly");
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=select_account`;

    // 팝업 대신 리디렉트로 이동 (disallowed_useragent 해결)
    return Response.redirect(authUrl);
  }

  if (action === "auth-url") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return Response.json({ error: "Google Calendar API가 설정되지 않았습니다.", needSetup: true }, { status: 400 });
    }
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/calendar/callback";
    const scope = encodeURIComponent("https://www.googleapis.com/auth/calendar.readonly");
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=select_account`;
    return Response.json({ authUrl });
  }

  return Response.json({ message: "Google Calendar API endpoint" });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // 자동 동기화: refresh_token으로 새 access_token 발급 → 이벤트 가져오기
  if (body.action === "auto-sync") {
    const refreshToken = body.refreshToken;
    if (!refreshToken) {
      return Response.json({ error: "refresh_token 없음" }, { status: 401 });
    }

    // refresh_token으로 새 access_token 발급
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        grant_type: "refresh_token",
      }),
    });

    if (!tokenRes.ok) {
      return Response.json({ error: "토큰 갱신 실패", needReauth: true }, { status: 401 });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 60일치 일정 가져오기
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const calendarId = body.calendarId || "primary";

    try {
      const calendarRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=500`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!calendarRes.ok) {
        return Response.json({ error: "캘린더 조회 실패" }, { status: calendarRes.status });
      }

      const data = await calendarRes.json();
      return Response.json({ ...data, newAccessToken: accessToken });
    } catch {
      return Response.json({ error: "캘린더 연결 실패" }, { status: 500 });
    }
  }

  if (body.action === "fetch-events") {
    const accessToken = body.accessToken;
    if (!accessToken) {
      return Response.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const timeMin = body.timeMin || new Date().toISOString();
    const timeMax = body.timeMax || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    // 여러 캘린더에서 일정 가져오기 (calendarId가 있으면 해당 캘린더, 없으면 primary)
    const calendarId = body.calendarId || "primary";

    try {
      const calendarRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=500`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!calendarRes.ok) {
        return Response.json({ error: "캘린더 조회 실패" }, { status: calendarRes.status });
      }

      const data = await calendarRes.json();
      return Response.json(data);
    } catch {
      return Response.json({ error: "캘린더 연결 실패" }, { status: 500 });
    }
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
