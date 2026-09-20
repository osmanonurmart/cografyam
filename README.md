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

Kod değiştirince sürümü artır, yoksa tarayıcı eskisini gösterir. Tek numara
üç yerde duruyor (`index.html` `?s=`, `sw.js` `SURUM` ve `?s=`,
`js/surum.js` `SURUM_NO`) — hepsini birden artırmak için (N = yeni numara):

```bash
N=63; sed -i "s/?s=[0-9]*/?s=$N/g" index.html sw.js; sed -i "s/cografyam-v[0-9]*/cografyam-v$N/" sw.js; sed -i "s/SURUM_NO = [0-9]*/SURUM_NO = $N/" js/surum.js
```

> `js/surum.js` sürüm kontrolünün okuduğu dosya: `firebase.json`'da
> önbelleğe alınmaz ve istek adresine zaman damgası eklenir. Yoksa
> `**/*.@(js|css)` kuralının bir yıllık önbelleği eski numarayı döndürür.

Ekranda "Coğrafyam"ın yanında `vN` görünür. Uygulama açıkken yeni sürüm
yayına çıkarsa (sunucudaki `js/surum.js` açılışta, sekmeye dönünce ve 5
dakikada bir okunur) rozet `vN · güncelle` olur, tıklayınca yenilenir.

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
  sürüklemek cevabı bozmaz. Alan/çizgi iki türlü taşınır: şeklin üstünden
  sürüklersem tamamı kayar, tutamaktan sürüklersem tek nokta oynar —
  ikisinde de bırakınca kapsadığı iller yeniden hesaplanır.
- **Yazılı sorunun cevabı haritadaki şekiller de olabilir** (`sorular[].objeler`,
  kimlik listesi). Düzenle'de soru kartındaki *Haritadan seç* ile toplanır,
  hepsi bulunmadan soru bitmez. Şekillerin kendi kartları ve soruları
  bundan bağımsızdır.
- **Konu kartının arkası var.** İlerlemesi olan konuya tıklayınca kart 3B
  çevrilir ve "▶ Devam / ↺ Sıfırdan" çıkar; boş konu doğrudan açılır.
  Eskiden ön yüzde iki küçük daire (▶ ve ↺) vardı, mobilde ıskalanıyordu.
  Yüzler `.konu-kutu` ızgarasının aynı gözünde duruyor — kartta
  `place-content:stretch` olmazsa eski kuralın `justify-content:space-between`i
  tek sütunu esnetmiyor ve yüzler sola sıkışıyor.
- **Ana ekran sıralaması** kutuyu 250 ms basılı tutup sürükleyerek değişir;
  `sira` alanına yazılır. Taşıma yalnızca aynı kapsayıcı içinde olur ve
  "Günlük Tekrar" (`.sabit`) ilk hücrede kalır. Bırakışın ardından 400 ms
  boyunca tıklama yutulur — yoksa bırakınca konu açılıyordu. Dinleyiciler
  `data-sira-bagli` ile bir kez bağlanır, liste her çizimde yenileniyor.
- **Cevapta il adı:** obje sorusunda geri bildirim "Doğru — Sivas Bakır"
  der; konu ayarındaki *Cevapta ilin adı da yazsın* ile kapatılır
  (`ayar.ilCevapta`).
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
- **Profiller şifresiz.** Liste `ayarlar.profiller` içinde (buluta gider),
  seçili profil `aktifProfil` anahtarında ve YALNIZCA o cihazda kalır.
  Profiller öncesi tek kullanıcılı kayıtlar (`ilerleme`/`gunluk` içindeki
  `ortak`) taşınmaz — taşıma bulut snapshot'ıyla yarışıp geri alınıyordu;
  onun yerine ilk profil okurken onlara da bakar (`eskiKayitlarBuProfilde`).
- **Günlük tekrar tur mantığıyla çalışır** ([GUNLUK-GOREV-MANTIGI.md](GUNLUK-GOREV-MANTIGI.md)):
  sabit sıra + imleç, günün listesi seçilen süreye göre gün başında kurulur ve
  gün içinde değişmez; bilinemeyen soru ertesi günün başına yazılır. Sıra
  KARIŞIKTIR (konu konu değil) ve her yeni turda yeniden karışır. Soru süresi
  metin uzunluğundan tahmin edilir, ölçülen sürelerle kendini ayarlar.
- **Günlük tekrar kişiye özel:** `ayarlar.tekrar[profilId]`. İki kez üst üste
  doğru bilinen soru öğrenilmiş sayılır ve sonraki turlarda atlanır; yanlış
  bilinirse sayaç sıfırlanır ve soru geri döner.
- **Firestore iç içe diziyi kabul etmez.** Alan/çizgi `noktalar` alanı
  `[[x, y], …]` — buluta `konuBuluta` ile düz dizi olarak gider,
  `konuBuluttan` ile çiftlere döner (`js/bulut.js`). Konular tek pakette
  gönderildiği için tek bir iç içe dizi bütün paketi düşürür ve o andan
  sonraki hiçbir değişiklik buluta ulaşmaz ("Buluta gönderilemedi").
  Konuya yeni bir dizi-içinde-dizi alanı eklenirse ikisine de eklenmeli.
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
- **Konuya içe aktar:** Konu Ayarları kartındaki ⬆ İçe aktar, tek bir JSON
  kodla (yapıştır ya da dosya) konuyu doldurur: ad/simge/renk, ayarlar,
  objeler (`"iller": ["Mardin", "Balıkesir/Bigadiç"]`) ve yazılı sorular
  (`il` / `bolge`). Biçimin tamamı [KONU-EKLEME.md](KONU-EKLEME.md) içinde.
  Objelerin x/y'si boş bırakılır, `objeKonum` il yazısının yanına dağıtır.

### Kaynak

Harita: [SVG Türkiye Haritası](https://github.com/dnomak/svg-turkiye-haritasi) — MIT, Doğukan Güven Nomak.
Komşu sınırlar ve hazır içerik: Natural Earth (kamu malı).
