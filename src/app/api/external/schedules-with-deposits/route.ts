import { NextRequest } from "next/server";

export const maxDuration = 60;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 730; // 2년 — 은행 입금 ~ 일정일 사이가 길 수 있어 넓게 허용

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function supaGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`);
  }
  return res.json() as Promise<T>;
}

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

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return Response.json({ error: "server_misconfigured" }, { status: 500 });
  }

  // 공통 select
  const selectCols = "id,title,date,start_time,end_time,member_name,note,status";

  type ScheduleRow = {
    id: string; title: string; date: string; start_time: string; end_time: string;
    member_name: string; note: string; status: string;
  };

  // 1) 날짜 범위의 confirmed/pending + 미배정 전체 (날짜 필터 제외)
  let rangeRows: ScheduleRow[] = [];
  let unassignedRows: ScheduleRow[] = [];
  try {
    [rangeRows, unassignedRows] = await Promise.all([
      supaGet<ScheduleRow[]>(
        `schedules?date=gte.${from}&date=lte.${to}&status=not.in.(deleted,unassigned)&order=date&limit=20000&select=${selectCols}`
      ),
      supaGet<ScheduleRow[]>(
        `schedules?status=eq.unassigned&order=date&limit=20000&select=${selectCols}`
      ),
    ]);
  } catch (e) {
    return Response.json({ error: "db_error", message: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }

  // 중복 id 합치기 (이론상 겹칠 수 없지만 안전하게)
  const byId = new Map<string, ScheduleRow>();
  for (const s of rangeRows) byId.set(s.id, s);
  for (const s of unassignedRows) byId.set(s.id, s);
  const schedules = Array.from(byId.values());
  if (schedules.length === 0) {
    return Response.json({ range: { from, to }, count: 0, schedules: [] });
  }

  // 2) 그 일정들의 settlements + checklists — IN 절 URL 길이 제한 회피용 200개씩 청크.
  type SettlementRow = {
    id: string; schedule_id: string; status: string;
    quote: number; deposit: number; balance: number;
    extra_charge: number; subtotal: number; vat: number; total_amount: number;
    payment_method: string; cash_receipt: boolean;
    customer_name: string; customer_phone: string;
  };
  type ChecklistRow = {
    id: string; schedule_id: string;
    completed_count: number; total_count: number; submitted_at: string | null;
  };
  const ids = schedules.map((s) => s.id);
  const CHUNK = 200;
  const settlementRows: SettlementRow[] = [];
  const checklistRows: ChecklistRow[] = [];
  try {
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
    const settlementPromises = chunks.map((slice) => {
      const list = slice.map((id) => `"${id}"`).join(",");
      return supaGet<SettlementRow[]>(
        `settlements?schedule_id=in.(${list})&select=id,schedule_id,status,quote,deposit,balance,extra_charge,subtotal,vat,total_amount,payment_method,cash_receipt,customer_name,customer_phone&limit=${CHUNK}`
      );
    });
    const checklistPromises = chunks.map((slice) => {
      const list = slice.map((id) => `"${id}"`).join(",");
      return supaGet<ChecklistRow[]>(
        `checklists?schedule_id=in.(${list})&select=id,schedule_id,completed_count,total_count,submitted_at&limit=${CHUNK}`
      );
    });
    const [sResults, cResults] = await Promise.all([
      Promise.all(settlementPromises),
      Promise.all(checklistPromises),
    ]);
    for (const r of sResults) settlementRows.push(...r);
    for (const r of cResults) checklistRows.push(...r);
  } catch (e) {
    return Response.json({ error: "db_error", message: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }

  const settlementMap = new Map<string, typeof settlementRows[number]>();
  for (const s of settlementRows || []) settlementMap.set(String(s.schedule_id), s);
  const checklistMap = new Map<string, typeof checklistRows[number]>();
  for (const c of checklistRows || []) checklistMap.set(String(c.schedule_id), c);

  const out = schedules
    .map((sch) => {
      const st = settlementMap.get(String(sch.id));
      const cl = checklistMap.get(String(sch.id));
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
              extraCharge: st.extra_charge || 0,
              subtotal: st.subtotal || 0,
              vat: st.vat || 0,
              totalAmount: st.total_amount || 0,
              paymentMethod: st.payment_method || "transfer",
              cashReceipt: !!st.cash_receipt,
              customerName: st.customer_name || "",
              customerPhone: st.customer_phone || "",
            }
          : {
              id: "",
              status: "none",
              quote: 0, deposit: 0, balance: 0,
              extraCharge: 0, subtotal: 0, vat: 0, totalAmount: 0,
              paymentMethod: "transfer",
              cashReceipt: false,
              customerName: "",
              customerPhone: "",
            },
        checklist: cl
          ? {
              completedCount: cl.completed_count || 0,
              totalCount: cl.total_count || 0,
              submittedAt: cl.submitted_at,
            }
          : null,
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return Response.json({
    range: { from, to },
    count: out.length,
    schedules: out,
  });
}
