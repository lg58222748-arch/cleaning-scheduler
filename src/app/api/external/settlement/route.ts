import { NextRequest } from "next/server";

export const maxDuration = 30;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function checkAuth(req: NextRequest): Response | null {
  const expectedKey = process.env.EXTERNAL_API_KEY;
  if (!expectedKey) {
    return Response.json({ error: "server_misconfigured" }, { status: 500 });
  }
  if (req.headers.get("x-api-key") !== expectedKey) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

async function supaFetch(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
}

// DELETE /api/external/settlement?scheduleId=XXX
// 해당 schedule 의 settlement 행을 영구 삭제 (관리자 조작)
export async function DELETE(req: NextRequest) {
  const auth = checkAuth(req);
  if (auth) return auth;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return Response.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const scheduleId = searchParams.get("scheduleId");
  if (!scheduleId) {
    return Response.json({ error: "scheduleId_required" }, { status: 400 });
  }

  const res = await supaFetch(
    `settlements?schedule_id=eq.${encodeURIComponent(scheduleId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const text = await res.text().then((t) => t.slice(0, 200));
    return Response.json({ error: "db_error", message: text }, { status: 502 });
  }
  return Response.json({ ok: true });
}

// PATCH /api/external/settlement?scheduleId=XXX
// body: { cashReceipt?: boolean, accountantNote?: string }
// 세무사/관리자 간 노트 + 현금영수증 처리 완료 표시
export async function PATCH(req: NextRequest) {
  const auth = checkAuth(req);
  if (auth) return auth;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return Response.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const scheduleId = searchParams.get("scheduleId");
  if (!scheduleId) {
    return Response.json({ error: "scheduleId_required" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.cashReceipt === "boolean") update.cash_receipt = body.cashReceipt;
  if (typeof body.accountantNote === "string") update.accountant_note = body.accountantNote;

  if (Object.keys(update).length === 0) {
    return Response.json({ error: "no_fields_to_update" }, { status: 400 });
  }

  // 행이 없으면 upsert — scheduleId 기반 insert-or-update
  const existRes = await supaFetch(
    `settlements?schedule_id=eq.${encodeURIComponent(scheduleId)}&select=id&limit=1`,
    { method: "GET" }
  );
  const existing = existRes.ok ? await existRes.json() : [];
  if (Array.isArray(existing) && existing.length > 0) {
    const res = await supaFetch(
      `settlements?schedule_id=eq.${encodeURIComponent(scheduleId)}`,
      { method: "PATCH", body: JSON.stringify(update) }
    );
    if (!res.ok) {
      const text = await res.text().then((t) => t.slice(0, 200));
      return Response.json({ error: "db_error", message: text }, { status: 502 });
    }
  } else {
    // 신규 생성 (세무사가 노트만 남기는 케이스)
    const res = await supaFetch(`settlements`, {
      method: "POST",
      body: JSON.stringify({ schedule_id: scheduleId, status: "draft", ...update }),
    });
    if (!res.ok) {
      const text = await res.text().then((t) => t.slice(0, 200));
      return Response.json({ error: "db_error", message: text }, { status: 502 });
    }
  }
  return Response.json({ ok: true });
}
