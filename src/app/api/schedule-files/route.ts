import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// 일정 첨부파일 (견적서 등) — schedule-files 버킷(비공개).
// 파일 키: {scheduleId}/{timestamp}-{encodeURIComponent(원본이름)}
// 별도 테이블 없이 storage.list() 로 일정별 목록 조회, 서명 URL(1시간)로 열람.

const BUCKET = "schedule-files";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED = ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp", "application/pdf"];

// 목록 조회: GET /api/schedule-files?scheduleId=xxx
export async function GET(req: NextRequest) {
  const scheduleId = new URL(req.url).searchParams.get("scheduleId");
  if (!scheduleId) return Response.json({ error: "scheduleId_required" }, { status: 400 });

  const { data: files, error } = await supabase.storage.from(BUCKET).list(scheduleId, {
    limit: 50,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const items = await Promise.all((files || []).filter(f => f.name).map(async (f) => {
    const path = `${scheduleId}/${f.name}`;
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    // 키에서 원본 파일명 복원: "{ts}-{base64url명}.{ext}" → decode
    // (Storage 키에 %·한글 불가라 base64url 로 저장 — 알파벳/숫자/-/_ 만 사용됨)
    const dash = f.name.indexOf("-");
    let displayName = f.name;
    if (dash > 0) {
      const rest = f.name.slice(dash + 1);
      const dot = rest.lastIndexOf(".");
      const b64 = dot > 0 ? rest.slice(0, dot) : rest;
      try {
        const decoded = Buffer.from(b64, "base64url").toString("utf8");
        if (decoded) displayName = decoded;
      } catch { displayName = rest; }
    }
    return {
      path,
      displayName,
      size: (f.metadata as { size?: number } | null)?.size || 0,
      createdAt: f.created_at || "",
      url: signed?.signedUrl || "",
    };
  }));
  return Response.json({ files: items });
}

// 업로드: POST FormData(file, scheduleId) / 삭제: POST JSON {action:"delete", path}
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  // 삭제 / 서명 업로드 URL 발급
  if (contentType.includes("application/json")) {
    const body = await req.json();

    // 서명 업로드 URL — 클라이언트가 Storage 에 직접 PUT (Vercel 4.5MB 요청 제한 우회)
    if (body.action === "sign-upload") {
      const scheduleId = String(body.scheduleId || "");
      const fileName = String(body.fileName || "file.bin");
      const fileType = String(body.fileType || "");
      const size = Number(body.size) || 0;
      if (!scheduleId || scheduleId.includes("/") || scheduleId.includes("..")) {
        return Response.json({ error: "scheduleId_required" }, { status: 400 });
      }
      if (size > MAX_SIZE) {
        return Response.json({ error: "size_exceeded", message: "파일은 10MB 이하만 가능합니다" }, { status: 400 });
      }
      if (fileType && !ALLOWED.includes(fileType)) {
        return Response.json({ error: "invalid_type", message: "이미지(jpg/png/heic/webp) 또는 PDF 만 가능합니다" }, { status: 400 });
      }
      const ext = (fileName.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
      const b64name = Buffer.from(fileName, "utf8").toString("base64url").slice(0, 160);
      const path = `${scheduleId}/${Date.now()}-${b64name}.${ext}`;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) {
        return Response.json({ error: "sign_failed", message: error?.message || "" }, { status: 500 });
      }
      return Response.json({ path, signedUrl: data.signedUrl });
    }

    if (body.action === "delete" && body.path) {
      const path = String(body.path);
      // 경로 조작 방지 — {uuid}/{파일명} 형태만 허용
      if (path.includes("..") || !/^[\w-]+\/[^/]+$/.test(path)) {
        return Response.json({ error: "invalid_path" }, { status: 400 });
      }
      const { error } = await supabase.storage.from(BUCKET).remove([path]);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }
    return Response.json({ error: "invalid_action" }, { status: 400 });
  }

  // 업로드
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const scheduleId = String(formData.get("scheduleId") || "");
    if (!(file instanceof File)) return Response.json({ error: "file_required" }, { status: 400 });
    if (!scheduleId || scheduleId.includes("/") || scheduleId.includes("..")) {
      return Response.json({ error: "scheduleId_required" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return Response.json({ error: "size_exceeded", message: "파일은 10MB 이하만 가능합니다" }, { status: 400 });
    }
    if (file.type && !ALLOWED.includes(file.type)) {
      return Response.json({ error: "invalid_type", message: "이미지(jpg/png/heic/webp) 또는 PDF 만 가능합니다" }, { status: 400 });
    }

    // 원본 이름 보존 — Storage 키는 %·한글 불가라 base64url 인코딩 (목록에서 복원)
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
    const b64name = Buffer.from(file.name, "utf8").toString("base64url").slice(0, 160);
    const path = `${scheduleId}/${Date.now()}-${b64name}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) return Response.json({ error: "upload_failed", message: error.message }, { status: 500 });

    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    return Response.json({
      path,
      displayName: file.name,
      size: file.size,
      url: signed?.signedUrl || "",
    }, { status: 201 });
  } catch (e) {
    console.error("[schedule-files] 업로드 예외:", e);
    return Response.json({ error: "unknown" }, { status: 500 });
  }
}
