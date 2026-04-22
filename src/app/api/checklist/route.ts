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
    // 클라이언트가 최신 상태를 같이 보내면 함께 저장 (전체선택 직후 제출되어도 안전)
    const cl = await submitChecklist(body.scheduleId, body.categories, body.completedCount);
    if (!cl) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(cl);
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
