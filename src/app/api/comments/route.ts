import { NextRequest } from "next/server";
import { getCommentsBySchedule, addComment, deleteComment } from "@/lib/store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scheduleId = searchParams.get("scheduleId");
  if (!scheduleId) {
    return Response.json({ error: "scheduleId required" }, { status: 400 });
  }
  return Response.json(await getCommentsBySchedule(scheduleId));
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === "delete" && body.id) {
    const deleted = await deleteComment(body.id);
    if (!deleted) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ success: true });
  }

  if (!body.scheduleId || !body.authorName || !body.content) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }
  const comment = await addComment(body.scheduleId, body.authorName, body.content);
  return Response.json(comment, { status: 201 });
}
