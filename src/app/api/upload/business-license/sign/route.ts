import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// 다운로드용 signed URL 발급 — bucket 이 private 라 public URL 못 씀.
// 관리자가 사업자등록증 다운로드/조회할 때 호출.
// 호출 예: GET /api/upload/business-license/sign?path=1234567890-abc123.pdf
export async function GET(req: NextRequest) {
  const path = new URL(req.url).searchParams.get("path");
  if (!path) return Response.json({ error: "path_required" }, { status: 400 });
  // path 검증 — slash/.. 등 우회 차단 (filename 만 허용)
  if (path.includes("/") || path.includes("..")) {
    return Response.json({ error: "invalid_path" }, { status: 400 });
  }
  // 10분짜리 signed URL
  const { data, error } = await supabase.storage
    .from("business-licenses")
    .createSignedUrl(path, 60 * 10);
  if (error || !data) {
    return Response.json({ error: "sign_failed", message: error?.message || "fail" }, { status: 500 });
  }
  return Response.json({ url: data.signedUrl });
}
