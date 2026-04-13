import { NextRequest } from "next/server";
import { getSwapRequests, addSwapRequest, approveSwap, rejectSwap } from "@/lib/store";

export async function GET() {
  return Response.json(getSwapRequests());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, swapId, fromScheduleId, toScheduleId } = body;

  if (action === "create") {
    const swap = addSwapRequest(fromScheduleId, toScheduleId);
    if (!swap) return Response.json({ error: "일정을 찾을 수 없습니다" }, { status: 400 });
    return Response.json(swap, { status: 201 });
  }

  if (action === "approve") {
    const ok = approveSwap(swapId);
    if (!ok) return Response.json({ error: "교환 처리 실패" }, { status: 400 });
    return Response.json({ success: true });
  }

  if (action === "reject") {
    const ok = rejectSwap(swapId);
    if (!ok) return Response.json({ error: "거절 처리 실패" }, { status: 400 });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
