// ============================================================
// takvim.js — TAKVİM VE DÖNEM MOTORU
// Paranın geliş düzenine göre bütçe "dönemlere" bölünür:
//   Aylık    → maaş/burs gününden bir sonrakine kadar. Burs gibi her ay farklı
//              günde gelen parada dönem, para yattığı gün başlar; yatana kadar
//              aralığın son günü beklenir (para erken bitmesin diye temkinli plan).
//   Haftalık → harçlık gününden 7 gün
//   Günlük   → Pazartesi–Pazar haftası (ör. hafta içi her gün harçlık)
//
// DİNAMİK GÜNLÜK LİMİT (her gün için):
//   harcanabilir = dönemin geliri − sabit gider payı − borç ödemeleri payı − ulaşım payı
//                  − planlı harcamalar − kumbara payı (yuvarlak sayıya aşağı yuvarlanır)
//   Aylık giderler haftalık dönemlere ortalama 4,35 haftaya bölünerek yansır.
//   formül limit = (harcanabilir − o güne kadar harcanan) ÷ dönemde kalan gün
//   nakit sınırı = o güne kadar eline geçen para − harcananlar − ulaşım
//   günlük limit = en küçüğü (formül, nakit), yuvarlak sayıya aşağı yuvarlanmış
// Böylece harçlık gelmeyen günlerin (ör. hafta sonu) parası kendiliğinden
// ayrılmış olur ve limit, cebindeki paradan fazla çıkmaz.
// Borç ödemeleri (kart ödemesi, taksitler) aylık ödemeler gibi ayrılır (bkz. borc.js).
// Ek gelirler (burs, part-time, bayram harçlığı) geldikleri dönemin gelirine eklenir.
// Dönem haftalıksa aylık ek gelirler, aylık ödemeler gibi haftalara bölünür.
// Kumbara payı = hedeflerin payı + gelirin seçilen yüzdesi (düzenli birikim)
//                + dönem limitinin yuvarlamasından artan.
// Yuvarlamadan artan para da sonraki günlere dağıtılmaz, birikime gider.
// ============================================================

// Resmî tatiller (yarım gün arifeler dahil edilmedi)
const RESMI_TATILLER = {
  '2026-07-15': 'Demokrasi ve Millî Birlik Günü',
  '2026-08-30': 'Zafer Bayramı',
  '2026-10-29': 'Cumhuriyet Bayramı',
  '2027-01-01': 'Yılbaşı',
  '2027-03-09': 'Ramazan Bayramı', '2027-03-10': 'Ramazan Bayramı', '2027-03-11': 'Ramazan Bayramı',
  '2027-04-23': 'Ulusal Egemenlik ve Çocuk Bayramı',
  '2027-05-01': 'Emek ve Dayanışma Günü',
  '2027-05-16': 'Kurban Bayramı', '2027-05-17': 'Kurban Bayramı', '2027-05-18': 'Kurban Bayramı',
  '2027-05-19': 'Kurban Bayramı · 19 Mayıs',
  '2027-07-15': 'Demokrasi ve Millî Birlik Günü',
  '2027-08-30': 'Zafer Bayramı'
};

// Okul tatilleri (yalnızca lisede): MEB 2026–2027 çalışma takvimi.
// Üniversitelerin akademik takvimi farklı olduğu için üniversitede yalnızca resmî tatiller gelir.
const OKUL_TATILLERI = [
  ['2026-06-27', '2026-09-13', 'Yaz tatili'],
  ['2026-11-16', '2026-11-20', 'Ara tatil'],
  ['2027-01-25', '2027-02-05', 'Yarıyıl tatili'],
  ['2027-03-08', '2027-03-12', 'Ara tatil'],
  ['2027-06-26', '2027-09-12', 'Yaz tatili']
];

// ---------- Dönem sınırları ----------

// Aylık bir gelirin verilen aydaki gelişi. kayit: "yattı / gelmedi" işaretleri (veri.gelirKayit).
// Tarihi her ay değişen gelirde (gunSon > gun) işaretlenene kadar aralığın son günü beklenir.
function aylikGelis(kayit, kaynak, gun, gunSon, y, m) {
  const a = new Date(y, m, 1);
  const n = ayGunSayisi(a);
  const anahtar = `${a.getFullYear()}-${iki(a.getMonth() + 1)}`;
  const degisken = Number(gunSon) > gun;
  const ilk = new Date(a.getFullYear(), a.getMonth(), Math.min(gun, n));
  const beklenen = new Date(a.getFullYear(), a.getMonth(), Math.min(degisken ? Number(gunSon) : gun, n));
  const isaret = (kayit || {})[`${kaynak}|${anahtar}`] || null;
  const geldi = isaret && isaret !== 'yok' ? tarihCoz(isaret) : null;
  return { anahtar, ilk, beklenen, tarih: geldi || beklenen, degisken, isaret };
}

function maasGunuTarihi(profil, y, m, kayit) {
  return aylikGelis(kayit, 'ana', profil.maasGunu || 1, profil.maasGunuSon, y, m).tarih;
}

// Verilen günün içinde bulunduğu dönemin ilk günü
function donemBasBul(profil, tarih, kayit) {
  const d = gunBasi(tarih);
  if (profil.gelirDuzeni === 'haftalik') return gunEkle(d, -((d.getDay() - (profil.harclikGunu ?? 1) + 7) % 7));
  if (profil.gelirDuzeni === 'gunluk') return gunEkle(d, -((d.getDay() + 6) % 7));
  const buAy = maasGunuTarihi(profil, d.getFullYear(), d.getMonth(), kayit);
  return d >= buAy ? buAy : maasGunuTarihi(profil, d.getFullYear(), d.getMonth() - 1, kayit);
}

function donemSonBul(profil, bas, kayit) {
  if (profil.gelirDuzeni !== 'aylik') return gunEkle(bas, 6);
  return gunEkle(maasGunuTarihi(profil, bas.getFullYear(), bas.getMonth() + 1, kayit), -1);
}

function gelirGunuMu(profil, d, kayit) {
  if (profil.gelirDuzeni === 'haftalik') return d.getDay() === (profil.harclikGunu ?? 1);
  if (profil.gelirDuzeni === 'gunluk') return (profil.harclikGunleri || []).includes(d.getDay());
  return tarihStr(d) === tarihStr(maasGunuTarihi(profil, d.getFullYear(), d.getMonth(), kayit));
}

// Günlük limit yuvarlak bir sayıya aşağı yuvarlanır (₺486 → ₺450, ₺125 → ₺120); artan kısım birikime gider.
// ₺200'ün altında adım küçük tutulur ki öğrencinin günlük parasının büyük kısmı yuvarlamaya gitmesin.
function limitYuvarla(x) {
  if (x < 20) return Math.floor(x);
  const adim = x < 200 ? 10 : x < 1000 ? 50 : 100;
  return Math.floor(x / adim) * adim;
}

// ---------- Takvim motoru ----------
// aylikKumbara: hedefler için ayda ayrılması gereken toplam tutar

function takvimMotoru(veri, bugun = new Date(), aylikKumbara = 0) {
  const profil = veri.profil;
  const bugunS = tarihStr(bugun);
  const ulasim = veri.ulasim || { tip: 'yok' };
  const ulasimMaliyeti = ulasimGunlukMaliyet(ulasim);
  const kisiselTatil = new Set(veri.tatiller || []);
  const atlanan = new Set(veri.ulasimAtlanan || []);
  const baslangic = veri.baslangic || bugunS;
  const sabitAylik = toplam(veri.sabitGiderler);
  const tutar = Number(profil.gelirTutari) || 0;
  const istisna = veri.gelirIstisna || {};                  // { tarih: 'var' | 'yok' }: "geldi / gelmedi" işaretleri
  const kayit = veri.gelirKayit || {};                      // aylık/haftalık gelirlerin "yattı / gelmedi" işaretleri
  const ekler = (veri.ekGelirler || []).filter(e => Number(e.tutar) > 0);
  const tatildeHarclik = profil.tatildeHarclik !== false;
  const okulTatilleri = profil.okul === 'universite' ? [] : OKUL_TATILLERI;
  const birikimOrani = (Number(profil.birikimYuzdesi) || 0) / 100;

  // Günlere göre harcama toplamları. Planlı harcamalar (planId) günlük limitten
  // değil, kendileri için önceden ayrılan paradan düşülür.
  const serbestGun = {}, tumGun = {}, harcamaById = {};
  for (const h of veri.harcamalar) {
    const t = Number(h.tutar) || 0;
    tumGun[h.tarih] = (tumGun[h.tarih] || 0) + t;
    if (!h.planId) serbestGun[h.tarih] = (serbestGun[h.tarih] || 0) + t;
    harcamaById[h.id] = h;
  }
  // Cepteki paradan kumbaraya elle atılan (+) ya da kumbaradan cebe çekilen (−) para
  const kumbaraGun = {};
  for (const x of veri.kumbaraHareketleri || []) {
    if (x.cep) kumbaraGun[x.tarih] = (kumbaraGun[x.tarih] || 0) + (Number(x.tutar) || 0);
  }

  function tatil(t) {
    if (RESMI_TATILLER[t]) return { ad: RESMI_TATILLER[t], tur: 'resmi' };
    for (const [a, b, ad] of okulTatilleri) if (t >= a && t <= b) return { ad, tur: 'okul' };
    if (kisiselTatil.has(t)) return { ad: 'İzinli gün', tur: 'kisisel' };
    return null;
  }

  // null: ulaşım günü değil · 'var' · 'atlandi' (binmedim) · 'tatil'
  function ulasimDurumu(t, d = tarihCoz(t)) {
    if (ulasim.tip !== 'binis' || !ulasimMaliyeti) return null;
    if (!(ulasim.gunler || []).includes(d.getDay())) return null;
    if (tatil(t)) return 'tatil';
    if (atlanan.has(t)) return 'atlandi';
    return 'var';
  }

  // Günlük harçlıkta bir günün geliri. null: harçlık günü değil ·
  // { var, neden: 'normal' | 'tatil' (tatilde harçlık almıyor) | 'isaret' (kullanıcı geldi/gelmedi dedi) }
  function gelirDurumu(t, d = tarihCoz(t)) {
    if (!gelirGunuMu(profil, d, kayit)) return null;
    if (profil.gelirDuzeni !== 'gunluk') return { var: true, neden: 'normal' };
    const tatilde = !tatildeHarclik && !!tatil(t);
    if (istisna[t]) return { var: istisna[t] === 'var', neden: 'isaret', tatilde };
    return tatilde ? { var: false, neden: 'tatil', tatilde } : { var: true, neden: 'normal' };
  }
  function gelirVar(t, d) { const x = gelirDurumu(t, d); return !!(x && x.var); }

  // Bir günde görünen ek gelirler. durum: 'normal' · 'geldi' (yattı denildi) · 'yok' (gelmedi) ·
  // 'tahmini' (tarihi değişen gelirin en geç günü, henüz gelmedi) · 'varsayildi' (en geç günü geçti, geldi sayıldı)
  function ekGelirleri(t, d = tarihCoz(t)) {
    const liste = [];
    for (const e of ekler) {
      const tutarE = Number(e.tutar);
      if (e.tekrar === 'tek') {
        if (e.tarih === t) liste.push({ e, tutar: tutarE, tarih: t, durum: 'normal' });
      } else if (e.tekrar === 'haftalik') {
        if (d.getDay() === Number(e.haftaGunu) && t >= e.bas) {
          liste.push({ e, tutar: tutarE, tarih: t, anahtar: t, durum: kayit[`${e.id}|${t}`] === 'yok' ? 'yok' : 'normal' });
        }
      } else {
        // Eklendiği ayın gelişi de gösterilir (o ayın bütçesine katıldığı için)
        const g = aylikGelis(kayit, e.id, e.gun, e.gunSon, d.getFullYear(), d.getMonth());
        if (tarihStr(g.tarih) !== t || g.anahtar < e.bas.slice(0, 7)) continue;
        const durumE = g.isaret === 'yok' ? 'yok' : g.isaret ? 'geldi' : !g.degisken ? 'normal' : t > bugunS ? 'tahmini' : 'varsayildi';
        liste.push({ e, tutar: tutarE, tarih: t, anahtar: g.anahtar, durum: durumE });
      }
    }
    return liste;
  }

  // Tarihi her ay değişen gelirlerin (ana gelir dahil) t gününde açık olan, henüz "yattı" denmemiş aralıkları
  function bekleyenGelirler(t, d = tarihCoz(t)) {
    const liste = [];
    const bak = (kaynak, ad, tutarE, gun, gunSon) => {
      const g = aylikGelis(kayit, kaynak, gun, gunSon, d.getFullYear(), d.getMonth());
      if (!g.degisken || g.isaret) return;
      const ilkS = tarihStr(g.ilk), sonS = tarihStr(g.beklenen);
      if (t >= ilkS && t <= sonS) liste.push({ kaynak, ad, tutar: tutarE, anahtar: g.anahtar, ilk: ilkS, son: sonS });
    };
    if (profil.gelirDuzeni === 'aylik') bak('ana', gelirAdi(profil), tutar, profil.maasGunu || 1, profil.maasGunuSon);
    ekler.forEach(e => { if (e.tekrar === 'aylik' && t.slice(0, 7) >= e.bas.slice(0, 7)) bak(e.id, e.ad, Number(e.tutar), e.gun, e.gunSon); });
    return liste;
  }

  function planDurumu(p) {
    const h = p.harcamaId && harcamaById[p.harcamaId];
    if (h) return { durum: 'harcandi', ayrilan: Number(h.tutar) || 0 };
    return p.tarih >= bugunS ? { durum: 'bekliyor', ayrilan: Number(p.tutar) || 0 } : { durum: 'gecti', ayrilan: 0 };
  }

  const donemler = new Map();

  function donem(tarih) {
    const bas = donemBasBul(profil, tarih, kayit);
    const basS = tarihStr(bas);
    if (donemler.has(basS)) return donemler.get(basS);

    const son = donemSonBul(profil, bas, kayit);
    const sonS = tarihStr(son);
    // Kurulum dönemin ortasında yapıldıysa dönem, kurulum gününden başlar
    const ilk = veri.ilkDonem && veri.ilkDonem.bas === basS ? veri.ilkDonem : null;
    const efBas = ilk ? tarihCoz(ilk.tarih) : bas;
    const efBasS = tarihStr(efBas);
    const tamUzunluk = gunFarki(bas, son) + 1;
    const uzunluk = gunFarki(efBas, son) + 1;
    // Aylık giderlerin bu döneme düşen payı
    const oran = (profil.gelirDuzeni === 'aylik' ? 1 : tamUzunluk / 30.4375) * (uzunluk / tamUzunluk);

    // Ek gelirlerin bu döneme düşen tutarları, geldikleri güne yazılır. Düzenli bir gelir
    // uygulamaya eklenmeden (bas) ya da dönem kurulumla ortadan başlamadan önce geldiyse o güne yazılır.
    const ekGun = {}, ekKalemler = [];
    for (const e of ekler) {
      if (e.tekrar !== 'tek' && sonS < e.bas) continue;   // gelir eklenmeden önceki dönemlere yansımaz
      const tutarE = Number(e.tutar);
      let toplamE = 0;
      const yaz = (t, x) => {
        const g = [t, e.tekrar === 'tek' ? t : e.bas, efBasS].sort().pop();
        if (g > sonS || x <= 0) return;
        ekGun[g] = (ekGun[g] || 0) + x;
        toplamE += x;
      };
      if (e.tekrar === 'tek') {
        if (e.tarih >= efBasS && e.tarih <= sonS) yaz(e.tarih, tutarE);
      } else if (e.tekrar === 'haftalik') {
        for (let i = 0; i < uzunluk; i++) {
          const d = gunEkle(efBas, i), t = tarihStr(d);
          if (d.getDay() === Number(e.haftaGunu) && kayit[`${e.id}|${t}`] !== 'yok') yaz(t, tutarE);
        }
      } else if (profil.gelirDuzeni === 'aylik') {
        // Aylık bütçe: geliş günü dönemin içinde beklenen para; erken yattıysa dönemin başından beri elde
        for (let m = -1; m <= 1; m++) {
          const g = aylikGelis(kayit, e.id, e.gun, e.gunSon, bas.getFullYear(), bas.getMonth() + m);
          const beklenenS = tarihStr(g.beklenen);
          if (g.isaret !== 'yok' && beklenenS >= basS && beklenenS <= sonS) yaz(tarihStr(g.tarih), tutarE);
        }
      } else {
        // Haftalık bütçe: aylık gelir, aylık ödemeler gibi haftalara bölünür
        const g = aylikGelis(kayit, e.id, e.gun, e.gunSon, efBas.getFullYear(), efBas.getMonth());
        if (g.isaret !== 'yok') yaz(efBasS, tutarE * oran);
      }
      if (toplamE > 0) ekKalemler.push({ id: e.id, ad: e.ad, tekrar: e.tekrar, tutar: toplamE, bolunmus: e.tekrar === 'aylik' && profil.gelirDuzeni !== 'aylik' });
    }

    const gunler = [];
    let gelir = 0, anaGelir = 0, ekGelir = 0, ulasimPayi = 0, ulasimGunSayisi = 0, ulasimSerbest = 0, ulasimSerbestGun = 0;
    for (let i = 0; i < uzunluk; i++) {
      const d = gunEkle(efBas, i), t = tarihStr(d);
      let gelen = gelirVar(t, d) ? tutar : 0;
      if (ilk && i === 0) gelen = Number(ilk.bakiye) || 0;
      const ud = ulasimDurumu(t, d);
      if (ud === 'var') { ulasimPayi += ulasimMaliyeti; ulasimGunSayisi++; }
      else if (ud) { ulasimSerbest += ulasimMaliyeti; ulasimSerbestGun++; }
      const ekGelen = ekGun[t] || 0;
      anaGelir += gelen;
      ekGelir += ekGelen;
      gelir += gelen + ekGelen;
      gunler.push({ tarih: t, d, gelen, ekGelen, ulasim: ud, ulasimTutar: ud === 'var' ? ulasimMaliyeti : 0 });
    }

    const planlar = (veri.planlar || [])
      .filter(p => p.tarih >= efBasS && p.tarih <= sonS)
      .map(p => ({ ...p, ...planDurumu(p) }));
    const planPayi = planlar.reduce((t, p) => t + p.ayrilan, 0);

    const sabitPayi = sabitAylik * oran;
    const borcPayi = borcAylikOdeme(veri.borclar, efBasS.slice(0, 7)) * oran;
    const hedefPayi = aylikKumbara * oran;
    const duzenliPay = gelir * birikimOrani;                   // "önce kendine öde": gelirin seçilen yüzdesi
    const kullanilabilir = gelir - sabitPayi - borcPayi - ulasimPayi - planPayi;
    // Dönemin limiti de yuvarlak olsun (ör. 1.908 → 1.900); artan kumbaraya ayrılır
    const harcanabilir = limitYuvarla(kullanilabilir - hedefPayi - duzenliPay);
    const butceYuvarlama = kullanilabilir - hedefPayi - duzenliPay - harcanabilir;
    const kumbaraPayi = hedefPayi + duzenliPay + butceYuvarlama;

    // Gün gün limitler. Bugüne kadar gerçek harcamalar kullanılır; gelecek günler
    // için "her gün limiti kadar harcanırsa" varsayımıyla tahmin yapılır.
    const bekleyenPlan = {};
    planlar.forEach(p => { if (p.durum === 'bekliyor') bekleyenPlan[p.tarih] = (bekleyenPlan[p.tarih] || 0) + p.ayrilan; });
    let serbestKum = 0, tumKum = 0, alinanKum = 0, ulasimKum = 0, gercekSerbest = 0, gercekTum = 0;
    let yuvarlamaKum = 0, yuvarlamaGercek = 0;
    // Kumbaraya atılan para, atıldığı günden başlayarak kalan günlere bölünür. Çekilen para
    // yalnızca bu dönem cepten atılanı geri getirir; birikim kumbaradan limite taşınmaz.
    let kumbaraKum = 0;
    const gunluk = {};
    gunler.forEach((x, i) => {
      alinanKum += x.gelen + x.ekGelen;
      ulasimKum += x.ulasimTutar;
      kumbaraKum = Math.max(0, kumbaraKum + (kumbaraGun[x.tarih] || 0));
      const formul = (harcanabilir - serbestKum - yuvarlamaKum - kumbaraKum) / (uzunluk - i);
      const nakit = alinanKum - tumKum - ulasimKum - yuvarlamaKum - kumbaraKum;
      const ham = Math.max(0, Math.min(formul, nakit));
      const limit = limitYuvarla(ham);
      const gelecek = x.tarih > bugunS;
      gunluk[x.tarih] = {
        ...x, sira: i, limit, ham, tahmini: gelecek,
        formul: Math.max(0, formul), nakit, nakitSinirli: formul > 0 && nakit < formul,
        serbest: serbestGun[x.tarih] || 0, toplam: tumGun[x.tarih] || 0,
        oncekiSerbest: serbestKum, oncekiYuvarlama: yuvarlamaKum, kumbara: kumbaraKum
      };
      const serbest = gelecek ? limit : serbestGun[x.tarih] || 0;
      serbestKum += serbest;
      yuvarlamaKum += ham - limit;
      tumKum += (gelecek ? limit : tumGun[x.tarih] || 0) + (x.tarih >= bugunS ? bekleyenPlan[x.tarih] || 0 : 0);
      if (!gelecek) { gercekSerbest += serbestGun[x.tarih] || 0; gercekTum += tumGun[x.tarih] || 0; yuvarlamaGercek += ham - limit; }
    });

    const o = {
      bas, son, basS, sonS, efBas, efBasS, uzunluk, tamUzunluk, oran, ilk: !!ilk,
      gunler, gunluk, gelir, anaGelir, ekGelir, ekKalemler, ulasimPayi, ulasimGunSayisi, ulasimSerbest, ulasimSerbestGun,
      planlar, planPayi, sabitPayi, borcPayi, hedefPayi, duzenliPay, butceYuvarlama, kumbaraPayi, kullanilabilir, harcanabilir,
      yuvarlama: yuvarlamaKum, yuvarlamaGercek, kumbaraAtilan: kumbaraKum,
      serbestHarcanan: gercekSerbest, toplamHarcanan: gercekTum
    };
    donemler.set(basS, o);
    return o;
  }

  // Bir günün limit bilgisi; uygulama kullanılmaya başlanmadan önceki günler için null
  function gun(t) {
    if (t < baslangic) return null;
    return donem(tarihCoz(t)).gunluk[t] || null;
  }

  // Bugünden sonraki ilk gelir günü
  function sonrakiGelir(d = bugun) {
    for (let i = 1; i <= 62; i++) {
      const x = gunEkle(d, i);
      if (gelirVar(tarihStr(x), x)) return x;
    }
    return null;
  }

  return {
    bugunS, baslangic, ulasimMaliyeti, tatil, ulasimDurumu, planDurumu, donem, gun, sonrakiGelir, gelirDurumu,
    ekGelirleri, bekleyenGelirler,
    gelirGunuMu: d => gelirVar(tarihStr(d), d)
  };
}
