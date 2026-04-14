import { NextRequest } from "next/server";
import { getSchedules, getSchedulesByRange, getUnassignedSchedules, searchSchedules, addSchedule, addUnassignedSchedule, assignSchedule, unassignSchedule, addNotification, deleteAllSchedules, softDeleteSchedule, getDeletedSchedules, restoreSchedule, emptyTrash } from "@/lib/store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const unassigned = searchParams.get("unassigned");
  const query = searchParams.get("q");

  const deleted = searchParams.get("deleted");

  if (query) {
    return Response.json(await searchSchedules(query));
  }
  if (deleted === "true") {
    return Response.json(await getDeletedSchedules());
  }
  if (unassigned === "true") {
    return Response.json(await getUnassignedSchedules());
  }
  if (start && end) {
    return Response.json(await getSchedulesByRange(start, end));
  }
  return Response.json(await getSchedules());
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // 소프트 삭제 (휴지통으로)
  if (body.action === "softDelete" && body.scheduleId) {
    const schedule = await softDeleteSchedule(body.scheduleId);
    return Response.json(schedule || { error: "Not found" });
  }

  // 전체 삭제 (관리자)
  if (body.action === "deleteAll") {
    const count = await deleteAllSchedules();
    return Response.json({ deleted: count });
  }

  // 휴지통에서 복원
  if (body.action === "restore" && body.scheduleId) {
    const schedule = await restoreSchedule(body.scheduleId);
    return Response.json(schedule || { error: "Not found" });
  }

  // 휴지통 비우기
  if (body.action === "emptyTrash") {
    const count = await emptyTrash();
    return Response.json({ deleted: count });
  }

  if (body.action === "assign" && body.scheduleId && body.memberId) {
    const schedule = await assignSchedule(body.scheduleId, body.memberId, body.memberName);
    if (!schedule) return Response.json({ error: "Not found" }, { status: 404 });
    await addNotification(
      "schedule_created",
      "일정 배정",
      `"${schedule.title}" 일정이 ${schedule.memberName}님에게 배정되었습니다.`,
      schedule.id
    );
    return Response.json(schedule);
  }

  if (body.action === "unassign" && body.scheduleId) {
    const schedule = await unassignSchedule(body.scheduleId);
    if (!schedule) return Response.json({ error: "Not found" }, { status: 404 });
    await addNotification(
      "schedule_updated",
      "일정 반환",
      `"${schedule.title}" 일정이 대기방으로 반환되었습니다.`,
      schedule.id
    );
    return Response.json(schedule);
  }

  if (body.action === "addUnassigned") {
    const schedule = await addUnassignedSchedule({
      title: body.title,
      location: body.location || "",
      date: body.date,
      startTime: body.startTime || "09:00",
      endTime: body.endTime || "18:00",
      googleEventId: body.googleEventId,
      note: body.note || "",
    });
    if (!schedule) return Response.json({ error: "duplicate or failed" }, { status: 200 });
    return Response.json(schedule, { status: 201 });
  }

  const schedule = await addSchedule({
    memberId: body.memberId,
    memberName: body.memberName,
    title: body.title,
    location: body.location || "",
    date: body.date,
    startTime: body.startTime,
    endTime: body.endTime,
    googleEventId: body.googleEventId,
    note: body.note || "",
  });

  await addNotification(
    "schedule_created",
    "새 일정 등록",
    `${schedule.date} ${schedule.startTime} "${schedule.title}" 일정이 ${schedule.memberName}님에게 배정되었습니다.`,
    schedule.id
  );

  return Response.json(schedule, { status: 201 });
}
