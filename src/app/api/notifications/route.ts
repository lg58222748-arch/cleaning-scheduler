import { NextRequest } from "next/server";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  checkHappyCallReminders,
} from "@/lib/store";

export async function GET() {
  // 해피콜 리마인더 자동 체크
  checkHappyCallReminders();

  return Response.json({
    notifications: getNotifications(),
    unreadCount: getUnreadCount(),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === "markRead" && body.id) {
    markNotificationRead(body.id);
    return Response.json({ success: true });
  }

  if (body.action === "markAllRead") {
    markAllNotificationsRead();
    return Response.json({ success: true });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
