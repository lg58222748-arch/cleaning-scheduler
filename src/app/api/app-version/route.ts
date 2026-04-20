// GitHub Releases 의 최신 릴리스에서 APK 버전과 다운로드 URL 을 조회.
// 5분 캐시 — Vercel 서버 한곳에서만 GitHub 에 요청해 rate limit 회피.
// 새 버전 배포 = GitHub Releases 에 새 release + APK 업로드 → 자동 반영됨.

const GITHUB_REPO = "lg58222748-arch/cleaning-scheduler";
const CACHE_MS = 5 * 60 * 1000;

let cache: { data: { latest: string | null; apkUrl: string | null; notes?: string }; expires: number } | null = null;

export async function GET() {
  if (cache && cache.expires > Date.now()) {
    return Response.json(cache.data, { headers: { "Cache-Control": "public, max-age=60" } });
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      // 릴리스 하나도 없거나 API 실패 — 에러는 내지 말고 null 리턴
      const empty = { latest: null, apkUrl: null };
      cache = { data: empty, expires: Date.now() + 60 * 1000 };
      return Response.json(empty);
    }
    const release = await res.json();
    // tag_name 예: "v1.3" → "1.3" (버전 비교하기 쉽게 접두사 v 제거)
    const tag = String(release.tag_name || "");
    const latest = tag.replace(/^v/i, "") || null;
    // APK 파일 찾기 (.apk 로 끝나는 첫 asset)
    const assets: Array<{ name: string; browser_download_url: string }> = release.assets || [];
    const apkAsset = assets.find((a) => a.name.toLowerCase().endsWith(".apk"));
    const apkUrl = apkAsset?.browser_download_url || null;
    const data = {
      latest,
      apkUrl,
      notes: release.body || "",
    };
    cache = { data, expires: Date.now() + CACHE_MS };
    return Response.json(data, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    const empty = { latest: null, apkUrl: null };
    cache = { data: empty, expires: Date.now() + 60 * 1000 };
    return Response.json(empty);
  }
}
