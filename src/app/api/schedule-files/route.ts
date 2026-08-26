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
    // 키에서 원본 파일명 복원: "{ts}-{encoded명}" → decode
    const dash = f.name.indexOf("-");
    let displayName = f.name;
    if (dash > 0) {
      try { displayName = decodeURIComponent(f.name.slice(dash + 1)); } catch { displayName = f.name.slice(dash + 1); }
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

  // 삭제
  if (contentType.includes("application/json")) {
    const body = await req.json();
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

    // 원본 이름 보존(인코딩) — 목록에서 복원해 표시
    const safeName = encodeURIComponent(file.name).slice(0, 180);
    const path = `${scheduleId}/${Date.now()}-${safeName}`;
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
