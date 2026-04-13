import { NextRequest } from "next/server";
import { getSettlement, createOrUpdateSettlement } from "@/lib/store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scheduleId = searchParams.get("scheduleId");
  if (!scheduleId) return Response.json({ error: "scheduleId required" }, { status: 400 });
  const settlement = getSettlement(scheduleId);
  return Response.json(settlement);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.scheduleId) return Response.json({ error: "scheduleId required" }, { status: 400 });

  const settlement = createOrUpdateSettlement(body.scheduleId, {
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
