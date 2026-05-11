import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// 업로드: FormData(file) 받아서 Supabase Storage 의 business-licenses bucket 에 저장.
// 회원가입 단계에서 사용 — 인증 안 된 상태라 anon 호출 받지만, 서버는 service_role 키로 업로드.
// 보안: 파일 크기 / 타입 검증 후 업로드.
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "file_required" }, { status: 400 });
    }
    // 5MB 제한 (bucket 자체에도 같은 제한 걸려있음 — 이중 안전장치)
    if (file.size > 5 * 1024 * 1024) {
      return Response.json({ error: "size_exceeded", message: "파일은 5MB 이하만 가능합니다" }, { status: 400 });
    }
    const allowed = ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp", "application/pdf"];
    if (file.type && !allowed.includes(file.type)) {
      return Response.json({ error: "invalid_type", message: "이미지(jpg/png/heic/webp) 또는 PDF 만 가능합니다" }, { status: 400 });
    }

    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    // 충돌 방지 — timestamp + 랜덤 6자리
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { data, error } = await supabase.storage
      .from("business-licenses")
      .upload(filename, arrayBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      console.error("[upload/business-license] 실패:", error);
      return Response.json({ error: "upload_failed", message: error.message }, { status: 500 });
    }
    return Response.json({ path: data.path });
  } catch (e) {
    console.error("[upload/business-license] 예외:", e);
    return Response.json({ error: "unknown" }, { status: 500 });
  }
}
