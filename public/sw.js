// Doppio Drifters service worker: opens instantly and works with no signal.
// - App shell (page, code, styles, fonts, images): served from cache, refreshed in the background.
// - Public data reads (activities, events, people…): network first, last copy used when offline.
// - Barista actions and private calendar data are POSTs and are never cached.
const VERSION = "bb51764a3a";
const SHELL = `shell-${VERSION}`;
const DATA = "data-v1";
const SUPABASE = "https://xtzbgwnxfkdzhysnpwyq.supabase.co";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    const html = await (await fetch("/", { cache: "no-cache" })).text();
    const assets = [...html.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    await cache.addAll(["/", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png", ...assets]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("shell-") && k !== SHELL).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Public table reads from Supabase: fresh when online, last known when offline.
  if (url.origin === SUPABASE) {
    if (!url.pathname.startsWith("/rest/v1/")) return;
    event.respondWith((async () => {
      const cache = await caches.open(DATA);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(req);
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Page loads: network first so new builds show up, cached page when offline.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(SHELL);
        cache.put("/", res.clone());
        return res;
      } catch {
        return (await caches.match("/")) || Response.error();
      }
    })());
    return;
  }

  // Everything else on our origin: cache first, fill the cache as we go.
  event.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === "basic") (await caches.open(SHELL)).put(req, res.clone());
    return res;
  })());
});
