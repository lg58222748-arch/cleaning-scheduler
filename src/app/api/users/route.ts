import { NextRequest } from "next/server";
import { getUsers, getPendingUsers, approveUser, rejectUser, changeUserRole } from "@/lib/store";

export async function GET() {
  return Response.json({
    users: await getUsers(),
    pendingUsers: await getPendingUsers(),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === "approve" && body.userId) {
    const ok = await approveUser(body.userId);
    if (!ok) return Response.json({ error: "사용자를 찾을 수 없습니다" }, { status: 404 });
    return Response.json({ success: true });
  }

  if (body.action === "reject" && body.userId) {
    const ok = await rejectUser(body.userId);
    if (!ok) return Response.json({ error: "사용자를 찾을 수 없습니다" }, { status: 404 });
    return Response.json({ success: true });
  }

  if (body.action === "changeRole" && body.userId && body.role) {
    const ok = await changeUserRole(body.userId, body.role);
    if (!ok) return Response.json({ error: "역할 변경 실패" }, { status: 500 });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
