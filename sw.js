/* Coğrafyam — service worker
   Strateji: ÖNCE AĞ, olmazsa önbellek.
   Böylece dosyaları her güncellediğimizde tarayıcı en yeni sürümü alır;
   internet yoksa son indirilen sürümle çalışmaya devam eder. */
const SURUM = "cografyam-v34";

const DOSYALAR = [
  "./",
  "./index.html",
  "./css/style.css?s=33",
  "./js/harita-turkiye.js?s=33",
  "./js/il-merkez.js?s=33",
  "./js/komsular.js?s=33",
  "./js/hazir-icerik.js?s=33",
  "./js/vendor/firebase-app-compat.js",
  "./js/vendor/firebase-firestore-compat.js",
  "./js/firebase-config.js?s=33",
  "./js/data.js?s=33",
  "./js/app.js?s=33",
  "./js/bulut.js?s=33",
  "./js/editor.js?s=33",
  "./js/konu-duzen.js?s=33",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", ev => {
  ev.waitUntil(
    caches.open(SURUM)
      .then(c => Promise.allSettled(DOSYALAR.map(d => c.add(d))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", ev => {
  ev.waitUntil(
    caches.keys()
      .then(adlar => Promise.all(adlar.filter(a => a !== SURUM).map(a => caches.delete(a))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", ev => {
  if (ev.request.method !== "GET") return;
  const url = new URL(ev.request.url);
  if (url.origin !== location.origin) return;

  ev.respondWith(
    fetch(ev.request)
      .then(yanit => {
        if (yanit && yanit.status === 200 && yanit.type === "basic") {
          const kopya = yanit.clone();
          caches.open(SURUM).then(c => c.put(ev.request, kopya));
        }
        return yanit;
      })
      .catch(() =>
        caches.match(ev.request).then(bulunan => bulunan || caches.match("./index.html"))
      )
  );
});
