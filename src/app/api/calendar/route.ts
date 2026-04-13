import { NextRequest } from "next/server";

// Google Calendar API 연동
// 실제 사용 시 .env.local에 아래 값들을 설정해야 합니다:
// GOOGLE_CLIENT_ID=your_client_id
// GOOGLE_CLIENT_SECRET=your_client_secret
// GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/callback

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "auth-url") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return Response.json({
        error: "Google Calendar API가 설정되지 않았습니다. .env.local 파일을 확인해주세요.",
        needSetup: true,
      }, { status: 400 });
    }

    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/calendar/callback";
    const scope = encodeURIComponent("https://www.googleapis.com/auth/calendar.readonly");
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

    return Response.json({ authUrl });
  }

  return Response.json({ message: "Google Calendar API endpoint" });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Google Calendar에서 일정 가져오기 (토큰이 있는 경우)
  if (body.action === "fetch-events") {
    const accessToken = body.accessToken;
    if (!accessToken) {
      return Response.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const timeMin = body.timeMin || new Date().toISOString();
    const timeMax = body.timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const calendarRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
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
