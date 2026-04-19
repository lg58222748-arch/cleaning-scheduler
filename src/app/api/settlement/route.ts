import { NextRequest } from "next/server";
import { getSettlement, createOrUpdateSettlement } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scheduleId = searchParams.get("scheduleId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // 범위 조회: 해당 기간 일정에 딸린 settlement 들을 한 번에 반환
  if (from && to) {
    const { data: schedRows, error: schErr } = await supabase
      .from("schedules")
      .select("id")
      .gte("date", from)
      .lte("date", to);
    if (schErr) return Response.json({ error: schErr.message }, { status: 500 });
    const ids = (schedRows || []).map((r) => r.id);
    if (ids.length === 0) return Response.json([]);
    const { data, error } = await supabase
      .from("settlements")
      .select("id, schedule_id, deposit, customer_name, customer_phone, status")
      .in("schedule_id", ids);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    const out = (data || []).map((s) => ({
      scheduleId: s.schedule_id,
      deposit: s.deposit ?? 0,
      customerName: s.customer_name || "",
      customerPhone: s.customer_phone || "",
      status: s.status,
    }));
    return Response.json(out);
  }

  if (!scheduleId) return Response.json({ error: "scheduleId or from/to required" }, { status: 400 });
  const settlement = await getSettlement(scheduleId);
  return Response.json(settlement);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.scheduleId) return Response.json({ error: "scheduleId required" }, { status: 400 });

  const settlement = await createOrUpdateSettlement(body.scheduleId, {
    quote: body.quote,
    deposit: body.deposit,
    extraCharge: body.extraCharge,
    paymentMethod: body.paymentMethod,
    cashReceipt: body.cashReceipt,
    bankInfo: body.bankInfo,
    customerName: body.customerName,
    customerPhone: body.customerPhone,
    note: body.note,
    status: body.status,
  });
  return Response.json(settlement);
}
