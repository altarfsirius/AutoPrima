/* Altair Auto — service worker (PWA). Naikkan VERSION setiap rilis agar cache cangkang diperbarui.
   Aturan: hanya GET; data database (supabase.co), API Tuntas/Groundwork, dan semua host lain TIDAK pernah di-cache atau dicegat. */
const VERSION = '2026-10-25-r1';
const SHELL = 'altair-auto-shell-' + VERSION;
const RUNTIME = 'altair-auto-runtime-v1';
const SHELL_FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon-180.png'];
/* pustaka statis yang aman di-cache (skrip supabase-js, font) — bukan data pengguna */
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('altair-auto-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'CLEAR_CACHES') e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('altair-auto-')).map((k) => caches.delete(k)))));
  if (e.data === 'GET_VERSION' && e.source) e.source.postMessage({ type: 'VERSION', version: VERSION });
});

const withTimeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then((v) => { clearTimeout(t); res(v); }, (x) => { clearTimeout(t); rej(x); }); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/sw.js')) return;                       // biarkan browser memeriksa pembaruan SW sendiri
    if (req.mode === 'navigate') { e.respondWith(navigate(req)); return; }
    e.respondWith(staleWhileRevalidate(req, SHELL));
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) { e.respondWith(staleWhileRevalidate(req, RUNTIME)); return; }
  /* host lain (Supabase, Tuntas, Groundwork, web impor, dst.): tidak dicegat sama sekali */
});

async function navigate(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await withTimeout(fetch(req), 4000);                    // jaringan dulu supaya versi terbaru selalu dipakai
    if (res && res.ok) cache.put('./index.html', res.clone());
    return res;
  } catch (err) {
    return (await cache.match('./index.html', { ignoreSearch: true })) || (await cache.match('./')) || Response.error();
  }
}
async function staleWhileRevalidate(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, { ignoreSearch: false });
  const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}
