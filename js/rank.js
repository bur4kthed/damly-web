// ============================================================
// rank.js — RANK (oyunlaştırma)
// Kullanıcı iyi para alışkanlıkları gösterdikçe puan toplar; puan
// Bronz'dan Elmas'a rank atlatır. Bugün ekranında yalnızca şu anki
// rankın rozeti ve o rankın ilerleme çizgisi görünür; çizgi dolunca
// bir sonraki ranka geçilir ve kutlama sayfası açılır (paylaşılabilir).
// Ödüllendirilen şey harcamamak değil: limite uymak, kayıt tutmak, plan
// yapmak, biriktirmek ve dürtüyle alınacak şeyden vazgeçmek. Puan
// kayıtlardan hesaplanır ve hiç azalmaz (ulaşılan en yüksek değer
// veri.rank'ta saklanır). Limit aşılan gün puan kaybettirmez; yalnızca
// o gün puan gelmez. Böylece harcamayı yazmamak için bir neden olmaz.
// ============================================================

const RANKLAR = [
  { id: 'bronz',  ad: 'Bronz',  e: "Bronz'a",  esik: 0,   renk: ['#F0B98A', '#A2602F'], cizgi: '#6B3B17' },
  { id: 'demir',  ad: 'Demir',  e: "Demir'e",  esik: 25,  renk: ['#B9BEC6', '#5F656E'], cizgi: '#3D424A' },
  { id: 'gumus',  ad: 'Gümüş',  e: "Gümüş'e",  esik: 70,  renk: ['#F4F7FB', '#8E9BB0'], cizgi: '#4E5A70' },
  { id: 'altin',  ad: 'Altın',  e: "Altın'a",  esik: 140, renk: ['#FFE69A', '#D59A12'], cizgi: '#7A5300' },
  { id: 'platin', ad: 'Platin', e: "Platin'e", esik: 240, renk: ['#DDF7F4', '#5FB3AC'], cizgi: '#21625D' },
  { id: 'elmas',  ad: 'Elmas',  e: "Elmas'a",  esik: 380, renk: ['#D6ECFF', '#4F86F0'], cizgi: '#1D3F8F' }
];

// Puanın kaynağı: hangi davranış kaç puan kazandırır
const PUAN_KAYNAKLARI = [
  { id: 'limit',   ad: 'Limitin içinde kaldığın gün',    puan: 3,  ikon: 'onay',   renk: '#0CA678' },
  { id: 'kayit',   ad: 'Harcamanı yazdığın gün',         puan: 1,  ikon: 'liste',  renk: '#2563EB' },
  { id: 'seri',    ad: '7 gün üst üste limit içinde',    puan: 5,  ikon: 'alev',   renk: '#E8590C' },
  { id: 'kumbara', ad: 'Kumbara hedefinin her %10\'u',   puan: 2,  ikon: 'damla',  renk: '#0B7A54' },
  { id: 'hedef',   ad: 'Tamamlanan kumbara hedefi',      puan: 10, ikon: 'kupa',   renk: '#F59F00' },
  { id: 'vazgec',  ad: '"Alsam mı?"da vazgeçtiğin şey',  puan: 5,  ikon: 'canta',  renk: '#AE3EC9' },
  { id: 'plan',    ad: 'Önceden planladığın harcama',    puan: 2,  ikon: 'takvim', renk: '#FF8A3D' }
];

// ---------- Puan hesabı ----------

function puanSayaci(veri, g) {
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
  // Kayıt tutulan günler bugün dahil: harcamayı yazdığı anda puan kazanır
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

function rankSirasi(puan) { return RANKLAR.reduce((s, r, i) => (r.esik <= puan ? i : s), 0); }

function rankDurumu(veri, g) {
  const sayac = puanSayaci(veri, g);
  const kalemler = PUAN_KAYNAKLARI.map(k => ({ ...k, adet: sayac[k.id], toplam: sayac[k.id] * k.puan }));
  const hesap = kalemler.reduce((t, k) => t + k.toplam, 0);
  const puan = Math.max(hesap, Number((veri.rank || {}).enYuksek) || 0);
  const sira = rankSirasi(puan);
  const rank = RANKLAR[sira], sonraki = RANKLAR[sira + 1] || null;
  return {
    puan, kalemler, sira, rank, sonraki,
    kalan: sonraki ? sonraki.esik - puan : 0,
    oran: sonraki ? (puan - rank.esik) / (sonraki.esik - rank.esik) : 1,
    bugunKayit: veri.harcamalar.some(h => h.tarih === g.takvim.bugunS)
  };
}

// Kazanılan yeni puanları ve rank atlamasını bulur; görülen değeri günceller.
// İlk açılışta (rank yeni geldiyse) birikenler sessizce kabul edilir.
function rankHaberi(veri, rd) {
  const r = veri.rank || (veri.rank = {});
  if (typeof r.gorulen !== 'number') {
    r.gorulen = r.enYuksek = rd.puan;
    veriKaydet(veri);
    return null;
  }
  if (rd.puan <= r.gorulen) return null;
  const eskiSira = rankSirasi(r.gorulen);
  const fark = rd.puan - r.gorulen;
  r.gorulen = r.enYuksek = rd.puan;
  veriKaydet(veri);
  return { fark, yeniRank: rd.sira > eskiSira ? rd.rank : null };
}

// ---------- Çizimler ----------

let rozetSayaci = 0;
// Logodaki damla, rankın metal renginde
function rankRozeti(rank, boyut = 48, sinif = '') {
  const n = ++rozetSayaci;
  return `<svg class="rank-rozet ${sinif}" width="${boyut}" height="${Math.round(boyut * 1.12)}" viewBox="0 0 100 112" role="img" aria-label="${rank.ad} rankı">
    <defs><linearGradient id="rr-${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${rank.renk[0]}"/><stop offset="1" stop-color="${rank.renk[1]}"/></linearGradient></defs>
    <path d="${LOGO_DAMLA}" fill="url(#rr-${n})" stroke="${rank.cizgi}" stroke-width="4.5"/>
    <path d="M26 46q4-11 13-19" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>
    <path d="${LOGO_OK}" fill="none" stroke="${rank.cizgi}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

// Bugün ekranındaki kart: solda rozet, yanda yalnızca bu rankın ilerleme çizgisi
function rankKarti(rd, g) {
  const ipucu = !rd.sonraki ? `En yüksek ranktasın. Toplam ${rd.puan} puan.`
    : g.bugunKalan >= 0 ? `Bugün limitinin içinde kalırsan yarın +${PUAN_KAYNAKLARI[0].puan}.`
    : `Yarın limitinin içinde kalırsan +${PUAN_KAYNAKLARI[0].puan}.`;
  return `<button class="rank-kart" data-eylem="alt" data-ekran="rank" aria-label="${rd.rank.ad} rankı, ${rd.puan} puan">
    ${rankRozeti(rd.rank, 52)}
    <span class="rank-orta">
      <span class="rank-ust"><b>${rd.rank.ad}</b><small>${rd.sonraki ? `${rd.sonraki.e} ${rd.kalan} puan` : `${rd.puan} puan`}</small></span>
      <span class="rank-cubuk" style="--r1:${rd.rank.renk[0]};--r2:${rd.rank.renk[1]}"><i style="transform:scaleX(${Math.max(0.03, rd.oran).toFixed(3)})"></i></span>
      <small class="rank-ipucu">${ipucu}</small>
    </span>
  </button>`;
}

function rankCiz(g) {
  const rd = durum.rank;
  const merdiven = RANKLAR.map((r, i) => {
    const acik = i <= rd.sira;
    return `<div class="rank-basamak ${acik ? 'acik' : 'kilitli'} ${i === rd.sira ? 'simdi' : ''}">
      ${rankRozeti(r, 40)}
      <span class="satir-orta"><b>${r.ad}</b><small>${r.esik} puan</small></span>
      ${i === rd.sira ? '<span class="cip">Şu an</span>' : acik ? ikon('onay', 18) : ikon('kilit', 18)}
    </div>`;
  }).reverse().join('');
  const kalemler = rd.kalemler.map(k => `<div class="rank-kalem ${k.adet ? '' : 'bos'}">
    <span class="kat-ikon kucuk" style="--renk:${k.renk}">${ikon(k.ikon, 16)}</span>
    <span class="satir-orta"><b>${k.ad}</b><small>${k.adet} × ${k.puan} puan</small></span>
    <span class="grup-deger">+${k.toplam}</span>
  </div>`).join('');
  return `
  ${baslik('Rank', { geri: true })}
  <section class="rank-buyuk">
    ${rankRozeti(rd.rank, 104)}
    <h2>${rd.rank.ad}</h2>
    <p>${rd.puan} puan${rd.sonraki ? `. ${rd.sonraki.e} ${rd.kalan} puan kaldı.` : '. En yüksek ranktasın.'}</p>
    <span class="rank-cubuk genis" style="--r1:${rd.rank.renk[0]};--r2:${rd.rank.renk[1]}"><i style="transform:scaleX(${Math.max(0.03, rd.oran).toFixed(3)})"></i></span>
  </section>
  <div class="bolum-bas"><h2>Puanların nereden geldi?</h2><span>${rd.puan} puan</span></div>
  <section class="kart rank-kalemler">${kalemler}</section>
  <div class="bolum-bas"><h2>Ranklar</h2></div>
  <section class="kart rank-merdiven">${merdiven}</section>
  <div class="bilgi-serit">${ikon('bilgi', 18)}<span>Puan <b>hiç azalmaz</b>. Limitini aştığın gün yalnızca o günün puanı gelmez. Harcamanı yazmak her zaman puan kazandırır.</span></div>`;
}

// ---------- Rank atlama kutlaması ve paylaşma ----------

const RANK_SHEETLERI = {
  rankYeni() {
    const rd = durum.rank, r = durum.rankKutlama;
    if (!rd || !r) return '';
    return `<div class="rank-kutlama">
      ${konfeti()}
      <div class="rank-kutlama-rozet">${rankRozeti(r, 128)}</div>
      <h2>${r.e} çıktın!</h2>
      <p>${rd.puan} puana ulaştın.${rd.sonraki ? ` ${rd.sonraki.ad} için ${rd.kalan} puan daha.` : ' Bu en yüksek rank.'}</p>
      <div class="rank-kutlama-dugmeler">
        <button class="dugme ana" data-eylem="rank-paylas">${ikon('paylas', 18)} Paylaş</button>
        <button class="dugme hafif" data-eylem="sheet-kapat">Devam</button>
      </div>
    </div>`;
  }
};

// Haberi gösterir: puan bildirimi, rank atlanınca kutlama sayfası
function rankHaberiGoster(haber) {
  if (!haber) return;
  setTimeout(() => bildirim(`+${haber.fark} puan`, 'damla'), 700);
  if (!haber.yeniRank) return;
  durum.rankKutlama = haber.yeniRank;
  const dene = (n = 0) => {
    if (durum.sheet || durum.tur) { if (n < 20) setTimeout(() => dene(n + 1), 800); return; }
    sheetAc('rankYeni');
  };
  setTimeout(dene, 1300);
}

function paylasimMetni(r) {
  return `Damly'de ${r.ad} rankına çıktım! Limitimin içinde kalıp biriktiriyorum.`;
}

// Paylaşım görseli: yeşil zemin, rank rozeti ve rank adı (1080 × 1080)
async function paylasimGorseli(r) {
  const c = document.createElement('canvas');
  c.width = c.height = 1080;
  const x = c.getContext('2d');
  x.fillStyle = '#0B7A54';
  x.fillRect(0, 0, 1080, 1080);
  const svg = rankRozeti(r, 360).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise((tamam, hata) => { img.onload = tamam; img.onerror = hata; img.src = url; });
    x.drawImage(img, 360, 170, 360, 403);
  } finally { URL.revokeObjectURL(url); }
  try { await document.fonts.load('700 96px Lexend'); } catch (e) { /* yazı tipi yoksa sistem yazısı */ }
  x.fillStyle = '#FFFFFF';
  x.textAlign = 'center';
  x.font = '700 104px Lexend, sans-serif';
  x.fillText(r.ad, 540, 720);
  x.font = '500 44px Lexend, sans-serif';
  x.globalAlpha = 0.9;
  x.fillText('Damly\'de yeni rankım', 540, 800);
  x.font = '600 40px Lexend, sans-serif';
  x.globalAlpha = 0.75;
  x.fillText('Damly', 540, 980);
  return new Promise(tamam => c.toBlob(tamam, 'image/png'));
}

async function rankPaylas() {
  const r = durum.rankKutlama || (durum.rank && durum.rank.rank);
  if (!r) return;
  const metin = paylasimMetni(r);
  if (yerelUygulama) { yereleGonder({ tur: 'paylas', metin }); return; }
  try {
    if (navigator.share) {
      const blob = await paylasimGorseli(r).catch(() => null);
      const dosya = blob && new File([blob], `damly-${r.id}.png`, { type: 'image/png' });
      if (dosya && navigator.canShare && navigator.canShare({ files: [dosya] })) await navigator.share({ files: [dosya], text: metin });
      else await navigator.share({ text: metin });
      return;
    }
    await navigator.clipboard.writeText(metin);
    bildirim('Paylaşım metni kopyalandı');
  } catch (e) {
    if (e && e.name !== 'AbortError') bildirim('Paylaşılamadı');
  }
}

function rankEylemi(eylem) {
  if (eylem === 'rank-paylas') { rankPaylas(); return true; }
  return false;
}
