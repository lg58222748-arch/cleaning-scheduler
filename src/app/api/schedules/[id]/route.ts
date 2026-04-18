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

  // 일정 변경: 담당자에게만 푸시 (담당자 변경이면 신/구 담당자 둘 다)
  const targets = new Set<string>();
  if (schedule.memberName && schedule.memberName !== "미배정") targets.add(schedule.memberName);
  if (before?.memberName && before.memberName !== "미배정" && before.memberName !== schedule.memberName) targets.add(before.memberName);

  await addNotification(
    "schedule_updated",
    "일정 변경",
    `${schedule.date} ${schedule.startTime} "${schedule.title}" 일정이 변경되었습니다.${before?.memberName !== schedule.memberName ? ` (${before?.memberName} → ${schedule.memberName})` : ""}`,
    schedule.id,
    targets.size > 0 ? Array.from(targets) : undefined,
    ["ceo", "admin", "scheduler"]
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
      id,
      schedule.memberName && schedule.memberName !== "미배정" ? [schedule.memberName] : undefined,
      ["ceo", "admin", "scheduler"]
    );
  }

  return Response.json({ success: true });
}
