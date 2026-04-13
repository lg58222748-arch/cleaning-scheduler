import { NextRequest } from "next/server";
import { updateSchedule, deleteSchedule, addNotification, getSchedules } from "@/lib/store";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // 변경 전 정보 가져오기
  const before = getSchedules().find((s) => s.id === id);
  const schedule = updateSchedule(id, body);
  if (!schedule) return Response.json({ error: "Not found" }, { status: 404 });

  // 일정 변경 알림
  addNotification(
    "schedule_updated",
    "일정 변경",
    `${schedule.date} ${schedule.startTime} "${schedule.title}" 일정이 변경되었습니다.${before?.memberName !== schedule.memberName ? ` (${before?.memberName} → ${schedule.memberName})` : ""}`,
    schedule.id
  );

  return Response.json(schedule);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 삭제 전 정보 가져오기
  const schedule = getSchedules().find((s) => s.id === id);
  const deleted = deleteSchedule(id);
  if (!deleted) return Response.json({ error: "Not found" }, { status: 404 });

  // 일정 취소 알림
  if (schedule) {
    addNotification(
      "schedule_cancelled",
      "일정 취소",
      `${schedule.date} ${schedule.startTime} "${schedule.title}" 일정이 취소되었습니다. (담당: ${schedule.memberName})`,
      id
    );
  }

  return Response.json({ success: true });
}
