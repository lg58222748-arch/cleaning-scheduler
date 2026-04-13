import { NextRequest } from "next/server";
import { getSchedules, getSchedulesByRange, getUnassignedSchedules, addSchedule, addUnassignedSchedule, assignSchedule, unassignSchedule, addNotification } from "@/lib/store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const unassigned = searchParams.get("unassigned");

  if (unassigned === "true") {
    return Response.json(getUnassignedSchedules());
  }
  if (start && end) {
    return Response.json(getSchedulesByRange(start, end));
  }
  return Response.json(getSchedules());
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // 배정 액션
  if (body.action === "assign" && body.scheduleId && body.memberId) {
    const schedule = assignSchedule(body.scheduleId, body.memberId, body.memberName);
    if (!schedule) return Response.json({ error: "Not found" }, { status: 404 });
    addNotification(
      "schedule_created",
      "일정 배정",
      `"${schedule.title}" 일정이 ${schedule.memberName}님에게 배정되었습니다.`,
      schedule.id
    );
    return Response.json(schedule);
  }

  // 일정 반환 (배정 해제 → 대기방으로)
  if (body.action === "unassign" && body.scheduleId) {
    const schedule = unassignSchedule(body.scheduleId);
    if (!schedule) return Response.json({ error: "Not found" }, { status: 404 });
    addNotification(
      "schedule_updated",
      "일정 반환",
      `"${schedule.title}" 일정이 대기방으로 반환되었습니다.`,
      schedule.id
    );
    return Response.json(schedule);
  }

  // 미배정 일정 추가 (구글 캘린더에서 가져올 때)
  if (body.action === "addUnassigned") {
    const schedule = addUnassignedSchedule({
      title: body.title,
      location: body.location || "",
      date: body.date,
      startTime: body.startTime || "09:00",
      endTime: body.endTime || "18:00",
      googleEventId: body.googleEventId,
      note: body.note || "",
    });
    return Response.json(schedule, { status: 201 });
  }

  // 기존: 팀원 지정하여 일정 추가
  const schedule = addSchedule({
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

  addNotification(
    "schedule_created",
    "새 일정 등록",
    `${schedule.date} ${schedule.startTime} "${schedule.title}" 일정이 ${schedule.memberName}님에게 배정되었습니다.`,
    schedule.id
  );

  return Response.json(schedule, { status: 201 });
}
