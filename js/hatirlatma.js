// ============================================================
// hatirlatma.js — TELEFON BİLDİRİMLERİ
// Kart son ödeme günü, taksit, arkadaşa borç, düzenli ödemeler, planlar ve
// "Alsam mı?" kararları için önümüzdeki günlerin hatırlatmaları hesaplanır.
// Android uygulaması bu listeyi telefonun kendi bildirim zamanlayıcısına
// kurar; bildirim için sunucu yoktur, uygulama kapalıyken de gelir.
// Veri her değiştiğinde liste yeniden hesaplanır (ödenen borcun hatırlatması
// kendiliğinden kalkar).
// ============================================================

const HATIRLATMA_TURLERI = {
  borc:  { ad: 'Borç ve kart ödemeleri', aciklama: 'Bir gün önce ve son gün', ikon: 'kart', renk: '#E8590C' },
  odeme: { ad: 'Düzenli ödemeler ve planlar', aciklama: 'Ödeme gününden bir gün önce', ikon: 'takvim', renk: '#4C6EF5' },
  alsam: { ad: '"Alsam mı?" kararları', aciklama: `${BEKLEME_GUN} günlük bekleme dolunca`, ikon: 'kum', renk: '#1C9AD6' },
  kayit: { ad: 'Akşam hatırlatması', aciklama: 'Harcama girmediysen 21.00\'de', ikon: 'zil', renk: '#AE3EC9' }
};
const HATIRLATMA_SAATLERI = [9, 12, 18];
const HATIRLATMA_VARSAYILAN = { borc: true, odeme: true, alsam: true, kayit: false, saat: 9 };
const HATIRLATMA_GUN = 40;     // kaç gün ilerisi kurulur (her aylık ödeme en az bir kez)
const HATIRLATMA_EN_COK = 60;  // telefonun zamanlayıcısına kurulacak en fazla bildirim

// Android'den gelen bildirim izni: null (bilinmiyor) · 'verildi' · 'reddedildi'
const hatirlatma = { izin: null, son: null };

function hatirlatmaAyari() { return { ...HATIRLATMA_VARSAYILAN, ...(veri.ayarlar.hatirlatma || {}) }; }

// Önümüzdeki günlerin hatırlatmaları, zamana göre sıralı.
// { id, zaman: 'YYYY-MM-DDTHH:MM', tur, baslik, metin, hedef, hedefId }
function hatirlatmalariHesapla(v, simdi = new Date()) {
  if (!v.profil) return [];
  const a = { ...HATIRLATMA_VARSAYILAN, ...(v.ayarlar.hatirlatma || {}) };
  const bugun = gunBasi(simdi), bugunS = tarihStr(bugun);
  const saat = `${iki(a.saat)}:00`;
  const liste = [];
  const ekle = (tur, tarihS, sa, id, baslik, metin, hedef, hedefId = '') => {
    const zaman = `${tarihS}T${sa}`;
    if (new Date(zaman) > simdi) liste.push({ id: `${id}-${tarihS}`, zaman, tur, baslik, metin, hedef, hedefId });
  };
  const gunler = Array.from({ length: HATIRLATMA_GUN + 1 }, (_, i) => tarihStr(gunEkle(bugun, i)));
  const oncekiGun = t => tarihStr(gunEkle(tarihCoz(t), -1));

  if (a.borc) {
    for (const t of gunler) {
      for (const x of borcOlaylari(v.borclar, t, bugunS)) {
        if (x.durum !== 'bekliyor') continue;
        const b = x.b, ad = borcAdi(b), tutar = para(x.tutar);
        if (b.tur === 'kart') {
          const ne = { tam: 'borcun tamamı', asgari: 'asgari ödeme', ozel: 'planladığın ödeme' }[b.odeme] || 'ödeme';
          ekle('borc', oncekiGun(t), saat, `kart-${b.id}-once`, 'Kart ödemesi yarın', `${ad}: ${tutar} (${ne}). Son ödeme günü yarın.`, 'borc', b.id);
          ekle('borc', t, saat, `kart-${b.id}`, 'Kart ödemesinde son gün', `${ad}: ${tutar}. Bugün ödemezsen gecikme faizi işler.`, 'borc', b.id);
        } else if (b.tur === 'taksit') {
          ekle('borc', oncekiGun(t), saat, `taksit-${b.id}`, 'Yarın taksit günü', `${ad} · ${x.sira}/${b.sayi}. taksit: ${tutar}`, 'borc', b.id);
        } else if (b.yon === 'alacak') {
          ekle('borc', t, saat, `alacak-${b.id}`, 'Alacağının vadesi bugün', `${b.kisi} sana ${tutar} borçlu.`, 'borc', b.id);
        } else {
          ekle('borc', oncekiGun(t), saat, `kisi-${b.id}-once`, 'Borç ödeme günü yarın', `${b.kisi}: ${tutar} borcun. Vadesi yarın.`, 'borc', b.id);
          ekle('borc', t, saat, `kisi-${b.id}`, 'Borç ödeme günü bugün', `${b.kisi}: ${tutar} borcun. Ödeyince Damly'de "Ödedim" de.`, 'borc', b.id);
        }
      }
    }
  }

  if (a.odeme) {
    for (const t of gunler) {
      const d = tarihCoz(t);
      for (const s of v.sabitGiderler) {
        if (!s.gun || Math.min(s.gun, ayGunSayisi(d)) !== d.getDate()) continue;
        ekle('odeme', oncekiGun(t), saat, `sabit-${s.id}`, 'Yarın ödeme günü', `${s.ad}: ${para(s.tutar)}`, 'sabit', s.id);
      }
    }
    for (const pl of v.planlar || []) {
      // Kayıtlı planda durum alanı yoktur (takvim.js planDurumu): harcanmamış ve günü geçmemişse bekliyor
      if (pl.harcamaId || pl.tarih < bugunS) continue;
      ekle('odeme', pl.tarih, saat, `plan-${pl.id}`, `Bugünkü planın: ${pl.ad}`, `${para(pl.tutar)} ayrıldı. Harcayınca Damly'de "Harcadım" de.`, 'bugun');
    }
  }

  if (a.alsam) {
    for (const x of v.istekListesi || []) {
      if (x.durum !== 'bekliyor') continue;
      const t = tarihStr(gunEkle(tarihCoz(x.eklenme), BEKLEME_GUN));
      ekle('alsam', t, saat, `alsam-${x.id}`, `Karar zamanı: ${x.ad}`, `${BEKLEME_GUN} gün doldu. Hâlâ istiyor musun? Vazgeçersen ${para(x.tutar)} cebinde kalır.`, 'bekle', x.id);
    }
  }

  // Akşam hatırlatması: bugün harcama girildiyse bugünkü kalkar; sonraki günler uygulama açılınca yeniden hesaplanır
  if (a.kayit) {
    const bugunVar = v.harcamalar.some(h => h.tarih === bugunS);
    gunler.slice(0, 14).forEach((t, i) => {
      if (i === 0 && bugunVar) return;
      ekle('kayit', t, '21:00', 'kayit', 'Bugün harcama girmedin', 'Bir şey aldıysan unutmadan ekle; limitin doğru kalsın.', 'harcama');
    });
  }

  return liste.sort((x, y) => x.zaman.localeCompare(y.zaman)).slice(0, HATIRLATMA_EN_COK);
}

// Liste değiştiyse Android uygulamasına gönderilir (her çizimden sonra çağrılır).
// Demo verileriyle bildirim kurulmaz: örnek borçlar gerçek bildirim gibi gelmesin.
function hatirlatmalariGonder() {
  if (!yerelUygulama) return;
  const liste = veri.demo ? [] : hatirlatmalariHesapla(veri);
  const json = JSON.stringify(liste);
  if (json === hatirlatma.son) return;
  hatirlatma.son = json;
  yereleGonder({ tur: 'hatirlatmalar', liste });
}

// "Yarın 09.00", "3 Kas Pzt 12.00"
function hatirlatmaZamani(zaman) {
  const [t, sa] = zaman.split('T');
  const s = tarihGoster(t);
  const gun = ['Bugün', 'Yarın'].includes(s) ? s : tarihCoz(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' });
  return `${gun} ${sa.replace(':', '.')}`;
}

// ---------- Profil → Bildirimler ekranı ----------

function hatirlatmalarCiz() {
  const a = hatirlatmaAyari();
  const liste = hatirlatmalariHesapla(veri);
  const izinUyari = yerelUygulama && hatirlatma.izin === 'reddedildi'
    ? `<div class="ses-panel uyari-panel"><span class="ses-metin"><b>Bildirim izni kapalı</b><small>Hatırlatmaların gelmesi için telefon ayarlarından Damly'ye bildirim izni ver.</small></span></div>
       <button class="dugme ana genis" data-eylem="hatirlatma-izin">Ayarları aç</button>` : '';
  const ortamNotu = !yerelUygulama
    ? `<p class="kucuk-not">${ikon('bilgi', 14)} Bildirimler Android uygulamasında gelir. Burada hangi gün ne hatırlatılacağını görebilirsin.</p>`
    : veri.demo ? `<p class="kucuk-not">${ikon('bilgi', 14)} Demo verileriyle bildirim gönderilmez; kendi verilerinle kurulur.</p>` : '';
  const anahtar = tur => {
    const x = HATIRLATMA_TURLERI[tur];
    return `<button class="anahtar-satir ${a[tur] ? 'acik' : ''}" data-eylem="hatirlatma-anahtar" data-alan="${tur}">
      <span class="satir-orta"><b>${x.ad}</b><small>${x.aciklama}</small></span><span class="anahtar"></span></button>`;
  };
  const satir = x => {
    const t = HATIRLATMA_TURLERI[x.tur];
    return olaySatiri({ ikonAd: t.ikon, renk: t.renk, baslik: esc(x.baslik), alt: `${hatirlatmaZamani(x.zaman)} · ${esc(x.metin)}` });
  };
  return `
  ${baslik('Bildirimler', { geri: true })}
  ${izinUyari}
  <section class="kart form">
    ${Object.keys(HATIRLATMA_TURLERI).map(anahtar).join('')}
    <div class="alan"><span>Hatırlatma saati</span>
      <div class="segment">${HATIRLATMA_SAATLERI.map(s => `<button class="${a.saat === s ? 'secili' : ''}" data-eylem="hatirlatma-saat" data-deger="${s}">${iki(s)}.00</button>`).join('')}</div>
    </div>
    ${ortamNotu}
  </section>

  <div class="bolum-bas"><h2>Sıradaki hatırlatmalar</h2>${liste.length ? `<span>${liste.length}</span>` : ''}</div>
  ${liste.length
    ? `<div class="olay-listesi">${liste.slice(0, 8).map(satir).join('')}</div>`
    : bosDurum('Yaklaşan hatırlatma yok', 'Borç, ödeme günü olan bir gider ya da plan eklediğinde burada görünür.')}
  ${yerelUygulama ? `<button class="dugme hafif genis" data-eylem="hatirlatma-deneme">${ikon('zil', 18)} Deneme bildirimi gönder</button>` : ''}
  <p class="kucuk-not">${ikon('kilit', 14)} Bildirimler telefonun içinde kurulur; hiçbir sunucuya bilgi gitmez.</p>`;
}

// Profil'deki satır
function hatirlatmaSatiri() {
  const a = hatirlatmaAyari();
  const acik = Object.keys(HATIRLATMA_TURLERI).filter(t => a[t]).length;
  const alt = yerelUygulama && hatirlatma.izin === 'reddedildi' ? 'Bildirim izni kapalı'
    : acik ? `${acik} tür açık · saat ${iki(a.saat)}.00` : 'Kapalı';
  return grupSatiri({ ikonAd: 'zil', renk: '#AE3EC9', baslik: 'Bildirimler', alt, eylem: 'alt', ekran: 'hatirlatmalar' });
}

// Tıklama olayları (arayuz.js'teki ana dinleyiciden çağrılır); işlenmediyse false
function hatirlatmaEylemi(eylem, el) {
  switch (eylem) {
    case 'hatirlatma-anahtar': {
      const a = hatirlatmaAyari();
      a[el.dataset.alan] = !a[el.dataset.alan];
      veri.ayarlar.hatirlatma = a;
      kaydetVeCiz();
      return true;
    }
    case 'hatirlatma-saat':
      veri.ayarlar.hatirlatma = { ...hatirlatmaAyari(), saat: Number(el.dataset.deger) };
      kaydetVeCiz();
      return true;
    case 'hatirlatma-izin': yereleGonder({ tur: 'bildirim-ayarlari' }); return true;
    case 'hatirlatma-deneme':
      yereleGonder({ tur: 'deneme-bildirimi', baslik: 'Damly hatırlatması', metin: 'Bildirimler çalışıyor. Ödeme günlerinde böyle haber vereceğim.' });
      bildirim('Birkaç saniye içinde bildirim gelecek');
      return true;
  }
  return false;
}

// Android uygulamasından gelen mesajlar:
//   { tur: 'izin', durum }        → bildirim izninin durumu
//   { tur: 'ac', hedef, hedefId } → bildirime dokunuldu, ilgili yeri aç
window.damlyHatirlatma = function (m) {
  if (m.tur === 'izin') {
    if (hatirlatma.izin === m.durum) return;
    hatirlatma.izin = m.durum;
    if (veri.profil && ['profil', 'hatirlatmalar'].includes(aktifEkran())) ciz();
    return;
  }
  if (m.tur !== 'ac' || !veri.profil) return;
  const ac = () => {
    if (m.hedef === 'borc' && veri.borclar.some(b => b.id === m.hedefId)) {
      durum.sekme = 'bugun'; durum.yigin = ['borclar']; ciz();
      sheetAc('borcDetay', m.hedefId);
    } else if (m.hedef === 'sabit' && veri.sabitGiderler.some(s => s.id === m.hedefId)) {
      durum.sekme = 'bugun'; durum.yigin = ['sabit']; ciz();
      sheetAc('sabitDetay', m.hedefId);
    } else if (m.hedef === 'bekle' && veri.istekListesi.some(x => x.id === m.hedefId && x.durum === 'bekliyor')) {
      sheetAc('bekleDetay', m.hedefId);
    } else if (m.hedef === 'harcama') {
      sheetAc('harcama');
    } else if (durum.sekme !== 'bugun' || durum.yigin.length) {
      sekmeyeGec('bugun'); ciz();
    }
  };
  if (durum.sheet) sonraAc(ac); else ac();
};
