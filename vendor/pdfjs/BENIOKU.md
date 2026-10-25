# pdf.js (ekstre okuma)

Kart ekstresi PDF'i cihazın içinde, internete gönderilmeden yazıya çevrilir.
Dosyalar yalnızca "Ekstre yükle" ile bir PDF seçilince yüklenir.

| Dosya | Kaynak |
|---|---|
| pdf.min.mjs, pdf.worker.min.mjs | pdfjs-dist 6.4.299, legacy derleme (Apache-2.0) |

Legacy derleme, eski Android WebView sürümlerinde de çalışsın diye seçildi.
Android uygulamasında bu iki dosya scripts/paketle.mjs ile HTML'in içine gömülür.
