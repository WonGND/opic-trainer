/* OPIc 창고 서비스워커: 한 번 방문하면 오프라인에서도 열리도록 캐시합니다.
   ※ 로컬 파일(file://)에서는 동작하지 않고, GitHub Pages 등 http(s)로 올렸을 때만 작동합니다. */
const CACHE = "opic-cache-v2";

self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      const network = fetch(e.request)
        .then((res) => {
          // 같은 출처 응답만 캐시에 저장
          if (res && res.ok && new URL(e.request.url).origin === location.origin) {
            cache.put(e.request, res.clone());
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
