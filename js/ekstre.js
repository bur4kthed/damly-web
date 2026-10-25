// ============================================================
// ekstre.js — KART EKSTRESİNİ YÜKLEME VE EŞLEŞTİRME
// Bankanın verdiği ekstre (PDF ya da CSV) cihazın içinde yazıya çevrilir.
// Satırlar kural tabanlı okunur: işlem satırı = tarih + açıklama + tutar;
// ödeme, iade, faiz/ücret ve taksit satırları ayrılır; dönem borcu, son
// ödeme tarihi ve asgari ödeme özetten alınır. Harcamalar kayıtlı
// harcamalarla tutar ve tarihe göre eşleştirilir; kaydedilmemiş olanlar
// kullanıcı onayıyla eklenir, kart borcu ekstreye göre güncellenir.
//
// Gizlilik: dosya hiçbir yere gönderilmez (PDF → vendor/pdfjs, cihazda).
// ============================================================

// ---------- Dosyayı satırlara çevirme ----------
// Her satır: { metin, hucreler: [{ t, x, r }] }. x/r hücrenin sol/sağ kenarıdır;
// tutar, başlıktaki "Tutar" sütununa en yakın hücreden seçilir.

let pdfjsSozu = null;
function pdfjsYukle() {
  if (!pdfjsSozu) {
    pdfjsSozu = (async () => {
      // Android uygulamasında dosyalar HTML'e metin olarak gömülüdür (scripts/paketle.mjs)
      const gomulu = window.DAMLY_PDFJS;
      const blobAdresi = kod => URL.createObjectURL(new Blob([kod], { type: 'text/javascript' }));
      const kok = new URL('vendor/pdfjs/', location.href).href;
      const pdfjs = await import(gomulu ? blobAdresi(gomulu.kutuphane) : kok + 'pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = gomulu ? blobAdresi(gomulu.isci) : kok + 'pdf.worker.min.mjs';
      return pdfjs;
    })().catch(e => { pdfjsSozu = null; throw e; });
  }
  return pdfjsSozu;
}

// Aynı yükseklikteki parçalar bir satır; aralarında boşluk kadar açıklık olanlar bir hücredir
function parcaSatirlari(parcalar) {
  const p = parcalar.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const satirlar = [];
  for (const x of p) {
    const son = satirlar[satirlar.length - 1];
    if (son && Math.abs(x.y - son.y) < Math.max(2, Math.min(x.h, son.h) * 0.5)) son.parcalar.push(x);
    else satirlar.push({ y: x.y, h: x.h, parcalar: [x] });
  }
  return satirlar.map(s => {
    const hucreler = [];
    for (const x of s.parcalar.sort((a, b) => a.x - b.x)) {
      const son = hucreler[hucreler.length - 1];
      if (son && x.x - son.r < s.h * 0.4) { son.t += (x.x - son.r > s.h * 0.1 ? ' ' : '') + x.t; son.r = Math.max(son.r, x.x + x.w); }
      else hucreler.push({ t: x.t, x: x.x, r: x.x + x.w });
    }
    hucreler.forEach(h => { h.t = h.t.replace(/\s+/g, ' ').trim(); });
    return { metin: hucreler.map(h => h.t).join('  '), hucreler: hucreler.filter(h => h.t) };
  });
}

async function pdfSatirlari(dosya, sifre) {
  const pdfjs = await pdfjsYukle();
  const gorev = pdfjs.getDocument({ data: new Uint8Array(await dosya.arrayBuffer()), password: sifre || undefined, isEvalSupported: false });
  const satirlar = [];
  try {
    const belge = await gorev.promise;
    for (let s = 1; s <= Math.min(belge.numPages, 20); s++) {
      const { items } = await (await belge.getPage(s)).getTextContent();
      satirlar.push(...parcaSatirlari(items.filter(i => i.str && i.str.trim()).map(i => ({
        t: i.str, x: i.transform[4], y: -i.transform[5], w: i.width, h: Math.abs(i.transform[3]) || i.height || 8
      }))));
    }
  } finally { gorev.destroy(); }
  return satirlar;
}

// CSV / metin: ayıracı (; sekme ,) ilk satırlardan bulur, tırnaklı alanları korur
function csvSatirlari(metin) {
  const satirlarH = String(metin || '').replace(/^﻿/, '').split(/\r?\n/).filter(s => s.trim());
  const ilk = satirlarH.slice(0, 8).join('\n');
  const ayirac = [';', '\t', ','].map(a => [a, ilk.split(a).length]).sort((a, b) => b[1] - a[1])[0][0];
  return satirlarH.map(satir => {
    const hucreler = [];
    let h = '', tirnak = false;
    for (let i = 0; i < satir.length; i++) {
      const c = satir[i];
      if (c === '"') { if (tirnak && satir[i + 1] === '"') { h += '"'; i++; } else tirnak = !tirnak; }
      else if (c === ayirac && !tirnak) { hucreler.push(h); h = ''; }
      else h += c;
    }
    hucreler.push(h);
    const temiz = hucreler.map((t, i) => ({ t: t.trim(), x: i * 100, r: i * 100 + 90 })).filter(x => x.t);
    return { metin: temiz.map(x => x.t).join('  '), hucreler: temiz };
  });
}

// ---------- Okuma kuralları ----------

const AY_KISA = { OCA: 1, ŞUB: 2, SUB: 2, MAR: 3, NİS: 4, NIS: 4, MAY: 5, HAZ: 6, TEM: 7, AĞU: 8, AGU: 8, EYL: 9, EKİ: 10, EKI: 10, KAS: 11, ARA: 12 };
const TARIH_SAYI = /(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?!\d)/;
const TARIH_AY = /(?<![\p{L}\d])(\d{1,2})\s+(OCA|ŞUB|SUB|MAR|N[İI]S|MAY|HAZ|TEM|AĞU|AGU|EYL|EK[İI]|KAS|ARA)\p{L}*\.?\s+(\d{4})(?!\d)/u;
// Tutar: 1.234,56 (Türkçe) ya da 1,234.56; hemen önünde ya da arkasında + / − olabilir
const TUTAR_KALIBI = /(?<![\d.,])([-+−])?(?:(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})|(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2}))(?![\d.,]\d)([-+−])?/g;

function tarihBul(s) {
  let m = s.match(TARIH_SAYI), g, a, y;
  if (m) [, g, a, y] = m;
  else if ((m = buyukHarfTr(s).match(TARIH_AY))) { [, g, , y] = m; a = AY_KISA[m[2].slice(0, 3)]; }
  else return null;
  const yil = String(y).length === 2 ? 2000 + Number(y) : Number(y);
  const d = new Date(yil, Number(a) - 1, Number(g));
  if (d.getDate() !== Number(g) || d.getMonth() !== Number(a) - 1) return null;
  return { tarih: tarihStr(d), metin: m[0], konum: m.index };
}

// Hücredeki tutarlar (tarihler önce silinir); alacak: işaretli ya da "Alacak" sütununda
function hucreTutarlari(hucre) {
  const t = hucre.t.replace(new RegExp(TARIH_SAYI.source, 'g'), m => ' '.repeat(m.length)).replace(/%\s?\d+([.,]\d+)?/g, ' ');
  const sonuc = [];
  for (const m of t.matchAll(TUTAR_KALIBI)) {
    const tam = m[2] ?? m[4], kurus = m[3] ?? m[5];
    const deger = Number(tam.replace(/[.,]/g, '')) + Number(kurus) / 100;
    const isaret = m[1] || m[6] || '';
    sonuc.push({ deger, alacak: isaret === '-' || isaret === '−' || isaret === '+', metin: m[0], hucre });
  }
  return sonuc;
}

// Kalıplar Türkçe harfleri sadeleştirilmiş büyük harfli metne uygulanır (ÖDEME ile ODEME aynı)
const TR_SADE = { Ö: 'O', Ü: 'U', Ş: 'S', Ç: 'C', Ğ: 'G', İ: 'I' };
function sadeBuyuk(s) { return buyukHarfTr(s).replace(/[ÖÜŞÇĞİ]/g, c => TR_SADE[c]); }
const EKSTRE_KALIPLARI = {
  odeme: /ODEMENIZ|TAHSILAT|HESAPTAN\s*(OTOMATIK\s*)?ODEME|OTOMATIK\s*ODEME|KART\s*ODEMESI|BORC\s*ODEME|^(\S+\s+)?ODEME\b|TESEKKUR/,
  iade: /IADE|\bIPTAL\b/,
  puan: /BONUS|MAXI?PUAN|WORLDPUAN|PARAPUAN|CHIP-?PARA|\bPUAN\b/,
  faiz: /FAIZI?\b|\bK\.?K\.?D\.?F\b|\bB\.?S\.?M\.?V\b|GECIKME/,
  ucret: /(KART|UYELIK|YILLIK|HESAP\s*ISLETIM|NAKIT\s*AVANS|EKSTRE|SMS|LIMIT\s*ASIM)\s*(UCRETI?|BEDELI?)\b|\bAIDAT\b/,
  taksit: /TAKSIT|\bTKS\b|\(\s*\d{1,2}\s*\/\s*\d{1,2}\s*\)/
};
const OZET_KALIPLARI = {
  donemBorcu: /DONEM\s*BORCU|HESAP\s*OZETI\s*BORCU|EKSTRE\s*BORCU|ODENMESI\s*GEREKEN|TOPLAM\s*BORC\b|GUNCEL\s*BORC\b/,
  asgari: /ASGARI\s*ODEME/,
  sonOdeme: /SON\s*ODEME\s*(TARIH|GUNU)/,
  kesim: /KESIM\s*TARIH|EKSTRE\s*TARIH/
};
const OZET_ADLARI = { donemBorcu: 'dönem borcu', asgari: 'asgari ödeme', sonOdeme: 'son ödeme tarihi', kesim: 'hesap kesim tarihi' };

// Özet alanı: değer etiketle aynı hücrede, yanındaki hücrede ya da alt satırlarda aynı hizadadır
function ozetDegeri(satirlar, i, j, alan) {
  const tarihMi = alan === 'sonOdeme' || alan === 'kesim';
  const oku = h => {
    if (tarihMi) { const t = tarihBul(h.t); return t && t.tarih; }
    const t = hucreTutarlari(h);
    return t.length ? (t[0].alacak ? 0 : t[0].deger) : null;
  };
  const etiketVar = h => Object.values(OZET_KALIPLARI).some(k => k.test(sadeBuyuk(h.t)));
  const hucre = satirlar[i].hucreler[j];
  const kalan = { ...hucre, t: hucre.t.slice(sadeBuyuk(hucre.t).search(OZET_KALIPLARI[alan])) };
  let d = oku(kalan);
  if (d != null) return d;
  for (const h of satirlar[i].hucreler.slice(j + 1, j + 3)) { if (etiketVar(h)) break; if ((d = oku(h)) != null) return d; }
  const orta = (hucre.x + hucre.r) / 2;
  for (const s of satirlar.slice(i + 1, i + 3)) {
    const aday = s.hucreler.map(h => ({ h, d: oku(h), uzak: Math.min(Math.abs((h.x + h.r) / 2 - orta), Math.abs(h.r - hucre.r), Math.abs(h.x - hucre.x)) }))
      .filter(x => x.d != null && !etiketVar(x.h)).sort((a, b) => a.uzak - b.uzak)[0];
    if (aday && aday.uzak < Math.max(60, hucre.r - hucre.x)) return aday.d;
  }
  return null;
}

// İşletme adını baş harfleri büyük yazar. Ekstreler çoğu zaman Türkçe harfsiz büyük harflidir
// ("MIGROS KADIKOY"); Türkçe kurala göre küçültmek "Mıgros" yapacağı için Türkçe harf
// içermeyen kelimeler düz küçültülür ("KIRTASİYE" → "Kırtasiye", "MIGROS" → "Migros").
function ekstreAdi(s) {
  return s.replace(/\p{L}[\p{L}\d.&']*/gu, k => {
    const tr = /[ŞĞÜÖÇİışğüöç]/.test(k);
    const kucuk = tr ? k.toLocaleLowerCase('tr') : k.toLowerCase();
    return (tr ? kucuk[0].toLocaleUpperCase('tr') : kucuk[0].toUpperCase()) + kucuk.slice(1);
  });
}

// Ekstreyi okur: { islemler[], ozet{}, gerekceler[] }
// islem: { no, tarih, aciklama, tutar, cins: harcama|taksit|odeme|iade|faiz|ucret|puan, taksit, kategori, tur, satir }
function ekstreCoz(satirlar, bugun = new Date()) {
  const B = satirlar.map(s => sadeBuyuk(s.metin));
  const gerekceler = [];
  const ozet = { donemBorcu: null, asgari: null, sonOdeme: null, kesim: null };
  const kisa = s => s.length > 38 ? s.slice(0, 37) + '…' : s;

  // --- Sütun başlıkları: "Tutar", "Borç" / "Alacak" ---
  let sutun = null;
  satirlar.forEach((s, i) => {
    if (sutun || !/TARIH/.test(B[i])) return;
    const hucre = ad => s.hucreler.filter(h => ad.test(sadeBuyuk(h.t)));
    const tutar = hucre(/^(ISLEM\s*)?TUTARI?(\s*\(?(TL|TRY|₺)\)?)?$|^TUTAR/).filter(h => !/USD|EUR|DOVIZ/.test(sadeBuyuk(h.t)));
    const alacak = hucre(/^ALACAK/), borc = hucre(/^BORC$|^BORC\s*\(/);
    if (tutar.length || alacak.length) {
      sutun = { tutar: tutar[tutar.length - 1] || borc[0] || null, alacak: alacak[0] || null };
      gerekceler.push([`“${kisa(s.metin)}”`, 'sütun başlıkları; tutarlar bu hizadan alındı']);
    }
  });
  const yakinlik = (a, h) => a ? Math.min(Math.abs(a.r - h.r), Math.abs((a.x + a.r) / 2 - (h.x + h.r) / 2)) : Infinity;

  // --- Özet: dönem borcu, asgari, son ödeme, kesim ---
  satirlar.forEach((s, i) => s.hucreler.forEach((h, j) => {
    const u = sadeBuyuk(h.t);
    for (const [alan, kalip] of Object.entries(OZET_KALIPLARI)) {
      if (ozet[alan] != null || !kalip.test(u) || /ONCEKI|GECEN/.test(u)) continue;
      const d = ozetDegeri(satirlar, i, j, alan);
      if (d == null) continue;
      ozet[alan] = d;
      gerekceler.push([`“${kisa(h.t)}”`, `${OZET_ADLARI[alan]} ${typeof d === 'number' ? kurusluPara(d) : tarihGoster(d, true)}`]);
    }
  }));

  // --- İşlem satırları: tarihle başlar, açıklaması ve tutarı vardır ---
  const enGec = tarihStr(new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate() + 31));
  const enErken = tarihStr(new Date(bugun.getFullYear() - 1, bugun.getMonth(), bugun.getDate()));
  const islemler = [];
  satirlar.forEach((s, i) => {
    const t = tarihBul(s.metin);
    if (!t || t.konum > 2 || t.tarih > enGec || t.tarih < enErken) return;
    const tutarlar = s.hucreler.flatMap(hucreTutarlari);
    if (!tutarlar.length) return;
    // Birden çok tutar varsa (döviz, puan sütunu…) "Tutar" sütununa en yakını; yoksa sondaki
    let secilen = tutarlar[tutarlar.length - 1];
    if (sutun && tutarlar.length > 1) {
      secilen = tutarlar.slice().sort((a, b) => Math.min(yakinlik(sutun.tutar, a.hucre), yakinlik(sutun.alacak, a.hucre)) - Math.min(yakinlik(sutun.tutar, b.hucre), yakinlik(sutun.alacak, b.hucre)))[0];
    }
    const alacak = secilen.alacak || !!(sutun && sutun.alacak && sutun.tutar && yakinlik(sutun.alacak, secilen.hucre) < yakinlik(sutun.tutar, secilen.hucre));
    // Açıklama: tarihler, tutarlar, para birimleri ve taksit bilgisi çıkarılır
    let aciklama = s.metin;
    tutarlar.forEach(x => { aciklama = aciklama.replace(x.metin, ' '); });
    const taksitM = aciklama.match(/(?<!\d)(\d{1,2})\s*\/\s*(\d{1,2})(?!\d)/);
    aciklama = aciklama.replace(new RegExp(TARIH_SAYI.source, 'g'), ' ').replace(new RegExp(TARIH_AY.source, 'giu'), ' ')
      .replace(/(?<![\p{L}])(TL|TRY|USD|EUR|GBP)(?![\p{L}])|₺/gu, ' ').replace(/\*{2,}\s*\d{4}/g, ' ');
    const u = buyukHarfTr(aciklama).replace(/\s+/g, ' ').trim(), a = sadeBuyuk(u);
    if ((u.match(/\p{L}/gu) || []).length < 2) return;
    // Alacak (eksi işaretli) satır iade ya da ödemedir; harcama sayılmaz
    let cins = 'harcama';
    if (EKSTRE_KALIPLARI.iade.test(a)) cins = 'iade';
    else if (EKSTRE_KALIPLARI.puan.test(a)) cins = 'puan';
    else if (EKSTRE_KALIPLARI.odeme.test(a) || alacak) cins = 'odeme';
    else if (EKSTRE_KALIPLARI.faiz.test(a)) cins = 'faiz';
    else if (EKSTRE_KALIPLARI.ucret.test(a)) cins = 'ucret';
    let taksit = null;
    if (taksitM && Number(taksitM[2]) >= 2 && Number(taksitM[1]) >= 1 && Number(taksitM[1]) <= Number(taksitM[2]) && EKSTRE_KALIPLARI.taksit.test(a)) {
      taksit = `${taksitM[1]}/${taksitM[2]}`;
      if (cins === 'harcama') cins = 'taksit';
    }
    aciklama = aciklama.replace(/\(?\s*\d{1,2}\s*\/\s*\d{1,2}\s*\)?/g, ' ').replace(trKalip(/\bTAKS[İI]T\b|\bTKS\b/gi), ' ')
      .replace(/(?<![\p{L}\d/])\d+(?![\p{L}\d/])/gu, ' ').replace(/\(\s*\)|[|]/g, ' ')
      .replace(/\s+/g, ' ').replace(/^[\s\-–:.()]+|[\s\-–:.()]+$/g, '');
    const islem = { no: islemler.length, tarih: t.tarih, aciklama: ekstreAdi(aciklama).slice(0, 40), tutar: Math.round(secilen.deger * 100) / 100, cins, taksit, kategori: null, tur: null, satir: s.metin };
    if (cins === 'harcama' || cins === 'taksit') {
      const e = ISLETME_SOZLUGU.find(([kalip]) => kalip.test(u));
      if (e) [, islem.kategori, islem.tur] = e;
      else {
        const kucuk = aciklama.toLocaleLowerCase('tr');
        const s2 = SES_SOZLUGU.filter(([kok]) => kokEslesir(kucuk, kok)).sort((a, b) => b[0].length - a[0].length)[0];
        if (s2) [, islem.kategori, islem.tur] = s2;
      }
    }
    if (islem.tutar > 0) islemler.push(islem);
  });

  if (islemler.length) {
    const say = c => islemler.filter(x => x.cins === c).length;
    gerekceler.push([`${islemler.length} satır`, 'tarih + açıklama + tutar biçiminde işlem']);
    const ornek = c => islemler.find(x => x.cins === c);
    if (say('odeme')) gerekceler.push([`“${kisa(ornek('odeme').satir)}”`, 'kart ödemesi, harcama sayılmadı']);
    if (say('iade')) gerekceler.push([`“${kisa(ornek('iade').satir)}”`, 'iade, harcama sayılmadı']);
    if (say('faiz') + say('ucret')) gerekceler.push([`“${kisa((ornek('faiz') || ornek('ucret')).satir)}”`, 'faiz / ücret, borca eklenir']);
    if (say('taksit')) gerekceler.push([`“${kisa(ornek('taksit').satir)}”`, 'taksit, ayrı gösterildi']);
  }
  return { islemler, ozet, gerekceler };
}

// ---------- Kayıtlı harcamalarla eşleştirme ----------
// Aynı tutar (elle yuvarlanmış olabilir: ₺1 ya da %2 pay) ve en çok 3 gün fark.
// Bu kartla girilmiş harcama, ödeme şekli seçilmemiş olana göre önceliklidir;
// başka karta bağlı harcamalar aday olmaz; her harcama tek bir satırla eşleşir.
function ekstreEslestir(islemler, kartId, harcamalar = veri.harcamalar) {
  const satirlar = islemler.filter(x => x.cins === 'harcama' || x.cins === 'taksit');
  const tarihler = islemler.map(x => x.tarih).sort();
  if (!tarihler.length) return { eslesen: new Map(), disarida: [] };
  const kaydir = (t, n) => { const d = tarihCoz(t); d.setDate(d.getDate() + n); return tarihStr(d); };
  const bas = kaydir(tarihler[0], -3), son = kaydir(tarihler[tarihler.length - 1], 3);
  const adaylar = harcamalar.filter(h => h.tarih >= bas && h.tarih <= son && (!h.kartId || h.kartId === kartId));
  const ciftler = [];
  satirlar.forEach(x => adaylar.forEach(h => {
    const gun = Math.abs(gunFarki(tarihCoz(x.tarih), tarihCoz(h.tarih)));
    const fark = Math.abs(Number(h.tutar) - x.tutar), pay = Math.max(1, x.tutar * 0.02);
    if (gun <= 3 && fark <= pay) ciftler.push({ x, h, puan: gun + 2 * fark / pay + (h.kartId === kartId ? 0 : 1.5) });
  }));
  ciftler.sort((a, b) => a.puan - b.puan);
  const eslesen = new Map(), kullanilan = new Set();
  for (const c of ciftler) {
    if (eslesen.has(c.x.no) || kullanilan.has(c.h.id)) continue;
    eslesen.set(c.x.no, c.h.id);
    kullanilan.add(c.h.id);
  }
  // Kartla girilmiş ama bu ekstrede görünmeyenler (sonraki ekstreye kalmış olabilir)
  const disarida = adaylar.filter(h => h.kartId === kartId && !h.kartEslesti && !kullanilan.has(h.id) && h.tarih >= tarihler[0] && h.tarih <= tarihler[tarihler.length - 1]);
  return { eslesen, disarida };
}

// ============================================================
// ARAYÜZ: kart detayındaki "Ekstre yükle" sayfası
// ============================================================

const ekstre = {};
function ekstreKapat() { Object.assign(ekstre, { durum: null, sonuc: null, not: '', dosya: null, secili: new Set(), borcGuncelle: true, kayitliAcik: false }); }
ekstreKapat();

const EKSTRE_DOSYA_TURU = 'application/pdf,.pdf,text/csv,.csv,text/plain,.txt';

function ekstreSatiri(x, secilebilir) {
  const k = kategori(x.kategori || 'diger');
  const secili = ekstre.secili.has(x.no);
  const ic = `<span class="kat-ikon kucuk" style="--renk:${k.renk}">${ikon(k.ikon, 16)}</span>
    <span class="satir-orta"><b>${esc(x.aciklama || 'Kart harcaması')}</b><small>${tarihGoster(x.tarih)}${x.taksit ? ` · ${x.taksit}. taksit` : ''}${x.kategori ? ` · ${k.ad}` : ''}</small></span>
    <span class="ekstre-tutar">${kurusluPara(x.tutar)}</span>`;
  if (!secilebilir) return `<div class="ekstre-satir">${ic}</div>`;
  return `<div class="odeme-satir ${secili ? 'secili' : ''}">
    <button class="odeme-sec" data-eylem="ekstre-sec" data-no="${x.no}">${ic}<span class="onay-kutu">${ikon('onay', 14)}</span></button>
  </div>`;
}

const EKSTRE_SHEETLERI = {
  ekstre(id) {
    const b = veri.borclar.find(x => x.id === id);
    if (!b) return '';
    const girdi = `<input id="ekstre-dosya" type="file" accept="${EKSTRE_DOSYA_TURU}" hidden>`;
    const baslik = sheetBaslik('Ekstre yükle');

    if (!ekstre.durum || ekstre.durum === 'hata') {
      return `${baslik}
      <div class="detay-ust">
        <span class="kat-ikon buyuk" style="--renk:${BORC_TURLERI.kart.renk}">${ikon('belge', 28)}</span>
        <b>${esc(borcAdi(b))}</b>
      </div>
      ${ekstre.durum === 'hata' ? `<div class="ses-panel"><span class="ses-metin">${ekstre.not}</span></div>` : ''}
      <p class="sheet-metin">Bankanın uygulamasından ya da e-postandan ekstreyi <b>PDF</b> (ya da CSV) olarak indir ve seç. Ekstredeki harcamaları kayıtlarınla karşılaştırırım: kaydetmediklerini gösteririm, dönem borcunu ve son ödeme gününü kartına yazarım.</p>
      <p class="sheet-metin kucuk-not">${ikon('kilit', 14)} Dosya telefonunun içinde okunur, hiçbir yere gönderilmez.</p>
      ${girdi}
      <button class="dugme ana genis" data-eylem="ekstre-sec-dosya">${ikon('belge', 18)} Ekstreyi seç</button>`;
    }
    if (ekstre.durum === 'okunuyor') {
      return `${baslik}
      <div class="ses-panel"><div class="ses-ust"><span class="ses-dalga" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        <span class="ses-metin">Ekstre okunuyor…${ekstre.not ? `<small>${ekstre.not}</small>` : ''}</span></div></div>`;
    }
    if (ekstre.durum === 'sifre') {
      return `${baslik}
      <p class="sheet-metin">Bu PDF şifreli. Bankanın e-postasında yazan ekstre şifresini gir; şifre yalnızca dosyayı açmak için kullanılır, kaydedilmez.</p>
      ${ekstre.not ? `<div class="ses-panel"><span class="ses-metin">${ekstre.not}</span></div>` : ''}
      <label class="alan"><span>PDF şifresi</span><input id="ekstre-sifre" type="password" autocomplete="off"></label>
      <button class="dugme ana genis" data-eylem="ekstre-sifre" data-enter>Aç</button>`;
    }

    // --- Sonuç ---
    const s = ekstre.sonuc;
    const harcamalar = s.islemler.filter(x => x.cins === 'harcama' || x.cins === 'taksit');
    const eksik = harcamalar.filter(x => !s.eslesen.has(x.no));
    const kayitli = harcamalar.filter(x => s.eslesen.has(x.no));
    const faizler = s.islemler.filter(x => x.cins === 'faiz' || x.cins === 'ucret');
    const odemeler = s.islemler.filter(x => x.cins === 'odeme'), iadeler = s.islemler.filter(x => x.cins === 'iade');
    const o = s.ozet;
    const seciliSayi = eksik.filter(x => ekstre.secili.has(x.no)).length;
    const borcSatiri = o.donemBorcu != null
      ? `<button class="anahtar-satir ${ekstre.borcGuncelle ? 'acik' : ''}" data-eylem="ekstre-borc">
          <span class="satir-orta"><b>Kart borcunu ${kurusluPara(o.donemBorcu)} yap</b><small>${o.sonOdeme ? `Son ödeme günü ayın ${tarihCoz(o.sonOdeme).getDate()}'i olur` : `Şu an ${para(b.borc)}`}</small></span><span class="anahtar"></span>
        </button>` : '';
    return `${baslik}
    <div class="grup">
      ${o.donemBorcu != null ? bilgiSatiri('Dönem borcu', kurusluPara(o.donemBorcu)) : ''}
      ${o.sonOdeme ? bilgiSatiri('Son ödeme', uzunTarih(o.sonOdeme)) : ''}
      ${o.asgari != null ? bilgiSatiri('Asgari ödeme', kurusluPara(o.asgari)) : ''}
      ${bilgiSatiri('Harcamalar', `${harcamalar.length} işlem · ${kurusluPara(toplam(harcamalar))}`)}
    </div>
    ${faizler.length ? `<div class="ses-panel uyari-panel"><span class="ses-metin"><b>${kurusluPara(toplam(faizler))} faiz ve ücret</b><small>${faizler.map(x => esc(x.aciklama)).slice(0, 3).join(', ')}. Bu para hiçbir şey almadan bankaya ödenir; borcun tamamını son ödeme gününe kadar ödersen faiz işlemez.</small></span></div>` : ''}
    ${eksik.length ? `<div class="alan"><span>Kaydetmediğin harcamalar <em>· ${eksik.length} işlem, ${kurusluPara(toplam(eksik))}</em></span>
      <div class="odeme-listesi">${eksik.map(x => ekstreSatiri(x, true)).join('')}</div>
      <small class="alan-not">Seçtiklerin ekstredeki tarihleriyle harcama olarak eklenir. Kategori işletme adından tahmin edildi; tahmin edilemeyenler Diğer olur.</small></div>`
      : harcamalar.length ? `<div class="ses-panel"><span class="ses-metin"><b>Harika, hepsi kayıtlı</b><small>Ekstredeki ${harcamalar.length} harcamanın hepsini zaten girmişsin.</small></span></div>` : ''}
    ${kayitli.length ? `<details class="ekstre-detay" ${ekstre.kayitliAcik ? 'open' : ''}><summary>Zaten kayıtlı · ${kayitli.length} işlem</summary>${kayitli.map(x => ekstreSatiri(x, false)).join('')}</details>` : ''}
    ${odemeler.length || iadeler.length || s.disarida.length ? `<p class="sheet-metin">${[
      odemeler.length ? `${odemeler.length} kart ödemesi (${kurusluPara(toplam(odemeler))})` : '',
      iadeler.length ? `${iadeler.length} iade (${kurusluPara(toplam(iadeler))})` : ''].filter(Boolean).join(' ve ')}${odemeler.length || iadeler.length ? ' harcama sayılmadı. ' : ''}${s.disarida.length ? `Kartla girdiğin ${s.disarida.length} harcama bu ekstrede yok; sonraki ekstrede çıkabilir.` : ''}</p>` : ''}
    ${borcSatiri}
    <div class="ses-gerekce"><b>Nasıl okudum?</b>${s.gerekceler.map(([a, c]) => `<span>${esc(a)} → ${c}</span>`).join('')}</div>
    <button class="dugme ana genis" data-eylem="ekstre-uygula">${seciliSayi ? `${seciliSayi} harcamayı ekle` : 'Kaydet'}</button>`;
  }
};

// ---------- Okuma akışı ----------

async function ekstreOku(dosya, sifre) {
  const kartId = durum.sheetId;
  ekstre.dosya = dosya;
  ekstre.durum = 'okunuyor';
  const pdf = /pdf$/i.test(dosya.type) || /\.pdf$/i.test(dosya.name);
  ekstre.not = pdf && !window.DAMLY_PDFJS && !pdfjsSozu ? 'PDF okuyucu ilk seferde yükleniyor (yaklaşık 2 MB).' : '';
  sheetYenile();
  try {
    const satirlar = pdf ? await pdfSatirlari(dosya, sifre) : csvSatirlari(metinCoz(await dosya.arrayBuffer()));
    if (durum.sheet !== 'ekstre' || durum.sheetId !== kartId) return;
    const sonuc = ekstreCoz(satirlar);
    if (!sonuc.islemler.length) {
      return ekstreHata(satirlar.length ? 'Bu dosyada kart işlemi bulamadım. Bankanın verdiği PDF ekstreyi ya da CSV dosyasını seç.'
        : 'Dosyada yazı bulamadım; taranmış bir resim olabilir. Bankanın uygulamasından indirilen PDF ekstreyi seç.');
    }
    const { eslesen, disarida } = ekstreEslestir(sonuc.islemler, kartId);
    ekstre.sonuc = { ...sonuc, eslesen, disarida };
    // Kaydedilmemiş harcamalar baştan seçili; taksitler (çoğu daha önce alınmış) seçili gelmez
    ekstre.secili = new Set(sonuc.islemler.filter(x => x.cins === 'harcama' && !eslesen.has(x.no)).map(x => x.no));
    ekstre.borcGuncelle = sonuc.ozet.donemBorcu != null;
    ekstre.durum = 'sonuc';
    sheetYenile();
    titret();
  } catch (e) {
    if (durum.sheet !== 'ekstre') return;
    if (e && e.name === 'PasswordException') {
      ekstre.durum = 'sifre';
      ekstre.not = sifre ? 'Şifre yanlış, tekrar dene.' : '';
      sheetYenile();
      setTimeout(() => { const g = $('#ekstre-sifre'); if (g) g.focus(); }, 50);
      return;
    }
    ekstreHata('Bu dosya okunamadı. Bankanın verdiği PDF ekstreyi ya da CSV dosyasını seç.');
  }
}

// Bankaların CSV dosyaları UTF-8 ya da Windows-1254 (Türkçe) olabilir
function metinCoz(tampon) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(tampon); }
  catch { return new TextDecoder('windows-1254').decode(tampon); }
}

function ekstreHata(not) { ekstre.durum = 'hata'; ekstre.not = not; sheetYenile(); }

// ---------- Uygulama: eşleştir, ekle, kart borcunu güncelle ----------
function ekstreUygula() {
  const b = veri.borclar.find(x => x.id === durum.sheetId);
  const s = ekstre.sonuc;
  if (!b || !s) return;
  const bugunS = bugunStr();
  const harcamalar = s.islemler.filter(x => x.cins === 'harcama' || x.cins === 'taksit');
  let dusulenEk = 0;
  const eklenen = [];
  for (const x of harcamalar) {
    const h = s.eslesen.has(x.no) && veri.harcamalar.find(y => y.id === s.eslesen.get(x.no));
    if (h) {
      // Elle girilmiş harcama bu ekstrenin içinde; limitten zaten düştüğü için kart ödemesinden ayrılmaz
      h.kartId = b.id;
      if (!h.kartEslesti) { h.kartEslesti = true; dusulenEk += Number(h.tutar); }
    } else if (ekstre.secili.has(x.no)) {
      const yeni = { id: yeniId(), tutar: x.tutar, kategori: x.kategori || 'diger', tur: x.tur || 'ihtiyac', aciklama: x.aciklama, tarih: x.tarih, saat: '',
        kartId: b.id, kartEslesti: true, kaynak: 'ekstre', ciftOnay: true };
      veri.harcamalar.push(yeni);
      eklenen.push(yeni);
      dusulenEk += x.tutar;
    }
  }
  const o = s.ozet;
  if (ekstre.borcGuncelle && o.donemBorcu != null) {
    b.borc = o.donemBorcu;
    if (o.sonOdeme) b.gun = tarihCoz(o.sonOdeme).getDate();
    const oran = o.asgari != null && b.borc > 0 ? Math.round(o.asgari / b.borc * 100) : 0;
    if (oran >= 5 && oran <= 100) b.asgari = oran;
    if (b.odeme === 'ozel' && b.borc < 1) b.odeme = 'tam';
  }
  b.dusulen = Math.min(Number(b.borc) || 0, (Number(b.dusulen) || 0) + dusulenEk);
  // Kayıt alışkanlığı (K43) için önceki aylardan kalan taksitler sayılmaz
  const donemin = harcamalar.filter(x => !x.taksit || x.taksit.startsWith('1/'));
  const eksik = donemin.filter(x => !s.eslesen.has(x.no));
  b.ekstre = {
    yuklendi: bugunS, kesim: o.kesim || null, harcamaSayisi: donemin.length, harcamaToplam: toplam(donemin),
    eksikSayi: eksik.length, eksikToplam: toplam(eksik), eklenen: eklenen.length,
    faiz: toplam(s.islemler.filter(x => x.cins === 'faiz' || x.cins === 'ucret')), faizSatir: s.islemler.filter(x => x.cins === 'faiz' || x.cins === 'ucret').length
  };
  sheetKapat();
  kaydetVeCiz(eklenen.length ? `${eklenen.length} harcama eklendi · ekstre eşleştirildi` : 'Ekstre eşleştirildi');
}

// Tıklama olayları (arayuz.js'teki ana dinleyiciden çağrılır); işlenmediyse false
function ekstreEylemi(eylem, el) {
  switch (eylem) {
    case 'ekstre-yukle':
      ekstreKapat();
      if (durum.sheet) sonraAc(() => sheetAc('ekstre', el.dataset.id)); else sheetAc('ekstre', el.dataset.id);
      return true;
    case 'ekstre-sec-dosya': { const g = $('#ekstre-dosya'); if (g) { g.value = ''; g.click(); } return true; }
    case 'ekstre-sifre': {
      const sifre = ($('#ekstre-sifre') || {}).value || '';
      if (!sifre) { salla('#ekstre-sifre'); return true; }
      if (ekstre.dosya) ekstreOku(ekstre.dosya, sifre);
      return true;
    }
    case 'ekstre-sec': {
      const no = Number(el.dataset.no);
      if (ekstre.secili.has(no)) ekstre.secili.delete(no); else ekstre.secili.add(no);
      sheetYenile();
      return true;
    }
    case 'ekstre-borc': ekstre.borcGuncelle = !ekstre.borcGuncelle; sheetYenile(); return true;
    case 'ekstre-uygula': ekstreUygula(); return true;
  }
  return false;
}

// Seçim değişince sayfa yeniden çizilir; açılır listenin açık kalması için durumu saklanır
document.addEventListener('toggle', e => {
  if (e.target.classList && e.target.classList.contains('ekstre-detay')) ekstre.kayitliAcik = e.target.open;
}, true);

document.addEventListener('change', e => {
  if (e.target.id === 'ekstre-dosya' && e.target.files && e.target.files[0]) ekstreOku(e.target.files[0]);
});
