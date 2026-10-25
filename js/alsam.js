// ============================================================
// alsam.js — "ALSAM MI?" VE BEKLEME LİSTESİ
// Bir şeyi almadan önce fiyatının bütçeye etkisini gösterir ve kural
// tabanlı bir karar verir. İstenirse ürün BEKLEME_GUN günlük bekleme
// listesine alınır; süre dolunca "Hâlâ istiyor musun?" diye sorulur.
// Vazgeçilen her ürünün fiyatı "kurtarılan para" olarak sayılır.
// Yöntem: dürtüsel satın almayı erteleme ("30 gün kuralı"nın
// öğrenciler için kısaltılmış hâli).
// ============================================================

// ---------- Karar kuralları ----------
//   EĞER fiyat > dönemde harcanabilir kalan para      İSE kırmızı: "bütçe yetmiyor"
//   EĞER fiyat > bugünkü limitten kalan               İSE sarı: "alabilirsin ama sonraki günler daralır"
//   DEĞİLSE                                           yeşil: "bütçen kaldırıyor"
//   EĞER fiyat > dönemin harcanabilir parasının yarısı İSE ayrıca "hedef olarak biriktir" öner

function alsamDegerlendir(g, fiyat) {
  const gunlukHak = g.gunlukLimit > 0 ? g.gunlukLimit : Math.max(1, g.harcanabilirDonem / g.donemUzunluk);
  const kalanDonem = Math.max(0, g.harcanabilirKalan);
  const bugunSonra = g.bugunKalan - fiyat;
  const yeniYarin = g.kalanGun > 1 ? Math.max(0, (g.harcanabilirKalan - fiyat) / (g.kalanGun - 1)) : null;
  const hedef = g.aktifHedefler[0];

  let seviye, baslik, aciklama;
  if (fiyat > kalanDonem) {
    seviye = 'kritik'; baslik = 'Bu dönemin bütçesi yetmiyor';
    aciklama = `Bu ${g.donemAdi} harcayabileceğin ${para(kalanDonem)} kaldı. Beklemek ya da hedef olarak biriktirmek daha doğru.`;
  } else if (bugunSonra < 0) {
    seviye = 'uyari'; baslik = 'Alabilirsin ama sonraki günler daralır';
    aciklama = `Bugünkü limitini ${para(-bugunSonra)} aşarsın; fark kalan günlere paylaştırılır.`;
  } else {
    seviye = 'tebrik'; baslik = 'Bütçen kaldırıyor';
    aciklama = 'Bugünkü limitinin içinde. Yine de gerçekten ihtiyacın var mı, bir düşün.';
  }

  const gunSayisi = (fiyat / gunlukHak).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  const maddeler = [
    ['Günlük harcama hakkına göre', `≈ ${gunSayisi} günlük`],
    ['Bugün alırsan', bugunSonra >= 0 ? `${para(bugunSonra)} kalır` : `limit ${para(-bugunSonra)} aşılır`]
  ];
  if (yeniYarin !== null && g.yarinLimit !== null) maddeler.push(['Sonraki günlerin limiti', `${para(g.yarinLimit)} → ${para(yeniYarin)}`]);
  if (hedef && hedef.aylikGereken > 0) {
    maddeler.push([`“${esc(hedef.ad)}” hedefi`, `biriktirsen ~${Math.max(1, Math.round(fiyat / (hedef.aylikGereken / 30.44)))} gün erken`]);
  }
  return { seviye, baslik, aciklama, maddeler, buyuk: fiyat > Math.max(0, g.harcanabilirDonem) * 0.5 };
}

// ---------- "Alsam mı?" sayfası ----------

function alsamSheet() {
  durum.form = {};
  return `${sheetBaslik('Alsam mı?')}
    <input id="al-ad" class="not-girdi" maxlength="30" placeholder="Ne almak istiyorsun? (örn. Kulaklık)">
    ${tutarGostergesi('Fiyatını gir', 'kucuk')}
    <div id="alsam-analiz" class="alsam-analiz">${alsamAnalizHtml()}</div>
    ${tusTakimi()}
    <div id="alsam-dugmeler" class="alsam-dugmeler">${alsamDugmeleriHtml()}</div>`;
}

function alsamAnalizHtml() {
  const v = sayi(durum.tus);
  if (!v) return `<p class="alsam-bos">Fiyatı yazdıkça bütçene etkisini göstereceğim.</p>`;
  const d = alsamDegerlendir(durum.g, v);
  return `<div class="alsam-karar ${d.seviye}">
      ${maskot({ ruh: SEVIYE_RUH[d.seviye], boyut: 44, dolum: maskotDolum(durum.g) })}
      <div><b>${d.baslik}</b><small>${d.aciklama}</small></div>
    </div>
    <div class="alsam-maddeler">${d.maddeler.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div>`;
}

function alsamDugmeleriHtml() {
  const v = sayi(durum.tus);
  const d = v ? alsamDegerlendir(durum.g, v) : null;
  const rahat = d && d.seviye === 'tebrik';
  const bekle = `<button class="dugme ${rahat ? 'hafif' : 'ana'}" data-eylem="alsam-bekle">${ikon('kum', 18)} ${BEKLEME_GUN} gün bekle</button>`;
  const al = `<button class="dugme ${rahat ? 'ana' : 'hafif'}" data-eylem="alsam-al">${ikon('canta', 18)} ${d && !rahat ? 'Yine de al' : 'Al'}</button>`;
  return `<div class="dugme-ikili esit">${rahat ? al + bekle : bekle + al}</div>
    ${d && d.buyuk ? `<button class="dugme hafif genis" data-eylem="alsam-hedef">${ikon('hedef', 18)} Hedef olarak biriktir</button>` : ''}
    <button class="metin-dugme alsam-vazgec" data-eylem="alsam-vazgec">Vazgeçtim</button>`;
}

function alsamGuncelle() {
  const a = $('#alsam-analiz'), d = $('#alsam-dugmeler');
  if (a) {
    // Karar aynı kaldıysa yalnızca yazılar değişir; maskot her tuşta yeniden canlanmaz
    const yeni = document.createElement('div');
    yeni.innerHTML = alsamAnalizHtml();
    const eski = $('.alsam-karar', a), gelen = $('.alsam-karar', yeni);
    if (eski && gelen && eski.className === gelen.className) {
      $('.alsam-karar > div', a).innerHTML = $('.alsam-karar > div', yeni).innerHTML;
      $('.alsam-maddeler', a).replaceWith($('.alsam-maddeler', yeni));
    } else a.replaceChildren(...yeni.childNodes);
  }
  if (d) d.innerHTML = alsamDugmeleriHtml();
}

function alsamBilgi(adGerekli = true) {
  const ad = ($('#al-ad').value || '').trim();
  const tutar = sayi(durum.tus);
  if (tutar <= 0) { salla('.sheet .tutar-gosterge'); return null; }
  if (adGerekli && !ad) { salla('#al-ad'); $('#al-ad').focus(); return null; }
  return { ad, tutar };
}

// Açık sayfa kapanırken bir sonrakini aç
function sonraAc(islem) { sheetKapat(); setTimeout(islem, 330); }

function alsamBekle() {
  const b = alsamBilgi();
  if (!b) return;
  veri.istekListesi.push({ id: yeniId(), ad: b.ad, tutar: b.tutar, eklenme: bugunStr(), durum: 'bekliyor' });
  sheetKapat();
  kaydetVeCiz(`“${b.ad}” bekleme listesinde · ${kisaTarih(gunEkle(new Date(), BEKLEME_GUN))} tarihinde soracağım`);
}

function alsamVazgec() {
  const b = alsamBilgi();
  if (!b) return;
  veri.istekListesi.push({ id: yeniId(), ad: b.ad, tutar: b.tutar, eklenme: bugunStr(), durum: 'vazgecildi', karar: bugunStr() });
  sheetKapat();
  kaydetVeCiz(`Vazgeçtin · ${para(b.tutar)} kurtardın`);
}

function alsamAl() {
  const b = alsamBilgi(false);
  if (!b) return;
  sonraAc(() => { durum.onDoldur = { ad: b.ad, tutar: b.tutar }; sheetAc('harcama'); });
}

function alsamHedef() {
  const b = alsamBilgi();
  if (!b) return;
  sonraAc(() => {
    sheetAc('hedefYeni');
    $('#hd-ad').value = b.ad;
    $('#hd-tutar').value = b.tutar;
    hedefOnizleme();
  });
}

// ---------- Bekleme listesi ----------

function bekleDetaySheet(id) {
  const x = durum.g.istekler.find(i => i.id === id);
  if (!x) return '';
  return `${sheetBaslik('Bekleme listesi')}
    <div class="detay-ust">
      <span class="kat-ikon buyuk" style="--renk:var(--marka)">${ikon('kum', 28)}</span>
      <strong>${para(x.tutar)}</strong><b>${esc(x.ad)}</b>
    </div>
    <p class="sheet-metin">${x.hazir
      ? `${BEKLEME_GUN} gün doldu. Hâlâ istiyor musun? Vazgeçersen ${para(x.tutar)} kurtarılan paraya eklenir.`
      : `${x.kalan} gün sonra sana soracağım. Beklemek, bir şeyi gerçekten isteyip istemediğini anlamanın en kolay yolu.`}</p>
    ${ilerleme(x.gecen / BEKLEME_GUN, 'iyi')}
    <div class="dugme-ikili esit">
      <button class="dugme ana" data-eylem="bekle-vazgec" data-id="${x.id}">Vazgeçtim</button>
      <button class="dugme hafif" data-eylem="bekle-al" data-id="${x.id}">${x.hazir ? 'Hâlâ istiyorum' : 'Beklemeden al'}</button>
    </div>
    <button class="metin-dugme tehlike-metin" data-eylem="bekle-sil" data-id="${x.id}">${ikon('cop', 16)}<span>Listeden çıkar</span></button>`;
}

function bekleVazgec(id) {
  const x = veri.istekListesi.find(i => i.id === id);
  if (!x) return;
  x.durum = 'vazgecildi';
  x.karar = bugunStr();
  sheetKapat();
  kaydetVeCiz(`Vazgeçtin · ${para(x.tutar)} kurtardın`);
}

function bekleAl(id) {
  const x = veri.istekListesi.find(i => i.id === id);
  if (!x) return;
  sonraAc(() => { durum.onDoldur = { ad: x.ad, tutar: x.tutar, istekId: x.id }; sheetAc('harcama'); });
}

// ---------- Ekran parçaları ----------

function beklemeSatiri(x) {
  return `<button class="satir" data-eylem="bekle-detay" data-id="${x.id}">
    <span class="bekleme-halka ${x.hazir ? 'hazir' : ''}" style="--oran:${Math.min(1, x.gecen / BEKLEME_GUN)}">${x.hazir ? ikon('onay', 16) : `<b>${x.kalan}</b>`}</span>
    <span class="satir-orta"><b>${esc(x.ad)}</b><small>${x.hazir ? 'Karar zamanı' : `${x.kalan} gün sonra karar`}</small></span>
    <span class="satir-tutar">${para(x.tutar)}</span>
  </button>`;
}

function beklemeBolumu(g) {
  return `<div class="bolum-bas"><h2>Bekleme listesi</h2><span>${g.istekler.length}</span></div>
  <section class="kart bekleme-kart">
    <div class="kurtarilan">
      <span class="kat-ikon" style="--renk:var(--basari)">${ikon('kalkan', 18)}</span>
      <div><b>${para(g.kurtarilanToplam)}</b><small>kurtarılan para · ${g.vazgecmeSayisi} kez vazgeçtin</small></div>
    </div>
    ${g.istekler.length
      ? `<div class="liste">${g.istekler.map(beklemeSatiri).join('')}</div>`
      : `<p class="aciklama-metni">Almayı düşündüğün bir şeyi listeye ekle; ${BEKLEME_GUN} gün sonra hâlâ istiyor musun diye sorayım.</p>`}
    <button class="dugme hafif genis" data-eylem="alsam">${ikon('canta', 18)} Alsam mı? diye sor</button>
  </section>`;
}
