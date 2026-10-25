// ============================================================
// ses.js — SESLE (YA DA CÜMLEYLE) HARCAMA EKLEME
// "Dün markette seksen beş lira harcadım" gibi bir cümleden tutar,
// kategori, ihtiyaç/istek ve tarih kural tabanlı olarak çıkarılır;
// her çıkarımın gerekçesi ("Nasıl anladım?") kullanıcıya gösterilir.
// Form yalnızca doldurulur; kaydetme kararı kullanıcıdadır.
//
// Gizlilik: ses yalnızca cihazın içinde yazıya çevrilir.
//   Android uygulaması → cihaz içi konuşma tanıma (mobil/App.js)
//   Tarayıcı           → yalnızca tarayıcı cihaz içi tanımayı destekliyorsa
// Desteklenmiyorsa ses kullanılmaz; aynı cümle yazılarak girilebilir.
// ============================================================

// ---------- Sayılar: "seksen beş" → 85, "iki yüz elli" → 250, "bin iki yüz" → 1200 ----------

const SAYI_KELIMELERI = {
  sıfır: 0, bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9,
  on: 10, yirmi: 20, otuz: 30, kırk: 40, elli: 50, altmış: 60, yetmiş: 70, seksen: 80, doksan: 90,
  yüz: 100, bin: 1000, buçuk: 0.5
};
// Sayıdan sonra gelebilen ekler: "kırk beşe", "yüzlük", "elliden"…
const SAYI_EKLERI = ['', 'e', 'a', 'ye', 'ya', 'de', 'da', 'te', 'ta', 'den', 'dan', 'ten', 'tan', 'lik', 'lık', 'luk', 'lük', 'i', 'ı', 'u', 'ü', 'yi', 'yı', 'yu', 'yü', 'er', 'ar', 'şer', 'şar'];

// "beşe" → { kelime: 'beş', deger: 5 }; sayı değilse null
function sayiKelimesi(token) {
  for (const [k, d] of Object.entries(SAYI_KELIMELERI).sort((a, b) => b[0].length - a[0].length)) {
    if (token.startsWith(k) && SAYI_EKLERI.includes(token.slice(k.length))) return { kelime: k, deger: d };
  }
  return null;
}

// Ardışık sayı kelimelerini tek sayıya çevirir
function kelimelerdenSayi(degerler) {
  let toplamS = 0, simdiki = 0;
  for (const d of degerler) {
    if (d === 1000) { toplamS += (simdiki || 1) * 1000; simdiki = 0; }
    else if (d === 100) simdiki = (simdiki || 1) * 100;
    else simdiki += d;
  }
  return toplamS + simdiki;
}

// ---------- Kelime sözlüğü: kategori, ihtiyaç/istek ve nota yazılacak ad ----------
// Kelimeler kök olarak yazılır; "markette", "kantinden", "otobüse" köklerinden tanınır.

const SES_SOZLUGU = [
  // Yemek
  ['kantin', 'yemek', 'ihtiyac', 'Kantin'], ['yemekhane', 'yemek', 'ihtiyac', 'Yemekhane'], ['yemek', 'yemek', 'ihtiyac', 'Yemek'],
  ['öğle', 'yemek', 'ihtiyac', 'Öğle yemeği'], ['kahvaltı', 'yemek', 'ihtiyac', 'Kahvaltı'], ['tost', 'yemek', 'ihtiyac', 'Tost'],
  ['simit', 'yemek', 'ihtiyac', 'Simit'], ['poğaça', 'yemek', 'ihtiyac', 'Poğaça'], ['sandviç', 'yemek', 'ihtiyac', 'Sandviç'],
  ['döner', 'yemek', 'istek', 'Döner'], ['pizza', 'yemek', 'istek', 'Pizza'], ['hamburger', 'yemek', 'istek', 'Hamburger'],
  ['burger', 'yemek', 'istek', 'Hamburger'], ['lahmacun', 'yemek', 'istek', 'Lahmacun'], ['kahve', 'yemek', 'istek', 'Kahve'],
  ['çay', 'yemek', 'ihtiyac', 'Çay'], ['kafe', 'yemek', 'istek', 'Kafe'], ['restoran', 'yemek', 'istek', 'Restoran'],
  ['dondurma', 'yemek', 'istek', 'Dondurma'], ['tatlı', 'yemek', 'istek', 'Tatlı'], ['çikolata', 'yemek', 'istek', 'Çikolata'],
  ['meyve suyu', 'yemek', 'istek', 'Meyve suyu'], ['kola', 'yemek', 'istek', 'Kola'], ['su', 'yemek', 'ihtiyac', 'Su'],
  // Market
  ['market', 'market', 'ihtiyac', 'Market'], ['bakkal', 'market', 'ihtiyac', 'Bakkal'], ['manav', 'market', 'ihtiyac', 'Manav'],
  ['süpermarket', 'market', 'ihtiyac', 'Market'], ['migros', 'market', 'ihtiyac', 'Migros'], ['bim', 'market', 'ihtiyac', 'BİM'],
  ['şok', 'market', 'ihtiyac', 'ŞOK'], ['a101', 'market', 'ihtiyac', 'A101'], ['ekmek', 'market', 'ihtiyac', 'Ekmek'],
  ['atıştırmalık', 'market', 'istek', 'Atıştırmalık'], ['cips', 'market', 'istek', 'Cips'], ['bisküvi', 'market', 'istek', 'Bisküvi'],
  // Ulaşım
  ['otobüs', 'ulasim', 'ihtiyac', 'Otobüs'], ['dolmuş', 'ulasim', 'ihtiyac', 'Dolmuş'], ['minibüs', 'ulasim', 'ihtiyac', 'Minibüs'],
  ['metro', 'ulasim', 'ihtiyac', 'Metro'], ['metrobüs', 'ulasim', 'ihtiyac', 'Metrobüs'], ['tramvay', 'ulasim', 'ihtiyac', 'Tramvay'],
  ['vapur', 'ulasim', 'ihtiyac', 'Vapur'], ['taksi', 'ulasim', 'istek', 'Taksi'], ['akbil', 'ulasim', 'ihtiyac', 'Kart dolumu'],
  ['istanbulkart', 'ulasim', 'ihtiyac', 'Kart dolumu'], ['kart dolum', 'ulasim', 'ihtiyac', 'Kart dolumu'], ['benzin', 'ulasim', 'ihtiyac', 'Benzin'],
  ['yol parası', 'ulasim', 'ihtiyac', 'Yol parası'], ['servis', 'ulasim', 'ihtiyac', 'Servis'],
  // Çocukların sık aldıkları
  ['sakız', 'yemek', 'istek', 'Sakız'], ['şeker', 'yemek', 'istek', 'Şeker'], ['kulaklık', 'diger', 'istek', 'Kulaklık'],
  ['bisiklet', 'diger', 'istek', 'Bisiklet'], ['oyuncak', 'eglence', 'istek', 'Oyuncak'], ['top', 'eglence', 'istek', 'Top'],
  // Eğlence
  ['sinema', 'eglence', 'istek', 'Sinema'], ['film', 'eglence', 'istek', 'Film'], ['konser', 'eglence', 'istek', 'Konser'],
  ['oyun', 'eglence', 'istek', 'Oyun'], ['bowling', 'eglence', 'istek', 'Bowling'], ['maç', 'eglence', 'istek', 'Maç'],
  ['tiyatro', 'eglence', 'istek', 'Tiyatro'], ['lunapark', 'eglence', 'istek', 'Lunapark'], ['playstation', 'eglence', 'istek', 'PlayStation'],
  ['eğlence', 'eglence', 'istek', 'Eğlence'],
  // Eğitim
  ['kitap', 'egitim', 'ihtiyac', 'Kitap'], ['defter', 'egitim', 'ihtiyac', 'Defter'], ['kalem', 'egitim', 'ihtiyac', 'Kalem'],
  ['fotokopi', 'egitim', 'ihtiyac', 'Fotokopi'], ['kırtasiye', 'egitim', 'ihtiyac', 'Kırtasiye'], ['kurs', 'egitim', 'ihtiyac', 'Kurs'],
  ['dershane', 'egitim', 'ihtiyac', 'Dershane'], ['test', 'egitim', 'ihtiyac', 'Test kitabı'], ['çıktı', 'egitim', 'ihtiyac', 'Çıktı'],
  // Giyim
  ['tişört', 'giyim', 'istek', 'Tişört'], ['ayakkabı', 'giyim', 'istek', 'Ayakkabı'], ['pantolon', 'giyim', 'istek', 'Pantolon'],
  ['mont', 'giyim', 'istek', 'Mont'], ['ceket', 'giyim', 'istek', 'Ceket'], ['kazak', 'giyim', 'istek', 'Kazak'],
  ['elbise', 'giyim', 'istek', 'Elbise'], ['gömlek', 'giyim', 'istek', 'Gömlek'], ['çorap', 'giyim', 'ihtiyac', 'Çorap'],
  ['şapka', 'giyim', 'istek', 'Şapka'], ['kıyafet', 'giyim', 'istek', 'Kıyafet'], ['giyim', 'giyim', 'istek', 'Giyim'],
  // Sağlık
  ['eczane', 'saglik', 'ihtiyac', 'Eczane'], ['ilaç', 'saglik', 'ihtiyac', 'İlaç'], ['doktor', 'saglik', 'ihtiyac', 'Doktor'],
  ['hastane', 'saglik', 'ihtiyac', 'Hastane'], ['vitamin', 'saglik', 'ihtiyac', 'Vitamin'], ['diş', 'saglik', 'ihtiyac', 'Diş'],
  // Diğer
  ['hediye', 'diger', 'istek', 'Hediye'], ['kuaför', 'diger', 'ihtiyac', 'Kuaför'], ['berber', 'diger', 'ihtiyac', 'Berber'],
  ['telefon kılıfı', 'diger', 'istek', 'Telefon kılıfı'], ['şarj', 'diger', 'ihtiyac', 'Şarj aleti']
];
// "Gereksizdi, canım çekti" gibi sözler isteği; "lazımdı, mecburdum" ihtiyacı gösterir
const ISTEK_SOZLERI = ['canım çekti', 'keyfine', 'keyif', 'gereksiz', 'boşuna', 'öylesine', 'hevesle'];
const IHTIYAC_SOZLERI = ['lazım', 'gerekli', 'mecbur', 'zorunlu', 'ihtiyaç'];

// Bir kökün kelimenin başında olup olmadığı ("markette" → market). Kısa kökler (su, bim) tam kelime olmalı.
function kokEslesir(metin, kok) {
  const kalip = kok.length <= 3
    ? new RegExp(`(^|\\s)${kok}(a|e|ı|i|u|ü|y[aeıiuü]|[dt][ae]n?|l[ıiuü]k?)?(?=\\s|$|[.,])`)
    : new RegExp(`(^|\\s)${kok}`);
  return kalip.test(metin);
}

// Cümleyi çözümler: { tutar, kategori, tur, aciklama, tarihFark, gerekceler[], eksik[] }
function cumleCoz(cumle) {
  const ham = String(cumle || '').trim();
  let metin = ham.toLocaleLowerCase('tr')
    .replace(/₺\s*(\d[\d.,]*)/g, '$1 lira ')
    .replace(/(\d)\s*(tl|₺)(?=\s|$|[.,!?])/g, '$1 lira')
    .replace(/[!?;:"“”']/g, ' ');
  const gerekceler = [];
  const sonuc = { tutar: 0, kategori: null, tur: null, aciklama: '', tarihFark: 0, gerekceler, eksik: [] };

  // --- Tutar: rakamlar ("85", "85,50", "1.250") ya da sayı kelimeleri ---
  const adaylar = [];
  for (const m of metin.matchAll(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/g)) {
    const deger = Number(m[1].replace(/\./g, '')) + (m[2] ? Number(m[2].padEnd(2, '0')) / 100 : 0);
    adaylar.push({ deger, yazi: m[0], son: m.index + m[0].length });
  }
  const tokenlar = [...metin.matchAll(/\S+/g)];
  for (let i = 0; i < tokenlar.length; i++) {
    const ilk = sayiKelimesi(tokenlar[i][0].replace(/[.,]$/, ''));
    if (!ilk) continue;
    const parcalar = [ilk];
    let j = i + 1;
    for (; j < tokenlar.length; j++) {
      const s = sayiKelimesi(tokenlar[j][0].replace(/[.,]$/, ''));
      if (!s) break;
      parcalar.push(s);
    }
    let deger = kelimelerdenSayi(parcalar.filter(p => p.deger !== 0.5).map(p => p.deger));
    if (parcalar.some(p => p.deger === 0.5)) deger += 0.5;
    // "bir tane", tek başına "bir" gibi belirsiz sözler tutar sayılmaz
    if (!(parcalar.length === 1 && ilk.deger === 1)) {
      adaylar.push({ deger, yazi: tokenlar.slice(i, j).map(t => t[0]).join(' '), son: tokenlar[j - 1].index + tokenlar[j - 1][0].length });
    }
    i = j - 1;
  }
  // "… tane / adet" miktar bildirir, tutar değildir; "lira"nın hemen önündeki sayı tercih edilir
  const gecerli = adaylar.filter(a => !/^\s*(tane|adet)/.test(metin.slice(a.son)));
  const liraOncesi = gecerli.find(a => /^\s*(lira|kuruş)/.test(metin.slice(a.son)));
  const secilen = liraOncesi || gecerli.sort((a, b) => b.deger - a.deger)[0];
  // "45 lira 50 kuruş": liranın hemen ardından gelen kuruş tutara eklenir
  const kurus = liraOncesi && /^\s*lira/.test(metin.slice(liraOncesi.son)) && gecerli.find(a => a.son > liraOncesi.son && a.deger < 100
    && /^\s*kuruş/.test(metin.slice(a.son)) && /^\s*lira\s*$/.test(metin.slice(liraOncesi.son, a.son - a.yazi.length)));
  if (secilen && secilen.deger > 0) {
    sonuc.tutar = Math.round((secilen.deger + (kurus ? kurus.deger / 100 : 0)) * 100) / 100;
    gerekceler.push([`“${secilen.yazi}${liraOncesi ? ' lira' : ''}${kurus ? ` ${kurus.yazi} kuruş` : ''}”`, `tutar ${kurusluPara(sonuc.tutar)}`]);
  } else sonuc.eksik.push('tutar');

  // --- Tarih ---
  if (/(evvelsi|önceki) gün/.test(metin)) { sonuc.tarihFark = -2; gerekceler.push(['“önceki gün”', 'tarih: 2 gün önce']); }
  else if (/(^|\s)dün/.test(metin)) { sonuc.tarihFark = -1; gerekceler.push(['“dün”', 'tarih: dün']); }
  else if (/(^|\s)bugün/.test(metin)) gerekceler.push(['“bugün”', 'tarih: bugün']);

  // --- Kategori ve ad: en uzun eşleşen kök (ör. "meyve suyu", "su"dan önce) ---
  const eslesme = SES_SOZLUGU.filter(([kok]) => kokEslesir(metin, kok)).sort((a, b) => b[0].length - a[0].length)[0];
  if (eslesme) {
    const [kok, kat, tur, ad] = eslesme;
    Object.assign(sonuc, { kategori: kat, tur, aciklama: ad });
    gerekceler.push([`“${kok}”`, `${kategori(kat).ad} kategorisi`]);
  } else sonuc.eksik.push('kategori');

  // --- İhtiyaç mı, istek mi? Sözle açıkça söylendiyse o, değilse kelimenin türü ---
  const istekSozu = ISTEK_SOZLERI.find(s => metin.includes(s));
  const ihtiyacSozu = IHTIYAC_SOZLERI.find(s => metin.includes(s));
  if (istekSozu) { sonuc.tur = 'istek'; gerekceler.push([`“${istekSozu}”`, 'istek']); }
  else if (ihtiyacSozu) { sonuc.tur = 'ihtiyac'; gerekceler.push([`“${ihtiyacSozu}”`, 'ihtiyaç']); }
  else if (eslesme) gerekceler.push([`“${eslesme[0]}”`, eslesme[2] === 'istek' ? 'genellikle istek' : 'genellikle ihtiyaç']);

  return sonuc;
}

// ============================================================
// ARAYÜZ: harcama sayfasındaki mikrofon
// ============================================================

const ses = { durum: null, metin: '', tanima: null, webHazir: null };

// Tarayıcıda yalnızca cihaz içi (internetsiz) tanıma kullanılır
const WebTanima = window.SpeechRecognition || window.webkitSpeechRecognition || null;
async function webSesHazirla() {
  if (!WebTanima) return 'yok';
  const secenek = { langs: ['tr-TR'], processLocally: true };
  try {
    if (typeof WebTanima.available === 'function') {
      const d = await WebTanima.available(secenek);
      if (d === 'available') return 'hazir';
      if ((d === 'downloadable' || d === 'downloading') && typeof WebTanima.install === 'function') {
        WebTanima.install(secenek).catch(() => {});
        return 'iniyor';
      }
    }
  } catch (e) { /* tarayıcı cihaz içi tanımayı desteklemiyor */ }
  return 'yok';
}

function sesPaneli() {
  return `<div id="ses-panel" class="ses-panel" hidden></div>`;
}

function sesPanelCiz() {
  const el = $('#ses-panel');
  if (!el) return;
  el.hidden = !ses.durum;
  if (!ses.durum) { el.innerHTML = ''; return; }
  if (ses.durum === 'dinliyor') {
    el.innerHTML = `<div class="ses-ust">
        <span class="ses-dalga" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        <span class="ses-metin">${ses.metin ? esc(ses.metin) : 'Dinliyorum… <small>örn. “dün markette seksen beş lira”</small>'}</span>
        <button class="dugme kucuk hafif" data-eylem="ses-dur">Bitti</button>
      </div>`;
    return;
  }
  if (ses.durum === 'yaz') {
    el.innerHTML = `<div class="ses-ust yaz">
        <input id="ses-girdi" class="not-girdi" maxlength="80" placeholder="Ne harcadın? örn. markette 85 lira" value="${esc(ses.metin)}">
        <button class="dugme kucuk ana" data-eylem="ses-anla">Anla</button>
      </div>
      ${ses.not ? `<small class="alan-not">${ses.not}</small>` : ''}`;
    setTimeout(() => { const i = $('#ses-girdi'); if (i) i.focus(); }, 50);
    return;
  }
  // Sonuç: neyi nasıl anladığını gösterir
  const s = ses.sonuc;
  el.innerHTML = `<div class="ses-sonuc">
      <div class="ses-ust"><span class="ses-metin">“${esc(ses.metin)}”</span>
        <button class="ikon-dugme" data-eylem="ses-tekrar" aria-label="Yeniden söyle">${ikon('mikrofon', 18)}</button></div>
      <div class="ses-gerekce"><b>Nasıl anladım?</b>${s.gerekceler.map(([a, b]) => `<span>${esc(a)} → ${b}</span>`).join('')}
        ${s.eksik.length ? `<span class="eksik">${s.eksik.map(x => x === 'tutar' ? 'Tutarı anlayamadım, tuşlarla gir' : 'Kategoriyi sen seç').join(' · ')}</span>` : ''}
      </div>
    </div>`;
}

// Çözümlenen cümleyi harcama formuna uygular (kaydetmez)
function sesUygula(metin) {
  const s = cumleCoz(metin);
  ses.metin = metin;
  ses.sonuc = s;
  ses.durum = 'sonuc';
  if (s.tutar) { durum.tus = String(s.tutar).replace('.', ','); tusYaz(); }
  const sec = (alan, deger) => { const b = $(`.sheet [data-eylem="form-sec"][data-alan="${alan}"][data-deger="${deger}"]`); if (b) formSec(b); };
  if (s.kategori) sec('kategori', s.kategori);
  if (s.tur) sec('tur', s.tur);
  if (s.tarihFark === -1) sec('tarih', dunStr());
  else if (s.tarihFark === -2) durum.form.tarih = tarihStr(gunEkle(new Date(), -2));
  if (s.aciklama && $('#h-not') && !$('#h-not').value) $('#h-not').value = s.aciklama;
  sesPanelCiz();
  titret();
}

async function sesBaslat() {
  fisKapat(); fisPanelCiz();
  ses.metin = '';
  ses.not = '';
  if (yerelUygulama) {
    ses.durum = 'dinliyor';
    sesPanelCiz();
    yereleGonder({ tur: 'dinle' });
    return;
  }
  if (ses.webHazir === null || ses.webHazir === 'iniyor') ses.webHazir = await webSesHazirla();
  if (ses.webHazir !== 'hazir') {
    ses.durum = 'yaz';
    ses.not = ses.webHazir === 'iniyor'
      ? 'Türkçe ses modeli indiriliyor; birazdan sesle de ekleyebilirsin. Şimdilik yazabilirsin.'
      : 'Bu tarayıcı sesi internete göndermeden tanıyamıyor; gizliliğin için ses kullanılmıyor. Aynı cümleyi yazabilirsin.';
    sesPanelCiz();
    return;
  }
  try {
    const t = new WebTanima();
    Object.assign(t, { lang: 'tr-TR', interimResults: true, maxAlternatives: 1, processLocally: true });
    t.onresult = e => {
      const r = e.results[e.results.length - 1];
      window.damlySes({ tur: r.isFinal ? 'son' : 'ara', metin: r[0].transcript });
    };
    t.onerror = e => window.damlySes({ tur: 'hata', kod: e.error });
    t.onend = () => window.damlySes({ tur: 'bitti' });
    ses.tanima = t;
    ses.durum = 'dinliyor';
    sesPanelCiz();
    t.start();
  } catch (e) {
    ses.durum = 'yaz';
    ses.not = 'Ses tanıma başlatılamadı; cümleyi yazabilirsin.';
    sesPanelCiz();
  }
}

function sesDurdur() {
  if (yerelUygulama) yereleGonder({ tur: 'dur' });
  else if (ses.tanima) ses.tanima.stop();
}

function sesKapat() {
  if (ses.durum === 'dinliyor') { if (yerelUygulama) yereleGonder({ tur: 'iptal' }); else if (ses.tanima) ses.tanima.abort(); }
  Object.assign(ses, { durum: null, metin: '', tanima: null, sonuc: null });
}

// Android uygulamasından ve tarayıcı tanımasından gelen mesajlar
const SES_HATALARI = {
  izin: 'Mikrofon izni verilmedi. İstersen cümleyi yazabilirsin.',
  desteklenmiyor: 'Bu telefon sesi internetsiz tanıyamıyor (Android 13 ve üstü gerekir); gizliliğin için ses kullanılmıyor. Cümleyi yazabilirsin.',
  model: 'Türkçe ses modeli telefonda yok. Açılan pencereden indirebilirsin; o zamana kadar cümleyi yazabilirsin.',
  'no-speech': 'Bir şey duyamadım. Tekrar dene ya da yaz.',
  nomatch: 'Anlayamadım. Tekrar dene ya da yaz.',
  'not-allowed': 'Mikrofon izni verilmedi. İstersen cümleyi yazabilirsin.'
};
window.damlySes = function (m) {
  if (!ses.durum || durum.sheet !== 'harcama') return;
  if (m.tur === 'ara') { ses.metin = m.metin; const el = $('.ses-metin'); if (el) el.textContent = m.metin; return; }
  if (m.tur === 'son') { if (m.metin.trim()) sesUygula(m.metin); return; }
  if (m.tur === 'hata') {
    if (ses.durum !== 'dinliyor') return;
    ses.durum = 'yaz';
    ses.not = SES_HATALARI[m.kod] || 'Ses tanıma şu an çalışmadı; cümleyi yazabilirsin.';
    sesPanelCiz();
    return;
  }
  // Tanıma bitti ama son sonuç gelmediyse ara metinle devam edilir
  if (m.tur === 'bitti' && ses.durum === 'dinliyor') {
    if (ses.metin.trim()) sesUygula(ses.metin);
    else { ses.durum = 'yaz'; ses.not = SES_HATALARI['no-speech']; sesPanelCiz(); }
  }
};

function sesEylemi(eylem) {
  switch (eylem) {
    case 'ses-baslat': case 'ses-tekrar': sesBaslat(); return true;
    case 'ses-dur': sesDurdur(); return true;
    case 'ses-anla': {
      const metin = ($('#ses-girdi').value || '').trim();
      if (!metin) { salla('#ses-girdi'); return true; }
      sesUygula(metin);
      return true;
    }
  }
  return false;
}
