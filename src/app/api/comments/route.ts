import { NextRequest } from "next/server";
import { getCommentsBySchedule, addComment, deleteComment, addNotification, getSchedule } from "@/lib/store";

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

  const schedule = await getSchedule(body.scheduleId);
  let scheduleLabel = "";
  if (schedule) {
    const [, m, d] = schedule.date.split("-");
    const dateShort = m && d ? `${parseInt(m, 10)}/${parseInt(d, 10)}` : schedule.date;
    const memberName = schedule.memberName && schedule.memberName !== "미배정" ? schedule.memberName : "";
    const titleShort = (schedule.title || "").slice(0, 40);
    scheduleLabel = [dateShort, memberName, titleShort].filter(Boolean).join(" ");
  }
  const snippet = `${body.content.slice(0, 30)}${body.content.length > 30 ? "..." : ""}`;
  const message = scheduleLabel
    ? `${scheduleLabel} · ${body.authorName}님: ${snippet}`
    : `${body.authorName}님이 댓글을 남겼습니다: ${snippet}`;

  await addNotification("schedule_updated", "새 댓글", message, body.scheduleId);
  return Response.json(comment, { status: 201 });
}
