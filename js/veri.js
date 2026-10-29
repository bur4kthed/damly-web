// ============================================================
// veri.js — Sabitler, yardımcı fonksiyonlar ve veri saklama
// Tüm veriler kullanıcının kendi cihazında (localStorage) tutulur.
// Hiçbir veri sunucuya gönderilmez.
// ============================================================

const DEPO_ANAHTARI = 'damly-veri-v1';
const SURUM = '3.1';
const VERI_SURUMU = 4;   // kayıt biçimi değişince artar; eski kayıtlar veriGoc() ile dönüştürülür

// Damly lise ve üniversite öğrencileri içindir. Asistan, kurallardaki sınır
// değerlerini (eşikleri) buradan alır.
const PROFIL = {
  ad: 'Öğrenci', gelirAdi: 'harçlık', gelirE: 'harçlığa',
  esik: { sabitOrani: 0.50, istekOrani: 0.30, birikimOrani: 0.10, acilDurumAy: 1, kucukHarcama: 100, borcOrani: 0.10 }
};

// Paranın hangi sıklıkla geldiği. Günlük limit bu düzene göre "dönem" dönem hesaplanır.
const GELIR_DUZENLERI = {
  aylik:    { ad: 'Aylık',    aciklama: 'Ayda bir kez geliyor (burs, maaş)', donem: 'ay' },
  haftalik: { ad: 'Haftalık', aciklama: 'Haftada bir gün geliyor', donem: 'hafta' },
  gunluk:   { ad: 'Günlük',   aciklama: 'Belirli günlerde her gün (ör. hafta içi)', donem: 'hafta' }
};

const ULASIM_TIPLERI = {
  yok:   { ad: 'Ücret ödemiyorum', aciklama: 'Yürüyerek, bisikletle ya da servisle', ikon: 'kisi' },
  kart:  { ad: 'Aylık kart / abonman', aciklama: 'Her ay sabit bir tutar ödüyorum', ikon: 'kart' },
  binis: { ad: 'Binişte ödüyorum', aciklama: 'Dolmuş, otobüs… her gidişte ücret', ikon: 'otobus' }
};

// JS'in getDay() sırası: 0 = Pazar … 6 = Cumartesi. Ekranda hafta Pazartesi başlar.
const GUN_ADLARI = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const HAFTA_SIRASI = [1, 2, 3, 4, 5, 6, 0];
const HAFTA_ICI = [1, 2, 3, 4, 5];

const HARCAMA_KATEGORILERI = {
  yemek:   { ad: 'Yemek',    ikon: 'yemek',  renk: '#FF8A3D' },
  market:  { ad: 'Market',   ikon: 'market', renk: '#12B886' },
  ulasim:  { ad: 'Ulaşım',   ikon: 'otobus', renk: '#4C6EF5' },
  eglence: { ad: 'Eğlence',  ikon: 'oyun',   renk: '#AE3EC9' },
  egitim:  { ad: 'Eğitim',   ikon: 'kitap',  renk: '#1C9AD6' },
  giyim:   { ad: 'Giyim',    ikon: 'tisort', renk: '#F06595' },
  saglik:  { ad: 'Sağlık',   ikon: 'kalp',   renk: '#E8590C' },
  diger:   { ad: 'Diğer',    ikon: 'kutu',   renk: '#7C8798' }
};

const SABIT_KATEGORILER = {
  kira:     { ad: 'Kira / Yurt',        ikon: 'ev',      renk: '#4C6EF5' },
  fatura:   { ad: 'Fatura',             ikon: 'simsek',  renk: '#F59F00' },
  iletisim: { ad: 'Telefon & İnternet', ikon: 'telefon', renk: '#1C9AD6' },
  ulasim:   { ad: 'Ulaşım kartı',       ikon: 'kart',    renk: '#12B886' },
  abonelik: { ad: 'Abonelik',           ikon: 'tv',      renk: '#AE3EC9' },
  egitim:   { ad: 'Eğitim / Kurs',      ikon: 'kitap',   renk: '#FF8A3D' },
  diger:    { ad: 'Diğer',              ikon: 'kutu',    renk: '#7C8798' }
};

// Ana gelirin (harçlık, maaş) dışındaki gelirler: burs, part-time iş, bayram harçlığı…
//   aylik    → ayın belirli günü; tarihi her ay değişiyorsa gun–gunSon aralığı
//   haftalik → haftanın belirli günü
//   tek      → bir kerelik, belirli bir tarihte
const EK_GELIR_TEKRARI = {
  aylik:    { ad: 'Aylık' },
  haftalik: { ad: 'Haftalık' },
  tek:      { ad: 'Bir kez' }
};

// "Gelir ekle" sayfasındaki hazır seçenekler (ad, tekrar)
const EK_GELIR_ONERILERI = {
  lise:       [['Burs', 'aylik'], ['Bayram harçlığı', 'tek'], ['Akraba harçlığı', 'tek'], ['Ek harçlık', 'haftalik']],
  universite: [['KYK bursu', 'aylik'], ['Burs', 'aylik'], ['Part-time iş', 'haftalik'], ['Aile desteği', 'aylik'], ['Bayram harçlığı', 'tek']]
};
function ekGelirOnerileri(profil) {
  return profil.okul === 'universite' ? EK_GELIR_ONERILERI.universite : EK_GELIR_ONERILERI.lise;
}

// Kurulumda tek dokunuşla seçilebilen düzenli ödemeler (tutarlar değiştirilebilir)
const HAZIR_ODEMELER = [
  { anahtar: 'telefon', ad: 'Telefon faturası', kategori: 'iletisim', tutar: 350 },
  { anahtar: 'muzik',   ad: 'Müzik aboneliği',  kategori: 'abonelik', tutar: 60 },
  { anahtar: 'dizi',    ad: 'Dizi / film aboneliği', kategori: 'abonelik', tutar: 150 },
  { anahtar: 'oyun',    ad: 'Oyun aboneliği',   kategori: 'abonelik', tutar: 180 },
  { anahtar: 'kurs',    ad: 'Kurs / dershane',  kategori: 'egitim',   tutar: 1500 },
  { anahtar: 'spor',    ad: 'Spor salonu',      kategori: 'diger',    tutar: 600 }
];

// Öğrencinin okul düzeyi. Araştırmada sonuçları düzeye göre karşılaştırmak için de kaydedilir.
const OKUL_DUZEYLERI = {
  lise:       { ad: 'Lise' },
  universite: { ad: 'Üniversite' }
};

// Ödeme listesi okul düzeyine göre: üniversitelinin yurdu olur
function hazirOdemeler(okul) {
  if (okul === 'universite') return [{ anahtar: 'yurt', ad: 'Yurt / ev payı', kategori: 'kira', tutar: 4000 }, ...HAZIR_ODEMELER];
  return HAZIR_ODEMELER;
}

const HEDEF_EMOJILERI = ['🎧', '📱', '💻', '✈️', '🎮', '👟', '🚲', '🎁', '📚', '🛟'];
const OKUL_HEDEFLERI = {
  lise:       [['🎧', 'Kulaklık', 2500], ['👟', 'Spor ayakkabı', 2500], ['🎁', 'Konser bileti', 1500], ['📱', 'Yeni telefon', 15000]],
  universite: [['💻', 'Laptop', 30000], ['✈️', 'Tatil', 5000], ['🎧', 'Kulaklık', 2500], ['📱', 'Yeni telefon', 15000]]
};
function hedefOnerileri(okul) { return OKUL_HEDEFLERI[okul] || OKUL_HEDEFLERI.lise; }

// "Alsam mı?": bir ürün bekleme listesinde kaç gün bekler
const BEKLEME_GUN = 7;

// Kumbara hedeflerine ayrılan pay, günlük harçlık payının en fazla bu kadarı olmalı (K44).
// Günlük pay, gelirin aylık eşdeğerinin günlere eşit bölünmesidir: hafta sonu harçlık
// gelmeyenlerde de haftanın her gününe düşen pay.
const HEDEF_YUK_SINIRI = 0.40;
const HEDEF_EN_UZUN_AY = 60;

// n ay sonrası; ayın son gününü aşmaz (31 Ocak + 1 ay = 28/29 Şubat)
function tarihAyEkle(d, n) {
  const son = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), son));
}
// Hedefin son tarihine kalan ay; ayların gün farkı (28–31) birkaç günlük tolerans ile yuvarlanır
function kalanAySayisi(bugun, sonTarih) { return Math.max(1, Math.ceil(gunFarki(bugun, sonTarih) / 30.44 - 0.1)); }
// Hedef payı gelirin %40'ını (K44) aşmayacak en kısa süre; diğer hedefler zaten sınırı dolduruyorsa null
function onerilenHedefAyi(kalanTutar, aylikGelirT, digerAylik = 0) {
  if (!(kalanTutar > 0)) return 1;
  const bos = HEDEF_YUK_SINIRI * aylikGelirT - digerAylik;
  return bos > 0 ? Math.min(HEDEF_EN_UZUN_AY, Math.max(1, Math.ceil(kalanTutar / bos))) : null;
}

function kategori(id) { return HARCAMA_KATEGORILERI[id] || HARCAMA_KATEGORILERI.diger; }
function sabitKategori(id) { return SABIT_KATEGORILER[id] || SABIT_KATEGORILER.diger; }

// ---------- Yardımcı fonksiyonlar ----------

const paraBicimi = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
function para(n) { return paraBicimi.format(Math.round(n || 0)); }
// Kuruşu olan tutarı kuruşuyla yazar (₺92,45); tam sayıysa ₺92
function kurusluPara(n) { return '₺' + (n || 0).toLocaleString('tr-TR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }); }
function yuzde(oran) { return '%' + Math.round((oran || 0) * 100); }
function sayi(s) { return Number(String(s ?? '').replace(',', '.')) || 0; }

function iki(n) { return String(n).padStart(2, '0'); }
function tarihStr(d) { return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`; }
function bugunStr() { return tarihStr(new Date()); }
function dunStr() { const d = new Date(); d.setDate(d.getDate() - 1); return tarihStr(d); }
function saatStr(d = new Date()) { return `${iki(d.getHours())}:${iki(d.getMinutes())}`; }
function tarihCoz(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function ayGunSayisi(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
function gunBasi(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function gunEkle(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function gunFarki(a, b) { return Math.round((gunBasi(b) - gunBasi(a)) / 86400000); } // b − a (gün)

function tarihGoster(s, yilIle = false) {
  if (s === bugunStr()) return 'Bugün';
  if (s === dunStr()) return 'Dün';
  if (s === tarihStr(gunEkle(new Date(), 1))) return 'Yarın';
  return tarihCoz(s).toLocaleDateString('tr-TR', yilIle
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { day: 'numeric', month: 'long', weekday: 'long' });
}
function uzunTarih(s) { return tarihCoz(s).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }); }

// [1,2,3,4,5] → "Pzt–Cum", [6,0] → "Hafta sonu"
function gunListesiMetni(gunler) {
  const s = HAFTA_SIRASI.filter(g => (gunler || []).includes(g));
  if (s.length === 7) return 'Her gün';
  if (s.length === 5 && HAFTA_ICI.every(g => s.includes(g))) return 'Hafta içi';
  if (s.length === 2 && s.includes(6) && s.includes(0)) return 'Hafta sonu';
  if (!s.length) return 'Gün seçilmedi';
  const sira = s.map(g => HAFTA_SIRASI.indexOf(g));
  const ardisik = sira.every((x, i) => i === 0 || x === sira[i - 1] + 1);
  if (ardisik && s.length > 2) return `${GUN_KISA[s[0]]}–${GUN_KISA[s[s.length - 1]]}`;
  return s.map(g => GUN_KISA[g]).join(', ');
}

function toplam(dizi) { return dizi.reduce((t, x) => t + (Number(x.tutar) || 0), 0); }
function metinNormal(s) { return String(s ?? '').trim().toLocaleLowerCase('tr'); }

// Aynı gün, aynı tutarda ve aynı kategoride ya da aynı notlu harcamalar: çift kayıt olabilir
function benzerHarcamalar(h, liste) {
  const not = metinNormal(h.aciklama);
  return liste.filter(x => x.id !== h.id && x.tarih === h.tarih && Math.abs(Number(x.tutar) - Number(h.tutar)) < 0.5
    && (x.kategori === h.kategori || (not && metinNormal(x.aciklama) === not)));
}

function yeniId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// Kullanıcının yazdığı metni HTML içine güvenle koymak için
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Profil yardımcıları ----------

function gelirAdi(profil) { return PROFIL.gelirAdi; }

// "Lise öğrencisi", "Üniversite öğrencisi" gibi kısa tanım
function profilEtiketi(profil) {
  const okul = OKUL_DUZEYLERI[profil.okul];
  return okul ? `${okul.ad} öğrencisi` : PROFIL.ad;
}

function buyukHarf(s) { return s.charAt(0).toLocaleUpperCase('tr') + s.slice(1); }

// Oranların (sabit gider / gelir gibi) karşılaştırılabilmesi için aylık eşdeğer gelir
function aylikGelir(profil) {
  const t = Number(profil.gelirTutari) || 0;
  if (profil.gelirDuzeni === 'haftalik') return t * 52 / 12;
  if (profil.gelirDuzeni === 'gunluk') return t * (profil.harclikGunleri || []).length * 52 / 12;
  return t;
}

// Ek gelirlerin aylık eşdeğeri (tek seferlik gelirler düzenli olmadığı için katılmaz)
function aylikEkGelir(ekGelirler) {
  return (ekGelirler || []).reduce((t, e) => t + (e.tekrar === 'aylik' ? Number(e.tutar) || 0
    : e.tekrar === 'haftalik' ? (Number(e.tutar) || 0) * 52 / 12 : 0), 0);
}

// Ana gelir her ay farklı günde mi geliyor? (burs gibi; maasGunu–maasGunuSon aralığı)
function gelirDegiskenMi(profil) {
  return profil.gelirDuzeni === 'aylik' && Number(profil.maasGunuSon) > (profil.maasGunu || 1);
}

function duzenOzeti(profil) {
  const t = para(profil.gelirTutari);
  if (profil.gelirDuzeni === 'haftalik') return `Her ${GUN_ADLARI[profil.harclikGunu].toLocaleLowerCase('tr')} ${t}`;
  if (profil.gelirDuzeni === 'gunluk') return `${gunListesiMetni(profil.harclikGunleri)} günde ${t}`;
  if (gelirDegiskenMi(profil)) return `Ayın ${profil.maasGunu || 1}.–${profil.maasGunuSon}. günleri arası ${t}`;
  return `Her ayın ${profil.maasGunu || 1}. günü ${t}`;
}

function ekGelirOzeti(e) {
  if (e.tekrar === 'tek') return `Bir kez · ${tarihGoster(e.tarih, true)}`;
  if (e.tekrar === 'haftalik') return `Her ${GUN_ADLARI[e.haftaGunu].toLocaleLowerCase('tr')}`;
  return Number(e.gunSon) > e.gun ? `Ayın ${e.gun}.–${e.gunSon}. günleri arası` : `Her ayın ${e.gun}. günü`;
}

function ulasimGunlukMaliyet(u) {
  return u && u.tip === 'binis' ? (Number(u.ucret) || 0) * (u.gidisDonus ? 2 : 1) : 0;
}

function ulasimOzeti(u) {
  if (!u || u.tip === 'yok') return 'Ücret ödemiyorum';
  if (u.tip === 'kart') return `Aylık kart · ${para(u.kartTutar)}`;
  return `${gunListesiMetni(u.gunler)} · günde ${para(ulasimGunlukMaliyet(u))}`;
}

// "Aylık kart" seçildiyse sabit giderlerde karşılığı olsun
function ulasimKartiEsitle(v) {
  v.sabitGiderler = v.sabitGiderler.filter(s => !s.ulasimKarti);
  if (v.ulasim && v.ulasim.tip === 'kart' && Number(v.ulasim.kartTutar) > 0) {
    v.sabitGiderler.unshift({ id: 'ulasim-karti', ad: 'Ulaşım kartı', tutar: Number(v.ulasim.kartTutar), kategori: 'ulasim', ulasimKarti: true });
  }
}

// ---------- Veri saklama ----------

function bosVeri() {
  return {
    surum: VERI_SURUMU,
    profil: null,
    ulasim: { tip: 'yok' },
    sabitGiderler: [], harcamalar: [], hedefler: [],
    planlar: [],          // takvimdeki planlı harcamalar
    tatiller: [],         // kullanıcının izinli/tatil olarak işaretlediği günler
    ulasimAtlanan: [],    // "bugün binmedim" denilen günler
    istekListesi: [],     // "Alsam mı?" bekleme listesi: { ad, tutar, eklenme, durum: bekliyor | alindi | vazgecildi, karar }
    gelirIstisna: {},     // günlük harçlıkta "geldi / gelmedi" işaretleri: { tarih: 'var' | 'yok' }
    ekGelirler: [],       // ana gelir dışındaki gelirler: { id, ad, tutar, tekrar, gun, gunSon, haftaGunu, tarih, bas }
    gelirKayit: {},       // aylık/haftalık gelirlerin "yattı / gelmedi" işaretleri: { 'kaynak|ay ya da gün': tarih | 'yok' }
    borclar: [],          // kredi kartı, taksit, KYK kredisi, kişiler arası borç/alacak (bkz. borc.js)
    birikim: { biriken: 0 },  // ana kumbara (gelirin yüzdesi + limit yuvarlamasından artanlar + elle atılanlar)
    kumbaraHareketleri: [],// elle atılan/çekilen para: { id, tarih, tutar (+ at, − çek), hedefId | null (ana kumbara), cep }; cep: limitten düşer
    aktarimBas: null,    // otomatik kumbara aktarımının başladığı gün; öncesindeki dönemler aktarılmaz
    aktarilanDonemler: [],// kumbaraya aktarılmış dönemlerin başlangıç günleri
    oncekiArtan: null,    // son kapanan dönemde kumbara payının dışında artan para { bas, tutar } (birikimAktar)
    baslangic: null,      // uygulamanın kullanılmaya başlandığı gün
    ilkDonem: null,       // kurulum dönemin ortasında yapıldıysa o andaki bakiye
    seri: null,           // en son görülen seri { bas, gun } (seri.js)
    gunLimitleri: {},     // her günün o gün gösterilen limiti { tarih: limit }; geçmiş günler bununla değerlendirilir
    ayarlar: { mod: 'sistem', dil: null, tur: null, turAtlanma: null, turHatirlatmaKapali: false }
  };
}

// Eski sürümlerle kaydedilmiş verileri yeni biçime dönüştürür; hiçbir kayıt silinmez.
function veriGoc(v) {
  if ((v.surum || 1) < 2) {
    if (v.profil && v.profil.gelirDuzeni === undefined) {
      v.profil = { ad: v.profil.ad, tip: v.profil.tip, gelirDuzeni: 'aylik', gelirTutari: Number(v.profil.gelir) || 0, maasGunu: 1, harclikGunu: 1, harclikGunleri: HAFTA_ICI.slice() };
    }
    if (v.profil && !v.baslangic) {
      const ilk = v.harcamalar.map(h => h.tarih).filter(Boolean).sort()[0];
      v.baslangic = ilk || bugunStr();
    }
    // Mevcut kullanıcılara yeni özellikleri tanıtmak için tur hatırlatması gösterilir
    if (v.profil) Object.assign(v.ayarlar, { tur: 'atlandi', turAtlanma: bugunStr() });
    v.surum = 2;
  }
  // 2.1: Damly yalnızca lise ve üniversite içindir; kullanıcı tipi ve Damla'nın gölü kalktı.
  // İlkokul/ortaokul (ve okulu seçilmemiş öğrenci) liseye, çalışan ve aile üniversiteye taşınır.
  if (v.surum < 3) {
    if (v.profil) {
      const { tip, ...profil } = v.profil;
      if (!OKUL_DUZEYLERI[profil.okul]) profil.okul = tip && tip !== 'ogrenci' ? 'universite' : 'lise';
      v.profil = profil;
    }
    delete v.gol;
    v.surum = 3;
  }
  // 3.1: rank yerine seri; demo verisi uygulamadan çıktı
  if (v.surum < 4) {
    delete v.rank;
    delete v.demo;
    v.surum = 4;
  }
  return v;
}

function veriYukle() {
  try {
    const ham = localStorage.getItem(DEPO_ANAHTARI);
    if (!ham) return bosVeri();
    const kayit = JSON.parse(ham);
    const v = Object.assign(bosVeri(), kayit);
    v.surum = kayit.surum || 1;   // sürüm bilgisi olmayan kayıt, ilk sürümden kalmadır
    v.ayarlar = Object.assign(bosVeri().ayarlar, v.ayarlar);
    delete v.ayarlar.tema;        // renk teması seçimi 1.1'de kaldırıldı
    return veriGoc(v);
  } catch (e) {
    return bosVeri();
  }
}

function veriKaydet(veri) {
  try { localStorage.setItem(DEPO_ANAHTARI, JSON.stringify(veri)); } catch (e) { /* gizli sekme vb. */ }
}
