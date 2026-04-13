import { NextRequest } from "next/server";
import { updateSchedule, deleteSchedule, addNotification, getSchedules } from "@/lib/store";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const allSchedules = await getSchedules();
  const before = allSchedules.find((s) => s.id === id);
  const schedule = await updateSchedule(id, body);
  if (!schedule) return Response.json({ error: "Not found" }, { status: 404 });

  await addNotification(
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

  const allSchedules = await getSchedules();
  const schedule = allSchedules.find((s) => s.id === id);
  const deleted = await deleteSchedule(id);
  if (!deleted) return Response.json({ error: "Not found" }, { status: 404 });

  if (schedule) {
    await addNotification(
      "schedule_cancelled",
      "일정 취소",
      `${schedule.date} ${schedule.startTime} "${schedule.title}" 일정이 취소되었습니다. (담당: ${schedule.memberName})`,
      id
    );
  }

  return Response.json({ success: true });
}
