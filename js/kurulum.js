// ============================================================
// kurulum.js — İLK AÇILIŞ (onboarding) VE REHBERLİ TUR
// Kurulum, kullanıcıyı tanıyıp gelir düzenini, ulaşımını ve düzenli
// ödemelerini sorar; sonunda günlük limitin nasıl hesaplandığını
// adım adım gösterir. Ardından uygulamanın içinde rehberli tur başlar.
// ============================================================

function yeniKurulum() {
  return {
    adim: 0, ad: '', okul: null,
    gelirDuzeni: 'haftalik', duzenSecildi: false,
    gelirTutari: 0, maasGunu: 1, harclikGunu: 1, harclikGunleri: HAFTA_ICI.slice(), tatildeHarclik: true,
    maasDegisken: false, maasGunuSon: '',   // aylık gelir her ay farklı günde geliyorsa en geç gün
    birikimYuzdesi: null,   // seçilmezse profile önerilen oran (öğrenciye %10)
    bakiye: null,
    ulasim: { tip: 'yok', kartTutar: '', ucret: '', gidisDonus: true, gunler: HAFTA_ICI.slice() },
    odemeler: {},
    hedef: { emoji: '🎯', ad: '', tutar: '' },
    hedefAy: null           // seçilmezse önerilen süre (kurulumHedefAyi)
  };
}

// "ulasim.ucret" gibi yollarla taslak nesnesine yazma
function yolAta(nesne, yol, deger) {
  const parcalar = yol.split('.');
  let o = nesne;
  while (parcalar.length > 1) o = o[parcalar.shift()];
  o[parcalar[0]] = deger;
}
function yolOku(nesne, yol) { return yol.split('.').reduce((o, p) => o && o[p], nesne); }

function maasGunuDuzelt(x) { return Math.min(31, Math.max(1, Math.round(sayi(x)) || 1)); }

// Tarihi değişen aylık gelirin en geç günü; aralık geçersizse 0 (tarih değişmiyor)
function maasGunuSonDuzelt(t) {
  if (!t.maasDegisken) return 0;
  const son = Math.round(sayi(t.maasGunuSon));
  return son > maasGunuDuzelt(t.maasGunu) && son <= 31 ? son : 0;
}

// "Her ay aynı gün gelmiyor" açıkken en geç gün, en erken günden sonra olmalı
function maasAraligiGecerli(t) {
  if (t.gelirDuzeni !== 'aylik' || !t.maasDegisken || maasGunuSonDuzelt(t)) return true;
  salla('[data-taslak="maasGunuSon"]');
  return false;
}

function taslakProfil(k) {
  return {
    ad: k.ad, okul: k.okul, gelirDuzeni: k.gelirDuzeni, gelirTutari: sayi(k.gelirTutari),
    maasGunu: maasGunuDuzelt(k.maasGunu), maasGunuSon: maasGunuSonDuzelt(k),
    harclikGunu: Number(k.harclikGunu), harclikGunleri: k.harclikGunleri.slice(),
    tatildeHarclik: k.tatildeHarclik !== false, birikimYuzdesi: kurulumBirikimYuzdesi(k)
  };
}

const BIRIKIM_SECENEKLERI = [0, 5, 10, 15, 20, 30];
function kurulumBirikimYuzdesi(k) {
  return k.birikimYuzdesi ?? Math.round(PROFIL.esik.birikimOrani * 100);
}

// Gelirin yüzde kaçının kumbaraya ayrılacağı (kurulumda ve Kumbara → Ana kumbara'da)
function birikimSecimi(secili) {
  return `<div class="segment birikim-secim">${BIRIKIM_SECENEKLERI.map(y =>
    `<button class="${y === secili ? 'secili' : ''}" data-eylem="birikim-sec" data-deger="${y}">${y ? '%' + y : 'Yok'}</button>`).join('')}</div>`;
}

// Seçilen oranın bir dönemde ve günde ne kadar ettiği
function birikimOzetHtml(profil, yuzdeDeger) {
  const donem = GELIR_DUZENLERI[profil.gelirDuzeni].donem;
  const donemGeliri = profil.gelirDuzeni === 'gunluk' ? sayi(profil.gelirTutari) * profil.harclikGunleri.length : sayi(profil.gelirTutari);
  const pay = donemGeliri * yuzdeDeger / 100;
  if (!yuzdeDeger) return `${ikon('bilgi', 16)}<span>Düzenli birikim kapalı. İstediğin zaman Kumbara → Ana kumbara'dan açabilirsin.</span>`;
  return `${ikon('damla', 16)}<span>Her ${donem} <b>${para(pay)}</b> kumbarana gider; günlük limitin ortalama <b>${para(pay / (donem === 'ay' ? 30.44 : 7))}</b> azalır.</span>`;
}

function ulasimNormal(u) {
  return { tip: u.tip, kartTutar: sayi(u.kartTutar), ucret: sayi(u.ucret), gidisDonus: !!u.gidisDonus, gunler: (u.gunler || []).slice() };
}

// Kurulum dönemin ilk günü yapılmıyorsa "şu an ne kadar kaldı?" diye sorulur
function bakiyeGerekli(k) {
  return tarihStr(donemBasBul(taslakProfil(k), new Date())) !== bugunStr();
}

function kurulumAdimlari(k = durum.kurulum) {
  const a = ['karsilama', 'tanis', 'duzen', 'tutar'];
  if (bakiyeGerekli(k)) a.push('bakiye');
  return a.concat(['ulasim', 'odemeler', 'birikim', 'kisisel', 'ozet']);
}
function kurulumAdimi(k = durum.kurulum) { return kurulumAdimlari(k)[k.adim]; }

// İlk hedefin önerilen süresi: en az 3 ay; hedefe ayrılan pay günlük harçlık payının %40'ını (K44)
// aşmayacak kadar uzun. Aşarsa günlük limit o kadar düşer ki cepte para kalmaz.
function kurulumOnerilenAy(k) {
  return Math.max(3, onerilenHedefAyi(sayi(k.hedef.tutar), aylikGelir(taslakProfil(k))) || 3);
}
function kurulumHedefAyi(k) { return k.hedefAy || kurulumOnerilenAy(k); }

function hedefSureMetni(k) {
  const tutar = sayi(k.hedef.tutar);
  if (!(tutar > 0)) return 'Tutarı girince ayda ne kadar biriktireceğini hesaplarım.';
  return hedefPlanMetni(tutar, kurulumHedefAyi(k), onerilenHedefAyi(tutar, aylikGelir(taslakProfil(k))));
}

// Seçilen sürede ayda ne kadar biriktirileceği; süre K44 sınırı için kısaysa uyarır
function hedefPlanMetni(kalanTutar, ay, onerilen) {
  const aylik = kalanTutar / ay;
  const kisa = onerilen === null || ay < onerilen;
  return `Ayda <b>${para(aylik)}</b> biriktirirsin; günlük limitin yaklaşık <b>${para(aylik / 30.44)}</b> azalır.`
    + (!kisa ? '' : onerilen === null ? ' <b>Hedeflerin zaten gelirinin %40\'ından fazlasını alıyor.</b>'
      : ` <b>Günlük limitin çok düşmesin diye en az ${onerilen} ay öneririm.</b>`);
}

// Kaç aya bölüneceği: − / + ile 1–60 ay
function aySecici(ay, eylem) {
  return `<div class="ay-secici">
    <button class="ikon-dugme" data-eylem="${eylem}" data-yon="-1" aria-label="Bir ay azalt" ${ay <= 1 ? 'disabled' : ''}><span class="eksi">−</span></button>
    <b class="ay-sayi">${ay} ay</b>
    <button class="ikon-dugme" data-eylem="${eylem}" data-yon="1" aria-label="Bir ay artır" ${ay >= HEDEF_EN_UZUN_AY ? 'disabled' : ''}>${ikon('arti', 18)}</button>
  </div>`;
}
function ayDegistir(ay, yon) { return Math.min(HEDEF_EN_UZUN_AY, Math.max(1, ay + Number(yon))); }

// Dönemin ortasında "Bilmiyorum" denirse cepteki para tahmin edilir: dönemin parası her gün eşit
// harcanmış sayılır (bugüne kadar gelen − geçen günlerin eşit payı). Tahmin edilmezse geçmiş
// günlerin bütün parası bugüne yığılırdı (ör. Pazar günü haftanın 5 günlük harçlığı).
function tahminiBakiye(v) {
  const d = gercekleriHesapla(v).donem, bugun = bugunStr();
  const gelen = d.gunler.filter(x => x.tarih <= bugun).reduce((t, x) => t + x.gelen + x.ekGelen, 0);
  const gecen = d.gunler.filter(x => x.tarih < bugun).length;
  return Math.max(0, Math.round(gelen - d.gelir * gecen / d.tamUzunluk));
}

// Kurulumdaki seçimlerden tam bir veri nesnesi oluşturur (özet ekranı ve kaydetme için)
function kurulumVerisi(k) {
  const v = bosVeri();
  v.ayarlar = veri.ayarlar;
  v.profil = taslakProfil(k);
  v.ulasim = ulasimNormal(k.ulasim);
  ulasimKartiEsitle(v);
  hazirOdemeler(k.okul).forEach(o => {
    if (o.anahtar in k.odemeler && sayi(k.odemeler[o.anahtar]) > 0) {
      v.sabitGiderler.push({ id: yeniId(), ad: o.ad, tutar: sayi(k.odemeler[o.anahtar]), kategori: o.kategori });
    }
  });
  if (k.hedef.ad.trim() && sayi(k.hedef.tutar) > 0) {
    const son = tarihAyEkle(new Date(), kurulumHedefAyi(k));
    v.hedefler.push({ id: yeniId(), ad: k.hedef.ad.trim(), emoji: k.hedef.emoji || '🎯', hedefTutar: sayi(k.hedef.tutar), biriken: 0, sonTarih: tarihStr(son), planTarihi: tarihStr(new Date()), acil: false });
  }
  v.baslangic = bugunStr();
  v.aktarimBas = bugunStr();
  if (bakiyeGerekli(k)) {
    const tahmini = k.bakiye === null;
    v.ilkDonem = { bas: tarihStr(donemBasBul(v.profil, new Date())), tarih: bugunStr(), bakiye: tahmini ? tahminiBakiye(v) : sayi(k.bakiye) };
    if (tahmini) v.ilkDonem.tahmini = true;
  }
  return v;
}

// ---------- Ortak form parçaları (kurulumda ve Profil'deki düzenleme sayfalarında) ----------

function gunCipleri(secili, alan) {
  return `<div class="gun-cipleri">${HAFTA_SIRASI.map(g => `<button class="${secili.includes(g) ? 'secili' : ''}" data-eylem="taslak-gun" data-alan="${alan}" data-gun="${g}">${GUN_KISA[g]}</button>`).join('')}</div>`;
}

function miniHafta(gunler) {
  return `<span class="mini-hafta" aria-hidden="true">${HAFTA_SIRASI.map(g => `<i class="${gunler.includes(g) ? 'dolu' : ''}"></i>`).join('')}</span>`;
}

function duzenSecimi(t) {
  const gorsel = {
    aylik: () => `<span class="mini-ay">${ikon('takvim', 13)} ayda 1</span>`,
    haftalik: () => miniHafta([Number(t.harclikGunu)]),
    gunluk: () => miniHafta(t.harclikGunleri)
  };
  return `<div class="tip-listesi">${Object.entries(GELIR_DUZENLERI).map(([id, x]) => {
    const secili = t.gelirDuzeni === id;
    return `<div class="secenek-kart ${secili ? 'secili' : ''}">
      <button class="tip-kart" data-eylem="taslak" data-alan="gelirDuzeni" data-deger="${id}">
        <span class="satir-orta"><b>${x.ad}</b><small>${x.aciklama}</small>${gorsel[id]()}</span>
        <span class="radyo"></span>
      </button>
      ${secili ? `<div class="secenek-detay">${duzenDetay(t, id)}</div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function duzenDetay(t, id) {
  if (id === 'aylik') {
    return `<label class="alan satirli"><span>${t.maasDegisken ? 'En erken ayın kaçında?' : 'Ayın kaçında geliyor?'}</span>
      <input type="number" inputmode="numeric" min="1" max="31" data-taslak="maasGunu" value="${esc(t.maasGunu)}"></label>
    <button class="anahtar-satir ${t.maasDegisken ? 'acik' : ''}" data-eylem="taslak-anahtar" data-alan="maasDegisken" data-yenile>
      <span class="satir-orta"><b>Her ay aynı gün gelmiyor</b><small>Burs gibi; yattığı gün değişiyor</small></span><span class="anahtar"></span>
    </button>
    ${t.maasDegisken ? `<label class="alan satirli"><span>En geç ayın kaçında?</span>
      <input type="number" inputmode="numeric" min="2" max="31" placeholder="Örn. 20" data-taslak="maasGunuSon" value="${esc(t.maasGunuSon)}"></label>
    <small class="alan-not">Para yatana kadar en geç güne göre planlarım ki elindeki para yetsin. Yatınca "Yattı" demen yeter; yeni dönemin o gün başlar.</small>` : ''}`;
  }
  if (id === 'haftalik') {
    return `<div class="alan"><span>Hangi gün geliyor?</span>${gunCipleri([Number(t.harclikGunu)], 'harclikGunu')}</div>`;
  }
  const universite = (t.okul || (veri.profil && veri.profil.okul)) === 'universite';
  return `<div class="alan"><span>Hangi günler geliyor?</span>${gunCipleri(t.harclikGunleri, 'harclikGunleri')}
    <small class="alan-not">Seçmediğin günlerin (ör. hafta sonu) parası, harçlık gelen günlerden otomatik ayrılır.</small></div>
    <button class="anahtar-satir ${t.tatildeHarclik !== false ? 'acik' : ''}" data-eylem="taslak-anahtar" data-alan="tatildeHarclik">
      <span class="satir-orta"><b>Tatilde de harçlık alıyorum</b><small>${universite ? 'Resmî tatil ve izinli günler' : 'Resmî tatil, okul tatili ve izinli günler'}</small></span><span class="anahtar"></span>
    </button>`;
}

function ulasimSecimi(t) {
  const u = t.ulasim;
  return `<div class="tip-listesi">${Object.entries(ULASIM_TIPLERI).map(([id, x]) => {
    const secili = u.tip === id;
    return `<div class="secenek-kart ${secili ? 'secili' : ''}">
      <button class="tip-kart" data-eylem="taslak" data-alan="ulasim.tip" data-deger="${id}">
        <span class="kat-ikon" style="--renk:var(--marka)">${ikon(x.ikon, 20)}</span>
        <span class="satir-orta"><b>${x.ad}</b><small>${x.aciklama}</small></span>
        <span class="radyo"></span>
      </button>
      ${secili && id !== 'yok' ? `<div class="secenek-detay">${ulasimDetay(u, id)}</div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function ulasimDetay(u, id) {
  if (id === 'kart') {
    return `<label class="alan satirli"><span>Aylık tutar (₺)</span>
      <input type="number" inputmode="numeric" min="0" placeholder="Örn. 300" data-taslak="ulasim.kartTutar" value="${esc(u.kartTutar || '')}"></label>`;
  }
  return `<div class="alan"><span>Hangi günler biniyorsun?</span>${gunCipleri(u.gunler, 'ulasim.gunler')}</div>
    <label class="alan satirli"><span>Tek yön ücret (₺)</span>
      <input type="number" inputmode="decimal" min="0" placeholder="Örn. 25" data-taslak="ulasim.ucret" value="${esc(u.ucret || '')}"></label>
    <button class="anahtar-satir ${u.gidisDonus ? 'acik' : ''}" data-eylem="taslak-anahtar" data-alan="ulasim.gidisDonus">
      <span class="satir-orta"><b>Gidiş-dönüş</b><small>Günde iki kez biniyorum</small></span><span class="anahtar"></span>
    </button>
    <div id="ulasim-ozet" class="onizleme">${ulasimOzetHtml(u)}</div>`;
}

function ulasimOzetHtml(u) {
  const gunluk = ulasimGunlukMaliyet({ ...u, ucret: sayi(u.ucret) });
  const n = (u.gunler || []).length;
  if (!gunluk || !n) return `${ikon('bilgi', 16)}<span>Ücreti ve günleri girince ulaşım payını hesaplarım.</span>`;
  return `${ikon('bilgi', 16)}<span>Haftada ${n} gün × ${para(gunluk)} = <b>${para(gunluk * n)}</b>, ayda yaklaşık <b>${para(gunluk * n * 52 / 12)}</b>. Bu para günlük limitinden önce ayrılır; tatil günlerinde ayrılmaz.</span>`;
}

function ulasimGecerli(u) {
  if (u.tip === 'kart' && sayi(u.kartTutar) <= 0) { salla('[data-taslak="ulasim.kartTutar"]'); return false; }
  if (u.tip === 'binis') {
    if (!u.gunler.length) { salla('.secenek-kart.secili .gun-cipleri'); return false; }
    if (sayi(u.ucret) <= 0) { salla('[data-taslak="ulasim.ucret"]'); return false; }
  }
  return true;
}

function tutarSorusu(k) {
  if (k.gelirDuzeni === 'gunluk') return 'Günde ne kadar harçlık alıyorsun?';
  if (k.gelirDuzeni === 'haftalik') return 'Haftalık harçlığın ne kadar?';
  return k.okul === 'universite' ? 'Aylık bursun ya da harçlığın ne kadar?' : 'Aylık harçlığın ne kadar?';
}

function tutarEtiketi(t) {
  return { gunluk: 'Her gün gelen tutar (₺)', haftalik: 'Haftalık tutar (₺)', aylik: 'Aylık tutar (₺)' }[t.gelirDuzeni];
}

// ---------- Kurulum ekranları ----------

function kurulumUst(k, atla = false) {
  const adimlar = kurulumAdimlari(k);
  const oran = Math.min(1, k.adim / (adimlar.length - 2));
  return `<div class="kur-ust">
    <button class="ikon-dugme" data-eylem="kurulum-geri" aria-label="Geri">${ikon('geri', 22)}</button>
    <div class="kur-ilerleme" role="progressbar" aria-valuenow="${Math.round(oran * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${oran * 100}%"></i></div>
    ${atla ? '<button class="metin-dugme kur-atla" data-eylem="kurulum-atla">Atla</button>' : '<span class="ikon-dugme bosluk"></span>'}
  </div>`;
}

function kurulumCiz() {
  const k = durum.kurulum;
  const adim = kurulumAdimi(k);
  const devam = (metin = 'Devam', ek = '') => `<div class="kur-alt"><button class="dugme ana genis" data-eylem="kurulum-ileri" data-enter>${metin}</button>${ek}</div>`;

  if (adim === 'karsilama') {
    return `<div class="kurulum karsilama">
      <div class="kur-dil">${dilSecimi()}</div>
      <div class="kur-logo">
        <div class="kur-damla-kap">${damlaLogo(104)}<div class="kur-dalgalar" aria-hidden="true"><i></i><i></i><i></i></div></div>
        <span class="yazi-logo">Damly</span>
      </div>
      <p class="kur-slogan">Damlaya damlaya göl olur.</p>
      <ul class="kur-ozellikler">
        <li><span class="kat-ikon" style="--renk:#2563EB">${ikon('cuzdan', 18)}</span><div><b>Dinamik günlük limit</b><small>Bugün ne kadar harcayabileceğini her an bil</small></div></li>
        <li><span class="kat-ikon" style="--renk:#FF8A3D">${ikon('takvim', 18)}</span><div><b>Akıllı takvim</b><small>Harçlık, ulaşım ve planların tek yerde</small></div></li>
        <li><span class="kat-ikon" style="--renk:#12B886">${ikon('damla', 18)}</span><div><b>Kumbara hedefleri</b><small>Hayallerin için damla damla biriktir</small></div></li>
        <li><span class="kat-ikon" style="--renk:#AE3EC9">${ikon('yildiz', 18)}</span><div><b>Akıllı asistan</b><small>Gerekçesini açıklayan kişisel öneriler</small></div></li>
      </ul>
      <div class="kur-alt">
        <button class="dugme ana genis" data-eylem="kurulum-ileri">Başlayalım</button>
      </div>
    </div>`;
  }

  if (adim === 'tanis') {
    return `<div class="kurulum">
      ${kurulumUst(k)}
      <div class="kur-maskot" aria-live="polite">
        ${maskot({ ruh: 'selam', boyut: 96, dolum: 0.25 })}
        <p class="konusma" id="k-maskot-soz">${tanisSozu(k)}</p>
      </div>
      <h1 class="kur-baslik">Seni tanıyalım</h1>
      <p class="kur-aciklama">Asistan önerilerini senin durumuna göre ayarlar.</p>
      <label class="alan"><span>Adın</span><input id="k-ad" data-taslak="ad" maxlength="30" placeholder="Örn. Elif" value="${esc(k.ad)}" autocomplete="given-name"></label>
      <div class="alan" id="k-okul"><span>Hangi okuldasın?</span>${okulSecimi(k.okul, 'kurulumOkul')}</div>
      ${devam()}
    </div>`;
  }

  if (adim === 'duzen') {
    return `<div class="kurulum">
      ${kurulumUst(k)}
      ${kurSahnesi(adim, k)}
      <h1 class="kur-baslik">Paran nasıl geliyor?</h1>
      <p class="kur-aciklama">Günlük limitini paranın geliş düzenine göre hesaplarım.</p>
      ${duzenSecimi(k)}
      ${devam()}
    </div>`;
  }

  if (adim === 'tutar' || adim === 'bakiye') {
    let baslikM = tutarSorusu(k), aciklama = 'Daha sonra Profil ekranından değiştirebilirsin.', ek = '';
    if (adim === 'bakiye') {
      baslikM = k.gelirDuzeni === 'gunluk' ? 'Şu an cebinde ne kadar var?'
        : `Bu ${GELIR_DUZENLERI[k.gelirDuzeni].donem}ki harçlığından ne kadar kaldı?`;
      aciklama = k.gelirDuzeni === 'gunluk'
        ? 'Bugün aldığın harçlık dahil. Haftanın kalanını buna göre planlayacağım.'
        : 'Dönemin ortasında başladığın için kalan günleri bu tutara göre planlayacağım.';
      aciklama += ' Bilmiyorsan atla; paranı her gün eşit harcadığını varsayarım.';
      ek = '<button class="dugme hayalet genis" data-eylem="kurulum-atla">Bilmiyorum, atla</button>';
    }
    return `<div class="kurulum">
      ${kurulumUst(k)}
      ${kurSahnesi(adim, k)}
      <h1 class="kur-baslik">${baslikM}</h1>
      <p class="kur-aciklama">${aciklama}</p>
      <div class="kur-tutar">${tutarGostergesi('')}</div>
      ${tusTakimi()}
      ${devam('Devam', ek)}
    </div>`;
  }

  if (adim === 'ulasim') {
    return `<div class="kurulum">
      ${kurulumUst(k)}
      ${kurSahnesi(adim, k)}
      <h1 class="kur-baslik">Okula nasıl gidiyorsun?</h1>
      <p class="kur-aciklama">Ulaşım parası limitinden önce ayrılır; böylece "yol parasını da harcadım" demezsin.</p>
      ${ulasimSecimi(k)}
      ${devam()}
    </div>`;
  }

  if (adim === 'odemeler') {
    return `<div class="kurulum">
      ${kurulumUst(k, true)}
      ${kurSahnesi(adim, k)}
      <h1 class="kur-baslik">Düzenli ödemelerin</h1>
      <p class="kur-aciklama">Her ay ödediğin sabit giderleri seç. Tutarlar yaklaşık; kendine göre değiştir.</p>
      <div class="odeme-listesi">${hazirOdemeler(k.okul).map(o => odemeSatiri(o, k)).join('')}</div>
      <p class="alan-not">Listede olmayanları sonra Profil ya da Bütçe → Düzenli ödemeler'den ekleyebilirsin.</p>
      ${devam()}
    </div>`;
  }

  if (adim === 'birikim') {
    const y = kurulumBirikimYuzdesi(k);
    const onerilen = Math.round(PROFIL.esik.birikimOrani * 100);
    return `<div class="kurulum">
      ${kurulumUst(k)}
      ${kurSahnesi(adim, k)}
      <h1 class="kur-baslik">Ne kadar biriktirelim?</h1>
      <p class="kur-aciklama">Paran gelince bu kadarını harcamadan önce kumbarana ayırırım.</p>
      ${birikimSecimi(y)}
      <div class="onizleme">${birikimOzetHtml(taslakProfil(k), y)}</div>
      <p class="alan-not">Öğrenciler için önerilen: %${onerilen}. Günlük limitin de ₺450, ₺500 gibi yuvarlak sayılara yuvarlanır; artan para da kumbarana gider.</p>
      ${devam()}
    </div>`;
  }

  if (adim === 'kisisel') {
    return `<div class="kurulum">
      ${kurulumUst(k, true)}
      ${kurSahnesi(adim, k)}
      <h1 class="kur-baslik">Sana göre ayarlayalım</h1>
      <p class="kur-aciklama">Açık ya da koyu görünümü seç ve istersen ilk birikim hedefini koy.</p>
      <div class="alan"><span>Görünüm modu</span>${modSecimi()}</div>
      <div class="alan"><span>İlk birikim hedefin <em>(isteğe bağlı)</em></span>
        <div class="cip-secim">${hedefOnerileri(k.okul).map(([e, ad, t]) => `<button class="${k.hedef.ad === cevir(ad) ? 'secili' : ''}" style="--renk:var(--marka)" data-eylem="hedef-oneri" data-emoji="${e}" data-ad="${ad}" data-tutar="${t}">${e} ${ad}</button>`).join('')}</div>
      </div>
      <div class="alan-ikili">
        <label class="alan"><span>Hedef adı</span><input data-taslak="hedef.ad" maxlength="30" placeholder="Örn. Kulaklık" value="${esc(k.hedef.ad)}"></label>
        <label class="alan"><span>Tutar (₺)</span><input data-taslak="hedef.tutar" type="number" inputmode="numeric" min="0" placeholder="0" value="${esc(k.hedef.tutar)}"></label>
      </div>
      <div class="alan"><span>Kaç ayda biriktireceksin?</span>${aySecici(kurulumHedefAyi(k), 'kurulum-hedef-ay')}</div>
      <p class="alan-not" id="k-hedef-sure">${hedefSureMetni(k)}</p>
      ${devam()}
    </div>`;
  }

  return kurulumOzeti(k);
}

// Maskotun tanışmadaki sözü: seçilen okula göre değişir
function tanisSozu(k) {
  return {
    lise: 'Harika! Kantin, dolmuş, harçlık… hepsini birlikte planlarız.',
    universite: 'Güzel! Burs, yemekhane, kart dolumu… hepsini birlikte planlarız.'
  }[k.okul] || 'Selam! Ben senin harcama asistanınım. Önce seni biraz tanıyayım.';
}

// Okul seçimi (kurulumda ve Profil'de)
function okulSecimi(secili, alan) {
  return `<div class="segment okul-secim">${Object.entries(OKUL_DUZEYLERI).map(([id, o]) =>
    `<button class="${id === secili ? 'secili' : ''}" data-eylem="form-sec" data-alan="${alan}" data-deger="${id}">${o.ad}</button>`).join('')}</div>`;
}

function odemeSatiri(o, k) {
  const secili = o.anahtar in k.odemeler;
  const kat = sabitKategori(o.kategori);
  return `<div class="odeme-satir ${secili ? 'secili' : ''}">
    <button class="odeme-sec" data-eylem="odeme-sec" data-anahtar="${o.anahtar}">
      <span class="kat-ikon kucuk" style="--renk:${kat.renk}">${ikon(kat.ikon, 16)}</span>
      <span class="satir-orta"><b>${o.ad}</b>${secili ? '' : `<small>yaklaşık ${para(o.tutar)} / ay</small>`}</span>
      <span class="onay-kutu">${ikon('onay', 14)}</span>
    </button>
    ${secili ? `<label class="odeme-tutar"><input type="number" inputmode="numeric" min="0" data-taslak="odemeler.${o.anahtar}" value="${esc(k.odemeler[o.anahtar])}" aria-label="${o.ad} tutarı"><span>₺ / ay</span></label>` : ''}
  </div>`;
}

function kurulumOzeti(k) {
  const tv = kurulumVerisi(k);
  const g = gercekleriHesapla(tv);
  const tk = g.takvim;
  const satirlar = [];
  const ekle = (a, b, sinif = '') => satirlar.push(hesapSatiri(a, b, sinif));
  ekle(tv.ilkDonem ? `Bu dönemin kalan parası${tv.ilkDonem.tahmini ? ' (tahmini)' : ''}` : `Bu ${g.donemAdi} gelecek ${g.gelirAdi}`, para(g.donemGeliri));
  if (g.sabitPayi >= 1) ekle('Düzenli ödemelerin payı', '− ' + para(g.sabitPayi));
  if (g.ulasimPayi >= 1) ekle(`Ulaşım (${g.ulasimGunSayisi} gün)`, '− ' + para(g.ulasimPayi));
  if (g.birikimPayi >= 1) ekle('Kumbaraya ayrılan', '− ' + para(g.birikimPayi));
  ekle(g.donemAdi === 'hafta' ? 'Haftalık limitin' : 'Aylık limitin', para(g.harcanabilirDonem), 'ara');
  ekle('Kalan gün (bugün dahil)', '÷ ' + g.kalanGun);

  // Önümüzdeki 30 günde takvime düşenler
  let gelirGun = 0, ulasimGun = 0, tatilGun = 0;
  for (let i = 0; i < 30; i++) {
    const d = gunEkle(new Date(), i), t = tarihStr(d);
    if (tk.gelirGunuMu(d)) gelirGun++;
    if (tk.ulasimDurumu(t, d) === 'var') ulasimGun++;
    if (tk.tatil(t)) tatilGun++;
  }
  const cipler = [
    `<span class="cip">${ikon('damla', 14)} ${gelirGun} ${g.gelirAdi} günü</span>`,
    ulasimGun ? `<span class="cip">${ikon('otobus', 14)} ${ulasimGun} ulaşım günü</span>` : '',
    tatilGun ? `<span class="cip">${ikon('gunes', 14)} ${tatilGun} tatil günü</span>` : ''
  ].join('');

  return `<div class="kurulum ozet">
    ${kurulumUst(k)}
    <div class="kur-sahne">${maskot({ ruh: 'mutlu', boyut: 104, dolum: 0.25 })}</div>
    <h1 class="kur-baslik">Planın hazır, ${esc(ilkAd(k.ad))}!</h1>
    <p class="kur-aciklama">Bugün için hesabım şöyle:</p>
    <div class="hesap ozet-hesap">${satirlar.map((s, i) => s.replace('class="hesap-satir', `style="--i:${i}" class="hesap-satir`)).join('')}</div>
    <div class="ozet-limit" style="--i:${satirlar.length}">
      ${konfeti()}
      <span>Bugünkü limitin</span><strong>${para(g.gunlukLimit)}</strong>
      <small>${g.hamLimit - g.gunlukLimit >= 1 ? `${para(g.hamLimit)} yuvarlandı, artanı kumbarana · ` : g.nakitSinirli ? 'Cebindeki parayla sınırlandı · ' : ''}Her gün yeniden hesaplanır</small>
    </div>
    <div class="ozet-takvim" style="--i:${satirlar.length + 1}"><span class="kart-etiket">Önümüzdeki 30 gün takviminde</span><div class="cip-satiri">${cipler}</div></div>
    <div class="kur-alt"><button class="dugme ana genis" data-eylem="kurulum-bitir" data-enter>Damly'yi kullanmaya başla</button></div>
  </div>`;
}

// Adımlar arasında yöne duyarlı kayma: ileri giderken yeni ekran sağdan gelir,
// eskisi sola çıkar; geri giderken tersi. Aynı adım yeniden çizilirse kayma olmaz.
function kurulumEkraniCiz(ekranEl) {
  const k = durum.kurulum;
  const anahtar = 'kurulum-' + kurulumAdimi(k);
  const eski = $('.kaydir:not(.cikis)', ekranEl);
  const yeni = document.createElement('div');
  yeni.className = 'kaydir tam';
  yeni.innerHTML = kurulumCiz();
  const ayni = eski && anahtar === durum.sonEkran;

  if (ayni) {
    const konum = eski.scrollTop;
    eski.replaceWith(yeni);
    yeni.scrollTop = konum;
  } else {
    const yon = durum.kurulumYon || 'ileri';
    $$('.kaydir.cikis', ekranEl).forEach(x => x.remove());
    if (eski) {
      eski.classList.add('cikis', yon);
      setTimeout(() => eski.remove(), 400);
      yeni.classList.add('kur-gir', yon);
    } else yeni.classList.add('giris');
    ekranEl.appendChild(yeni);
  }

  // İlerleme çubuğu önceki adımdan yeni adıma akarak dolar
  const cubuk = $('.kur-ilerleme i', yeni);
  if (cubuk) {
    const hedef = cubuk.style.width;
    if (!ayni && durum.kurOran) {
      cubuk.style.width = durum.kurOran;
      requestAnimationFrame(() => requestAnimationFrame(() => { cubuk.style.width = hedef; }));
    }
    durum.kurOran = hedef;
  } else durum.kurOran = '0%';

  durum.sonEkran = anahtar;
  durum.kurulumYon = 'ileri';
}

// ---------- Kurulum işlemleri ----------

function kurulumTusunuHazirla() {
  const k = durum.kurulum, adim = kurulumAdimi(k);
  const v = adim === 'tutar' ? k.gelirTutari : adim === 'bakiye' ? k.bakiye : null;
  durum.tus = v ? String(v).replace('.', ',') : '';
}

function kurulumIleri() {
  const k = durum.kurulum;
  const adim = kurulumAdimi(k);
  if (adim === 'tanis') {
    k.ad = ($('#k-ad').value || '').trim();
    if (!k.ad) { salla('#k-ad'); $('#k-ad').focus(); return; }
    if (!k.okul) { salla('#k-okul .segment'); return; }
  }
  if (adim === 'duzen') {
    if (k.gelirDuzeni === 'gunluk' && !k.harclikGunleri.length) { salla('.secenek-kart.secili .gun-cipleri'); return; }
    if (!maasAraligiGecerli(k)) return;
    if (k.gelirDuzeni === 'aylik') k.maasGunu = maasGunuDuzelt(k.maasGunu);
  }
  if (adim === 'tutar') {
    const v = sayi(durum.tus);
    if (v <= 0) { salla('.tutar-gosterge'); return; }
    k.gelirTutari = v;
  }
  if (adim === 'bakiye') {
    if (!durum.tus) { salla('.tutar-gosterge'); return; }
    k.bakiye = sayi(durum.tus);
  }
  if (adim === 'ulasim' && !ulasimGecerli(k.ulasim)) return;
  if (adim === 'kisisel' && k.hedef.ad.trim() && sayi(k.hedef.tutar) <= 0) { salla('[data-taslak="hedef.tutar"]'); return; }
  k.adim++;
  kurulumTusunuHazirla();
  ciz();
}

function kurulumAtla() {
  const k = durum.kurulum;
  const adim = kurulumAdimi(k);
  if (adim === 'bakiye') k.bakiye = null;
  if (adim === 'odemeler') k.odemeler = {};
  if (adim === 'kisisel') { k.hedef = { emoji: '🎯', ad: '', tutar: '' }; k.hedefAy = null; }
  k.adim++;
  kurulumTusunuHazirla();
  ciz();
}

function kurulumGeri() {
  const k = durum.kurulum;
  const adim = kurulumAdimi(k);
  if (adim === 'tutar' && durum.tus) k.gelirTutari = sayi(durum.tus);
  k.adim = Math.max(0, k.adim - 1);
  durum.kurulumYon = 'geri';
  kurulumTusunuHazirla();
  ciz();
}

function kurulumBitir() {
  const k = durum.kurulum;
  veri = kurulumVerisi(k);
  veri.ayarlar.tur = 'bekliyor';
  durum.tus = '';
  durum.sekme = 'bugun';
  durum.yigin = [];
  kaydetVeCiz(`Hoş geldin, ${ilkAd(k.ad)}!`);
  setTimeout(turBaslat, 700);
}

// ---------- Rehberli tur ----------
// Uygulamanın içinde ilgili yeri vurgular; bazı adımlarda kullanıcının
// gerçekten dokunmasını bekler ("bekle").

const TUR_ADIMLARI = [
  {
    hedef: '.gunluk-kart', baslik: 'Bugünkü limitin',
    metin: g => `Bugün en fazla <b>${para(g.gunlukLimit)}</b> harcayabilirsin. Altında bu ${g.donemAdi === 'hafta' ? 'haftanın' : 'ayın'} limiti var: <b>${para(Math.max(0, g.harcanabilirDonem))}</b>. Günlük limit, ${g.donemAdi === 'hafta' ? 'haftadan' : 'aydan'} kalan paranın kalan günlere bölünmesiyle her gün yeniden hesaplanır.`
  },
  {
    hedef: '.fab', bekle: 'harcama-eklendi', baslik: 'İlk harcamanı ekle', yuvarlak: true,
    metin: () => 'Harcama yaptıkça buradan eklersin. Hadi dene: <b>+</b> düğmesine dokun ve küçük bir harcama gir.'
  },
  {
    hedef: '.gunluk-kart', baslik: 'Limitin güncellendi',
    metin: g => `Harcaman limitten düşüldü; bugün <b>${para(Math.max(0, g.bugunKalan))}</b> kaldı. Az harcadığın günlerde artan para, sonraki günlerin limitine eklenir.`
  },
  {
    hedef: '.sekme[data-sekme="takvim"]', bekle: 'sekme-takvim', baslik: 'Takvim',
    metin: g => `${buyukHarf(g.gelirAdi)} günlerin, ulaşım ve planların takvimde. <b>Takvim</b> sekmesine dokun.`
  },
  {
    hedef: '.takvim-kart', baslik: 'Akıllı takvim',
    metin: () => 'Renkli noktalar gelir, ulaşım ve plan günlerini gösterir. Geçmiş günler limit içindeyse yeşil, aşıldıysa kırmızı olur. Bir güne dokunup <b>plan ekleyebilir</b> ya da "o gün ulaşım yok" diyebilirsin.'
  },
  {
    hedef: '.sekme[data-sekme="asistan"]', bekle: 'sekme-asistan', baslik: 'Akıllı asistan',
    metin: () => 'Asistan harcamalarını kurallarla inceleyip öneri verir. <b>Asistan</b> sekmesine dokun.'
  },
  {
    hedef: '.oneri .neden-dugme', bekle: 'neden', baslik: 'Her önerinin bir gerekçesi var',
    metin: () => 'Asistan, önerisine nasıl vardığını açıklar. <b>Neden bu öneri?</b> yazısına dokun.'
  },
  {
    hedef: null, baslik: 'Hazırsın! 🎉',
    metin: () => 'Damly artık senin. Turu istediğin zaman <b>Profil</b> ekranından yeniden başlatabilirsin.'
  }
];

function turBaslat() {
  if (!veri.profil) return;
  sheetKapat();
  durum.tur = { adim: 0 };
  durum.sekme = 'bugun';
  durum.yigin = [];
  veri.ayarlar.tur = 'bekliyor';
  veriKaydet(veri);
  ciz();
}

function turBitir(sonuc) {
  durum.tur = null;
  veri.ayarlar.tur = sonuc;
  if (sonuc === 'atlandi') veri.ayarlar.turAtlanma = bugunStr();
  veriKaydet(veri);
  const el = $('#tur');
  if (el) { el.classList.add('kapan'); setTimeout(() => el.remove(), 250); }
  ciz();
}

function turIleri() {
  durum.tur.adim++;
  if (durum.tur.adim >= TUR_ADIMLARI.length) { turBitir('bitti'); return; }
  turCiz();
}

// Kullanıcı beklenen işlemi yaptıysa tur bir sonraki adıma geçer
function turOlay(ad) {
  if (!durum.tur) return;
  if (TUR_ADIMLARI[durum.tur.adim].bekle === ad) { durum.tur.adim++; turCiz(); }
}

function turCiz() {
  let el = $('#tur');
  if (!durum.tur || !veri.profil) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'tur';
    el.className = 'tur';
    el.innerHTML = `<div class="tur-delik"></div>
      <div class="tur-blok" data-b="ust"></div><div class="tur-blok" data-b="alt"></div>
      <div class="tur-blok" data-b="sol"></div><div class="tur-blok" data-b="sag"></div>
      <div class="tur-blok" data-b="orta"></div>
      <div class="tur-balon" role="dialog" aria-live="polite"></div>`;
    uygulama.insertBefore(el, $('#katman'));
  }
  const adimlar = TUR_ADIMLARI;
  const a = adimlar[durum.tur.adim];
  const hedefVar = turHedefi(a);
  const bekliyor = a.bekle && hedefVar;
  const son = durum.tur.adim === adimlar.length - 1;
  el.classList.toggle('bekliyor', !!bekliyor);
  el.classList.toggle('yuvarlak', !!a.yuvarlak);
  $('.tur-balon', el).innerHTML = `
    <div class="tur-ust"><span>${durum.tur.adim + 1} / ${adimlar.length}</span>
      ${son ? '' : '<button class="metin-dugme" data-eylem="tur-atla">Turu geç</button>'}</div>
    <div class="tur-bas">${maskot({ ruh: son ? 'mutlu' : durum.tur.adim ? 'normal' : 'selam', boyut: 44, dolum: maskotDolum(durum.g) })}<h3>${a.baslik}</h3></div>
    <p>${a.metin(durum.g)}</p>
    <div class="tur-alt">${bekliyor
      ? `<span class="tur-ipucu">${ikon('yukariOk', 14)} Dokunmanı bekliyorum</span><button class="metin-dugme" data-eylem="tur-ileri">Bu adımı geç</button>`
      : `<span></span><button class="dugme ana kucuk" data-eylem="tur-ileri">${son ? 'Bitir' : 'İleri'}</button>`}</div>`;
  turKonumla();
  setTimeout(turKonumla, 480);   // ekran geçişi bitince yeniden hizala
}

// Ekran geçişi sürerken çıkan ekranın kopyası değil, yeni ekrandaki öğe vurgulanır
function turHedefi(a) {
  return a.hedef ? $$(a.hedef, uygulama).find(e => !e.closest('.cikis')) || null : null;
}

function turKonumla() {
  const el = $('#tur');
  if (!el || !durum.tur) return;
  const a = TUR_ADIMLARI[durum.tur.adim];
  const hedefEl = turHedefi(a);
  const app = uygulama.getBoundingClientRect();
  const W = app.width, H = app.height;
  let x = W / 2, y = H / 2, w = 0, h = 0;

  if (hedefEl) {
    const kap = hedefEl.closest('.kaydir');
    if (kap) {
      const r = hedefEl.getBoundingClientRect(), k = kap.getBoundingClientRect();
      if (r.top < k.top + 70 || r.bottom > k.bottom - 150) kap.scrollTop += r.top - k.top - Math.max(70, (k.height - r.height) / 2 - 60);
    }
    const r = hedefEl.getBoundingClientRect();
    const pay = a.yuvarlak ? 5 : 6;
    x = r.left - app.left - pay; y = r.top - app.top - pay;
    w = r.width + pay * 2; h = r.height + pay * 2;
  }

  const delik = $('.tur-delik', el);
  Object.assign(delik.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  const bloklar = {
    ust: [0, 0, W, Math.max(0, y)],
    alt: [0, y + h, W, Math.max(0, H - y - h)],
    sol: [0, y, Math.max(0, x), h],
    sag: [x + w, y, Math.max(0, W - x - w), h],
    orta: [x, y, w, h]
  };
  $$('.tur-blok', el).forEach(b => {
    const [l, t, bw, bh] = bloklar[b.dataset.b];
    Object.assign(b.style, { left: l + 'px', top: t + 'px', width: bw + 'px', height: bh + 'px' });
  });

  const balon = $('.tur-balon', el);
  balon.style.top = balon.style.bottom = '';
  if (!hedefEl) balon.style.top = Math.max(60, (H - balon.offsetHeight) / 2) + 'px';
  else if (y + h / 2 > H / 2) balon.style.bottom = (H - y + 14) + 'px';
  else balon.style.top = (y + h + 14) + 'px';
}
