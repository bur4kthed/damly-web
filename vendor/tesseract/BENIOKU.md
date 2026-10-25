# Tesseract (tarayıcıda fiş okuma)

Web sürümünde fiş fotoğrafı tarayıcının içinde, internete gönderilmeden okunur.
Dosyalar npm paketlerinden alındı; yalnızca "Fiş" düğmesine basılınca yüklenir.

| Dosya | Kaynak |
|---|---|
| tesseract.min.js, worker.min.js | tesseract.js 7.0.0 (Apache-2.0) |
| tesseract-core-simd-lstm.wasm.js | tesseract.js-core 7.0.0 (Apache-2.0) |
| tur.traineddata.gz | @tesseract.js-data/tur 1.0.0, 4.0.0_best_int (Apache-2.0, tessdata) |

Android uygulaması bunları kullanmaz; orada ML Kit ile cihaz içi okuma yapılır (mobil/modules/damly-fis).
