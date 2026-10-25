// ============================================================
// borc.js — BORÇLAR: KREDİ KARTI, TAKSİT, KYK KREDİSİ, KİŞİLER
// Kart ödemesi ve taksitler, aylık ödemeler gibi günlük limitten önce
// ayrılır (haftalık bütçede haftalara bölünür). Kredi kartında "hep asgari
// ödersem ne olur?" sorusu bileşik faizle hesaplanır.
// KYK kredisi her ay gelir olarak bütçeye girer, aynı zamanda borç olarak
// birikir. Kişiler arası borç ve alacakta para el değiştirdiği gün
// harcama ya da gelir olarak kaydedilir.
// ============================================================

const BORC_TURLERI = {
  kart:   { ad: 'Kredi kartı', aciklama: 'Ekstre borcu ve asgari ödeme', ikon: 'kart', renk: '#E8590C' },
  taksit: { ad: 'Taksitli alışveriş', aciklama: 'Telefon, bilgisayar… her ay taksit', ikon: 'takvim', renk: '#4C6EF5' },
  kyk:    { ad: 'KYK öğrenim kredisi', aciklama: 'Mezuniyetten sonra geri ödenir', ikon: 'kitap', renk: '#1C9AD6' },
  kisi:   { ad: 'Arkadaş / aile', aciklama: 'Aldığın ya da verdiğin borç', ikon: 'kisi', renk: '#AE3EC9' }
};

// Lise öğrencisi yalnızca kişiler arası borcu görür; KYK kredisi yalnızca üniversitede;
// ilkokul ve ortaokulda borç bölümü yoktur
function borcTurleri(profil) {
  if (profil.tip !== 'ogrenci') return ['kart', 'taksit', 'kisi'];
  if (kucukOgrenci(profil)) return [];
  return profil.okul === 'universite' ? ['kart', 'taksit', 'kyk', 'kisi'] : ['kisi'];
}

// ---------- Ay yardımcıları ("2026-10" biçiminde) ----------

function ayAnahtari(d) { return `${d.getFullYear()}-${iki(d.getMonth() + 1)}`; }
function ayEkle(ay, n) { const [y, m] = ay.split('-').map(Number); return ayAnahtari(new Date(y, m - 1 + n, 1)); }
function ayFarki(a, b) { const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + m2 - m1; }
function ayGunu(ay, gun) { const [y, m] = ay.split('-').map(Number); return new Date(y, m - 1, Math.min(gun, ayGunSayisi(new Date(y, m - 1, 1)))); }
function ayAdi(ay) { return ayGunu(ay, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }); }
function sureMetni(ay) {
  if (ay < 12) return `${ay} ay`;
  const y = Math.floor(ay / 12), a = ay % 12;
  return `${y} yıl${a ? ' ' + a + ' ay' : ''}`;
}

// ---------- Kredi kartı ----------

function kartOdenen(b, ay) { return (b.odemeler || []).filter(o => o.ay === ay).reduce((t, o) => t + o.tutar, 0); }
function kartAsgari(b) {
  const borc = Number(b.borc) || 0;
  return Math.min(borc, Math.ceil(borc * (Number(b.asgari) || 20) / 100));
}
// Bu ay ödemeyi planladığın tutar: tamamı, asgari ya da seçtiğin tutar
function kartPlanli(b) {
  const borc = Number(b.borc) || 0;
  if (b.odeme === 'asgari') return kartAsgari(b);
  if (b.odeme === 'ozel') return Math.min(borc, Number(b.ozelTutar) || 0);
  return borc;
}
// Kart eklendiğinde o ayın son ödeme günü geçtiyse ilk ödeme gelecek aydadır
function kartIlkAy(b) {
  const basAy = b.bas.slice(0, 7);
  return tarihStr(ayGunu(basAy, b.gun)) >= b.bas ? basAy : ayEkle(basAy, 1);
}
// Bir aydaki kart ödemesinin bütçeden ayrılan kısmı. Borcun "dusulen" kadarı, kartla girilip
// limitten zaten düşmüş harcamalardır; ödeme önce o paradan karşılanır, kalanı bütçeden ayrılır.
function kartAyOdemesi(b, ay) {
  const odemeler = (b.odemeler || []).filter(o => o.ay === ay);
  if (odemeler.length) return odemeler.reduce((t, o) => t + (o.butceden ?? o.tutar), 0);
  return ay >= kartIlkAy(b) ? Math.max(0, kartPlanli(b) - (Number(b.dusulen) || 0)) : 0;
}
// Kartla girilmiş ama henüz bir ekstreyle eşleşmemiş harcamalar
function kartEslesmeyen(b) { return veri.harcamalar.filter(h => h.kartId === b.id && !h.kartEslesti); }
// Sıradaki ödenecek ay: bu ayın ödemesi yapıldıysa gelecek ay
function kartSiradakiAy(b, bugunS) {
  let ay = [bugunS.slice(0, 7), kartIlkAy(b)].sort().pop();
  if (kartOdenen(b, ay) > 0) ay = ayEkle(ay, 1);
  return ay;
}

// Borç her ay aynı kuralla ödenirse kaç ayda biter, ne kadar faiz işler (yeni harcama yapılmazsa).
// Ödemeden sonra kalan borca aylık faiz eklenir (bileşik faiz).
function kartSimule(borc, faizYuzde, odeme) {
  const r = faizYuzde / 100;
  let kalan = borc, ay = 0, faiz = 0;
  while (kalan >= 1 && ay < 600) {
    kalan -= Math.min(kalan, odeme(kalan));
    ay++;
    if (kalan < 1) break;
    const f = kalan * r;
    faiz += f;
    kalan += f;
  }
  return { ay, faiz, bitmez: ay >= 600 };
}
function kartAsgariSimule(b) {
  const oran = (Number(b.asgari) || 20) / 100;
  return kartSimule(Number(b.borc) || 0, Number(b.faiz) || 0, x => Math.ceil(x * oran));
}

// ---------- Taksit ----------

function taksitAktif(b, ay) { const k = ayFarki(b.ilkAy, ay); return k >= 0 && k < b.sayi; }
// Vadesi henüz gelmemiş (bugün dahil) taksit sayısı
function taksitKalan(b, bugunS) {
  let n = 0;
  for (let k = 0; k < b.sayi; k++) if (tarihStr(ayGunu(ayEkle(b.ilkAy, k), b.gun)) >= bugunS) n++;
  return n;
}
// Kalan taksit sayısından ilk taksit ayı: bu ayın ödeme günü geçmediyse bu ay
function taksitIlkAy(gun, bugunS) {
  const ay = bugunS.slice(0, 7);
  return tarihStr(ayGunu(ay, gun)) >= bugunS ? ay : ayEkle(ay, 1);
}

// ---------- KYK kredisi ----------
// alinan: eklenirken o güne kadar alınmış toplam. Sonraki her yatış (bağlı ek gelir) borca eklenir.

function kykAlinan(b, kayit, bugunS) {
  let toplamK = Number(b.alinan) || 0;
  for (let ay = b.bas.slice(0, 7); ay <= bugunS.slice(0, 7); ay = ayEkle(ay, 1)) {
    const [y, m] = ay.split('-').map(Number);
    const g = aylikGelis(kayit, b.gelirId, b.gun, b.gunSon, y, m - 1);
    const t = tarihStr(g.tarih);
    if (g.isaret !== 'yok' && t > b.bas && t <= bugunS) toplamK += Number(b.aylik);
  }
  return toplamK;
}
// Mezuniyete kadar her ay alırsan toplam (mezuniyet: yıl, haziran sonu kabul edilir)
function kykMezuniyette(b, kayit, bugunS) {
  const simdi = kykAlinan(b, kayit, bugunS);
  if (!b.mezuniyet) return null;
  const son = `${b.mezuniyet}-06`;
  let ek = 0;
  for (let ay = bugunS.slice(0, 7); ay <= son; ay = ayEkle(ay, 1)) {
    const [y, m] = ay.split('-').map(Number);
    if (tarihStr(aylikGelis(kayit, b.gelirId, b.gun, b.gunSon, y, m - 1).tarih) > bugunS) ek += Number(b.aylik);
  }
  return simdi + ek;
}

// ---------- Bütçeye etki ve takvim ----------

// Bir ayda bütçeden ayrılan borç ödemeleri (kart ödemesi + taksitler)
function borcAylikOdeme(borclar, ay) {
  return (borclar || []).reduce((t, b) => {
    if (ay < b.bas.slice(0, 7)) return t;
    if (b.tur === 'kart') return t + kartAyOdemesi(b, ay);
    if (b.tur === 'taksit') return t + (taksitAktif(b, ay) ? Number(b.tutar) : 0);
    return t;
  }, 0);
}

// Bir güne düşen ödemeler ve vadeler. durum: 'bekliyor' · 'odendi' · 'gecikti'
function borcOlaylari(borclar, t, bugunS) {
  const liste = [];
  const ay = t.slice(0, 7);
  for (const b of borclar || []) {
    if (b.tur === 'kart') {
      if (ay < kartIlkAy(b) || tarihStr(ayGunu(ay, b.gun)) !== t) continue;
      const odenen = kartOdenen(b, ay);
      if (odenen > 0) liste.push({ b, ay, tutar: odenen, durum: 'odendi' });
      else if (Number(b.borc) > 0) liste.push({ b, ay, tutar: kartPlanli(b), durum: t < bugunS ? 'gecikti' : 'bekliyor' });
    } else if (b.tur === 'taksit') {
      if (taksitAktif(b, ay) && tarihStr(ayGunu(ay, b.gun)) === t) {
        liste.push({ b, ay, tutar: Number(b.tutar), durum: t < bugunS ? 'odendi' : 'bekliyor', sira: ayFarki(b.ilkAy, ay) + 1 });
      }
    } else if (b.tur === 'kisi' && b.vade === t && !b.kapandi) {
      liste.push({ b, tutar: Number(b.tutar), durum: t < bugunS ? 'gecikti' : 'bekliyor' });
    }
  }
  return liste;
}

// Toplam borç ve alacak (kart borcu + kalan taksitler + KYK + kişilere olan borç)
function borcToplamlari(veri, bugunS) {
  let borc = 0, alacak = 0;
  for (const b of veri.borclar || []) {
    if (b.tur === 'kart') borc += Number(b.borc) || 0;
    else if (b.tur === 'taksit') borc += taksitKalan(b, bugunS) * Number(b.tutar);
    else if (b.tur === 'kyk') borc += kykAlinan(b, veri.gelirKayit, bugunS);
    else if (!b.kapandi) b.yon === 'alacak' ? alacak += Number(b.tutar) : borc += Number(b.tutar);
  }
  return { borc, alacak };
}

// Borçlar listesinde ve takvimde kısa açıklama
function borcOzeti(b, veri, bugunS) {
  if (b.tur === 'kart') {
    if (!(Number(b.borc) > 0)) return 'Borç yok';
    const ay = kartSiradakiAy(b, bugunS);
    return `Son ödeme ${ayGunu(ay, b.gun).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} · ${{ tam: 'tamamı', asgari: 'asgari', ozel: para(kartPlanli(b)) }[b.odeme]}`;
  }
  if (b.tur === 'taksit') {
    const kalan = taksitKalan(b, bugunS);
    return kalan ? `${kalan} taksit kaldı · ayda ${para(b.tutar)}` : 'Taksitler bitti';
  }
  if (b.tur === 'kyk') return `Ayda ${para(b.aylik)}${b.mezuniyet ? ` · mezuniyet ${b.mezuniyet}` : ''}`;
  if (b.kapandi) return `${b.yon === 'alacak' ? 'Geri alındı' : 'Ödendi'} · ${tarihGoster(b.kapandi, true)}`;
  return `${b.yon === 'alacak' ? 'Sana borçlu' : 'Borçlusun'}${b.vade ? ' · vade ' + tarihGoster(b.vade) : ''}`;
}

function borcAdi(b) {
  if (b.tur === 'kisi') return b.yon === 'alacak' ? `${b.kisi} (alacak)` : b.kisi;
  return b.ad || BORC_TURLERI[b.tur].ad;
}

// Ekranda borcun büyük tutarı
function borcTutari(b, veri, bugunS) {
  if (b.tur === 'kart') return Number(b.borc) || 0;
  if (b.tur === 'taksit') return taksitKalan(b, bugunS) * Number(b.tutar);
  if (b.tur === 'kyk') return kykAlinan(b, veri.gelirKayit, bugunS);
  return Number(b.tutar);
}

// ============================================================
// ARAYÜZ
// ============================================================

function borclarCiz(g) {
  const bugunS = bugunStr();
  const turler = borcTurleri(veri.profil);
  const satir = b => {
    const tur = BORC_TURLERI[b.tur];
    const kapali = b.tur === 'kisi' && b.kapandi;
    return grupSatiri({ ikonAd: tur.ikon, renk: kapali ? '#7C8798' : tur.renk, baslik: esc(borcAdi(b)), alt: borcOzeti(b, veri, bugunS),
      eylem: 'borc-detay', id: b.id, deger: (b.tur === 'kisi' && b.yon === 'alacak' ? '+' : '') + para(borcTutari(b, veri, bugunS)) });
  };
  const bolumler = turler.map(tur => {
    const liste = veri.borclar.filter(b => b.tur === tur).sort((a, b) => !!a.kapandi - !!b.kapandi);
    return liste.length ? `<div class="bolum-bas"><h2>${BORC_TURLERI[tur].ad}</h2></div><div class="grup">${liste.map(satir).join('')}</div>` : '';
  }).join('');
  return `
  ${baslik('Borçların', { geri: true })}
  <section class="kart">
    <span class="kart-etiket">Toplam borcun</span>
    <strong class="buyuk-tutar">${para(g.toplamBorc)}</strong>
    <p class="aciklama-metni">${g.borcAylik >= 1 ? `Bu ay ödemelerin <b>${para(g.borcAylik)}</b>, gelirinin ${yuzde(g.borcOrani)} kadarı; günlük limitinden önce ayrılır.` : 'Bu ay bütçenden ayrılan bir borç ödemesi yok.'}${g.toplamAlacak >= 1 ? ` Alacağın: <b>${para(g.toplamAlacak)}</b>.` : ''}</p>
  </section>
  ${bolumler || bosDurum('Borcun yok', turler.length > 1
    ? 'Kredi kartı, taksit ya da birine olan borcunu ekle; ödeme gününü hatırlatayım ve parasını önceden ayırayım.'
    : 'Bir arkadaşından borç aldıysan ya da birine borç verdiysen ekle; unutmayalım.')}
  <button class="dugme ana genis" data-eylem="borc-yeni">${ikon('arti', 20)} Borç ekle</button>`;
}

// Bütçe ve Profil'deki satır
function borcSatiri(g) {
  if (!borcTurleri(veri.profil).length) return '';
  const n = veri.borclar.filter(b => !b.kapandi).length;
  return grupSatiri({ ikonAd: 'kart', renk: '#E8590C', baslik: 'Borçların', alt: n ? `${n} kayıt · toplam ${para(g.toplamBorc)}` : 'Kredi kartı, taksit, arkadaşa borç…',
    deger: g.borcAylik >= 1 ? `${para(g.borcAylik)}/ay` : '', eylem: 'alt', ekran: 'borclar' });
}

// Bugün ekranı ve takvim satırları
function borcOlaySatiri(x, bugunS) {
  const b = x.b, tur = BORC_TURLERI[b.tur], ad = esc(borcAdi(b));
  const kalan = gunFarki(tarihCoz(bugunS), tarihCoz(x.tarih || bugunS));
  const zaman = x.durum === 'gecikti' ? 'son ödeme günü geçti' : kalan === 0 ? 'son gün bugün' : kalan > 0 ? `${kalan} gün kaldı` : '';
  if (b.tur === 'kisi') {
    const alacak = b.yon === 'alacak';
    return olaySatiri({ ikonAd: tur.ikon, renk: x.durum === 'gecikti' ? 'var(--vurgu)' : tur.renk,
      baslik: alacak ? `${ad} sana ${para(x.tutar)} borçlu` : `${ad}: ${para(x.tutar)} borcun`,
      alt: x.durum === 'gecikti' ? `Vadesi geçti · ${tarihGoster(b.vade)}` : kalan === 0 ? 'Vadesi bugün' : `Vade ${tarihGoster(b.vade)} · ${kalan} gün kaldı`,
      dugme: `<button class="dugme kucuk hafif" data-eylem="borc-detay" data-id="${b.id}">${alacak ? 'Geri aldım' : 'Ödedim'}</button>` });
  }
  if (b.tur === 'taksit') {
    return olaySatiri({ ikonAd: tur.ikon, renk: tur.renk, baslik: `${ad} · ${x.sira}. taksit`, alt: `${para(x.tutar)} · ${x.durum === 'odendi' ? 'ödendi sayıldı' : 'bütçenden ayrıldı'}`, eylem: 'borc-detay', id: b.id });
  }
  if (x.durum === 'odendi') return olaySatiri({ ikonAd: tur.ikon, renk: '#7C8798', baslik: `${ad} ödendi`, alt: para(x.tutar), eylem: 'borc-detay', id: b.id });
  return olaySatiri({ ikonAd: tur.ikon, renk: x.durum === 'gecikti' ? 'var(--vurgu)' : tur.renk, baslik: `${ad} ödemesi: ${para(x.tutar)}`,
    alt: zaman || 'Son ödeme günü', dugme: `<button class="dugme kucuk hafif" data-eylem="borc-ode" data-id="${b.id}">Ödedim</button>` });
}

// Kredi kartında "hep asgari ödersem" hesabı
function kartTuzakHtml(b) {
  const borc = Number(b.borc) || 0;
  if (borc < 1) return '';
  if (!(Number(b.faiz) > 0)) return `<div class="onizleme">${ikon('bilgi', 16)}<span>Aylık faiz oranını girersen (ekstrende "akdi faiz" yazar) yalnızca asgariyi ödemenin sana kaça mal olacağını hesaplarım.</span></div>`;
  const asg = kartAsgariSimule(b);
  const satirlar = [hesapSatiri('Hep asgari ödersen', asg.bitmez ? 'bitmez' : `${sureMetni(asg.ay)} · <span class="metin-kirmizi">${para(asg.faiz)} faiz</span>`)];
  if (b.odeme === 'ozel' && kartPlanli(b) > kartAsgari(b)) {
    const oz = kartSimule(borc, Number(b.faiz), () => kartPlanli(b));
    satirlar.push(hesapSatiri(`Her ay ${para(kartPlanli(b))} ödersen`, oz.bitmez ? 'bitmez' : `${sureMetni(oz.ay)} · ${para(oz.faiz)} faiz`));
  }
  satirlar.push(hesapSatiri('Tamamını ödersen', 'faiz yok', 'sonuc'));
  return `<div class="hesap">${satirlar.join('')}</div>
    <p class="alan-not">Yeni harcama yapmazsan, aylık %${String(b.faiz).replace('.', ',')} faizle ve vergiler hariç yaklaşık hesap. Asgariyi ödemek yalnızca gecikmeyi önler; kalan borca faiz işlemeye devam eder.</p>`;
}

function borcTaslagi(id) {
  const t = { tur: borcTurleri(veri.profil).length > 1 ? 'kart' : 'kisi', ad: '', borc: '', gun: '', asgari: 20, faiz: '', odeme: 'tam', ozelTutar: '',
    tutar: '', kalan: '', aylik: '', degisken: false, gunSon: '', alinan: '', mezuniyet: '', yon: 'borc', kisi: '', vade: '', bugun: true, eslestir: true };
  const b = id && veri.borclar.find(x => x.id === id);
  if (!b) return t;
  return Object.assign(t, b, {
    kalan: b.tur === 'taksit' ? taksitKalan(b, bugunStr()) : '', degisken: Number(b.gunSon) > b.gun, gunSon: b.gunSon || '',
    faiz: b.faiz || '', vade: b.vade || '', mezuniyet: b.mezuniyet || '', bugun: false
  });
}

function borcFormu(t, duzenleme) {
  const alan = (etiket, yol, ek = '') => `<label class="alan"><span>${etiket}</span><input data-taslak="${yol}" value="${esc(t[yol])}" ${ek}></label>`;
  const sayiAlan = (etiket, yol, ph = '0', ek = '') => alan(etiket, yol, `type="number" inputmode="decimal" min="0" placeholder="${ph}" ${ek}`);
  const segment = (alanAdi, secenekler) => `<div class="segment">${secenekler.map(([d, ad]) =>
    `<button class="${t[alanAdi] === d ? 'secili' : ''}" data-eylem="taslak" data-alan="${alanAdi}" data-deger="${d}">${ad}</button>`).join('')}</div>`;

  if (t.tur === 'kart') {
    const b = duzenleme && veri.borclar.find(x => x.id === durum.sheetId);
    const eslesmeyen = b ? kartEslesmeyen(b) : [];
    const not = eslesmeyen.length
      ? `<button class="anahtar-satir ${t.eslestir ? 'acik' : ''}" data-eylem="taslak-anahtar" data-alan="eslestir">
          <span class="satir-orta"><b>Kartla girdiğin ${para(toplam(eslesmeyen))} bu ekstrede</b><small>${eslesmeyen.length} harcama limitinden zaten düştü; bütçeden tekrar ayrılmaz</small></span><span class="anahtar"></span>
        </button>`
      : `<small class="alan-not">${duzenleme ? 'Ekstrendeki toplam borcu yaz.' : "Damly'ye daha önce harcama olarak eklediğin kart alışverişlerini buraya katma. Bundan sonra kartla harcarken \"Kart\" seç; ekstre gelince eşleştiririm, aynı para iki kez düşmez."}</small>`;
    return `${alan('Kart / banka adı', 'ad', 'maxlength="30" placeholder="Örn. Banka kartım"')}
      <div class="alan-ikili">${sayiAlan(duzenleme ? 'Yeni ekstre borcun (₺)' : 'Kart borcun (₺)', 'borc')}${sayiAlan('Son ödeme günü', 'gun', 'Ayın kaçı?', 'max="31"')}</div>
      ${not}
      <div class="alan-ikili">${sayiAlan('Asgari oran (%)', 'asgari', '20', 'max="100"')}${sayiAlan('Aylık faiz (%)', 'faiz', 'Örn. 3,5')}</div>
      <div class="alan"><span>Bu ay ne kadar ödeyeceksin?</span>${segment('odeme', [['tam', 'Tamamı'], ['asgari', 'Asgari'], ['ozel', 'Başka']])}</div>
      ${t.odeme === 'ozel' ? sayiAlan('Ödeyeceğin tutar (₺)', 'ozelTutar') : ''}`;
  }
  if (t.tur === 'taksit') {
    return `${alan('Ne için?', 'ad', 'maxlength="30" placeholder="Örn. Telefon"')}
      <div class="alan-ikili">${sayiAlan('Aylık taksit (₺)', 'tutar')}${sayiAlan('Kaç taksit kaldı?', 'kalan', '0', 'max="120"')}</div>
      ${sayiAlan('Ödeme günü', 'gun', 'Ayın kaçı?', 'max="31"')}`;
  }
  if (t.tur === 'kyk') {
    return `<div class="alan-ikili">${sayiAlan('Aylık kredi (₺)', 'aylik')}${sayiAlan(t.degisken ? 'En erken ayın kaçı?' : 'Ayın kaçında yatıyor?', 'gun', '1', 'max="31"')}</div>
      <button class="anahtar-satir ${t.degisken ? 'acik' : ''}" data-eylem="taslak-anahtar" data-alan="degisken" data-yenile>
        <span class="satir-orta"><b>Her ay aynı gün yatmıyor</b><small>Yattığı gün değişiyor</small></span><span class="anahtar"></span>
      </button>
      ${t.degisken ? sayiAlan('En geç ayın kaçında?', 'gunSon', 'Örn. 20', 'max="31"') : ''}
      <div class="alan-ikili">${sayiAlan('Şimdiye kadar aldığın (₺)', 'alinan')}${sayiAlan('Mezuniyet yılı', 'mezuniyet', 'Örn. 2029', 'min="2026" max="2040"')}</div>
      <small class="alan-not">Her ay yatan kredi, Diğer gelirler'e de eklenir ve günlük limitine katılır; aynı zamanda borcun olarak birikir.</small>`;
  }
  return `${segment('yon', [['borc', 'Borç aldım'], ['alacak', 'Borç verdim']])}
    <div class="alan-ikili">${alan(t.yon === 'alacak' ? 'Kime?' : 'Kimden?', 'kisi', 'maxlength="24" placeholder="Örn. Ali"')}${sayiAlan('Tutar (₺)', 'tutar')}</div>
    ${alan('Ne zaman ödenecek? (isteğe bağlı)', 'vade', 'type="date"')}
    ${duzenleme ? '' : `<button class="anahtar-satir ${t.bugun ? 'acik' : ''}" data-eylem="taslak-anahtar" data-alan="bugun">
      <span class="satir-orta"><b>${t.yon === 'alacak' ? 'Parayı bugün verdim' : 'Para bugün elime geçti'}</b><small>${t.yon === 'alacak' ? 'Bugünkü harcamalarına eklenir' : 'Bu dönemin bütçesine gelir olarak eklenir'}</small></span><span class="anahtar"></span>
    </button>`}`;
}

const BORC_SHEETLERI = {
  borcYeni(id) {
    const t = durum.taslak;
    const turler = borcTurleri(veri.profil);
    const secim = id ? '' : `<div class="tip-listesi">${turler.map(tur => {
      const x = BORC_TURLERI[tur], secili = t.tur === tur;
      return `<div class="secenek-kart ${secili ? 'secili' : ''}">
        <button class="tip-kart" data-eylem="taslak" data-alan="tur" data-deger="${tur}">
          <span class="kat-ikon" style="--renk:${x.renk}">${ikon(x.ikon, 20)}</span>
          <span class="satir-orta"><b>${x.ad}</b><small>${x.aciklama}</small></span><span class="radyo"></span>
        </button>
        ${secili ? `<div class="secenek-detay">${borcFormu(t, false)}</div>` : ''}
      </div>`;
    }).join('')}</div>`;
    return `${sheetBaslik(id ? (t.tur === 'kart' ? 'Kart borcunu güncelle' : 'Borcu düzenle') : 'Borç ekle')}
    ${id ? `<div class="form">${borcFormu(t, true)}</div>` : secim}
    <button class="dugme ana genis" data-eylem="borc-kaydet">${id ? 'Kaydet' : 'Ekle'}</button>`;
  },

  borcDetay(id) {
    const b = veri.borclar.find(x => x.id === id);
    if (!b) return '';
    const bugunS = bugunStr();
    const tur = BORC_TURLERI[b.tur];
    const ust = (tutarM, alt = '') => `<div class="detay-ust">
      <span class="kat-ikon buyuk" style="--renk:${tur.renk}">${ikon(tur.ikon, 28)}</span>
      <strong>${tutarM}</strong><b>${esc(borcAdi(b))}</b>${alt}</div>`;
    const sil = `<button class="dugme tehlike genis" data-eylem="borc-sil" data-id="${b.id}">${ikon('cop', 18)}<span>Kaydı sil</span></button>`;
    const duzenle = `<button class="dugme hafif genis" data-eylem="borc-duzenle" data-id="${b.id}">${b.tur === 'kart' ? 'Borcu güncelle' : 'Düzenle'}</button>`;

    if (b.tur === 'kart') {
      const ay = kartSiradakiAy(b, bugunS);
      const vade = tarihStr(ayGunu(ay, b.gun));
      const borcVar = Number(b.borc) >= 1;
      return `${sheetBaslik(tur.ad)}
      ${ust(para(b.borc), '<small class="detay-alt">güncel borç</small>')}
      <div class="grup">
        ${borcVar ? bilgiSatiri('Son ödeme', `${uzunTarih(vade)}${vade < bugunS ? ' · <span class="metin-kirmizi">geçti</span>' : ''}`) : ''}
        ${bilgiSatiri('Asgari ödeme', `${para(kartAsgari(b))} (%${b.asgari || 20})`)}
        ${(b.odemeler || []).length ? bilgiSatiri('Son ödemen', `${para(b.odemeler[b.odemeler.length - 1].tutar)} · ${tarihGoster(b.odemeler[b.odemeler.length - 1].tarih)}`) : ''}
      </div>
      ${borcVar ? `<div class="alan"><span>Bu ayki ödeme planın</span><div class="segment">
        ${[['tam', `Tamamı`], ['asgari', `Asgari`]].map(([d, a]) => `<button class="${b.odeme === d ? 'secili' : ''}" data-eylem="kart-plan" data-id="${b.id}" data-deger="${d}">${a}</button>`).join('')}
        ${b.odeme === 'ozel' ? `<button class="secili">${para(kartPlanli(b))}</button>` : ''}
      </div><small class="alan-not">${Number(b.dusulen) >= 1
        ? `${para(kartPlanli(b))} ödemenin ${para(Math.min(b.dusulen, kartPlanli(b)))} kadarı kartla girdiğin harcamalar olarak limitinden zaten düştü; bütçenden ${para(Math.max(0, kartPlanli(b) - b.dusulen))} ayrılıyor.`
        : `Bütçenden ${para(kartPlanli(b))} ayrılıyor.`}</small></div>` : ''}
      ${kartEslesmeyen(b).length ? `<p class="sheet-metin">Bu ekstreden sonra kartla <b>${para(toplam(kartEslesmeyen(b)))}</b> harcadın (${kartEslesmeyen(b).length} kayıt). Yeni ekstre gelince <b>Ekstre yükle</b> de; bunları eşleştiririm.</p>` : ''}
      ${b.ekstre ? `<p class="sheet-metin">Son ekstre ${tarihGoster(b.ekstre.yuklendi)} yüklendi: ${b.ekstre.harcamaSayisi} harcama${b.ekstre.eksikSayi ? `, ${b.ekstre.eksikSayi} tanesi kayıtlarında yoktu` : ', hepsi kayıtlıydı'}.</p>` : ''}
      ${kartTuzakHtml(b)}
      ${borcVar ? `<button class="dugme ana genis" data-eylem="borc-ode" data-id="${b.id}">${ikon('onay', 18)} Ödedim</button>` : ''}
      <button class="dugme hafif genis" data-eylem="ekstre-yukle" data-id="${b.id}">${ikon('belge', 18)} Ekstre yükle</button>
      ${duzenle}${sil}`;
    }
    if (b.tur === 'taksit') {
      const kalan = taksitKalan(b, bugunS), odenen = b.sayi - kalan;
      return `${sheetBaslik(tur.ad)}
      ${ust(para(kalan * b.tutar), '<small class="detay-alt">kalan</small>')}
      <span class="ince-cubuk buyuk"><i style="width:${b.sayi ? odenen / b.sayi * 100 : 0}%"></i></span>
      <div class="grup">
        ${bilgiSatiri('Aylık taksit', `${para(b.tutar)} · ayın ${b.gun}. günü`)}
        ${bilgiSatiri('Kalan taksit', `${kalan} / ${b.sayi}`)}
        ${bilgiSatiri('Son taksit', ayAdi(ayEkle(b.ilkAy, b.sayi - 1)))}
      </div>
      <p class="sheet-metin">Taksit her ay aylık ödemelerin gibi limitinden önce ayrılır. Ödeme günü geçince ödenmiş sayılır.</p>
      ${duzenle}${sil}`;
    }
    if (b.tur === 'kyk') {
      const mez = kykMezuniyette(b, veri.gelirKayit, bugunS);
      return `${sheetBaslik(tur.ad)}
      ${ust(para(kykAlinan(b, veri.gelirKayit, bugunS)), '<small class="detay-alt">bugüne kadar aldığın</small>')}
      <div class="grup">
        ${bilgiSatiri('Aylık kredi', `${para(b.aylik)} · ${Number(b.gunSon) > b.gun ? `ayın ${b.gun}.–${b.gunSon}. günleri` : `ayın ${b.gun}. günü`}`)}
        ${mez !== null ? bilgiSatiri(`${b.mezuniyet} mezuniyetinde`, `≈ ${para(mez)}`) : ''}
      </div>
      <p class="sheet-metin">KYK öğrenim kredisi burs değil, geri ödenen bir borçtur. Her ay yatan kredi bütçene gelir olarak eklenir. ${mez !== null ? 'Mezuniyet tahmini, o zamana kadar her ay alacağın varsayımıyla hesaplandı. ' : ''}Geri ödeme koşulları için KYK'nın güncel duyurularına bak.</p>
      ${duzenle}${sil}`;
    }
    const alacak = b.yon === 'alacak';
    return `${sheetBaslik(alacak ? 'Alacak' : 'Borç')}
    ${ust(`${alacak ? '+' : ''}${para(b.tutar)}`, `<small class="detay-alt">${alacak ? 'sana borçlu' : 'borcun'}</small>`)}
    <div class="grup">
      ${bilgiSatiri('Vade', b.vade ? uzunTarih(b.vade) : 'Belirtilmedi')}
      ${b.kapandi ? bilgiSatiri('Durum', `${alacak ? 'Geri alındı' : 'Ödendi'} · ${tarihGoster(b.kapandi, true)}`) : ''}
    </div>
    ${b.kapandi ? '' : `<p class="sheet-metin">${alacak ? 'Geri aldığında bu dönemin bütçesine gelir olarak eklenir.' : 'Ödediğinde bugünkü harcamalarına eklenir.'}</p>
      <button class="dugme ana genis" data-eylem="kisi-kapat" data-id="${b.id}">${ikon('onay', 18)} ${alacak ? 'Geri aldım' : 'Ödedim'}</button>
      ${duzenle}`}
    ${sil}`;
  },

  // Kart ödemesi: tuş takımıyla ödenen tutar
  borcOde(id) {
    const b = veri.borclar.find(x => x.id === id);
    if (!b) return '';
    durum.tus = String(kartPlanli(b));
    return `${sheetBaslik(`${esc(borcAdi(b))} ödemesi`)}
    ${tutarGostergesi('', 'kucuk')}
    <div class="segment">
      <button data-eylem="kart-tutar" data-deger="${kartAsgari(b)}">Asgari ${para(kartAsgari(b))}</button>
      <button data-eylem="kart-tutar" data-deger="${b.borc}">Tamamı ${para(b.borc)}</button>
    </div>
    ${tusTakimi()}
    <button class="dugme ana genis" data-eylem="kart-odeme-kaydet" data-id="${b.id}" data-enter>Ödemeyi kaydet</button>`;
  }
};

function borcOdeIpucu() {
  const el = $('#tutar-ipucu');
  const b = veri.borclar.find(x => x.id === durum.sheetId);
  if (!el || !b) return;
  const v = sayi(durum.tus);
  const kalan = Math.max(0, Number(b.borc) - v);
  el.classList.toggle('uyari', v > 0 && v < kartAsgari(b));
  el.innerHTML = !v ? 'Ödediğin tutarı gir'
    : v < kartAsgari(b) ? `Asgari ödemenin (${para(kartAsgari(b))}) altında; gecikme sayılabilir`
    : kalan >= 1 ? `Kalan <b>${para(kalan)}</b> borca faiz işler` : 'Borcun kapanıyor';
}

// ---------- Kaydetme ----------

function borcKaydet() {
  const t = durum.taslak, id = durum.sheetId;
  const eski = id && veri.borclar.find(x => x.id === id);
  const bugunS = bugunStr();
  const gunAl = yol => { const x = Math.round(sayi(t[yol])); return x >= 1 && x <= 31 ? x : 0; };
  const hata = yol => { salla(`[data-taslak="${yol}"]`); return null; };
  let b;

  if (t.tur === 'kart') {
    const borc = sayi(t.borc), gun = gunAl('gun'), asgari = sayi(t.asgari) || 20, faiz = sayi(t.faiz);
    if (borc < 0 || t.borc === '') return hata('borc');
    if (!gun) return hata('gun');
    if (asgari <= 0 || asgari > 100) return hata('asgari');
    if (t.odeme === 'ozel' && sayi(t.ozelTutar) <= 0) return hata('ozelTutar');
    b = { tur: 'kart', ad: String(t.ad || '').trim() || 'Kredi kartı', borc, gun, asgari, faiz, odeme: t.odeme, ozelTutar: sayi(t.ozelTutar),
      odemeler: eski ? eski.odemeler : [], dusulen: eski ? Math.min(Number(eski.dusulen) || 0, borc) : 0 };
    // Yeni ekstre: kartla girilmiş harcamalar bu borcun içinde, limitten zaten düştüler
    if (eski && t.eslestir) {
      const eslesen = kartEslesmeyen(eski);
      eslesen.forEach(h => { h.kartEslesti = true; });
      b.dusulen = Math.min(borc, b.dusulen + toplam(eslesen));
    }
  } else if (t.tur === 'taksit') {
    const ad = String(t.ad || '').trim(), tutar = sayi(t.tutar), kalan = Math.round(sayi(t.kalan)), gun = gunAl('gun');
    if (!ad) return hata('ad');
    if (tutar <= 0) return hata('tutar');
    if (kalan < 1 || kalan > 120) return hata('kalan');
    if (!gun) return hata('gun');
    b = { tur: 'taksit', ad, tutar, sayi: kalan, gun, ilkAy: taksitIlkAy(gun, bugunS) };
  } else if (t.tur === 'kyk') {
    const aylik = sayi(t.aylik), gun = gunAl('gun'), mez = Math.round(sayi(t.mezuniyet));
    if (aylik <= 0) return hata('aylik');
    if (!gun) return hata('gun');
    const gunSon = t.degisken ? gunAl('gunSon') : 0;
    if (t.degisken && !(gunSon > gun)) return hata('gunSon');
    if (t.mezuniyet !== '' && (mez < 2026 || mez > 2040)) return hata('mezuniyet');
    b = { tur: 'kyk', ad: BORC_TURLERI.kyk.ad, aylik, gun, gunSon, alinan: sayi(t.alinan), mezuniyet: mez || null };
  } else {
    const kisi = String(t.kisi || '').trim(), tutar = sayi(t.tutar);
    if (!kisi) return hata('kisi');
    if (tutar <= 0) return hata('tutar');
    b = { tur: 'kisi', yon: t.yon, kisi, tutar, vade: t.vade || null, kapandi: eski ? eski.kapandi : null };
  }

  if (eski) Object.assign(b, { id: eski.id, bas: eski.bas, gelirId: eski.gelirId });
  else Object.assign(b, { id: yeniId(), bas: bugunS });

  // KYK kredisi her ay gelir olarak da yatar
  if (b.tur === 'kyk') {
    const gelir = { ad: 'KYK kredisi', tutar: b.aylik, tekrar: 'aylik', gun: b.gun, borcId: b.id };
    if (b.gunSon) gelir.gunSon = b.gunSon;
    const mevcut = b.gelirId && veri.ekGelirler.find(e => e.id === b.gelirId);
    if (mevcut) Object.assign(mevcut, gelir, b.gunSon ? {} : { gunSon: undefined });
    else { b.gelirId = yeniId(); veri.ekGelirler.push({ id: b.gelirId, ...gelir, bas: bugunS }); }
  }
  // Kişiler arası borçta para bugün el değiştirdiyse harcama ya da gelir olarak kaydedilir
  if (b.tur === 'kisi' && !eski && t.bugun) kisiParaKaydet(b, b.yon === 'alacak' ? 'cikti' : 'girdi');

  if (eski) veri.borclar[veri.borclar.indexOf(eski)] = b;
  else veri.borclar.push(b);
  sheetKapat();
  kaydetVeCiz(eski ? 'Kaydedildi' : b.tur === 'kisi' ? `${b.yon === 'alacak' ? 'Alacak' : 'Borç'} eklendi` : 'Borç eklendi · ödemesi bütçende ayrıldı');
}

// Kişiler arası borçta paranın el değiştirmesi: çıkan para harcama, giren para bir kerelik gelir
function kisiParaKaydet(b, yon) {
  const bugunS = bugunStr();
  if (yon === 'cikti') {
    veri.harcamalar.push({ id: yeniId(), tutar: b.tutar, kategori: 'diger', tur: 'ihtiyac',
      aciklama: b.yon === 'alacak' ? `Borç verdim · ${b.kisi}` : `Borç ödemesi · ${b.kisi}`, tarih: bugunS, saat: saatStr(), borcId: b.id });
  } else {
    veri.ekGelirler.push({ id: yeniId(), ad: b.yon === 'alacak' ? `Alacak · ${b.kisi}` : `Borç · ${b.kisi}`, tutar: b.tutar, tekrar: 'tek', tarih: bugunS, bas: bugunS, borcId: b.id });
  }
}

function kartOdemeKaydet(id) {
  const b = veri.borclar.find(x => x.id === id);
  const tutar = sayi(durum.tus);
  if (!b) return;
  if (tutar <= 0) { salla('.sheet .tutar-gosterge'); return; }
  const bugunS = bugunStr();
  const odenen = Math.min(tutar, Number(b.borc)), dusulen = Number(b.dusulen) || 0;
  b.odemeler = b.odemeler || [];
  // Ödeme önce limitten zaten düşmüş kart harcamalarının parasından karşılanır
  b.odemeler.push({ ay: kartSiradakiAy(b, bugunS), tarih: bugunS, tutar: odenen, butceden: Math.max(0, odenen - dusulen) });
  b.dusulen = Math.max(0, dusulen - odenen);
  b.borc = Math.max(0, Number(b.borc) - tutar);
  if (b.odeme === 'ozel' && b.borc < 1) b.odeme = 'tam';
  sheetKapat();
  kaydetVeCiz(b.borc >= 1 ? `Ödeme kaydedildi · ${para(b.borc)} borç kaldı` : 'Kart borcun kapandı');
}

function borcSil(id) {
  const b = veri.borclar.find(x => x.id === id);
  if (!b) return;
  // KYK'nın bağlı geliri de silinir; harcama ve gelir olarak kaydedilmiş para hareketleri kalır
  if (b.tur === 'kyk' && b.gelirId) {
    gelisIsaretleriniTemizle(b.gelirId, true);
    veri.ekGelirler = veri.ekGelirler.filter(e => e.id !== b.gelirId);
  }
  veri.borclar = veri.borclar.filter(x => x.id !== id);
}

// Harcama ekleme sayfasında: kredi kartı borcu varsa ödeme nakit mi kartla mı?
function odemeSecimi() {
  const kartlar = veri.borclar.filter(b => b.tur === 'kart');
  if (!kartlar.length) return '';
  const secili = durum.form.kartId || '';
  return `<div class="segment kucuk odeme-secim">${[['', 'Nakit']].concat(kartlar.map(b => [b.id, b.ad])).map(([id, ad]) =>
    `<button class="${secili === id ? 'secili' : ''}" data-eylem="form-sec" data-alan="kartId" data-deger="${id}">${id ? ikon('kart', 14) + ' ' : ''}${esc(ad)}</button>`).join('')}</div>`;
}

// Tıklama olayları (arayuz.js'teki ana dinleyiciden çağrılır); işlenmediyse false
function borcEylemi(eylem, el) {
  const id = el.dataset.id;
  switch (eylem) {
    case 'borc-yeni': durum.taslak = borcTaslagi(null); sheetAc('borcYeni'); return true;
    case 'borc-detay': if (durum.sheet) sonraAc(() => sheetAc('borcDetay', id)); else sheetAc('borcDetay', id); return true;
    case 'borc-duzenle': sonraAc(() => { durum.taslak = borcTaslagi(id); sheetAc('borcYeni', id); }); return true;
    case 'borc-kaydet': borcKaydet(); return true;
    case 'borc-sil': ikiAdimliSil(el, () => borcSil(id), 'Kayıt silindi'); return true;
    case 'borc-ode': if (durum.sheet) sonraAc(() => sheetAc('borcOde', id)); else sheetAc('borcOde', id); return true;
    case 'kart-odeme-kaydet': kartOdemeKaydet(id); return true;
    case 'kart-tutar': durum.tus = String(Math.round(Number(el.dataset.deger))); tusYaz(); return true;
    case 'kart-plan': {
      const b = veri.borclar.find(x => x.id === id);
      if (b) { b.odeme = el.dataset.deger; kaydetVeCiz(); sheetYenile(); }
      return true;
    }
    case 'kisi-kapat': {
      const b = veri.borclar.find(x => x.id === id);
      if (!b || b.kapandi) return true;
      kisiParaKaydet(b, b.yon === 'alacak' ? 'girdi' : 'cikti');
      b.kapandi = bugunStr();
      sheetKapat();
      kaydetVeCiz(b.yon === 'alacak' ? `${para(b.tutar)} geri alındı · bütçene eklendi` : `${para(b.tutar)} borç ödendi`);
      return true;
    }
  }
  return false;
}
