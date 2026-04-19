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
  // 1) 날짜 범위의 모든 schedules (status 무관 — 배정탭/달력 둘 다 포함).
  //    deleted 만 제외.
  const { data: scheduleRows, error: schErr } = await supabase
    .from("schedules")
    .select("id, title, date, start_time, end_time, member_name, note, status")
    .gte("date", from)
    .lte("date", to)
    .neq("status", "deleted");
  if (schErr) {
    return Response.json({ error: "db_error", message: schErr.message }, { status: 502 });
  }
  const schedules = scheduleRows || [];
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
