// ============================================================
// gercekler.js — ÇALIŞMA BELLEĞİ
// Kullanıcının ham verilerinden (gelir düzeni, harcama, hedef, takvim)
// kuralların kullanacağı "gerçekleri" hesaplar. Örn: günlük limit,
// sabit gider oranı, dönem sonu tahmini, hafta sonu kalkanı...
// Dönem ve günlük limit hesabının ayrıntısı: takvim.js
// ============================================================

// Kalan ay dönemin başından sayılır (plan dönemin içinde kurulduysa plan gününden). Bugünden
// sayılsaydı ay dönerken kalan ay bir azalır, bu dönemin payı henüz kumbaraya aktarılmadığı
// için iki kez sayılır ve dönemin son günlerinde limit birden düşerdi.
// Son tarihi dönem başlamadan geçmiş hedefe pay ayrılmaz (suresiDoldu): yoksa kalan tutarın
// tamamı her ay istenir, büyük bir hedefte günlük limit 0'a düşerdi. Kullanıcı yeni süre seçer.
function hedefAnalizi(hedefler, bugunBasi, donemBas = bugunBasi) {
  const basS = tarihStr(donemBas);
  return hedefler.map(h => {
    const kalanTutar = Math.max(0, h.hedefTutar - h.biriken);
    const gunFarkiH = gunFarki(bugunBasi, tarihCoz(h.sonTarih));
    const esas = h.planTarihi && h.planTarihi > basS ? tarihCoz(h.planTarihi) : donemBas;
    const kalanAy = kalanAySayisi(esas, tarihCoz(h.sonTarih));
    const suresiDoldu = kalanTutar > 0 && h.sonTarih <= basS;
    return { ...h, kalanTutar, kalanAy, gecikti: gunFarkiH < 0, suresiDoldu,
      aylikGereken: suresiDoldu ? 0 : kalanTutar / kalanAy, tamamlandi: kalanTutar === 0 };
  });
}

// KYK kredisinin bu ayki yatışı son 2 gün içindeyse tarihi (bağlı ek gelirin gelişi)
function takvimAyGelisi(tk, b, bugunBasi) {
  for (let i = 0; i <= 2; i++) {
    const t = tarihStr(gunEkle(bugunBasi, -i));
    if (tk.ekGelirleri(t).some(x => x.e.id === b.gelirId && x.durum !== 'yok' && x.durum !== 'tahmini')) return t;
  }
  return null;
}

function gercekleriHesapla(veri, bugun = new Date()) {
  const profil = veri.profil;
  const p = PROFIL;
  const esik = p.esik;
  const bugunBasi = gunBasi(bugun);
  const bugunS = tarihStr(bugun);
  const duzen = profil.gelirDuzeni || 'aylik';
  const ekGelirAylik = aylikEkGelir(veri.ekGelirler);         // burs, part-time gibi düzenli ek gelirler
  const gelir = aylikGelir(profil) + ekGelirAylik;             // oranlar için aylık eşdeğer gelir
  const gelirDegisken = gelirDegiskenMi(profil);

  // --- Birikim hedefleri (kumbara) ---
  const hedefler = hedefAnalizi(veri.hedefler, bugunBasi, donemBasBul(profil, bugunBasi, veri.gelirKayit || {}));
  const aktifHedefler = hedefler.filter(h => !h.tamamlandi);
  const toplamAylikHedef = aktifHedefler.reduce((t, h) => t + h.aylikGereken, 0);
  // Hedeflerin günlük paydaki yükü (K44); günlük pay = aylık eşdeğer gelir ÷ 30,44
  const gunlukGelirPayi = gelir / 30.44;
  const gunlukHedefPayi = toplamAylikHedef / 30.44;
  const hedefYukOrani = gelir > 0 ? toplamAylikHedef / gelir : 0;

  // --- Takvim ve içinde bulunulan dönem ---
  const tk = takvimMotoru(veri, bugun, toplamAylikHedef);
  const d = tk.donem(bugunBasi);
  const bk = d.gunluk[bugunS];
  const donemAdi = GELIR_DUZENLERI[duzen].donem;              // 'ay' | 'hafta'
  const donemGun = bk.sira + 1;                                // dönemde geçen gün (bugün dahil)
  const kalanGun = d.uzunluk - bk.sira;                        // dönemde kalan gün (bugün dahil)
  // Bu dönemde harcama kaydı tutulan gün sayısı (uygulama dönemin ortasında kurulduysa daha az)
  const kayitGun = gunFarki(tarihCoz(d.efBasS > tk.baslangic ? d.efBasS : tk.baslangic), bugunBasi) + 1;
  const gAdi = gelirAdi(profil);
  const donemSonuMetni = duzen === 'gunluk' ? 'hafta bitene kadar'
    : duzen === 'haftalik' ? `bir sonraki ${p.gelirE} kadar`
    : (profil.maasGunu || 1) === 1 && !gelirDegisken ? 'ay sonuna kadar' : `bir sonraki ${p.gelirE} kadar`;

  // --- Bu dönemin harcamaları (bugün dahil, ileri tarihliler hariç) ---
  // Kumbaradan ödenen kısım ("Bunu aldım") bütçeden düşmez; hesaplarda yalnızca cepten çıkan sayılır
  const donemTum = veri.harcamalar.filter(h => h.tarih >= d.efBasS && h.tarih <= bugunS);
  const donemH = donemTum.map(h => h.kumbaradan ? { ...h, tutar: cebinden(h) } : h);
  const harcanan = toplam(donemH);
  const serbestHarcanan = toplam(donemH.filter(h => !h.planId));
  const planliHarcanan = harcanan - serbestHarcanan;
  const istekToplam = toplam(donemH.filter(h => h.tur === 'istek'));
  const ihtiyacToplam = harcanan - istekToplam;

  // --- Sabit giderler (aylık) ---
  const sabitToplam = toplam(veri.sabitGiderler);
  const abonelikToplam = toplam(veri.sabitGiderler.filter(s => s.kategori === 'abonelik'));

  // --- Ulaşım ---
  const ulasim = veri.ulasim || { tip: 'yok' };
  const ulasimGunluk = tk.ulasimMaliyeti;
  const ulasimAylik = ulasimGunluk * (ulasim.gunler || []).length * 52 / 12;

  // --- Dönem bütçesi ---
  const donemGeliri = d.gelir;
  const kullanilabilir = d.kullanilabilir;                     // gelir − sabit − ulaşım − planlar
  const kalan = donemGeliri - d.sabitPayi - d.borcPayi - d.ulasimPayi - harcanan;
  const birikimPayi = d.kumbaraPayi;                           // "önce kendine öde": hedef payları + düzenli birikim
  const harcanabilirDonem = d.harcanabilir;                    // günlük limitin dayandığı tutar
  // Günlük limitlerin yuvarlamasından artan ve cepten kumbaraya atılan da harcanabilirden düşülür
  const kumbaraAtilan = d.kumbaraAtilan;
  const harcanabilirKalan = harcanabilirDonem - serbestHarcanan - d.yuvarlamaGercek - kumbaraAtilan;

  // --- Bugün ---
  const bugunHarcamalar = donemTum.filter(h => h.tarih === bugunS)
    .sort((a, b) => (b.saat || '').localeCompare(a.saat || ''));
  const bugunHarcanan = bk.serbest;
  const oncekiHarcanan = bk.oncekiSerbest;
  const gunlukLimit = bk.limit;
  // Bugün cepten kumbaraya atılan da bugünkü limitten düşer
  const bugunKalan = gunlukLimit - bk.kullanilan;
  // Seri için yalnızca harcamalar sayılır; kumbaraya atılan para limitten düşse de günü aşırmaz
  const bugunAsildi = Math.round(bk.serbest) > Math.round(gunlukLimit);
  const bugunOran = gunlukLimit > 0 ? bk.kullanilan / gunlukLimit : (bk.kullanilan > 0 ? 1 : 0);
  const yarinK = d.gunluk[tarihStr(gunEkle(bugunBasi, 1))];
  const yarinLimit = yarinK ? yarinK.limit : null;

  // --- Gelir günü ---
  const sonrakiGelirTarihi = tk.sonrakiGelir(bugunBasi);
  const gelireKalanGun = sonrakiGelirTarihi ? gunFarki(bugunBasi, sonrakiGelirTarihi) : null;
  const bugunGelirGunu = tk.gelirGunuMu(bugunBasi);
  const bugunGelir = tk.gelirDurumu(bugunS);                   // günlük harçlıkta: geldi mi, gelmedi mi?

  // --- Ek gelirler ---
  const bekleyenGelirler = tk.bekleyenGelirler(bugunS);        // tarihi değişen, "yattı" denmesi beklenen gelirler
  const bekleyenAnahtar = new Set(bekleyenGelirler.map(x => `${x.kaynak}|${x.anahtar}`));
  const bugunEkGelirler = tk.ekGelirleri(bugunS).filter(x => !bekleyenAnahtar.has(`${x.e.id}|${x.anahtar}`));
  // Son 7 günde gelen bir kerelik gelir (bayram harçlığı gibi): beklenmedik para
  const yediOnce = tarihStr(gunEkle(bugunBasi, -6));
  const yeniTekGelir = (veri.ekGelirler || [])
    .filter(e => e.tekrar === 'tek' && !e.borcId && e.tarih >= yediOnce && e.tarih <= bugunS && Number(e.tutar) >= esik.kucukHarcama)
    .sort((a, b) => b.tarih.localeCompare(a.tarih))[0] || null;

  // --- Ulaşım ve tatil (bugün) ---
  const bugunUlasim = bk.ulasim;                               // null | 'var' | 'atlandi' | 'tatil'
  const bugunTatil = tk.tatil(bugunS);

  // --- Planlar ---
  const planlar = (veri.planlar || []).map(x => ({ ...x, ...tk.planDurumu(x) }));
  const bugunPlanlar = planlar.filter(x => x.tarih === bugunS && x.durum === 'bekliyor');
  const yedi = tarihStr(gunEkle(bugunBasi, 7));
  const yaklasanPlanlar = planlar.filter(x => x.durum === 'bekliyor' && x.tarih > bugunS && x.tarih <= yedi)
    .sort((a, b) => a.tarih.localeCompare(b.tarih));
  const yaklasanPlan = yaklasanPlanlar.find(x => x.tarih <= d.sonS) || null;
  const gecen = tarihStr(gunEkle(bugunBasi, -7));
  const unutulanPlan = planlar.filter(x => x.durum === 'gecti' && x.tarih >= gecen && x.tarih >= tk.baslangic)
    .sort((a, b) => b.tarih.localeCompare(a.tarih))[0] || null;
  // İleriki bir dönemdeki büyük plan: bir dönemin rahat karşılayamayacağı kadar büyükse
  const idealDonemHarcanabilir = harcanabilirDonem + d.planPayi;
  const altmis = tarihStr(gunEkle(bugunBasi, 60));
  const buyukPlan = planlar.filter(x => x.durum === 'bekliyor' && x.tarih > d.sonS && x.tarih <= altmis
    && x.tutar > Math.max(0, idealDonemHarcanabilir) * 0.5)
    .sort((a, b) => a.tarih.localeCompare(b.tarih))[0] || null;

  // --- Son 7 gün (grafik için) ve "limit içinde" serisi ---
  const hafta = [];
  for (let i = 6; i >= 0; i--) {
    const x = gunEkle(bugunBasi, -i);
    const t = tarihStr(x);
    const k = tk.gun(t);
    hafta.push({ tarih: t, bugun: i === 0, gunAdi: GUN_KISA[x.getDay()], toplam: k ? k.serbest : 0, limit: k ? k.limit : null, asildi: !!(k && k.asildi) });
  }
  // Seri: dünden geriye, limitin içinde biten günler (bugün henüz bitmediği için sayılmaz)
  let seri = 0;
  for (let i = 1; i <= 400; i++) {
    const k = tk.gun(tarihStr(gunEkle(bugunBasi, -i)));
    if (!k || k.asildi) break;
    seri++;
  }

  // --- Tahminler (bu hızla dönem sonunda) ---
  const gunlukOrtalama = serbestHarcanan / kayitGun;
  const tahminiDonemSonu = serbestHarcanan + gunlukOrtalama * (kalanGun - 1);
  const yetecekGun = gunlukOrtalama > 0 ? Math.max(0, Math.floor((kullanilabilir - serbestHarcanan - kumbaraAtilan) / gunlukOrtalama)) : null;
  const tukenmeTarihi = yetecekGun !== null && yetecekGun < kalanGun - 1 ? gunEkle(bugunBasi, yetecekGun) : null;
  const tahminiBirikim = kullanilabilir - tahminiDonemSonu;

  // --- Kategoriler ---
  const kategoriToplamlari = {};
  donemH.forEach(h => { kategoriToplamlari[h.kategori] = (kategoriToplamlari[h.kategori] || 0) + Number(h.tutar); });
  let enBuyukKategori = null;
  for (const [id, t] of Object.entries(kategoriToplamlari)) {
    if (!enBuyukKategori || t > enBuyukKategori.toplam) enBuyukKategori = { id, toplam: t, pay: harcanan ? t / harcanan : 0 };
  }

  // --- Tekrarlayan küçük harcamalar (fırsat maliyeti için): son 30 gün ---
  const otuzGunOnce = tarihStr(gunEkle(bugunBasi, -29));
  const kucukBas = otuzGunOnce > tk.baslangic ? otuzGunOnce : tk.baslangic;
  const kucukGun = gunFarki(tarihCoz(kucukBas), bugunBasi) + 1;
  const gruplar = {};
  veri.harcamalar.filter(h => h.tur === 'istek' && h.tarih >= kucukBas && h.tarih <= bugunS && Number(h.tutar) <= esik.kucukHarcama).forEach(h => {
    const ad = (h.aciklama || '').trim() || kategori(h.kategori).ad;
    const anahtar = ad.toLocaleLowerCase('tr');
    gruplar[anahtar] = gruplar[anahtar] || { ad, adet: 0, toplam: 0 };
    gruplar[anahtar].adet++;
    gruplar[anahtar].toplam += Number(h.tutar);
  });
  const enSikKucuk = Object.values(gruplar).sort((a, b) => b.adet - a.adet || b.toplam - a.toplam)[0] || null;

  // --- Hafta sonu kalkanı: harçlığın gelmediği günler (yalnızca günlük düzende) ---
  let kalkan = null;
  if (duzen === 'gunluk') {
    const gunlerK = d.gunler.filter(x => x.tarih > bugunS && x.gelen === 0);
    if (gunlerK.length && d.gunler.some(x => x.gelen > 0)) {
      const ilkK = d.gunluk[gunlerK[0].tarih];
      const ideal = Math.max(0, harcanabilirDonem / d.uzunluk);
      kalkan = {
        gunler: gunlerK.map(x => x.tarih),
        gunAdlari: gunlerK.map(x => GUN_ADLARI[x.d.getDay()]),
        limit: ilkK.formul, ideal,
        oran: ideal > 0 ? ilkK.formul / ideal : 1,
        ihtiyac: gunlerK.reduce((t, x) => t + ilkK.formul + x.ulasimTutar, 0)
      };
    }
  }

  // --- Önceki dönem: kumbara payının dışında artan para ---
  // Dönem kapanırken birikimAktar() kaydeder. Burada yeniden hesaplanmaz: aktarımdan sonra hedefin
  // kalan tutarı azaldığı için o dönemin payı küçük çıkar, aktarılan para "artan" sanılırdı.
  let oncekiDonemArtan = 0;
  const onceki = tk.donem(gunEkle(d.bas, -1));
  const artanKaydi = veri.oncekiArtan;
  if (onceki.efBasS >= tk.baslangic && artanKaydi && artanKaydi.bas === onceki.basS) oncekiDonemArtan = artanKaydi.tutar;

  // --- "Alsam mı?" bekleme listesi ---
  const istekKayitlari = veri.istekListesi || [];
  const istekler = istekKayitlari.filter(x => x.durum === 'bekliyor').map(x => {
    const gecen = gunFarki(tarihCoz(x.eklenme), bugunBasi);
    return { ...x, gecen, kalan: Math.max(0, BEKLEME_GUN - gecen), hazir: gecen >= BEKLEME_GUN };
  }).sort((a, b) => b.hazir - a.hazir || a.kalan - b.kalan);
  const vazgecilenler = istekKayitlari.filter(x => x.durum === 'vazgecildi');
  const donemVazgecilen = vazgecilenler.filter(x => x.karar >= d.efBasS && x.karar <= bugunS);

  // --- Borçlar (bkz. borc.js) ---
  const borclar = veri.borclar || [];
  // Aylık borç yükü: önümüzdeki 30 günde vadesi gelen kart ödemeleri ve taksitler (dönem takvim ayıyla örtüşmeyebilir)
  const borcAylik = toplam(borcVadeleri(borclar, bugunS, tarihStr(gunEkle(bugunBasi, 29))));
  const { borc: toplamBorc, alacak: toplamAlacak } = borcToplamlari(veri, bugunS);
  // Önümüzdeki 3 günde ödenecekler (kart ve kişilere olan borç; taksitler kendiliğinden ödenir)
  const yaklasanOdemeler = [];
  for (let i = 0; i <= 3; i++) {
    const t = tarihStr(gunEkle(bugunBasi, i));
    borcOlaylari(borclar, t, bugunS).filter(x => x.durum === 'bekliyor' && x.b.tur !== 'taksit' && !(x.b.tur === 'kisi' && x.b.yon === 'alacak'))
      .forEach(x => yaklasanOdemeler.push({ ...x, tarih: t, kalanGun: i }));
  }
  // Son ödeme günü geçmiş ama ödenmemiş kart borcu ve vadesi geçmiş kişisel borçlar
  const gecikenOdemeler = [], gecikenAlacaklar = [];
  for (const b of borclar) {
    if (b.tur === 'kart') {
      const ay = bugunS.slice(0, 7), vade = tarihStr(ayGunu(ay, b.gun));
      if (ay >= kartIlkAy(b) && vade < bugunS && !kartOdenen(b, ay) && Number(b.borc) >= 1) gecikenOdemeler.push({ b, tarih: vade, tutar: kartPlanli(b), durum: 'gecikti' });
    } else if (b.tur === 'kisi' && b.vade && b.vade < bugunS && !b.kapandi) {
      (b.yon === 'alacak' ? gecikenAlacaklar : gecikenOdemeler).push({ b, tarih: b.vade, tutar: Number(b.tutar), durum: 'gecikti' });
    }
  }
  // Yalnızca asgari (ya da asgariye yakın) ödenen kart borcu: kaç ayda biter, ne kadar faiz?
  const tuzakKart = borclar.find(b => b.tur === 'kart' && Number(b.borc) >= 1 && Number(b.faiz) > 0 && b.odeme !== 'tam');
  const kartTuzak = tuzakKart ? { b: tuzakKart, planli: kartPlanli(tuzakKart), asgari: kartAsgariSimule(tuzakKart),
    plan: kartSimule(Number(tuzakKart.borc), Number(tuzakKart.faiz), () => kartPlanli(tuzakKart)) } : null;
  // KYK kredisi son 2 günde yattı: borç olduğunu hatırlat
  const kykYatti = borclar.filter(b => b.tur === 'kyk').map(b => {
    const g = takvimAyGelisi(tk, b, bugunBasi);
    return g ? { b, tarih: g, toplam: kykAlinan(b, veri.gelirKayit, bugunS), mezuniyette: kykMezuniyette(b, veri.gelirKayit, bugunS) } : null;
  }).find(Boolean) || null;
  // Son yüklenen kart ekstresi (bkz. ekstre.js): faiz/ücret ve kaydedilmemiş harcamalar
  const ekstreler = borclar.filter(b => b.tur === 'kart' && b.ekstre)
    .map(b => ({ b, ...b.ekstre, gecen: gunFarki(tarihCoz(b.ekstre.yuklendi), bugunBasi) }));
  const ekstreFaiz = ekstreler.filter(x => x.faiz >= 1 && x.gecen <= 30).sort((a, b) => b.faiz - a.faiz)[0] || null;
  const ekstreEksik = ekstreler.filter(x => x.gecen <= 7 && x.eksikSayi >= 2 && x.eksikSayi / x.harcamaSayisi >= 0.2)
    .sort((a, b) => b.eksikToplam - a.eksikToplam)[0] || null;

  // --- Olası çift kayıt: son 7 günde aynı gün, aynı tutar, aynı kategori ve not ---
  // ("Yine de ekle" ya da "Ayrı harcamalar" denen kayıtlar ciftOnay ile işaretlidir)
  const yediGun = tarihStr(gunEkle(bugunBasi, -6));
  const gruplarC = {};
  veri.harcamalar.filter(h => h.tarih >= yediGun && h.tarih <= bugunS && !h.planId && !h.ciftOnay).forEach(h => {
    const k = ['h', h.tarih, Math.round(h.tutar * 100), h.kategori, metinNormal(h.aciklama)].join('|');
    (gruplarC[k] = gruplarC[k] || []).push(h);
  });
  (veri.ekGelirler || []).filter(e => e.tekrar === 'tek' && e.tarih >= yediGun && e.tarih <= bugunS && !e.ciftOnay && !e.borcId).forEach(e => {
    const k = ['g', e.tarih, Math.round(e.tutar * 100)].join('|');
    (gruplarC[k] = gruplarC[k] || []).push(e);
  });
  const ciftGrup = Object.entries(gruplarC).filter(([, l]) => l.length > 1).sort((a, b) => b[0].split('|')[1].localeCompare(a[0].split('|')[1]))[0];
  const ciftKayit = ciftGrup ? {
    gelir: ciftGrup[0].startsWith('g'), adet: ciftGrup[1].length, tarih: ciftGrup[1][0].tarih, tutar: Number(ciftGrup[1][0].tutar),
    ad: ciftGrup[1][0].ad || ciftGrup[1][0].aciklama || kategori(ciftGrup[1][0].kategori).ad, kayitlar: ciftGrup[1]
  } : null;

  // --- Acil durum fonu ---
  const zorunluAylik = sabitToplam + borcAylik + ulasimAylik + (ihtiyacToplam / kayitGun) * 30.44;

  return {
    profilAdi: p.ad, esik, takvim: tk, donem: d,
    okul: OKUL_DUZEYLERI[profil.okul] ? profil.okul : null,
    duzen, donemAdi, donemMetni: `bu ${donemAdi}`, donemSonuMetni, gelirAdi: gAdi,
    gelir, ekGelirAylik, gelirDegisken, donemGeliri, donemAnaGelir: d.anaGelir, donemEkGelir: d.ekGelir, ekKalemler: d.ekKalemler,
    bekleyenGelirler, bugunEkGelirler, yeniTekGelir, donemGun, kayitGun, donemUzunluk: d.uzunluk, kalanGun,
    donemOrani: donemGun / d.uzunluk,
    sabitToplam, sabitPayi: d.sabitPayi, sabitOrani: gelir ? sabitToplam / gelir : 0,
    abonelikToplam, abonelikOrani: gelir ? abonelikToplam / gelir : 0,
    ulasimTipi: ulasim.tip, ulasimGunluk, ulasimAylik, ulasimOrani: gelir ? ulasimAylik / gelir : 0,
    ulasimPayi: d.ulasimPayi, ulasimGunSayisi: d.ulasimGunSayisi, ulasimSerbest: d.ulasimSerbest, ulasimSerbestGun: d.ulasimSerbestGun,
    planPayi: d.planPayi, planliHarcanan, planlar, bugunPlanlar, yaklasanPlanlar, yaklasanPlan, unutulanPlan, buyukPlan,
    harcanan, serbestHarcanan, harcamaSayisi: donemH.length,
    istekToplam, ihtiyacToplam, istekOrani: donemGeliri ? istekToplam / donemGeliri : 0,
    kullanilabilir, kalan, birikimPayi, harcanabilirDonem, harcanabilirKalan,
    hedefPayi: d.hedefPayi, duzenliPay: d.duzenliPay, butceYuvarlama: d.butceYuvarlama, birikimYuzdesi: Number(profil.birikimYuzdesi) || 0,
    yuvarlamaBirikim: d.yuvarlamaGercek, oncekiYuvarlama: bk.oncekiYuvarlama, hamLimit: bk.ham, bugunGelir,
    kumbaraAtilan, bugunKumbara: bk.kumbara,
    bugunHarcamalar, bugunHarcanan, oncekiHarcanan, gunlukLimit, formulLimit: bk.formul,
    nakitSinirli: bk.nakitSinirli, cep: bk.nakit, bugunKalan, bugunAsildi, bugunOran, yarinLimit,
    sonrakiGelirTarihi, gelireKalanGun, bugunGelirGunu, bugunUlasim, bugunTatil,
    seri, hafta, haftaToplam: hafta.reduce((t, x) => t + x.toplam, 0),
    gunlukOrtalama, tahminiDonemSonu, tukenmeTarihi,
    tahminiBirikim, birikimOrani: donemGeliri ? tahminiBirikim / donemGeliri : 0,
    kategoriToplamlari, enBuyukKategori, enSikKucuk, kucukGun,
    hedefler, aktifHedefler, aktifHedefSayisi: aktifHedefler.length, toplamAylikHedef,
    gunlukGelirPayi, gunlukHedefPayi, hedefYukOrani,
    acilFonVar: veri.hedefler.some(h => h.acil),
    kalkan, oncekiDonemArtan,
    istekler, kararZamani: istekler.filter(x => x.hazir),
    kurtarilanToplam: toplam(vazgecilenler), vazgecmeSayisi: vazgecilenler.length,
    donemKurtarilan: toplam(donemVazgecilen), donemVazgecme: donemVazgecilen.length,
    zorunluAylik, acilFonHedefi: zorunluAylik * esik.acilDurumAy,
    borcPayi: d.borcPayi, borcAylik, borcOrani: gelir ? borcAylik / gelir : 0, toplamBorc, toplamAlacak,
    yaklasanOdemeler, gecikenOdemeler, gecikenAlacaklar, kartTuzak, kykYatti, ciftKayit, ekstreFaiz, ekstreEksik
  };
}
