// ============================================================
// dil.js — DİL SEÇENEĞİ (Türkçe / English)
// Uygulama Türkçe yazılır. English seçilince ekrana gelen her yazı bu
// dosyadaki çevirmenden geçer: sayfa değiştikçe (MutationObserver) metin
// düğümleri ile aria-label, placeholder ve title öznitelikleri çevrilir.
// Aranmadan önce metindeki tutar, sayı, yüzde, tarih ve “tırnaklı” adlar
// {0}, {1}… yer tutucularına dönüşür; böylece "Bugün ₺120 kaldı" ile
// "Bugün ₺80 kaldı" sözlükte tek kayıttır. Yer tutucular İngilizce biçimde
// geri yazılır (₺1.250 → ₺1,250 · %40 → 40% · 28 Ekim Çarşamba → Wednesday,
// October 28). Kullanıcının yazdığı adlar için sözlükte {a}, {b} gibi
// joker yerler kullanılır. Sözlük: js/dil-en.js
// ============================================================

const DILLER = { tr: 'Türkçe', en: 'English' };
let DIL = 'tr';

function dilAyarla(kod) {
  DIL = DILLER[kod] ? kod : 'tr';
  document.documentElement.lang = DIL;
  if (DIL === 'en') cevirmeniBaslat();
}

// Kayıtlı seçim yoksa tarayıcının dili
function varsayilanDil() {
  return String((typeof navigator !== 'undefined' && navigator.language) || 'tr').toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

// ---------- Yer tutucular: sayı, tutar, yüzde, saat, tarih, tırnaklı ad ----------

const { YER_TUTUCU, degerCevir } = (() => {
  const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const AYLAR_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const GUNLER_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const GUNLER_KISA_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const HARF = 'A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû';
  const kucuk = s => s.toLocaleLowerCase('tr');
  const gunSirasi = s => { const i = GUNLER_TR.findIndex(g => kucuk(g) === kucuk(s)); return i >= 0 ? i : GUNLER_KISA_TR.indexOf(s); };
  const ayAdi = '(' + AYLAR.join('|') + '|' + AYLAR_KISA.join('|') + ')';
  const gunAdi = '(' + GUNLER_TR.slice().sort((a, b) => b.length - a.length).join('|') + ')';
  const gunKisa = '(' + GUNLER_KISA_TR.join('|') + ')';
  // Uzun seçenek önce: "28 Ekim 2026", "28 Ekim Çarşamba", "3 Kas Pzt", "Ekim 2026", "28 Eki", tek başına gün adı
  const YER_TUTUCU = new RegExp([
    `(\\d{1,2}) ${ayAdi}(?: (\\d{4}))?(?: (?:${gunAdi}|${gunKisa}))?(?![${HARF}])`,
    `${ayAdi} (\\d{4})`,
    `(?<![${HARF}])${gunAdi}(?![${HARF}])`,
    `(?<![${HARF}])(${GUNLER_KISA_TR.join('|')})(?![${HARF}])`,
    '“[^”]{1,60}”', '"[^"]{1,60}"',
    '\\d{1,2}:\\d{2}',
    '[−+-]?₺\\s?\\d[\\d.,]*', '[−+-]?%\\d[\\d.,]*', '\\d[\\d.,]*'
  ].map(x => '(?:' + x + ')').join('|'), 'gi');

  function sayiCevir(s) {
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+,\d+$/.test(s)) {
      const [tam, ondalik] = s.split(',');
      return Number(tam.replace(/\./g, '')).toLocaleString('en-US') + (ondalik !== undefined ? '.' + ondalik : '');
    }
    return s;
  }

  function tarihParcasiCevir(s) {
    const p = s.split(' ');
    const ay = x => { const i = AYLAR.indexOf(x); return i >= 0 ? MONTHS[i] : MONTHS[AYLAR_KISA.indexOf(x)].slice(0, 3); };
    const gun = x => { const i = gunSirasi(x); return GUNLER_TR.includes(x) || GUNLER_TR.some(g => kucuk(g) === kucuk(x)) ? DAYS[i] : DAYS[i].slice(0, 3); };
    if (/^\d/.test(p[0])) {
      const [n, a, ...geri] = p;
      const yil = geri.find(x => /^\d{4}$/.test(x)), hg = geri.find(x => !/^\d/.test(x));
      return `${hg ? gun(hg) + ', ' : ''}${ay(a)} ${n}${yil ? ', ' + yil : ''}`;
    }
    if (p.length === 2) return `${ay(p[0])} ${p[1]}`;
    const i = GUNLER_KISA_TR.indexOf(p[0]);
    return i >= 0 ? DAYS[i].slice(0, 3) : gun(p[0]);
  }

  function degerCevir(s) {
    if (/^[“"]/.test(s)) {
      const ic = s.slice(1, -1);
      return s[0] + (SOZLUK_EN[ic] || ic) + s[s.length - 1];
    }
    if (/^\d{1,2}:\d{2}$/.test(s)) return s;
    const m = s.match(/^([−+-]?)([₺%]?)\s?(\d[\d.,]*)$/);
    if (m) {
      // Sayının sonundaki nokta cümle sonudur ("₺120.")
      let sayiS = m[3], son = '';
      if (/[.,]$/.test(sayiS)) { son = sayiS.slice(-1); sayiS = sayiS.slice(0, -1); }
      const n = sayiCevir(sayiS);
      return m[2] === '%' ? `${m[1]}${n}%${son}` : `${m[1]}${m[2]}${n}${son}`;
    }
    return tarihParcasiCevir(s);
  }

  return { YER_TUTUCU, degerCevir };
})();

// ---------- Çevirmen ----------

const cevrilmeyen = new Set();      // sözlükte bulunamayan kalıplar (dil testi için)
let jokerler = null;

// Sözlükte {a}, {b}… içeren anahtarlar: herhangi bir metni (ör. kullanıcının yazdığı adı) yakalar
function jokerleriHazirla() {
  jokerler = Object.keys(SOZLUK_EN).filter(k => /\{[a-z]\}/.test(k)).map(k => {
    const adlar = [];
    const kalip = k.split(/(\{[a-z]\}|\{\d+\})/).map(p => {
      if (/^\{[a-z]\}$/.test(p)) { adlar.push(p[1]); return '(.+?)'; }
      return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    return { re: new RegExp('^' + kalip + '$', 's'), adlar, hedef: SOZLUK_EN[k], ozgulluk: k.replace(/\{[a-z]\}/g, '').length };
  }).sort((a, b) => b.ozgulluk - a.ozgulluk);
}

// Bir metni çevirir; bulunamazsa Türkçesi kalır (yer tutucular yine İngilizce biçimde yazılır)
function cevir(metin) {
  if (DIL === 'tr' || metin == null) return metin;
  const s = String(metin);
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü%₺\d]/.test(s)) return s;
  const duz = s.replace(/\s+/g, ' ').trim();
  // Baştaki ve sondaki boşluk korunur; çeviri noktalamayla başlıyorsa ("günü bitecek." → ".") baştaki düşer
  const sar = y => (/^\s/.test(s) && !/^[.,;:!?)]/.test(y) ? ' ' : '') + y + (/\s$/.test(s) && !/[(“"]$/.test(y) ? ' ' : '');
  if (Object.prototype.hasOwnProperty.call(SOZLUK_EN, duz)) return sar(SOZLUK_EN[duz]);

  const degerler = [];
  const kalip = duz.replace(YER_TUTUCU, x => `{${degerler.push(x) - 1}}`);
  const doldur = (hedef, joker = {}) => hedef
    .replace(/\{(\d+)\}/g, (x, i) => degerler[i] !== undefined ? degerCevir(degerler[i]) : x)
    .replace(/\{([a-z])\}/g, (x, a) => joker[a] !== undefined ? joker[a] : x);

  if (Object.prototype.hasOwnProperty.call(SOZLUK_EN, kalip)) return sar(doldur(SOZLUK_EN[kalip]));
  // Yalnızca sayı, tarih, noktalama: biçimi çevrilir
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(kalip.replace(/\{\d+\}/g, ''))) return sar(doldur(kalip));

  // Emoji ile başlayan ad (hedef: "🎧 Kulaklık"): emojiden sonrası çevrilir
  const emoji = duz.match(/^(\p{Extended_Pictographic}\S*) (.+)$/u);
  if (emoji) return sar(emoji[1] + ' ' + cevir(emoji[2]));

  if (!jokerler) jokerleriHazirla();
  for (const j of jokerler) {
    const m = kalip.match(j.re);
    if (!m) continue;
    const joker = {};
    j.adlar.forEach((a, i) => { joker[a] = cevir(m[i + 1].replace(/\{(\d+)\}/g, (x, n) => degerler[n])); });
    return sar(doldur(j.hedef, joker));
  }
  if (kalip.length > 2) cevrilmeyen.add(kalip);   // tek harf: avatardaki baş harf
  return sar(doldur(kalip));
}

// ---------- Sayfadaki yazıları çevirme ----------

const CEVRILEN_OZNITELIKLER = ['aria-label', 'placeholder', 'title'];
let gozcu = null;
// Çevirinin yazdığı İngilizce metin yeniden çevrilmesin (ör. "Per day" içindeki "Per" Perşembe sanılmasın)
const yazilan = new WeakMap();

function dugumCevir(d) {
  if (DIL === 'tr') return;
  if (d.nodeType === 3) {
    const ust = d.parentElement;
    if (!ust || ust.closest('[data-cevirme], script, style, textarea')) return;
    if (yazilan.get(d) === d.data) return;
    const y = cevir(d.data);
    if (y !== d.data) { d.data = y; yazilan.set(d, y); }
    return;
  }
  if (d.nodeType !== 1 || d.closest('[data-cevirme]')) return;
  for (const el of [d, ...d.querySelectorAll('*')]) {
    if (el.closest('[data-cevirme]')) continue;
    for (const a of CEVRILEN_OZNITELIKLER) {
      ozniteliCevir(el, a);
    }
  }
  const yuruyen = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
  for (let t = yuruyen.nextNode(); t; t = yuruyen.nextNode()) dugumCevir(t);
}

function ozniteliCevir(el, a) {
  const v = el.getAttribute(a);
  if (!v) return;
  const once = yazilan.get(el) || {};
  if (once[a] === v) return;
  const y = cevir(v);
  if (y !== v) { el.setAttribute(a, y); once[a] = y; yazilan.set(el, once); }
}

function cevirmeniBaslat() {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined' || !document.body) return;
  dugumCevir(document.body);
  if (gozcu) return;
  gozcu = new MutationObserver(kayitlar => {
    if (DIL === 'tr') return;
    for (const k of kayitlar) {
      if (k.type === 'childList') k.addedNodes.forEach(dugumCevir);
      else if (k.type === 'characterData') dugumCevir(k.target);
      else if (k.type === 'attributes') {
        if (!k.target.closest('[data-cevirme]')) ozniteliCevir(k.target, k.attributeName);
      }
    }
  });
  gozcu.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: CEVRILEN_OZNITELIKLER });
}

// Dil seçimi (kurulumun ilk ekranında ve Profil'de). Seçenekler her dilde kendi adıyla yazılır.
function dilSecimi() {
  return `<div class="segment dil-secim" data-cevirme>${Object.entries(DILLER).map(([kod, ad]) =>
    `<button class="${DIL === kod ? 'secili' : ''}" data-eylem="dil" data-deger="${kod}">${ad}</button>`).join('')}</div>`;
}
