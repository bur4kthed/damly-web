// ============================================================
// fis.js — FİŞ FOTOĞRAFINDAN HARCAMA EKLEME
// Fişin fotoğrafı cihazın içinde yazıya çevrilir, satırlar konumlarına göre
// birleştirilir ve kural tabanlı olarak okunur: toplam tutar, tarih, saat,
// işletme adı ve kategori. Her çıkarımın gerekçesi gösterilir; form yalnızca
// doldurulur, kaydetme kararı kullanıcıdadır.
//
// Gizlilik: fotoğraf hiçbir yere gönderilmez.
//   Android uygulaması → ML Kit, cihaz içi (mobil/modules/damly-fis)
//   Tarayıcı           → Tesseract, tarayıcının içinde (vendor/tesseract)
// ============================================================

// ---------- Satırları birleştirme ----------
// Yazı tanıma fişi parça parça okur ("TOPLAM" solda, "*85,50" sağda ayrı parçalar).
// Dikey ortası yakın parçalar aynı satır sayılır ve soldan sağa dizilir.
function fisSatirlari(parcalar) {
  const p = (parcalar || []).filter(x => String(x.t || '').trim())
    .map(x => ({ ...x, orta: x.y + x.h / 2 })).sort((a, b) => a.orta - b.orta);
  const yukseklik = p.map(x => x.h).sort((a, b) => a - b)[Math.floor(p.length / 2)] || 10;
  const satirlar = [];
  for (const x of p) {
    const son = satirlar[satirlar.length - 1];
    if (son && Math.abs(x.orta - son.orta) < yukseklik * 0.6) { son.parcalar.push(x); son.orta = (son.orta + x.orta) / 2; }
    else satirlar.push({ orta: x.orta, parcalar: [x] });
  }
  return satirlar.map(s => s.parcalar.sort((a, b) => a.x - b.x).map(x => x.t.trim()).join('  '));
}

// JavaScript'in \b sınırı Türkçe harfleri (Ş, İ, Ü…) tanımaz; Türkçeye uygun sınır kullanılır
const TR_SINIR = '(?:(?<=[\\p{L}\\d])(?![\\p{L}\\d])|(?<![\\p{L}\\d])(?=[\\p{L}\\d]))';
function trKalip(kalip) { return new RegExp(kalip.source.replace(/\\b/g, TR_SINIR), kalip.flags + 'u'); }

// ---------- Fiş sözlüğü: işletme adından kategori ----------
const ISLETME_SOZLUGU = [
  [/M[İI]GROS|\bB[İI]M\b|A ?101|\bŞOK\b|\bSOK MARKET|CARREFOUR|\bMACRO|HAKMAR|\bF[İI]LE\b|TARIM KRED[İI]|BAKKAL|MARKET|ŞARKÜTER[İI]|MANAV|GIDA/, 'market', 'ihtiyac'],
  [/STARBUCKS|KAHVE|COFFEE|\bCAFE\b|\bKAFE|S[İI]M[İI]T SARAYI|PASTANE|BÖREK|FIRIN|FIRINI/, 'yemek', 'istek'],
  [/BURGER|P[İI]ZZA|DÖNER|LOKANTA|RESTORAN|RESTAURANT|KÖFTE|MCDONALD|\bKFC\b|POPEYES|DOMINO|KEBAP|LAHMACUN/, 'yemek', 'istek'],
  [/KANT[İI]N|YEMEKHANE/, 'yemek', 'ihtiyac'],
  [/\bOPET\b|SHELL|PETROL|\bBP\b|TOTAL ?ENERG|AKARYAKIT|OTOPARK|\bAYTEMİZ/, 'ulasim', 'ihtiyac'],
  [/KIRTAS[İI]YE|K[İI]TAP|\bD ?& ?R\b|FOTOKOP[İI]|YAYIN/, 'egitim', 'ihtiyac'],
  [/WAIKIKI|DEFACTO|KOTON|\bMAV[İI]\b|\bZARA\b|\bH ?& ?M\b|BOYNER|\bFLO\b|G[İI]Y[İI]M|TEKST[İI]L|AYAKKABI/, 'giyim', 'istek'],
  [/ECZA|HASTANE|OPT[İI]K|KL[İI]N[İI]K/, 'saglik', 'ihtiyac'],
  [/S[İI]NEMA|CINEMA|C[İI]NEVİZYON|B[İI]LET|OYUN|BOWLING/, 'eglence', 'istek'],
  // Kart ekstrelerinde sık görülen çevrim içi işletmeler
  [/YEMEKSEPET[İI]|GET[İI]R ?YEMEK|TRENDYOL ?YEMEK|M[İI]GROS ?YEMEK/, 'yemek', 'istek'],
  [/\bGET[İI]R\b|M[İI]GROS ?SANAL|[İI]STEGELS[İI]N/, 'market', 'ihtiyac'],
  [/NETFL[İI]X|SPOT[İI]FY|YOUTUBE|D[İI]SNEY|EXXEN|BLUTV|AMAZON ?PR[İI]ME|\bSTEAM\b|PLAYSTAT[İI]ON|\bXBOX\b|APPLE\.COM\/B[İI]LL|GOOGLE ?\*? ?PLAY/, 'eglence', 'istek'],
  [/B[İI]T[İI]AKS[İI]|MART[İI] ?(TAG|SCOOTER)|\bUBER\b|[İI]STANBULKART|ANKARAKART|KENTKART|PEGASUS|\bTHY\b|TÜRK HAVA|TURK HAVA|HAVAYOLU/, 'ulasim', 'ihtiyac']
].map(([kalip, kat, tur]) => [trKalip(kalip), kat, tur]);
const FIS_ATLA = trKalip(/F[İI]Ş|\bF[İI]S\b|TAR[İI]H|SAAT|TEŞEKKÜR|TESEKKUR|HOŞ ?GELD|HOS ?GELD|MERS[İI]S|VERG[İI]|V\.?D\.?|\bTEL\b|ADRES|\bMAH\b|MAHALLE|\bCAD\b|CADDE|\bSOK\b|SOKA|BULVAR|ŞUBE|SUBE|\bNO[:.]/);
const HUKUKI_EK = /(?<![\p{L}\d])(A\.?Ş\.?|A\.?S\.?|LTD\.?|ŞT[İI]\.?|ST[İI]\.?|T[İI]C\.?|SAN\.?|VE|PAZ\.?|İNŞ\.?|MAĞ\.?|MAĞAZACILIK|T[İI]CARET|SANAY[İI]|L[İI]M[İI]TED|Ş[İI]RKET[İI]|ANON[İI]M)(?![\p{L}\d])/gu;

function buyukHarfTr(s) { return String(s || '').toLocaleUpperCase('tr'); }
function basHarfleriBuyuk(s) { return s.toLocaleLowerCase('tr').replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toLocaleUpperCase('tr')); }

// Bir satırdaki tutarlar: "*1.234,56", "85,50", "85.50". Tarih, saat ve yüzdeler önce çıkarılır.
function satirTutarlari(satir) {
  const s = satir
    .replace(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/g, ' ')
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, ' ')
    .replace(/%\s?\d+([.,]\d+)?/g, ' ')
    .replace(/(?<=\d)[OoQ]|[OoQ](?=\d)/g, '0');
  const sonuc = [];
  for (const m of s.matchAll(/(\*)?\s?(\d{1,3}(?:[.\s]\d{3})+|\d+)\s?[,.]\s?(\d{2})(?!\d)/g)) {
    sonuc.push({ deger: Number(m[2].replace(/[.\s]/g, '')) + Number(m[3]) / 100, yildiz: !!m[1] });
  }
  return sonuc;
}

// Fişi okur: { tutar, tarih, saat, isletme, kategori, tur, aciklama, gerekceler[], eksik[], guven }
function fisCoz(satirlar, bugun = new Date()) {
  const B = satirlar.map(buyukHarfTr);
  const gerekceler = [];
  const sonuc = { tutar: 0, tarih: null, saat: null, isletme: '', kategori: null, tur: null, aciklama: '', gerekceler, eksik: [], guven: 'dusuk' };
  const kisa = s => s.length > 34 ? s.slice(0, 33) + '…' : s;

  // --- Toplam tutar: önce TOPLAM satırı, sonra ödeme satırı, en son en büyük yıldızlı tutar ---
  const toplamSatiri = trKalip(/\bGENEL\s*T[O0]PLAM|T[O0]PLAM\s*TUTAR|\bT[O0]PLA[MN]\b|ÖDENECEK|ODENECEK/);
  const haric = /ARA\s*T[O0]PLAM|KDV|T[O0]PKDV|[İI]ND[İI]R[İI]M|MATRAH|PUAN/;
  let bulunan = null;
  B.forEach((s, i) => {
    if (!toplamSatiri.test(s) || haric.test(s)) return;
    let t = satirTutarlari(s), alt = false;
    if (!t.length && B[i + 1]) { t = satirTutarlari(B[i + 1]); alt = true; }  // tutar alt satıra kaymış olabilir
    const d = t.length ? t[t.length - 1].deger : 0;
    if (d > 0 && (!bulunan || /GENEL/.test(s) || d > bulunan.deger)) bulunan = { deger: d, metin: alt ? `${satirlar[i]} ${satirlar[i + 1]}` : satirlar[i] };
  });
  if (bulunan) { sonuc.guven = 'yuksek'; gerekceler.push([`“${kisa(bulunan.metin)}”`, `toplam ${kurusluPara(bulunan.deger)}`]); }
  if (!bulunan) {
    // Ödeme satırı: nakit (para üstü düşülerek) ya da kart
    const odemeKalibi = trKalip(/NAK[İI]T|KRED[İI]\s*KART|BANKA\s*KART|\bKART\b/);
    const odeme = B.findIndex(s => odemeKalibi.test(s) && satirTutarlari(s).length);
    if (odeme >= 0) {
      let d = satirTutarlari(B[odeme]).pop().deger;
      const ustu = B.find(s => /PARA\s*ÜST|PARA\s*UST/.test(s) && satirTutarlari(s).length);
      if (ustu && /NAK[İI]T/.test(B[odeme])) d -= satirTutarlari(ustu).pop().deger;
      if (d > 0) { bulunan = { deger: d }; sonuc.guven = 'orta'; gerekceler.push([`“${kisa(satirlar[odeme])}”`, `ödenen ${kurusluPara(d)}`]); }
    }
  }
  if (!bulunan) {
    const hepsi = B.flatMap(satirTutarlari);
    const aday = (hepsi.some(x => x.yildiz) ? hepsi.filter(x => x.yildiz) : hepsi).sort((a, b) => b.deger - a.deger)[0];
    if (aday) { bulunan = { deger: aday.deger }; gerekceler.push(['en büyük tutar', `${kurusluPara(aday.deger)} (TOPLAM satırı okunamadı, kontrol et)`]); }
  }
  if (bulunan) sonuc.tutar = Math.round(bulunan.deger * 100) / 100;
  else sonuc.eksik.push('tutar');

  // --- Tarih ve saat ---
  const tarihSatiri = B.findIndex(s => /\d{1,2}[./-]\d{1,2}[./-](20)?\d{2}\b/.test(s));
  if (tarihSatiri >= 0) {
    const [, g, a, y] = B[tarihSatiri].match(/(\d{1,2})[./-](\d{1,2})[./-]((?:20)?\d{2})\b/);
    const yil = y.length === 2 ? 2000 + Number(y) : Number(y);
    const d = new Date(yil, Number(a) - 1, Number(g));
    const fark = gunFarki(d, gunBasi(bugun));
    if (d.getDate() === Number(g) && fark >= 0 && fark <= 60) {
      sonuc.tarih = tarihStr(d);
      gerekceler.push([`“${g}.${a}.${y}”`, `tarih ${tarihGoster(sonuc.tarih)}`]);
    } else gerekceler.push([`“${g}.${a}.${y}”`, 'tarih uygun değil, bugün kabul edildi']);
  }
  const saatM = B.join(' ').match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);
  if (saatM) sonuc.saat = `${saatM[1]}:${saatM[2]}`;

  // --- İşletme adı: üstteki ilk anlamlı yazı satırı ---
  for (const [i, s] of B.slice(0, 6).entries()) {
    const harf = (s.match(/\p{L}/gu) || []).length;
    if (harf < 3 || harf / s.replace(/\s/g, '').length < 0.6 || FIS_ATLA.test(s)) continue;
    const temiz = s.replace(HUKUKI_EK, ' ').replace(/[^\p{L}\d&' ]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (temiz.length >= 3) { sonuc.isletme = basHarfleriBuyuk(temiz).slice(0, 30); gerekceler.push([`“${kisa(satirlar[i])}”`, 'işletme adı']); break; }
  }

  // --- Kategori: önce işletme, sonra fişteki ürün adları (sesli girişin sözlüğü) ---
  const tumu = B.join(' ');
  const isletmeEsleme = ISLETME_SOZLUGU.find(([kalip]) => kalip.test(buyukHarfTr(sonuc.isletme)) || kalip.test(tumu));
  if (isletmeEsleme) {
    [, sonuc.kategori, sonuc.tur] = isletmeEsleme;
    gerekceler.push([sonuc.isletme ? `“${sonuc.isletme}”` : 'fişteki adlar', `${kategori(sonuc.kategori).ad} kategorisi`]);
  } else {
    const kucuk = satirlar.join(' ').toLocaleLowerCase('tr');
    const e = SES_SOZLUGU.filter(([kok]) => kokEslesir(kucuk, kok)).sort((a, b) => b[0].length - a[0].length)[0];
    if (e) { [, sonuc.kategori, sonuc.tur] = e; gerekceler.push([`“${e[0]}”`, `${kategori(e[1]).ad} kategorisi`]); }
    else sonuc.eksik.push('kategori');
  }
  sonuc.aciklama = sonuc.isletme;
  return sonuc;
}

// ============================================================
// ARAYÜZ: harcama sayfasındaki fiş düğmesi
// ============================================================

const fis = { durum: null, sonuc: null, not: '', isci: null };

function fisPaneli() {
  return `<div id="fis-panel" class="ses-panel" hidden></div>
    <input id="fis-dosya" type="file" accept="image/*" hidden>`;
}

function fisPanelCiz() {
  const el = $('#fis-panel');
  if (!el) return;
  el.hidden = !fis.durum;
  if (!fis.durum) { el.innerHTML = ''; return; }
  if (fis.durum === 'secim') {
    el.innerHTML = `<div class="ses-ust"><span class="ses-metin">Fişin fotoğrafı<small>Fotoğraf telefonun içinde okunur, hiçbir yere gönderilmez.</small></span></div>
      <div class="dugme-ikili esit">
        <button class="dugme hafif" data-eylem="fis-kaynak" data-deger="kamera">${ikon('kamera', 18)} Fotoğraf çek</button>
        <button class="dugme hafif" data-eylem="fis-kaynak" data-deger="galeri">${ikon('resim', 18)} Galeriden seç</button>
      </div>`;
    return;
  }
  if (fis.durum === 'okunuyor') {
    el.innerHTML = `<div class="ses-ust"><span class="ses-dalga" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
      <span class="ses-metin">Fiş okunuyor…${fis.not ? `<small>${fis.not}</small>` : ''}</span></div>`;
    return;
  }
  if (fis.durum === 'hata') {
    el.innerHTML = `<div class="ses-ust"><span class="ses-metin">${fis.not}</span>
      <button class="ikon-dugme" data-eylem="fis-baslat" aria-label="Yeniden dene">${ikon('kamera', 18)}</button></div>`;
    return;
  }
  const s = fis.sonuc;
  el.innerHTML = `<div class="ses-sonuc">
      <div class="ses-ust"><span class="ses-metin"><b>Fişten okuduklarım</b>${s.guven === 'dusuk' ? '<small>Toplamı emin okuyamadım; tutarı kontrol et.</small>' : ''}</span>
        <button class="ikon-dugme" data-eylem="fis-baslat" aria-label="Başka fiş">${ikon('kamera', 18)}</button></div>
      <div class="ses-gerekce"><b>Nasıl okudum?</b>${s.gerekceler.map(([a, b]) => `<span>${esc(a)} → ${b}</span>`).join('')}
        ${s.eksik.length ? `<span class="eksik">${s.eksik.map(x => x === 'tutar' ? 'Toplamı okuyamadım, tuşlarla gir' : 'Kategoriyi sen seç').join(' · ')}</span>` : ''}
      </div>
    </div>`;
}

// Okunan fişi harcama formuna uygular (kaydetmez)
function fisUygula(satirlar) {
  const s = fisCoz(satirlar);
  fis.sonuc = s;
  fis.durum = 'sonuc';
  if (s.tutar) { durum.tus = String(s.tutar).replace('.', ','); tusYaz(); }
  const sec = (alan, deger) => { const b = $(`.sheet [data-eylem="form-sec"][data-alan="${alan}"][data-deger="${deger}"]`); if (b) formSec(b); };
  if (s.kategori) sec('kategori', s.kategori);
  if (s.tur) sec('tur', s.tur);
  if (s.tarih === dunStr()) sec('tarih', dunStr());
  else if (s.tarih && s.tarih !== bugunStr()) durum.form.tarih = s.tarih;
  if (s.aciklama && $('#h-not')) $('#h-not').value = s.aciklama;
  fisPanelCiz();
  titret();
}

function fisHata(not) { fis.durum = 'hata'; fis.not = not; fisPanelCiz(); }

function fisBaslat() {
  sesKapat(); sesPanelCiz();
  if (yerelUygulama) { fis.durum = 'secim'; fisPanelCiz(); return; }
  const girdi = $('#fis-dosya');
  if (girdi) { girdi.value = ''; girdi.click(); }
}

// ---------- Tarayıcıda okuma (Tesseract, yalnızca gerekince yüklenir) ----------
function betikYukle(adres) {
  return new Promise((tamam, hata) => {
    const s = document.createElement('script');
    s.src = adres; s.onload = tamam; s.onerror = hata;
    document.head.appendChild(s);
  });
}

async function webFisOku(dosya) {
  fis.durum = 'okunuyor';
  fis.not = fis.isci ? '' : 'Okuma modeli ilk seferde yükleniyor (yaklaşık 6 MB); biraz sürebilir.';
  fisPanelCiz();
  try {
    const kok = new URL('vendor/tesseract/', location.href).href;
    if (!window.Tesseract) await betikYukle(kok + 'tesseract.min.js');
    if (!fis.isci) {
      fis.isci = await Tesseract.createWorker('tur', 1, {
        workerPath: kok + 'worker.min.js', corePath: kok + 'tesseract-core-simd-lstm.wasm.js', langPath: kok, gzip: true
      });
    }
    const { data } = await fis.isci.recognize(dosya, {}, { blocks: true });
    const parcalar = (data.blocks || []).flatMap(b => b.paragraphs || []).flatMap(p => p.lines || [])
      .map(l => ({ t: l.text, x: l.bbox.x0, y: l.bbox.y0, w: l.bbox.x1 - l.bbox.x0, h: l.bbox.y1 - l.bbox.y0 }));
    if (!parcalar.length) return fisHata('Fişte yazı bulamadım. Fişi düz ve aydınlık bir yerde, yakından çekip tekrar dene.');
    fisUygula(fisSatirlari(parcalar));
  } catch (e) {
    fisHata('Bu tarayıcı fişi okuyamadı. Tutarı tuşlarla girebilir ya da sesle söyleyebilirsin.');
  }
}

// Android uygulamasından gelen mesajlar
window.damlyFis = function (m) {
  if (durum.sheet !== 'harcama' || !fis.durum) return;
  if (m.tur === 'iptal') { fis.durum = null; fisPanelCiz(); return; }
  if (m.tur === 'okunuyor') { fis.durum = 'okunuyor'; fis.not = ''; fisPanelCiz(); return; }
  if (m.tur === 'satirlar') {
    const satirlar = fisSatirlari(m.satirlar);
    if (!satirlar.length) return fisHata('Fişte yazı bulamadım. Fişi düz ve aydınlık bir yerde, yakından çekip tekrar dene.');
    fisUygula(satirlar);
    return;
  }
  if (m.tur === 'hata') {
    fisHata({ izin: 'Kamera ya da galeri izni verilmedi.', desteklenmiyor: 'Fiş okuma bu sürümde yok; uygulamanın yeni sürümünü kur.' }[m.kod]
      || 'Fiş okunamadı. Daha aydınlık bir fotoğrafla tekrar dene.');
  }
};

function fisKapat() { Object.assign(fis, { durum: null, sonuc: null, not: '' }); }

function fisEylemi(eylem, el) {
  switch (eylem) {
    case 'fis-baslat': fisBaslat(); return true;
    case 'fis-kaynak': fis.durum = 'okunuyor'; fis.not = ''; fisPanelCiz(); yereleGonder({ tur: 'fis', kaynak: el.dataset.deger }); return true;
  }
  return false;
}

// Tarayıcıda dosya seçilince
document.addEventListener('change', e => {
  if (e.target.id === 'fis-dosya' && e.target.files && e.target.files[0]) webFisOku(e.target.files[0]);
});
