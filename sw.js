/* WireNerd Tools service worker: network-first for the tool pages and their files,
   so they keep working offline once opened. Everything else on the site is untouched. */
var CACHE = 'wn-tools-v2';
var FILES = ["/tools.html", "/tool-peir-calculator.html", "/tool-watts-to-amps.html", "/tool-voltage-drop.html", "/tool-wire-ampacity.html", "/tool-box-fill.html", "/tool-conduit-fill.html", "/tool-conduit-bending.html", "/tool-motor-circuit.html", "/tool-ampacity-derating.html", "/tool-ground-wire-size.html", "/tool-transformer.html", "/tool-breaker-size.html", "/tool-power-triangle.html", "/tool-series-parallel.html", "/tool-wire-color-codes.html", "/tool-awg-to-mm2.html", "/wn-tools.js", "/wn-tools2.js", "/tools.css", "/wn-mobile.css", "/wn-mobile.js", "/manifest.webmanifest", "/icon-192.png", "/icon-180.png"];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).catch(function () {}));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('wn-tools-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); })); }));
  self.clients.claim();
});
self.addEventListener('fetch', function (e) {
  var req = e.request; if (req.method !== 'GET') return;
  var url = new URL(req.url); if (url.origin !== location.origin) return;
  var p = url.pathname;
  var mine = FILES.indexOf(p) >= 0;
  if (!mine) return; // only handle tool files
  e.respondWith(fetch(req).then(function (res) {
    var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return res;
  }).catch(function () { return caches.match(req, { ignoreSearch: true }); }));
});
