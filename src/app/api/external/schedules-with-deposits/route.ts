import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 92;

export async function GET(req: NextRequest) {
  const expectedKey = process.env.EXTERNAL_API_KEY;
  if (!expectedKey) {
    return Response.json({ error: "server_misconfigured" }, { status: 500 });
  }
  if (req.headers.get("x-api-key") !== expectedKey) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return Response.json({ error: "from_to_required" }, { status: 400 });
  }
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return Response.json({ error: "invalid_date_format", message: "YYYY-MM-DD" }, { status: 400 });
  }
  const fromMs = Date.parse(from + "T00:00:00Z");
  const toMs = Date.parse(to + "T00:00:00Z");
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs < fromMs) {
    return Response.json({ error: "invalid_range" }, { status: 400 });
  }
  const days = (toMs - fromMs) / (24 * 60 * 60 * 1000) + 1;
  if (days > MAX_RANGE_DAYS) {
    return Response.json({ error: "range_too_wide", maxDays: MAX_RANGE_DAYS }, { status: 400 });
  }

  // settlements ↔ schedules 에 FK 가 없어 PostgREST 관계 조인을 못 쓰므로 2단계로 조회.
  // 1) 날짜 범위의 confirmed/pending 일정 + 미배정(unassigned) 일정 전체.
  //    미배정 은 예약만 받은 상태로 보통 입금과 일정일 이 다를 수 있어 날짜 필터 제외.
  const [rangeRes, unassignedRes] = await Promise.all([
    supabase
      .from("schedules")
      .select("id, title, date, start_time, end_time, member_name, note, status")
      .gte("date", from)
      .lte("date", to)
      .not("status", "in", '("deleted","unassigned")'),
    supabase
      .from("schedules")
      .select("id, title, date, start_time, end_time, member_name, note, status")
      .eq("status", "unassigned"),
  ]);

  if (rangeRes.error) return Response.json({ error: "db_error", message: rangeRes.error.message }, { status: 502 });
  if (unassignedRes.error) return Response.json({ error: "db_error", message: unassignedRes.error.message }, { status: 502 });

  // 중복 id 합치기 (이론상 겹칠 수 없지만 안전하게)
  const byId = new Map<string, (typeof rangeRes.data)[number]>();
  for (const s of rangeRes.data || []) byId.set(s.id, s);
  for (const s of unassignedRes.data || []) byId.set(s.id, s);
  const schedules = Array.from(byId.values());
  if (schedules.length === 0) {
    return Response.json({ range: { from, to }, count: 0, schedules: [] });
  }

  // 2) 그 일정들의 settlements (있으면) — deposit 0 도 허용, settlement 없는 일정도 허용
  const ids = schedules.map((s) => s.id);
  const { data: settlementRows, error: stErr } = await supabase
    .from("settlements")
    .select("id, schedule_id, status, quote, deposit, balance, customer_name, customer_phone")
    .in("schedule_id", ids);
  if (stErr) {
    return Response.json({ error: "db_error", message: stErr.message }, { status: 502 });
  }

  const settlementMap = new Map<string, typeof settlementRows[number]>();
  for (const s of settlementRows || []) settlementMap.set(String(s.schedule_id), s);

  const out = schedules
    .map((sch) => {
      const st = settlementMap.get(String(sch.id));
      return {
        scheduleId: sch.id,
        date: sch.date,
        startTime: sch.start_time,
        endTime: sch.end_time,
        scheduleTitle: sch.title || "",
        scheduleNote: sch.note || "",
        memberName: sch.member_name || "",
        scheduleStatus: sch.status || "",
        settlement: st
          ? {
              id: st.id,
              status: st.status,
              quote: st.quote || 0,
              deposit: st.deposit || 0,
              balance: st.balance || 0,
              customerName: st.customer_name || "",
              customerPhone: st.customer_phone || "",
            }
          : {
              id: "",
              status: "none",
              quote: 0,
              deposit: 0,
              balance: 0,
              customerName: "",
              customerPhone: "",
            },
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return Response.json({
    range: { from, to },
    count: out.length,
    schedules: out,
  });
}
