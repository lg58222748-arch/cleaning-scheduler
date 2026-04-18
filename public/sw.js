const CACHE_NAME = 'cleaning-scheduler-v6';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// 알림 ON/OFF 상태 (클라이언트에서 postMessage로 전달)
let notificationsEnabled = true;
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_NOTIFICATIONS_ENABLED') {
    notificationsEnabled = event.data.enabled;
  }
});

// 최근 표시한 푸시 - 중복 재수신 방지 (30초 윈도우)
const recentPushes = new Map();

function hashMsg(title, body) {
  return `${title}|${body}`.slice(0, 200);
}

// 푸시 알림 수신
self.addEventListener('push', (event) => {
  if (!notificationsEnabled) return;
  const data = event.data ? event.data.json() : {};
  const title = data.title || '새집느낌 파트너';
  const body = data.body || '새로운 알림이 있습니다';

  // 동일 내용 5초 이내 재수신 시 무시 → 네트워크/재시도로 인한 즉시 중복만 차단
  const key = hashMsg(title, body);
  const now = Date.now();
  const last = recentPushes.get(key) || 0;
  if (now - last < 5000) return;
  recentPushes.set(key, now);
  // 오래된 항목 정리
  for (const [k, t] of recentPushes) {
    if (now - t > 30000) recentPushes.delete(k);
  }

  const options = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-mono.png',
    data: { url: 'https://cleaning-scheduler-chi.vercel.app' },
    tag: `${data.tag || 'default'}-${now}`,
    renotify: false,
    silent: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 알림 클릭 시 앱 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = 'https://cleaning-scheduler-chi.vercel.app';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('cleaning-scheduler') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
