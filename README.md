# Coğrafyam

Coğrafyayı haritaya bakarak çalışmak için PWA. Konu seç → soruyu oku → haritada doğru yeri tıkla.

## Çalıştırma

**VS Code'da:** klasörü aç, `index.html` üzerine sağ tık → *Open with Live Server*
(ya da terminalde aşağıdaki komut, sonra tarayıcıda `http://localhost:8765`)

```bash
python -m http.server 8765
```

Dosyaya çift tıklayarak (`file://`) da açılır ama o zaman PWA (çevrimdışı / ana ekrana ekleme) çalışmaz.

## Dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `index.html` | Ekranların iskeleti |
| `css/style.css` | Tüm görünüm |
| `js/data.js` | **Tohum veri** — ilk açılıştaki konular, objeler, sorular ve 7 bölgenin il listeleri |
| `js/app.js` | Uygulama mantığı (profil, ilerleme, soru akışı, harita sınıfı) |
| `js/editor.js` | Harita Düzenle ekranı — araçlar, çizim, obje paneli |
| `js/konu-duzen.js` | Üst Konular ve Konu Ayarları ekranları |
| `js/komsular.js` | Komşu ülke sınırları (arka plan katmanı) |
| `js/hazir-icerik.js` | Hazır akarsu ve göl şekilleri |
| `js/harita-turkiye.js` | 81 ilin SVG haritası (gömülü) |
| `js/il-merkez.js` | Her ilin etiket/obje yerleşim noktası |
| `sw.js` | Çevrimdışı çalışma (service worker) |
| `manifest.json` | PWA tanımı |

## Kavramlar

**Obje = soru.** Haritaya koyduğun her emoji ve her çizgi aynı zamanda bir sorudur:

```js
// emoji objesi
{ tip:"emoji", emoji:"🌋", ad:"Erciyes Dağı", iller:["Kayseri"], boyut:1.2, aci:0 }

// çizgi objesi (akarsu, sıradağ…)
{ tip:"cizgi", ad:"Kızılırmak", iller:["Sivas","Kayseri","…"], tumunuBul:true,
  noktalar:[[x,y],…], renk:"#38bdf8", kalinlik:3 }
```

- `soruMetni` boşsa soru `"<ad> hangi ilimizdedir?"` olur (birden fazla il varsa "hangi illerimizdedir")
- `iller` doğru cevapların listesi. `tumunuBul` açıksa soru, illerin **hepsi** tıklanana kadar sürer ve "2/7 bulundu" diye ilerler; kapalıysa biri yeterlidir
- `x`/`y` boşsa emoji objesi ilin merkezine oturur; aynı ilde birden fazla obje varsa çakışmasın diye otomatik dağıtılır
- Doğru cevap koordinata değil `iller` listesine bakar — objeyi sürüklemek cevabı bozmaz

**Konular kütüphanede yaşar.** `data.js` yalnızca ilk açılışta okunur; sonrası `localStorage`'a taşınır ve düzenleme ekranlarından yönetilir. Tohum veriye dönmek için: **Ayarlar › Konuları varsayılana döndür**.

## Ayarlar

**Genel (sağ üst ⚙):**
- *Birikimli öğrenme* — açıkken cevapladığın objeler haritada kalıcı olur ve üst üste birikir; kapalıyken sonraki soruya geçince kaybolur. Aynı ilde birden fazla obje varsa her biri ayrı ayrı işler: sadece cevaplanan görünür.
- *Yanlış cevapta bekleme süresi* — 1-10 sn arası kaydırıcı. Yanlış cevapladığında doğrusunun haritada kaldığı süre.

**Konu bazlı (kutucuğun köşesindeki ⚙ veya Soru Düzenle ekranı):**
- *İl isimleri görünsün* — harita üzerinde il adları
- *Objeler baştan görünsün* — açık: tüm objeler en baştan haritada durur, sana doğru ili işaretlemek kalır. Kapalı: gizli başlar, birikimli kuralına göre açılır
- *Cevap birimi* — bu konudaki soruların varsayılanı: İl / Bölge / Obje
- *İl sınırlarını kaldır* — çıplak Türkiye: il çizgileri kaybolur, yalnızca ülke dış hattı kalır (göller yerinde durur). Tıklama yine çalışır. Etkisi hem çalışma ekranında hem Harita Düzenle'de görünür
- *Hayalet mod* — aşağıya bak
- *Obje adları* — haritada hep görünsün / cevaptan sonra / hiç

### Hayalet mod

Objeler kimliklerini gizleyerek başlar: emoji yerine **❓**, çizgi ve alanlar **nötr gri**.
Şekil ve yer aynı kalır — obje modunda tıklanabilir olması gerekir — ama hangisinin ne
olduğu belli olmaz. Madenler konusunda dört maden baştan aynı görünür; **doğru bildiğin
maden o an gerçek şeklini alır** (bor 🧪, mermer ⬜…).

- Objenin **adı da gizlenir**; "Obje adları: hep görünsün" ayarı hayalet moddayken devre dışı kalır, ad ancak obje açılınca yazılır
- **Yanlış** cevapta doğrusu bekleme süresince gerçek şekliyle görünür, süre dolunca tekrar ❓ olur
- Açılan objenin **kalıcılığı** *Ayarlar › Birikimli öğrenme*'ye bağlıdır: açıksa konu boyunca açık kalır, kapalıysa sonraki soruda yeniden ❓ olur
- **Cevap birimi "İl" ise anahtar kapalıdır** — il sorusunda objenin şekli zaten cevabı vermez, gizlemenin bir kazancı olmaz
- Objelerin baştan görünmediği bir konuda devreye girmez; *Objeler baştan görünsün* ayarının da açık olması gerekir (cevap birimi "Obje" ise objeler zaten baştan görünür)

Konu ayarlarına **Ayarlar › Konu Ayarları**'ndan girilir (üstteki seçiciyle konu değiştirilir).

## Düzenleme

**Harita Düzenle** beş araçla çalışır (klavye: `1`–`5`):

| Araç | Ne yapar |
|---|---|
| 👆 **Seç** | Objeye tıkla → seç. Emojiyi sürükleyip taşı. Çizgi/alan seçiliyken noktalar tutamak olur, tek tek sürüklenir |
| 📍 **Yerleştir** | Paletten emoji ya da kendi görselini seç, haritada bir ile tıkla → obje eklenir |
| ✏️ **Çiz** | Tıklaya tıklaya nokta koy, çift tık veya `Enter` bitirir. Çizgi yumuşatılır, **geçtiği iller otomatik bulunur** |
| ⬛ **Alan** | Aynı şekilde çizersin, `Enter` alanı kapatır ve içi dolar. İklim/bitki örtüsü/plato için. **Kapsadığı iller otomatik bulunur** |
| 💬 **Baloncuk** | Seçili objenin üstünde bir noktaya tıkla → açıklama baloncuğu eklenir |

Haritanın sol üstünde iki düğme var:

- **⇄ Düzenle / ⇄ Çalış** — tek tıkla iki görünüm arasında gider gelir. Üstünde yazan, o an
  hangi görünümde olduğundur; tıklayınca diğerine geçer
- **🔍 Zoom pasif / aktif** — açıkken harita fare tekerleğiyle yakınlaşır (imlecin durduğu
  noktaya doğru) ve sürükleyerek gezilir; objeler bu sırada tıklanmaz, yanlışlıkla
  taşınmaz. **Kapattığında yakınlaşma korunur** — mantık şu: yakınlaştır, zoom'u kapat,
  objeyi hassasça yerleştir. Yakınlaştırılmışken yanlarında beliren **⤢** tam görünüme döner

Zoom yalnızca Harita Düzenle ekranında vardır; çalışma ekranındaki harita tam görünümde kalır.

Konu seçicideki sıra ana ekranla aynıdır; üst konuların altındaki konular kendi grubunda gruplanır.

Panel sırası: **paletten seçersin, listede seçersin, en altta işlersin** — Eklenecek emoji → Objeler listesi → Seçili obje. Bir objeye tıklayınca panel kendiliğinden görünür alana kayar.

Seçili objenin panelinde: ad, soru metni, **cevap birimi**, il listesi, *Hepsini bulmalı* anahtarı, baloncuklar; emojide boyut/döndürme, çizgide kalınlık/renk, alanda ayrıca **doluluk ve desen** (düz, çizgili, çapraz, noktalı, dalgalı, tuğla, iğne).

### Palet: emojiler ve kendi görsellerin

*Yerleştir* aracının altındaki palette önce **＋**, sonra yüklediğin görseller, sonra
yerleşik emojiler durur.

- **＋** ile PNG, JPG, WebP veya SVG eklersin. Raster dosyalar **128×128 PNG'ye küçültülür**
  (2 MB'lık bir fotoğraf ~15 KB'a iner); SVG metin olduğu için olduğu gibi saklanır
- Yüklenen görselin adı **dosya adından** çıkarılır (`bor-madeni_02.png` → "Bor madeni 02");
  üstündeki **✎** ile değiştirirsin
- Görseller kalıcı palete girer, **tüm konularda** kullanılabilir
- **✕** paletten kaldırır. Görsel objelerde kullanılıyorsa önce nerede kullanıldığını söyler;
  "yine de sil" dersen o objeler haritada 🖼️ olarak kalır
- Yerleşik emojiler de ✕ ile paletten kaldırılabilir (haritadaki objeleri etkilemez)
- Görsel objeleri emojiler gibi **boyut ve döndürme** kaydırıcılarıyla ayarlanır

Depo sınırı için yukarıdaki *Veri ve yedekleme* bölümüne bak.

### Cevap birimi

Bir sorunun neye tıklanarak cevaplanacağı. İki ayrı eksen olduğunu unutma: objenin **şekli** (emoji/çizgi/alan) ile **neye tıklanacağı** birbirinden bağımsızdır.

| Birim | Cevap |
|---|---|
| **İl** | Doğru ile tıklanır (varsayılan) |
| **Bölge** | Konuya girer girmez 7 bölge kendi renginde boyanır (isimsiz); bir ile tıklayınca o bölgenin tümü seçilir |
| **Obje** | Konudaki tüm objeler görünür olur, **objenin kendisine** tıklanır — "Hangisi Kızılırmak?" |

Obje modunda **iller tamamen pasiftir** — ne tıklanır ne renk değiştirir; sadece objeler tıklanabilir. Cevap verildikten sonra harita kilitlenir, fareyle gezmek işareti bozmaz.

Cevap birimi konu düzeyindedir — tek tek objelerde ayrı ayarı yoktur. Obje modunda cevap işareti objenin **rengini değiştirmez**: çizim kendi rengiyle kalır, etrafında nabız gibi yanan bir ışık halesi çıkar — doğruda yeşil, yanlış tıklamada kırmızı, doğru cevabı gösterirken sarı. (İşletim sisteminde "hareketi azalt" açıksa nabız yerine sabit hale görünür.) Yani aynı Akarsular konusunda hem "Kızılırmak hangi illerden geçer?" hem "Hangisi Kızılırmak?" sorulabilir. Obje modunda ince çizgileri ıskalamamak için çizginin üstünde görünmez kalın bir tıklama şeridi vardır.

### Baloncuklar

Objeye bağlı açıklama noktaları — boru hattı üzerindeki durakları, bir akarsuyun döküldüğü yeri işaretlemek için. Serbest başlık + isteğe bağlı il seçimi (il, baloncuğu koyduğun noktadan otomatik bulunur). Soru sırasında gizli, **cevaptan sonra** görünür.

### Hazır içerik

**Ayarlar › Hazır coğrafya içeriğini ekle** — 11 akarsu (Fırat, Kızılırmak, Dicle, Murat, Aras, Ceyhan, Meriç, Büyük Menderes, Kelkit, Simav, Sakarya) ve 6 göl/baraj (Van, Tuz, Beyşehir, Eğirdir, Atatürk, Keban) gerçek coğrafi verilerden çizili olarak gelir. Natural Earth 1:10m verisi (kamu malı), haritanın ölçeğine dönüştürülmüş. Mevcut konularına dokunmaz; eklendikten sonra hepsi düzenlenebilir ve silinebilir.

**Yedekleme:** Düzenle ekranının başlığındaki **⬇ Dışa aktar** her şeyi tek `.json` dosyasına indirir, **⬆ İçe aktar** geri yükler. Ayrıntı için *Veri ve yedekleme*.

**Soru Düzenle:** konu ayarları + o konudaki soruların listesi. Obje tabanlı olmayan konularda (İller, Bölgeler) elle soru ekleyebilirsin. Sağ üstteki *Konuyu sil* ile konuyu tamamen kaldırırsın.

**Yeni konu:** her iki düzenleme ekranındaki konu seçicinin en altındaki **➕ Yeni konu ekle…** seçeneği. Ad, açıklama, simge ve renk seçersin; konu anında ana ekrana düşer. Sorularını Harita Düzenle'den obje koyarak (ya da İller/Bölgeler gibi elle soru yazarak) doldurursun.

## Harita çerçevesi

`js/il-merkez.js` haritanın yerleşim verisini tutar:

- `IL_MERKEZ` — her ilin etiket/obje noktası ve kutu boyutu
- `IL_ETIKET_KAYDIR` — sıkışık illerde (Yalova, Kilis, Bartın…) etiketi elle kaydırma
- `HARITA_VIEWBOX` — çevre yazılarına yer açmak için genişletilmiş çerçeve
- `CEVRE_ETIKETLERI` — komşu ülkeler ve denizler `[x, y, metin, tip, boyut]`

Kıbrıs harita dışıdır (CSS'te gizli).

**Komşu ülke sınırları** (`js/komsular.js`) Natural Earth 1:50m verisinden üretildi (kamu malı). Türkiye SVG'sinin ölçeğine `x = 51·boylam − 1293.07`, `y = 68·(42.1 − enlem) + 11.8` dönüşümüyle oturtuldu; bu katsayılar 30 ilin gerçek koordinatıyla kalibre edildi (27/30 tam isabet, kalanlar kıyıda birkaç piksel). Sınırlar illerin **altında** çizilir ve tıklanamaz.

## Önemli: kod güncelleyince

Tarayıcının kendi HTTP önbelleği inatçıdır; dosya adı aynı kaldığı sürece eski sürümü
göstermeye devam edebilir. Bu yüzden **iki yeri birden** artır:

1. `index.html` içindeki `?s=27` → `?s=28` (CSS + 8 script, toplam 9 yerde)
2. `sw.js` içindeki `SURUM` (`cografyam-v28` → `-v29`) **ve** `DOSYALAR` listesindeki `?s=27` değerleri

Service worker "önce ağ, olmazsa önbellek" çalışır; sorgu dizesi de değişince tarayıcı
dosyayı yeni bir adres sayar ve önbelleği atlar. Yine de değişikliği göremiyorsan sabit yenile
(Ctrl+Shift+R) ya da geliştirici araçlarından *Disable cache*.

## Veri ve yedekleme

Her şey tarayıcının `localStorage`'ında durur:

- `cografyam.v1.profiller` · `cografyam.v1.aktifProfil`
- `cografyam.v1.kutuphane` — konular, objeler, sorular, konu ayarları
- `cografyam.v1.ustKonular` — ana ekrandaki gruplama kutuları
- `cografyam.v1.ayarlar` — genel ayarlar
- `cografyam.v1.ilerleme` — profil başına, konu başına kalınan soru ve sonuçlar
- `cografyam.v1.gunluk` — günlük soru/doğru sayacı
- `cografyam.v1.palet` — paletten kaldırılan emojiler + yüklenen görseller
- `cografyam.v1.pano` — obje kopyala/yapıştır panosu

**Yedek al.** Depo tarayıcıya bağlıdır: site verisini temizlersen her şey gider, geri dönüşü
yoktur. **Düzenle** ekranının başlığındaki **⬇ Dışa aktar** yukarıdaki anahtarların hepsini
tek bir `.json` dosyasına indirir; **⬆ İçe aktar** onu geri yükler (mevcut her şeyin
üzerine yazar, önce onay ister).

**Kota.** Tarayıcı origin başına ~5 MB verir ve her karakteri 2 bayt sayar. Metin verisi bu
sınırı zorlamaz (altı konu + yüzlerce obje ≈ 30 KB). Sınırı yalnızca yüklenen görseller
zorlar; 128×128'e küçültülmüş bir PNG depoda ~14-40 KB tuttuğu için kabaca 150-350 görsel
sığar. Kayıt kotaya takılırsa uygulama sessiz kalmaz, "Depo doldu" uyarısı çıkar ve o
değişikliğin **kaydedilmediğini** söyler.

Firebase'e geçince sadece `app.js` içindeki `Depo.oku` / `Depo.yaz` fonksiyonlarının içi değişecek.

## Ana ekran düzeni

Konular **üst konu** kutularında toplanır: arkada büyük renkli bir kapsayıcı, içinde küçük konu kutuları. Üst konu tıklanmaz, sadece çerçevedir. Bir üst konuya bağlı olmayan konular kapsayıcısız, tek başlarına durur.

**Ayarlar › Üst Konular** ekranından: `+` ile yeni kutu açarsın, emojisine/rengine tıklayarak değiştirirsin, `⠿` tutamağından sürükleyerek sıralarsın. Bir konuyu üst konunun içine sürüklersen o kutuya girer, dışarı çıkarırsan kapsayıcısız olur.

Konu kutusunda yalnızca emoji, ad ve durum düğmesi vardır. Durum düğmesi yazı içermez: dairesel ilerleme halkası + simge (▶ başla/devam, ✓ tamamlandı, ∅ soru yok). Yanındaki ↺ konuyu sıfırdan başlatır.

Başlığın altında **günlük özet** durur: o gün kaç soru çözdüğün, kaçının doğru olduğu ve yüzdesi. Profil başına ayrı tutulur, gece yarısı sıfırlanır.

## Roller

Profillerde `rol` alanı var; şu an herkes `admin`. Firebase turunda `ogrenci` rolü devreye girecek ve `adminMi()` false dönünce düzenleme menüleri ile konu dişlileri gizlenecek. Gerçek koruma (içeriği kimin değiştirebileceği) Firestore güvenlik kurallarıyla sunucu tarafında yapılacak.

## Klavye (bilgisayarda)

**Çalışma:** `←` önceki soru · `→` pas · `Boşluk` durdur/devam · `Esc` çıkış
**Harita Düzenle:** `1` Seç · `2` Yerleştir · `3` Çiz · `4` Alan · `5` Baloncuk · `Enter` çizimi bitir · `Esc` iptal

## Kaynak

Harita: [SVG Türkiye Haritası](https://github.com/dnomak/svg-turkiye-haritasi) — MIT Lisans, Doğukan Güven Nomak.
