// ============================================================
// sahneler.js — KURULUM ÇİZİMLERİ
// Her kurulum adımının üstündeki küçük hareketli çizim (tanışma ve özette
// bunun yerine maskot görünür, bkz. maskot.js). Tek renkli
// (marka rengi), arka plansız çizgi çizimler; hepsi currentColor ile
// boyanır. Çizimler kullanıcının seçimine göre değişir; örneğin
// ulaşımda bisiklet, otobüs ya da dolmuş yolda ilerler.
// Animasyonlu öğelerde SVG transform özniteliği kullanılmaz; CSS
// transform'u ezmesin diye konum her zaman bir iç gruba verilir.
// ============================================================

let sahneSayaci = 0;

function svgIkon(ad, x, y, b) {
  return `<svg x="${x}" y="${y}" width="${b}" height="${b}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IKONLAR[ad] || ''}</svg>`;
}

// Damla çizgisi; ölçeklense de çizgi kalınlığı sabit kalır
function damlaYolu(x, y, boyut) {
  return `<path d="${DAMLA_DIS}" transform="translate(${x} ${y}) scale(${boyut / 100})" vector-effect="non-scaling-stroke"/>`;
}

const DOLU = 'fill="currentColor" stroke="none"';

function kurSahnesi(adim, k) {
  const cizimler = {
    duzen: sahneDuzen, tutar: sahneKavanoz, bakiye: sahneKavanoz, ulasim: sahneUlasim, odemeler: sahneOdemeler, kisisel: sahneKisisel,
    // Birikim: kavanoz, seçilen orana göre dolar
    birikim: (k, n) => sahneKavanoz(k, n, 0.15 + Math.min(1, kurulumBirikimYuzdesi(k) / 30) * 0.7)
  };
  const ciz = cizimler[adim];
  if (!ciz) return '';
  const n = ++sahneSayaci;
  return `<div class="kur-sahne" aria-hidden="true">
    <svg viewBox="0 0 320 110" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${ciz(k, n)}</svg>
  </div>`;
}

// ---------- Gelir düzeni: günlere düşen damlalar ----------

function sahneDuzen(k) {
  if (k.gelirDuzeni === 'aylik') {
    return `<circle cx="160" cy="42" r="8" class="ks-halka-dalga"/>
      <g class="ks-takvim">
        <rect x="132" y="42" width="56" height="54" rx="10"/>
        <path d="M132 56h56"/><path d="M146 36v10M174 36v10"/>
        <text x="160" y="85" text-anchor="middle" class="ks-gun-no" ${DOLU}>${maasGunuDuzelt(k.maasGunu)}</text>
      </g>
      <g class="ks-buyuk-dus">${damlaYolu(150, 0, 20)}</g>`;
  }

  const gelenler = k.gelirDuzeni === 'haftalik' ? [Number(k.harclikGunu)] : k.harclikGunleri;
  const gelenSira = HAFTA_SIRASI.filter(g => gelenler.includes(g));
  let ayirSira = 0;
  return HAFTA_SIRASI.map((gun, i) => {
    const x = 52 + i * 36;
    const gelir = gelenler.includes(gun);
    const gecikme = gelir ? gelenSira.indexOf(gun) * 0.25 : gelenSira.length * 0.25 + 0.3 + (ayirSira++) * 0.08;
    return gelir
      ? `<circle cx="${x}" cy="74" r="11"/>
        <circle cx="${x}" cy="74" r="11" class="ks-dolum" style="--g:${gecikme}s" ${DOLU}/>
        <g class="ks-dus" style="--g:${gecikme}s">${damlaYolu(x - 6, 22, 12)}</g>
        <text x="${x}" y="104" text-anchor="middle" class="ks-etiket" ${DOLU}>${GUN_KISA[gun]}</text>`
      : `<circle cx="${x}" cy="74" r="11" stroke-dasharray="3 4" class="ks-soluk"/>
        <circle cx="${x}" cy="74" r="4.5" class="ks-dolum ayir" style="--g:${gecikme}s" ${DOLU}/>
        <text x="${x}" y="104" text-anchor="middle" class="ks-etiket ks-soluk" ${DOLU}>${GUN_KISA[gun]}</text>`;
  }).join('');
}

// ---------- Tutar: dolan kavanoz ----------

function kavanozOrani(v) { return v > 0 ? Math.min(0.9, 0.2 + Math.log10(1 + v) / 5.5) : 0.1; }
function kavanozY(oran) { return 92 - oran * 58; }
function kavanozGuncelle() {
  const s = $('.kur-sahne .ks-seviye');
  if (s) s.style.transform = `translateY(${kavanozY(kavanozOrani(sayi(durum.tus)))}px)`;
}

function sahneKavanoz(k, n, oran = kavanozOrani(sayi(durum.tus))) {
  const dalga = 'M92 0q8-4 16 0' + 't16 0'.repeat(9);
  const arti = (x, y, g) => `<path d="M${x} ${y - 4}v8M${x - 4} ${y}h8" class="ks-parilti" style="--g:${g}s"/>`;
  return `<defs><clipPath id="ksj${n}"><rect x="134" y="30" width="52" height="64" rx="14"/></clipPath></defs>
    ${arti(108, 46, 0)}${arti(214, 36, 0.9)}${arti(222, 80, 1.7)}${arti(100, 82, 2.3)}
    <g class="ks-para"><circle cx="160" cy="0" r="5.5"/></g>
    <rect x="132" y="28" width="56" height="68" rx="16"/>
    <rect x="140" y="18" width="40" height="8" rx="3"/>
    <g clip-path="url(#ksj${n})">
      <g class="ks-seviye" style="transform:translateY(${kavanozY(oran)}px)">
        <g class="ks-dalga-kay"><path d="${dalga}"/></g>
        <g class="ks-dalga-kay yavas ks-soluk"><path d="${dalga}" transform="translate(0 7)"/></g>
        ${[[148, 0], [164, 1.2], [174, 2.1]].map(([x, g]) => `<g class="ks-kabarcik" style="--g:${g}s"><circle cx="${x}" cy="44" r="2.2" stroke-width="1.8"/></g>`).join('')}
      </g>
    </g>`;
}

// ---------- Ulaşım: yolda giden araç ----------

function teker(x, y, r = 8) {
  return `<circle cx="${x}" cy="${y}" r="${r}" class="ks-maske"/>
    <g class="ks-teker"><circle cx="${x}" cy="${y}" r="${r}"/><path d="M${x - r * 0.6} ${y}h${r * 1.2}" stroke-width="2"/></g>`;
}

const ARACLAR = {
  binis: () => `<g class="ks-arac"><g class="ks-sars">
      <path d="M108 86V60q0-12 12-12h58q8 0 13 7l13 17q2 3 2 7v7z" class="ks-maske"/>
      <path d="M108 86V60q0-12 12-12h58q8 0 13 7l13 17q2 3 2 7v7z"/>
      <rect x="118" y="56" width="18" height="13" rx="3"/><rect x="142" y="56" width="18" height="13" rx="3"/>
      <rect x="166" y="56" width="15" height="13" rx="3"/><path d="M187 56h2q4 0 7 4l8 9h-17z"/>
      <path d="M108 77h98"/>
    </g>${teker(132, 88)}${teker(186, 88)}</g>`,
  kart: () => `<g class="ks-arac"><g class="ks-sars">
      <rect x="86" y="44" width="140" height="42" rx="10"/>
      ${[0, 1, 2, 3, 4].map(i => `<rect x="${96 + i * 21}" y="52" width="15" height="13" rx="3"/>`).join('')}
      <rect x="205" y="52" width="13" height="20" rx="3"/><path d="M86 76h140"/>
    </g>
    <g class="ks-rozet"><rect x="147" y="16" width="26" height="17" rx="3"/><path d="M147 22h26M151 28h7" stroke-width="2"/></g>
    ${teker(112, 88)}${teker(200, 88)}</g>`,
  yok: () => `<g class="ks-arac yavas">
      ${teker(132, 84, 12)}${teker(188, 84, 12)}
      <path d="M132 84L148 64L160 84Z"/><path d="M148 64L178 62L188 84"/><path d="M160 84L178 62"/>
      <path d="M178 62l-3-7h8"/><path d="M148 64l-2-5"/><path d="M141 59h10"/>
    </g>`
};

function sahneUlasim(k) {
  const tip = k.ulasim.tip;
  return `<path d="M20 96H300"/>
    <path d="M20 104H300" class="ks-yol-cizgi ${tip === 'yok' ? 'yavas' : ''}" stroke-dasharray="10 16"/>
    <g class="ks-ruzgar"><path d="M50 58h20"/><path d="M38 70h28"/><path d="M56 82h14"/></g>
    ${(ARACLAR[tip] || ARACLAR.yok)()}`;
}

// ---------- Düzenli ödemeler: sikkenin etrafında dönen ödemeler ----------

const ODEME_IKONLARI = {
  telefon: 'telefon', muzik: 'muzik', dizi: 'tv', oyun: 'oyun', kurs: 'kitap', spor: 'kalp',
  kira: 'ev', fatura: 'simsek', internet: 'wifi', okul: 'kitap', yurt: 'ev'
};

function sahneOdemeler(k) {
  let ikonlar = hazirOdemeler(k.tip, k.okul).filter(o => o.anahtar in k.odemeler)
    .map(o => ODEME_IKONLARI[o.anahtar] || sabitKategori(o.kategori).ikon);
  if (!ikonlar.length) ikonlar = ['telefon', 'muzik', 'simsek'];
  ikonlar = ikonlar.slice(0, 6);
  const r = 38;
  return `<circle cx="160" cy="55" r="${r}" stroke-dasharray="2 7" class="ks-soluk"/>
    <g class="ks-yorunge">${ikonlar.map((ik, i) => {
      const a = (i / ikonlar.length) * Math.PI * 2 - Math.PI / 2;
      const x = (160 + r * Math.cos(a)).toFixed(1), y = (55 + r * Math.sin(a)).toFixed(1);
      return `<g transform="translate(${x} ${y})"><g class="ks-dik"><circle r="12" class="ks-maske"/>${svgIkon(ik, -9, -9, 18)}</g></g>`;
    }).join('')}</g>
    <g class="ks-sikke"><circle cx="160" cy="55" r="18"/><text x="160" y="62" text-anchor="middle" class="ks-sikke-tl" ${DOLU}>₺</text></g>`;
}

// ---------- Kişiselleştirme: güneş ya da ay, hedef balonu ----------

function sahneKisisel() {
  const gok = koyuMu(veri.ayarlar.mod)
    ? `<g class="ks-gok"><path d="M104 36a18 18 0 1 0 8 26a14 14 0 1 1-8-26z"/></g>
      ${[[64, 30, 0], [132, 26, 0.8], [70, 78, 1.5], [138, 76, 0.4]].map(([x, y, g]) =>
        `<path d="M${x} ${y - 4}v8M${x - 4} ${y}h8" class="ks-parilti" style="--g:${g}s"/>`).join('')}`
    : `<g class="ks-gok"><circle cx="100" cy="54" r="13"/>
        <g class="ks-isinlar">${Array.from({ length: 8 }, (_, i) => {
          const a = i * Math.PI / 4;
          const p = d => `${(100 + d * Math.cos(a)).toFixed(1)} ${(54 + d * Math.sin(a)).toFixed(1)}`;
          return `<path d="M${p(19)}L${p(26)}"/>`;
        }).join('')}</g></g>`;
  return `${gok}
    <g class="ks-balon-hedef">
      <circle cx="222" cy="44" r="18"/>
      ${svgIkon('hedef', 213, 35, 18)}
      <path d="M218 64l4-2 4 2"/><path d="M222 63q-6 12 2 22t-2 14" stroke-width="1.8"/>
    </g>`;
}

// ---------- Özet: konfeti ----------

function konfeti() {
  return `<div class="ks-konfeti" aria-hidden="true">${Array.from({ length: 22 }, (_, i) => {
    const x = Math.round(Math.sin(i * 2.39) * 170);
    const y = 50 + (i * 37) % 90;
    const r = ((i * 97) % 540) - 270;
    const sekil = ['yuvarlak', 'serit', 'kare'][i % 3];
    return `<i class="${sekil}" style="--x:${x}px;--y:${y}px;--r:${r}deg;--g:${(i % 6) * 40}ms;opacity:${0.55 + (i % 3) * 0.2}"></i>`;
  }).join('')}</div>`;
}
