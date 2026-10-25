// ============================================================
// maskot.js — ASİSTANIN MASKOTU
// Logodaki damladan çıkan küçük karakter. Tek renkli (currentColor),
// arka plansız çizgi çizim. Yüz ifadesi asistanın en önemli önerisinin
// düzeyinden gelir; içindeki su seviyesi kumbara hedeflerinin ne kadar
// dolduğunu gösterir ("Damlaya damlaya göl olur").
// Maskot yalnızca arayüzdür: kararları kural motoru verir.
// Animasyonlu öğelerde SVG transform özniteliği kullanılmaz (bkz. sahneler.js).
// ============================================================

let maskotSayaci = 0;

// Öneri düzeyi → yüz ifadesi
const SEVIYE_RUH = { kritik: 'telasli', uyari: 'endiseli', oneri: 'dusunceli', tebrik: 'mutlu' };

const MS_GOZLER = `<g class="ms-goz"><circle cx="39" cy="60" r="3.8" ${DOLU}/><circle cx="61" cy="60" r="3.8" ${DOLU}/></g>`;

const MASKOT_YUZ = {
  normal:    `${MS_GOZLER}<path d="M42 71q8 7 16 0"/>`,
  selam:     `${MS_GOZLER}<path d="M41 70q9 9 18 0"/>`,
  mutlu:     `<path d="M34 61q5-6 10 0M56 61q5-6 10 0"/><path d="M40 70q10 11 20 0"/>`,
  dusunceli: `${MS_GOZLER}<path d="M55 50q6-4 12-1"/><path d="M44 74q6 2 12-2"/>`,
  endiseli:  `${MS_GOZLER}<path d="M33 54L44 50M67 54L56 50"/><path d="M42 75q4-3 8 0t8 0"/>`,
  telasli:   `<g class="ms-goz"><circle cx="39" cy="60" r="6"/><circle cx="61" cy="60" r="6"/><circle cx="39" cy="61" r="2.4" ${DOLU}/><circle cx="61" cy="61" r="2.4" ${DOLU}/></g><circle cx="50" cy="76" r="3.5"/>`,
  uykulu:    `<path d="M34 61q5 4 10 0M56 61q5 4 10 0"/><path d="M47 74h6"/>`
};

const msParilti = (x, y, g) => `<path d="M${x} ${y - 5}v10M${x - 5} ${y}h10" class="ms-parilti" style="--g:${g}s"/>`;

// Gövdenin dışında, ifadeye eşlik eden küçük işaretler
const MASKOT_EK = {
  selam:     `<g class="ms-el"><path d="M86 68l13-15"/></g><g class="ms-selam"><path d="M104 44q5 4 4 10"/><path d="M111 37q8 7 6 18"/></g>`,
  mutlu:     msParilti(4, 30, 0) + msParilti(98, 22, 0.7) + msParilti(104, 60, 1.4),
  dusunceli: `<g class="ms-ampul">${svgIkon('ampul', 80, -8, 26)}</g>`,
  telasli:   `<g class="ms-ter"><path d="M88 26q-5 7-5 10a5 5 0 0 0 10 0q0-3-5-10z"/></g>`,
  uykulu:    `<g class="ms-z" ${DOLU}><text x="86" y="30">z</text><text x="98" y="14">z</text></g>`
};

// Damla'nın gölünde (gol.js) kazanılan aksesuarlar; renkleri CSS'te (.ms-aks)
const MASKOT_AKSESUAR = {
  bere:   `<g class="ms-aks bere"><path d="M30 29C30 7 70 7 70 29z"/><path d="M29 29h42" class="ms-aks-kenar"/><circle cx="50" cy="6" r="5.5" class="ms-aks-ponpon"/></g>`,
  gozluk: `<g class="ms-aks gozluk"><rect x="28" y="52" width="20" height="14" rx="6"/><rect x="52" y="52" width="20" height="14" rx="6"/><path d="M48 57h4M28 57l-6-2M72 57l6-2" class="ms-aks-kenar"/><path d="M32 56l4-2M56 56l4-2" class="ms-aks-isik"/></g>`,
  papyon: `<g class="ms-aks papyon"><path d="M50 90L37 83v14zM50 90l13-7v14z"/><circle cx="50" cy="90" r="3.4" class="ms-aks-dugum"/></g>`,
  tac:    `<g class="ms-aks tac"><path d="M33 27l2-17l8 8l7-17l7 17l8-8l2 17z"/><circle cx="50" cy="20" r="2.4" class="ms-aks-tas"/></g>`
};

// Kumbara hedeflerinin toplam doluluğu (0–1). Hedef yoksa damla neredeyse boştur.
function maskotDolum(g) {
  const hedefler = g.hedefler.filter(h => h.hedefTutar > 0);
  const hedef = hedefler.reduce((t, h) => t + h.hedefTutar, 0);
  return hedef ? hedefler.reduce((t, h) => t + Math.min(h.biriken, h.hedefTutar), 0) / hedef : 0;
}

// zemin: maskotun içi dolu görünsün (renkli sahnenin önünde, bkz. gol.js)
function maskot({ ruh = 'normal', boyut = 56, dolum = 0.3, sinif = '', aksesuar = null, zemin = false } = {}) {
  const n = ++maskotSayaci;
  const su = 100 - Math.max(0.08, Math.min(1, dolum)) * 84;   // su yüzeyinin yüksekliği
  const dalga = 'M-50 0q12.5-4 25 0' + 't25 0'.repeat(7) + 'V112H-50Z';
  return `<svg class="maskot ${ruh} ${sinif}" width="${boyut}" height="${boyut}" viewBox="-14 -12 128 124" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <defs><clipPath id="ms-c${n}"><path d="${DAMLA_DIS}"/></clipPath></defs>
    <path d="M36 108h28" class="ms-golge"/>
    <g class="ms-govde">
      ${zemin ? `<path d="${DAMLA_DIS}" class="ms-zemin"/>` : ''}
      <g clip-path="url(#ms-c${n})">
        <g class="ms-su" style="transform:translateY(${su.toFixed(1)}px)"><g class="ms-dalga"><path d="${dalga}"/></g></g>
      </g>
      <path d="${DAMLA_DIS}"/>
      <path d="M26 46q4-10 12-17" class="ms-parlak"/>
      <g class="ms-yuz">${MASKOT_YUZ[ruh] || MASKOT_YUZ.normal}</g>
      ${MASKOT_EK[ruh] || ''}
      ${MASKOT_AKSESUAR[aksesuar] || ''}
    </g>
  </svg>`;
}

// Seçim yapılınca maskot küçük bir zıplamayla tepki verir
function maskotZiplat(el) {
  if (!el) return;
  el.classList.remove('zipla');
  void el.getBoundingClientRect();
  el.classList.add('zipla');
}
