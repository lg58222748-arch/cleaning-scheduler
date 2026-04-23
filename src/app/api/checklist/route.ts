import { NextRequest } from "next/server";
import { getChecklist, updateChecklistItem, setAllChecklistItems, submitChecklist } from "@/lib/store";

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

  // 전체선택/해제: 개별 토글 병렬 호출로 인한 race 방지 — 단일 원자적 업데이트
  if (body.action === "toggleAll" && body.scheduleId) {
    const cl = await setAllChecklistItems(body.scheduleId, !!body.checked);
    if (!cl) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(cl);
  }

  if (body.action === "submit" && body.scheduleId) {
    // 서버가 원자적으로 전체 체크 + submitted_at 으로 덮어씀 — client race 와 무관하게 항상 정확.
    const cl = await submitChecklist(body.scheduleId);
    if (!cl) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(cl);
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
