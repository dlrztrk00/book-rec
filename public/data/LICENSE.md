# Veri lisansi

Bu klasordeki dosyalar (`books.json`, `sim.bin`, `facets.bin`, `desc/*.json`, `meta.json`)
asagidaki veri setlerinden **turetilmistir**:

| Kaynak | Kullanilan alanlar | Lisans |
|---|---|---|
| [goodbooks-10k](https://github.com/zygmuntz/goodbooks-10k) | puanlar, etiketler, kitap kunyesi (baslik, yazar, yil, ortalama puan) | CC BY-SA 4.0 |
| [goodbooks-10k-extended](https://github.com/malcolmosh/goodbooks-10k-extended) | yalnizca aciklama, tur ve sayfa alanlari | CC BY-SA 4.0 |

Creative Commons Attribution-ShareAlike 4.0 International geregi:

- **Atif:** yukaridaki kaynaklar belirtilmistir (arayuzun altbilgisinde de gorunur).
- **Ayni lisansla paylasim:** bu turetilmis veri dosyalari da **CC BY-SA 4.0** ile lisanslidir.

Lisans metni: https://creativecommons.org/licenses/by-sa/4.0/

Bu dosyalar `npm run data` ile yeniden uretilebilir; uretim oncesi
`scripts/verify-data.mjs` kaynak butunlugunu ve icerik guvenligini dogrular.

## Not: yazar alani

Zenginlestirilmis veri setinin `authors` sutunu 198 kitapta hatalidir
(ornegin *Dune Messiah* icin "John Grisham"). Bu yuzden kitap kunyesi
**kanonik** goodbooks-10k dosyasindan alinir; forkun `authors` sutunu yok sayilir.
