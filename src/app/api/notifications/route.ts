import { NextRequest } from "next/server";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteAllNotifications,
  deleteNotificationsByIds,
  checkHappyCallReminders,
  createSystemNotice,
  getSystemNotices,
  deleteSystemNotice,
} from "@/lib/store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("notices") === "true") {
    return Response.json({ notices: await getSystemNotices() });
  }
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

  if (body.action === "deleteMany" && Array.isArray(body.ids)) {
    const count = await deleteNotificationsByIds(body.ids.map(String));
    return Response.json({ success: true, deleted: count });
  }

  if (body.action === "systemNotice" && body.title && body.message) {
    const notice = await createSystemNotice(String(body.title), String(body.message));
    return Response.json(notice, { status: 201 });
  }

  if (body.action === "deleteNotice" && body.id) {
    const ok = await deleteSystemNotice(String(body.id));
    return Response.json({ success: ok });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
