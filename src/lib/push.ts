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
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  const { data: subs } = await supabase.from("push_subscriptions").select("*");
  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({ title, body: message, tag: tag || "notification", url: "/" });

  for (const sub of subs) {
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
