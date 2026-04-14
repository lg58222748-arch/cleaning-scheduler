const CACHE_NAME = 'cleaning-scheduler-v2';

self.addEventListener('install', (event) => {
  // 이전 캐시 무시하고 즉시 활성화
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 모든 이전 캐시 삭제
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // 캐시 없이 항상 네트워크에서 가져옴
  event.respondWith(fetch(event.request));
});
