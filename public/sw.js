// 버전 올리면 구 캐시 전부 자동 정리. 롤백 필요 시 v7 → v6 로 내리면 됨.
const CACHE_VERSION = 'v7';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const SHELL_URLS = ['/', '/manifest.json', '/logo.jpg'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // 앱셸 프리캐시 (실패해도 install 은 성공)
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_URLS).catch(() => {})
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== STATIC_CACHE && name !== SHELL_CACHE)
          .map((name) => caches.delete(name))
      )
    ).then(() => clients.claim())
  );
});

// Fetch 전략:
//  - /api/* : network-only (데이터는 항상 최신)
//  - /_next/static/* : cache-first (콘텐츠 해시라 영구 캐시 안전)
//  - GET HTML/manifest : stale-while-revalidate (즉시 표시 + 백그라운드 업데이트)
//  - 그 외 GET : network-first, 실패 시 캐시
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 다른 오리진은 터치 안 함
  if (url.origin !== self.location.origin) return;

  // /api/* — 데이터 요청은 SW 우회
  if (url.pathname.startsWith('/api/')) return;

  // /_next/static/* — 영구 자산
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // 앱셸
  if (url.pathname === '/' || url.pathname === '/manifest.json') {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
    return;
  }

  // 그 외 GET 은 network-first
  event.respondWith(
    fetch(req).catch(() => caches.match(req).then((r) => r || Response.error()))
  );
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then((res) => {
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  // 캐시 있으면 즉시 리턴, 없으면 네트워크 대기
  return cached || (await networkPromise) || Response.error();
}

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
