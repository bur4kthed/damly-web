// Damly service worker: ana ekrana eklenen site internetsiz de açılır.
// Strateji: önce ağ (güncel sürüm hemen gelir), ağ yoksa önbellek.
// Fiş ve ekstre kütüphaneleri (vendor/) büyük olduğu için ilk kullanıldıklarında önbelleğe girer.

const ONBELLEK = 'damly-v3.1';
const TEMEL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/dil.js', 'js/dil-en.js', 'js/veri.js', 'js/ikonlar.js', 'js/borc.js', 'js/takvim.js', 'js/gercekler.js', 'js/kurallar.js',
  'js/motor.js', 'js/sahneler.js', 'js/maskot.js', 'js/seri.js', 'js/kurulum.js', 'js/alsam.js',
  'js/ses.js', 'js/fis.js', 'js/ekstre.js', 'js/hatirlatma.js', 'js/arayuz.js',
  'assets/apple-touch-icon.png', 'assets/damly-ikon-192.png', 'assets/damly-ikon-512.png',
];
const FONT = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

self.addEventListener('install', olay => {
  olay.waitUntil(caches.open(ONBELLEK).then(c => c.addAll(TEMEL)).then(() => self.skipWaiting()));
});

// Eski sürümlerin önbellekleri silinir
self.addEventListener('activate', olay => {
  olay.waitUntil(caches.keys()
    .then(adlar => Promise.all(adlar.filter(a => a !== ONBELLEK).map(a => caches.delete(a))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', olay => {
  const istek = olay.request;
  if (istek.method !== 'GET') return;
  const adres = new URL(istek.url);

  // Yazı tipleri değişmez: önce önbellek
  if (FONT.test(istek.url)) {
    olay.respondWith(caches.match(istek).then(kayit => kayit || fetch(istek).then(yanit => {
      const kopya = yanit.clone();
      caches.open(ONBELLEK).then(c => c.put(istek, kopya));
      return yanit;
    })));
    return;
  }
  if (adres.origin !== location.origin) return;

  olay.respondWith(fetch(istek).then(yanit => {
    if (yanit.ok) { const kopya = yanit.clone(); caches.open(ONBELLEK).then(c => c.put(istek, kopya)); }
    return yanit;
  }).catch(() => caches.match(istek, { ignoreSearch: true })
    .then(kayit => kayit || (istek.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
