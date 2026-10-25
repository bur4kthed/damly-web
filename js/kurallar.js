// ============================================================
// kurallar.js — BİLGİ TABANI
// Uzman sistemin "bilgisi" bu dosyadaki EĞER–İSE kurallarıdır.
// Her kural:
//   kosul(g)  → EĞER kısmı: çalışma belleğindeki gerçeklere bakar
//   sonuc(g)  → İSE kısmı: yeni gerçek ekler ve/veya öneri üretir
//   eger/ise  → kuralın insanların okuyabileceği hâli (açıklama için)
//   sade(g)   → isteğe bağlı: ilkokul/ortaokul için önerinin kısa ve kolay anlatımı
// "Dönem", paranın geliş düzenine göre ay ya da haftadır (bkz. takvim.js).
// ============================================================

const KURALLAR = [
  {
    id: 'K01', ad: 'Gelir bilgisi kontrolü',
    eger: 'gelir girilmemiş',
    ise: 'kullanıcıyı gelirini girmeye yönlendir',
    kaynak: 'Bütçe planlamanın temel ilkesi: önce gelirini bil.',
    sade: g => ({
      baslik: 'Önce harçlığını yaz',
      mesaj: 'Ne kadar harçlık aldığını bilmeden hesap yapamam. <b>Profil</b> ekranından harçlığını ve ne zaman geldiğini yaz.'
    }),
    kosul: g => g.gelir <= 0,
    sonuc: g => ({
      gercek: { gelirYok: true },
      oneri: {
        seviye: 'kritik', baslik: 'Önce gelirini gir',
        mesaj: 'Gelirini bilmeden bütçe hesabı yapamam. <b>Profil</b> ekranından harçlık, burs veya maaşını ve ne sıklıkla geldiğini gir.',
        neden: 'Günlük harcama sınırı, birikim ve tüm oranlar gelire göre hesaplanır. Şu an kayıtlı gelir: 0 TL.'
      }
    })
  },
  {
    id: 'K02', ad: 'Bütçe açığı tespiti',
    eger: 'sabit gider payı + ulaşım payı + bu dönemki harcamalar > dönemin geliri',
    ise: 'kritik uyarı ver; belleğe "bütçe açığı" gerçeğini ekle',
    kaynak: 'Temel bütçe denklemi: Gelir − Gider = Artık',
    sade: g => ({
      baslik: `${buyukHarf(g.donemMetni)} paran yetmedi`,
      mesaj: `Elindeki paradan <b>${para(-g.kalan)}</b> fazla harcamışsın. ${buyukHarf(g.donemSonuMetni)} yalnızca gerçekten gereken şeyleri al.`
    }),
    kosul: g => g.gelir > 0 && g.kalan < 0,
    sonuc: g => ({
      gercek: { butceAcigi: true },
      oneri: {
        seviye: 'kritik', baslik: `${buyukHarf(g.donemMetni)} bütçeni aştın`,
        mesaj: `Bu dönemin gelirini <b>${para(-g.kalan)}</b> aştın. ${buyukHarf(g.donemSonuMetni)} yalnızca zorunlu ihtiyaçlara harcama yap ve sabit giderlerini gözden geçir.`,
        neden: `Dönem geliri ${para(g.donemGeliri)} − sabit gider payı ${para(g.sabitPayi)}${g.borcPayi >= 1 ? ` − borç ödemeleri ${para(g.borcPayi)}` : ''} − ulaşım payı ${para(g.ulasimPayi)} − harcanan ${para(g.harcanan)} = <b>${para(g.kalan)}</b>. Sonuç sıfırın altında olduğu için kural tetiklendi.`
      }
    })
  },
  {
    id: 'K03', ad: 'Sabit gider oranı kontrolü',
    eger: 'sabit giderler ÷ aylık gelir > profilin sabit gider sınırı',
    ise: 'uyarı ver; belleğe "sabit gider yüksek" gerçeğini ekle',
    kaynak: '50/30/20 bütçe kuralı (E. Warren & A. W. Tyagi, "All Your Worth", 2005) — zorunlu giderler gelirin yaklaşık yarısını geçmemeli.',
    sade: g => ({
      baslik: 'Düzenli ödemelerin çok fazla',
      mesaj: `Eline geçen ${ondaKac(g.sabitOrani)}, daha harcamaya başlamadan abonelik gibi düzenli ödemelere gidiyor. Hangisinden vazgeçebileceğini ailenle konuş.`
    }),
    kosul: g => g.gelir > 0 && g.sabitOrani > g.esik.sabitOrani,
    sonuc: g => ({
      gercek: { sabitYuksek: true },
      oneri: {
        seviye: 'uyari', baslik: 'Sabit giderlerin çok yüksek',
        mesaj: `Sabit gider oranın <b>${yuzde(g.sabitOrani)}</b> (önerilen en fazla ${yuzde(g.esik.sabitOrani)}). Gelirinin büyük kısmı daha dönem başında harcanmış oluyor. Abonelik, telefon tarifesi gibi kalemlerde daha ucuz seçenek ara.`,
        neden: `Sabit giderler ${para(g.sabitToplam)}/ay ÷ aylık gelir ${para(g.gelir)} = ${yuzde(g.sabitOrani)}. ${g.profilAdi} profili için sınır ${yuzde(g.esik.sabitOrani)}.`
      }
    })
  },
  {
    id: 'K04', ad: 'Bütçe tükenme tahmini',
    eger: 'bugüne kadarki harcama + günlük ortalama × kalan gün > kullanılabilir para',
    ise: 'paranın biteceği günü tahmin et; belleğe "bütçe riski" gerçeğini ekle',
    kaynak: 'Doğrusal harcama projeksiyonu (bugüne kadarki ortalama hızın dönem sonuna uzatılması).',
    sade: g => ({
      baslik: 'Bu gidişle paran yetmeyecek',
      mesaj: `Böyle harcamaya devam edersen paran ${g.tukenmeTarihi ? `<b>${uzunTarih(tarihStr(g.tukenmeTarihi))}</b> günü` : 'erkenden'} bitecek. Bundan sonra günde en fazla <b>${para(g.bugunKalan < 0 && g.yarinLimit !== null ? g.yarinLimit : g.gunlukLimit)}</b> harcarsan yetişir.`
    }),
    kosul: g => g.gelir > 0 && !g.butceAcigi && g.kayitGun >= 3 && g.serbestHarcanan > 0 && g.tahminiDonemSonu > g.kullanilabilir,
    sonuc: g => ({
      gercek: { butceRiski: true },
      oneri: {
        seviye: 'uyari', baslik: 'Bu hızla para yetmeyecek',
        mesaj: `Bu hızla harcamaya devam edersen paran ${g.tukenmeTarihi ? `<b>${uzunTarih(tarihStr(g.tukenmeTarihi))}</b> günü` : 'dönem bitmeden'} bitecek. ${buyukHarf(g.donemSonuMetni)} günde en fazla <b>${para(g.bugunKalan < 0 && g.yarinLimit !== null ? g.yarinLimit : g.gunlukLimit)}</b> harcamalısın.`,
        neden: `Bu dönem ${g.kayitGun} günde ${para(g.serbestHarcanan)} harcadın → günlük ortalama ${para(g.gunlukOrtalama)}. Kalan ${g.kalanGun - 1} gün de böyle giderse dönem sonunda toplam ${para(g.tahminiDonemSonu)} harcamış olursun; bu, kullanılabilir paran olan ${para(g.kullanilabilir)} tutarından fazla.`
      }
    })
  },
  {
    id: 'K05', ad: 'İstek harcaması oranı',
    eger: 'istek harcamaları ÷ dönemin geliri > profilin istek sınırı',
    ise: 'uyarı ver; belleğe "istek harcaması yüksek" gerçeğini ekle',
    kaynak: '50/30/20 bütçe kuralı — isteklere gelirin en fazla %30 kadarı ayrılmalı.',
    sade: g => ({
      baslik: 'Canının istediği şeylere çok para gitti',
      mesaj: `${buyukHarf(g.donemMetni)} olmasa da olur dediğin şeylere (atıştırmalık, oyun gibi) <b>${para(g.istekToplam)}</b> harcadın. Bu, eline geçen ${ondaKac(g.istekOrani)} demek. En fazla ${ondaKac(g.esik.istekOrani)} olsa iyi olur.`
    }),
    kosul: g => g.donemGeliri > 0 && g.istekOrani > g.esik.istekOrani,
    sonuc: g => ({
      gercek: { istekYuksek: true },
      oneri: {
        seviye: 'uyari', baslik: 'İstek harcamaların sınırı aştı',
        mesaj: `${buyukHarf(g.donemMetni)} isteklere <b>${para(g.istekToplam)}</b> harcadın. İstek / gelir oranın ${yuzde(g.istekOrani)}; ${g.profilAdi} profili için önerilen sınır ${yuzde(g.esik.istekOrani)}.`,
        neden: `"İstek" olarak işaretlediğin harcamaların toplamı ${para(g.istekToplam)} ÷ dönemin geliri ${para(g.donemGeliri)} = ${yuzde(g.istekOrani)} > ${yuzde(g.esik.istekOrani)}.`
      }
    })
  },
  {
    id: 'K06', ad: 'İstekleri erteleme planı (zincirleme kural)',
    eger: 'bellekte "bütçe riski" (K04) VE "istek harcaması yüksek" (K05) var',
    ise: 'istek harcamalarını erteleyerek açığı kapatma planı öner',
    kaynak: 'Uzman sistem çıkarımı: iki ayrı kuralın sonuçlarının birleştirilmesi.',
    sade: g => ({
      baslik: 'Biraz bekle, paran cebinde kalsın',
      mesaj: `Kalan ${g.kalanGun} günde canının istediği şeyleri almayı ertelersen yaklaşık <b>${para(g.istekToplam / g.kayitGun * g.kalanGun)}</b> cebinde kalır. Bir şey almadan önce kendine sor: <i>"Buna gerçekten ihtiyacım var mı?"</i>`
    }),
    kosul: g => g.butceRiski && g.istekYuksek,
    sonuc: g => {
      const gunlukIstek = g.istekToplam / g.kayitGun;
      const tasarruf = gunlukIstek * g.kalanGun;
      return {
        oneri: {
          seviye: 'oneri', baslik: 'İstekleri ertele, dönemi kurtar',
          mesaj: `Kalan ${g.kalanGun} günde istek harcamalarını erteleyebilirsen yaklaşık <b>${para(tasarruf)}</b> tasarruf edersin. Bir şey almadan önce kendine sor: <i>"Buna gerçekten ihtiyacım var mı, yoksa bir hafta bekleyebilir mi?"</i>`,
          neden: `Bu öneri iki kuralın sonucundan <b>çıkarıldı</b>: K04 belleğe "bütçe riski", K05 "istek harcaması yüksek" gerçeğini ekledi. K06 bu iki gerçeği birlikte görünce tetiklendi. Hesap: günlük istek ortalaman ${para(gunlukIstek)} × ${g.kalanGun} gün ≈ ${para(tasarruf)}.`
        }
      };
    }
  },
  {
    id: 'K07', ad: 'Fırsat maliyeti (küçük harcamalar)',
    eger: 'aynı küçük istek harcaması son 30 günde 4 veya daha fazla kez yapılmış',
    ise: 'harcamanın yıllık maliyetini ve bir hedefle karşılaştırmasını göster',
    kaynak: 'İktisatta fırsat maliyeti kavramı; "latte faktörü" (D. Bach).',
    sade: g => {
      const k = g.enSikKucuk;
      return {
        mesaj: `Son ${g.kucukGun} günde <b>${esc(k.ad)}</b> için ${k.adet} kez para verdin, toplam ${para(k.toplam)}. Küçük gibi duruyor ama böyle giderse bir yılda <b>${para((k.toplam / g.kucukGun) * 365)}</b> eder!`
      };
    },
    kosul: g => g.enSikKucuk && g.enSikKucuk.adet >= 4,
    sonuc: g => {
      const k = g.enSikKucuk;
      const yillik = (k.toplam / g.kucukGun) * 365;
      const h = g.aktifHedefler[0];
      const hedefCumlesi = h
        ? ` Bu parayı biriktirseydin <b>"${esc(h.ad)}"</b> hedefine yaklaşık <b>${Math.max(1, Math.ceil(h.kalanTutar / (yillik / 12)))} ayda</b> ulaşırdın.`
        : '';
      return {
        oneri: {
          seviye: 'oneri', baslik: `Küçük ama sık: ${esc(k.ad)}`,
          mesaj: `Son ${g.kucukGun} günde <b>${esc(k.ad)}</b> için ${k.adet} kez toplam ${para(k.toplam)} harcadın. Küçük görünen bu harcama bu tempoyla yılda yaklaşık <b>${para(yillik)}</b> eder.${hedefCumlesi}`,
          neden: `${para(g.esik.kucukHarcama)} ve altındaki harcamalar "küçük harcama" sayılır. "${esc(k.ad)}" son ${g.kucukGun} günde ${k.adet} kez tekrarlandı (sınır: 4). Yıllık tahmin: ${para(k.toplam)} ÷ ${g.kucukGun} gün × 365 gün = ${para(yillik)}.`
        }
      };
    }
  },
  {
    id: 'K08', ad: 'Kategori yoğunlaşması',
    eger: 'tek bir kategori bu dönemki harcamaların %40 kadarından fazlası',
    ise: 'o kategori için haftalık sınır koymayı öner',
    kaynak: 'Harcama çeşitliliği analizi; zarf (envelope) bütçeleme yöntemi.',
    sade: g => {
      const kat = kategori(g.enBuyukKategori.id);
      return {
        baslik: `Paranın çoğu ${kat.ad} için gidiyor`,
        mesaj: `Harcadığın ${ondaKac(g.enBuyukKategori.pay)} <b>${kat.ad}</b> için. Haftada en fazla <b>${para(g.enBuyukKategori.toplam / g.kayitGun * 7 * 0.8)}</b> harcamayı dene.`
      };
    },
    kosul: g => g.enBuyukKategori && g.harcanan >= g.donemGeliri * 0.1 && g.enBuyukKategori.pay > 0.4,
    sonuc: g => {
      const kat = kategori(g.enBuyukKategori.id);
      return {
        oneri: {
          seviye: 'oneri', baslik: `Harcamaların ${kat.ad} kategorisinde yoğunlaşmış`,
          mesaj: `Bu dönemki harcamalarının ${yuzde(g.enBuyukKategori.pay)} kadarı <b>${kat.ad}</b> kategorisinde (${para(g.enBuyukKategori.toplam)}). Bu kategori için haftalık bir sınır koymayı dene: haftada en fazla <b>${para(g.enBuyukKategori.toplam / g.kayitGun * 7 * 0.8)}</b>.`,
          neden: `${kat.ad} ${para(g.enBuyukKategori.toplam)} ÷ toplam ${para(g.harcanan)} = ${yuzde(g.enBuyukKategori.pay)} > %40. Önerilen haftalık sınır, mevcut haftalık ortalamanın %80 kadarıdır.`
        }
      };
    }
  },
  {
    id: 'K09', ad: 'Abonelik kontrolü',
    eger: 'abonelikler ÷ aylık gelir > %5',
    ise: 'kullanılmayan abonelikleri gözden geçirmeyi öner',
    kaynak: 'Tüketici finansı önerisi: düzenli küçük ödemeler fark edilmeden birikir.',
    sade: g => ({
      baslik: 'Aboneliklerine bir bak',
      mesaj: `Her ay aboneliklere ${para(g.abonelikToplam)} ödüyorsun; bir yılda <b>${para(g.abonelikToplam * 12)}</b> eder. Kullanmadığın bir abonelik varsa ailenle konuşup iptal edebilirsin.`
    }),
    kosul: g => g.gelir > 0 && g.abonelikToplam > 0 && g.abonelikOrani > 0.05,
    sonuc: g => ({
      oneri: {
        seviye: 'oneri', baslik: 'Aboneliklerini gözden geçir',
        mesaj: `Aboneliklerine ayda ${para(g.abonelikToplam)}, yılda <b>${para(g.abonelikToplam * 12)}</b> ödüyorsun. Son bir ayda kullanmadığın bir abonelik varsa iptal etmeyi düşün.`,
        neden: `Abonelik toplamı ${para(g.abonelikToplam)} ÷ aylık gelir ${para(g.gelir)} = ${yuzde(g.abonelikOrani)} > %5.`
      }
    })
  },
  {
    id: 'K10', ad: 'Birikim hedefi önerisi',
    eger: 'hiç aktif birikim hedefi yok',
    ise: 'kumbarada bir hedef oluşturmayı öner',
    kaynak: 'Hedef belirleme: somut ve tarihli hedefler biriktirmeyi kolaylaştırır.',
    sade: g => ({
      baslik: 'Bir hayalin için biriktir',
      mesaj: 'Henüz bir hedefin yok. Almak istediğin bir şey için biriktirmek çok daha kolaydır. <b>Kumbara</b> sekmesinden "Bisiklet" ya da "Kulaklık" gibi bir hedef ekle.'
    }),
    kosul: g => g.gelir > 0 && g.aktifHedefSayisi === 0,
    sonuc: g => ({
      gercek: { hedefYok: true },
      oneri: {
        seviye: 'oneri', baslik: 'Bir birikim hedefi koy',
        mesaj: 'Henüz bir birikim hedefin yok. Somut bir hedef biriktirmeyi kolaylaştırır. <b>Kumbara</b> sekmesinden "Yeni telefon" veya "Tatil" gibi bir hedef oluştur.',
        neden: 'Aktif birikim hedefi sayısı: 0.'
      }
    })
  },
  {
    id: 'K11', ad: 'Hedef gerçekçilik kontrolü',
    eger: 'hedefler için bu döneme düşen pay > tahmini dönem sonu artığı',
    ise: 'hedeflerin risk altında olduğunu bildir; belleğe "hedef riski" ekle',
    kaynak: 'Birikim planlaması: hedef ÷ kalan süre = düzenli birikim miktarı.',
    sade: g => ({
      baslik: 'Hedefin tehlikede',
      mesaj: `Kumbaran için ${g.donemMetni} <b>${para(g.birikimPayi)}</b> ayırmamız gerek, ama böyle harcarsan sonunda <b>${para(Math.max(0, g.tahminiBirikim))}</b> kalacak. Biraz daha az harcarsan ya da hedefin tarihini ileri alırsan yetişir.`
    }),
    kosul: g => g.gelir > 0 && g.aktifHedefSayisi > 0 && g.birikimPayi > Math.max(0, g.tahminiBirikim),
    sonuc: g => ({
      gercek: { hedefRiski: true },
      oneri: {
        seviye: 'uyari', baslik: 'Hedeflerin risk altında',
        mesaj: `Kumbaran için ${g.donemMetni} <b>${para(g.birikimPayi)}</b> ayrılıyor, ama bu harcama hızıyla dönem sonunda elinde yaklaşık <b>${para(Math.max(0, g.tahminiBirikim))}</b> kalacak. Harcamalarını azaltmayı ya da hedef tarihini ertelemeyi düşün.`,
        neden: g.aktifHedefler.map(h => `"${esc(h.ad)}": kalan ${para(h.kalanTutar)} ÷ ${h.kalanAy} ay = ${para(h.aylikGereken)}/ay`).join('<br>')
          + `<br>Bu döneme düşen pay: ${para(g.birikimPayi)}. Tahmini dönem sonu artığı: kullanılabilir ${para(g.kullanilabilir)} − tahmini harcama ${para(g.tahminiDonemSonu)} = ${para(g.tahminiBirikim)}.`
      }
    })
  },
  {
    id: 'K12', ad: 'Hedefler yolunda',
    eger: 'aktif hedef var VE tahmini dönem sonu artığı ≥ hedeflerin bu döneme düşen payı',
    ise: 'kullanıcıyı tebrik et',
    kaynak: 'Olumlu pekiştirme: doğru davranışı fark ettirmek alışkanlığı güçlendirir.',
    sade: g => ({
      baslik: 'Hedefine doğru gidiyorsun',
      mesaj: `Böyle devam edersen kumbaran için ayırdığımız ${para(g.birikimPayi)} yerinde kalacak. Dönem bitince kendiliğinden kumbarana geçer.`
    }),
    kosul: g => g.gelir > 0 && g.harcamaSayisi > 0 && g.aktifHedefSayisi > 0 && g.birikimPayi <= g.tahminiBirikim && g.hedefYukOrani <= HEDEF_YUK_SINIRI,
    sonuc: g => ({
      oneri: {
        seviye: 'tebrik', baslik: 'Hedeflerin yolunda',
        mesaj: `Bu tempoyla kumbaran için ${g.donemMetni} ayrılan ${para(g.birikimPayi)} yerinde kalacak. Dönem bitince bu para kendiliğinden kumbarana aktarılır.`,
        neden: `Tahmini dönem sonu artığı ${para(g.tahminiBirikim)} ≥ kumbaranın bu döneme düşen payı ${para(g.birikimPayi)}.`
      }
    })
  },
  {
    id: 'K13', ad: 'Acil durum fonu',
    eger: 'acil durum fonu hedefi yok VE bütçe açığı yok',
    ise: 'profile göre acil durum fonu tutarı öner',
    kaynak: 'Kişisel finans önerisi: 3–6 aylık zorunlu gider kadar acil durum fonu (öğrenciler için 1 ay ile başlanabilir).',
    sade: g => ({
      baslik: 'Kenarda biraz para olsun',
      mesaj: `Telefonun bozulursa ya da beklenmedik bir şey olursa diye kenarda biraz para olması iyidir. Senin için yaklaşık <b>${para(g.acilFonHedefi)}</b> yeter. Kumbara'da "Acil durum fonu" işaretli bir hedef ekleyebilirsin.`
    }),
    kosul: g => g.gelir > 0 && !g.acilFonVar && !g.butceAcigi && g.zorunluAylik > 0,
    sonuc: g => ({
      oneri: {
        seviye: 'oneri', baslik: 'Acil durum fonu oluştur',
        mesaj: `Bozulan telefon, sağlık gideri gibi beklenmedik durumlar için bir <b>acil durum fonu</b> oluştur. ${g.profilAdi} profili için öneri: ${g.esik.acilDurumAy} aylık zorunlu gider, yani yaklaşık <b>${para(g.acilFonHedefi)}</b>. Kumbara'da "Acil durum fonu" işaretli bir hedef ekleyebilirsin.`,
        neden: `Aylık zorunlu gider ≈ sabit giderler ${para(g.sabitToplam)} + ulaşım ${para(g.ulasimAylik)} + ihtiyaç harcamalarının aylık tahmini ${para(g.zorunluAylik - g.sabitToplam - g.ulasimAylik)} = ${para(g.zorunluAylik)}. × ${g.esik.acilDurumAy} ay = ${para(g.acilFonHedefi)}.`
      }
    })
  },
  {
    id: 'K14', ad: 'Düşük birikim oranı',
    eger: 'bütçe riski ve hedef riski yok VE tahmini birikim ÷ dönem geliri < profilin birikim hedefi',
    ise: '"önce kendine öde" yöntemini öner',
    kaynak: '"Önce kendine öde" ilkesi (G. S. Clason, "Babil\'in En Zengin Adamı").',
    sade: g => ({
      baslik: 'Biraz daha biriktirebilirsin',
      mesaj: `Bu gidişle sona çok az para kalacak. Şunu dene: ${g.gelirAdi} gelince önce <b>${para(g.donemGeliri * g.esik.birikimOrani)}</b> kumbarana ayır, sonra kalanı harca.`
    }),
    kosul: g => g.donemGeliri > 0 && g.harcamaSayisi > 0 && !g.butceAcigi && !g.butceRiski && !g.hedefRiski && g.tahminiBirikim >= 0 && g.birikimOrani < g.esik.birikimOrani,
    sonuc: g => ({
      oneri: {
        seviye: 'oneri', baslik: 'Birikim oranını artır',
        mesaj: `Bu tempoyla dönem sonunda gelirinin yalnızca ${yuzde(g.birikimOrani)} kadarı artacak (hedef: en az ${yuzde(g.esik.birikimOrani)}). <b>"Önce kendine öde"</b> yöntemini dene: ${g.gelirAdi} geldiği gün ${para(g.donemGeliri * g.esik.birikimOrani)} tutarını kumbarana ayır, kalanla yaşa.`,
        neden: `Tahmini birikim ${para(g.tahminiBirikim)} ÷ dönem geliri ${para(g.donemGeliri)} = ${yuzde(g.birikimOrani)} < ${yuzde(g.esik.birikimOrani)}.`
      }
    })
  },
  {
    id: 'K15', ad: 'Genel durum iyi',
    eger: 'bütçe açığı, bütçe riski, hedef riski, yüksek istek ve yüksek sabit gider gerçeklerinin hiçbiri yok VE bugünkü limit aşılmamış',
    ise: 'kullanıcıyı tebrik et ve tahmini birikimi göster',
    kaynak: 'Olumlu pekiştirme.',
    sade: g => ({
      mesaj: `Paranı çok iyi idare ediyorsun. Böyle devam edersen sonunda yaklaşık <b>${para(Math.max(0, g.tahminiBirikim))}</b> artacak.`
    }),
    kosul: g => g.gelir > 0 && g.harcamaSayisi > 0 && !g.butceAcigi && !g.butceRiski && !g.hedefRiski && !g.istekYuksek && !g.sabitYuksek
      && g.bugunHarcanan <= g.gunlukLimit,
    sonuc: g => ({
      oneri: {
        seviye: 'tebrik', baslik: 'Harika gidiyorsun!',
        mesaj: `Harcamaların bütçenle uyumlu. Bu tempoyla dönem sonunda yaklaşık <b>${para(Math.max(0, g.tahminiBirikim))}</b> artırabilirsin.`,
        neden: 'K02 (bütçe açığı), K03 (sabit gider), K04 (bütçe riski) ve K05 (istek harcaması) kurallarının hiçbiri tetiklenmedi.'
      }
    })
  },
  {
    id: 'K16', ad: 'Veri girişi hatırlatması',
    eger: 'gelir girilmiş VE bu dönem hiç harcama kaydı yok VE uygulama en az 2 gündür kullanılıyor',
    ise: 'harcama girmeye başlamayı öner',
    kaynak: 'Harcama takibi, finansal farkındalığın ilk adımıdır.',
    sade: g => ({
      baslik: 'Harcamalarını yazmaya başla',
      mesaj: `${buyukHarf(g.donemMetni)} hiç harcama yazmadın. Bir simit bile olsa her harcamayı yazarsan sana daha iyi yardım edebilirim.`
    }),
    kosul: g => g.gelir > 0 && g.harcamaSayisi === 0 && g.kayitGun >= 2,
    sonuc: g => ({
      oneri: {
        seviye: 'oneri', baslik: 'Harcamalarını kaydetmeye başla',
        mesaj: `${buyukHarf(g.donemMetni)} henüz harcama girmedin. Ne kadar küçük olursa olsun her harcamayı kaydedersen sana daha isabetli öneriler verebilirim.`,
        neden: 'Bu dönemki harcama kaydı sayısı: 0. Tahmin kuralları (K04, K07, K08) veri olmadan çalışamaz.'
      }
    })
  },
  {
    id: 'K17', ad: 'Günlük limit aşımı',
    eger: 'bugün harcanan > bugünkü dinamik limit',
    ise: 'uyar ve aşımın yarınki limite etkisini göster; belleğe "günlük aşım" ekle',
    kaynak: 'Dinamik bütçeleme: aşılan tutar dönemin kalan günlerine paylaştırılır.',
    sade: g => ({
      baslik: 'Bugün biraz fazla harcadın',
      mesaj: `Bugün <b>${para(g.bugunHarcanan - g.gunlukLimit)}</b> fazla harcadın. Dert etme, bu farkı sonraki günlere paylaştırdım: `
        + (g.yarinLimit === null ? `yarın yeni ${g.gelirAdi} geliyor, her şey baştan başlayacak.` : `yarın <b>${para(g.yarinLimit)}</b> harcayabilirsin.`)
    }),
    kosul: g => g.gelir > 0 && g.bugunHarcanan > 0 && g.bugunHarcanan > g.gunlukLimit,
    sonuc: g => ({
      gercek: { gunlukAsim: true },
      oneri: {
        seviye: 'uyari', baslik: 'Bugünkü limitini aştın',
        mesaj: `Bugün limitini <b>${para(g.bugunHarcanan - g.gunlukLimit)}</b> aştın. Bu fark dönemin kalan günlerine paylaştırılır: `
          + (g.yarinLimit === null ? `yarın yeni ${g.gelirAdi} ile bütçen sıfırdan başlayacak.` : `yarın için limitin <b>${para(g.yarinLimit)}</b> olacak.`),
        neden: `Bugünkü limit = (harcanabilir ${para(g.harcanabilirDonem)} − bugünden önceki harcamalar ${para(g.oncekiHarcanan)}) ÷ ${g.kalanGun} gün = ${para(g.gunlukLimit)}. Bugün harcanan ${para(g.bugunHarcanan)} bu limitten fazla.`
      }
    })
  },
  {
    id: 'K18', ad: 'Günlük limite yaklaşma',
    eger: 'bugün harcanan ≥ bugünkü limitin %80 kadarı VE limit henüz aşılmamış',
    ise: 'gün sonuna kadar kalan tutarı hatırlat',
    kaynak: 'Erken uyarı: sınıra yaklaşıldığını fark ettirmek aşımı önler.',
    sade: g => ({
      baslik: 'Bugünlük paran azaldı',
      mesaj: `Bugünkü paranın çoğunu kullandın. Akşama kadar en fazla <b>${para(g.bugunKalan)}</b> harcayabilirsin.`
    }),
    kosul: g => g.gunlukLimit > 0 && g.bugunHarcanan >= g.gunlukLimit * 0.8 && g.bugunHarcanan <= g.gunlukLimit,
    sonuc: g => ({
      oneri: {
        seviye: 'oneri', baslik: 'Günlük limitine yaklaştın',
        mesaj: `Bugünkü limitinin ${yuzde(g.bugunOran)} kadarını kullandın. Gün bitene kadar en fazla <b>${para(g.bugunKalan)}</b> harcayabilirsin.`,
        neden: `Bugün harcanan ${para(g.bugunHarcanan)} ÷ bugünkü limit ${para(g.gunlukLimit)} = ${yuzde(g.bugunOran)} ≥ %80.`
      }
    })
  },
  {
    id: 'K19', ad: 'Limit içinde kalma serisi',
    eger: 'son 3 veya daha fazla gün üst üste günlük limitin altında kalınmış',
    ise: 'kullanıcıyı tebrik et',
    kaynak: 'Alışkanlık oluşturma: küçük ve sürekli başarıların görünür kılınması.',
    sade: g => ({
      mesaj: `<b>${g.seri} gün</b> üst üste limitini aşmadın. Her gün artan para sonraki günlerine eklenir.`
    }),
    kosul: g => g.seri >= 3,
    sonuc: g => ({
      oneri: {
        seviye: 'tebrik', baslik: `${g.seri} gündür limit içindesin`,
        mesaj: `<b>${g.seri} gün</b> üst üste günlük limitinin altında kaldın. Her gün artan para, sonraki günlerin limitine eklenerek sana geri döner.`,
        neden: `Dünden geriye doğru her gün için o günkü limit hesaplandı; son ${g.seri} günün harcaması kendi limitinin altında.`
      }
    })
  },
  {
    id: 'K20', ad: 'Kumbara payı çok yüksek',
    eger: 'hedefler için ayrılan pay > kullanılabilir paranın %50 kadarı VE K44 tetiklenmedi',
    ise: 'hedef tarihlerini uzatmayı öner',
    kaynak: 'Gerçekçi hedef belirleme: ulaşılamayacak hedefler motivasyonu düşürür.',
    sade: g => ({
      baslik: 'Kumbara çok fazla para istiyor',
      mesaj: `Hedeflerin için ${g.donemMetni} ${para(g.birikimPayi)} ayırıyoruz, bu yüzden günlük paran az kalıyor. Hedefinin tarihini biraz ileri alırsan günlük paran artar.`
    }),
    // Hedef yükü K44'ün sınırını aşıyorsa uyarıyı daha ayrıntılı olan K44 verir
    kosul: g => g.gelir > 0 && g.aktifHedefSayisi > 0 && g.kullanilabilir > 0 && g.birikimPayi > g.kullanilabilir * 0.5 && g.hedefYukOrani <= HEDEF_YUK_SINIRI,
    sonuc: g => ({
      oneri: {
        seviye: 'uyari', baslik: 'Hedeflerin bütçeni zorluyor',
        mesaj: `Kumbaran için ${g.donemMetni} <b>${para(g.birikimPayi)}</b> ayrılıyor. Bu yüzden günlük limitin ${para(g.gunlukLimit)} kadar düşük. Hedef tarihlerini uzatır ya da birikim oranını düşürürsen günlük limitin rahatlar.`,
        neden: `Kumbara payı ${para(g.birikimPayi)} ÷ kullanılabilir para ${para(g.kullanilabilir)} = ${yuzde(g.birikimPayi / g.kullanilabilir)} > %50.`
      }
    })
  },

  // ---------- Takvim kuralları ----------
  {
    id: 'K21', ad: 'Hafta sonu kalkanı zayıfladı',
    eger: 'günlük harçlık düzeni VE harçlığın gelmediği günler önde VE o günlerin limiti normalin %75 kadarından az',
    ise: 'hafta sonu için cepte kalması gereken parayı hatırlat',
    kaynak: 'Nakit akışı planlaması: gelirin olmadığı günlerin harcaması önceden ayrılmalı.',
    sade: g => {
      const k = g.kalkan;
      return {
        baslik: 'Hafta sonuna para kalsın',
        mesaj: `${k.gunAdlari.join(' ve ')} harçlık gelmiyor. Bu hafta biraz fazla harcadığın için o günlere ${para(k.limit)} kaldı (normalde ${para(k.ideal)}). O günlere kadar cebinde en az <b>${para(k.ihtiyac)}</b> kalsın.`
      };
    },
    kosul: g => g.kalkan && g.kalkan.ideal > 0 && g.kalkan.oran < 0.75,
    sonuc: g => {
      const k = g.kalkan;
      const adlar = k.gunAdlari.join(' ve ');
      return {
        gercek: { kalkanZayif: true },
        oneri: {
          seviye: 'uyari', baslik: 'Hafta sonu için paran azalıyor',
          mesaj: `${adlar} harçlık gelmiyor. Bu hafta fazla harcadığın için o günlerdeki limitin <b>${para(k.limit)}</b> kadar düştü (normalde ${para(k.ideal)}). Harçlıksız günlere kadar cebinde en az <b>${para(k.ihtiyac)}</b> kalmalı.`,
          neden: `Harçlıksız günlerin limiti ${para(k.limit)} ÷ normal günlük limit ${para(k.ideal)} = ${yuzde(k.oran)} < %75. Normal limit = haftanın harcanabilir parası ${para(g.harcanabilirDonem)} ÷ ${g.donemUzunluk} gün.`
        }
      };
    }
  },
  {
    id: 'K22', ad: 'Dönemin son günü',
    eger: 'bugün dönemin son günü VE bugünkü limitten para artıyor',
    ise: 'artan parayı kumbaraya atmayı öner',
    kaynak: '"Önce kendine öde" ilkesi; artan parayı harcamadan biriktirmek.',
    sade: g => ({
      mesaj: `Bugün son gün ve bugünkü paranın <b>${para(g.bugunKalan)}</b> kadarı duruyor. Harcamazsan ${g.aktifHedefSayisi ? `<b>"${esc(g.aktifHedefler[0].ad)}"</b> hedefine` : 'kumbarana'} atabilirsin.`
    }),
    kosul: g => g.kalanGun === 1 && g.bugunKalan > 0 && !g.butceAcigi,
    sonuc: g => ({
      oneri: {
        seviye: 'oneri', baslik: `Yarın yeni ${g.gelirAdi} geliyor`,
        mesaj: `Bugün dönemin son günü. Bugünkü limitinden <b>${para(g.bugunKalan)}</b> kaldı. Harcamazsan bu parayı ${g.aktifHedefSayisi ? `<b>"${esc(g.aktifHedefler[0].ad)}"</b> hedefine` : 'kumbarana'} atabilirsin.`,
        neden: `Dönemde kalan gün sayısı 1. Bugünkü limit ${para(g.gunlukLimit)} − bugün harcanan ${para(g.bugunHarcanan)} = ${para(g.bugunKalan)}.`
      }
    })
  },
  {
    id: 'K23', ad: 'Planlı harcama yaklaşıyor',
    eger: 'bu dönem içinde önümüzdeki 3 gün içinde bekleyen bir plan var',
    ise: 'planın parasının önceden ayrıldığını açıkla',
    kaynak: 'Planlı harcama: bilinen giderin parasını önceden ayırmak sürprizleri önler.',
    sade: g => ({
      mesaj: `<b>${esc(g.yaklasanPlan.ad)}</b> için ${para(g.yaklasanPlan.tutar)} şimdiden kenara koydum. Bu yüzden günlük paran biraz daha az. O güne kadar limitine uyarsan para hazır olur.`
    }),
    kosul: g => g.yaklasanPlan && gunFarki(new Date(), tarihCoz(g.yaklasanPlan.tarih)) <= 3,
    sonuc: g => {
      const p = g.yaklasanPlan;
      return {
        oneri: {
          seviye: 'oneri', baslik: `${tarihGoster(p.tarih)}: ${esc(p.ad)}`,
          mesaj: `<b>${esc(p.ad)}</b> planın için ${para(p.tutar)} şimdiden ayrıldı. Bu yüzden günlük limitin bu dönem yaklaşık <b>${para(p.tutar / g.kalanGun)}</b> daha düşük. Plan gününe kadar limitine uyarsan para hazır olur.`,
          neden: `Planın tarihi (${uzunTarih(p.tarih)}) bu dönemin içinde. Planlı harcamalar, günlük limit hesaplanmadan önce dönemin bütçesinden düşülür: ${para(p.tutar)} ÷ ${g.kalanGun} kalan gün ≈ ${para(p.tutar / g.kalanGun)}/gün.`
        }
      };
    }
  },
  {
    id: 'K24', ad: 'Planlar bütçeyi aşıyor',
    eger: 'bu dönemki planlar yüzünden harcanabilir para sıfırın altına düşmüş',
    ise: 'planlardan birini ertelemeyi ya da küçültmeyi öner',
    kaynak: 'Bütçe kısıtı: planlanan harcamalar gelirden fazla olamaz.',
    sade: g => ({
      baslik: 'Planların paraya sığmıyor',
      mesaj: `Bu dönem için planladığın şeyler (${para(g.planPayi)}) paraya sığmıyor. Birini sonraya bırak ya da daha ucuzunu düşün.`
    }),
    kosul: g => g.planPayi > 0 && g.harcanabilirDonem < 0,
    sonuc: g => ({
      gercek: { planAsimi: true },
      oneri: {
        seviye: 'kritik', baslik: 'Planların bu dönemin bütçesini aşıyor',
        mesaj: `Bu dönem için planladığın harcamalar (${para(g.planPayi)}) bütçene sığmıyor. Bir planı sonraki döneme ertele ya da tutarını küçült; yoksa günlük limitin sıfırda kalır.`,
        neden: `Dönem geliri ${para(g.donemGeliri)} − sabit ${para(g.sabitPayi)} − ulaşım ${para(g.ulasimPayi)} − planlar ${para(g.planPayi)} − kumbara ${para(g.birikimPayi)} = ${para(g.harcanabilirDonem)} < 0.`
      }
    })
  },
  {
    id: 'K25', ad: 'İleride büyük bir plan var',
    eger: 'önümüzdeki 60 gün içinde, bir dönemin harcanabilir parasının yarısından büyük bir plan var',
    ise: 'şimdiden biriktirmek için kumbara hedefi öner',
    kaynak: 'Hedef belirleme ve parçalara bölme: büyük harcamayı küçük düzenli birikimlere çevirmek.',
    sade: g => {
      const p = g.buyukPlan;
      return {
        mesaj: `<b>${esc(p.ad)}</b> (${para(p.tutar)}) büyük bir harcama. Kumbarada bunun için şimdiden bir hedef açarsan her gün yalnızca <b>${para(p.tutar / Math.max(1, gunFarki(new Date(), tarihCoz(p.tarih))))}</b> ayırman yeter.`
      };
    },
    kosul: g => !!g.buyukPlan,
    sonuc: g => {
      const p = g.buyukPlan;
      const kalanGunP = Math.max(1, gunFarki(new Date(), tarihCoz(p.tarih)));
      return {
        oneri: {
          seviye: 'oneri', baslik: `${esc(p.ad)} için şimdiden biriktir`,
          mesaj: `${uzunTarih(p.tarih)} tarihli <b>${esc(p.ad)}</b> planın (${para(p.tutar)}) bir ${g.donemAdi}lık harcanabilir paranın yarısından büyük. Kumbarada bu plan için bir hedef oluşturursan günde yalnızca <b>${para(p.tutar / kalanGunP)}</b> ayırman yeter.`,
          neden: `Plan tutarı ${para(p.tutar)} > dönemlik harcanabilir paranın yarısı (${para(Math.max(0, g.harcanabilirDonem + g.planPayi) / 2)}). Plana ${kalanGunP} gün var: ${para(p.tutar)} ÷ ${kalanGunP} gün.`
        }
      };
    }
  },
  {
    id: 'K26', ad: 'Ulaşım payı serbest kaldı',
    eger: 'bu dönem tatil ya da "binmedim" nedeniyle ulaşım ücreti ödenmeyen gün var',
    ise: 'serbest kalan parayı göster ve kumbaraya atmayı öner',
    kaynak: 'Bütçe esnekliği: harcanmayan pay fark edilirse birikime dönüştürülebilir.',
    sade: g => ({
      mesaj: `${buyukHarf(g.donemMetni)} ${g.ulasimSerbestGun} gün yol parası vermedin. Bu yüzden <b>${para(g.ulasimSerbest)}</b> boşa çıktı ve günlük parana eklendi. İstersen kumbarana at.`
    }),
    kosul: g => g.ulasimSerbestGun > 0 && g.ulasimSerbest > 0,
    sonuc: g => ({
      oneri: {
        seviye: 'tebrik', baslik: 'Ulaşım parası serbest kaldı',
        mesaj: `${buyukHarf(g.donemMetni)} ${g.ulasimSerbestGun} gün ulaşım ücreti ödemedin (tatil ya da izin). <b>${para(g.ulasimSerbest)}</b> serbest kaldı ve günlük limitine eklendi. İstersen bu parayı kumbarana at.`,
        neden: `${g.ulasimSerbestGun} gün × günlük ulaşım ${para(g.ulasimGunluk)} = ${para(g.ulasimSerbest)}. Bu günler takvimde tatil ya da "ulaşım yok" olarak işaretli.`
      }
    })
  },
  {
    id: 'K27', ad: 'Ulaşım maliyeti yüksek',
    eger: 'binişte ödenen ulaşımın aylık tutarı ÷ aylık gelir > %20',
    ise: 'aylık abonman veya indirimli kart ile karşılaştırmayı öner',
    kaynak: 'Maliyet karşılaştırması: sık kullanılan hizmette toplu (abonman) alım genellikle daha ucuzdur.',
    sade: g => ({
      baslik: 'Yol parası çok tutuyor',
      mesaj: `Dolmuşa, otobüse ayda yaklaşık <b>${para(g.ulasimAylik)}</b> veriyorsun; eline geçen ${ondaKac(g.ulasimOrani)} yola gidiyor. Öğrenci kartı ya da aylık abonman daha ucuz olabilir, ailenle bir bak.`
    }),
    kosul: g => g.ulasimTipi === 'binis' && g.gelir > 0 && g.ulasimOrani > 0.2,
    sonuc: g => ({
      oneri: {
        seviye: 'oneri', baslik: 'Ulaşıma çok para gidiyor',
        mesaj: `Binişte ödediğin ulaşım ayda yaklaşık <b>${para(g.ulasimAylik)}</b>, gelirinin ${yuzde(g.ulasimOrani)} kadarı. Şehrinde öğrenci abonmanı ya da indirimli kart varsa fiyatını karşılaştır; ${para(g.ulasimAylik)} tutarından ucuzsa geçmek kazançlı olur.`,
        neden: `Günlük ulaşım ${para(g.ulasimGunluk)} × haftalık gün sayısı × 52 ÷ 12 = ${para(g.ulasimAylik)}/ay. ÷ aylık gelir ${para(g.gelir)} = ${yuzde(g.ulasimOrani)} > %20.`
      }
    })
  },
  {
    id: 'K28', ad: 'Geçen dönemden artan para',
    eger: 'yeni dönemin ilk 2 günü VE önceki dönemde harcanabilir paranın bir kısmı harcanmamış',
    ise: 'kullanıcıyı tebrik et ve artanı kumbaraya atmayı öner',
    kaynak: 'Olumlu pekiştirme ve "önce kendine öde" ilkesi.',
    sade: g => ({
      mesaj: `Geçen ${g.donemAdi} <b>${para(g.oncekiDonemArtan)}</b> harcamadan kaldı. Bu parayı kumbarana atarsan hedefine daha çabuk ulaşırsın.`
    }),
    kosul: g => g.donemGun <= 2 && g.oncekiDonemArtan >= 1,
    sonuc: g => ({
      oneri: {
        seviye: 'tebrik', baslik: `Geçen ${g.donemAdi} ${para(g.oncekiDonemArtan)} artırdın`,
        mesaj: `Geçen ${g.donemAdi} kumbara payının dışında <b>${para(g.oncekiDonemArtan)}</b> harcamadan kaldı. Bu parayı kumbarana atarsan hedeflerine daha hızlı ulaşırsın.`,
        neden: `Önceki dönemin harcanabilir parası − o dönemde harcanan = ${para(g.oncekiDonemArtan)}.`
      }
    })
  },
  {
    id: 'K29', ad: 'Plan kaydı unutuldu',
    eger: 'son 7 gün içinde tarihi geçmiş ama harcaması kaydedilmemiş bir plan var',
    ise: 'planı takvimden işaretlemeyi hatırlat',
    kaynak: 'Veri doğruluğu: eksik kayıt, limit hesabını yanıltır.',
    sade: g => ({
      mesaj: `${tarihGoster(g.unutulanPlan.tarih)} için <b>${esc(g.unutulanPlan.ad)}</b> planlamıştın. Aldıysan <b>Takvim</b>'den "Harcadım" de, almadıysan planı sil.`
    }),
    kosul: g => !!g.unutulanPlan,
    sonuc: g => ({
      oneri: {
        seviye: 'oneri', baslik: `"${esc(g.unutulanPlan.ad)}" gerçekleşti mi?`,
        mesaj: `${tarihGoster(g.unutulanPlan.tarih)} için planladığın <b>${esc(g.unutulanPlan.ad)}</b> (${para(g.unutulanPlan.tutar)}) için harcama kaydı yok. Harcadıysan <b>Takvim</b>'den "Harcadım" de; vazgeçtiysen planı sil.`,
        neden: 'Tarihi geçen ve harcaması girilmeyen planların parası artık ayrılmıyor; harcadıysan limitin olduğundan yüksek görünür.'
      }
    })
  },
  {
    id: 'K30', ad: 'Nakit sınırı',
    eger: 'bugünkü limit formülü, şu ana kadar eline geçen paradan fazlasını gösteriyor',
    ise: 'limiti cepteki parayla sınırla ve nedenini açıkla',
    kaynak: 'Nakit akışı: henüz gelmemiş para harcanamaz.',
    sade: g => ({
      baslik: 'Cebindeki kadar harcayabilirsin',
      mesaj: `Paranın hepsi henüz eline geçmedi. Bu yüzden bugün en fazla <b>${para(g.gunlukLimit)}</b> harcayabilirsin.${g.sonrakiGelirTarihi ? ` ${buyukHarf(tarihGoster(tarihStr(g.sonrakiGelirTarihi)))} ${g.gelirAdi} gelince artar.` : ''}`
    }),
    kosul: g => g.nakitSinirli,
    sonuc: g => ({
      oneri: {
        seviye: 'oneri', baslik: 'Limitin cebindeki parayla sınırlı',
        mesaj: `Hesaba göre bugün ${para(g.formulLimit)} harcayabilirdin, ama bu döneme ait paranın hepsi henüz eline geçmedi. Cebindeki para yüzünden bugünkü limitin <b>${para(g.gunlukLimit)}</b>.${g.sonrakiGelirTarihi ? ` ${buyukHarf(tarihGoster(tarihStr(g.sonrakiGelirTarihi)))} ${g.gelirAdi} gelince limitin rahatlar.` : ''}`,
        neden: `Formül limit ${para(g.formulLimit)} > eldeki para ${para(g.cep)} (bu dönem eline geçen − harcanan − ulaşım). Günlük limit, ikisinin küçüğü olarak alınır.`
      }
    })
  },
  {
    id: 'K31', ad: 'Bekleme süresi doldu',
    eger: `bekleme listesindeki bir ürünün ${BEKLEME_GUN} günlük bekleme süresi dolmuş`,
    ise: 'kullanıcıya hâlâ isteyip istemediğini sor',
    kaynak: 'Dürtüsel satın almayı erteleme ("30 gün kuralı"); bekleyince isteğin çoğu zaman azaldığı görülür.',
    sade: g => {
      const x = g.kararZamani[0];
      return {
        mesaj: `${BEKLEME_GUN} gün önce <b>${esc(x.ad)}</b> almak istiyordun. Hâlâ istiyor musun? Vazgeçersen bu para cebinde kalır.`
      };
    },
    kosul: g => g.kararZamani.length > 0,
    sonuc: g => {
      const x = g.kararZamani[0];
      return {
        oneri: {
          seviye: 'oneri', baslik: `“${esc(x.ad)}” için karar zamanı`,
          mesaj: `${BEKLEME_GUN} gün önce <b>${esc(x.ad)}</b> (${para(x.tutar)}) almayı düşünüyordun. Hâlâ istiyor musun? Vazgeçersen bu para kurtarılan paraya eklenir.${g.kararZamani.length > 1 ? ` Karar bekleyen ${g.kararZamani.length} ürün var.` : ''}`,
          neden: `Ürün ${uzunTarih(x.eklenme)} tarihinde bekleme listesine eklendi; ${x.gecen} gün geçti (bekleme süresi ${BEKLEME_GUN} gün).`
        }
      };
    }
  },
  {
    id: 'K32', ad: 'Vazgeçerek biriktirme',
    eger: 'bu dönem "Alsam mı?" ile en az bir üründen vazgeçilmiş',
    ise: 'kullanıcıyı tebrik et ve kurtarılan parayı kumbaraya atmayı öner',
    kaynak: 'Olumlu pekiştirme; vazgeçilen harcamanın birikime dönüştürülmesi.',
    sade: g => ({
      mesaj: `${buyukHarf(g.donemMetni)} ${g.donemVazgecme} şeyi almaktan vazgeçtin. Bu parayı ${g.aktifHedefSayisi ? `<b>“${esc(g.aktifHedefler[0].ad)}”</b> hedefine` : 'kumbarana'} atarsan birikime dönüşür.`
    }),
    kosul: g => g.donemVazgecme > 0,
    sonuc: g => ({
      oneri: {
        seviye: 'tebrik', baslik: `Vazgeçerek ${para(g.donemKurtarilan)} kurtardın`,
        mesaj: `${buyukHarf(g.donemMetni)} ${g.donemVazgecme} şeyi almaktan vazgeçtin. Bu para hâlâ bütçende; ${g.aktifHedefSayisi ? `<b>“${esc(g.aktifHedefler[0].ad)}”</b> hedefine atarsan` : 'kumbarana atarsan'} birikime dönüşür.`,
        neden: `Bu dönem vazgeçilen ürünlerin toplamı ${para(g.donemKurtarilan)}. Toplamda ${g.vazgecmeSayisi} kez vazgeçip ${para(g.kurtarilanToplam)} kurtardın.`
      }
    })
  },
  {
    id: 'K33', ad: 'Beklenmedik gelir',
    eger: 'son 7 günde bir kerelik bir gelir (bayram harçlığı, ikramiye…) gelmiş VE tutarı küçük harcama sınırından büyük',
    ise: 'gelenin bir kısmını harcamadan kumbaraya ayırmayı öner',
    kaynak: 'Zihinsel muhasebe: beklenmedik gelen para, düzenli gelire göre daha kolay harcanır (Arkes vd., 1994; Thaler, 1999).',
    sade: g => ({
      baslik: 'Fazladan para geldi!',
      mesaj: `<b>${esc(g.yeniTekGelir.ad)}</b> ile ${para(g.yeniTekGelir.tutar)} geldi. Hepsini hemen harcama; yarısını (${para(g.yeniTekGelir.tutar / 2)}) ${g.aktifHedefSayisi ? `<b>“${esc(g.aktifHedefler[0].ad)}”</b> hedefine` : 'kumbarana'} atarsan çok işine yarar.`
    }),
    kosul: g => !!g.yeniTekGelir,
    sonuc: g => {
      const x = g.yeniTekGelir;
      return {
        gercek: { beklenmedikGelir: true },
        oneri: {
          seviye: 'oneri', baslik: `${para(x.tutar)} fazladan geldi`,
          mesaj: `${tarihGoster(x.tarih)} gelen <b>${esc(x.ad)}</b> geldiği ${g.donemAdi === 'ay' ? 'ayın' : 'haftanın'} bütçesine eklendi ve limitini yükseltti. Bir kısmını, örneğin yarısını (${para(x.tutar / 2)}), ${g.aktifHedefSayisi ? `<b>“${esc(g.aktifHedefler[0].ad)}”</b> hedefine` : 'kumbarana'} şimdiden atarsan bu para birikime dönüşür.`,
          neden: `Bir kerelik gelir: ${esc(x.ad)}, ${para(x.tutar)} (${uzunTarih(x.tarih)}). Küçük harcama sınırı ${para(g.esik.kucukHarcama)}; tutar bundan büyük ve son 7 gün içinde geldi.`
        }
      };
    }
  },
  {
    id: 'K34', ad: 'Tarihi belli olmayan gelir',
    eger: 'tarihi her ay değişen bir gelirin (burs gibi) beklenen aralığındayız VE henüz "yattı" denmemiş',
    ise: 'paranın en geç güne göre planlandığını açıkla ve yatınca işaretlemeyi hatırlat',
    kaynak: 'Temkinlilik (ihtiyat) ilkesi: belirsiz gelir, gerçekleşene kadar en geç tarihe göre planlanır.',
    sade: g => ({
      baslik: `${buyukHarf(g.bekleyenGelirler[0].ad)} yakında gelecek`,
      mesaj: `${buyukHarf(g.bekleyenGelirler[0].ad)} birkaç gün içinde gelecek. Gelince Bugün ekranındaki <b>Yattı</b> düğmesine dokun.`
    }),
    kosul: g => g.bekleyenGelirler.length > 0,
    sonuc: g => {
      const x = g.bekleyenGelirler[0];
      const ana = x.kaynak === 'ana';
      return {
        oneri: {
          seviye: 'oneri', baslik: `${buyukHarf(x.ad)} bu günlerde yatacak`,
          mesaj: `Ne zaman yatacağı belli olmadığı için en geç <b>${uzunTarih(x.son)}</b> gününe göre planladım; ${ana ? 'o güne kadar elindeki para yetsin diye limitin buna göre hesaplandı' : 'o gün gelmiş saydım'}. Yatınca Bugün ekranından <b>Yattı</b> de, ${ana ? 'yeni dönemin o gün başlasın' : 'limitin hemen güncellensin'}.`,
          neden: `${buyukHarf(x.ad)} her ay ${tarihCoz(x.ilk).getDate()}. ile ${tarihCoz(x.son).getDate()}. günleri arasında yatıyor (${para(x.tutar)}). Bugün bu aralıkta ve henüz yattı denmedi.${g.bekleyenGelirler.length > 1 ? ` Bekleyen ${g.bekleyenGelirler.length} gelir var.` : ''}`
        }
      };
    }
  },
  {
    id: 'K35', ad: 'Borç ödeme günü yaklaşıyor',
    eger: 'kart ödemesinin ya da birine olan borcun son günü 3 gün içinde VE henüz ödenmedi',
    ise: 'tutarı ve günü hatırlat; cepteki para yetmiyorsa uyar',
    kaynak: 'Ödemeyi son güne bırakmamak gecikme faizini ve gecikme kaydını önler.',
    sade: g => {
      const x = g.yaklasanOdemeler[0];
      return { mesaj: `${x.kalanGun === 0 ? 'Bugün' : x.kalanGun + ' gün sonra'} <b>${esc(borcAdi(x.b))}</b> için ${para(x.tutar)} ödemen gerekiyor. Bu parayı harcama.` };
    },
    kosul: g => g.yaklasanOdemeler.length > 0,
    sonuc: g => {
      const x = g.yaklasanOdemeler[0];
      const yetmiyor = g.cep < x.tutar;
      return {
        gercek: { odemeYaklasiyor: true },
        oneri: {
          seviye: yetmiyor ? 'kritik' : 'uyari', baslik: `${esc(borcAdi(x.b))}: ${x.kalanGun === 0 ? 'son gün bugün' : `son ödemeye ${x.kalanGun} gün`}`,
          mesaj: `${uzunTarih(x.tarih)} gününe kadar <b>${para(x.tutar)}</b> ödemen gerekiyor.${yetmiyor ? ` Şu an cebinde olması gereken para (${para(Math.max(0, g.cep))}) bu ödemeye yetmiyor; bugünden harcamalarını kıs.` : ' Bu para bütçenden ayrıldı; ödeyince "Ödedim" de.'}`,
          neden: `Son ödeme günü ${uzunTarih(x.tarih)} (${x.kalanGun} gün kaldı). Tutar ${para(x.tutar)}, eldeki para ${para(g.cep)}.${g.yaklasanOdemeler.length > 1 ? ` Yaklaşan ${g.yaklasanOdemeler.length} ödeme var.` : ''}`
        }
      };
    }
  },
  {
    id: 'K36', ad: 'Asgari ödeme tuzağı',
    eger: 'kredi kartı borcunun tamamı değil, asgarisi ya da bir kısmı ödenecek VE faiz oranı biliniyor',
    ise: 'hep asgari ödenirse borcun kaç ayda biteceğini ve ne kadar faiz ödeneceğini göster',
    kaynak: 'Bileşik faiz; asgari ödeme yalnızca gecikmeyi önler, kalan borca faiz işler (kredi kartı ekstre bilgilendirmeleri).',
    sade: g => {
      const k = g.kartTuzak;
      return { baslik: 'Kart borcunu tamamen öde', mesaj: `Hep en az parayı ödersen bu borç ${sureMetni(k.asgari.ay)} sürer ve fazladan <b>${para(k.asgari.faiz)}</b> ödersin. Tamamını ödersen hiç fazla ödemezsin.` };
    },
    kosul: g => !!g.kartTuzak && g.kartTuzak.asgari.faiz >= 1,
    sonuc: g => {
      const k = g.kartTuzak;
      return {
        gercek: { asgariTuzagi: true },
        oneri: {
          seviye: 'uyari', baslik: `Asgari ödeme ${para(k.asgari.faiz)} faize mal olur`,
          mesaj: `<b>${esc(borcAdi(k.b))}</b> borcun ${para(k.b.borc)}. Her ay yalnızca asgariyi ödersen ${k.asgari.bitmez ? 'borç neredeyse hiç bitmez' : `borç <b>${sureMetni(k.asgari.ay)}</b> sürer`} ve yaklaşık <b>${para(k.asgari.faiz)}</b> faiz ödersin.${k.b.odeme === 'ozel' && !k.plan.bitmez ? ` Planladığın gibi her ay ${para(k.planli)} ödersen ${sureMetni(k.plan.ay)} sürer, faiz ${para(k.plan.faiz)} olur.` : ''} Tamamını ödersen faiz yok.`,
          neden: `Aylık faiz %${String(k.b.faiz).replace('.', ',')}, asgari oran %${k.b.asgari || 20}. Her ay ödemeden sonra kalan borca faiz eklenerek hesaplandı (yeni harcama yok, vergiler hariç).`
        }
      };
    }
  },
  {
    id: 'K37', ad: 'Geciken borç ödemesi',
    eger: 'kart borcunun son ödeme günü geçti ve ödeme kaydı yok YA DA birine olan borcun vadesi geçti',
    ise: 'kritik uyarı ver: hemen ödemeyi ya da ödediysen işaretlemeyi iste',
    kaynak: 'Geciken kart ödemesine gecikme faizi işler ve gecikme kaydı kredi notunu düşürebilir.',
    sade: g => {
      const x = g.gecikenOdemeler[0];
      return { mesaj: `<b>${esc(borcAdi(x.b))}</b> için ${para(x.tutar)} ödemen gerekiyordu, günü geçti. Ödediysen "Ödedim" de, ödemediysen bir büyüğünle konuş.` };
    },
    kosul: g => g.gecikenOdemeler.length > 0,
    sonuc: g => {
      const x = g.gecikenOdemeler[0];
      const kart = x.b.tur === 'kart';
      return {
        gercek: { gecikenOdeme: true },
        oneri: {
          seviye: 'kritik', baslik: `${esc(borcAdi(x.b))} ödemesi gecikti`,
          mesaj: kart
            ? `Son ödeme günü ${uzunTarih(x.tarih)} geçti ve ödeme kaydı yok. En az asgariyi (${para(kartAsgari(x.b))}) hemen öde; gecikme faizi ve kredi notuna işlenen gecikme kaydı daha pahalıya gelir. Ödediysen <b>Ödedim</b> de.`
            : `${uzunTarih(x.tarih)} için söz verdiğin ${para(x.tutar)} borcun vadesi geçti. Ödediysen kaydı kapat; ödeyemiyorsan ${esc(x.b.kisi)} ile konuşup yeni bir tarih belirle.`,
          neden: `Vade ${uzunTarih(x.tarih)}, bugün ${uzunTarih(tarihStr(new Date()))}; ödeme kaydı yok.${g.gecikenOdemeler.length > 1 ? ` Geciken ${g.gecikenOdemeler.length} ödeme var.` : ''}`
        }
      };
    }
  },
  {
    id: 'K38', ad: 'Borç ödeme yükü',
    eger: 'aylık borç ödemeleri (kart + taksit) / aylık gelir > profil sınırı (%10)',
    ise: 'yeni taksit ve kart harcamasından kaçınmayı öner',
    kaynak: '20/10 kuralı: tüketici borcu ödemeleri aylık net gelirin %10\'unu geçmemeli.',
    sade: g => ({ baslik: 'Borç ödemelerin çok', mesaj: `Paranın ${ondaKac(g.borcOrani)} borç ödemesine gidiyor. Borçların bitene kadar yeni taksitli şey alma.` }),
    kosul: g => g.gelir > 0 && g.borcOrani > g.esik.borcOrani,
    sonuc: g => ({
      gercek: { borcYukuYuksek: true },
      oneri: {
        seviye: 'uyari', baslik: 'Gelirinin büyük kısmı borca gidiyor',
        mesaj: `Bu ay borç ödemelerin <b>${para(g.borcAylik)}</b>, gelirinin ${yuzde(g.borcOrani)} kadarı. Borçların azalana kadar yeni taksit ve kartla alışverişten kaçın; ${g.kartTuzak ? 'önce faizi işleyen kart borcunu kapat.' : 'ödemeler bitince bu para birikimine kalır.'}`,
        neden: `Aylık borç ödemesi ${para(g.borcAylik)} ÷ aylık gelir ${para(g.gelir)} = ${yuzde(g.borcOrani)} > sınır ${yuzde(g.esik.borcOrani)}.`
      }
    })
  },
  {
    id: 'K39', ad: 'KYK kredisi yattı',
    eger: 'KYK öğrenim kredisi son 2 gün içinde yattı',
    ise: 'bu paranın geri ödenecek bir borç olduğunu ve toplamını hatırlat',
    kaynak: 'Finansal okuryazarlık: kredi, burstan farklı olarak geri ödenir; toplam borcu bilmek planlamayı kolaylaştırır.',
    kosul: g => !!g.kykYatti,
    sonuc: g => {
      const x = g.kykYatti;
      return {
        oneri: {
          seviye: 'oneri', baslik: `KYK kredin yattı: toplam ${para(x.toplam)}`,
          mesaj: `${para(x.b.aylik)} kredin bütçene eklendi. Bu para burs değil, mezuniyetten sonra geri ödeyeceğin bir borç; şu ana kadar toplam <b>${para(x.toplam)}</b> oldu.${x.mezuniyette !== null ? ` Böyle devam edersen ${x.b.mezuniyet} mezuniyetinde yaklaşık <b>${para(x.mezuniyette)}</b> olacak.` : ''} İhtiyacından fazlasını harcamamaya çalış.`,
          neden: `Kredi ${uzunTarih(x.tarih)} tarihinde yattı. Toplam = eklerken girilen ${para(x.b.alinan || 0)} + sonraki yatışlar.`
        }
      };
    }
  },
  {
    id: 'K40', ad: 'Vadesi geçen alacak',
    eger: 'birine verdiğin borcun vadesi geçti VE geri alındı denmedi',
    ise: 'kibarca hatırlatmayı ve geri alınca işaretlemeyi öner',
    kaynak: 'Kişiler arası borçlarda açık iletişim ve kayıt tutma.',
    sade: g => {
      const x = g.gecikenAlacaklar[0];
      return { mesaj: `<b>${esc(x.b.kisi)}</b> sana ${para(x.tutar)} geri verecekti, günü geçti. Kibarca hatırlatabilirsin.` };
    },
    kosul: g => g.gecikenAlacaklar.length > 0,
    sonuc: g => {
      const x = g.gecikenAlacaklar[0];
      return {
        oneri: {
          seviye: 'oneri', baslik: `${esc(x.b.kisi)} borcunu geri vermedi`,
          mesaj: `${uzunTarih(x.tarih)} için ${para(x.tutar)} geri alacaktın. Kibarca hatırlatabilirsin; geri alınca <b>Borçların</b> ekranından "Geri aldım" de, para bütçene eklensin.`,
          neden: `Vade ${uzunTarih(x.tarih)} geçti ve geri alındı kaydı yok.`
        }
      };
    }
  },
  {
    id: 'K41', ad: 'Olası çift kayıt',
    eger: 'son 7 günde aynı gün, aynı tutarda (harcamada aynı kategori ve notla) birden fazla kayıt var',
    ise: 'kaydın yanlışlıkla iki kez girilmiş olabileceğini sor',
    kaynak: 'Veri doğruluğu: çift kayıt harcamayı olduğundan fazla (gelirde fazla) gösterir ve limiti yanıltır.',
    sade: g => {
      const x = g.ciftKayit;
      return { baslik: 'İki kez mi yazdın?', mesaj: `${tarihGoster(x.tarih)} <b>${esc(x.ad)}</b> için ${para(x.tutar)} ${x.adet} kez yazılmış. Yanlışlıkla iki kez yazdıysan birini sil.` };
    },
    kosul: g => !!g.ciftKayit,
    sonuc: g => {
      const x = g.ciftKayit;
      return {
        oneri: {
          seviye: 'oneri', baslik: `Aynı ${x.gelir ? 'geliri' : 'harcamayı'} iki kez mi girdin?`,
          mesaj: `${tarihGoster(x.tarih)} <b>${esc(x.ad)}</b> için ${para(x.tutar)} tutarında ${x.adet} kayıt var. Yanlışlıkla iki kez eklediysen birini ${x.gelir ? '<b>Gelirlerin</b>' : '<b>Geçmiş</b>'} ekranından sil; gerçekten ayrı ${x.gelir ? 'gelirlerse' : 'harcamalarsa'} kayda dokunup <b>Ayrı kayıtlar</b> de.`,
          neden: `Aynı gün (${uzunTarih(x.tarih)}), aynı tutar (${para(x.tutar)})${x.gelir ? '' : ', aynı kategori ve not'}: ${x.adet} kayıt. Kayıtlar birebir aynı olduğu için karışmış olabilir.`
        }
      };
    }
  },
  {
    id: 'K42', ad: 'Ekstrede faiz ve ücret',
    eger: 'son 30 günde yüklenen kart ekstresinde faiz, KKDF, BSMV ya da kart ücreti satırı var',
    ise: 'bu paranın karşılıksız ödendiğini göster, borcun tamamını zamanında ödemeyi öner',
    kaynak: 'Kredi kartında dönem borcu son ödeme tarihine kadar tamamen ödenirse alışverişlere faiz işlemez; faize vergiler (KKDF, BSMV) eklenir.',
    sade: g => {
      const x = g.ekstreFaiz;
      return { baslik: 'Karta fazladan para ödedin', mesaj: `Kart ekstrende <b>${kurusluPara(x.faiz)}</b> faiz ve ücret var. Bu parayla hiçbir şey almadın. Borcu her ay tamamen ödersen bu olmaz.` };
    },
    kosul: g => !!g.ekstreFaiz,
    sonuc: g => {
      const x = g.ekstreFaiz;
      return {
        gercek: { ekstreFaizi: true },
        oneri: {
          seviye: 'uyari', baslik: `Kartına ${kurusluPara(x.faiz)} faiz ve ücret yansıdı`,
          mesaj: `<b>${esc(borcAdi(x.b))}</b> ekstrende ${x.faizSatir} satır faiz, vergi ya da ücret var. Bu para hiçbir şey almadan bankaya ödeniyor. Dönem borcunun tamamını son ödeme gününe kadar ödersen alışverişlerine faiz işlemez${g.kartTuzak ? '; yalnızca asgariyi ödemek bu tutarı her ay büyütür' : ''}.`,
          neden: `Ekstre ${uzunTarih(x.yuklendi)} yüklendi. Faiz, KKDF, BSMV ve kart ücreti satırlarının toplamı: ${kurusluPara(x.faiz)}.`
        }
      };
    }
  },
  {
    id: 'K43', ad: 'Kaydedilmemiş kart harcamaları',
    eger: 'son 7 günde yüklenen ekstredeki harcamaların en az %20\'si (en az 2 işlem) kayıtlı harcamalarla eşleşmedi',
    ise: 'kayıt alışkanlığı için uyar: kart harcamasını hemen eklemeyi öner',
    kaynak: 'Harcama takibi: kartla ödeme "acıtmadığı" için nakitten daha kolay unutulur ve fazla harcatır (Prelec ve Simester 2001, kredi kartı etkisi).',
    sade: g => {
      const x = g.ekstreEksik;
      return { baslik: 'Kartla harcadıklarını yaz', mesaj: `Kartla yaptığın ${x.eksikSayi} harcamayı yazmayı unutmuşsun. Harcayınca hemen yazarsan limitin doğru olur.` };
    },
    kosul: g => !!g.ekstreEksik,
    sonuc: g => {
      const x = g.ekstreEksik;
      return {
        gercek: { kartKaydiEksik: true },
        oneri: {
          seviye: 'oneri', baslik: `${x.eksikSayi} kart harcamasını kaydetmemişsin`,
          mesaj: `Son ekstrende kaydetmediğin <b>${x.eksikSayi} harcama (${kurusluPara(x.eksikToplam)})</b> çıktı; kart harcamalarının ${yuzde(x.eksikSayi / x.harcamaSayisi)} kadarı. Kayıt eksik olunca günlük limitin olduğundan fazla görünür. Kartla ödeyince hemen ekle; sesle eklemek birkaç saniye sürer.`,
          neden: `Ekstredeki ${x.harcamaSayisi} harcamanın ${x.eksikSayi} tanesi kayıtlarla eşleşmedi (aynı tutar, en çok 3 gün fark). Sınır: %20.`
        }
      };
    }
  },
  {
    id: 'K44', ad: 'Sürdürülebilir hedef payı',
    eger: "kumbara hedeflerine ayrılan günlük pay > günlük harçlık payının %40'ı",
    ise: 'hedeflerin sürdürülebilir olmadığını bildir; en ağır hedefin süresini ne kadar uzatmak gerektiğini hesapla',
    kaynak: "Sürdürülebilir birikim: 50/30/20 kuralında birikime gelirin yaklaşık %20'si ayrılır; günlük paranın çok büyük kısmını kesen plan kısa sürede bırakılır.",
    sade: g => {
      const o = hedefUzatma(g);
      return {
        baslik: 'Kumbaran harçlığının çoğunu alıyor',
        mesaj: `Her gün eline geçen ${ondaKac(g.hedefYukOrani)} kumbaraya gidiyor, harcamaya çok az kalıyor. Bu kadar sıkı bir plana uzun süre dayanmak zor.${o
          ? ` <b>"${esc(o.h.ad)}"</b> hedefinin tarihini <b>${o.ekAy} ay</b> ileri alırsan rahatlarsın.` : ' Hedeflerinin tarihini biraz ileri al.'}`
      };
    },
    kosul: g => g.gelir > 0 && g.aktifHedefSayisi > 0 && g.hedefYukOrani > HEDEF_YUK_SINIRI,
    sonuc: g => {
      const o = hedefUzatma(g);
      return {
        gercek: { hedefYukuAgir: true },
        oneri: {
          seviye: 'uyari', baslik: 'Hedeflerin sürdürülebilir değil',
          mesaj: `Kumbara hedeflerin günlük paranın <b>${yuzde(g.hedefYukOrani)}</b> kadarını alıyor (önerilen en fazla ${yuzde(HEDEF_YUK_SINIRI)}). Bu kadar sıkı bir plan birkaç hafta sonra bırakılır.${o
            ? ` <b>"${esc(o.h.ad)}"</b> hedefinin süresini <b>${o.ekAy} ay</b> uzatırsan (${o.h.kalanAy} ay yerine ${o.yeniAy} ay) hedefler sınırın altına iner.`
            : ' Tek bir hedefi uzatmak yetmiyor; birkaç hedefin süresini uzat ya da birini sonraya bırak.'}`,
          neden: `Günlük harçlık payı: ${para(g.gelir)}/ay ÷ 30,44 gün = ${para(g.gunlukGelirPayi)}/gün. Hedeflere ayrılan: ${para(g.toplamAylikHedef)}/ay ÷ 30,44 = ${para(g.gunlukHedefPayi)}/gün. Oran ${yuzde(g.hedefYukOrani)}, sınır ${yuzde(HEDEF_YUK_SINIRI)}.<br>`
            + g.aktifHedefler.map(h => `"${esc(h.ad)}": kalan ${para(h.kalanTutar)} ÷ ${h.kalanAy} ay = ${para(h.aylikGereken)}/ay`).join('<br>')
        }
      };
    }
  }
];

// K44: en ağır hedefin süresi kaç ay uzarsa toplam hedef payı sınırın altına iner?
// Tek hedefi uzatmak yetmiyorsa null.
function hedefUzatma(g) {
  const fazla = g.toplamAylikHedef - HEDEF_YUK_SINIRI * g.gelir;
  const h = g.aktifHedefler.slice().sort((a, b) => b.aylikGereken - a.aylikGereken)[0];
  if (!h || h.aylikGereken - fazla <= 0) return null;
  const yeniAy = Math.ceil(h.kalanTutar / (h.aylikGereken - fazla));
  return yeniAy > h.kalanAy ? { h, yeniAy, ekAy: yeniAy - h.kalanAy } : null;
}
