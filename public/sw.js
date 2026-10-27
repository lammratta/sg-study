// Service Worker（ビルド時に 18e5719a55ae7cee を置換して public/sw.js に生成される）
const VERSION = '18e5719a55ae7cee';
const CACHE = `sg-study-${VERSION}`;
const scopeUrl = (p) => new URL(p, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const res = await fetch(scopeUrl('sw-manifest.json'), { cache: 'no-cache' });
    const manifest = await res.json();
    const cache = await caches.open(CACHE);
    const urls = manifest.files.map((f) => scopeUrl(f.path));
    // 1 つずつ入れて、失敗したファイルがあってもインストールを続ける
    await Promise.all(urls.map((u) => cache.add(new Request(u, { cache: 'no-cache' })).catch(() => null)));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data?.type === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // 画面遷移（index.html）はキャッシュ優先
  if (req.mode === 'navigate') {
    event.respondWith(caches.match(scopeUrl('index.html')).then((r) => r || fetch(req)));
    return;
  }
  // コンテンツ一覧はネットワーク優先（3 秒でキャッシュへ）
  if (url.pathname.endsWith('/content/index.json')) {
    event.respondWith((async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(req, { signal: ctrl.signal, cache: 'no-cache' });
        clearTimeout(t);
        if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
        return res;
      } catch { return cached || Response.error(); }
    })());
    return;
  }
  // それ以外はキャッシュ優先、無ければ取得して保存
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    } catch (e) { return Response.error(); }
  })());
});
