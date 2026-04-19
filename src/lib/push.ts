import webpush from "web-push";
import { supabase } from "./supabase";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";

let initialized = false;
function init() {
  if (initialized || !VAPID_PUBLIC || !VAPID_PRIVATE) return;
  webpush.setVapidDetails("mailto:lg58222748@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE);
  initialized = true;
}

// ===== FCM HTTP v1 (Capacitor APK 푸시) =====
let cachedFcmToken: { token: string; expiresAt: number } | null = null;
let fcmCreds: { client_email: string; private_key: string; project_id: string } | null = null;

function getFcmCreds() {
  if (fcmCreds) return fcmCreds;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) return null;
    fcmCreds = parsed;
    return fcmCreds;
  } catch {
    return null;
  }
}

async function getFcmAccessToken(): Promise<string | null> {
  const creds = getFcmCreds();
  if (!creds) return null;
  // 캐시된 토큰이 아직 유효하면 재사용 (50분 캐시)
  if (cachedFcmToken && cachedFcmToken.expiresAt > Date.now()) {
    return cachedFcmToken.token;
  }
  try {
    const { JWT } = await import("google-auth-library");
    const client = new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });
    const token = await client.authorize();
    if (!token.access_token) return null;
    cachedFcmToken = { token: token.access_token, expiresAt: Date.now() + 50 * 60 * 1000 };
    return token.access_token;
  } catch (e) {
    console.error("[FCM] access token 실패:", e);
    return null;
  }
}

async function sendFcmNotification(fcmToken: string, title: string, body: string, tag?: string): Promise<boolean> {
  const creds = getFcmCreds();
  if (!creds) return false;
  const accessToken = await getFcmAccessToken();
  if (!accessToken) return false;

  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${creds.project_id}/messages:send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          android: {
            priority: "HIGH",
            notification: {
              tag: tag || "notification",
              click_action: "FLUTTER_NOTIFICATION_CLICK",
            },
          },
          data: { url: "/", tag: tag || "notification" },
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[FCM] send failed:", res.status, err);
      // 404 = token 만료/무효 → DB 에서 삭제
      if (res.status === 404) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", `fcm:${fcmToken}`);
      }
      return false;
    }
    return true;
  } catch (e) {
    console.error("[FCM] exception:", e);
    return false;
  }
}

// 통합 발송: 웹푸시 엔드포인트 + FCM 엔드포인트 모두 처리
// enabled=false 인 구독은 제외 (사용자가 알림 토글 OFF 한 경우)
async function sendToSubs(subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string; enabled?: boolean }>, title: string, message: string, tag?: string) {
  const payload = JSON.stringify({ title, body: message, tag: tag || "notification", url: "/" });
  for (const sub of subs) {
    if (sub.enabled === false) continue;
    if (sub.endpoint?.startsWith("fcm:")) {
      const fcmToken = sub.endpoint.slice(4);
      await sendFcmNotification(fcmToken, title, message, tag);
    } else {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err: unknown) {
        if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
  }
}

export async function sendPushToAll(title: string, message: string, tag?: string) {
  init();
  const { data: subs } = await supabase.from("push_subscriptions").select("*");
  console.log("[SendPush] 구독자:", subs?.length || 0);
  if (!subs || subs.length === 0) return;
  await sendToSubs(subs, title, message, tag);
}

// 유저 ID 기반 발송 - addNotification 에서 role/name 타겟을 병합 후 호출
export async function sendPushToUsers(userIds: string[], title: string, message: string, tag?: string) {
  init();
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) { console.log("[Push] userIds 없음"); return; }
  const { data: subs } = await supabase.from("push_subscriptions").select("*").in("user_id", unique);
  const subUserIds = new Set((subs || []).map(s => String(s.user_id)));
  const missing = unique.filter(u => !subUserIds.has(u));
  console.log(`[Push] tag=${tag} 대상 user=${unique.length}명 구독=${subs?.length || 0}건`);
  if (missing.length > 0) {
    const { data: miss } = await supabase.from("users").select("id, name, role").in("id", missing);
    console.warn(`[Push] 구독 없는 유저:`, (miss || []).map(u => `${u.name}(${u.role})`));
  }
  if (!subs || subs.length === 0) return;
  const endpoints = subs.map(s => (s.endpoint?.startsWith("fcm:") ? "FCM" : "WEB") + "/" + String(s.user_id).slice(0, 8));
  console.log(`[Push] 발송 시작:`, endpoints);
  await sendToSubs(subs, title, message, tag);
}

// 특정 사용자 이름들에게만 푸시 전송 (정확한 이름 매칭)
export async function sendPushToNames(names: string[], title: string, message: string, tag?: string) {
  init();
  const clean = names.filter(n => n && n.trim() && n !== "미배정").map(n => n.trim());
  if (clean.length === 0) return;

  const { data: users } = await supabase.from("users").select("id, name").eq("status", "approved").in("name", clean);
  if (!users || users.length === 0) return;
  const targetIds = new Set(users.map(u => String(u.id)));

  const { data: subs } = await supabase.from("push_subscriptions").select("*").in("user_id", Array.from(targetIds));
  if (!subs || subs.length === 0) return;
  await sendToSubs(subs, title, message, tag);
}

// [Deprecated: 메시지 텍스트 내 이름 매칭 - 정확하지 않음]
export async function sendPushToMentioned(title: string, message: string, tag?: string) {
  init();
  const { data: users } = await supabase.from("users").select("id, name, role").eq("status", "approved");
  if (!users || users.length === 0) return;
  const combined = title + " " + message;
  const targetIds = new Set<string>();
  for (const u of users) {
    const name = String(u.name || "");
    if (!name || name.length < 2) continue;
    if (combined.includes(name)) targetIds.add(String(u.id));
  }
  if (targetIds.size === 0) return;

  const { data: subs } = await supabase.from("push_subscriptions").select("*").in("user_id", Array.from(targetIds));
  if (!subs || subs.length === 0) return;
  await sendToSubs(subs, title, message, tag);
}

// 특정 역할(role) 의 사용자들에게만 푸시 전송
export async function sendPushToRoles(roles: string[], title: string, message: string, tag?: string) {
  init();
  if (roles.length === 0) return;

  const { data: users } = await supabase.from("users").select("id").in("role", roles).eq("status", "approved");
  const userIds = (users || []).map(u => String(u.id));
  if (userIds.length === 0) return;

  const { data: subs } = await supabase.from("push_subscriptions").select("*").in("user_id", userIds);
  if (!subs || subs.length === 0) return;
  await sendToSubs(subs, title, message, tag);
}
