import { NextRequest } from "next/server";
import { getChecklist, updateChecklistItem, submitChecklist } from "@/lib/store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scheduleId = searchParams.get("scheduleId");
  if (!scheduleId) return Response.json({ error: "scheduleId required" }, { status: 400 });
  return Response.json(await getChecklist(scheduleId));
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === "toggle" && body.scheduleId && body.itemId !== undefined) {
    const cl = await updateChecklistItem(body.scheduleId, body.itemId, body.checked);
    if (!cl) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(cl);
  }

  if (body.action === "submit" && body.scheduleId) {
    const cl = await submitChecklist(body.scheduleId);
    if (!cl) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(cl);
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
