// ============================================================
// ikonlar.js — Uygulama ikonları (SVG) ve Damly logosu
// Tüm ikonlar 24x24 çizgi ikonlardır; renklerini yazı renginden alır.
// ============================================================

const IKONLAR = {
  ev: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v10.5a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9"/>',
  grafik: '<path d="M21 12a9 9 0 1 1-9-9v9z"/><path d="M15 3.5a9 9 0 0 1 5.5 5.5H15z"/>',
  arti: '<path d="M12 5v14M5 12h14"/>',
  damla: '<path d="M12 2.8s-6.5 7-6.5 11.7a6.5 6.5 0 0 0 13 0C18.5 9.8 12 2.8 12 2.8z"/>',
  yildiz: '<path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/><path d="M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/>',
  kisi: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  geri: '<path d="M15 18l-6-6 6-6"/>',
  ileri: '<path d="M9 18l6-6-6-6"/>',
  asagi: '<path d="M6 9l6 6 6-6"/>',
  yukari: '<path d="M18 15l-6-6-6 6"/>',
  kapat: '<path d="M18 6 6 18M6 6l12 12"/>',
  cop: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/>',
  onay: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  silTus: '<path d="M21 5H9.5L3 12l6.5 7H21z"/><path d="M16.5 9.5l-5 5M11.5 9.5l5 5"/>',
  yemek: '<path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11"/><path d="M17 21V3c-2 1-3.5 3.5-3.5 7 0 2 1 3 3.5 3"/>',
  market: '<circle cx="9" cy="20" r="1.4"/><circle cx="17.5" cy="20" r="1.4"/><path d="M2.5 3.5h2.5l2.4 11.5h11.1l2-8H6.1"/>',
  otobus: '<rect x="4" y="3" width="16" height="14" rx="3"/><path d="M4 10.5h16M7.5 21v-4M16.5 21v-4M8 14h.01M16 14h.01"/>',
  oyun: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4M15.5 12h.01M18 14h.01"/>',
  kitap: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14"/>',
  tisort: '<path d="M8.5 3 3 6l2 5 2.5-1v11h9V10l2.5 1 2-5-5.5-3a3.5 3.5 0 0 1-7 0z"/>',
  kalp: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/>',
  kutu: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  simsek: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',
  telefon: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18h2"/>',
  kart: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6.5 15h4"/>',
  tv: '<rect x="2.5" y="6.5" width="19" height="13" rx="2.5"/><path d="M8 2.5l4 4 4-4"/>',
  hedef: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  kalkan: '<path d="M12 3 4.5 6v6c0 4.6 3.2 7.8 7.5 9 4.3-1.2 7.5-4.4 7.5-9V6z"/>',
  takvim: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  bilgi: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5h.01"/>',
  ayar: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
  alev: '<path d="M12 21.5c3.9 0 6.5-2.6 6.5-6.2 0-2.9-1.7-5.1-3.6-7-.2 1.9-1.1 3.2-2.4 3.2-1.6 0-1.2-3.8-3.4-8-.3 3.9-4.6 6.3-4.6 11.6 0 3.7 3 6.4 7.5 6.4z"/>',
  cuzdan: '<path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4h-12A2.5 2.5 0 0 0 3 6.5v11A2.5 2.5 0 0 0 5.5 20h14a1.5 1.5 0 0 0 1.5-1.5v-10A1.5 1.5 0 0 0 19.5 7h-14A2.5 2.5 0 0 1 3 6.5"/><path d="M16.5 13.5h.01"/>',
  cip: '<rect x="5" y="5" width="14" height="14" rx="2.5"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  liste: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  ampul: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.8 10.6c.8.7 1.3 1.6 1.3 2.4h5c0-.8.5-1.7 1.3-2.4A6 6 0 0 0 12 3z"/>',
  kupa: '<path d="M8 21h8M12 16.5V21M7 3.5h10V9a5 5 0 0 1-10 0z"/><path d="M17 5h3v1.5A3.5 3.5 0 0 1 16.6 10M7 5H4v1.5A3.5 3.5 0 0 0 7.4 10"/>',
  uyari: '<path d="M10.3 3.9 2.4 17.6a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>',
  dur: '<path d="M8 2.5h8l5.5 5.5v8L16 21.5H8L2.5 16V8z"/><path d="M12 8v4.5M12 16h.01"/>',
  ay: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  gunes: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  yukariOk: '<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>',
  asagiOk: '<path d="M12 5v14M5.5 12.5 12 19l6.5-6.5"/>',
  veri: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  kilit: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  dongu: '<path d="M20 11a8 8 0 0 0-14.5-4.5M4 4v3.5h3.5M4 13a8 8 0 0 0 14.5 4.5M20 20v-3.5h-3.5"/>',
  beyin: '<path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2A3 3 0 0 0 6 17.5a3 3 0 0 0 6 .5V5.5a3 3 0 0 0-3-1z"/><path d="M15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2 3 3 0 0 1-2 4.8 3 3 0 0 1-6 .5"/>',
  canta: '<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  mikrofon: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  kamera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2.2h5.6L16.3 7h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.8" r="3.4"/>',
  zil: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 21h4"/>',
  belge: '<path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3.5V8h4.5M9 12.5h6M9 16h6"/>',
  resim: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 15.5 15.5 11 6 19.5"/>',
  kum: '<path d="M7 3h10M7 21h10"/><path d="M8 3v2.5a4 4 0 0 0 1.6 3.2L12 10.5l2.4-1.8A4 4 0 0 0 16 5.5V3M8 21v-2.5a4 4 0 0 1 1.6-3.2L12 13.5l2.4 1.8a4 4 0 0 1 1.6 3.2V21"/>',
  muzik: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.5h.01"/>',
  zincir: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  paylas: '<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/>'
};

function ikon(ad, boyut = 20, sinif = '') {
  return `<svg class="ikon ${sinif}" width="${boyut}" height="${boyut}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IKONLAR[ad] || ''}</svg>`;
}

// ---------- Damly logosu: çizgi damla ve yükselen ok (viewBox 0 0 100 112) ----------

const LOGO_DAMLA = 'M50 6C41 17 15 42 15 67a35 35 0 0 0 70 0C85 42 59 17 50 6z';
const LOGO_OK = 'M24 88L40 72L48 80L66 62M56 60L68 59L67 71';
// Kumbara ekranındaki dolan damla (viewBox 0 0 100 100)
const DAMLA_DIS = 'M50 1.5C42 11 12.5 38 12.5 62.5a37.5 37.5 0 0 0 75 0C87.5 38 58 11 50 1.5z';
let logoSayaci = 0;

// renk: 'marka' (yeşil geçiş) ya da düz bir renk (ör. 'currentColor', '#fff')
function damlaLogo(boyut = 40, sinif = '', renk = 'marka') {
  const n = ++logoSayaci;
  const cizgi = renk === 'marka' ? `url(#dl-${n})` : renk;
  return `<svg class="damla-logo ${sinif}" width="${Math.round(boyut * 0.9)}" height="${boyut}" viewBox="0 0 100 112" fill="none" stroke="${cizgi}" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    ${renk === 'marka' ? `<defs><linearGradient id="dl-${n}" gradientUnits="userSpaceOnUse" x1="15" y1="102" x2="85" y2="6"><stop offset="0" stop-color="#0B7A54"/><stop offset="1" stop-color="#22C79A"/></linearGradient></defs>` : ''}
    <path d="${LOGO_DAMLA}"/><path d="${LOGO_OK}"/>
  </svg>`;
}

// Kumbara ekranındaki "dolan damla": oran 0–1 arası doluluk
function damlaDolum(oran) {
  const n = ++logoSayaci;
  const seviye = 100 - Math.max(0.06, Math.min(1, oran)) * 97;
  return `<svg class="damla-dolum" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <clipPath id="dd-c${n}"><path d="${DAMLA_DIS}"/></clipPath>
      <linearGradient id="dd-g${n}" gradientUnits="userSpaceOnUse" x1="0" y1="-4" x2="0" y2="${Math.max(12, 100 - seviye)}">
        <stop offset="0" style="stop-color:var(--marka-1)"/><stop offset="1" style="stop-color:var(--marka-2)"/>
      </linearGradient>
    </defs>
    <path d="${DAMLA_DIS}" class="dd-zemin"/>
    <g clip-path="url(#dd-c${n})">
      <g transform="translate(0 ${seviye})">
        <path class="dalga dalga-arka" d="M0 2Q12.5-2 25 2T50 2T75 2T100 2T125 2T150 2T175 2T200 2V120H0Z"/>
        <path class="dalga" fill="url(#dd-g${n})" d="M0 0Q12.5-4 25 0T50 0T75 0T100 0T125 0T150 0T175 0T200 0V120H0Z"/>
      </g>
    </g>
  </svg>`;
}
