// ============================================================
// maskot.js — ASİSTANIN İŞARETİ
// Logodaki çizgi damla ve yükselen ok. İçindeki su seviyesi kumbara
// hedeflerinin ne kadar dolduğunu gösterir ("Damlaya damlaya göl olur").
// Yüzü yoktur; asistanın önerisinin düzeyini yalnızca hareketiyle
// gösterir (tebrikte zıplar, uyarıda sallanır, kritik durumda titrer).
// Maskot yalnızca arayüzdür: kararları kural motoru verir.
// Animasyonlu öğelerde SVG transform özniteliği kullanılmaz (bkz. sahneler.js).
// ============================================================

let maskotSayaci = 0;

// Öneri düzeyi → hareket (CSS sınıfı)
const SEVIYE_RUH = { kritik: 'telasli', uyari: 'endiseli', oneri: 'dusunceli', tebrik: 'mutlu' };

// Kumbara hedeflerinin toplam doluluğu (0–1). Hedef yoksa damla neredeyse boştur.
function maskotDolum(g) {
  const hedefler = g.hedefler.filter(h => h.hedefTutar > 0);
  const hedef = hedefler.reduce((t, h) => t + h.hedefTutar, 0);
  return hedef ? hedefler.reduce((t, h) => t + Math.min(h.biriken, h.hedefTutar), 0) / hedef : 0;
}

function maskot({ ruh = 'normal', boyut = 56, dolum = 0.3, sinif = '' } = {}) {
  const n = ++maskotSayaci;
  const su = 108 - Math.max(0.08, Math.min(1, dolum)) * 96;   // su yüzeyinin yüksekliği
  const dalga = 'M-50 0q12.5-4 25 0' + 't25 0'.repeat(7) + 'V112H-50Z';
  return `<svg class="maskot ${ruh} ${sinif}" width="${Math.round(boyut * 0.9)}" height="${boyut}" viewBox="0 0 100 112" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <defs><clipPath id="ms-c${n}"><path d="${LOGO_DAMLA}"/></clipPath></defs>
    <g class="ms-govde">
      <g clip-path="url(#ms-c${n})">
        <g class="ms-su" style="transform:translateY(${su.toFixed(1)}px)"><g class="ms-dalga"><path d="${dalga}"/></g></g>
      </g>
      <path d="${LOGO_DAMLA}" class="ms-cizgi"/>
      <path d="${LOGO_OK}" class="ms-cizgi"/>
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
