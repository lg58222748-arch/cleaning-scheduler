import { NextRequest } from "next/server";
import { checkHappyCallReminders, purgeOldNotifications } from "@/lib/store";

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
  // 30일 지난 알림 자동 정리 (실패해도 해피콜 결과는 반환)
  let purged = 0;
  try { purged = await purgeOldNotifications(30); } catch { /* 무시 */ }
  return Response.json({ created: reminders.length, purgedNotifications: purged });
}
