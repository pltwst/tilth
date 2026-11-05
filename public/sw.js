// Bump VERSION on every release so phones drop the old cache.
const VERSION = 'tilth-v14';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'game.js', 'art.js', 'sound.js', 'icons.js', 'achievements.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Page loads can carry a query string (launchers, shared links); serve the cached page anyway.
  const opts = { ignoreSearch: e.request.mode === 'navigate' };
  e.respondWith(caches.match(e.request, opts).then((hit) => hit || fetch(e.request)));
});
