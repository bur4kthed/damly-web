// ============================================================
// arayuz.js — KULLANICI ARAYÜZÜ + AÇIKLAMA MODÜLÜ
// Ekranları çizer, dokunma ve klavye olaylarını yönetir.
// Her çizimde: veriler → gerçekler → çıkarım motoru → öneriler
// ============================================================

let veri = veriYukle();

const durum = {
  sekme: 'bugun',        // alt menüde seçili sekme
  yigin: [],             // açık alt ekranlar: 'butce' | 'sabit' | 'gecmis' | 'nasil' | 'profil'
  sonEkran: '',
  kurulum: yeniKurulum(),
  taslak: null,          // Profil'deki gelir/ulaşım düzenleme sayfasının taslağı
  sheet: null,           // açık alt sayfanın (bottom sheet) türü
  sheetId: null,
  tus: '',               // tuş takımıyla girilen tutar (ör. "125,5")
  form: {},              // açık alt sayfadaki seçimler
  sifirlaOnay: false,
  takvimAy: null,        // takvimde gösterilen ay (ayın 1'i)
  seciliGun: null,       // takvimde seçili gün
  tur: null,             // rehberli tur: { adim }
  g: null,               // son hesaplanan gerçekler
  sonuc: null,           // son çıkarım sonucu
  gecis: null,           // sıradaki ekran geçişi: 'ileri' | 'geri' | 'sekme-ileri' | 'sekme-geri'
  konumlar: {},          // ekranlardan çıkarken kalınan kaydırma konumu
  sonSekme: null,        // alt menüde en son çizilen sekme (ikon animasyonu için)
  bugunDeger: undefined, // Bugün kartındaki tutar ve damla; değişince eskiden yeniye akar
  bugunOran: 1,          // damladaki son su seviyesi (bugünkü limitten kalan pay)
  rank: null,            // rank durumu (rank.js)
  rankKutlama: null,     // kutlama sayfasında gösterilecek yeni rank
  yeniHarcama: null,     // az önce eklenen harcama (listede belirerek gelir)
  takvimYon: null        // takvimde ay değişince ızgaranın kayacağı yön
};
const acikNedenler = new Set();

const $ = (s, kok = document) => kok.querySelector(s);
const $$ = (s, kok = document) => [...kok.querySelectorAll(s)];

const uygulama = $('#uygulama');
uygulama.innerHTML = `
  <div id="ekran" class="ekran"></div>
  <nav id="sekmeler" class="sekme-cubugu" aria-label="Ana menü"></nav>
  <div id="katman" class="katman"></div>
  <div id="bildirimler" class="bildirimler" aria-live="polite"></div>`;

const SEKMELER = [
  { id: 'bugun', ad: 'Bugün', ikon: 'ev' },
  { id: 'takvim', ad: 'Takvim', ikon: 'takvim' },
  null, // ortadaki + düğmesi
  { id: 'kumbara', ad: 'Kumbara', ikon: 'damla' },
  { id: 'asistan', ad: 'Asistan', ikon: 'yildiz' }
];
const EKRAN_ADLARI = {
  bugun: 'Bugün', takvim: 'Takvim', kumbara: 'Kumbara', asistan: 'Asistan',
  butce: 'Bütçe', sabit: 'Düzenli ödemeler', gecmis: 'Geçmiş', nasil: 'Asistan', profil: 'Profil', gelirler: 'Gelirler', borclar: 'Borçlar', hatirlatmalar: 'Bildirimler', rank: 'Rank'
};
const SEVIYE_IKON = { kritik: 'dur', uyari: 'uyari', oneri: 'ampul', tebrik: 'kupa' };
const SEVIYE_RENK = { kritik: 'var(--tehlike)', uyari: 'var(--uyari)', oneri: 'var(--oneri)', tebrik: 'var(--basari)' };
const TUR_IPUCU = { ihtiyac: 'Olmazsa olmaz: yemek, ulaşım, okul…', istek: 'Olmasa da olur: kahve, oyun, yeni kıyafet…' };

// ---------- Yardımcılar ----------

function selam() {
  const s = new Date().getHours();
  return s < 5 ? 'İyi geceler' : s < 12 ? 'Günaydın' : s < 18 ? 'İyi günler' : s < 23 ? 'İyi akşamlar' : 'İyi geceler';
}
function ilkAd(ad) { return (ad || '').trim().split(/\s+/)[0] || ''; }
function basHarf(ad) { return (ad || '?').trim().charAt(0).toLocaleUpperCase('tr') || '?'; }
function duzMetin(html) { const d = document.createElement('div'); d.innerHTML = html; return d.textContent; }
function titret() {
  if (yerelUygulama) { yereleGonder({ tur: 'titret' }); return; }
  try { navigator.vibrate && navigator.vibrate(8); } catch (e) { /* desteklenmiyor */ }
}

// ---------- Android uygulaması köprüsü (mobil/ klasöründeki Expo uygulaması) ----------
// Uygulama, bu sayfayı bir WebView içinde açar; mesajlar JSON olarak gider.
const yerelUygulama = !!window.ReactNativeWebView;
if (yerelUygulama) document.documentElement.classList.add('yerel');
function yereleGonder(mesaj) {
  try { if (yerelUygulama) window.ReactNativeWebView.postMessage(JSON.stringify(mesaj)); } catch (e) { /* köprü yok */ }
}

// ---------- Çevrimdışı çalışma (sw.js) ----------
// Ana ekrana eklenen site internetsiz de açılsın diye; Android uygulamasında ve dosyadan açılışta gerekmez.
if (!yerelUygulama && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* desteklenmiyor */ }));
}

// Android geri tuşu: önce açık sayfayı kapat, sonra bir önceki ekrana dön; en sonda uygulamadan çık
window.damlyGeri = function () {
  if (durum.sheet) { sheetKapat(); return; }
  if (durum.tur) return;
  if (!veri.profil) {
    if (durum.kurulum.adim > 0) kurulumGeri();
    else yereleGonder({ tur: 'cik' });
    return;
  }
  if (durum.yigin.length) { durum.yigin.pop(); durum.sifirlaOnay = false; durum.gecis = 'geri'; ciz(); return; }
  if (durum.sekme !== 'bugun') { sekmeyeGec('bugun'); ciz(); return; }
  yereleGonder({ tur: 'cik' });
};
function salla(secici) {
  const el = $(secici);
  if (!el) return;
  el.classList.remove('salla'); void el.offsetWidth; el.classList.add('salla');
}
function tusBicim(s) {
  const [tam, ondalik] = s.split(',');
  const t = Number(tam || '0').toLocaleString('tr-TR');
  return ondalik !== undefined ? `${t},${ondalik}` : t;
}
function kisaTarih(d) { return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }); }
function donemAraligi(d) { return `${kisaTarih(d.efBas)} – ${kisaTarih(d.son)}`; }
function donemBasligi(g) { return g.donemAdi === 'ay' ? 'Bu ay' : 'Bu hafta'; }
function donemIyelik(g) { return g.donemAdi === 'ay' ? 'Bu ayın' : 'Bu haftanın'; }
// "Bugün" ve "Yarın" cümle içinde küçük harfle yazılır
function cumleTarihi(t) { const s = tarihGoster(t); return ['Bugün', 'Yarın', 'Dün'].includes(s) ? s.toLocaleLowerCase('tr') : s; }

function temaUygula() {
  const kok = document.documentElement;
  kok.dataset.mod = veri.ayarlar.mod;
  const koyu = veri.ayarlar.mod === 'koyu' || (veri.ayarlar.mod === 'sistem' && matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = koyu ? '#0A1730' : '#F4F6FA';
  // Mod geçişi animasyonu sürerken durum çubuğu rengi beklesin; animasyon bitince gönderilir
  if (koyu !== temaUygula.son && !temaUygula.ertele) { temaUygula.son = koyu; yereleGonder({ tur: 'tema', koyu }); }
}

// ---------- Ana çizim ----------

function aktifEkran() { return durum.yigin[durum.yigin.length - 1] || durum.sekme; }

function ciz() {
  temaUygula();
  hatirlatmalariGonder();
  const ekranEl = $('#ekran');
  const sekmeEl = $('#sekmeler');

  if (!veri.profil) {
    kurulumEkraniCiz(ekranEl);
    sekmeEl.hidden = true;
    tutarIpucuGuncelle();
    turCiz();
    return;
  }

  const g = gercekleriHesapla(veri);
  const sonuc = cikarimYap(g);
  durum.g = g;
  durum.sonuc = sonuc;
  durum.rank = rankDurumu(veri, g);
  const rankHaber = rankHaberi(veri, durum.rank);

  const anahtar = aktifEkran();
  const eski = $('.kaydir:not(.cikis)', ekranEl);
  const ayni = eski && anahtar === durum.sonEkran;
  const sayfalar = { bugun: bugunCiz, takvim: takvimCiz, kumbara: kumbaraCiz, asistan: asistanCiz, butce: butceCiz, profil: profilCiz, gecmis: gecmisCiz, sabit: sabitCiz, nasil: nasilCiz, gelirler: gelirlerCiz, borclar: borclarCiz, hatirlatmalar: hatirlatmalarCiz, rank: rankCiz };

  const yeni = document.createElement('div');
  yeni.className = ayni ? 'kaydir yenile' : 'kaydir';
  yeni.innerHTML = sayfalar[anahtar](g, sonuc);
  if (ayni) {
    const konum = eski.scrollTop;
    eski.replaceWith(yeni);
    yeni.scrollTop = konum;
  } else {
    ekranGecisi(ekranEl, eski, yeni, anahtar);
  }
  durum.sonEkran = anahtar;
  durum.gecis = null;
  durum.yeniHarcama = null;
  durum.takvimYon = null;

  const tutarEl = $('.gk-tutar', yeni);
  if (tutarEl) { sayarakGoster(tutarEl, durum.bugunDeger, g.bugunKalan); durum.bugunDeger = g.bugunKalan; }

  sekmeEl.hidden = false;
  sekmeEl.innerHTML = sekmelerCiz(sonuc);
  sekmeEl.style.setProperty('--sira', SEKMELER.findIndex(s => s && s.id === durum.sekme));
  durum.sonSekme = durum.sekme;
  turCiz();
  rankHaberiGoster(rankHaber);
}

// ---------- Ekran geçişleri ----------
// Alt ekrana girerken yeni ekran sağdan gelir, geri dönerken sağa çekilir.
// Sekmeler arasında yeni ekran, seçilen sekmenin yönünden kayarak belirir.

function hareketAzaltilmis() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }

function sekmeyeGec(sekme) {
  const sira = id => SEKMELER.findIndex(s => s && s.id === id);
  durum.gecis = sira(sekme) > sira(durum.sekme) ? 'sekme-ileri' : 'sekme-geri';
  durum.sekme = sekme;
  durum.yigin = [];
}

function ekranGecisi(ekranEl, eski, yeni, anahtar) {
  const tur = 'g-' + (durum.gecis || 'belir');
  $$('.kaydir.cikis', ekranEl).forEach(x => x.remove());
  if (eski && durum.sonEkran) durum.konumlar[durum.sonEkran] = eski.scrollTop;
  if (!eski) {
    yeni.classList.add('giris');
    ekranEl.appendChild(yeni);
    return;
  }
  eski.classList.add('cikis', tur);
  eski.inert = true;
  yeni.classList.add('gir', tur);
  ekranEl.appendChild(yeni);
  // Yeni açılan alt ekran baştan başlar; geri dönülen ya da sekmeyle açılan ekran kaldığı yerden
  if (tur !== 'g-ileri') yeni.scrollTop = durum.konumlar[anahtar] || 0;
  setTimeout(() => {
    eski.remove();
    yeni.classList.remove('gir', tur);
  }, hareketAzaltilmis() ? 0 : 460);
}

// Bugünkü tutar değişince eski değerden yenisine sayarak geçer
function sayarakGoster(el, eski, yeni) {
  if (eski === undefined || Math.round(eski) === Math.round(yeni) || hareketAzaltilmis()) return;
  const yaz = v => { el.textContent = (Math.round(v) < 0 ? '−' : '') + para(Math.abs(v)); };
  const bas = performance.now(), sure = 700;
  yaz(eski);
  const adim = an => {
    const o = Math.min(1, (an - bas) / sure);
    yaz(eski + (yeni - eski) * (1 - Math.pow(1 - o, 3)));
    if (o < 1 && el.isConnected) requestAnimationFrame(adim);
  };
  requestAnimationFrame(adim);
}

function kaydetVeCiz(mesaj, tur) {
  veriKaydet(veri);
  ciz();
  if (mesaj) bildirim(mesaj, tur);
}

function bildirim(mesaj, tur = '') {
  const kap = $('#bildirimler');
  const el = document.createElement('div');
  el.className = `bildirim ${tur}`;
  el.innerHTML = `${ikon(tur === 'uyari' ? 'uyari' : tur === 'damla' ? 'damla' : 'onay', 18)}<span>${esc(mesaj)}</span>`;
  kap.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('gorunur')));
  setTimeout(() => el.classList.remove('gorunur'), 2400);
  setTimeout(() => el.remove(), 2800);
}

function sekmelerCiz(sonuc) {
  const rozet = sonuc.oneriler.filter(o => o.seviye === 'kritik' || o.seviye === 'uyari').length;
  return SEKMELER.map(s => s
    ? `<button class="sekme ${durum.sekme === s.id ? 'aktif' : ''} ${durum.sekme === s.id && durum.sonSekme && durum.sonSekme !== s.id ? 'yeni' : ''}" data-eylem="sekme" data-sekme="${s.id}">
        ${ikon(s.ikon, 24)}<span>${s.ad}</span>
        ${s.id === 'asistan' && rozet ? `<i class="rozet">${rozet}</i>` : ''}
      </button>`
    : `<button class="fab" data-eylem="harcama-ekle" aria-label="Harcama ekle">${ikon('arti', 28)}</button>`
  ).join('');
}

// ---------- Ortak bileşenler ----------

function geriEtiketi() {
  const y = durum.yigin;
  return y.length > 1 ? EKRAN_ADLARI[y[y.length - 2]] : EKRAN_ADLARI[durum.sekme];
}

function baslik(metin, { ust = '', sag = '', geri = false } = {}) {
  return `<header class="ust">
    ${geri ? `<button class="geri-dugme" data-eylem="geri">${ikon('geri', 22)}<span>${geriEtiketi()}</span></button>` : ''}
    <div class="ust-satir">
      <div class="ust-metin">${ust ? `<span class="ust-ek">${ust}</span>` : ''}<h1>${metin}</h1></div>
      ${sag}
    </div>
  </header>`;
}

function bosDurum(baslikMetni, metin, dugme = '') {
  return `<div class="bos-durum">${damlaLogo(44, 'soluk-logo')}<b>${baslikMetni}</b><span>${metin}</span>${dugme}</div>`;
}

function ilerleme(oran, sinif = '', isaret = null, isaretEtiket = '') {
  const genislik = Math.max(0, Math.min(1, oran || 0)) * 100;
  const isaretHtml = isaret === null ? ''
    : `<div class="ilerleme-isaret" style="left:${Math.min(100, isaret * 100)}%"><span>${isaretEtiket}</span></div>`;
  return `<div class="ilerleme ${sinif} ${isaret !== null ? 'isaretli' : ''}">
    <div class="ilerleme-dolgu" style="width:${genislik}%"></div>${isaretHtml}
  </div>`;
}

// Logodaki damla: içindeki su bugün harcanmadan kalan pay. Su, bir önceki çizimdeki
// seviyeden yenisine iner ya da çıkar (ilk açılışta dolu damladan başlar).
function damlaGosterge(oran) {
  const kalan = Math.max(0, Math.min(1, 1 - oran));
  const onceki = durum.bugunOran;
  durum.bugunOran = kalan;
  const y = k => (108 - k * 100).toFixed(1);   // su yüzeyinin yüksekliği
  const dalga = 'M-50 0q12.5-4 25 0' + 't25 0'.repeat(7) + 'V112H-50Z';
  return `<div class="damla-gosterge" role="img" aria-label="Bugünkü limitinin ${yuzde(kalan)} kadarı kaldı">
    <svg viewBox="0 0 100 112" fill="none" aria-hidden="true">
      <defs><clipPath id="dg-c"><path d="${LOGO_DAMLA}"/></clipPath></defs>
      <g clip-path="url(#dg-c)"><g class="dg-su" style="--onceki:${y(onceki)}px;transform:translateY(${y(kalan)}px)"><g class="dg-dalga"><path d="${dalga}"/></g></g></g>
      <path d="${LOGO_DAMLA}" class="dg-cizgi"/>
    </svg>
  </div>`;
}

function haftaGrafik(g) {
  const maks = Math.max(...g.hafta.map(x => x.toplam), g.gunlukLimit, 1) * 1.18;
  return `<div class="hafta">
    <div class="hafta-alan">
      ${g.gunlukLimit > 0 ? `<div class="hafta-limit" style="bottom:${g.gunlukLimit / maks * 100}%"></div>` : ''}
      ${g.hafta.map((x, i) => {
        const asti = x.limit !== null && Math.round(x.toplam) > Math.round(x.limit);
        const y = x.toplam ? Math.max(4, x.toplam / maks * 100) : 0;
        return `<div class="hafta-sutun ${x.bugun ? 'bugun' : ''} ${asti ? 'asti' : ''}" title="${tarihGoster(x.tarih)}: ${para(x.toplam)}">
          ${x.bugun && x.toplam ? `<span class="hafta-deger">${para(x.toplam)}</span>` : ''}
          <div class="hafta-cubuk" style="height:${y}%;animation-delay:${i * 40}ms"></div>
        </div>`;
      }).join('')}
    </div>
    <div class="hafta-etiketler">${g.hafta.map(x => `<span class="${x.bugun ? 'bugun' : ''}">${x.bugun ? 'Bugün' : x.gunAdi}</span>`).join('')}</div>
    <div class="hafta-lejant">
      <span><i class="cizgi"></i>Bugünkü limit ${para(g.gunlukLimit)}</span>
      <span><i class="ici"></i>Limit içinde</span>
      <span><i class="asti"></i>Aşıldı</span>
    </div>
  </div>`;
}

function harcamaSatiri(h) {
  const k = kategori(h.kategori);
  return `<button class="satir ${h.id === durum.yeniHarcama ? 'yeni' : ''}" data-eylem="harcama-detay" data-id="${h.id}">
    <span class="kat-ikon" style="--renk:${k.renk}">${ikon(k.ikon, 20)}</span>
    <span class="satir-orta">
      <b>${esc(h.aciklama || k.ad)}</b>
      <small>${k.ad} · <span class="tur-etiket ${h.tur}">${h.tur === 'istek' ? 'İstek' : 'İhtiyaç'}</span>${h.planId ? ' · Planlı' : ''}${h.saat ? ' · ' + h.saat : ''}</small>
    </span>
    <span class="satir-tutar">−${para(h.tutar)}</span>
  </button>`;
}

function grupSatiri({ ikonAd, renk, baslik: b, alt = '', eylem = '', id = '', deger = '', ekran = '', ok = true, sinif = '' }) {
  return `<button class="grup-satir ${sinif}" ${eylem ? `data-eylem="${eylem}"` : ''} ${id ? `data-id="${id}"` : ''} ${ekran ? `data-ekran="${ekran}"` : ''}>
    ${ikonAd ? `<span class="kat-ikon" style="--renk:${renk}">${ikon(ikonAd, 18)}</span>` : ''}
    <span class="satir-orta"><b>${b}</b>${alt ? `<small>${alt}</small>` : ''}</span>
    ${deger ? `<span class="grup-deger">${deger}</span>` : ''}
    ${ok ? ikon('ileri', 18, 'grup-ok') : ''}
  </button>`;
}

function bilgiSatiri(etiket, deger) {
  return `<div class="grup-satir sabit"><span class="satir-orta"><b>${etiket}</b></span><span class="grup-deger">${deger}</span></div>`;
}

// Takvimde ve Bugün ekranında kullanılan küçük olay satırı
function olaySatiri({ ikonAd, renk, baslik: b, alt = '', dugme = '', eylem = '', id = '', ekran = '' }) {
  const ic = `<span class="kat-ikon kucuk" style="--renk:${renk}">${ikon(ikonAd, 16)}</span>
    <span class="satir-orta"><b>${b}</b>${alt ? `<small>${alt}</small>` : ''}</span>`;
  return eylem
    ? `<button class="olay-satir" data-eylem="${eylem}" data-id="${id}" ${ekran ? `data-ekran="${ekran}"` : ''}>${ic}${ikon('ileri', 16, 'grup-ok')}</button>`
    : `<div class="olay-satir">${ic}${dugme}</div>`;
}

function modSecimi() {
  const a = veri.ayarlar;
  return `<div class="segment mod-secim">${[['sistem', 'Sistem', 'telefon'], ['acik', 'Açık', 'gunes'], ['koyu', 'Koyu', 'ay']].map(([id, ad, ik]) =>
    `<button class="${a.mod === id ? 'secili' : ''}" data-eylem="mod" data-deger="${id}">${ikon(ik, 15)}${ad}</button>`).join('')}</div>`;
}

function koyuMu(mod) { return mod === 'koyu' || (mod === 'sistem' && matchMedia('(prefers-color-scheme: dark)').matches); }

// Açık ↔ koyu geçişi: yeni görünüm, dokunulan düğmeden daire şeklinde yayılır
function modDegistir(el) {
  const yeni = el.dataset.deger;
  if (yeni === veri.ayarlar.mod) return;
  const gorunumDegisiyor = koyuMu(yeni) !== koyuMu(veri.ayarlar.mod);
  const uygula = () => { veri.ayarlar.mod = yeni; kaydetVeCiz(); };
  if (!gorunumDegisiyor || matchMedia('(prefers-reduced-motion: reduce)').matches) { uygula(); return; }

  if (!document.startViewTransition) {
    // Eski tarayıcılarda renkler yumuşakça değişir
    const kok = document.documentElement;
    kok.classList.add('mod-gecis');
    uygula();
    setTimeout(() => kok.classList.remove('mod-gecis'), 550);
    return;
  }
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const yaricap = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  temaUygula.ertele = true;
  const gecis = document.startViewTransition(uygula);
  gecis.finished.finally(() => { temaUygula.ertele = false; temaUygula(); });
  gecis.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${yaricap}px at ${x}px ${y}px)`] },
      { duration: 700, easing: 'cubic-bezier(.4, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' }
    );
  }).catch(() => {});
}

function kategoriHalkasi(g) {
  const dilimler = Object.entries(g.kategoriToplamlari).sort((a, b) => b[1] - a[1]);
  const top = g.harcanan;
  if (!top) return bosDurum('Henüz harcama yok', 'Bu dönem harcama ekledikçe dağılım burada görünecek.');
  let birikim = 0;
  const parcalar = dilimler.map(([id, t]) => {
    const pay = t / top * 100;
    const uzunluk = dilimler.length > 1 ? Math.max(0.5, pay - 1) : pay;
    const parca = `<circle r="15.9155" cx="21" cy="21" fill="none" stroke="${kategori(id).renk}" stroke-width="5"
      stroke-dasharray="${uzunluk} ${100 - uzunluk}" stroke-dashoffset="${25 - birikim}"/>`;
    birikim += pay;
    return parca;
  }).join('');
  return `<div class="kategori-dagilim">
    <div class="halka-kap">
      <svg viewBox="0 0 42 42" role="img" aria-label="Kategorilere göre harcama dağılımı">${parcalar}</svg>
      <div class="halka-orta"><b>${para(top)}</b><span>bu ${g.donemAdi}</span></div>
    </div>
    <div class="kategori-liste">${dilimler.map(([id, t]) => {
      const k = kategori(id);
      return `<div class="kl-satir">
        <span class="kat-ikon kucuk" style="--renk:${k.renk}">${ikon(k.ikon, 16)}</span>
        <span class="kl-ad">${k.ad}</span><span class="kl-yuzde">${yuzde(t / top)}</span><b>${para(t)}</b>
      </div>`;
    }).join('')}</div>
  </div>`;
}

function butceParcalari(g) {
  return [
    { ad: 'Sabit gider payı', tutar: g.sabitPayi, renk: 'var(--p-sabit)' },
    { ad: 'Borç ödemeleri', tutar: g.borcPayi, renk: 'var(--p-borc)' },
    { ad: 'Ulaşım payı', tutar: g.ulasimPayi, renk: 'var(--p-ulasim)' },
    { ad: 'Planlı harcamalar', tutar: g.planPayi, renk: 'var(--p-plan)' },
    { ad: 'Kumbara payı', tutar: g.birikimPayi, renk: 'var(--p-kumbara)' },
    { ad: 'Kumbaraya atılan', tutar: g.kumbaraAtilan, renk: 'var(--p-kumbara)' },
    { ad: 'Harcanan', tutar: g.serbestHarcanan, renk: 'var(--p-harcanan)', hep: true },
    { ad: 'Kalan', tutar: Math.max(0, g.harcanabilirKalan), renk: 'var(--p-kalan)', hep: true }
  ].filter(x => x.hep || x.tutar >= 1);
}

function dagilimCubugu(g, parcalar) {
  const payda = Math.max(g.donemGeliri, parcalar.reduce((t, x) => t + x.tutar, 0)) || 1;
  return `<div class="dagilim-cubugu">${parcalar.filter(x => x.tutar > 0).map(x => `<i style="width:${x.tutar / payda * 100}%;background:${x.renk}"></i>`).join('')}</div>`;
}

// ---------- Bugün ----------

// Bugün ekranı dört parçadır: limit kartı, günün olayları, kısa özetler ve bugünkü harcamalar.
// Ayrıntılar (bütçe dağılımı, son 7 gün, kalkan) Bütçe ekranındadır.
function bugunCiz(g, sonuc) {
  const p = veri.profil;
  const tarihMetni = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });

  return `
  ${baslik(`${selam()}, ${esc(ilkAd(p.ad))}`, {
    ust: tarihMetni,
    sag: `<button class="avatar" data-eylem="alt" data-ekran="profil" aria-label="Profil ve ayarlar">${esc(basHarf(p.ad))}</button>`
  })}

  ${gunlukKart(g)}
  ${rankKarti(durum.rank, g)}
  ${haftaSeridi(g)}
  ${bugunOlaylari(g)}
  ${bugunOzetleri(g, sonuc)}

  <section class="kart">
    <div class="kart-bas"><h2>Bugünkü harcamalar</h2><button class="metin-dugme" data-eylem="alt" data-ekran="gecmis">Geçmiş</button></div>
    ${g.bugunHarcamalar.length
      ? `<div class="liste">${g.bugunHarcamalar.map(harcamaSatiri).join('')}</div>`
      : bosDurum('Bugün henüz harcama yok', 'Harcadıkça ekle; Damly limitini anında güncellesin.',
          `<button class="dugme ana kucuk" data-eylem="harcama-ekle">${ikon('arti', 18)} Harcama ekle</button>`)}
  </section>`;
}

function gunlukKart(g) {
  const asim = g.bugunKalan < 0;
  const gk = g.gelireKalanGun;
  // Tarihi değişen gelirde (burs gibi) en geç gün bilinir
  const gelirZamani = gk === null ? '—' : gk === 0 ? 'Bugün' : g.gelirDegisken ? `En geç ${gk} gün` : gk === 1 ? 'Yarın' : `${gk} gün sonra`;
  return `<section class="gunluk-kart ${asim ? 'asim' : ''}">
    <div class="gk-ust">
      <div class="gk-bilgi">
        <span class="gk-etiket">${asim ? 'Bugünkü limitini' : 'Bugün daha'}</span>
        <strong class="gk-tutar">${para(Math.abs(g.bugunKalan))}</strong>
        <span class="gk-etiket">${asim ? 'aştın.' : 'harcayabilirsin.'}</span>
      </div>
      ${damlaGosterge(g.bugunOran)}
    </div>
    <span class="gk-alt">Günlük limit ${para(g.gunlukLimit)}${g.bugunHarcanan > 0 ? `, ${para(g.bugunHarcanan)} harcandı` : ''}</span>
    ${donemLimitSatiri(g)}
    <button class="gk-serit" data-eylem="limit-bilgi" aria-label="Günlük limit nasıl hesaplanır?">
      <span><small>Yarınki limit</small><b>${g.yarinLimit === null ? 'Yenilenir' : para(g.yarinLimit)}</b></span>
      <span><small>Limit serisi</small><b>${g.seri} gün</b></span>
      <span><small>${buyukHarf(g.gelirAdi)}</small><b>${gelirZamani}</b></span>
    </button>
  </section>`;
}

// Haftalık (ya da aylık) limit: dönemin harcanabilir parası ve ne kadarının kaldığı
function donemLimitSatiri(g) {
  const limit = Math.max(0, g.harcanabilirDonem);
  const kalan = Math.max(0, g.harcanabilirKalan);
  const oran = limit > 0 ? Math.min(1, 1 - kalan / limit) : 1;
  return `<button class="gk-donem" data-eylem="alt" data-ekran="butce" aria-label="${donemIyelik(g)} bütçesi">
    <span class="gk-donem-ust">
      <span>${g.donemAdi === 'hafta' ? 'Haftalık' : 'Aylık'} limit <b>${para(limit)}</b></span>
      <span><b>${para(kalan)}</b> kaldı</span>
    </span>
    <span class="gk-donem-cubuk"><i style="transform:scaleX(${oran.toFixed(3)})"></i></span>
  </button>`;
}

// Asistanın en önemli önerisi, maskotun konuşma balonunda tek satır olarak
// (dönemin bütçesi artık limit kartında)
function bugunOzetleri(g, sonuc) {
  const ilk = sonuc.oneriler[0];
  if (!ilk) return '';
  const kalan = sonuc.oneriler.length - 1;
  return `<button class="maskot-satir" data-eylem="sekme" data-sekme="asistan">
    ${maskot({ ruh: SEVIYE_RUH[ilk.seviye], boyut: 56, dolum: maskotDolum(g) })}
    <span class="konusma"><span class="satir-orta"><b>${ilk.baslik}</b><small>${kalan > 0 ? `${kalan} öneri daha` : 'Asistanın önerisi'}</small></span>${ikon('ileri', 18, 'grup-ok')}</span>
  </button>`;
}

// Bu haftanın günleri (Pazartesi–Pazar): limit içinde geçen gün dolu, aşılan gün çarpı,
// bugün kullanılan yüzde, gelecek günler kesik çizgi. Dokununca takvim açılır.
function haftaSeridi(g) {
  const tk = g.takvim, bugun = tarihCoz(tk.bugunS);
  const pzt = gunEkle(bugun, -((bugun.getDay() + 6) % 7));
  const gunler = HAFTA_SIRASI.map((gn, i) => {
    const t = tarihStr(gunEkle(pzt, i));
    let durumu = 'gelecek', ic = '';
    if (t === tk.bugunS) { durumu = g.bugunKalan < 0 ? 'bugun asti' : 'bugun'; ic = yuzde(Math.min(g.bugunOran, 9.99)); }
    else if (t < tk.bugunS) {
      const k = t >= tk.baslangic ? tk.gun(t) : null;
      if (!k) durumu = 'yok';
      else if (Math.round(k.serbest) <= Math.round(k.limit)) { durumu = 'iyi'; ic = ikon('onay', 15); }
      else { durumu = 'asti'; ic = ikon('kapat', 14); }
    }
    return `<span class="hs-gun ${durumu}"><i>${ic}</i>${GUN_KISA[gn]}</span>`;
  }).join('');
  return `<button class="hafta-serit" data-eylem="sekme" data-sekme="takvim" aria-label="Bu haftanın limit durumu, ${g.seri} günlük seri">${gunler}</button>`;
}

// Bugüne ait takvim olayları: tatil, ulaşım, gelir, planlar
function bugunOlaylari(g) {
  const bugun = bugunStr();
  const satirlar = [];
  if (g.bugunTatil) {
    satirlar.push(olaySatiri({ ikonAd: 'gunes', renk: '#F59F00', baslik: `Bugün tatil: ${esc(g.bugunTatil.ad)}`,
      alt: g.bugunUlasim === 'tatil' ? 'Ulaşım payı ayrılmadı, limitine eklendi' : 'İyi dinlenmeler!' }));
  }
  if (g.bugunUlasim === 'var') {
    satirlar.push(olaySatiri({ ikonAd: 'otobus', renk: '#4C6EF5', baslik: `Ulaşım için ${para(g.ulasimGunluk)} ayrıldı`,
      alt: veri.ulasim.gidisDonus ? 'Gidiş-dönüş · limitine dahil değil' : 'Tek yön · limitine dahil değil',
      dugme: `<button class="dugme kucuk hafif" data-eylem="ulasim-atla" data-tarih="${bugun}">Bugün binmedim</button>` }));
  } else if (g.bugunUlasim === 'atlandi') {
    satirlar.push(olaySatiri({ ikonAd: 'otobus', renk: '#7C8798', baslik: 'Bugün ulaşım yok',
      alt: `${para(g.ulasimGunluk)} limitine eklendi`,
      dugme: `<button class="dugme kucuk hafif" data-eylem="ulasim-atla" data-tarih="${bugun}">Geri al</button>` }));
  }
  if (g.bugunGelirGunu && g.duzen !== 'gunluk' && !g.bekleyenGelirler.some(x => x.kaynak === 'ana')) {
    const isaretli = veri.gelirKayit[`ana|${bugun.slice(0, 7)}`] === bugun;
    satirlar.push(olaySatiri({ ikonAd: 'damla', renk: '#12B886', baslik: `Bugün ${g.gelirAdi} günü`, alt: `+${para(veri.profil.gelirTutari)} · yeni dönem başladı`,
      dugme: isaretli ? gelisDugme('Geri al', 'ana', bugun.slice(0, 7), 'sil') : '' }));
  }
  if (g.duzen === 'gunluk' && g.bugunGelir) satirlar.push(gelirSatiri(g, bugun, g.bugunGelir, true));
  // Borçlar: gecikenler, 3 gün içinde ödenecekler ve vadesi geçen alacaklar
  g.gecikenOdemeler.concat(g.yaklasanOdemeler, g.gecikenAlacaklar).forEach(x => satirlar.push(borcOlaySatiri(x, bugun)));
  g.bekleyenGelirler.forEach(x => satirlar.push(bekleyenGelirSatiri(x, bugun)));
  g.bugunEkGelirler.forEach(x => satirlar.push(ekGelirSatiri(x, bugun)));
  g.kararZamani.forEach(x => {
    satirlar.push(olaySatiri({ ikonAd: 'kum', renk: 'var(--marka)', baslik: `Karar zamanı: ${esc(x.ad)}`,
      alt: `${BEKLEME_GUN} gün doldu · ${para(x.tutar)}`,
      dugme: `<button class="dugme kucuk hafif" data-eylem="bekle-detay" data-id="${x.id}">Karar ver</button>` }));
  });
  g.bugunPlanlar.forEach(pl => {
    const k = kategori(pl.kategori);
    satirlar.push(olaySatiri({ ikonAd: k.ikon, renk: k.renk, baslik: `Bugünkü planın: ${esc(pl.ad)}`,
      alt: `${para(pl.tutar)} ayrıldı`,
      dugme: `<button class="dugme kucuk hafif" data-eylem="plan-harcadim" data-id="${pl.id}">Harcadım</button>` }));
  });
  // Harçlıksız gün kalkanı yalnızca zayıfladığında burada görünür; ayrıntısı Bütçe ekranında
  const k = g.kalkan;
  if (k && k.oran < 0.95) {
    const haftaSonu = k.gunAdlari.every(a => a === 'Cumartesi' || a === 'Pazar');
    satirlar.push(olaySatiri({ ikonAd: 'kalkan', renk: k.oran >= 0.75 ? 'var(--uyari)' : 'var(--vurgu)',
      baslik: `${haftaSonu ? 'Hafta sonu' : 'Harçlıksız gün'} kalkanı ${k.oran >= 0.75 ? 'azalıyor' : 'zayıf'}`,
      alt: `${k.gunAdlari.join(' ve ')} için cebinde ${para(k.ihtiyac)} kalmalı`, eylem: 'alt', ekran: 'butce' }));
  }
  return satirlar.length ? `<div class="olay-listesi">${satirlar.join('')}</div>` : '';
}

// Günlük harçlık satırı: harçlık gelmediyse ya da tatilde geldiyse tek dokunuşla işaretlenir
function gelirSatiri(g, t, gd, bugunMu) {
  const ad = buyukHarf(g.gelirAdi), tutar = para(veri.profil.gelirTutari);
  const dugme = (metin, deger) => `<button class="dugme kucuk hafif" data-eylem="gelir-isaret" data-tarih="${t}" data-deger="${deger}">${metin}</button>`;
  if (gd.neden === 'normal') {
    return olaySatiri({ ikonAd: 'damla', renk: '#12B886', baslik: `${bugunMu ? 'Bugünkü ' + g.gelirAdi : ad}: +${tutar}`,
      alt: 'Gelmediyse dokun', dugme: dugme('Gelmedi', 'yok') });
  }
  if (gd.neden === 'tatil') {
    return olaySatiri({ ikonAd: 'damla', renk: '#7C8798', baslik: `Tatil: ${g.gelirAdi} yok sayıldı`,
      alt: 'Aldıysan dokun', dugme: dugme('Aldım', 'var') });
  }
  return gd.var
    ? olaySatiri({ ikonAd: 'damla', renk: '#12B886', baslik: `${ad} geldi: +${tutar}`, alt: 'Tatil gününde aldın', dugme: dugme('Geri al', 'sil') })
    : olaySatiri({ ikonAd: 'damla', renk: '#7C8798', baslik: `${ad} gelmedi`, alt: 'Limit buna göre hesaplandı', dugme: dugme('Geri al', 'sil') });
}

// "Yattı / gelmedi" işareti (aylık ve haftalık gelirler, tarihi değişen ana gelir)
function gelisDugme(metin, kaynak, anahtar, deger) {
  return `<button class="dugme kucuk hafif" data-eylem="gelis-isaret" data-kaynak="${kaynak}" data-anahtar="${anahtar}" data-deger="${deger}">${metin}</button>`;
}

// Tarihi değişen gelir (burs gibi) aralığın içinde ve henüz yatmadı: "Yattı" denince o gün gelmiş sayılır
function bekleyenGelirSatiri(x, t) {
  return olaySatiri({ ikonAd: 'damla', renk: '#12B886', baslik: `${buyukHarf(esc(x.ad))} bu günlerde yatıyor`,
    alt: `+${para(x.tutar)} · en geç ${cumleTarihi(x.son)}`,
    dugme: gelisDugme(t === bugunStr() ? 'Yattı' : 'Bu gün yattı', x.kaynak, x.anahtar, t) });
}

// Burs, part-time, bayram harçlığı gibi ek gelirlerin bir gündeki satırı
function ekGelirSatiri(x, t) {
  const e = x.e, ad = esc(e.ad);
  if (e.tekrar === 'tek') return olaySatiri({ ikonAd: 'damla', renk: '#12B886', baslik: `${ad}: +${para(x.tutar)}`, alt: 'Bir kerelik gelir', eylem: 'ek-gelir-detay', id: e.id });
  const geri = gelisDugme('Geri al', e.id, x.anahtar, 'sil');
  if (x.durum === 'yok') return olaySatiri({ ikonAd: 'damla', renk: '#7C8798', baslik: `${ad} gelmedi`, alt: 'Limit buna göre hesaplandı', dugme: geri });
  if (x.durum === 'tahmini') return olaySatiri({ ikonAd: 'damla', renk: '#12B886', baslik: `${ad}: +${para(x.tutar)}`, alt: 'En geç bu gün yatar' });
  if (x.durum === 'geldi') return olaySatiri({ ikonAd: 'damla', renk: '#12B886', baslik: `${ad} yattı: +${para(x.tutar)}`, alt: 'Yattı olarak işaretledin', dugme: geri });
  const bolunmus = e.tekrar === 'aylik' && veri.profil.gelirDuzeni !== 'aylik';
  if (t > bugunStr()) return olaySatiri({ ikonAd: 'damla', renk: '#12B886', baslik: `${ad}: +${para(x.tutar)}`, alt: bolunmus ? 'Haftalara bölünerek bütçene eklenir' : 'Bütçene eklenecek' });
  return olaySatiri({ ikonAd: 'damla', renk: '#12B886', baslik: `${ad}: +${para(x.tutar)}`,
    alt: bolunmus ? 'Haftalara bölünerek bütçene eklendi' : 'Gelmediyse dokun', dugme: gelisDugme('Gelmedi', e.id, x.anahtar, 'yok') });
}

function kalkanKarti(g) {
  const k = g.kalkan;
  if (!k) return '';
  const durumS = k.oran >= 0.95 ? 'iyi' : k.oran >= 0.75 ? 'uyari' : 'kritik';
  const haftaSonu = k.gunAdlari.every(a => a === 'Cumartesi' || a === 'Pazar');
  return `<section class="kart kalkan-kart">
    <div class="kart-bas"><h2><span class="kalkan-ikon ${durumS}">${ikon('kalkan', 16)}</span>${haftaSonu ? 'Hafta sonu kalkanı' : 'Harçlıksız gün kalkanı'}</h2>
      <span class="durum-cip ${durumS}">${{ iyi: 'Sağlam', uyari: 'Azalıyor', kritik: 'Zayıf' }[durumS]}</span></div>
    <p class="aciklama-metni">${k.gunAdlari.join(' ve ')} ${g.gelirAdi} gelmiyor. Bu günlerin parası, ${g.gelirAdi} gelen günlerden ayrılıyor.</p>
    <div class="kalkan-izgara">
      <div><span>O günlerin limiti</span><b>${para(k.limit)}</b><small>normalde ${para(k.ideal)}</small></div>
      <div><span>Cebinde kalmalı</span><b>${para(k.ihtiyac)}</b><small>${k.gunler.length} gün için</small></div>
    </div>
    ${ilerleme(Math.min(1, k.oran), durumS)}
  </section>`;
}

// ---------- Takvim ----------

function gunOzeti(g, t, d) {
  const tk = g.takvim;
  const anaGelir = tk.gelirGunuMu(d);
  const ekler = tk.ekGelirleri(t, d);
  return {
    k: tk.gun(t),
    tatil: tk.tatil(t),
    anaGelir, ekler,
    gelir: anaGelir || ekler.some(x => x.durum !== 'yok'),
    ulasim: tk.ulasimDurumu(t, d),
    planlar: g.planlar.filter(p => p.tarih === t),
    odemeler: veri.sabitGiderler.filter(s => s.gun && Math.min(s.gun, ayGunSayisi(d)) === d.getDate()),
    borclar: borcOlaylari(veri.borclar, t, tk.bugunS),
    hedefler: veri.hedefler.filter(h => h.sonTarih === t)
  };
}

function takvimCiz(g) {
  const tk = g.takvim;
  const bugun = new Date();
  if (!durum.takvimAy) durum.takvimAy = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
  if (!durum.seciliGun) durum.seciliGun = tk.bugunS;
  const ay = durum.takvimAy;
  const y = ay.getFullYear(), m = ay.getMonth();
  const gunSayisi = ayGunSayisi(ay);
  const buAyMi = y === bugun.getFullYear() && m === bugun.getMonth();
  let ici = 0, asti = 0;

  const hucreler = [];
  for (let i = 0; i < (ay.getDay() + 6) % 7; i++) hucreler.push('<span class="tg-bos"></span>');
  for (let n = 1; n <= gunSayisi; n++) {
    const d = new Date(y, m, n), t = tarihStr(d);
    const o = gunOzeti(g, t, d);
    const siniflar = ['tg-gun'];
    if (t < tk.bugunS && o.k) {
      if (Math.round(o.k.serbest) > Math.round(o.k.limit)) { siniflar.push('asti'); asti++; }
      else { siniflar.push('ici'); ici++; }
    }
    if (t === tk.bugunS) siniflar.push('bugun');
    if (t > tk.bugunS) siniflar.push('gelecek');
    if (o.tatil) siniflar.push('tatil');
    if (t === durum.seciliGun) siniflar.push('secili');
    const isaretler = [
      o.gelir && t >= tk.baslangic ? '<i class="m-gelir"></i>' : '',
      o.ulasim === 'var' && t >= tk.baslangic ? '<i class="m-ulasim"></i>' : '',
      o.planlar.length ? '<i class="m-plan"></i>' : '',
      o.odemeler.length || o.hedefler.length || o.borclar.length ? '<i class="m-odeme"></i>' : ''
    ].join('');
    hucreler.push(`<button class="${siniflar.join(' ')}" data-eylem="gun-sec" data-tarih="${t}" aria-label="${uzunTarih(t)}">
      <span class="tg-no">${n}</span><span class="tg-isaretler">${isaretler}</span></button>`);
  }

  const ayAdi = ay.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  return `
  ${baslik('Takvim', {
    ust: ayAdi,
    sag: `<div class="ay-gezgin">
      ${buAyMi ? '' : '<button class="metin-dugme" data-eylem="takvim-bugun">Bugün</button>'}
      <button class="ikon-dugme" data-eylem="takvim-ay" data-yon="-1" aria-label="Önceki ay">${ikon('geri', 18)}</button>
      <button class="ikon-dugme" data-eylem="takvim-ay" data-yon="1" aria-label="Sonraki ay">${ikon('ileri', 18)}</button>
    </div>`
  })}

  <section class="kart takvim-kart">
    <div class="tg-basliklar">${HAFTA_SIRASI.map(x => `<span>${GUN_KISA[x]}</span>`).join('')}</div>
    <div class="takvim-izgara ${durum.takvimYon ? 'ay-' + durum.takvimYon : ''}">${hucreler.join('')}</div>
    <div class="tg-lejant">
      <span><i class="m-gelir"></i>${veri.ekGelirler.length ? 'Gelir' : buyukHarf(g.gelirAdi)}</span>
      <span><i class="m-ulasim"></i>Ulaşım</span>
      <span><i class="m-plan"></i>Plan</span>
      <span><i class="m-odeme"></i>Ödeme / hedef</span>
    </div>
  </section>

  ${ici + asti ? `<div class="cip-satiri">
    <span class="cip"><i class="nokta yesil"></i>${ici} gün limit içinde</span>
    <span class="cip"><i class="nokta kirmizi"></i>${asti} gün aşıldı</span>
  </div>` : ''}

  ${gunDetayi(g, durum.seciliGun)}
  ${yaklasanlar(g)}`;
}

function gunDetayi(g, t) {
  const tk = g.takvim;
  const d = tarihCoz(t);
  const o = gunOzeti(g, t, d);
  const bugun = t === tk.bugunS, gecmis = t < tk.bugunS;
  const harcamalar = veri.harcamalar.filter(h => h.tarih === t).sort((a, b) => (b.saat || '').localeCompare(a.saat || ''));
  const parcalar = [];

  if (o.k) {
    const astiMi = Math.round(o.k.serbest) > Math.round(o.k.limit);
    if (gecmis || bugun) {
      parcalar.push(`<div class="gd-limit">
        <div><span>Limit</span><b>${para(o.k.limit)}</b></div>
        <div><span>Harcanan</span><b>${para(o.k.serbest)}</b></div>
        <div><span>${bugun ? 'Kalan' : 'Durum'}</span><b class="${astiMi ? 'kirmizi' : 'yesil'}">${bugun ? para(o.k.limit - o.k.serbest) : astiMi ? 'Aşıldı' : 'İçinde'}</b></div>
      </div>`);
    } else {
      parcalar.push(`<div class="gd-limit tek"><div><span>Tahmini limit</span><b>${para(o.k.limit)}</b><small>Bugüne kadarki harcamalarına göre</small></div></div>`);
    }
  } else if (gecmis) {
    parcalar.push('<p class="aciklama-metni">Bu gün Damly\'yi kullanmaya başlamadan önceydi.</p>');
  }

  const olaylar = [];
  if (o.tatil) olaylar.push(olaySatiri({ ikonAd: 'gunes', renk: '#F59F00', baslik: esc(o.tatil.ad), alt: { resmi: 'Resmî tatil', okul: 'Okul tatili', kisisel: 'İzinli / tatil olarak işaretledin' }[o.tatil.tur] }));
  // Tarihi değişen gelirlerde geçmiş ya da bugünkü bir gün için "Bu gün yattı" denebilir
  const bekleyen = t <= tk.bugunS ? tk.bekleyenGelirler(t, d) : [];
  const bekleyenAnahtar = new Set(bekleyen.map(x => `${x.kaynak}|${x.anahtar}`));
  const gd = tk.gelirDurumu(t, d);
  if (gd && t >= tk.baslangic && !bekleyenAnahtar.has(`ana|${t.slice(0, 7)}`)) {
    const isaretli = veri.gelirKayit[`ana|${t.slice(0, 7)}`] === t;
    const ek = !g.gelirDegisken ? '' : isaretli ? ' · yattı' : t > tk.bugunS ? ' · en geç bu gün' : '';
    olaylar.push(g.duzen === 'gunluk' ? gelirSatiri(g, t, gd, false)
      : olaySatiri({ ikonAd: 'damla', renk: '#12B886', baslik: `${buyukHarf(g.gelirAdi)} günü`, alt: `+${para(veri.profil.gelirTutari)}${ek}`,
          dugme: isaretli ? gelisDugme('Geri al', 'ana', t.slice(0, 7), 'sil') : '' }));
  }
  bekleyen.forEach(x => olaylar.push(bekleyenGelirSatiri(x, t)));
  o.ekler.filter(x => !bekleyenAnahtar.has(`${x.e.id}|${x.anahtar}`)).forEach(x => olaylar.push(ekGelirSatiri(x, t)));
  if (o.ulasim === 'var') {
    olaylar.push(olaySatiri({ ikonAd: 'otobus', renk: '#4C6EF5', baslik: 'Ulaşım', alt: `${para(g.ulasimGunluk)} ayrıldı`,
      dugme: `<button class="dugme kucuk hafif" data-eylem="ulasim-atla" data-tarih="${t}">O gün yok</button>` }));
  } else if (o.ulasim === 'atlandi') {
    olaylar.push(olaySatiri({ ikonAd: 'otobus', renk: '#7C8798', baslik: 'Ulaşım yok', alt: `${para(g.ulasimGunluk)} serbest kaldı`,
      dugme: `<button class="dugme kucuk hafif" data-eylem="ulasim-atla" data-tarih="${t}">Geri al</button>` }));
  } else if (o.ulasim === 'tatil') {
    olaylar.push(olaySatiri({ ikonAd: 'otobus', renk: '#7C8798', baslik: 'Ulaşım payı ayrılmadı', alt: 'Tatil günü' }));
  }
  o.odemeler.forEach(s => { const k = sabitKategori(s.kategori); olaylar.push(olaySatiri({ ikonAd: k.ikon, renk: k.renk, baslik: esc(s.ad), alt: `Düzenli ödeme · ${para(s.tutar)}` })); });
  o.borclar.forEach(x => olaylar.push(borcOlaySatiri({ ...x, tarih: t }, tk.bugunS)));
  o.hedefler.forEach(h => olaylar.push(olaySatiri({ ikonAd: 'hedef', renk: '#AE3EC9', baslik: `${esc(h.emoji || '🎯')} ${esc(h.ad)}`, alt: 'Hedefin son günü' })));
  o.planlar.forEach(p => {
    const k = kategori(p.kategori);
    const durumM = { bekliyor: `${para(p.tutar)} ayrıldı`, harcandi: `Harcandı · ${para(p.ayrilan)}`, gecti: 'Harcama kaydedilmedi' }[p.durum];
    olaylar.push(olaySatiri({ ikonAd: k.ikon, renk: k.renk, baslik: `Plan: ${esc(p.ad)}`, alt: durumM, eylem: 'plan-detay', id: p.id }));
  });
  if (olaylar.length) parcalar.push(`<div class="olay-listesi ic">${olaylar.join('')}</div>`);
  if (harcamalar.length) parcalar.push(`<div class="liste">${harcamalar.map(harcamaSatiri).join('')}</div>`);

  const dugmeler = [];
  if (t >= tk.bugunS) dugmeler.push(`<button class="dugme ana kucuk" data-eylem="plan-yeni" data-tarih="${t}">${ikon('arti', 16)} Plan ekle</button>`);
  dugmeler.push(`<button class="dugme kucuk hafif" data-eylem="ek-gelir-yeni" data-tarih="${t}">${ikon('damla', 16)} Gelir ekle</button>`);
  if (!o.tatil || o.tatil.tur === 'kisisel') {
    dugmeler.push(`<button class="dugme kucuk hafif" data-eylem="tatil-isaretle" data-tarih="${t}">${ikon('gunes', 16)} ${o.tatil ? 'İzinli gün değil' : 'İzinli gün yap'}</button>`);
  }

  return `<section class="kart gun-detay">
    <div class="kart-bas"><h2>${uzunTarih(t)}</h2>${bugun ? '<span class="durum-cip iyi">Bugün</span>' : ''}</div>
    ${parcalar.join('')}
    ${dugmeler.length ? `<div class="gd-dugmeler">${dugmeler.join('')}</div>` : ''}
  </section>`;
}

function yaklasanlar(g) {
  const tk = g.takvim;
  const bugun = gunBasi(new Date());
  const ogeler = [];
  let gelirEklendi = false;
  const ekGorulen = new Set();
  for (let i = 1; i <= 21 && ogeler.length < 6; i++) {
    const d = gunEkle(bugun, i), t = tarihStr(d);
    const o = gunOzeti(g, t, d);
    const tarih = tarihGoster(t);
    if (o.anaGelir && !gelirEklendi) { gelirEklendi = true; ogeler.push({ t, ikonAd: 'damla', renk: '#12B886', b: `${buyukHarf(g.gelirAdi)} günü`, a: `${g.gelirDegisken ? 'En geç ' + cumleTarihi(t) : tarih} · +${para(veri.profil.gelirTutari)}` }); }
    o.ekler.filter(x => x.durum !== 'yok' && !ekGorulen.has(x.e.id)).forEach(x => {
      ekGorulen.add(x.e.id);
      ogeler.push({ t, ikonAd: 'damla', renk: '#12B886', b: esc(x.e.ad), a: `${x.durum === 'tahmini' ? 'En geç ' + cumleTarihi(t) : tarih} · +${para(x.tutar)}` });
    });
    o.planlar.filter(p => p.durum === 'bekliyor').forEach(p => { const k = kategori(p.kategori); ogeler.push({ t, ikonAd: k.ikon, renk: k.renk, b: esc(p.ad), a: `${tarih} · ${para(p.tutar)}` }); });
    if (o.tatil && o.tatil.tur !== 'kisisel' && !(i > 1 && tk.tatil(tarihStr(gunEkle(d, -1))))) ogeler.push({ t, ikonAd: 'gunes', renk: '#F59F00', b: esc(o.tatil.ad), a: tarih });
    o.odemeler.forEach(s => { const k = sabitKategori(s.kategori); ogeler.push({ t, ikonAd: k.ikon, renk: k.renk, b: esc(s.ad), a: `${tarih} · ${para(s.tutar)}` }); });
    o.borclar.filter(x => x.durum === 'bekliyor').forEach(x => { const k = BORC_TURLERI[x.b.tur]; ogeler.push({ t, ikonAd: k.ikon, renk: k.renk, b: esc(borcAdi(x.b)), a: `${tarih} · ${para(x.tutar)}` }); });
  }
  if (!ogeler.length) return '';
  return `<div class="bolum-bas"><h2>Yaklaşanlar</h2><span>3 hafta</span></div>
  <div class="grup">${ogeler.slice(0, 6).map(x => `<button class="grup-satir" data-eylem="gun-sec" data-tarih="${x.t}">
    <span class="kat-ikon" style="--renk:${x.renk}">${ikon(x.ikonAd, 18)}</span>
    <span class="satir-orta"><b>${x.b}</b><small>${x.a}</small></span>${ikon('ileri', 18, 'grup-ok')}
  </button>`).join('')}</div>`;
}

// ---------- Bütçe ----------

function butceCiz(g) {
  const parcalar = butceParcalari(g);
  const hizOrani = g.harcanabilirDonem > 0 ? g.serbestHarcanan / g.harcanabilirDonem : (g.serbestHarcanan > 0 ? 1 : 0);
  const hizDurum = hizOrani > 1 ? 'kritik' : hizOrani > g.donemOrani + 0.1 ? 'uyari' : 'iyi';
  const ihtiyacPay = g.harcanan ? g.ihtiyacToplam / g.harcanan : 0;
  const formul = [para(g.donemGeliri)]
    .concat(parcalar.filter(x => !x.hep).map(x => para(x.tutar)))
    .join(' − ') + ` = ${para(g.harcanabilirDonem)}`;

  return `
  ${baslik('Bütçe', { ust: `${donemBasligi(g)} · ${donemAraligi(g.donem)}`, geri: true })}

  <section class="kart">
    <span class="kart-etiket">${g.donem.ilk ? 'Bu dönemin parası' : `Dönemin geliri · ${duzenOzeti(veri.profil)}`}</span>
    <strong class="buyuk-tutar">${para(g.donemGeliri)}</strong>
    ${g.donemEkGelir >= 1 ? `<p class="aciklama-metni">${buyukHarf(g.gelirAdi)} ${para(g.donemAnaGelir)} + ${g.ekKalemler.map(x => `${esc(x.ad)} ${para(x.tutar)}`).join(' + ')}</p>` : ''}
    ${dagilimCubugu(g, parcalar)}
    <div class="dagilim-lejant">${parcalar.map(x => `<div><i style="background:${x.renk}"></i><span>${x.ad}</span><b>${para(x.tutar)}</b></div>`).join('')}</div>
    <div class="formul">${ikon('bilgi', 16)}<span>Günlük limitin bu tutara göre hesaplanır:<br><b>${formul}</b></span></div>
  </section>

  <section class="kart">
    <div class="kart-bas"><h2>Harcama hızı</h2><span class="durum-cip ${hizDurum}">${{ iyi: 'Yolunda', uyari: 'Hızlı', kritik: 'Aşıldı' }[hizDurum]}</span></div>
    <div class="hiz-satir"><span>${para(g.serbestHarcanan)} <small>harcandı</small></span><span><small>/</small> ${para(g.harcanabilirDonem)}</span></div>
    ${ilerleme(hizOrani, hizDurum, g.donemOrani, 'bugün')}
    <p class="aciklama-metni">Dönemin ${yuzde(g.donemOrani)} kadarı geçti, bütçenin ${yuzde(hizOrani)} kadarı kullanıldı.</p>
  </section>

  <section class="kart">
    <div class="kart-bas"><h2>Son 7 gün</h2><span class="kart-ek">${para(g.haftaToplam)}</span></div>
    ${haftaGrafik(g)}
  </section>

  ${kalkanKarti(g)}

  <section class="kart">
    <div class="kart-bas"><h2>Kategoriler</h2></div>
    ${kategoriHalkasi(g)}
  </section>

  <section class="kart">
    <div class="kart-bas"><h2>İhtiyaç mı, istek mi?</h2></div>
    <div class="ikili-cubuk"><i class="ihtiyac" style="width:${ihtiyacPay * 100}%"></i><i class="istek" style="width:${g.harcanan ? (1 - ihtiyacPay) * 100 : 0}%"></i></div>
    <div class="ikili-lejant">
      <div><i class="ihtiyac"></i><span>İhtiyaç</span><b>${para(g.ihtiyacToplam)}</b></div>
      <div><i class="istek"></i><span>İstek</span><b>${para(g.istekToplam)}</b></div>
    </div>
    <p class="aciklama-metni">İstek / gelir oranı <b>${yuzde(g.istekOrani)}</b>. ${g.profilAdi} profili için önerilen sınır ${yuzde(g.esik.istekOrani)} (50/30/20 kuralı).</p>
  </section>

  <div class="grup">
    ${grupSatiri({ ikonAd: 'kart', renk: '#4C6EF5', baslik: 'Düzenli ödemeler', alt: `${veri.sabitGiderler.length} kalem`, deger: para(g.sabitToplam) + '/ay', eylem: 'alt', ekran: 'sabit' })}
    ${grupSatiri({ ikonAd: 'liste', renk: '#12B886', baslik: 'Harcama geçmişi', alt: `${veri.harcamalar.length} kayıt`, eylem: 'alt', ekran: 'gecmis' })}
    ${grupSatiri({ ikonAd: 'damla', renk: '#1C9AD6', baslik: 'Gelir düzeni', alt: duzenOzeti(veri.profil), eylem: 'gelir-duzen' })}
    ${digerGelirSatiri(g)}
    ${borcSatiri(g)}
    ${grupSatiri({ ikonAd: 'otobus', renk: '#AE3EC9', baslik: 'Ulaşım', alt: ulasimOzeti(veri.ulasim), eylem: 'ulasim-duzen' })}
  </div>`;
}

// Bütçe ve Profil'deki "Diğer gelirler" satırı → Gelirler ekranı
function digerGelirSatiri(g) {
  const duzenli = veri.ekGelirler.filter(e => e.tekrar !== 'tek');
  const alt = duzenli.length ? duzenli.map(e => esc(e.ad)).join(', ')
    : veri.ekGelirler.length ? 'Bir kerelik gelirler' : 'Burs, part-time iş, bayram harçlığı…';
  return grupSatiri({ ikonAd: 'cuzdan', renk: '#12B886', baslik: 'Diğer gelirler', alt, deger: g.ekGelirAylik >= 1 ? `+${para(g.ekGelirAylik)}/ay` : '', eylem: 'alt', ekran: 'gelirler' });
}

// ---------- Gelirler (ana gelir + burs, part-time, bir kerelik gelirler) ----------

function gelirlerCiz(g) {
  const duzenli = veri.ekGelirler.filter(e => e.tekrar !== 'tek');
  const tekler = veri.ekGelirler.filter(e => e.tekrar === 'tek').sort((a, b) => b.tarih.localeCompare(a.tarih));
  const satir = e => grupSatiri({ ikonAd: 'damla', renk: '#12B886', baslik: esc(e.ad), alt: ekGelirOzeti(e), eylem: 'ek-gelir-detay', id: e.id, deger: '+' + para(e.tutar) });
  return `
  ${baslik('Gelirlerin', { geri: true })}
  <section class="kart">
    <span class="kart-etiket">Düzenli gelirin</span>
    <strong class="buyuk-tutar">${para(g.gelir)}<small> / ay</small></strong>
    <p class="aciklama-metni">${g.ekGelirAylik >= 1 ? `${buyukHarf(g.gelirAdi)} ${para(g.gelir - g.ekGelirAylik)} + diğer gelirlerin ${para(g.ekGelirAylik)} (yaklaşık). ` : ''}Bir kerelik gelirler bu toplama girmez; geldikleri ${g.donemAdi === 'ay' ? 'ayın' : 'haftanın'} bütçesine eklenir.</p>
  </section>
  <div class="bolum-bas"><h2>Ana gelir</h2></div>
  <div class="grup">${grupSatiri({ ikonAd: 'cuzdan', renk: '#1C9AD6', baslik: buyukHarf(g.gelirAdi), alt: duzenOzeti(veri.profil), eylem: 'gelir-duzen' })}</div>
  <div class="bolum-bas"><h2>Düzenli gelirler</h2></div>
  <div class="grup">${duzenli.length ? duzenli.map(satir).join('') : '<div class="grup-bos">Burs, part-time iş gibi düzenli bir gelirin yok.</div>'}</div>
  ${tekler.length ? `<div class="bolum-bas"><h2>Bir kerelik</h2><span>${tekler.length}</span></div><div class="grup">${tekler.map(satir).join('')}</div>` : ''}
  <button class="dugme ana genis" data-eylem="ek-gelir-yeni">${ikon('arti', 20)} Gelir ekle</button>`;
}

function sabitCiz(g) {
  const yuksek = g.sabitOrani > g.esik.sabitOrani;
  return `
  ${baslik('Düzenli ödemeler', { geri: true })}
  <section class="kart">
    <span class="kart-etiket">Her ay düzenli ödediklerin</span>
    <strong class="buyuk-tutar">${para(g.sabitToplam)}<small> / ay</small></strong>
    ${ilerleme(g.sabitOrani, yuksek ? 'kritik' : 'iyi', g.esik.sabitOrani, 'sınır ' + yuzde(g.esik.sabitOrani))}
    <p class="aciklama-metni">Gelirinin ${yuzde(g.sabitOrani)} kadarı · yılda ${para(g.sabitToplam * 12)}. ${g.donemAdi === 'hafta' ? `Haftalık payı (${para(g.sabitPayi)}) ` : 'Bu tutar '}gelirinden düşülerek günlük limitin hesaplanır.</p>
  </section>
  <div class="grup">
    ${veri.sabitGiderler.length
      ? veri.sabitGiderler.map(s => {
          const k = sabitKategori(s.kategori);
          return grupSatiri({ ikonAd: k.ikon, renk: k.renk, baslik: esc(s.ad), alt: k.ad + (s.gun ? ` · ayın ${s.gun}. günü` : ''), eylem: 'sabit-detay', id: s.id, deger: para(s.tutar) });
        }).join('')
      : '<div class="grup-bos">Henüz düzenli ödeme eklemedin.</div>'}
  </div>
  <button class="dugme ana genis" data-eylem="sabit-yeni">${ikon('arti', 20)} Düzenli ödeme ekle</button>`;
}

function gecmisCiz(g) {
  const tk = g.takvim;
  const gunler = {};
  veri.harcamalar.forEach(h => { (gunler[h.tarih] = gunler[h.tarih] || []).push(h); });
  const tarihler = Object.keys(gunler).sort().reverse();

  return `
  ${baslik('Harcama geçmişi', { geri: true })}
  ${tarihler.length ? tarihler.map(t => {
    const liste = gunler[t].sort((a, b) => (b.saat || '').localeCompare(a.saat || ''));
    const top = toplam(liste);
    const k = tk.gun(t);
    const asti = k && Math.round(k.serbest) > Math.round(k.limit);
    return `<section class="gun-grubu">
      <div class="gun-bas"><b>${tarihGoster(t)}</b>
        <span>${k && t <= tk.bugunS ? `<i class="limit-cip ${asti ? 'asti' : ''}">${asti ? 'Limit aşıldı' : 'Limit içinde'}</i>` : ''}${para(top)}</span>
      </div>
      <div class="kart liste">${liste.map(harcamaSatiri).join('')}</div>
    </section>`;
  }).join('') : bosDurum('Henüz harcama yok', 'İlk harcamanı alttaki + düğmesiyle ekleyebilirsin.')}`;
}

// ---------- Kumbara ----------

function kumbaraCiz(g) {
  const hedefBiriken = g.hedefler.reduce((t, h) => t + Number(h.biriken), 0);
  const toplamBiriken = hedefBiriken + (veri.birikim.biriken || 0);
  const toplamHedef = g.hedefler.reduce((t, h) => t + Number(h.hedefTutar), 0);
  const oran = toplamHedef ? hedefBiriken / toplamHedef : 0;
  const ayrilan = g.birikimPayi + g.yuvarlamaBirikim;

  return `
  ${baslik('Kumbara', { ust: 'Damlaya damlaya göl olur' })}
  <section class="kumbara-hero">
    ${damlaDolum(oran)}
    <div class="kh-metin">
      <span>Toplam birikim</span>
      <strong>${para(toplamBiriken)}</strong>
      <small>${toplamHedef ? `Hedeflerinin ${yuzde(oran)} kadarı tamam` : 'Henüz hedef yok'}</small>
    </div>
  </section>
  ${ayrilan >= 1 ? `<div class="bilgi-serit">${ikon('dongu', 18)}<span>${buyukHarf(g.donemMetni)} kumbaran için <b>${para(ayrilan)}</b> ayrıldı. ${g.donemAdi === 'ay' ? 'Ay' : 'Hafta'} bitince kendiliğinden kumbarana aktarılır.</span></div>` : ''}
  <div class="bolum-bas"><h2>Hedeflerin</h2><span>${g.hedefler.length + 1}</span></div>
  <div class="hedef-listesi">
    ${duzenliBirikimKarti(g)}
    ${g.hedefler.map(hedefKarti).join('')}
    <button class="yeni-hedef" data-eylem="hedef-yeni">${ikon('arti', 20)}<span>Yeni hedef oluştur</span></button>
  </div>
  ${beklemeBolumu(g)}`;
}

// Gelirin yüzdesiyle ve limit yuvarlamasıyla dolan, son tarihi olmayan birikim
function duzenliBirikimKarti(g) {
  const y = g.birikimYuzdesi;
  return `<button class="hedef-kart" data-eylem="duzenli-birikim">
    <span class="hedef-emoji duzenli">${ikon('damla', 24)}</span>
    <span class="hedef-orta">
      <span class="hedef-ust"><b>Düzenli birikim</b><span>${y ? '%' + y : 'Kapalı'}</span></span>
      <small>${para(veri.birikim.biriken)} birikti · ${y ? `her ${g.donemAdi} ${para(g.duzenliPay)}` : 'açmak için dokun'}</small>
    </span>
  </button>`;
}

function hedefKarti(h) {
  const oran = h.hedefTutar ? h.biriken / h.hedefTutar : 0;
  const alt = h.tamamlandi ? 'Tamamlandı' : h.gecikti ? 'Süre doldu' : `ayda ${para(h.aylikGereken)} · ${h.kalanAy} ay`;
  return `<button class="hedef-kart ${h.tamamlandi ? 'tamam' : ''}" data-eylem="hedef-detay" data-id="${h.id}">
    <span class="hedef-emoji">${esc(h.emoji || (h.acil ? '🛟' : '🎯'))}</span>
    <span class="hedef-orta">
      <span class="hedef-ust"><b>${esc(h.ad)}</b><span>${yuzde(oran)}</span></span>
      <span class="ince-cubuk"><i style="width:${Math.min(1, oran) * 100}%"></i></span>
      <small>${para(h.biriken)} / ${para(h.hedefTutar)} · ${alt}</small>
    </span>
  </button>`;
}

// ---------- Asistan (uzman sistem + açıklama modülü) ----------

// Önerinin düzeyi ikonun renginden anlaşılır; kural kodu ve düzey adı gerekçede yazar
function oneriKart(o, sinif = '') {
  const acik = acikNedenler.has(o.kural.id);
  return `<article class="oneri ${o.seviye} ${sinif}">
    <div class="oneri-ust">
      <span class="oneri-ikon" aria-label="${SEVIYELER[o.seviye].ad}">${ikon(SEVIYE_IKON[o.seviye], 16)}</span>
      <h3>${o.baslik}</h3>
    </div>
    <p>${o.mesaj}</p>
    <button class="neden-dugme" data-eylem="neden" data-id="${o.kural.id}" aria-expanded="${acik}">${acik ? 'Gerekçeyi gizle' : 'Neden bu öneri?'} ${ikon('asagi', 16)}</button>
    ${acik ? `<div class="neden">
      <span class="neden-kural">Kural ${o.kural.id} (${SEVIYELER[o.seviye].ad})</span>
      <div>${o.neden}</div>
      <code class="kural-mantik"><span>EĞER</span> ${esc(o.kural.eger)}<br><span>İSE</span> ${esc(o.kural.ise)}</code>
      <div class="kaynak">${ikon('kitap', 13)} ${esc(o.kural.kaynak)}</div>
    </div>` : ''}
  </article>`;
}

function asistanCiz(g, sonuc) {
  const [ilk, ...digerleri] = sonuc.oneriler;
  const dolum = maskotDolum(g);
  return `
  ${baslik('Asistan', { ust: 'Kural tabanlı uzman sistem' })}
  <section class="maskot-sahne">
    <div class="maskot-bas">
      ${maskot({ ruh: ilk ? SEVIYE_RUH[ilk.seviye] : 'uykulu', boyut: 92, dolum })}
      <small>${ikon('damla', 14)} ${g.hedefler.length ? `İçimdeki su kumbarandaki birikimi gösterir: <b>%${Math.round(dolum * 100)}</b>` : 'Kumbarana hedef ekledikçe içim dolar'}</small>
    </div>
    ${ilk ? oneriKart(ilk, 'konusma') : '<div class="oneri konusma"><p>Şimdilik söyleyecek bir şeyim yok. Harcama ekledikçe seni izlemeye başlarım.</p></div>'}
  </section>
  ${grupSatiri({ ikonAd: 'cip', renk: 'var(--marka)', baslik: 'Nasıl karar veriyorum?', alt: `${KURALLAR.length} kuraldan ${sonuc.tetiklenen.size} tanesi, ${sonuc.tur} turda tetiklendi`, eylem: 'alt', ekran: 'nasil', sinif: 'tek' })}
  <div class="oneri-listesi">${digerleri.map(o => oneriKart(o)).join('')}</div>`;
}

function nasilCiz(g, sonuc) {
  const tetik = sonuc.tetiklenen;
  const cikarilanlar = Object.keys(sonuc.bellek).filter(k => !(k in g));
  const bellek = [
    ['Profil', profilEtiketi(veri.profil)],
    ['Gelir düzeni', GELIR_DUZENLERI[g.duzen].ad],
    ['Dönem geliri', para(g.donemGeliri)],
    ...(g.donemEkGelir >= 1 ? [['Diğer gelirler (bu dönem)', para(g.donemEkGelir)]] : []),
    ...(g.borcAylik >= 1 ? [['Borç ödemesi / gelir', yuzde(g.borcOrani)]] : []),
    ['Sabit gider oranı', yuzde(g.sabitOrani)],
    ['Ulaşım payı', para(g.ulasimPayi)],
    ['Planlı harcamalar', para(g.planPayi)],
    ['Kumbara payı', para(g.birikimPayi)],
    ['Bugünkü limit', para(g.gunlukLimit)],
    ['Bugün harcanan', para(g.bugunHarcanan)],
    ['Dönemde harcanan', para(g.harcanan)],
    ['Günlük ortalama', para(g.gunlukOrtalama)],
    ['Tahmini dönem sonu', para(g.tahminiDonemSonu)],
    ['İstek / gelir', yuzde(g.istekOrani)],
    ['Limit serisi', g.seri + ' gün']
  ];
  const mimari = [
    ['veri', 'Kullanıcı verileri', 'gelir düzeni, harcamalar, hedefler, takvim'],
    ['beyin', 'Çalışma belleği', 'verilerden hesaplanan gerçekler'],
    ['cip', 'Çıkarım motoru', `ileri zincirleme · ${KURALLAR.length} kurallık bilgi tabanı`],
    ['ampul', 'Öneriler + açıklama', 'her önerinin gerekçesi ve kaynağı']
  ];

  return `
  ${baslik('Nasıl karar veriyorum?', { geri: true })}
  <p class="giris-metni">Damly Asistan bir <b>kural tabanlı uzman sistemdir</b>. Verilerinden hesapladığı gerçeklere, finansal okuryazarlık ilkelerinden oluşturulmuş ${KURALLAR.length} kuralı <b>ileri zincirleme</b> yöntemiyle uygular. Bir kuralın sonucu başka bir kuralı tetikleyebilir.</p>

  <div class="bolum-bas"><h2>Mimari</h2></div>
  <section class="kart mimari">
    ${mimari.map(([ik, b, a], i) => `${i ? `<span class="mimari-ok">${ikon('asagiOk', 18)}</span>` : ''}
      <div class="mimari-adim ${i === 2 ? 'vurgu' : ''}">
        <span class="kat-ikon" style="--renk:var(--marka)">${ikon(ik, 18)}</span>
        <span class="satir-orta"><b>${b}</b><small>${a}</small></span>
      </div>`).join('')}
  </section>

  <div class="bolum-bas"><h2>Çalışma belleği</h2></div>
  <section class="kart">
    <div class="bellek">${bellek.map(([e, d]) => `<div><span>${e}</span><b>${d}</b></div>`).join('')}</div>
    <span class="kart-etiket">Kuralların çıkardığı yeni gerçekler</span>
    <div class="cip-satiri">${cikarilanlar.map(k => `<code class="gercek">${k} = doğru</code>`).join('') || '<span class="aciklama-metni">Yok</span>'}</div>
  </section>

  <div class="bolum-bas"><h2>Çıkarım adımları</h2></div>
  <section class="kart">
    <ol class="zaman-cizelgesi">
      ${sonuc.adimlar.map(a => `<li><span class="zc-tur">Tur ${a.tur}</span><div><b>${a.kuralId}</b> ${esc(a.kuralAd)}
        ${a.eklenen.length ? `<div class="zc-ek">belleğe eklendi: ${a.eklenen.map(x => `<code class="gercek">${x}</code>`).join(' ')}</div>` : ''}</div></li>`).join('')}
      <li class="son"><span class="zc-tur">Son</span><div>Yeni gerçek eklenmedi, çıkarım tamamlandı.</div></li>
    </ol>
  </section>

  <div class="bolum-bas"><h2>Bilgi tabanı</h2><span>${KURALLAR.length} kural</span></div>
  <div class="kural-listesi">
    ${KURALLAR.map(k => `<div class="kural ${tetik.has(k.id) ? 'aktif' : ''}">
      <div class="kural-ust"><span class="kural-id">${k.id}</span><b>${esc(k.ad)}</b>
        <span class="kural-durum">${tetik.has(k.id) ? ikon('onay', 14) + ' tetiklendi' : 'beklemede'}</span></div>
      <code class="kural-mantik"><span>EĞER</span> ${esc(k.eger)}<br><span>İSE</span> ${esc(k.ise)}</code>
    </div>`).join('')}
  </div>`;
}

// ---------- Profil ----------

function profilCiz(g) {
  const p = veri.profil, e = g.esik;
  return `
  ${baslik('Profil', { geri: true })}
  <section class="profil-ust">
    <span class="avatar buyuk">${esc(basHarf(p.ad))}</span>
    <b>${esc(p.ad)}</b><span>${profilEtiketi(p)} · ${duzenOzeti(p)}</span>
  </section>

  <div class="bolum-bas"><h2>Bilgilerin</h2></div>
  <section class="kart form">
    <label class="alan"><span>Adın</span><input id="p-ad" maxlength="30" value="${esc(p.ad)}"></label>
    <div class="alan"><span>Okulun</span>${okulSecimi(p.okul, 'profilOkul')}</div>
    <button class="dugme ana" data-eylem="profil-kaydet">Kaydet</button>
  </section>

  <div class="bolum-bas"><h2>Gelir ve takvim</h2></div>
  <div class="grup">
    ${grupSatiri({ ikonAd: 'damla', renk: '#12B886', baslik: 'Gelir düzeni', alt: duzenOzeti(p), eylem: 'gelir-duzen' })}
    ${digerGelirSatiri(g)}
    ${borcSatiri(g)}
    ${grupSatiri({ ikonAd: 'otobus', renk: '#4C6EF5', baslik: 'Ulaşım', alt: ulasimOzeti(veri.ulasim), eylem: 'ulasim-duzen' })}
    ${grupSatiri({ ikonAd: 'kart', renk: '#4C6EF5', baslik: 'Düzenli ödemeler', alt: `${veri.sabitGiderler.length} kalem`, deger: para(g.sabitToplam) + '/ay', eylem: 'alt', ekran: 'sabit' })}
    ${grupSatiri({ ikonAd: 'damla', renk: 'var(--marka)', baslik: 'Düzenli birikim', alt: g.birikimYuzdesi ? `Gelirinin %${g.birikimYuzdesi} kadarı` : 'Kapalı', eylem: 'duzenli-birikim' })}
  </div>

  <div class="bolum-bas"><h2>Bildirimler</h2></div>
  <div class="grup">${hatirlatmaSatiri()}</div>

  <div class="bolum-bas"><h2>Görünüm</h2></div>
  <section class="kart form">
    <div class="alan"><span>Görünüm modu</span>${modSecimi()}</div>
  </section>

  <div class="bolum-bas"><h2>Yardım</h2></div>
  <div class="grup">
    ${grupSatiri({ ikonAd: 'yildiz', renk: 'var(--marka)', baslik: 'Rehberli turu başlat', alt: 'Uygulamayı adım adım tanı', eylem: 'tur-baslat' })}
    ${GERI_BILDIRIM_URL ? grupSatiri({ ikonAd: 'telefon', renk: '#FF8A3D', baslik: 'Geri bildirim gönder', alt: 'Test sürecinde görüşlerin çok değerli', eylem: 'geri-bildirim' }) : ''}
  </div>

  <div class="bolum-bas"><h2>Asistanın sınırları</h2><span>${g.profilAdi}</span></div>
  <div class="grup">
    ${bilgiSatiri('Sabit gider sınırı', yuzde(e.sabitOrani))}
    ${bilgiSatiri('İstek harcaması sınırı', yuzde(e.istekOrani))}
    ${bilgiSatiri('Birikim hedefi', yuzde(e.birikimOrani))}
    ${bilgiSatiri('Acil durum fonu', e.acilDurumAy + ' aylık gider')}
    ${bilgiSatiri('Küçük harcama', '≤ ' + para(e.kucukHarcama))}
    ${bilgiSatiri('Borç ödemesi sınırı', yuzde(e.borcOrani) + ' (20/10 kuralı)')}
  </div>

  <div class="bolum-bas"><h2>Veriler</h2></div>
  <div class="grup">
    ${grupSatiri({ ikonAd: 'cop', renk: '#E03131', baslik: durum.sifirlaOnay ? 'Emin misin? Tekrar dokun' : 'Tüm verileri sil', alt: 'Bu işlem geri alınamaz', eylem: 'sifirla', ok: false, sinif: 'tehlikeli' })}
  </div>

  <footer class="hakkinda">
    <div class="hakkinda-logo">${damlaLogo(30)}<span class="yazi-logo">Damly</span></div>
    <span>Sürüm ${SURUM} · TÜBİTAK 2204 projesi</span>
    <span>${ikon('kilit', 13)} Verilerin yalnızca bu cihazda saklanır</span>
  </footer>`;
}

// ---------- Tuş takımı ----------

function tutarGostergesi(ipucu = '', sinif = '') {
  return `<div class="tutar-gosterge ${durum.tus ? '' : 'bos'} ${sinif}">
    <span class="tg-tl">₺</span><span id="tutar-yazi">${durum.tus ? tusBicim(durum.tus) : '0'}</span>
  </div>
  <div id="tutar-ipucu" class="tutar-ipucu">${ipucu}</div>`;
}

function tusTakimi() {
  const tuslar = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'sil'];
  return `<div class="tus-takimi">${tuslar.map(t =>
    `<button class="tus" data-eylem="tus" data-tus="${t}" aria-label="${t === 'sil' ? 'Sil' : t}">${t === 'sil' ? ikon('silTus', 22) : t}</button>`).join('')}</div>`;
}

function tusBas(t) {
  let s = durum.tus;
  if (t === 'sil') s = s.slice(0, -1);
  else if (t === ',') { if (!s.includes(',')) s = (s || '0') + ','; }
  else {
    if (s.includes(',') && s.split(',')[1].length >= 2) return;
    if (s.replace(',', '').length >= 7) return;
    s = (s === '0' ? '' : s) + t;
  }
  durum.tus = s;
  tusYaz();
}

// Tuş takımındaki tutarı göstergeye yazar
function tusYaz() {
  const s = durum.tus;
  const el = $('#tutar-yazi');
  if (el) {
    el.textContent = s ? tusBicim(s) : '0';
    el.parentElement.classList.toggle('bos', !s);
  }
  tutarIpucuGuncelle();
}

function tutarIpucuGuncelle() {
  const el = $('#tutar-ipucu');
  if (!el) return;
  const v = sayi(durum.tus);
  const g = durum.g;
  el.classList.remove('uyari');

  if (!veri.profil) {
    const k = durum.kurulum;
    const adim = kurulumAdimi(k);
    kavanozGuncelle();
    if (adim === 'bakiye') {
      const prof = taslakProfil(k);
      const n = gunFarki(new Date(), donemSonBul(prof, donemBasBul(prof, new Date()))) + 1;
      if (k.gelirDuzeni === 'gunluk') el.textContent = `Bundan sonra gelecek harçlıklarla birlikte haftanın kalan ${n} gününe paylaştırılır`;
      else el.innerHTML = v ? `Kalan ${n} gün için günde ortalama <b>${para(v / n)}</b>` : `Dönemin kalan ${n} gününe paylaştırılır`;
      return;
    }
    if (!v) { el.textContent = 'Tuşlarla tutarı gir'; return; }
    if (k.gelirDuzeni === 'gunluk') {
      const n = k.harclikGunleri.length;
      el.innerHTML = `Haftada ${n} gün × ${para(v)} = <b>${para(v * n)}</b> · ayda yaklaşık ${para(v * n * 52 / 12)}`;
    } else if (k.gelirDuzeni === 'haftalik') {
      el.innerHTML = `Günde ortalama <b>${para(v / 7)}</b> · ayda yaklaşık ${para(v * 52 / 12)}`;
    } else {
      el.innerHTML = `Günde ortalama <b>${para(v / 30)}</b>`;
    }
    return;
  }
  if (durum.sheet === 'alsam') {
    el.textContent = v ? '' : 'Fiyatını gir';
    alsamGuncelle();
    return;
  }
  if (durum.sheet === 'harcama') {
    const plan = durum.form.planId && veri.planlar.find(p => p.id === durum.form.planId);
    if (plan) {
      const fark = v - plan.tutar;
      el.innerHTML = !v ? `Plan için ${para(plan.tutar)} ayrılmıştı`
        : Math.abs(fark) < 1 ? 'Planladığın tutar kadar' : fark > 0 ? `Plandan <b>${para(fark)}</b> fazla; fark limitinden düşülür` : `Plandan <b>${para(-fark)}</b> az; artan limitine eklenir`;
      if (fark >= 1) el.classList.add('uyari');
      return;
    }
    if (durum.form.ciftOnay) ciftUyariSifirla();
    if (durum.form.tarih !== bugunStr()) { el.textContent = 'Geçmiş güne eklenecek'; return; }
    if (!v) { el.innerHTML = `Bugün kalan: <b>${para(g.bugunKalan)}</b>`; return; }
    const sonra = g.bugunKalan - v;
    let metin = sonra >= 0
      ? `Ekleyince bugün <b>${para(sonra)}</b> kalacak`
      : `Bu harcamayla limitini <b>${para(-sonra)}</b> aşacaksın`;
    if (sonra < 0) el.classList.add('uyari');
    const h = g.aktifHedefler[0];
    if (durum.form.tur === 'istek' && h) metin += `<br><span class="ipucu-ek">Bu tutar “${esc(h.ad)}” hedefinin ${yuzde(v / h.hedefTutar)} kadarı</span>`;
    el.innerHTML = metin;
    return;
  }
  if (durum.sheet === 'borcOde') { borcOdeIpucu(); return; }
  if (durum.sheet === 'duzenliBirikim') {
    el.innerHTML = v ? `Eklersen <b>${para(veri.birikim.biriken + v)}</b> olur` : 'Elle para eklemek ya da çekmek için tutar gir';
    return;
  }
  if (durum.sheet === 'hedefDetay') {
    const h = g.hedefler.find(x => x.id === durum.sheetId);
    if (!h) return;
    el.innerHTML = v
      ? `Atınca <b>${para(h.biriken + v)}</b> · ${yuzde((h.biriken + v) / h.hedefTutar)}`
      : 'Ne kadar atmak ya da çekmek istersin?';
  }
}

// ---------- Alt sayfalar (bottom sheet) ----------

function sheetBaslik(metin, ek = '') {
  return `<div class="sheet-ust"><h2>${metin}</h2>${ek}<button class="ikon-dugme" data-eylem="sheet-kapat" aria-label="Kapat">${ikon('kapat', 20)}</button></div>`;
}

function hesapSatiri(a, b, sinif = '') { return `<div class="hesap-satir ${sinif}"><span>${a}</span><b>${b}</b></div>`; }

function kategoriSecimi(secili) {
  return `<div class="kategori-secim">${Object.entries(HARCAMA_KATEGORILERI).map(([id, k]) => `
    <button class="kat-secenek ${id === secili ? 'secili' : ''}" data-eylem="form-sec" data-alan="kategori" data-deger="${id}" style="--renk:${k.renk}">
      <span class="kat-ikon">${ikon(k.ikon, 20)}</span><small>${k.ad}</small>
    </button>`).join('')}</div>`;
}

function turSecimi(secili) {
  return `<div class="segment">
    <button class="${secili === 'ihtiyac' ? 'secili' : ''}" data-eylem="form-sec" data-alan="tur" data-deger="ihtiyac">İhtiyaç</button>
    <button class="${secili === 'istek' ? 'secili' : ''}" data-eylem="form-sec" data-alan="tur" data-deger="istek">İstek</button>
  </div>`;
}

const SHEETLER = {
  ...RANK_SHEETLERI,
  ...BORC_SHEETLERI,
  ...EKSTRE_SHEETLERI,
  alsam: alsamSheet,
  bekleDetay: bekleDetaySheet,

  harcama(planId) {
    const plan = planId && veri.planlar.find(p => p.id === planId);
    const on = durum.onDoldur;   // "Alsam mı?"dan gelen ürün
    durum.onDoldur = null;
    durum.form = { kategori: plan ? plan.kategori : 'yemek', tur: plan ? plan.tur : on ? 'istek' : 'ihtiyac', tarih: bugunStr(), planId: plan ? plan.id : null, istekId: on && on.istekId || null, kartId: '' };
    if (plan) {
      durum.tus = String(plan.tutar).replace('.', ',');
      if (plan.tarih < bugunStr()) durum.form.tarih = plan.tarih;
    }
    if (on) durum.tus = String(on.tutar).replace('.', ',');
    // Henüz almadıysa: aynı yerden "Alsam mı?" diye sorabilir
    const alsamDugme = plan || on ? '' : `<span class="sheet-ek-grup">
      <button class="ikon-dugme" data-eylem="fis-baslat" aria-label="Fişten ekle">${ikon('kamera', 18)}</button>
      <button class="ikon-dugme" data-eylem="ses-baslat" aria-label="Sesle ekle">${ikon('mikrofon', 18)}</button>
      <button class="metin-dugme sheet-ek" data-eylem="alsam-gec">${ikon('canta', 16)} Alsam mı?</button></span>`;
    return `${sheetBaslik(plan ? 'Plan harcaması' : 'Harcama ekle', alsamDugme)}
    ${plan || on ? '' : sesPaneli() + fisPaneli()}
    ${tutarGostergesi()}
    ${turSecimi(durum.form.tur)}
    <div id="tur-ipucu" class="mini-ipucu">${TUR_IPUCU[durum.form.tur]}</div>
    ${kategoriSecimi(durum.form.kategori)}
    <div class="sheet-satir">
      <input id="h-not" class="not-girdi" maxlength="40" placeholder="Not ekle (örn. Kahve)" value="${plan ? esc(plan.ad) : on ? esc(on.ad) : ''}">
      ${plan ? `<span class="cip">${ikon('takvim', 14)} ${tarihGoster(durum.form.tarih)}</span>` : `<div class="segment kucuk">
        <button class="secili" data-eylem="form-sec" data-alan="tarih" data-deger="${bugunStr()}">Bugün</button>
        <button data-eylem="form-sec" data-alan="tarih" data-deger="${dunStr()}">Dün</button>
      </div>`}
    </div>
    ${odemeSecimi()}
    ${tusTakimi()}
    <div id="cift-uyari" class="cift-uyari" hidden></div>
    <button class="dugme ana genis" data-eylem="harcama-kaydet" data-enter>${plan ? 'Harcamayı kaydet' : 'Ekle'}</button>`;
  },

  harcamaDetay(id) {
    const h = veri.harcamalar.find(x => x.id === id);
    if (!h) return '';
    const k = kategori(h.kategori);
    const plan = h.planId && veri.planlar.find(p => p.id === h.planId);
    const kart = h.kartId && veri.borclar.find(b => b.id === h.kartId);
    const benzer = h.ciftOnay ? [] : benzerHarcamalar(h, veri.harcamalar).filter(x => !x.ciftOnay);
    return `${sheetBaslik('Harcama')}
    <div class="detay-ust">
      <span class="kat-ikon buyuk" style="--renk:${k.renk}">${ikon(k.ikon, 28)}</span>
      <strong>−${para(h.tutar)}</strong><b>${esc(h.aciklama || k.ad)}</b>
    </div>
    <div class="grup">
      ${bilgiSatiri('Kategori', k.ad)}
      ${bilgiSatiri('Tür', h.tur === 'istek' ? 'İstek' : 'İhtiyaç')}
      ${bilgiSatiri('Tarih', tarihGoster(h.tarih, true) + (h.saat ? ' · ' + h.saat : ''))}
      ${plan ? bilgiSatiri('Plan', `${esc(plan.ad)} (${para(plan.tutar)})`) : ''}
      ${kart ? bilgiSatiri('Ödeme', `Kartla · ${esc(kart.ad)}`) : ''}
      ${h.kaynak === 'ekstre' ? bilgiSatiri('Kaynak', 'Kart ekstresinden eklendi') : ''}
    </div>
    ${benzer.length ? `<div class="cift-uyari">${ikon('uyari', 16)}<span>Aynı gün aynı tutarda ${benzer.length === 1 ? 'bir harcama daha' : benzer.length + ' harcama daha'} var. Yanlışlıkla iki kez eklediysen birini sil.</span></div>
      <button class="dugme hafif genis" data-eylem="cift-ayri" data-id="${h.id}">Ayrı kayıtlar, uyarma</button>` : ''}
    <button class="dugme tehlike genis" data-eylem="harcama-sil" data-id="${h.id}">${ikon('cop', 18)}<span>Harcamayı sil</span></button>`;
  },

  limitBilgi() {
    const g = durum.g;
    const p = veri.profil;
    const aciklama = {
      aylik: g.gelirDegisken
        ? `${buyukHarf(g.gelirAdi)} her ay ${p.maasGunu}. ile ${p.maasGunuSon}. günleri arasında geldiği için yatana kadar en geç güne göre planlanır; "Yattı" dediğin gün yeni dönemin başlar.`
        : `Paran ayda bir geldiği için bütçen ${p.maasGunu === 1 ? 'ay ay' : `ayın ${p.maasGunu}. gününden bir sonrakine kadar`} planlanır.`,
      haftalik: `${buyukHarf(g.gelirAdi)} her ${GUN_ADLARI[p.harclikGunu].toLocaleLowerCase('tr')} geldiği için bütçen hafta hafta planlanır.`,
      gunluk: `${buyukHarf(g.gelirAdi)} ${gunListesiMetni(p.harclikGunleri).toLocaleLowerCase('tr')} geldiği için bütçen Pazartesi–Pazar haftası olarak planlanır; ${g.gelirAdi} gelmeyen günlerin parası diğer günlerden ayrılır.`
    }[g.duzen];
    // Günlük harçlıkta haftanın geliri "5 gün × ₺500" diye gösterilir
    const gelirGunu = g.duzen === 'gunluk' ? g.donem.gunler.filter(x => x.gelen > 0).length : 0;
    return `${sheetBaslik('Günlük limit nasıl hesaplanır?')}
    <p class="sheet-metin">${aciklama} ${g.ekKalemler.length ? 'Diğer gelirlerin de geldikleri döneme eklenir. ' : ''}Az harcadığın günlerde artan para sonraki günlere eklenir; fazla harcarsan sonraki günlerin limiti düşer. ${g.donemAdi === 'hafta' ? 'Aylık ödemelerin, bir aydaki ortalama 4,35 haftaya bölünerek her haftaya yansır. ' : ''}Limitler yuvarlak bir sayıya yuvarlanır, artan para kumbarana gider.</p>
    <div class="hesap">
      ${hesapSatiri(g.donem.ilk ? 'Dönemin kalan parası' : gelirGunu ? `Bu hafta ${gelirGunu} gün × ${para(p.gelirTutari)}` : g.ekKalemler.length ? `${buyukHarf(g.gelirAdi)} (${donemAraligi(g.donem)})` : `Bu dönemin geliri (${donemAraligi(g.donem)})`, para(g.donemAnaGelir))}
      ${g.ekKalemler.map(x => hesapSatiri(`${esc(x.ad)}${x.bolunmus ? ' (aylığın haftalık payı)' : ''}`, '+ ' + para(x.tutar))).join('')}
      ${g.sabitPayi >= 1 ? hesapSatiri(g.donemAdi === 'hafta' ? 'Aylık ödemeler (÷ 4,35 hafta)' : 'Sabit gider payı', '− ' + para(g.sabitPayi)) : ''}
      ${g.borcPayi >= 1 ? hesapSatiri(g.donemAdi === 'hafta' ? 'Borç ödemeleri (÷ 4,35 hafta)' : 'Borç ödemeleri', '− ' + para(g.borcPayi)) : ''}
      ${g.ulasimPayi >= 1 ? hesapSatiri(`Ulaşım (${g.ulasimGunSayisi} gün)`, '− ' + para(g.ulasimPayi)) : ''}
      ${g.planPayi >= 1 ? hesapSatiri('Planlı harcamalar', '− ' + para(g.planPayi)) : ''}
      ${g.duzenliPay >= 1 ? hesapSatiri(`Düzenli birikim (%${g.birikimYuzdesi})`, '− ' + para(g.duzenliPay)) : ''}
      ${g.hedefPayi >= 1 ? hesapSatiri('Hedeflerinin payı', '− ' + para(g.hedefPayi)) : ''}
      ${g.butceYuvarlama >= 1 ? hesapSatiri('Yuvarlamadan kumbaraya', '− ' + para(g.butceYuvarlama)) : ''}
      ${hesapSatiri(g.donemAdi === 'hafta' ? 'Haftalık limitin' : 'Aylık limitin', para(g.harcanabilirDonem), 'ara')}
      ${hesapSatiri('Bugünden önce harcanan', '− ' + para(g.oncekiHarcanan))}
      ${g.oncekiYuvarlama >= 1 ? hesapSatiri('Günlük yuvarlamalardan kumbaraya', '− ' + para(g.oncekiYuvarlama)) : ''}
      ${g.bugunKumbara >= 1 ? hesapSatiri('Cebinden kumbaraya attığın', '− ' + para(g.bugunKumbara)) : ''}
      ${hesapSatiri('Kalan gün (bugün dahil)', '÷ ' + g.kalanGun)}
      ${g.nakitSinirli ? hesapSatiri('Formülün sonucu', para(g.formulLimit)) + hesapSatiri('Cebindeki para sınırı', para(g.cep)) : ''}
      ${g.hamLimit - g.gunlukLimit >= 1 ? hesapSatiri('Hesaplanan', para(g.hamLimit)) : ''}
      ${hesapSatiri(g.hamLimit - g.gunlukLimit >= 1 ? 'Yuvarlanmış limitin' : 'Bugünkü limitin', para(g.gunlukLimit), 'sonuc')}
    </div>
    ${g.nakitSinirli ? `<p class="sheet-metin">Bu döneme ait paranın hepsi henüz eline geçmediği için limitin, şu an cebinde olması gereken parayla sınırlandı.</p>` : ''}
    <button class="dugme ana genis" data-eylem="sheet-kapat">Anladım</button>`;
  },

  hedefYeni() {
    durum.form = { emoji: HEDEF_EMOJILERI[0], acil: false };
    const ucAy = new Date(); ucAy.setMonth(ucAy.getMonth() + 3);
    return `${sheetBaslik('Yeni hedef')}
    <div class="emoji-secim">${HEDEF_EMOJILERI.map((e, i) => `<button class="${i === 0 ? 'secili' : ''}" data-eylem="form-sec" data-alan="emoji" data-deger="${e}">${e}</button>`).join('')}</div>
    <div class="form">
      <label class="alan"><span>Hedef adı</span><input id="hd-ad" maxlength="30" placeholder="Örn. Yeni telefon"></label>
      <div class="alan-ikili">
        <label class="alan"><span>Hedef tutar (₺)</span><input id="hd-tutar" type="number" inputmode="numeric" min="1" placeholder="0"></label>
        <label class="alan"><span>Şu an birikmiş (₺)</span><input id="hd-biriken" type="number" inputmode="numeric" min="0" placeholder="0"></label>
      </div>
      <label class="alan"><span>Son tarih</span><input id="hd-tarih" type="date" min="${bugunStr()}" value="${tarihStr(ucAy)}"></label>
      <button class="anahtar-satir" data-eylem="form-anahtar" data-alan="acil">
        <span class="satir-orta"><b>Acil durum fonu</b><small>Beklenmedik giderler için ayrılan para</small></span><span class="anahtar"></span>
      </button>
      <div id="hd-onizleme" class="onizleme"></div>
      <button class="dugme ana genis" data-eylem="hedef-kaydet">Hedefi oluştur</button>
    </div>`;
  },

  hedefDetay(id) {
    const h = durum.g.hedefler.find(x => x.id === id);
    if (!h) return '';
    const oran = h.hedefTutar ? h.biriken / h.hedefTutar : 0;
    return `${sheetBaslik(`${esc(h.emoji || '🎯')} ${esc(h.ad)}`)}
    <div class="hedef-detay-ust"><strong>${para(h.biriken)}</strong><span>/ ${para(h.hedefTutar)}</span></div>
    <span class="ince-cubuk buyuk"><i style="width:${Math.min(1, oran) * 100}%"></i></span>
    <div class="istatistik-uclu">
      <div><span>Kalan</span><b>${para(h.kalanTutar)}</b></div>
      <div><span>Ayda</span><b>${para(h.aylikGereken)}</b></div>
      <div><span>Son tarih</span><b>${tarihCoz(h.sonTarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</b></div>
    </div>
    ${tutarGostergesi('', 'kucuk')}
    ${tusTakimi()}
    ${cepAnahtari()}
    <div class="dugme-ikili">
      <button class="dugme hayalet" data-eylem="hedef-para" data-yon="cek">${ikon('asagiOk', 18)} Çek</button>
      <button class="dugme ana" data-eylem="hedef-para" data-yon="ekle" data-enter>${ikon('yukariOk', 18)} Kumbaraya at</button>
    </div>
    <button class="metin-dugme tehlike-metin" data-eylem="hedef-sil" data-id="${h.id}">${ikon('cop', 16)}<span>Hedefi sil</span></button>`;
  },

  duzenliBirikim() {
    const g = durum.g;
    return `${sheetBaslik('Düzenli birikim')}
    <div class="hedef-detay-ust"><strong>${para(veri.birikim.biriken)}</strong><span>birikti</span></div>
    <p class="sheet-metin">Paran gelince seçtiğin kadarı harcamadan önce ayrılır. Günlük limit yuvarlanınca artan para da buraya eklenir. ${g.donemAdi === 'ay' ? 'Ay' : 'Hafta'} bitince hepsi kendiliğinden kumbarana aktarılır.</p>
    <div class="alan"><span>Gelirinin ne kadarı?</span>${birikimSecimi(g.birikimYuzdesi)}</div>
    <div class="onizleme">${birikimOzetHtml(veri.profil, g.birikimYuzdesi)}</div>
    ${tutarGostergesi('', 'kucuk')}
    ${tusTakimi()}
    ${cepAnahtari()}
    <div class="dugme-ikili">
      <button class="dugme hayalet" data-eylem="duzenli-para" data-yon="cek">${ikon('asagiOk', 18)} Çek</button>
      <button class="dugme ana" data-eylem="duzenli-para" data-yon="ekle" data-enter>${ikon('yukariOk', 18)} Para ekle</button>
    </div>`;
  },

  sabitYeni() {
    durum.form = { kategori: 'iletisim' };
    return `${sheetBaslik('Düzenli ödeme ekle')}
    <div class="form">
      <label class="alan"><span>Gider adı</span><input id="sb-ad" maxlength="30" placeholder="Örn. Telefon faturası"></label>
      <div class="alan-ikili">
        <label class="alan"><span>Aylık tutar (₺)</span><input id="sb-tutar" type="number" inputmode="decimal" min="0" placeholder="0"></label>
        <label class="alan"><span>Ödeme günü</span><input id="sb-gun" type="number" inputmode="numeric" min="1" max="31" placeholder="İsteğe bağlı"></label>
      </div>
      <div class="alan"><span>Tür</span>
        <div class="cip-secim">${Object.entries(SABIT_KATEGORILER).map(([id, k]) => `<button class="${id === 'iletisim' ? 'secili' : ''}" data-eylem="form-sec" data-alan="kategori" data-deger="${id}" style="--renk:${k.renk}">${ikon(k.ikon, 16)} ${k.ad}</button>`).join('')}</div>
      </div>
      <button class="dugme ana genis" data-eylem="sabit-kaydet">Ekle</button>
    </div>`;
  },

  sabitDetay(id) {
    const s = veri.sabitGiderler.find(x => x.id === id);
    if (!s) return '';
    const k = sabitKategori(s.kategori);
    return `${sheetBaslik('Düzenli ödeme')}
    <div class="detay-ust">
      <span class="kat-ikon buyuk" style="--renk:${k.renk}">${ikon(k.ikon, 28)}</span>
      <strong>${para(s.tutar)}<small> / ay</small></strong><b>${esc(s.ad)}</b>
    </div>
    <div class="grup">
      ${bilgiSatiri('Tür', k.ad)}
      ${s.gun ? bilgiSatiri('Ödeme günü', `Her ayın ${s.gun}. günü`) : ''}
      ${bilgiSatiri('Yıllık maliyet', para(s.tutar * 12))}
      ${bilgiSatiri('Gelire oranı', yuzde(durum.g.gelir ? s.tutar / durum.g.gelir : 0))}
    </div>
    ${s.ulasimKarti ? '<p class="sheet-metin">Bu kalem, ulaşım ayarındaki aylık karttan gelir. Silersen ulaşım "ücret ödemiyorum" olarak değişir.</p>' : ''}
    <button class="dugme tehlike genis" data-eylem="sabit-sil" data-id="${s.id}">${ikon('cop', 18)}<span>Düzenli ödemeyi sil</span></button>`;
  },

  planYeni(tarih) {
    durum.form = { kategori: 'eglence', tur: 'istek' };
    const t = tarih && tarih >= bugunStr() ? tarih : bugunStr();
    return `${sheetBaslik('Plan ekle')}
    <p class="sheet-metin">Bildiğin bir harcamayı takvime ekle; parası o güne kadar günlük limitinden ayrılsın.</p>
    <div class="form">
      <label class="alan"><span>Ne için?</span><input id="pl-ad" maxlength="30" placeholder="Örn. Sinema, doğum günü hediyesi"></label>
      <div class="alan-ikili">
        <label class="alan"><span>Tutar (₺)</span><input id="pl-tutar" type="number" inputmode="numeric" min="1" placeholder="0"></label>
        <label class="alan"><span>Tarih</span><input id="pl-tarih" type="date" min="${bugunStr()}" value="${t}"></label>
      </div>
      ${kategoriSecimi(durum.form.kategori)}
      ${turSecimi(durum.form.tur)}
      <div id="pl-onizleme" class="onizleme"></div>
      <button class="dugme ana genis" data-eylem="plan-kaydet">Planı ekle</button>
    </div>`;
  },

  planDetay(id) {
    const p = durum.g.planlar.find(x => x.id === id);
    if (!p) return '';
    const k = kategori(p.kategori);
    const durumM = { bekliyor: 'Parası ayrıldı', harcandi: `Harcandı · ${para(p.ayrilan)}`, gecti: 'Harcama kaydedilmedi' }[p.durum];
    return `${sheetBaslik('Plan')}
    <div class="detay-ust">
      <span class="kat-ikon buyuk" style="--renk:${k.renk}">${ikon(k.ikon, 28)}</span>
      <strong>${para(p.tutar)}</strong><b>${esc(p.ad)}</b>
    </div>
    <div class="grup">
      ${bilgiSatiri('Tarih', uzunTarih(p.tarih))}
      ${bilgiSatiri('Kategori', `${k.ad} · ${p.tur === 'istek' ? 'İstek' : 'İhtiyaç'}`)}
      ${bilgiSatiri('Durum', durumM)}
    </div>
    ${p.durum !== 'harcandi' && p.tarih <= bugunStr() ? `<button class="dugme ana genis" data-eylem="plan-harcadim" data-id="${p.id}">${ikon('onay', 18)} Harcadım</button>` : ''}
    <button class="dugme tehlike genis" data-eylem="plan-sil" data-id="${p.id}">${ikon('cop', 18)}<span>Planı sil</span></button>`;
  },

  gelirDuzen() {
    const t = durum.taslak;
    return `${sheetBaslik('Gelir düzeni')}
    <p class="sheet-metin">Paranın ne sıklıkla geldiğini seç. Günlük limitin bu düzene göre hesaplanır.</p>
    ${duzenSecimi(t)}
    <label class="alan"><span>${tutarEtiketi(t)}</span><input type="number" inputmode="numeric" min="0" data-taslak="gelirTutari" value="${esc(t.gelirTutari)}"></label>
    <button class="dugme ana genis" data-eylem="gelir-kaydet">Kaydet</button>`;
  },

  // Ek gelir ekleme ve düzenleme (taslak: ekGelirTaslagi)
  ekGelir(id) {
    const t = durum.taslak;
    const detay = {
      aylik: `<label class="alan satirli"><span>${t.degisken ? 'En erken ayın kaçında?' : 'Ayın kaçında geliyor?'}</span>
          <input type="number" inputmode="numeric" min="1" max="31" data-taslak="gun" value="${esc(t.gun)}"></label>
        <button class="anahtar-satir ${t.degisken ? 'acik' : ''}" data-eylem="taslak-anahtar" data-alan="degisken" data-yenile>
          <span class="satir-orta"><b>Her ay aynı gün gelmiyor</b><small>Yattığı gün aydan aya değişiyor</small></span><span class="anahtar"></span>
        </button>
        ${t.degisken ? `<label class="alan satirli"><span>En geç ayın kaçında?</span>
          <input type="number" inputmode="numeric" min="2" max="31" placeholder="Örn. 20" data-taslak="gunSon" value="${esc(t.gunSon)}"></label>` : ''}`,
      haftalik: `<div class="alan"><span>Hangi gün geliyor?</span>${gunCipleri([Number(t.haftaGunu)], 'haftaGunu')}</div>`,
      tek: `<label class="alan"><span>Ne zaman?</span><input type="date" data-taslak="tarih" value="${esc(t.tarih)}"></label>`
    }[t.tekrar];
    const oneriler = id ? '' : `<div class="cip-secim">${ekGelirOnerileri(veri.profil).map(([ad, tekrar]) =>
      `<button class="${t.ad === ad ? 'secili' : ''}" style="--renk:#12B886" data-eylem="ek-gelir-oneri" data-ad="${ad}" data-tekrar="${tekrar}">${ad}</button>`).join('')}</div>`;
    return `${sheetBaslik(id ? 'Geliri düzenle' : 'Gelir ekle')}
    ${id ? '' : `<p class="sheet-metin">${buyukHarf(gelirAdi(veri.profil))} dışında gelen paran: burs, part-time iş, bayram harçlığı… Günlük limitine eklenir.</p>`}
    ${oneriler}
    <div class="form">
      <div class="alan-ikili">
        <label class="alan"><span>Gelirin adı</span><input data-taslak="ad" maxlength="30" placeholder="Örn. Burs" value="${esc(t.ad)}"></label>
        <label class="alan"><span>Tutar (₺)</span><input data-taslak="tutar" type="number" inputmode="numeric" min="1" placeholder="0" value="${esc(t.tutar)}"></label>
      </div>
      <div class="alan"><span>Ne sıklıkla?</span><div class="segment">${Object.entries(EK_GELIR_TEKRARI).map(([k, x]) =>
        `<button class="${t.tekrar === k ? 'secili' : ''}" data-eylem="taslak" data-alan="tekrar" data-deger="${k}">${x.ad}</button>`).join('')}</div></div>
      ${detay}
      <div id="eg-onizleme" class="onizleme">${ekGelirOnizlemeHtml(t)}</div>
      <button class="dugme ana genis" data-eylem="ek-gelir-kaydet">${id ? 'Kaydet' : 'Ekle'}</button>
    </div>`;
  },

  ekGelirDetay(id) {
    const e = veri.ekGelirler.find(x => x.id === id);
    if (!e) return '';
    const g = durum.g;
    const katki = (g.ekKalemler.find(x => x.id === id) || {}).tutar || 0;
    return `${sheetBaslik('Gelir')}
    <div class="detay-ust">
      <span class="kat-ikon buyuk" style="--renk:#12B886">${ikon('damla', 28)}</span>
      <strong>+${para(e.tutar)}${e.tekrar === 'tek' ? '' : `<small> / ${e.tekrar === 'aylik' ? 'ay' : 'hafta'}</small>`}</strong><b>${esc(e.ad)}</b>
    </div>
    <div class="grup">
      ${bilgiSatiri('Ne zaman', ekGelirOzeti(e))}
      ${e.tekrar === 'haftalik' ? bilgiSatiri('Aylık karşılığı', para(aylikEkGelir([e]))) : ''}
      ${bilgiSatiri(`${donemIyelik(g)} bütçesine`, katki >= 1 ? '+' + para(katki) : '—')}
    </div>
    ${e.tekrar === 'aylik' && Number(e.gunSon) > e.gun ? '<p class="sheet-metin">Yattığı gün belli olmadığı için en geç güne göre planlanır. Yatınca Bugün ekranından ya da Takvim\'den "Yattı" demen yeter.</p>' : ''}
    ${e.tekrar === 'tek' && !e.ciftOnay && veri.ekGelirler.some(x => x.id !== e.id && x.tekrar === 'tek' && x.tarih === e.tarih && Math.abs(x.tutar - e.tutar) < 0.5)
      ? `<div class="cift-uyari">${ikon('uyari', 16)}<span>Aynı gün aynı tutarda bir gelir daha var. Yanlışlıkla iki kez eklediysen birini sil.</span></div>
        <button class="dugme hafif genis" data-eylem="cift-ayri-gelir" data-id="${e.id}">Ayrı kayıtlar, uyarma</button>` : ''}
    ${veri.borclar.some(b => b.gelirId === e.id)
      ? `<p class="sheet-metin">Bu gelir KYK kredisi kaydına bağlı; değiştirmek için borç kaydını düzenle.</p>
        <button class="dugme hafif genis" data-eylem="borc-detay" data-id="${veri.borclar.find(b => b.gelirId === e.id).id}">Borç kaydını aç</button>`
      : `<button class="dugme hafif genis" data-eylem="ek-gelir-duzenle" data-id="${e.id}">Düzenle</button>
        <button class="dugme tehlike genis" data-eylem="ek-gelir-sil" data-id="${e.id}">${ikon('cop', 18)}<span>Geliri sil</span></button>`}`;
  },

  ulasimDuzen() {
    return `${sheetBaslik('Ulaşım')}
    <p class="sheet-metin">Binişte ödüyorsan ulaşım parası, gittiğin günlere göre limitinden önce ayrılır.</p>
    ${ulasimSecimi(durum.taslak)}
    <button class="dugme ana genis" data-eylem="ulasim-kaydet">Kaydet</button>`;
  }
};

function sheetAc(tur, id = null) {
  durum.sheet = tur;
  durum.sheetId = id;
  durum.tus = '';
  const k = $('#katman');
  k.innerHTML = `<div class="perde" data-eylem="sheet-kapat"></div>
    <div class="sheet" role="dialog" aria-modal="true"><div class="tutamac"></div>${SHEETLER[tur](id)}</div>`;
  k.classList.add('acik');
  requestAnimationFrame(() => requestAnimationFrame(() => k.classList.add('gorunur')));
  tutarIpucuGuncelle();
}

function sheetYenile() {
  const s = $('.sheet');
  if (!s || !durum.sheet) return;
  const konum = s.scrollTop;
  s.innerHTML = `<div class="tutamac"></div>${SHEETLER[durum.sheet](durum.sheetId)}`;
  s.scrollTop = konum;
}

function sheetKapat() {
  sesKapat();
  fisKapat();
  ekstreKapat();
  const k = $('#katman');
  k.classList.remove('gorunur');
  durum.sheet = null;
  durum.tus = '';
  setTimeout(() => { if (!durum.sheet) { k.classList.remove('acik'); k.innerHTML = ''; } }, 320);
}

// ---------- Taslak (kurulum ve gelir/ulaşım düzenleme) ----------

function aktifTaslak() { return durum.sheet ? durum.taslak : durum.kurulum; }
function taslakYenile() { if (durum.sheet) sheetYenile(); else ciz(); }

function profilTaslagi() {
  const p = veri.profil, u = veri.ulasim || { tip: 'yok' };
  return {
    gelirDuzeni: p.gelirDuzeni, gelirTutari: p.gelirTutari, maasGunu: p.maasGunu || 1,
    maasDegisken: gelirDegiskenMi(p), maasGunuSon: p.maasGunuSon || '',
    harclikGunu: p.harclikGunu ?? 1, harclikGunleri: (p.harclikGunleri || HAFTA_ICI).slice(), tatildeHarclik: p.tatildeHarclik !== false,
    ulasim: { tip: u.tip, kartTutar: u.kartTutar || '', ucret: u.ucret || '', gidisDonus: u.gidisDonus ?? true, gunler: (u.gunler || HAFTA_ICI).slice() }
  };
}

function taslakGun(el) {
  const t = aktifTaslak();
  const gun = Number(el.dataset.gun);
  const alan = el.dataset.alan;
  if (alan === 'harclikGunu' || alan === 'haftaGunu') t[alan] = gun;
  else {
    const dizi = yolOku(t, alan);
    const i = dizi.indexOf(gun);
    if (i >= 0) dizi.splice(i, 1); else dizi.push(gun);
  }
  taslakYenile();
}

// ---------- Kaydetme işlemleri ----------

function harcamaKaydet() {
  const tutar = sayi(durum.tus);
  if (tutar <= 0) { salla('.sheet .tutar-gosterge'); return; }
  const f = durum.form;
  const bugun = f.tarih === bugunStr();
  const h = {
    id: yeniId(), tutar, kategori: f.kategori, tur: f.tur,
    aciklama: ($('#h-not').value || '').trim(), tarih: f.tarih, saat: bugun ? saatStr() : ''
  };
  const plan = f.planId && veri.planlar.find(p => p.id === f.planId);
  // Aynı gün aynı harcama zaten varsa önce sor; "Yine de ekle" denirse kayıt işaretlenir
  if (!plan) {
    const benzer = benzerHarcamalar(h, veri.harcamalar)[0];
    if (benzer && !f.ciftOnay) { ciftUyariGoster(benzer); return; }
    if (benzer) h.ciftOnay = true;
  }
  if (f.kartId) h.kartId = f.kartId;
  if (plan) { h.planId = plan.id; plan.harcamaId = h.id; }
  const istek = f.istekId && veri.istekListesi.find(x => x.id === f.istekId);
  if (istek) { istek.durum = 'alindi'; istek.karar = bugunStr(); }
  veri.harcamalar.push(h);
  durum.yeniHarcama = h.id;
  sheetKapat();
  kaydetVeCiz();
  const g = durum.g;
  if (plan) bildirim(`“${plan.ad}” planı harcandı olarak kaydedildi`);
  else if (!bugun) bildirim(`${para(tutar)} dünün harcamalarına eklendi`);
  else if (g.bugunKalan < 0) bildirim(`Limit aşıldı · ${para(-g.bugunKalan)} fazla`, 'uyari');
  else bildirim(`Eklendi · bugün ${para(g.bugunKalan)} kaldı`);
  turOlay('harcama-eklendi');
}

function ciftUyariGoster(b) {
  durum.form.ciftOnay = true;
  const el = $('#cift-uyari');
  el.innerHTML = `${ikon('uyari', 16)}<span>${b.tarih === bugunStr() ? 'Bugün' : tarihGoster(b.tarih)}${b.saat ? ` (${b.saat})` : ''} <b>${esc(b.aciklama || kategori(b.kategori).ad)}</b> için ${para(b.tutar)} eklemiştin. Aynı harcamayı tekrar mı giriyorsun?</span>`;
  el.hidden = false;
  el.scrollIntoView({ block: 'nearest', behavior: hareketAzaltilmis() ? 'auto' : 'smooth' });
  $('[data-eylem="harcama-kaydet"]').textContent = 'Yine de ekle';
  titret();
}

// Tutar, kategori ya da gün değişince uyarı kalkar; yeniden kontrol edilir
function ciftUyariSifirla() {
  durum.form.ciftOnay = false;
  const el = $('#cift-uyari');
  if (el) el.hidden = true;
  const d = $('[data-eylem="harcama-kaydet"]');
  if (d) d.textContent = durum.form.planId ? 'Harcamayı kaydet' : 'Ekle';
}

function sabitKaydet() {
  const ad = $('#sb-ad').value.trim();
  const tutar = sayi($('#sb-tutar').value);
  const gun = Math.round(sayi($('#sb-gun').value));
  if (!ad) { salla('#sb-ad'); return; }
  if (tutar <= 0) { salla('#sb-tutar'); return; }
  if ($('#sb-gun').value && (gun < 1 || gun > 31)) { salla('#sb-gun'); return; }
  const s = { id: yeniId(), ad, tutar, kategori: durum.form.kategori };
  if (gun) s.gun = gun;
  veri.sabitGiderler.push(s);
  sheetKapat();
  kaydetVeCiz('Düzenli ödeme eklendi');
}

function hedefKaydet() {
  const ad = $('#hd-ad').value.trim();
  const hedefTutar = sayi($('#hd-tutar').value);
  const biriken = sayi($('#hd-biriken').value);
  const sonTarih = $('#hd-tarih').value;
  if (!ad) { salla('#hd-ad'); return; }
  if (hedefTutar <= 0) { salla('#hd-tutar'); return; }
  if (!sonTarih) { salla('#hd-tarih'); return; }
  veri.hedefler.push({ id: yeniId(), ad, emoji: durum.form.emoji, hedefTutar, biriken: Math.min(biriken, hedefTutar), sonTarih, acil: !!durum.form.acil });
  sheetKapat();
  kaydetVeCiz('Hedef oluşturuldu');
}

function hedefOnizleme() {
  const el = $('#hd-onizleme');
  if (!el) return;
  const hedef = sayi($('#hd-tutar').value), biriken = sayi($('#hd-biriken').value), tarih = $('#hd-tarih').value;
  if (!hedef || !tarih) { el.innerHTML = ''; return; }
  const bugun = gunBasi(new Date());
  const ay = Math.max(1, Math.ceil(gunFarki(bugun, tarihCoz(tarih)) / 30.44));
  const aylik = Math.max(0, hedef - biriken) / ay;
  el.innerHTML = `${ikon('bilgi', 16)}<span>Ayda <b>${para(aylik)}</b> biriktirmen gerekir. Bu, günlük limitini yaklaşık <b>${para(aylik / 30.44)}</b> azaltır.</span>`;
}

// Kumbaraya elle atılan para cepten çıkar; anahtar açıksa bu dönemin limitinden düşülür
// (takvim.js). Çekilen para da cebe döner. Kapalıysa (hediye, eski birikim) limit değişmez.
function cepAnahtari() {
  const g = durum.g;
  return `<button class="anahtar-satir ${durum.form.cep !== false ? 'acik' : ''}" data-eylem="form-anahtar" data-alan="cep">
    <span class="satir-orta"><b>Cebimdeki paradan</b><small>${donemIyelik(g)} limitinden düşer, çekince geri gelir. Hediye ya da eski birikimse kapat.</small></span><span class="anahtar"></span>
  </button>`;
}

function kumbaraHareketi(tutar, hedefId) {
  if (!tutar) return;
  veri.kumbaraHareketleri = veri.kumbaraHareketleri || [];
  veri.kumbaraHareketleri.push({ id: yeniId(), tarih: bugunStr(), tutar, hedefId, cep: durum.form.cep !== false });
}

function hedefPara(yon) {
  let tutar = sayi(durum.tus);
  if (tutar <= 0) { salla('.sheet .tutar-gosterge'); return; }
  const h = veri.hedefler.find(x => x.id === durum.sheetId);
  if (!h) return;
  if (yon === 'cek') tutar = Math.min(tutar, h.biriken);
  const oncedenTamam = h.biriken >= h.hedefTutar;
  h.biriken = Math.max(0, h.biriken + (yon === 'cek' ? -tutar : tutar));
  kumbaraHareketi(yon === 'cek' ? -tutar : tutar, h.id);
  sheetKapat();
  if (yon === 'ekle' && !oncedenTamam && h.biriken >= h.hedefTutar) kaydetVeCiz(`Tebrikler! “${h.ad}” hedefine ulaştın`);
  else kaydetVeCiz(yon === 'cek' ? `${para(tutar)} kumbaradan çekildi` : `${para(tutar)} kumbaraya atıldı`);
}

function duzenliPara(yon) {
  let tutar = sayi(durum.tus);
  if (tutar <= 0) { salla('.sheet .tutar-gosterge'); return; }
  if (yon === 'cek') tutar = Math.min(tutar, veri.birikim.biriken);
  veri.birikim.biriken = Math.max(0, veri.birikim.biriken + (yon === 'cek' ? -tutar : tutar));
  kumbaraHareketi(yon === 'cek' ? -tutar : tutar, null);
  sheetKapat();
  kaydetVeCiz(yon === 'cek' ? `${para(tutar)} birikimden çekildi` : `${para(tutar)} birikime eklendi`);
}

// ---------- Otomatik birikim aktarımı ----------
// Biten her dönemin sonunda o dönem için ayrılan para (hedef payları, gelirin yüzdesi,
// limit yuvarlamasından artanlar) kumbaraya kendiliğinden aktarılır. Dönemde fazla
// harcandıysa yalnızca gerçekten artan kadarı aktarılır. Aktarılan dönemler bir daha aktarılmaz.
function birikimAktar() {
  if (!veri.profil) return 0;
  const bugunS = bugunStr();
  if (!veri.aktarimBas) { veri.aktarimBas = bugunS; veriKaydet(veri); return 0; }
  const g = gercekleriHesapla(veri);
  const tk = g.takvim;
  const yapilan = new Set(veri.aktarilanDonemler);
  let toplamAktarilan = 0;

  for (let d = tk.donem(gunEkle(g.donem.bas, -1)); d.sonS >= veri.aktarimBas && d.sonS >= tk.baslangic; d = tk.donem(gunEkle(d.bas, -1))) {
    if (yapilan.has(d.basS)) continue;
    yapilan.add(d.basS);
    const ayrilan = d.kumbaraPayi + d.yuvarlama;
    const artan = d.kullanilabilir - d.serbestHarcanan - d.kumbaraAtilan;
    const aktar = Math.floor(Math.max(0, Math.min(ayrilan, artan)));
    if (!aktar) continue;
    const olcek = aktar / ayrilan;
    // Hedefler kendi paylarını alır (hedef tutarını aşmadan); kalanı düzenli birikime
    let kalan = aktar;
    g.aktifHedefler.forEach(h => {
      const kayit = veri.hedefler.find(x => x.id === h.id);
      const pay = Math.min(Math.floor(h.aylikGereken * d.oran * olcek), kayit.hedefTutar - kayit.biriken, kalan);
      if (pay > 0) { kayit.biriken += pay; kalan -= pay; }
    });
    veri.birikim.biriken += kalan;
    toplamAktarilan += aktar;
  }
  // Yalnızca son 30 dönem hatırlanır; aktarım başlangıcı da en eski hatırlanan döneme çekilir.
  // Yoksa listeden düşen eski dönem "aktarılmamış" görünür ve her açılışta yeniden aktarılırdı.
  veri.aktarilanDonemler = [...yapilan].sort().slice(-30);
  if (veri.aktarilanDonemler.length === 30 && veri.aktarilanDonemler[0] > veri.aktarimBas) veri.aktarimBas = veri.aktarilanDonemler[0];
  veriKaydet(veri);
  return toplamAktarilan;
}

function planOnizleme() {
  const el = $('#pl-onizleme');
  if (!el) return;
  const tutar = sayi($('#pl-tutar').value), t = $('#pl-tarih').value;
  const g = durum.g;
  if (!tutar || !t) { el.innerHTML = ''; return; }
  if (t <= g.donem.sonS) {
    el.innerHTML = `${ikon('bilgi', 16)}<span>${donemIyelik(g)} bütçesinden ayrılır: günlük limitin yaklaşık <b>${para(tutar / g.kalanGun)}</b> düşer.${tutar > g.harcanabilirDonem ? ' <b>Bu tutar bu dönemin harcanabilir parasından fazla.</b>' : ''}</span>`;
  } else {
    const buyuk = tutar > Math.max(0, g.harcanabilirDonem + g.planPayi) * 0.5;
    el.innerHTML = `${ikon('bilgi', 16)}<span>${uzunTarih(t)} sonraki bir döneme denk geliyor; parası o dönemin bütçesinden ayrılacak.${buyuk ? ' Tutar büyük; şimdiden biriktirmek için kumbarada hedef oluşturabilirsin.' : ''}</span>`;
  }
}

function planKaydet() {
  const ad = $('#pl-ad').value.trim();
  const tutar = sayi($('#pl-tutar').value);
  const tarih = $('#pl-tarih').value;
  if (!ad) { salla('#pl-ad'); return; }
  if (tutar <= 0) { salla('#pl-tutar'); return; }
  if (!tarih || tarih < bugunStr()) { salla('#pl-tarih'); return; }
  veri.planlar.push({ id: yeniId(), tarih, ad, tutar, kategori: durum.form.kategori, tur: durum.form.tur });
  durum.seciliGun = tarih;
  sheetKapat();
  kaydetVeCiz(`Plan eklendi · ${tarihGoster(tarih)}`);
}

function planSil(id) {
  const p = veri.planlar.find(x => x.id === id);
  if (!p) return;
  // Plana bağlı harcama silinmez; sıradan bir harcamaya dönüşür
  veri.harcamalar.forEach(h => { if (h.planId === id) delete h.planId; });
  veri.planlar = veri.planlar.filter(x => x.id !== id);
}

function profilKaydet() {
  const ad = $('#p-ad').value.trim();
  if (!ad) { salla('#p-ad'); return; }
  const okul = $('[data-alan="profilOkul"].secili');
  veri.profil = { ...veri.profil, ad, okul: okul ? okul.dataset.deger : veri.profil.okul };
  kaydetVeCiz('Profil kaydedildi');
}

function gelirKaydet() {
  const t = durum.taslak;
  const tutar = sayi(t.gelirTutari);
  if (t.gelirDuzeni === 'gunluk' && !t.harclikGunleri.length) { salla('.secenek-kart.secili .gun-cipleri'); return; }
  if (tutar <= 0) { salla('[data-taslak="gelirTutari"]'); return; }
  if (!maasAraligiGecerli(t)) return;
  const maasGunuSon = t.gelirDuzeni === 'aylik' ? maasGunuSonDuzelt(t) : 0;
  // Tarihi artık değişmeyen gelirin eski "yattı" işaretleri dönem hesabını kaydırmasın
  if (!maasGunuSon) gelisIsaretleriniTemizle('ana');
  veri.profil = {
    ...veri.profil, gelirDuzeni: t.gelirDuzeni, gelirTutari: tutar, maasGunu: maasGunuDuzelt(t.maasGunu), maasGunuSon,
    harclikGunu: Number(t.harclikGunu), harclikGunleri: t.harclikGunleri.slice(), tatildeHarclik: t.tatildeHarclik !== false
  };
  sheetKapat();
  kaydetVeCiz('Gelir düzeni kaydedildi');
}

// ---------- Ek gelirler ----------

function ekGelirTaslagi(id, tarih) {
  const e = id && veri.ekGelirler.find(x => x.id === id);
  if (e) return { ad: e.ad, tutar: e.tutar, tekrar: e.tekrar, gun: e.gun || 1, degisken: Number(e.gunSon) > e.gun, gunSon: e.gunSon || '', haftaGunu: e.haftaGunu ?? 5, tarih: e.tarih || bugunStr() };
  return { ad: '', tutar: '', tekrar: tarih ? 'tek' : 'aylik', gun: 1, degisken: false, gunSon: '', haftaGunu: 5, tarih: tarih || bugunStr() };
}

// Gelirin günlük limite etkisi (Gelir ekle sayfasındaki ön izleme)
function ekGelirOnizlemeHtml(t) {
  const x = sayi(t.tutar), g = durum.g;
  if (!x || !g) return '';
  const bilgi = m => `${ikon('bilgi', 16)}<span>${m}</span>`;
  if (t.tekrar === 'tek') {
    if (!t.tarih) return '';
    if (t.tarih < g.donem.efBasS) return bilgi('Geçmiş bir döneme eklenir; bugünkü limitini değiştirmez.');
    if (t.tarih > g.donem.sonS) return bilgi(`${uzunTarih(t.tarih)} geldiği dönemin bütçesine eklenir.`);
    return bilgi(`${donemIyelik(g)} bütçesine eklenir; ${t.tarih <= bugunStr() ? `günlük limitin yaklaşık <b>${para(x / g.kalanGun)}</b> artar.` : 'geldiği günden sonra limitine yansır.'}`);
  }
  const aylik = t.tekrar === 'aylik' ? x : x * 52 / 12;
  const ek = t.tekrar === 'aylik' && g.donemAdi === 'hafta' ? `Haftalara bölünür: her haftaya yaklaşık <b>${para(x * 7 / 30.4375)}</b> eklenir. `
    : t.tekrar === 'haftalik' ? `Ayda yaklaşık <b>${para(aylik)}</b>. ` : '';
  return bilgi(`${ek}Günlük limitin ortalama <b>${para(aylik / 30.44)}</b> artar.${t.tekrar === 'aylik' && t.degisken && g.donemAdi === 'ay' ? ' Yatana kadar en geç güne göre planlarım.' : ''}`);
}

function ekGelirOnizle() {
  const el = $('#eg-onizleme');
  if (el) el.innerHTML = ekGelirOnizlemeHtml(durum.taslak);
}

// Bir gelirin "yattı" (tarih) işaretlerini siler; "gelmedi" işaretleri kalır
function gelisIsaretleriniTemizle(kaynak, hepsi = false) {
  Object.keys(veri.gelirKayit).forEach(k => {
    if (k.startsWith(kaynak + '|') && (hepsi || veri.gelirKayit[k] !== 'yok')) delete veri.gelirKayit[k];
  });
}

function ekGelirKaydet() {
  const t = durum.taslak, id = durum.sheetId;
  const ad = String(t.ad || '').trim(), tutar = sayi(t.tutar);
  if (!ad) { salla('[data-taslak="ad"]'); return; }
  if (tutar <= 0) { salla('[data-taslak="tutar"]'); return; }
  const e = { ad, tutar, tekrar: t.tekrar };
  if (t.tekrar === 'aylik') {
    e.gun = maasGunuDuzelt(t.gun);
    if (t.degisken) {
      const son = Math.round(sayi(t.gunSon));
      if (!(son > e.gun && son <= 31)) { salla('[data-taslak="gunSon"]'); return; }
      e.gunSon = son;
    }
  } else if (t.tekrar === 'haftalik') e.haftaGunu = Number(t.haftaGunu);
  else {
    if (!t.tarih) { salla('[data-taslak="tarih"]'); return; }
    e.tarih = t.tarih;
  }
  const eski = id && veri.ekGelirler.find(x => x.id === id);
  if (eski) {
    if (eski.tekrar !== e.tekrar) gelisIsaretleriniTemizle(id, true);
    else if (!e.gunSon) gelisIsaretleriniTemizle(id);
    veri.ekGelirler[veri.ekGelirler.indexOf(eski)] = { id, ...e, bas: e.tekrar === 'tek' ? e.tarih : eski.bas || bugunStr() };
  } else {
    // Aynı gün aynı tutarda bir kerelik gelir zaten varsa önce sor
    const ayni = e.tekrar === 'tek' && veri.ekGelirler.find(x => x.tekrar === 'tek' && x.tarih === e.tarih && Math.abs(x.tutar - e.tutar) < 0.5);
    if (ayni && !t.ciftOnay) {
      t.ciftOnay = true;
      $('#eg-onizleme').innerHTML = `${ikon('uyari', 16)}<span>${tarihGoster(e.tarih)} için <b>${esc(ayni.ad)}</b> (${para(ayni.tutar)}) zaten ekli. Aynı geliri tekrar mı giriyorsun?</span>`;
      $('[data-eylem="ek-gelir-kaydet"]').textContent = 'Yine de ekle';
      return;
    }
    veri.ekGelirler.push({ id: yeniId(), ...e, bas: e.tekrar === 'tek' ? e.tarih : bugunStr(), ...(ayni ? { ciftOnay: true } : {}) });
  }
  sheetKapat();
  kaydetVeCiz(eski ? 'Gelir güncellendi' : `${ad} eklendi · limitin güncellendi`);
}

function ulasimKaydet() {
  const u = durum.taslak.ulasim;
  if (!ulasimGecerli(u)) return;
  veri.ulasim = ulasimNormal(u);
  ulasimKartiEsitle(veri);
  sheetKapat();
  kaydetVeCiz('Ulaşım kaydedildi');
}

function listeDegistir(dizi, deger) {
  const i = dizi.indexOf(deger);
  if (i >= 0) dizi.splice(i, 1); else dizi.push(deger);
  return i < 0;
}

function ikiAdimliSil(el, islem, mesaj) {
  if (!el.classList.contains('onay')) {
    el.classList.add('onay');
    const s = el.querySelector('span');
    if (s) s.textContent = 'Silmek için tekrar dokun';
    return;
  }
  islem();
  sheetKapat();
  kaydetVeCiz(mesaj);
}

function formSec(el) {
  const { alan, deger } = el.dataset;
  $$(`[data-alan="${alan}"]`, el.parentElement).forEach(b => b.classList.toggle('secili', b === el));
  if (alan === 'kurulumOkul') {
    const k = durum.kurulum;
    k.okul = deger;
    // Maskot seçime tepki verir ve sözü değişir
    const soz = $('#k-maskot-soz');
    if (soz && soz.textContent !== tanisSozu(k)) {
      soz.textContent = tanisSozu(k);
      maskotZiplat($('.kur-maskot .maskot'));
      maskotZiplat(soz);
    }
  } else durum.form[alan] = deger;
  if (alan === 'tur') { const ip = $('#tur-ipucu'); if (ip) ip.textContent = TUR_IPUCU[deger]; }
  tutarIpucuGuncelle();
}

// ---------- Olaylar ----------

uygulama.addEventListener('click', e => {
  const el = e.target.closest('[data-eylem]');
  if (!el || !uygulama.contains(el)) return;
  const { eylem, id } = el.dataset;

  switch (eylem) {
    case 'sekme': {
      const s = el.dataset.sekme;
      durum.sifirlaOnay = false;
      if (s !== durum.sekme) { sekmeyeGec(s); ciz(); }
      // Açık sekmeye yeniden dokunmak: alt ekrandaysa sekmenin başına döner, değilse en üste kayar
      else if (durum.yigin.length) { durum.yigin = []; durum.gecis = 'geri'; ciz(); }
      else { const k = $('.kaydir:not(.cikis)'); if (k) k.scrollTo({ top: 0, behavior: hareketAzaltilmis() ? 'auto' : 'smooth' }); }
      turOlay('sekme-' + durum.sekme);
      break;
    }
    case 'alt': durum.yigin.push(el.dataset.ekran); durum.gecis = 'ileri'; ciz(); break;
    case 'geri': durum.yigin.pop(); durum.sifirlaOnay = false; durum.gecis = 'geri'; ciz(); break;

    case 'harcama-ekle': titret(); sheetAc('harcama'); break;
    case 'harcama-detay': sheetAc('harcamaDetay', id); break;
    case 'limit-bilgi': sheetAc('limitBilgi'); break;
    case 'hedef-yeni': sheetAc('hedefYeni'); break;
    case 'hedef-detay': durum.form = { cep: true }; sheetAc('hedefDetay', id); break;
    case 'sabit-yeni': sheetAc('sabitYeni'); break;
    case 'sabit-detay': sheetAc('sabitDetay', id); break;
    case 'plan-yeni': sheetAc('planYeni', el.dataset.tarih); break;
    case 'alsam': sheetAc('alsam'); break;
    case 'alsam-gec': sonraAc(() => sheetAc('alsam')); break;
    case 'alsam-bekle': alsamBekle(); break;
    case 'alsam-al': alsamAl(); break;
    case 'alsam-vazgec': alsamVazgec(); break;
    case 'alsam-hedef': alsamHedef(); break;
    case 'bekle-detay': if (durum.sheet) sonraAc(() => sheetAc('bekleDetay', id)); else sheetAc('bekleDetay', id); break;
    case 'bekle-vazgec': bekleVazgec(id); break;
    case 'bekle-al': bekleAl(id); break;
    case 'bekle-sil': ikiAdimliSil(el, () => { veri.istekListesi = veri.istekListesi.filter(x => x.id !== id); }, 'Listeden çıkarıldı'); break;
    case 'plan-detay': sheetAc('planDetay', id); break;
    case 'plan-harcadim':
      if (durum.sheet) { sheetKapat(); setTimeout(() => sheetAc('harcama', id), 330); }
      else sheetAc('harcama', id);
      break;
    case 'gelir-duzen': durum.taslak = profilTaslagi(); sheetAc('gelirDuzen'); break;
    case 'ek-gelir-yeni': durum.taslak = ekGelirTaslagi(null, el.dataset.tarih); sheetAc('ekGelir'); break;
    case 'ek-gelir-detay': sheetAc('ekGelirDetay', id); break;
    case 'ek-gelir-duzenle': sonraAc(() => { durum.taslak = ekGelirTaslagi(id); sheetAc('ekGelir', id); }); break;
    case 'ek-gelir-oneri': Object.assign(durum.taslak, { ad: el.dataset.ad, tekrar: el.dataset.tekrar }); sheetYenile(); break;
    case 'ek-gelir-kaydet': ekGelirKaydet(); break;
    case 'ek-gelir-sil':
      ikiAdimliSil(el, () => {
        gelisIsaretleriniTemizle(id, true);
        veri.ekGelirler = veri.ekGelirler.filter(e => e.id !== id);
      }, 'Gelir silindi');
      break;
    case 'ulasim-duzen': durum.taslak = profilTaslagi(); sheetAc('ulasimDuzen'); break;
    case 'sheet-kapat': sheetKapat(); break;

    case 'tus': titret(); tusBas(el.dataset.tus); break;
    case 'form-sec': formSec(el); break;
    case 'form-anahtar':
      el.classList.toggle('acik');
      durum.form[el.dataset.alan] = el.classList.contains('acik');
      break;

    case 'taslak': {
      const t = aktifTaslak();
      yolAta(t, el.dataset.alan, el.dataset.deger);
      if (el.dataset.alan === 'gelirDuzeni') t.duzenSecildi = true;
      taslakYenile();
      break;
    }
    case 'taslak-gun': taslakGun(el); break;
    case 'taslak-anahtar': {
      const t = aktifTaslak();
      yolAta(t, el.dataset.alan, !yolOku(t, el.dataset.alan));
      if ('yenile' in el.dataset) { taslakYenile(); break; }   // açılınca yeni alan beliren anahtarlar
      el.classList.toggle('acik');
      const oz = $('#ulasim-ozet');
      if (oz) oz.innerHTML = ulasimOzetHtml(t.ulasim);
      break;
    }
    case 'odeme-sec': {
      const k = durum.kurulum, a = el.dataset.anahtar;
      if (a in k.odemeler) delete k.odemeler[a];
      else k.odemeler[a] = hazirOdemeler(k.okul).find(o => o.anahtar === a).tutar;
      ciz();
      break;
    }
    case 'hedef-oneri':
      durum.kurulum.hedef = { emoji: el.dataset.emoji, ad: el.dataset.ad, tutar: el.dataset.tutar };
      ciz();
      break;

    case 'harcama-kaydet': harcamaKaydet(); break;
    case 'harcama-sil':
      ikiAdimliSil(el, () => {
        veri.planlar.forEach(p => { if (p.harcamaId === id) delete p.harcamaId; });
        veri.harcamalar = veri.harcamalar.filter(h => h.id !== id);
      }, 'Harcama silindi');
      break;
    case 'sabit-kaydet': sabitKaydet(); break;
    case 'sabit-sil':
      ikiAdimliSil(el, () => {
        const s = veri.sabitGiderler.find(x => x.id === id);
        if (s && s.ulasimKarti) veri.ulasim = { ...veri.ulasim, tip: 'yok' };
        veri.sabitGiderler = veri.sabitGiderler.filter(x => x.id !== id);
      }, 'Düzenli ödeme silindi');
      break;
    case 'duzenli-birikim': durum.form = { cep: true }; sheetAc('duzenliBirikim'); break;
    case 'duzenli-para': duzenliPara(el.dataset.yon); break;
    case 'birikim-sec': {
      const y = Number(el.dataset.deger);
      if (veri.profil) { veri.profil.birikimYuzdesi = y; kaydetVeCiz(); sheetYenile(); }
      else { durum.kurulum.birikimYuzdesi = y; ciz(); }
      break;
    }
    case 'gelir-isaret': {
      const { tarih, deger } = el.dataset;
      const ad = buyukHarf(gelirAdi(veri.profil));
      if (deger === 'sil') delete veri.gelirIstisna[tarih];
      else veri.gelirIstisna[tarih] = deger;
      kaydetVeCiz(deger === 'yok' ? `${ad} gelmedi olarak işaretlendi` : deger === 'var' ? `${ad} geldi olarak işaretlendi` : 'Geri alındı');
      break;
    }
    case 'gelis-isaret': {
      const { kaynak, anahtar, deger } = el.dataset;
      if (deger === 'sil') delete veri.gelirKayit[`${kaynak}|${anahtar}`];
      else veri.gelirKayit[`${kaynak}|${anahtar}`] = deger;
      kaydetVeCiz(deger === 'sil' ? 'Geri alındı' : deger === 'yok' ? 'Gelmedi olarak işaretlendi'
        : kaynak === 'ana' ? 'Yattı · yeni dönemin başladı' : 'Yattı · limitin güncellendi');
      break;
    }
    case 'cift-ayri': case 'cift-ayri-gelir': {
      // Aynı gün aynı tutardaki benzer kayıtların hepsi "ayrı" sayılır; K41 bir daha sormaz
      const gelir = eylem === 'cift-ayri-gelir';
      const x = (gelir ? veri.ekGelirler : veri.harcamalar).find(k => k.id === id);
      if (!x) break;
      const benzer = gelir ? veri.ekGelirler.filter(k => k.tekrar === 'tek' && k.tarih === x.tarih && Math.abs(k.tutar - x.tutar) < 0.5)
        : [x, ...benzerHarcamalar(x, veri.harcamalar)];
      benzer.forEach(k => { k.ciftOnay = true; });
      sheetKapat();
      kaydetVeCiz('Ayrı kayıtlar olarak işaretlendi');
      break;
    }
    case 'hedef-kaydet': hedefKaydet(); break;
    case 'hedef-para': hedefPara(el.dataset.yon); break;
    case 'hedef-sil': ikiAdimliSil(el, () => { veri.hedefler = veri.hedefler.filter(h => h.id !== id); }, 'Hedef silindi'); break;
    case 'plan-kaydet': planKaydet(); break;
    case 'plan-sil': ikiAdimliSil(el, () => planSil(id), 'Plan silindi'); break;
    case 'gelir-kaydet': gelirKaydet(); break;
    case 'ulasim-kaydet': ulasimKaydet(); break;

    case 'gun-sec': {
      const t = el.dataset.tarih;
      durum.seciliGun = t;
      const d = tarihCoz(t);
      durum.takvimAy = new Date(d.getFullYear(), d.getMonth(), 1);
      if (durum.sekme !== 'takvim') sekmeyeGec('takvim');
      else if (durum.yigin.length) { durum.yigin = []; durum.gecis = 'geri'; }
      ciz();
      const detay = $('.gun-detay');
      if (detay && el.closest('.grup')) detay.scrollIntoView({ block: 'center', behavior: 'smooth' });
      break;
    }
    case 'takvim-ay': {
      const a = durum.takvimAy;
      durum.takvimAy = new Date(a.getFullYear(), a.getMonth() + Number(el.dataset.yon), 1);
      durum.takvimYon = Number(el.dataset.yon) > 0 ? 'ileri' : 'geri';
      ciz();
      break;
    }
    case 'takvim-bugun': {
      const b = new Date();
      const buAy = new Date(b.getFullYear(), b.getMonth(), 1);
      durum.takvimYon = buAy > durum.takvimAy ? 'ileri' : 'geri';
      durum.takvimAy = buAy;
      durum.seciliGun = bugunStr();
      ciz();
      break;
    }
    case 'ulasim-atla': {
      const t = el.dataset.tarih;
      const eklendi = listeDegistir(veri.ulasimAtlanan, t);
      kaydetVeCiz(eklendi ? `Ulaşım yok · ${para(ulasimGunlukMaliyet(veri.ulasim))} limitine eklendi` : 'Ulaşım geri eklendi');
      break;
    }
    case 'tatil-isaretle': {
      const eklendi = listeDegistir(veri.tatiller, el.dataset.tarih);
      kaydetVeCiz(eklendi ? 'İzinli gün olarak işaretlendi' : 'İzinli gün işareti kaldırıldı');
      break;
    }

    case 'neden':
      acikNedenler.has(id) ? acikNedenler.delete(id) : acikNedenler.add(id);
      ciz();
      turOlay('neden');
      break;
    case 'profil-kaydet': profilKaydet(); break;
    case 'mod': modDegistir(el); break;
    case 'geri-bildirim': if (GERI_BILDIRIM_URL) window.open(GERI_BILDIRIM_URL, '_blank', 'noopener'); break;
    case 'sifirla':
      if (!durum.sifirlaOnay) { durum.sifirlaOnay = true; ciz(); break; }
      durum.sifirlaOnay = false;
      veri = { ...bosVeri(), ayarlar: { ...veri.ayarlar, tur: null, turAtlanma: null, turHatirlatmaKapali: false } };
      durum.sekme = 'bugun';
      durum.yigin = [];
      durum.tur = null;
      durum.takvimAy = null;
      durum.seciliGun = null;
      durum.kurulum = yeniKurulum();
      kaydetVeCiz('Tüm veriler silindi');
      break;

    case 'kurulum-ileri': kurulumIleri(); break;
    case 'kurulum-geri': kurulumGeri(); break;
    case 'kurulum-atla': kurulumAtla(); break;
    case 'kurulum-bitir': kurulumBitir(); break;

    case 'tur-baslat': turBaslat(); break;
    case 'tur-ileri': turIleri(); break;
    case 'tur-atla': turBitir('atlandi'); break;
    default: borcEylemi(eylem, el) || ekstreEylemi(eylem, el) || hatirlatmaEylemi(eylem, el) || sesEylemi(eylem) || fisEylemi(eylem, el) || rankEylemi(eylem);
  }
});

uygulama.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.taslak) {
    yolAta(aktifTaslak(), el.dataset.taslak, el.value);
    const oz = $('#ulasim-ozet');
    if (oz) oz.innerHTML = ulasimOzetHtml(aktifTaslak().ulasim);
    const sure = $('#k-hedef-sure');
    if (sure && !durum.sheet) sure.textContent = hedefSureMetni(durum.kurulum);
  }
  if (durum.sheet === 'hedefYeni') hedefOnizleme();
  if (durum.sheet === 'planYeni') planOnizleme();
  if (durum.sheet === 'ekGelir') {
    if (durum.taslak.ciftOnay) { durum.taslak.ciftOnay = false; const d = $('[data-eylem="ek-gelir-kaydet"]'); if (d) d.textContent = durum.sheetId ? 'Kaydet' : 'Ekle'; }
    ekGelirOnizle();
  }
});

// Klavye: tuş takımı açıkken rakamlar, Enter ile onay, Esc ile kapat
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && durum.sheet) { sheetKapat(); return; }
  const aktif = document.activeElement;
  const yaziyor = aktif && ['INPUT', 'TEXTAREA', 'SELECT'].includes(aktif.tagName);

  if (e.key === 'Enter' && aktif && aktif.id === 'ses-girdi') { e.preventDefault(); sesEylemi('ses-anla'); return; }
  if (e.key === 'Enter' && yaziyor) {
    const hedef = durum.sheet ? $('.sheet [data-enter], .sheet .dugme.ana') : !veri.profil ? $('.kur-alt .dugme.ana') : null;
    if (hedef) { e.preventDefault(); hedef.click(); }
    return;
  }
  if (yaziyor || !$('.tus-takimi')) return;
  if (/^[0-9]$/.test(e.key)) { e.preventDefault(); tusBas(e.key); }
  else if (e.key === ',' || e.key === '.') { e.preventDefault(); tusBas(','); }
  else if (e.key === 'Backspace') { e.preventDefault(); tusBas('sil'); }
  else if (e.key === 'Enter') { const b = $('[data-enter]'); if (b) { e.preventDefault(); b.click(); } }
});

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', temaUygula);
window.addEventListener('resize', turKonumla);

// ---------- Masaüstü sunum ekranı (telefon çerçevesinin yanındaki tanıtım) ----------

function tanitimCiz() {
  const t = $('#tanitim');
  if (!t) return;
  t.innerHTML = `
    <div class="tanitim-logo">${damlaLogo(56)}<span class="yazi-logo">Damly</span></div>
    <h2>Damlaya damlaya <span>göl olur.</span></h2>
    <p>Harcamalarını günlük takip eden, bütçeni paranın geliş düzenine göre otomatik planlayan ve kural tabanlı uzman sistemiyle sana gerekçeli öneriler veren akıllı harcama asistanı.</p>
    <ul>
      <li><span class="kat-ikon" style="--renk:#2563EB">${ikon('cuzdan', 18)}</span>Harçlık, burs, part-time: her gelirin düzenine göre dinamik limit</li>
      <li><span class="kat-ikon" style="--renk:#FF8A3D">${ikon('takvim', 18)}</span>Akıllı takvim: ulaşım, tatil ve planlı harcamalar</li>
      <li><span class="kat-ikon" style="--renk:#12B886">${ikon('damla', 18)}</span>Kumbara hedefleri ve birikim planı</li>
      <li><span class="kat-ikon" style="--renk:#4C6EF5">${ikon('canta', 18)}</span>"Alsam mı?" ve 7 günlük bekleme listesi</li>
      <li><span class="kat-ikon" style="--renk:#AE3EC9">${ikon('cip', 18)}</span>${KURALLAR.length} kurallı açıklanabilir uzman sistem</li>
      <li><span class="kat-ikon" style="--renk:#E8590C">${ikon('kilit', 18)}</span>Veriler yalnızca cihazda kalır</li>
    </ul>
    <div class="tanitim-alt">TÜBİTAK 2204 · Finansal Okuryazarlık Projesi</div>`;
}

function saatGuncelle() {
  const s = $('#durum-saat');
  if (s) s.textContent = saatStr();
}

function acilisGoster() {
  const el = document.createElement('div');
  el.className = 'acilis';
  el.innerHTML = `${damlaLogo(88)}<span class="yazi-logo">Damly</span>`;
  uygulama.appendChild(el);
  setTimeout(() => el.classList.add('gizle'), 1150);
  setTimeout(() => el.remove(), 1700);
}

// ---------- Başlat ----------
tanitimCiz();
saatGuncelle();
setInterval(saatGuncelle, 15000);
acilisGoster();
const aktarilan = birikimAktar();
ciz();
if (aktarilan) setTimeout(() => bildirim(`Geçen dönemden ${para(aktarilan)} kumbarana aktarıldı`), 1500);
yereleGonder({ tur: 'hazir' });
// Kurulum bitip tur yarıda kaldıysa yeniden başlat
if (veri.profil && veri.ayarlar.tur === 'bekliyor') setTimeout(turBaslat, 1300);
