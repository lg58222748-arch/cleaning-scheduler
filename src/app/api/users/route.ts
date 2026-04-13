import { NextRequest } from "next/server";
import { getUsers, getPendingUsers, approveUser, rejectUser } from "@/lib/store";

export async function GET() {
  return Response.json({
    users: getUsers(),
    pendingUsers: getPendingUsers(),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === "approve" && body.userId) {
    const ok = approveUser(body.userId);
    if (!ok) return Response.json({ error: "사용자를 찾을 수 없습니다" }, { status: 404 });
    return Response.json({ success: true });
  }

  if (body.action === "reject" && body.userId) {
    const ok = rejectUser(body.userId);
    if (!ok) return Response.json({ error: "사용자를 찾을 수 없습니다" }, { status: 404 });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
