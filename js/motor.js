// ============================================================
// motor.js — ÇIKARIM MOTORU (İleri Zincirleme / Forward Chaining)
//
// Çalışma şekli:
//   1. Çalışma belleği, hesaplanan gerçeklerle başlar.
//   2. Her turda henüz tetiklenmemiş kurallar sırayla denenir.
//   3. Koşulu sağlanan kural "tetiklenir": belleğe yeni gerçek
//      ekleyebilir ve/veya bir öneri üretir.
//   4. Bir turda yeni gerçek eklendiyse, bu gerçeklere bağlı başka
//      kurallar da tetiklenebilir diye yeni bir tur başlar.
//   5. Yeni gerçek eklenmeyen ilk turda çıkarım durur.
// ============================================================

const SEVIYELER = {
  kritik: { ad: 'Kritik',    simge: '⛔', oncelik: 4 },
  uyari:  { ad: 'Uyarı',     simge: '⚠️', oncelik: 3 },
  oneri:  { ad: 'Öneri',     simge: '💡', oncelik: 2 },
  tebrik: { ad: 'Tebrikler', simge: '🎉', oncelik: 1 }
};

const EN_FAZLA_TUR = 10; // sonsuz döngüye karşı güvenlik sınırı

function cikarimYap(gercekler, kurallar = KURALLAR) {
  const bellek = { ...gercekler };   // çalışma belleği
  const tetiklenen = new Set();      // tetiklenen kuralların kimlikleri
  const oneriler = [];
  const adimlar = [];                // açıklama modülü için çıkarım izi
  let tur = 0;
  let yeniGercekVar = true;

  while (yeniGercekVar && tur < EN_FAZLA_TUR) {
    tur++;
    yeniGercekVar = false;

    for (const kural of kurallar) {
      if (tetiklenen.has(kural.id)) continue;

      let kosulSaglandi = false;
      try { kosulSaglandi = Boolean(kural.kosul(bellek)); } catch (e) { kosulSaglandi = false; }
      if (!kosulSaglandi) continue;

      tetiklenen.add(kural.id);
      const sonuc = kural.sonuc(bellek);
      const eklenen = [];

      if (sonuc.gercek) {
        for (const [ad, deger] of Object.entries(sonuc.gercek)) {
          if (bellek[ad] !== deger) {
            bellek[ad] = deger;
            eklenen.push(ad);
            yeniGercekVar = true;
          }
        }
      }
      if (sonuc.oneri) {
        // Dil uyarlaması: ilkokul ve ortaokuldaki kullanıcıya kuralın sade anlatımı
        // gösterilir. Kararı ve gerekçeyi (neden) değiştirmez.
        const sade = bellek.sadeDil && kural.sade ? kural.sade(bellek) : null;
        oneriler.push({ ...sonuc.oneri, ...sade, kural });
      }
      adimlar.push({ tur, kuralId: kural.id, kuralAd: kural.ad, eklenen });
    }
  }

  // Önce kritik, sonra uyarı, öneri ve tebrikler
  oneriler.sort((a, b) => SEVIYELER[b.seviye].oncelik - SEVIYELER[a.seviye].oncelik);

  return { oneriler, tetiklenen, adimlar, bellek, tur };
}
