import { NextRequest } from "next/server";
import { reorderSchedules, getSchedulesCreatedSince, getSchedules, getSchedulesByRange, getUnassignedSchedules, searchSchedules, addSchedule, addUnassignedSchedule, assignSchedule, reassignSchedule, unassignSchedule, addNotification, deleteAllSchedules, softDeleteSchedule, getDeletedSchedules, restoreSchedule, emptyTrash } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const unassigned = searchParams.get("unassigned");
  const query = searchParams.get("q");

  const deleted = searchParams.get("deleted");
  // 새 버전 앱만 lite=1 을 보냄 → 본문 뺀 가벼운 목록. 없으면(옛 버전) 본문 포함 목록.
  const lite = searchParams.get("lite") === "1";

  if (query) {
    const includeDeleted = searchParams.get("includeDeleted") === "true";
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);
    // 현장팀 검색 범위 (본인 + 추가 열람 허용 계정)
    const uid = searchParams.get("uid") || undefined;
    const names = searchParams.getAll("names").filter(Boolean);
    const scope = uid || names.length > 0 ? { uid, names } : undefined;
    return Response.json(await searchSchedules(query, includeDeleted, offset, scope));
  }
  // 특정 시각 이후 등록분 (영업 등록 통계)
  const createdSince = searchParams.get("createdSince");
  if (createdSince) {
    return Response.json(await getSchedulesCreatedSince(createdSince));
  }
  if (deleted === "true") {
    return Response.json(await getDeletedSchedules());
  }
  if (unassigned === "true") {
    return Response.json(await getUnassignedSchedules(lite));
  }
  if (start && end) {
    return Response.json(await getSchedulesByRange(start, end, lite));
  }
  return Response.json(await getSchedules(lite));
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
    // 미입금 일정 배정 차단 — 제목에 /미입금 포함되어 있으면 거부
    const { data: before } = await supabase.from("schedules").select("title").eq("id", body.scheduleId).maybeSingle();
    if (before?.title && String(before.title).includes("/미입금")) {
      return Response.json({ error: "unpaid_block", message: "미입금 일정은 배정할 수 없습니다. 먼저 입금확인 후 배정해주세요." }, { status: 400 });
    }
    const schedule = await assignSchedule(body.scheduleId, body.memberId, body.memberName);
    if (!schedule) return Response.json({ error: "Not found" }, { status: 404 });
    const msg = `"${schedule.title}" 일정이 ${schedule.memberName}님에게 배정되었습니다.`;
    // 배정받은 본인 + 관리자(ceo/admin/scheduler)
    await addNotification("schedule_created", "일정 배정", msg, schedule.id, [schedule.memberName], ["ceo", "admin", "scheduler"]);
    return Response.json(schedule);
  }

  // 담당 바꾸기 (대표·관리자·일정관리자, 일정 상세의 '담당 변경') — 예전 담당·새 담당 둘 다에게 알림.
  // 반환→재배정을 한 번에. 완료 등 상태는 그대로 두고, 미배정이었다면 일반 배정과 똑같이 처리.
  if (body.action === "reassign" && body.scheduleId && body.memberId && body.memberName) {
    const { data: before } = await supabase.from("schedules").select("title,member_name,status").eq("id", body.scheduleId).maybeSingle();
    if (!before || before.status === "deleted") return Response.json({ error: "Not found" }, { status: 404 });
    if (before.title && String(before.title).includes("/미입금")) {
      return Response.json({ error: "unpaid_block", message: "미입금 일정은 배정할 수 없습니다. 먼저 입금확인 후 배정해주세요." }, { status: 400 });
    }
    const oldName = before.member_name && before.member_name !== "미배정" ? String(before.member_name) : "";
    const schedule = before.status === "unassigned"
      ? await assignSchedule(body.scheduleId, body.memberId, body.memberName)
      : await reassignSchedule(body.scheduleId, body.memberId, body.memberName);
    if (!schedule) return Response.json({ error: "Not found" }, { status: 404 });
    const changed = oldName && oldName !== schedule.memberName;
    const msg = changed
      ? `"${schedule.title}" 일정 담당이 ${oldName}님 → ${schedule.memberName}님으로 바뀌었습니다.`
      : `"${schedule.title}" 일정이 ${schedule.memberName}님에게 배정되었습니다.`;
    await addNotification(changed ? "schedule_updated" : "schedule_created", changed ? "담당 변경" : "일정 배정", msg, schedule.id,
      changed ? [schedule.memberName, oldName] : [schedule.memberName], ["ceo", "admin", "scheduler"]);
    return Response.json(schedule);
  }

  if (body.action === "unassign" && body.scheduleId) {
    // 원래 담당자를 unassign 전에 기록 (unassign 후엔 member_name 이 "미배정" 으로 바뀜)
    const { data: before } = await supabase.from("schedules").select("member_name").eq("id", body.scheduleId).single();
    const originalAssignee = before?.member_name && before.member_name !== "미배정" ? String(before.member_name) : "";

    const schedule = await unassignSchedule(body.scheduleId);
    if (!schedule) return Response.json({ error: "Not found" }, { status: 404 });
    const who = body.returnedBy || "";
    const reason = body.reason || "";
    const actorSelfReturn = who && originalAssignee && who === originalAssignee;
    const msg = actorSelfReturn
      ? `${who}님이 "${schedule.title}" 일정을 반환했습니다.${reason ? " 사유: " + reason : ""}`
      : `${who ? who + "님이 " : ""}${originalAssignee ? originalAssignee + "님의 " : ""}"${schedule.title}" 일정을 반환했습니다.${reason ? " 사유: " + reason : ""}`;

    // 타겟: 관리자(ceo/admin/scheduler) + 반환 실행자 + 원래 담당자
    const targetNames: string[] = [];
    if (who) targetNames.push(who);
    if (originalAssignee && originalAssignee !== who) targetNames.push(originalAssignee);

    await addNotification("schedule_returned", "일정 반환", msg, schedule.id, targetNames.length > 0 ? targetNames : undefined, ["ceo", "admin", "scheduler"]);
    return Response.json(schedule);
  }

  // 같은 날 일정 순서 저장 — sort_order 만 바꿈, 알림 없음
  if (body.action === "reorder" && Array.isArray(body.items)) {
    const r = await reorderSchedules(body.items);
    return Response.json(r, { status: r.ok ? 200 : 500 });
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
      // 영업탭에서 고른 예약금 계좌 (법인/일반)
      depositAccount: body.depositAccount === "corp" || body.depositAccount === "personal" ? body.depositAccount : undefined,
    });
    if (!schedule) return Response.json({ error: "duplicate or failed" }, { status: 200 });
    return Response.json(schedule, { status: 201 });
  }

  const result = await addSchedule({
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

  if (!result.schedule) return Response.json({ error: "저장 실패", detail: result.error }, { status: 500 });
  const schedule = result.schedule;

  await addNotification(
    "schedule_created",
    "새 일정 등록",
    `${schedule.date} ${schedule.startTime} "${schedule.title}" 일정이 ${schedule.memberName}님에게 배정되었습니다.`,
    schedule.id,
    schedule.memberName && schedule.memberName !== "미배정" ? [schedule.memberName] : undefined,
    ["ceo", "admin", "scheduler"]
  );

  return Response.json(schedule, { status: 201 });
}
