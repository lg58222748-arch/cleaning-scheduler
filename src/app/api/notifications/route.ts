import { NextRequest } from "next/server";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteAllNotifications,
  checkHappyCallReminders,
} from "@/lib/store";

export async function GET() {
  await checkHappyCallReminders();

  return Response.json({
    notifications: await getNotifications(),
    unreadCount: await getUnreadCount(),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === "markRead" && body.id) {
    await markNotificationRead(body.id);
    return Response.json({ success: true });
  }

  if (body.action === "markAllRead") {
    await markAllNotificationsRead();
    return Response.json({ success: true });
  }

  if (body.action === "clearAll") {
    const count = await deleteAllNotifications();
    return Response.json({ success: true, deleted: count });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
