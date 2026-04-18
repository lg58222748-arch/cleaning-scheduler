import { NextRequest } from "next/server";
import { checkHappyCallReminders } from "@/lib/store";

// Vercel Cron 전용: 매일 UTC 00:00 = 한국시간 오전 9시 1회 실행
// cron 헤더 검증으로 외부 임의 호출 차단
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  // CRON_SECRET 환경변수가 설정돼 있으면 검증, 없으면 Vercel cron 헤더만 통과
  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const reminders = await checkHappyCallReminders();
  return Response.json({ created: reminders.length });
}
