// ============================================================
// seri.js — SERİ (oyunlaştırma)
// Günlük limitinin içinde biten her gün seriye +1 ekler; limit aşılan
// gün seri sıfırlanır. Bugün henüz bitmediği için sayılmaz: bugün
// limitte kalırsan yarın seri bir artar. Cepten kumbaraya atılan para
// da o günün limitinden düştüğü için hesaba girer (takvim.js).
// Seri 3, 7, 14… güne ulaşınca kutlama sayfası açılır (paylaşılabilir).
// Seri kayıtlardan hesaplanır; yalnızca en son görülen seri veri.seri'de
// saklanır (yeni gün ve eşik haberleri için).
// ============================================================

const SERI_ESIKLERI = [3, 7, 14, 30, 60, 100, 200, 365];

// ---------- Hesap ----------

function seriDurumu(g) {
  const tk = g.takvim, bugun = tarihCoz(tk.bugunS);
  // Geçmiş günler (en çok 400 gün geriye): en uzun seri ve limit içinde geçen gün sayısı
  let d = tarihCoz(tk.baslangic);
  if (gunFarki(d, bugun) > 400) d = gunEkle(bugun, -400);
  let enUzun = 0, n = 0, iciGun = 0, toplamGun = 0;
  for (; d < bugun; d = gunEkle(d, 1)) {
    const k = tk.gun(tarihStr(d));
    if (!k) continue;
    toplamGun++;
    if (k.asildi) n = 0;
    else { n++; iciGun++; enUzun = Math.max(enUzun, n); }
  }
  const seri = g.seri;
  const sonraki = SERI_ESIKLERI.find(e => e > seri) || null;
  const onceki = SERI_ESIKLERI.filter(e => e <= seri).pop() || 0;
  return {
    seri, enUzun: Math.max(enUzun, seri), iciGun, toplamGun, sonraki,
    bugunIcinde: g.bugunKalan >= 0,
    oran: sonraki ? (seri - onceki) / (sonraki - onceki) : 1,
    bas: tarihStr(gunEkle(bugun, -seri))       // serinin ilk günü: seri sürdükçe değişmez
  };
}

// Bugünün limiti kaydedilir (her çizimde; günün son değeri kalır). Geçmiş günler sonradan
// değişen dönem bütçesine göre değil, o gün gösterilen limite göre değerlendirilir (takvim.js).
function gunLimitiKaydet(veri, g) {
  const kayit = veri.gunLimitleri || (veri.gunLimitleri = {});
  const t = g.takvim.bugunS;
  if (kayit[t] === g.gunlukLimit) return false;
  kayit[t] = g.gunlukLimit;
  const sinir = tarihStr(gunEkle(tarihCoz(t), -400));
  for (const x of Object.keys(kayit)) if (x < sinir) delete kayit[x];
  return true;
}

// Seri uzadıysa haber verir; yeni bir eşiğe ulaşıldıysa kutlanacak eşiği döndürür.
// İlk açılışta ve seri bozulunca sessizce kaydeder.
function seriHaberi(veri, sd) {
  const eski = veri.seri;
  if (eski && eski.bas === sd.bas && eski.gun === sd.seri) return null;
  veri.seri = { bas: sd.bas, gun: sd.seri };
  veriKaydet(veri);
  if (!eski || !sd.seri) return null;
  const onceki = eski.bas === sd.bas ? eski.gun : 0;
  if (sd.seri <= onceki) return null;
  return { gun: sd.seri, esik: SERI_ESIKLERI.filter(e => e > onceki && e <= sd.seri).pop() || null };
}

// ---------- Çizimler ----------

function seriIpucu(sd) {
  if (!sd.bugunIcinde) return sd.seri ? 'Bugün limitini aştın; serin yarın sıfırlanır' : 'Yarın limitinde kalırsan serin başlar';
  return sd.seri ? `Bugün limitinde kalırsan yarın ${sd.seri + 1} gün` : 'Bugün limitinde kalırsan serin başlar';
}

// Bu haftanın günleri (Pazartesi–Pazar): limit içinde biten gün dolu, aşılan gün çarpı,
// bugün kullanılan yüzde, gelecek günler kesik çizgi.
function haftaSeridi(g) {
  const tk = g.takvim, bugun = tarihCoz(tk.bugunS);
  const pzt = gunEkle(bugun, -((bugun.getDay() + 6) % 7));
  return `<span class="hafta-serit">${HAFTA_SIRASI.map((gn, i) => {
    const t = tarihStr(gunEkle(pzt, i));
    let durumu = 'gelecek', ic = '';
    if (t === tk.bugunS) { durumu = g.bugunKalan < 0 ? 'bugun asti' : 'bugun'; ic = yuzde(Math.min(g.bugunOran, 9.99)); }
    else if (t < tk.bugunS) {
      const k = tk.gun(t);
      if (!k) durumu = 'yok';
      else if (!k.asildi) { durumu = 'iyi'; ic = ikon('onay', 15); }
      else { durumu = 'asti'; ic = ikon('kapat', 14); }
    }
    return `<span class="hs-gun ${durumu}"><i>${ic}</i>${GUN_KISA[gn]}</span>`;
  }).join('')}</span>`;
}

// Bugün ekranındaki kart: alev, seri, en uzun seri ve bu haftanın günleri
function seriKarti(sd, g) {
  return `<button class="seri-kart" data-eylem="alt" data-ekran="seri" aria-label="${sd.seri} günlük seri">
    <span class="seri-ust">
      <span class="seri-alev ${sd.seri ? 'yanik' : ''}">${ikon('alev', 26)}</span>
      <span class="seri-orta"><b>${sd.seri} günlük seri</b><small>${seriIpucu(sd)}</small></span>
      <span class="seri-rekor"><small>En uzun</small><b>${sd.enUzun}</b></span>
    </span>
    ${haftaSeridi(g)}
  </button>`;
}

// Son 4 hafta: her gün limit içinde mi?
function seriIzgara(g) {
  const tk = g.takvim, bugun = tarihCoz(tk.bugunS);
  const ilk = gunEkle(bugun, -((bugun.getDay() + 6) % 7) - 21);
  const hucreler = [];
  for (let i = 0; i < 28; i++) {
    const d = gunEkle(ilk, i), t = tarihStr(d), k = tk.gun(t);
    const sinif = t > tk.bugunS ? 'gelecek' : t === tk.bugunS ? (g.bugunKalan < 0 ? 'bugun asti' : 'bugun') : !k ? 'yok' : k.asildi ? 'asti' : 'iyi';
    hucreler.push(`<i class="${sinif}" title="${uzunTarih(t)}">${d.getDate()}</i>`);
  }
  return `<div class="seri-izgara">${HAFTA_SIRASI.map(x => `<span>${GUN_KISA[x]}</span>`).join('')}${hucreler.join('')}</div>`;
}

function seriCiz(g) {
  const sd = durum.seri;
  const rozetler = SERI_ESIKLERI.map(e => {
    const acik = sd.enUzun >= e;
    return `<div class="seri-rozet ${acik ? 'acik' : ''}">
      <span class="seri-rozet-alev">${ikon(acik ? 'alev' : 'kilit', 20)}</span><b>${e}</b><small>gün</small>
    </div>`;
  }).join('');
  return `
  ${baslik('Seri', { geri: true })}
  <section class="seri-buyuk">
    <span class="seri-alev buyuk ${sd.seri ? 'yanik' : ''}">${ikon('alev', 64)}</span>
    <strong>${sd.seri}</strong>
    <span>günlük seri</span>
    <p>${seriIpucu(sd)}</p>
    ${sd.sonraki ? `<span class="seri-cubuk"><i style="transform:scaleX(${Math.max(0.03, sd.oran).toFixed(3)})"></i></span>
      <small>${sd.sonraki} güne ${sd.sonraki - sd.seri} gün kaldı</small>` : ''}
  </section>
  <section class="kart seri-sayilar">
    <div><span>En uzun seri</span><b>${sd.enUzun} gün</b></div>
    <div><span>Limit içinde</span><b>${sd.iciGun} gün</b></div>
    <div><span>Başarı</span><b>${sd.toplamGun ? yuzde(sd.iciGun / sd.toplamGun) : '—'}</b></div>
  </section>
  <div class="bolum-bas"><h2>Son 4 hafta</h2></div>
  <section class="kart">${seriIzgara(g)}</section>
  <div class="bolum-bas"><h2>Rozetler</h2><span>${SERI_ESIKLERI.filter(e => sd.enUzun >= e).length} / ${SERI_ESIKLERI.length}</span></div>
  <section class="kart seri-rozetler">${rozetler}</section>
  <div class="bilgi-serit">${ikon('bilgi', 18)}<span>Limitinin içinde biten her gün serine <b>+1</b> eklenir; limitini aştığın gün seri sıfırlanır. Cebinden kumbaraya attığın para da o günün limitinden düşer.</span></div>`;
}

// ---------- Eşik kutlaması ve paylaşma ----------

const SERI_SHEETLERI = {
  seriYeni() {
    const sd = durum.seri, e = durum.seriKutlama;
    if (!sd || !e) return '';
    const sonraki = SERI_ESIKLERI.find(x => x > e);
    return `<div class="seri-kutlama">
      ${konfeti()}
      <span class="seri-alev buyuk yanik seri-kutlama-alev">${ikon('alev', 88)}</span>
      <h2>${e} günlük seri!</h2>
      <p>${e} gündür limitinin içindesin.${sonraki ? ` Sıradaki rozet: ${sonraki} gün.` : ' Bu en büyük rozet.'}</p>
      <div class="seri-kutlama-dugmeler">
        <button class="dugme ana" data-eylem="seri-paylas">${ikon('paylas', 18)} Paylaş</button>
        <button class="dugme hafif" data-eylem="sheet-kapat">Devam</button>
      </div>
    </div>`;
  }
};

// Seri uzayınca kısa bildirim, yeni eşikte kutlama sayfası
function seriHaberiGoster(haber) {
  if (!haber) return;
  setTimeout(() => bildirim(`${haber.gun} günlük seri!`, 'alev'), 700);
  if (!haber.esik) return;
  durum.seriKutlama = haber.esik;
  const dene = (n = 0) => {
    if (durum.sheet || durum.tur) { if (n < 20) setTimeout(() => dene(n + 1), 800); return; }
    sheetAc('seriYeni');
  };
  setTimeout(dene, 1300);
}

function seriPaylasimMetni(gun) {
  return cevir(`Damly'de ${gun} gündür harcama limitimin içindeyim!`);
}

// Paylaşım görseli: yeşil zemin, alev ve gün sayısı (1080 × 1080)
async function seriPaylasimGorseli(gun) {
  const c = document.createElement('canvas');
  c.width = c.height = 1080;
  const x = c.getContext('2d');
  x.fillStyle = '#0B7A54';
  x.fillRect(0, 0, 1080, 1080);
  const svg = ikon('alev', 300).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace('stroke="currentColor"', 'stroke="#FFFFFF"');
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise((tamam, hata) => { img.onload = tamam; img.onerror = hata; img.src = url; });
    x.drawImage(img, 390, 130, 300, 300);
  } finally { URL.revokeObjectURL(url); }
  try { await document.fonts.load('700 96px Lexend'); } catch (e) { /* yazı tipi yoksa sistem yazısı */ }
  x.fillStyle = '#FFFFFF';
  x.textAlign = 'center';
  x.font = '700 220px Lexend, sans-serif';
  x.fillText(String(gun), 540, 680);
  x.font = '500 56px Lexend, sans-serif';
  x.globalAlpha = 0.9;
  x.fillText(cevir('günlük seri'), 540, 780);
  x.font = '600 40px Lexend, sans-serif';
  x.globalAlpha = 0.75;
  x.fillText('Damly', 540, 980);
  return new Promise(tamam => c.toBlob(tamam, 'image/png'));
}

async function seriPaylas() {
  const gun = durum.seriKutlama || (durum.seri && durum.seri.seri);
  if (!gun) return;
  const metin = seriPaylasimMetni(gun);
  if (yerelUygulama) { yereleGonder({ tur: 'paylas', metin }); return; }
  try {
    if (navigator.share) {
      const blob = await seriPaylasimGorseli(gun).catch(() => null);
      const dosya = blob && new File([blob], `damly-seri-${gun}.png`, { type: 'image/png' });
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

function seriEylemi(eylem) {
  if (eylem === 'seri-paylas') { seriPaylas(); return true; }
  return false;
}
