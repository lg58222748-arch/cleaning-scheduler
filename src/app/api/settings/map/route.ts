import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// 활동범위 지도 설정 GET/PUT
// 모든 사용자: GET 가능 (지도 표시용)
// 대표/admin: PUT 가능 (설정 변경)

export async function GET() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "map")
    .maybeSingle();
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  // 행이 없으면 빈 기본값 반환
  const value = data?.value || { radii: {}, positions: {}, hiddenPins: [] };
  return Response.json(value);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  // userId 가 ceo/admin 인지 확인 — 권한자만 저장 가능
  const userId = body.userId ? String(body.userId) : "";
  if (!userId) {
    return Response.json({ error: "userId required" }, { status: 401 });
  }
  const { data: user } = await supabase
    .from("users")
    .select("id, role, name, status")
    .eq("id", userId)
    .maybeSingle();
  if (!user || user.status !== "approved" || !["ceo", "admin"].includes(String(user.role))) {
    return Response.json({ error: "권한 없음 — 대표/관리자만 변경 가능" }, { status: 403 });
  }

  const value = body.value;
  if (typeof value !== "object" || value === null) {
    return Response.json({ error: "value required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "map", value, updated_at: new Date().toISOString(), updated_by: user.name || userId }, { onConflict: "key" });
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ success: true });
}
