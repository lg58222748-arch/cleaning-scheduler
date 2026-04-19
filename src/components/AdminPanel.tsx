"use client";

import { useState, useEffect } from "react";
import { Schedule } from "@/types";
import { fetchDeletedSchedules, restoreScheduleApi, emptyTrashApi, deleteAllSchedules, softDeleteSchedule } from "@/lib/api";
import { showConfirm } from "@/lib/dialog";

interface AdminPanelProps {
  onClose: () => void;
  onRefresh?: () => void;
}

export default function AdminPanel({ onClose, onRefresh }: AdminPanelProps) {
  const [tab, setTab] = useState<"settings" | "trash">("settings");
  const [deletedSchedules, setDeletedSchedules] = useState<Schedule[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("notificationsEnabled") !== "false";
  });
  const [pushRegistering, setPushRegistering] = useState(false);
  const [pushRegisterMsg, setPushRegisterMsg] = useState<string>("");

  useEffect(() => {
    if (tab === "trash") loadTrash();
  }, [tab]);

  async function loadTrash() {
    setLoadingTrash(true);
    const data = await fetchDeletedSchedules();
    setDeletedSchedules(data);
    setLoadingTrash(false);
  }

  async function toggleNotifications() {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    localStorage.setItem("notificationsEnabled", String(next));

    // 토글은 SW 플래그만 제어. DB 구독은 그대로 유지 → 다른 사용자 영향 없음.
    // (이전: DB 삭제/재구독 하다가 subscribe dedupe 로 타 유저 구독까지 지워지는 버그 발생)
    try {
      if (!("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.ready;
      reg.active?.postMessage({ type: "SET_NOTIFICATIONS_ENABLED", enabled: next });
    } catch (e) { console.error("[Push] toggle failed:", e); }
  }

  async function registerPushAgain() {
    if (pushRegistering) return;
    setPushRegistering(true);
    setPushRegisterMsg("");
    const saved = localStorage.getItem("currentUser");
    const user = saved ? JSON.parse(saved) : null;
    if (!user) { setPushRegisterMsg("로그인 후 다시 시도하세요"); setPushRegistering(false); return; }

    // 1) Capacitor 네이티브 (APK) → FCM
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const status = await PushNotifications.checkPermissions();
        let receive = status.receive;
        if (receive === "prompt" || receive === "prompt-with-rationale") {
          const res = await PushNotifications.requestPermissions();
          receive = res.receive;
        }
        if (receive !== "granted") {
          setPushRegisterMsg("알림 권한이 거부됨. 설정 → 앱 → 새집느낌 파트너 → 알림 허용 후 재시도");
          setPushRegistering(false);
          return;
        }
        await PushNotifications.removeAllListeners();
        const donePromise = new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => resolve(false), 10000);
          PushNotifications.addListener("registration", async (token) => {
            clearTimeout(timer);
            try {
              await fetch("/api/push", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "subscribe-fcm", token: token.value, userId: user.id, userName: user.name }),
              });
              resolve(true);
            } catch { resolve(false); }
          });
          PushNotifications.addListener("registrationError", () => { clearTimeout(timer); resolve(false); });
        });
        await PushNotifications.register();
        const ok = await donePromise;
        setPushRegisterMsg(ok ? "✅ FCM 등록 완료! 알림 받을 수 있습니다" : "❌ FCM 등록 실패. 폰 재시작 후 다시 시도");
        setPushRegistering(false);
        return;
      }
    } catch { /* Capacitor 없음 → 웹으로 */ }

    // 2) 웹/PWA → Web Push
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPushRegisterMsg("이 브라우저는 푸시 알림을 지원하지 않습니다");
        setPushRegistering(false);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushRegisterMsg("알림 권한이 거부됨. 브라우저 주소창 옆 🔒 → 알림 허용");
        setPushRegistering(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = "BIFAj9bQTWPRvMdMvDc5RTF4Qyof08lZR2SkI3vHwmhmUZwWbVJt7_SKEczBy_9ul88kmvfmqzr14-TecTwRBwc";
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey });
      }
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subscribe", subscription: sub.toJSON(), userId: user.id, userName: user.name }),
      });
      setPushRegisterMsg("✅ 웹 푸시 등록 완료! 알림 받을 수 있습니다");
    } catch (e) {
      setPushRegisterMsg("❌ 등록 실패: " + (e instanceof Error ? e.message : "알 수 없는 오류"));
    }
    setPushRegistering(false);
  }

  async function handleMoveAllToTrash() {
    if (!(await showConfirm("모든 일정을 휴지통으로 이동하시겠습니까?\n(영구 삭제가 아닙니다. 휴지통에서 복원 가능합니다)"))) return;
    await deleteAllSchedules();
    onRefresh?.();
  }

  async function handleRestore(id: string) {
    await restoreScheduleApi(id);
    setDeletedSchedules(prev => prev.filter(s => s.id !== id));
    onRefresh?.();
  }

  async function handlePermanentDelete(id: string) {
    if (!(await showConfirm("이 일정을 영구 삭제하시겠습니까?\n복원할 수 없습니다."))) return;
    const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDeletedSchedules(prev => prev.filter(s => s.id !== id));
    }
  }

  async function handleEmptyTrash() {
    if (!(await showConfirm("휴지통을 비우시겠습니까?\n모든 삭제된 일정이 영구 삭제됩니다."))) return;
    await emptyTrashApi();
    setDeletedSchedules([]);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[85vh] flex flex-col" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-800">설정</h3>
          <button onClick={onClose} className="p-1 active:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab("settings")}
            className={`flex-1 py-2.5 text-sm font-medium text-center ${tab === "settings" ? "text-blue-500 border-b-2 border-blue-500" : "text-gray-400"}`}
          >
            설정
          </button>
          <button
            onClick={() => setTab("trash")}
            className={`flex-1 py-2.5 text-sm font-medium text-center ${tab === "trash" ? "text-blue-500 border-b-2 border-blue-500" : "text-gray-400"}`}
          >
            휴지통 {deletedSchedules.length > 0 ? `(${deletedSchedules.length})` : ""}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === "settings" && (
            <>
              {/* 알림 설정 */}
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-800">알림</div>
                    <div className="text-xs text-gray-400 mt-0.5">배정/반납 알림을 받습니다</div>
                  </div>
                  <button
                    onClick={toggleNotifications}
                    className={`relative w-12 h-7 rounded-full transition-colors ${notificationsEnabled ? "bg-blue-500" : "bg-gray-300"}`}
                  >
                    <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${notificationsEnabled ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
              </div>

              {/* 푸시 재등록 (알림 안 올 때 눌러보세요) */}
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">푸시 알림 재등록</div>
                    <div className="text-xs text-gray-400 mt-0.5">알림이 안 오면 눌러서 다시 등록</div>
                  </div>
                  <button
                    onClick={registerPushAgain}
                    disabled={pushRegistering}
                    className="shrink-0 px-3 py-2 bg-orange-500 text-white rounded-lg text-xs font-bold active:bg-orange-600 disabled:bg-gray-300"
                  >
                    {pushRegistering ? "등록 중..." : "재등록"}
                  </button>
                </div>
                {pushRegisterMsg && (
                  <div className="mt-3 text-xs bg-gray-50 text-gray-700 px-3 py-2 rounded-lg whitespace-pre-wrap">
                    {pushRegisterMsg}
                  </div>
                )}
              </div>

              {/* 휴지통 바로가기 */}
              <button
                onClick={() => setTab("trash")}
                className="w-full border border-gray-200 rounded-xl p-4 flex items-center justify-between active:bg-gray-50"
              >
                <div>
                  <div className="text-sm font-medium text-gray-800 text-left">휴지통</div>
                  <div className="text-xs text-gray-400 mt-0.5">삭제된 일정 관리</div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {tab === "trash" && (
            <>
              {loadingTrash ? (
                <div className="py-8 text-center text-gray-400 text-sm">로딩 중...</div>
              ) : deletedSchedules.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">휴지통이 비어있습니다</div>
              ) : (
                <>
                  {/* 휴지통 비우기 */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleEmptyTrash}
                      className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium active:bg-red-100"
                    >
                      휴지통 비우기
                    </button>
                  </div>

                  <div className="space-y-2">
                    {deletedSchedules.map((s) => (
                      <div key={s.id} className="border border-gray-200 rounded-xl p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{s.title}</div>
                            <div className="text-xs text-gray-400">{s.date} · {s.memberName || "미배정"}</div>
                          </div>
                          <button
                            onClick={() => handleRestore(s.id)}
                            className="px-3 py-1.5 bg-blue-50 text-blue-500 rounded-lg text-xs font-medium active:bg-blue-100 shrink-0"
                          >
                            복원
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(s.id)}
                            className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium active:bg-red-100 shrink-0"
                          >
                            영구삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
