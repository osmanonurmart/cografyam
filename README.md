# Coğrafyam

Coğrafyayı haritaya bakarak çalışmak için PWA. Konu seç → soruyu oku → haritada doğru yeri tıkla.

**https://cografyam.web.app**

---

## Kendi notlarım

### Yayınlama

```bash
firebase deploy --only hosting          # Firebase
git push                                # GitHub Pages
firebase deploy --only firestore:rules  # kurallar değiştiyse
```

Kod değiştirince **iki yerde** sürüm artır, yoksa tarayıcı eskisini gösterir:

1. `index.html` içindeki `?s=44` → `?s=45` (9 yerde)
2. `sw.js` içindeki `SURUM` **ve** `DOSYALAR` listesindeki `?s=44`

> `firebase.json` ignore listesinde hem `**/.*` hem `**/.*/**` olmalı.
> Yalnızca ilki varsa `.git` klasörünün içi yayına çıkar.

### Bulut

Giriş yok — Kart Kutusu ile aynı mantık. Uygulama açılır açılmaz Firestore'a
bağlanır, herkes aynı veriyi görür.

`localStorage` **yerel ayna** olarak duruyor: uygulamanın geri kalanı hâlâ
senkron `Depo.oku` ile okuyor, `js/bulut.js` iki yönü bağlıyor —
`onSnapshot` geleni aynaya yazar, `Depo.yaz` ise 800 ms bekletip buluta
gönderir. Bu yüzden internet yokken uygulama aynadan okumaya devam ediyor.

| Koleksiyon | Ne var |
|---|---|
| `konular/{id}` | konu, objeleri ve soruları |
| `ustKonular/{id}` | ana ekran grupları |
| `gorseller/{id}` | palet görselleri |
| `ayarlar·ilerleme·gunluk` `/genel` | tek belgede duran kayıtlar |

Bulut boşken yerel içerik **silinmez** — boş liste aynaya yazılsaydı o
cihazdaki bütün konular giderdi (`_bosBulutuYoksay`).

Firebase SDK `js/vendor/` altında yerel duruyor; CDN'den gelseydi çevrimdışı
açılış çalışmazdı.

### Dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `js/app.js` | Uygulama mantığı — ilerleme, soru akışı, harita sınıfı |
| `js/bulut.js` | Firestore senkronu |
| `js/editor.js` | Harita Düzenle — araçlar, çizim, zoom, palet |
| `js/konu-duzen.js` | Üst Konular ve Konu Ayarları |
| `js/data.js` | Tohum veri (yalnızca ilk açılışta) |
| `js/harita-turkiye.js` | 81 ilin SVG haritası |
| `js/il-merkez.js` | İl etiket/obje noktaları, çerçeve, çevre yazıları |
| `js/komsular.js` · `js/hazir-icerik.js` | Komşu sınırlar, hazır akarsu/göl |

### Aklımda tutmam gerekenler

- **Obje = soru.** Haritaya koyduğum her emoji, çizgi ve alan aynı zamanda bir
  sorudur. Doğru cevap koordinata değil `iller` listesine bakar; objeyi
  sürüklemek cevabı bozmaz.
- **Soru sırası** konuya girerken bir kez belirlenip ilerlemeyle saklanır: yarıda
  bırakıp dönünce aynı sıra, baştan başlayınca yeni sıra. Ayarlar › Soruları
  karıştır ile kapatılabilir.
- **Cevap birimi konu düzeyinde:** İl / Bölge / Obje. Tek tek objelerde ayarı yok.
- **Hayalet mod** yalnızca cevap birimi "İl" olmayan konularda açılır.
- **İl sınırlarını kaldır:** kaynak SVG'de komşu iller birbirine tam değmiyor.
  Hem maskeye hem illere aynı renkte kontur veriliyor, altına da tek parça zemin
  seriliyor — üçü birden olmazsa sınırlar geri geliyor.
- **Depo sınırı** origin başına ~5 MB ve her karakter 2 bayt sayılıyor. Metin bu
  sınırı zorlamaz; yalnızca yüklenen görseller zorlar (128×128 PNG ≈ 14-40 KB).
- **Harita boyutu** `HARITA_VIEWBOX` ile ayarlanır. Türkiye enine olduğu için
  harita hep genişliğe göre sığar — ölçeği belirleyen tek sayı çerçeve genişliği,
  dikey kırpmanın etkisi yok. Çerçeve ülkenin sınırına çekildi (%97 doluluk),
  çevre yazıları kenarda kırpılıyor.
- **Firestore kurallarında `allow write` create + update + DELETE demektir.**
  Silmede `request.resource` null olduğu için içine alan denetimi koyulursa
  kural değerlendirilemez ve silme sessizce reddedilir. `create, update` ile
  `delete` ayrı yazılmalı — bu tuzağa bir kez düşüldü.
- **Buluta bir kez sızan bozuk kayıt her yerden geri gelir.** Yerel aynalar
  onu tutar, bulut boşalınca geri yüklenir. `COP_KAYITLAR` kara listesi bunun
  içindir. Ayrıca eksik alan (renk, ikon) uygulamayı çökertmemeli — `karart`
  ve `ustKonulariYukle` varsayılana düşer.
- **Komşu ülke sınırları haritaya tam oturmuyor** ve doğrusal bir dönüşümle
  oturtulamıyor: geometri Natural Earth'ten enlem/boylam formülüyle üretildi,
  Türkiye SVG'sinin izdüşümüne yaklaşık uyuyor (ortak sınırda ortalama 5,
  yer yer 24 birim sapma; en kötüsü Irak ve Azerbaycan). Ölçüldü: afin,
  benzerlik, ikinci derece uydurma ve ülke başına öteleme denendi — ya kazanç
  vermedi ya da komşuları Türkiye'nin üstüne taşıdı. Bu yüzden komşuların
  konturu kaldırıldı; sınırı gösteren tek çizgi Türkiye'nin kendi dış hattı.
  Kalıcı çözüm geometriyi haritanın gerçek izdüşümüyle yeniden üretmek.
- **Çalışma ekranında yakınlaştırma** skor rozetlerinin altındaki 🔍 ile açılır:
  tekerlek ve iki parmak yakınlaştırır, sürüklemek gezdirir, tek dokunuş yine
  cevap verir (4 birimlik sürükleme eşiği ikisini ayırır). Anahtar genel
  ayarlarda saklanır, konular arasında korunur. `setPointerCapture`
  KULLANILMAZ — yakalama click olayını kapsayıcıya yönlendirip cevap
  vermeyi tamamen bozuyordu.
- **Telefonu yatay çevirme zorunluluğu yok.** Dikeyde harita küçük kalır,
  yakınlaştırma onu kullanılabilir kılar.
- **Yedek:** Düzenle ekranındaki ⬇ Dışa aktar / ⬆ İçe aktar.

### Kaynak

Harita: [SVG Türkiye Haritası](https://github.com/dnomak/svg-turkiye-haritasi) — MIT, Doğukan Güven Nomak.
Komşu sınırlar ve hazır içerik: Natural Earth (kamu malı).
