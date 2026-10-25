// ============================================================
// gol.js — DAMLA'NIN GÖLÜ (oyunlaştırma)
// İlkokul ve ortaokul profilinde açılır. Kullanıcı iyi para alışkanlıkları
// gösterdikçe "damla" toplar; damlalar Damla'nın gölünü büyütür, göle yeni
// canlılar getirir ("Damlaya damlaya göl olur").
//   İlkokul  → renkli sahne, Damla'ya takılan aksesuarlar, kutlamalar
//   Ortaokul → çizgi sahne, seviye ve rozet koleksiyonu
// Ödüllendirilen şey harcamamak değil: limite uymak, kayıt tutmak, plan
// yapmak, biriktirmek ve dürtüyle alınacak şeyden vazgeçmek. İhtiyaç
// harcaması hiçbir zaman damla kaybettirmez. Damlalar kayıtlardan
// hesaplanır ve hiç azalmaz (ulaşılan en yüksek değer veri.gol'de saklanır);
// limit aşılan gün göl yalnızca bulutlanır.
// Animasyonlu öğelerde SVG transform özniteliği kullanılmaz (bkz. sahneler.js).
// ============================================================

const GOL_DUZEYLERI = { ilkokul: 'tam', ortaokul: 'sade' };
function golDuzeyi(profil) {
  return profil && profil.tip === 'ogrenci' ? GOL_DUZEYLERI[profil.okul] || null : null;
}

// Damlaların kaynağı: hangi davranış kaç damla kazandırır
const DAMLA_KAYNAKLARI = [
  { id: 'limit',   ad: 'Limitin içinde kaldığın gün',    puan: 3,  ikon: 'onay',   renk: '#0CA678' },
  { id: 'kayit',   ad: 'Harcamanı yazdığın gün',         puan: 1,  ikon: 'liste',  renk: '#2563EB' },
  { id: 'seri',    ad: '7 gün üst üste limit içinde',    puan: 5,  ikon: 'alev',   renk: '#E8590C' },
  { id: 'kumbara', ad: 'Kumbara hedefinin her %10\'u',   puan: 2,  ikon: 'damla',  renk: '#3CCFBF' },
  { id: 'hedef',   ad: 'Tamamlanan kumbara hedefi',      puan: 10, ikon: 'kupa',   renk: '#F59F00' },
  { id: 'vazgec',  ad: '"Alsam mı?"da vazgeçtiğin şey',  puan: 5,  ikon: 'canta',  renk: '#AE3EC9' },
  { id: 'plan',    ad: 'Önceden planladığın harcama',    puan: 2,  ikon: 'takvim', renk: '#FF8A3D' }
];

// Gölün büyüklüğü (rx, ry: sahnedeki elipsin yarıçapları)
const GOL_ASAMALARI = [
  { id: 'a0', ad: 'Damla',     esik: 0,   rx: 15,  ry: 3 },
  { id: 'a1', ad: 'Birikinti', esik: 15,  rx: 36,  ry: 6,  soz: 'Damlalar birikti, artık bir birikintin var!' },
  { id: 'a2', ad: 'Gölet',     esik: 45,  rx: 60,  ry: 10, soz: 'Birikintin büyüdü, artık bir gölet oldu!' },
  { id: 'a3', ad: 'Göl',       esik: 100, rx: 86,  ry: 14, soz: 'Damlaya damlaya göl oldu!' },
  { id: 'a4', ad: 'Koca göl',  esik: 190, rx: 110, ry: 18, soz: 'Gölün kocaman oldu!' }
];

const GOL_CANLILARI = [
  { id: 'cicek',     ad: 'Çiçekler',  esik: 5,   soz: 'Gölün kıyısında çiçekler açtı!' },
  { id: 'nilufer',   ad: 'Nilüfer',   esik: 25,  soz: 'Suyun üstünde bir nilüfer belirdi.' },
  { id: 'kurbaga',   ad: 'Kurbağa',   esik: 35,  soz: 'Nilüferin üstüne bir kurbağa zıpladı. Vırak!' },
  { id: 'balik',     ad: 'Balık',     esik: 60,  soz: 'Gölünde artık bir balık yüzüyor.' },
  { id: 'agac',      ad: 'Ağaç',      esik: 80,  soz: 'Kıyıda bir ağaç büyüdü.' },
  { id: 'ordek',     ad: 'Ördek',     esik: 115, soz: 'Bir ördek gölüne yerleşti.' },
  { id: 'kayik',     ad: 'Kayık',     esik: 135, soz: 'Gölde küçük bir kayık var artık.' },
  { id: 'kelebek',   ad: 'Kelebek',   esik: 160, soz: 'Çiçeklerin arasında bir kelebek uçuyor.' },
  { id: 'gokkusagi', ad: 'Gökkuşağı', esik: 220, soz: 'Gölünün üstünde gökkuşağı çıktı!' },
  { id: 'kulube',    ad: 'Kulübe',    esik: 260, soz: 'Göl kıyısına bir kulübe kuruldu.' },
  { id: 'kuslar',    ad: 'Kuşlar',    esik: 300, soz: 'Kuşlar gölünü keşfetti.' }
];

// Yalnızca ilkokulda: Damla'ya takılan aksesuarlar (çizimleri maskot.js'te)
const DAMLA_AKSESUARLARI = [
  { id: 'bere',   ad: 'Bere',          esik: 10, soz: 'Damla\'ya yeni bir bere! Takmak ister misin?' },
  { id: 'gozluk', ad: 'Güneş gözlüğü', esik: 30, soz: 'Damla\'ya güneş gözlüğü geldi. Çok havalı!' },
  { id: 'papyon', ad: 'Papyon',        esik: 55, soz: 'Damla\'ya şık bir papyon!' },
  { id: 'tac',    ad: 'Taç',           esik: 90, soz: 'Damla\'ya taç geldi. Damla kraliçesi, damla kralı!' }
];

// Kazanılabilecek her şey, eşik sırasıyla
function golOdulleri(duzey) {
  return [
    ...GOL_ASAMALARI.slice(1).map(x => ({ ...x, tur: 'asama' })),
    ...GOL_CANLILARI.map(x => ({ ...x, tur: 'canli' })),
    ...(duzey === 'tam' ? DAMLA_AKSESUARLARI.map(x => ({ ...x, tur: 'aksesuar' })) : [])
  ].sort((a, b) => a.esik - b.esik);
}

// ---------- Damla hesabı ----------

function damlaSayaci(veri, g) {
  const tk = g.takvim;
  const sayac = { limit: 0, kayit: 0, seri: 0, kumbara: 0, hedef: 0, vazgec: 0, plan: 0 };
  // Geçmiş günler: bugün bitmediği için sayılmaz (en çok 400 gün geriye)
  const bugun = tarihCoz(tk.bugunS);
  let d = tarihCoz(tk.baslangic);
  if (gunFarki(d, bugun) > 400) d = gunEkle(bugun, -400);
  let seri = 0;
  for (; d < bugun; d = gunEkle(d, 1)) {
    const k = tk.gun(tarihStr(d));
    if (k && Math.round(k.serbest) <= Math.round(k.limit)) {
      sayac.limit++;
      if (++seri % 7 === 0) sayac.seri++;
    } else seri = 0;
  }
  // Kayıt tutulan günler bugün dahil: harcamayı yazdığı anda damla kazanır
  new Set(veri.harcamalar.map(h => h.tarih)).forEach(t => { if (t >= tk.baslangic && t <= tk.bugunS) sayac.kayit++; });
  g.hedefler.forEach(h => {
    if (!(h.hedefTutar > 0)) return;
    sayac.kumbara += Math.floor(Math.min(1, h.biriken / h.hedefTutar) * 10 + 1e-9);
    if (h.tamamlandi) sayac.hedef++;
  });
  sayac.vazgec = (veri.istekListesi || []).filter(x => x.durum === 'vazgecildi').length;
  sayac.plan = (veri.planlar || []).filter(p => p.harcamaId && veri.harcamalar.some(h => h.id === p.harcamaId)).length;
  return sayac;
}

function golDurumu(veri, g) {
  const duzey = golDuzeyi(veri.profil);
  if (!duzey) return null;
  const sayac = damlaSayaci(veri, g);
  const kalemler = DAMLA_KAYNAKLARI.map(k => ({ ...k, adet: sayac[k.id], toplam: sayac[k.id] * k.puan }));
  const hesap = kalemler.reduce((t, k) => t + k.toplam, 0);
  const damla = Math.max(hesap, Number((veri.gol || {}).enYuksek) || 0);

  const oduller = golOdulleri(duzey);
  const acik = new Set(oduller.filter(o => o.esik <= damla).map(o => o.id));
  const asama = GOL_ASAMALARI.reduce((s, a, i) => (a.esik <= damla ? i : s), 0);
  const sonraki = oduller.find(o => o.esik > damla) || null;
  const onceki = oduller.filter(o => o.esik <= damla).pop();
  const tabaN = onceki ? onceki.esik : 0;

  // Dün ya da bugün limit aşıldıysa göl bulutlanır; damla kaybedilmez
  const dun = g.takvim.gun(tarihStr(gunEkle(tarihCoz(g.takvim.bugunS), -1)));
  const dunAsti = !!dun && Math.round(dun.serbest) > Math.round(dun.limit);
  const bugunAsti = Math.round(g.bugunKalan) < 0;
  const aksesuar = duzey === 'tam' && veri.gol && acik.has(veri.gol.aksesuar) ? veri.gol.aksesuar : null;

  return {
    duzey, damla, kalemler, oduller, acik, asama, asamaBilgi: GOL_ASAMALARI[asama],
    seviye: acik.size + 1,
    sonraki, kalan: sonraki ? sonraki.esik - damla : 0,
    oran: sonraki ? (damla - tabaN) / (sonraki.esik - tabaN) : 1,
    dunAsti, bugunAsti, bulutlu: dunAsti || bugunAsti, aksesuar,
    bugunKayit: veri.harcamalar.some(h => h.tarih === g.takvim.bugunS)
  };
}

// Kazanılan yeni damlaları ve ödülleri bulur; görülen değeri günceller.
// İlk açılışta (oyun yeni açıldıysa) birikenler sessizce kabul edilir.
function golHaberi(veri, gd) {
  if (!gd) return null;
  const gol = veri.gol || (veri.gol = {});
  if (typeof gol.gorulen !== 'number') {
    gol.gorulen = gol.enYuksek = gd.damla;
    veriKaydet(veri);
    return null;
  }
  if (gd.damla <= gol.gorulen) return null;
  const yeniler = gd.oduller.filter(o => o.esik > gol.gorulen && o.esik <= gd.damla);
  const fark = gd.damla - gol.gorulen;
  gol.gorulen = gol.enYuksek = gd.damla;
  veriKaydet(veri);
  return { fark, yeniler };
}

// ---------- Sahne çizimi ----------
// viewBox 0 0 320 170; göl (200, 138) merkezli. Her çizim (0, 0) etrafında
// çizilir ve sahnede bir dış grupla yerine konur (koleksiyonda da aynı çizim).

const GOL_MERKEZ = { x: 200, y: 138 };

function cicek(x, y, renk, b = 1) {
  const y0 = y - 9 * b;
  const yaprak = [0, 72, 144, 216, 288].map(a => {
    const r = a * Math.PI / 180;
    return `<circle cx="${(x + Math.sin(r) * 3.6 * b).toFixed(1)}" cy="${(y0 - Math.cos(r) * 3.6 * b).toFixed(1)}" r="${(2.9 * b).toFixed(1)}"/>`;
  }).join('');
  return `<path class="g-sap" d="M${x} ${y}V${y0 + 2}"/><g class="g-tac g-cicek-${renk}">${yaprak}</g><circle class="g-merkez" cx="${x}" cy="${y0}" r="${(2 * b).toFixed(1)}"/>`;
}

const GOL_CIZIM = {
  cicek: () => cicek(-9, 6, 1) + cicek(1, 9, 2, 0.85) + cicek(10, 5, 3, 0.9),
  nilufer: () => `<path class="g-yaprak" d="M0 0m-11 0a11 4 0 1 0 22 0a11 4 0 0 0-10-4l-1 4l-1-4a11 4 0 0 0-10 4z"/>
    <g class="g-cicek-1"><path d="M-2 -1q-3-6 2-8q5 2 2 8z"/><path d="M-1 -1q-7-2-6-6q5-1 7 5zM1 -1q7-2 6-6q-5-1-7 5z"/></g>`,
  kurbaga: () => `<g class="g-zipla"><ellipse class="g-kurbaga" cx="0" cy="-8" rx="7" ry="5"/>
    <circle class="g-kurbaga" cx="-3.5" cy="-13" r="2.6"/><circle class="g-kurbaga" cx="3.5" cy="-13" r="2.6"/>
    <circle class="g-goz" cx="-3.5" cy="-13.4" r="1"/><circle class="g-goz" cx="3.5" cy="-13.4" r="1"/>
    <path class="g-ince" d="M-3 -7q3 2 6 0"/></g>`,
  balik: () => `<g class="g-balik-g"><path class="g-balik" d="M-7 0q7-7 14 0q-7 7-14 0zM7 0l6-5v10z"/><circle class="g-goz" cx="-3" cy="-1" r="1"/></g>
    <ellipse class="g-halka" cx="0" cy="4" rx="9" ry="2"/>`,
  agac: () => `<path class="g-govde" d="M-4 0v-24h8v24z"/>
    <circle class="g-agac" cx="0" cy="-38" r="17"/><circle class="g-agac" cx="-12" cy="-28" r="11"/><circle class="g-agac" cx="12" cy="-28" r="11"/>`,
  ordek: () => `<g class="g-yuz"><path class="g-ordek" d="M-11 -4q0 7 10 7h7q6 0 7-8q-5 2-9 1q-1-8-8-8q-7 0-7 8z"/>
    <circle class="g-ordek" cx="-8" cy="-12" r="5"/><path class="g-gaga" d="M-13 -12l-5 1.5l5 1.5z"/><circle class="g-goz" cx="-9" cy="-13" r="1"/>
    <path class="g-ince" d="M-3 -2q4 3 9 0"/></g>`,
  kayik: () => `<g class="g-salin"><path class="g-kayik" d="M-16 -2h32l-6 7h-20z"/><path class="g-ince" d="M0 -2v-17"/><path class="g-yelken" d="M1 -18l10 14h-10z"/></g>`,
  kelebek: () => `<g class="g-kanat"><path class="g-kelebek" d="M0 0q-10-11-11-2q0 5 11 2zM0 0q10-11 11-2q0 5-11 2z"/>
    <path class="g-kelebek-2" d="M0 1q-7 7-8 2q1-3 8-2zM0 1q7 7 8 2q-1-3-8-2z"/></g><path class="g-ince" d="M0-4v7"/>`,
  gokkusagi: () => [['k', 44], ['s', 37], ['m', 30]].map(([r, y]) => `<path class="g-gk-${r}" d="M${-y * 2} 0a${y * 2} ${y * 2} 0 0 1 ${y * 4} 0"/>`).join(''),
  kulube: () => `<path class="g-kulube" d="M-13 0v-15h26v15z"/><path class="g-cati" d="M-17 -14l17-13l17 13z"/><path class="g-kapi" d="M-4 0v-9h8v9z"/>`,
  kuslar: () => `<g class="g-uc"><path class="g-kus" d="M-12 0q4-5 8 0q4-5 8 0"/><path class="g-kus" d="M4 -9q3-4 6 0q3-4 6 0"/></g>`
};

// Gölün kendisi: aşamaya göre büyüklük; ilk aşamada yukarıdan bir damla düşer
function golSu(a) {
  const { x, y } = GOL_MERKEZ;
  return `<ellipse class="g-su" cx="${x}" cy="${y}" rx="${a.rx}" ry="${a.ry}"/>
    <path class="g-su-isik" d="M${x - a.rx * 0.55} ${y - a.ry * 0.25}h${a.rx * 0.32}M${x + a.rx * 0.15} ${y + a.ry * 0.35}h${a.rx * 0.22}"/>
    <ellipse class="g-dalga-halka" cx="${x}" cy="${y}" rx="${a.rx * 0.5}" ry="${a.ry * 0.5}"/>
    ${a.esik === 0 ? `<g class="g-damla-dus"><path class="g-su" d="M${x} ${y - 64}q-5 7-5 10a5 5 0 0 0 10 0q0-3-5-10z"/></g>` : ''}`;
}

function yerlestir(id, x, y) { return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">${GOL_CIZIM[id]()}</g>`; }

function golSahnesi(gd, { buyuk = false } = {}) {
  const a = gd.asamaBilgi, varMi = id => gd.acik.has(id);
  const { x: cx, y: cy } = GOL_MERKEZ;
  const parca = [];
  // Gökyüzü, güneş ya da bulut
  parca.push(`<rect class="g-gok" width="320" height="170"/>`);
  parca.push(`<g class="g-yildizlar">${[[30, 22], [74, 14], [128, 30], [176, 12], [236, 24]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2"/>`).join('')}</g>`);
  if (varMi('gokkusagi')) parca.push(yerlestir('gokkusagi', 200, 112));
  parca.push(gd.bulutlu
    ? `<g class="g-yagmur-g"><path class="g-bulut koyu" d="M246 50a12 12 0 0 1 21-8a15 15 0 0 1 28 5a10 10 0 0 1-3 20h-43a9 9 0 0 1-3-17z"/>
        <g class="g-yagmur">${[256, 268, 280, 292].map((x, i) => `<path d="M${x} 72l-3 7" style="--g:${i * 0.25}s"/>`).join('')}</g></g>`
    : `<g class="g-gunes-g"><g class="g-isin">${[0, 45, 90, 135, 180, 225, 270, 315].map(d => {
        const r = d * Math.PI / 180;
        return `<path d="M${(282 + Math.cos(r) * 18).toFixed(1)} ${(32 + Math.sin(r) * 18).toFixed(1)}L${(282 + Math.cos(r) * 23).toFixed(1)} ${(32 + Math.sin(r) * 23).toFixed(1)}"/>`;
      }).join('')}</g><circle class="g-gunes" cx="282" cy="32" r="12"/><circle class="g-ay-golge" cx="288" cy="27" r="10"/></g>`);
  parca.push(`<g class="g-bulut-kay"><path class="g-bulut" d="M40 40a9 9 0 0 1 16-6a11 11 0 0 1 20 4a7 7 0 0 1-2 14h-32a7 7 0 0 1-2-12z"/></g>`);
  if (varMi('kuslar')) parca.push(yerlestir('kuslar', 150, 40));
  // Arka tepe ve kıyı
  parca.push(`<path class="g-tepe" d="M0 112q60-26 130-8t130-6t60 6V170H0z"/>`);
  if (varMi('agac')) parca.push(yerlestir('agac', 298, 114));
  if (varMi('kulube')) parca.push(yerlestir('kulube', 118, 112));
  parca.push(`<path class="g-cimen" d="M0 118q80-10 160-4t160-2V170H0z"/>`);
  // Göl ve içindekiler
  parca.push(golSu(a));
  if (varMi('kayik')) parca.push(yerlestir('kayik', cx - a.rx * 0.55, cy));
  if (varMi('balik')) parca.push(yerlestir('balik', cx - a.rx * 0.15, cy - 2));
  if (varMi('ordek')) parca.push(yerlestir('ordek', cx + a.rx * 0.12, cy + 1));
  if (varMi('nilufer')) parca.push(yerlestir('nilufer', cx + a.rx * 0.5, cy + 1));
  if (varMi('kurbaga')) parca.push(yerlestir('kurbaga', cx + a.rx * 0.5, cy + 1));
  // Ön plan
  if (varMi('cicek')) parca.push(yerlestir('cicek', 104, 160), yerlestir('cicek', 304, 162));
  if (varMi('kelebek')) parca.push(`<g transform="translate(132 84)"><g class="g-kelebek-uc">${GOL_CIZIM.kelebek()}</g></g>`);

  const ruh = gd.bugunAsti ? 'endiseli' : gd.dunAsti ? 'dusunceli' : buyuk ? 'selam' : 'normal';
  return `<div class="gol-sahne ${gd.duzey === 'tam' ? 'renkli' : 'cizgi'} ${buyuk ? 'buyuk' : ''} ${gd.bulutlu ? 'bulutlu' : ''}" aria-hidden="true">
    <svg viewBox="0 0 320 170" preserveAspectRatio="xMidYMax slice" fill="none" stroke-linecap="round" stroke-linejoin="round">${parca.join('')}</svg>
    <span class="gol-maskot">${maskot({ ruh, boyut: buyuk ? 92 : 64, dolum: Math.min(1, 0.2 + gd.asama * 0.2), aksesuar: gd.aksesuar, zemin: true })}</span>
  </div>`;
}

// Koleksiyon kutusundaki küçük çizim
const GOL_KUTU = {
  cicek: [-16, -16, 32, 28], nilufer: [-14, -12, 28, 18], kurbaga: [-12, -20, 24, 24], balik: [-12, -10, 28, 18],
  agac: [-32, -58, 64, 60], ordek: [-20, -20, 36, 26], kayik: [-19, -22, 38, 30], kelebek: [-13, -12, 26, 18],
  gokkusagi: [-92, -92, 184, 96], kulube: [-19, -30, 38, 32], kuslar: [-14, -14, 32, 18]
};
function odulCizimi(o, duzey) {
  const sinif = `gol-sahne mini ${duzey === 'tam' ? 'renkli' : 'cizgi'}`;
  if (o.tur === 'aksesuar') return `<span class="${sinif}">${maskot({ boyut: 44, dolum: 0.4, aksesuar: o.id, zemin: true })}</span>`;
  if (o.tur === 'asama') {
    const r = Math.min(1, o.rx / 60);
    return `<span class="${sinif}"><svg viewBox="-30 -20 60 36" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path class="g-cimen" d="M-28 -4q28-6 56 0v14q-28 6-56 0z"/>
      <ellipse class="g-su" cx="0" cy="3" rx="${(7 + 18 * r).toFixed(1)}" ry="${(2 + 4 * r).toFixed(1)}"/>
      <path class="g-su-isik" d="M${(-4 - 8 * r).toFixed(1)} ${(2 - r).toFixed(1)}h${(3 + 5 * r).toFixed(1)}"/></svg></span>`;
  }
  const [x, y, w, h] = GOL_KUTU[o.id];
  return `<span class="${sinif}"><svg viewBox="${x} ${y} ${w} ${h}" fill="none" stroke-linecap="round" stroke-linejoin="round">${o.id === 'kurbaga' ? GOL_CIZIM.nilufer() : ''}${GOL_CIZIM[o.id]()}</svg></span>`;
}

// İlkokul kurulumunda Damla'nın gösterdiği örnek göl (kazanılabileceklerin tadımlığı)
function ornekGolDurumu() {
  return { duzey: 'tam', asama: 2, asamaBilgi: GOL_ASAMALARI[2], acik: new Set(['cicek', 'nilufer', 'kurbaga', 'balik']),
    bulutlu: false, bugunAsti: false, dunAsti: false, aksesuar: null };
}

// ---------- Bugün ekranındaki kart ----------

function golKarti(gd) {
  if (!gd) return '';
  const hedefMetni = gd.sonraki
    ? (gd.duzey === 'tam' ? `Sürprize <b>${gd.kalan}</b> damla kaldı` : `Sıradaki rozet: <b>${gd.sonraki.ad}</b> · ${gd.kalan} damla`)
    : 'Bütün ödülleri topladın!';
  if (gd.duzey === 'tam') {
    return `<button class="gol-kart" data-eylem="alt" data-ekran="gol" aria-label="Damla'nın gölü">
      ${golSahnesi(gd)}
      <span class="gol-kart-alt">
        <span class="gol-damla">${ikon('damla', 18)}<b>${gd.damla}</b></span>
        <span class="satir-orta"><small>${hedefMetni}</small><span class="ince-cubuk"><i style="width:${(gd.oran * 100).toFixed(0)}%"></i></span></span>
        ${ikon('ileri', 18, 'grup-ok')}
      </span>
    </button>`;
  }
  return `<button class="gol-ozet" data-eylem="alt" data-ekran="gol" aria-label="Göl ve rozetler">
    <span class="gol-seviye"><small>Seviye</small><b>${gd.seviye}</b></span>
    <span class="satir-orta">
      <b>${gd.asamaBilgi.ad} · ${gd.damla} damla</b>
      <small>${hedefMetni}</small>
      <span class="ince-cubuk"><i style="width:${(gd.oran * 100).toFixed(0)}%"></i></span>
    </span>
    ${ikon('ileri', 18, 'grup-ok')}
  </button>`;
}

// ---------- Göl ekranı ----------

function golSozu(gd, g) {
  const tam = gd.duzey === 'tam';
  if (gd.bugunAsti) return tam ? 'Bugün limit aşıldı, gölüm bulutlandı. Sorun değil! Damlaların hiç azalmaz, yarın yeniden deneriz.'
    : 'Bugün limit aşıldı. Damla kaybetmedin; yarın limit içinde kalırsan güneş yeniden açar.';
  if (gd.dunAsti) return tam ? 'Dün limit biraz aşıldı, o yüzden bulut var. Bugün limitin içinde kalırsan güneş yeniden açar!'
    : 'Dün limit aşıldı, göl bulutlu. Bugün limit içinde kalırsan bulut dağılır.';
  if (!gd.sonraki) return tam ? 'Gölüm tamamlandı! Sen gerçek bir damla ustasısın.' : 'Bütün rozetleri topladın. Tebrikler!';
  const yarin = g.bugunKalan >= 0 ? ` Bugün limitinin içinde kalırsan yarın ${DAMLA_KAYNAKLARI[0].puan} damla daha gelir.` : '';
  return tam ? `${gd.kalan} damla daha toplarsan göle bir sürpriz gelecek!${yarin}` : `${gd.sonraki.ad} rozetine ${gd.kalan} damla kaldı.${yarin}`;
}

function golCiz(g) {
  const gd = durum.gol;
  if (!gd) return baslik('Göl', { geri: true }) + bosDurum('Göl yok', 'Damla\'nın gölü ilkokul ve ortaokul profilinde açılır.');
  const tam = gd.duzey === 'tam';
  const sonrakiAd = gd.sonraki ? (tam && gd.sonraki.tur !== 'asama' ? 'Sürpriz' : gd.sonraki.ad) : '';

  const koleksiyon = gd.oduller.filter(o => o.tur !== 'aksesuar').map(o => {
    const varMi = gd.acik.has(o.id);
    return `<div class="gol-kutu ${varMi ? 'acik' : 'kilitli'}">
      ${varMi ? odulCizimi(o, gd.duzey) : `<span class="gol-kilit">${ikon('kilit', 18)}</span>`}
      <b>${varMi || !tam ? o.ad : '???'}</b><small>${varMi ? 'Kazanıldı' : `${o.esik} damla`}</small>
    </div>`;
  }).join('');

  const aksesuarlar = tam ? `<div class="bolum-bas"><h2>Damla'yı giydir</h2><span>Dokun, tak ya da çıkar</span></div>
    <div class="gol-aksesuarlar">${DAMLA_AKSESUARLARI.map(x => {
      const varMi = gd.acik.has(x.id), takili = gd.aksesuar === x.id;
      return `<button class="gol-kutu ${varMi ? 'acik' : 'kilitli'} ${takili ? 'takili' : ''}" ${varMi ? `data-eylem="gol-aksesuar" data-id="${x.id}"` : 'disabled'} aria-pressed="${takili}">
        ${varMi ? odulCizimi({ ...x, tur: 'aksesuar' }, gd.duzey) : `<span class="gol-kilit">${ikon('kilit', 18)}</span>`}
        <b>${x.ad}</b><small>${takili ? 'Takılı' : varMi ? 'Tak' : `${x.esik} damla`}</small>
      </button>`;
    }).join('')}</div>` : '';

  const kalemler = gd.kalemler.map(k => `<div class="gol-kalem ${k.adet ? '' : 'bos'}">
    <span class="kat-ikon kucuk" style="--renk:${k.renk}">${ikon(k.ikon, 16)}</span>
    <span class="satir-orta"><b>${k.ad}</b><small>Her biri +${k.puan} damla${k.adet ? ` · ${k.adet} kez` : ''}</small></span>
    <span class="grup-deger">+${k.toplam}</span>
  </div>`).join('');

  return `
  ${baslik(tam ? 'Damla\'nın gölü' : 'Göl ve rozetler', { geri: true, ust: 'Damlaya damlaya göl olur' })}
  <section class="gol-buyuk-kap">
    ${golSahnesi(gd, { buyuk: true })}
    <div class="konusma gol-konusma">${golSozu(gd, g)}</div>
  </section>

  <div class="gol-sayilar">
    <div><small>Damla</small><b>${ikon('damla', 16)}${gd.damla}</b></div>
    <div><small>${tam ? 'Gölün' : 'Seviye'}</small><b>${tam ? gd.asamaBilgi.ad : gd.seviye}</b></div>
    <div><small>Limit serisi</small><b>${ikon('alev', 16)}${g.seri} gün</b></div>
  </div>

  ${gd.sonraki ? `<section class="kart gol-sonraki">
    <div class="kart-bas"><h2>${tam ? 'Sıradaki sürpriz' : 'Sıradaki rozet'}</h2><span class="kart-ek">${gd.damla} / ${gd.sonraki.esik}</span></div>
    ${ilerleme(gd.oran)}
    <span class="kart-etiket">${sonrakiAd ? `${sonrakiAd}: ` : ''}${gd.kalan} damla kaldı</span>
  </section>` : ''}

  ${aksesuarlar}

  <div class="bolum-bas"><h2>${tam ? 'Gölümdekiler' : 'Rozetler'}</h2><span>${[...gd.acik].filter(id => !DAMLA_AKSESUARLARI.some(x => x.id === id)).length} / ${gd.oduller.filter(o => o.tur !== 'aksesuar').length}</span></div>
  <div class="gol-koleksiyon">${koleksiyon}</div>

  <div class="bolum-bas"><h2>Damlalar nereden geldi?</h2><span>${gd.damla} damla</span></div>
  <section class="kart gol-kalemler">${kalemler}</section>

  <div class="bilgi-serit">${ikon('bilgi', 18)}<span>Damlalar <b>hiç azalmaz</b>. Limit aşılırsa göl bir gün bulutlanır, sonra yine güneş açar. İhtiyacın olan şeyi almak (yemek, okul, ulaşım) asla damla kaybettirmez.</span></div>`;
}

// ---------- Yeni ödül kutlaması (ilkokul) ----------

const GOL_SHEETLERI = {
  golYeni() {
    const gd = durum.gol, yeniler = durum.golKutlama || [];
    const ilk = yeniler[yeniler.length - 1];
    if (!gd || !ilk) return '';
    return `<div class="gol-kutlama">
      ${konfeti()}
      <span class="gol-yeni-etiket">${ikon('yildiz', 14)} Yeni!</span>
      <div class="gol-yeni-cizim">${odulCizimi(ilk, gd.duzey)}</div>
      <h2>${ilk.ad}</h2>
      <p>${ilk.soz}</p>
      ${yeniler.length > 1 ? `<small>ve ${yeniler.slice(0, -1).map(o => o.ad).join(', ')}</small>` : ''}
      <div class="gol-kutlama-dugmeler">
        ${ilk.tur === 'aksesuar' ? `<button class="dugme ana" data-eylem="gol-aksesuar" data-id="${ilk.id}" data-kapat="1">Damla'ya tak</button>` : ''}
        <button class="dugme ${ilk.tur === 'aksesuar' ? 'hafif' : 'ana'}" data-eylem="gol-git">Göle git</button>
      </div>
    </div>`;
  }
};

// Haberi gösterir: damla bildirimi, ilkokulda yeni ödülde kutlama sayfası
function golHaberiGoster(haber, gd) {
  if (!haber) return;
  setTimeout(() => bildirim(`+${haber.fark} damla kazandın`, 'damla'), 700);
  if (!haber.yeniler.length) return;
  if (gd.duzey !== 'tam') {
    setTimeout(() => haber.yeniler.forEach(o => bildirim(`Yeni rozet: ${o.ad}`, 'damla')), 1500);
    return;
  }
  durum.golKutlama = haber.yeniler;
  const dene = (n = 0) => {
    if (durum.sheet || durum.tur) { if (n < 20) setTimeout(() => dene(n + 1), 800); return; }
    sheetAc('golYeni');
  };
  setTimeout(dene, 1300);
}

function golEylemi(eylem, el) {
  if (eylem === 'gol-aksesuar') {
    const id = el.dataset.id;
    veri.gol = veri.gol || {};
    veri.gol.aksesuar = veri.gol.aksesuar === id && !el.dataset.kapat ? null : id;
    if (el.dataset.kapat) sheetKapat();
    kaydetVeCiz(veri.gol.aksesuar ? `Damla ${DAMLA_AKSESUARLARI.find(x => x.id === id).ad.toLocaleLowerCase('tr')} taktı` : 'Aksesuar çıkarıldı');
    maskotZiplat($('.gol-sahne.buyuk .maskot'));
    return true;
  }
  if (eylem === 'gol-git') {
    sheetKapat();
    if (aktifEkran() !== 'gol') { durum.yigin.push('gol'); durum.gecis = 'ileri'; ciz(); }
    return true;
  }
  return false;
}
