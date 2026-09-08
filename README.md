# Kitap Önerici

Goodreads okuma geçmişini yükle, birkaç soruya cevap ver, gerekçeli kitap önerileri al.

Puanlamanın tamamı tarayıcında yapılır. **Kütüphanen ve anket cevapların hiçbir yere
gönderilmez** — yalnızca `localStorage`'da tutulur. Analitik yok, hesap yok, kapak
görselleri bile yerel üretilir.

Dışarı giden tek şey, 2017 sonrası kitaplar için [Open Library](https://openlibrary.org)'ye
atılan **konu arama sorgularıdır** (ör. `subject:"literary fiction" first_publish_year:[2017 TO 2100]`).
Bu sorgular senin verini içermez. İnternet yoksa site çalışmaya devam eder, sadece
10.000 kitaplık yerel havuzla sınırlı kalır.

## Nasıl çalışıyor

1. **İçe aktarma** — Goodreads'in `Export Library` CSV'si okunur. Kitaplar önce Goodreads
   id'siyle, tutmazsa başlık+yazar, o da tutmazsa tek aday varsa başlıkla eşleştirilir.
   Eşleşmeyen satırlar da **başlık+yazar anahtarı olarak saklanır**: kütüphanenin çoğu
   veri setinde bulunmasa bile okuduğun bir kitap sana geri önerilmez.
2. **Anket** — 18 soru: ruh hali, tempo, ton, tür, tema, uzunluk, dönem, seri tercihi,
   kaçınılacak içerikler, **okumak istemediğin yazarlar**, ne kadar keşif istediğin,
   yeni çıkanlara ne kadar yer verileceği ve "şuna benzer olsun" kitap seçimi.
3. **Öneri** — dört bileşenden bir eşleşme yüzdesi:

   | Bileşen | Nereden geliyor |
   |---|---|
   | Okuma geçmişin | 53.406 okurun 4,1 milyon beğenisinden hesaplanan kitap-kitap benzerliği |
   | Cevapların | 26 içerik boyutu üzerinden istenen/istenmeyen profil uyumu |
   | Okur puanı | Bayes düzeltmeli ortalama (az oylu kitaplar şişmesin diye) |
   | Keşif ayarın | Popülerlik hedefine yakınlık |

   Her kart hangi kitaplarından türediğini, hangi boyutları tutturduğunu ve neyi
   tutturamadığını ayrı ayrı gösterir.

### Neyin önerilmeyeceği

- Okuduğun / yarım bıraktığın her kitap — hem veri seti id'siyle hem başlık+yazar
  anahtarıyla, hem yerel havuzdan hem Open Library sonuçlarından
- Engellediğin yazarlar — anketten seçebilir ya da öneri kartındaki
  *"bu yazarı gösterme"* düğmesiyle anında ekleyebilirsin
- "Kesinlikle istemediklerim" olarak işaretlediğin içerik boyutları

`okunacaklar` rafındaki kitaplar önerilmeye devam eder, ama kartta rozetle işaretlenir.

## Yeni kitaplar (2017+)

Yerel veri seti 2017'de bitiyor. Sonrasını Open Library'den **canlı** çekiyoruz: anket
profilindeki en güçlü boyutlar Open Library konu terimlerine çevriliyor, 2017 sonrası
kitaplar okunma sayısına göre sıralanıp getiriliyor. Sonuçlar 7 gün `localStorage`'da
önbelleklenir, yani ikinci açılış anında gelir.

Burada dürüst olmak gerekiyor: **yeni kitapların arkasında ortak okur verisi yok.**
53k okurun ne birlikte sevdiğini bilmiyoruz, çünkü o veri 2017'de donmuş. Yeni kitaplar
sevdiğin kitapların *konularıyla* örtüşmelerine göre bağlanıyor — daha zayıf bir kanıt.
Bu yüzden:

- Kartta "Okuma geçmişin" yerine **"Konu bağı"** yazar ve mavi bir rozetle işaretlenir
- Bu bileşen bilerek %15 kısılır
- Ankette **"Yeni çıkanlar mı, oturmuş kitaplar mı?"** sorusu vardır: `ağırlıklı yeni`
  listenin ~%60'ını, `karışık` ~%25'ini yeni kitaplara ayırır, `sadece oturmuş` hiç getirmez

Open Library'nin oy hacmi Goodreads'ten ~100 kat düşük olduğu için kalite ve popülerlik
puanları iki kaynak için **ayrı ayrı** normalize edilir; yoksa yeni kitaplar sistematik
olarak elenir.

Bilinen pürüz: Open Library bazı kitapların başlığını orijinal dilinde tutuyor, o yüzden
ara sıra İngilizce baskısı olan bir kitap İsveççe/Fransızca adıyla görünebilir.

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
npm test              # uçtan uca deneme (canlı Open Library testi dahil)
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

| Ne | Lisans |
|---|---|
| Kaynak kodu | MIT — [LICENSE](LICENSE) |
| `public/data/` altındaki üretilmiş veri | CC BY-SA 4.0 (goodbooks-10k türevi) — [public/data/LICENSE.md](public/data/LICENSE.md) |
| Open Library'den canlı gelen veri | CC0 — kamu malı, atıf zorunlu değil (yine de altbilgide veriliyor) |
