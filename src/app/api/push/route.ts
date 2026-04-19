import { NextRequest } from "next/server";
import webpush from "web-push";
import { supabase } from "@/lib/supabase";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails("mailto:lg58222748@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE);
}

// 구독 등록
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === "subscribe") {
    const { subscription, userId, userName } = body;
    if (!subscription?.endpoint) return Response.json({ error: "Invalid subscription" }, { status: 400 });

    // 같은 사용자의 다른(stale) 구독 제거 - 중복 푸시 방지
    if (userId) {
      await supabase.from("push_subscriptions").delete().eq("user_id", userId).neq("endpoint", subscription.endpoint);
    }

    // 현재 엔드포인트는 upsert
    const { data: existing } = await supabase.from("push_subscriptions").select("id").eq("endpoint", subscription.endpoint).single();
    if (existing) {
      await supabase.from("push_subscriptions").update({
        user_id: userId, user_name: userName,
        p256dh: subscription.keys.p256dh, auth: subscription.keys.auth,
      }).eq("id", existing.id);
    } else {
      await supabase.from("push_subscriptions").insert({
        user_id: userId, user_name: userName,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh, auth: subscription.keys.auth,
      });
    }
    return Response.json({ success: true });
  }

  // FCM 토큰 저장 (Capacitor APK)
  if (body.action === "subscribe-fcm") {
    const { token, userId, userName } = body;
    if (!token) return Response.json({ error: "Invalid token" }, { status: 400 });
    const endpoint = `fcm:${token}`;

    // 같은 사용자의 다른 구독 제거
    if (userId) {
      await supabase.from("push_subscriptions").delete().eq("user_id", userId).neq("endpoint", endpoint);
    }

    const { data: existing } = await supabase.from("push_subscriptions").select("id").eq("endpoint", endpoint).single();
    if (existing) {
      await supabase.from("push_subscriptions").update({ user_id: userId, user_name: userName }).eq("id", existing.id);
    } else {
      await supabase.from("push_subscriptions").insert({
        user_id: userId, user_name: userName, endpoint, p256dh: "fcm", auth: "fcm",
      });
    }
    return Response.json({ success: true });
  }

  // 푸시 전송
  if (body.action === "send") {
    const { title, message, tag } = body;
    const { data: subs } = await supabase.from("push_subscriptions").select("*");
    if (!subs || subs.length === 0) return Response.json({ sent: 0 });

    let sent = 0;
    let failed = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body: message, tag: tag || "notification", url: "/" })
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        // 410 Gone = 구독 만료 → 삭제
        if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
    return Response.json({ sent, failed });
  }

  // 구독 해제 - DB 에서 삭제하여 서버가 더이상 푸시 안 보내도록
  if (body.action === "unsubscribe") {
    const { endpoint, userId } = body;
    if (endpoint) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    } else if (userId) {
      await supabase.from("push_subscriptions").delete().eq("user_id", userId);
    }
    return Response.json({ success: true });
  }

  // 특정 사용자 구독 전체 삭제 (관리자가 다른 기기에서 실수로 등록한 구독 정리용)
  if (body.action === "clearUser") {
    const { userName } = body;
    if (!userName) return Response.json({ error: "userName required" }, { status: 400 });
    const { data: users } = await supabase.from("users").select("id").eq("name", userName);
    const ids = (users || []).map(u => String(u.id));
    if (ids.length === 0) return Response.json({ deleted: 0, note: "user not found" });
    const { data: before } = await supabase.from("push_subscriptions").select("id").in("user_id", ids);
    const count = before?.length || 0;
    if (count > 0) {
      await supabase.from("push_subscriptions").delete().in("user_id", ids);
    }
    return Response.json({ deleted: count, userIds: ids });
  }

  // 기존 중복 구독 정리 - 사용자별 최신 엔드포인트 1개만 남김
  if (body.action === "dedupe") {
    const { data: subs } = await supabase.from("push_subscriptions").select("*").order("id", { ascending: false });
    if (!subs) return Response.json({ kept: 0, deleted: 0 });
    const seen = new Set<string>();
    const toDelete: string[] = [];
    for (const s of subs) {
      const key = String(s.user_id || s.endpoint);
      if (seen.has(key)) toDelete.push(s.id);
      else seen.add(key);
    }
    if (toDelete.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", toDelete);
    }
    return Response.json({ kept: subs.length - toDelete.length, deleted: toDelete.length });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
