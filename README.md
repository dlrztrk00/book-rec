# Kitap Önerici

Goodreads okuma geçmişini yükle, birkaç soruya cevap ver, gerekçeli kitap önerileri al.

Tamamen tarayıcıda çalışır. **Site açıldıktan sonra hiçbir yere istek gitmez** — ne API, ne
analitik, ne kapak görseli. Kütüphanen ve cevapların yalnızca `localStorage`'da tutulur.

## Nasıl çalışıyor

1. **İçe aktarma** — Goodreads'in `Export Library` CSV'si okunur. Kitaplar önce Goodreads
   id'siyle, tutmazsa başlık+yazar, o da tutmazsa tek aday varsa başlıkla eşleştirilir.
2. **Anket** — 16 soru: ruh hali, tempo, ton, tür, tema, uzunluk, dönem, seri tercihi,
   kaçınılacak içerikler, ne kadar keşif istediğin ve "şuna benzer olsun" kitap seçimi.
3. **Öneri** — dört bileşenden bir eşleşme yüzdesi:

   | Bileşen | Nereden geliyor |
   |---|---|
   | Okuma geçmişin | 53.406 okurun 4,1 milyon beğenisinden hesaplanan kitap-kitap benzerliği |
   | Cevapların | 26 içerik boyutu üzerinden istenen/istenmeyen profil uyumu |
   | Okur puanı | Bayes düzeltmeli ortalama (az oylu kitaplar şişmesin diye) |
   | Keşif ayarın | Popülerlik hedefine yakınlık |

   Her kart hangi kitaplarından türediğini, hangi boyutları tutturduğunu ve neyi
   tutturamadığını ayrı ayrı gösterir.

### "Okuyucular bunları da sevdi" nereden geliyor

Uydurma değil, hesaplanmış: `ratings.csv` içindeki 4+ yıldızlı beğeniler üzerinden
kitap-kitap ortak okunma matrisi çıkarılıyor. Popülerlik cezası (`POP_DAMP=0.65`) ile
"herkes Harry Potter okumuş" etkisi bastırılıyor, seyrek eşleşmeler `SHRINK` ile geri çekiliyor.
Her kitap için en yakın 40 komşu `sim.bin` içine yazılıyor (1,2 MB).

## Kurulum

```bash
npm install
npm run data      # veriyi indirir, DOĞRULAR, indeksi üretir (~4 dk, tek seferlik)
npm run dev
```

Diğer komutlar:

```bash
npm run data:verify   # kaynak bütünlüğü + içerik güvenliği raporu
npm test              # uçtan uca öneri motoru denemesi
npm run build         # dist/ üretir, statik olarak her yere konabilir
```

## Veri ve doğrulama

Veri [goodbooks-10k](https://github.com/zygmuntz/goodbooks-10k)'dan gelir (CC BY-SA 4.0).
`npm run data` her çalıştığında `scripts/verify-data.mjs` şunları kontrol eder ve
başarısız olursa **build'i durdurur**:

- **Kaynak bütünlüğü** — türev veri deposunun çekirdek dosyaları kanonik depoyla
  SHA-256 düzeyinde birebir aynı mı (fork tek bir puanı değiştirmiş mi)
- **Şema ve aralık** — 6 milyon puanın hepsi 1-5 arasında mı, id'ler sınırlar içinde mi
- **Kimlik bütünlüğü** — zenginleştirilmiş dosya hiçbir kitabın kimliğini değiştirmiş mi
- **İçerik güvenliği** — 59.358 metin alanında script/iframe/`javascript:`/olay işleyici taraması
- **Özet hizası** — açıklamalar doğru kitaba mı bağlı (başlık eşleşmesi %70,3'e karşı
  rastgele taban çizgisi %5,2)

Bu doğrulama gerçek iki kusur yakaladı ve ikisi de giderildi: türev depodaki `authors`
sütunu 198 kitapta hatalı (kanonik dosya kullanılıyor), ve `book_tags.csv`'de 6 satırda
negatif sayaç var (atılıyor).

`data/raw/` (205 MB ham CSV) sürüm kontrolüne girmez; `public/data/` (13 MB üretilmiş
indeks) dağıtım kolay olsun diye depoda tutulur.

## Lisans

Kaynak kodu MIT ([LICENSE](LICENSE)). `public/data/` altındaki üretilmiş veri
goodbooks-10k türevidir, CC BY-SA 4.0 ile lisanslıdır — bkz.
[public/data/LICENSE.md](public/data/LICENSE.md).
