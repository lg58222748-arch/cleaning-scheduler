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

export async function sendPushToAll(title: string, message: string, tag?: string) {
  init();
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) { console.log("[SendPush] VAPID 키 없음"); return; }

  const { data: subs } = await supabase.from("push_subscriptions").select("*");
  console.log("[SendPush] 구독자:", subs?.length || 0);
  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({ title, body: message, tag: tag || "notification", url: "/" });

  for (const sub of subs) {
    if (sub.endpoint?.startsWith("fcm:")) continue;
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

// 메시지에 언급된 사용자 이름에게만 푸시 전송 (타지점 사용자에게 안 감)
export async function sendPushToMentioned(title: string, message: string, tag?: string) {
  init();
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  // 전체 승인된 사용자 이름 목록
  const { data: users } = await supabase.from("users").select("id, name, role").eq("status", "approved");
  if (!users || users.length === 0) return;

  const combined = title + " " + message;
  // 메시지에 이름이 포함된 사용자만 필터
  const targetIds = new Set<string>();
  for (const u of users) {
    const name = String(u.name || "");
    if (!name) continue;
    if (combined.includes(name)) targetIds.add(String(u.id));
  }
  if (targetIds.size === 0) return;

  const { data: subs } = await supabase.from("push_subscriptions").select("*").in("user_id", Array.from(targetIds));
  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({ title, body: message, tag: tag || "notification", url: "/" });

  for (const sub of subs) {
    if (sub.endpoint?.startsWith("fcm:")) continue;
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

// 특정 역할(role) 의 사용자들에게만 푸시 전송
export async function sendPushToRoles(roles: string[], title: string, message: string, tag?: string) {
  init();
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  if (roles.length === 0) return;

  // 역할에 해당하는 사용자 ID 조회
  const { data: users } = await supabase.from("users").select("id").in("role", roles).eq("status", "approved");
  const userIds = (users || []).map(u => String(u.id));
  if (userIds.length === 0) return;

  const { data: subs } = await supabase.from("push_subscriptions").select("*").in("user_id", userIds);
  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({ title, body: message, tag: tag || "notification", url: "/" });

  for (const sub of subs) {
    if (sub.endpoint?.startsWith("fcm:")) continue;
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
