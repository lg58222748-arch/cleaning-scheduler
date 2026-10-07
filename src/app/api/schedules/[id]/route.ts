import { NextRequest } from "next/server";
import { updateSchedule, deleteSchedule, addNotification, getSchedule } from "@/lib/store";
import { supabase } from "@/lib/supabase";

// 일정 1건 전체 조회 (예약 본문 포함) — 목록은 본문을 빼고 받으므로 상세·수정 화면에서 사용
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const schedule = await getSchedule(id);
  if (!schedule) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(schedule);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // before memberName 만 단일 행으로 조회 (전체 스케줄 fetch 하지 않음 — 입금확인/제목 수정 등 빈번한 PUT 에서 큰 속도차)
  const { data: beforeRow } = await supabase.from("schedules").select("member_name").eq("id", id).maybeSingle();
  const beforeMemberName = beforeRow?.member_name ? String(beforeRow.member_name) : "";

  const schedule = await updateSchedule(id, body);
  if (!schedule) return Response.json({ error: "Not found" }, { status: 404 });

  // 일정 변경: 담당자에게만 푸시 (담당자 변경이면 신/구 담당자 둘 다)
  const targets = new Set<string>();
  if (schedule.memberName && schedule.memberName !== "미배정") targets.add(schedule.memberName);
  if (beforeMemberName && beforeMemberName !== "미배정" && beforeMemberName !== schedule.memberName) targets.add(beforeMemberName);

  // 응답을 먼저 내려보내기 위해 알림은 await 하지 않음 — 클라이언트는 DB update 완료된 schedule 을 즉시 받음
  // (알림 실패해도 PUT 성공. 백그라운드로 진행)
  addNotification(
    "schedule_updated",
    "일정 변경",
    `${schedule.date} ${schedule.startTime} "${schedule.title}" 일정이 변경되었습니다.${beforeMemberName !== schedule.memberName ? ` (${beforeMemberName} → ${schedule.memberName})` : ""}`,
    schedule.id,
    targets.size > 0 ? Array.from(targets) : undefined,
    ["ceo", "admin", "scheduler"]
  ).catch((err) => { console.error("[schedule PUT] addNotification 실패:", err); });

  return Response.json(schedule);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1건만 조회 (예전엔 전체 일정 수천 건을 다 불러와서 찾았음)
  const schedule = await getSchedule(id);
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
