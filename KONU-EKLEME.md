# Konu Ekleme Rehberi

Yeni bir konuyu tek bir kodla doldurmak için. Kod; konunun adını, ayarlarını,
haritaya konacak objeleri ve yazılı soruları bir arada taşır.

## Akış

İki yerden içe aktarılabilir. İkisinde de kodu kutuya yapıştırabilir **ya
da** 📄 Dosya seç ile `.json` dosyasını seçebilirsin.

### Düzenle ekranının üstündeki ⬆ İçe aktar — en kolayı

Önceden konu oluşturmaya gerek yok; dosyanın ne olduğunu uygulama anlar:

- **Konu kodu** → koddaki `konu.ad`'a bakılır (yoksa dosya adı:
  `gediz-grabeni.json` → "Gediz grabeni").
  - Bu adda konu **yoksa** yeni konu oluşturulur.
  - **Varsa** sorar: **Yeni konu** ("Ad (2)" olarak açılır) / **Üzerine yaz**
    (objeler ve sorular silinip yenileri konur) / **İptal**.
  - Sonra Düzenle ekranı o konuya geçer.
- **Tüm uygulama yedeği** (`cografyam-yedek-….json`) → "her şey bununla
  değiştirilecek" onayı sorulur, sonra geri yüklenir.

### Konu ayarlarındaki ⬆ İçe aktar — açık konuya

1. **Düzenle › konu seçicinin yanındaki ⚙ › konu kartındaki ⬆ İçe aktar**.
2. Konu doluysa seç: **Üstüne ekle** (var olanlar kalır) / **Hepsini değiştir**
   (objeler ve yazılı sorular silinir; ad, simge ve ayarlar yalnızca kodda
   yazıyorsa değişir).

Her iki yolda da sorun yoksa pencere kapanır ve özet çıkar. Atlanan satır
varsa pencere açık kalır, hangisi olduğunu yazar — gerisi yine eklenmiştir.

## Kodun iskeleti

Her bölüm isteğe bağlı. Yazılmayan her şey olduğu gibi kalır.

```json
{
  "konu":    { "ad": "…", "ikon": "…", "renk": "#……", "aciklama": "…" },
  "ayar":    { "cevapBirimi": "…", "ilIsimleri": true, "ilSinirlari": true,
               "hayalet": false, "objeGorunur": true, "objeAdlari": "cevapta" },
  "objeler": [ { "ad": "…", "emoji": "…", "iller": ["…"] } ],
  "sorular": [ { "metin": "…", "il": "…" } ]
}
```

## `konu`

| Alan | Ne yapar | Not |
|---|---|---|
| `ad` | Konu adı | En çok 28 karakter |
| `ikon` | Konunun simgesi | Herhangi bir emoji |
| `renk` | Kart rengi | `#f59e0b` biçiminde, 6 haneli |
| `aciklama` | Kısa açıklama | En çok 40 karakter |
| `bilgi` | Konunun genel bilgisi (bilgi kutusu) | Objenin kendi bilgisi yoksa gösterilir |

## `ayar`

| Alan | Değerler | Ekrandaki karşılığı |
|---|---|---|
| `cevapBirimi` | `il` · `bolge` · `obje` · `alan` · `cizgi` | Cevap birimi |
| `ilIsimleri` | `true` / `false` | İl isimleri görünsün |
| `ilSinirlari` | `true` / `false` | İl sınırları görünsün |
| `hayalet` | `true` / `false` | Hayalet mod (birim "il" iken çalışmaz) |
| `objeGorunur` | `true` / `false` | Seçim birimi baştan görünsün |
| `objeAdlari` | `gorunsun` · `cevapta` · `hic` | Seçim birimi adları |
| `birikmesin` | `true` / `false` | Cevaplananlar haritada birikmesin |
| `ilCevapta` | `true` / `false` | Cevapta ilin adı da yazsın (varsayılan açık) |

`birikmesin: true` → genel Ayarlar'daki **Birikimli öğrenme** açık olsa bile bu
konuda cevaplanan objeler ve il adları sonraki soruda kaybolur. Soruların
cevapları iç içe geçen konular için (ör. YHT: hat soruları, genel sorunun
alt kümesi) — yoksa haritada kalan simgeler cevabı ele verir.

Cevap birimi için ekrandaki adlar da geçer: `"Obje"`, `"Bölge"`…

## `objeler`

Haritaya konan her obje aynı zamanda bir sorudur.

| Alan | Ne yapar | Örnek |
|---|---|---|
| `ad` | Objenin adı, sorunun konusu | `"Demir"` |
| `emoji` | Haritadaki simge. Yoksa 📍 | `"🔩"` |
| `iller` | Bulunduğu iller — liste ya da virgüllü metin | `["Sivas", "Malatya"]` · `"Sivas, Malatya"` |
| `il` | Tek il için kısa yol (`iller` ile birlikte de olur) | `"Zonguldak"` |
| `ilce` | Bütün illere aynı ilçe | `"Soma"` |
| `cerceve` | Çerçeve. Şimdilik tek seçenek | `"işleniyor"` |
| `ekGoster` | `false` → sorunun sonundaki parantez çıkmaz | `false` |
| `boyut` | Simge büyüklüğü, varsayılan 2 | `3` |
| `sorular` | Otomatik soru yerine senin metnin(ler)in | `["Bakır nerede çıkarılır?"]` |
| `bilgi` | Bilgi kutusu metni (en çok 1200 karakter) | `"Bakır: Murgul'da çıkarılır…"` |
| `x`, `y`, `aci` | Konum ve açı (yalnızca tek ilde) | Dışa aktarılan koddan gelir |
| `gorselId`, `baloncuklar` | Görsel ve baloncuklar | Dışa aktarılan koddan gelir |

**İlçe, ile özel:** `"iller": ["Balıkesir/Bigadiç", "Eskişehir/Kırka"]`

### Nasıl soruya dönüşür

- **Aynı ad = tek soru.** Demir üç ilde işaretliyse soru bir tanedir, üçünü de
  bulman gerekir.
- **Çerçeve ayırır.** `"Boksit"` ile `"Boksit"` + `"cerceve": "işleniyor"` iki ayrı
  soru olur.
- **Adsız objeler birleşmez**, her biri ayrı sorudur.
- **Otomatik metin** cevap birimine göre:
  - obje → *Hangisi Demir?*
  - il → *Demir hangi ilimizdedir?* / *hangi illerimizdedir?*
  - bölge → *Demir hangi bölgemizdedir?*
- İlçe ve çerçeve sona eklenir: *Hangisi Bor? (Bigadiç, Kırka)*,
  *Hangisi Boksit? (işleniyor · Seydişehir)*. `ekGoster: false` bunu kapatır.
- `sorular` yazılırsa otomatik metin kullanılmaz, parantez de eklenmez — metnin
  tamamı senin. Birden fazla metin yazarsan her biri ayrı soru olur.

### Haritada nereye konur

Her il için ayrı bir obje, il yazısının yanına konur. Aynı ile birden fazla obje
düşerse etrafa dağıtılır. Beğenmezsen Düzenle ekranında sürükleyebilirsin —
sürüklemek cevabı bozmaz, doğru cevap koordinata değil ile bakar.

## Alan ve çizgi objeleri

Dağ, ova, havza (alan) ya da akarsu, fay hattı (çizgi) gibi şekiller.

```json
{ "tip": "alan", "ad": "Bozdağlar", "renk": "#22c55e", "saydamlik": 0.6,
  "noktalar": [[104.2, 243.1], [108.9, 240.6], …] }
```

| Alan | Ne yapar | Not |
|---|---|---|
| `tip` | `alan` ya da `cizgi` | Yoksa emoji obje sayılır |
| `noktalar` | Şeklin köşeleri, `[x, y]` | Alan en az 3, çizgi en az 2 nokta |
| `renk` | Dolgu/çizgi rengi | `#22c55e` biçiminde. Yoksa mavi |
| `desen` | `duz` · `cizgili` · `tarali` · `noktali` · `dalgali` · `tugla` · `igne` | Yalnızca alanda |
| `saydamlik` | 0–1 arası | Varsayılan 0.45 |
| `kalinlik` | Kenar/çizgi kalınlığı | Alan 1.4, çizgi 3 |
| `iller` | Cevap illeri | Yazılmazsa şeklin geçtiği iller hesaplanır |
| `sorular` | Kendi soru metnin | Yoksa *Hangisi Bozdağlar?* |

**`noktalar` enlem-boylam değildir**, uygulamanın harita koordinatıdır
(x 0–1007, y 0–527). Uygulamanın haritası stilize bir çizim olduğu için gerçek
koordinat basit bir formülle doğru yere düşmüyor — Ege'de 25 birime kadar
kayıyor. Noktaları Claude dışarıda hazırlar:

- **Ders kitabı haritasından:** Resimdeki Türkiye sınırı uygulamanın haritasına
  otomatik oturtulur, renkli lekeler izlenip taşınır. Sonuç kitaptakinin
  kopyasıdır. (Kırık Dağlar böyle yapıldı.)
- **Gerçek araziden:** Yükselti verisinden şekil çıkarılır, il sınırlarına
  göre haritaya esnetilir. Coğrafi olarak daha doğru, kitaptan farklı görünebilir.

Aynı adı taşıyan birden fazla alan tek soru olur (ör. parçalı bir dağ).
Cevap birimi `alan` ise alana tıklanarak cevaplanır. Şekli beğenmezsen
Düzenle ekranında noktaları sürükleyebilirsin.

## `sorular` (yazılı sorular)

Haritaya obje koymadan sorulan sorular. Cevap haritada il ya da bölgeye
tıklanarak verilir.

| Biçim | Cevap |
|---|---|
| `{ "metin": "…", "il": "Konya" }` | Tek il |
| `{ "metin": "…", "iller": ["Balıkesir", "Kütahya"] }` | Birden fazla il |
| `{ "metin": "…", "bolge": "Karadeniz" }` | Bölge |
| `{ "metin": "…", "objeler": ["Menteşe Dağları", "Amanoslar"] }` | Haritadaki şekiller |

`objeler` yazarsan cevap haritadaki o objelere tıklanarak verilir ve
**hepsi bulunmalıdır** — birden fazla dağı tek soruda toplamanın yolu budur
(*"Kıyıya paralel uzanan dağlar hangileridir?"*). Adlar aynı koddaki ya da
konuda zaten duran objelerle eşleştirilir; büyük/küçük harf ve Türkçe
karakter önemsizdir. Bu **ayrı bir kayıttır**: Menteşe ve Amanos kendi
kartlarında kalır, *"Hangisi Menteşe Dağları?"* soruları da sorulmaya
devam eder.

Cevabı olmayan (il, bölge ya da tanınan obje yazılmamış) soru atlanır.

Yazılı sorulara da `"bilgi": "…"` eklenebilir.

## Bilgi kutusu

Çalışırken haritanın sol altında **ℹ Bilgi — — —** kutusu durur; fareyle
üstüne gelince (telefonda dokununca) açılır, her soruda yeniden kapanır.
Gösterilen metin: yazılı sorunun kendi `bilgi`si → cevap objelerinin
`bilgi`leri (en çok 3 farklı metin) → konunun `bilgi`si. Hiçbiri yoksa kutu
görünmez. Düzenle ekranında her kartta "Bilgi kutusu" bölümü vardır.

### Bilgi paketi — yalnızca metinleri eklemek

Konu kodu içe aktarmak objeleri yeniden yazar. Yalnızca bilgi metinlerini
eklemek (şekillere, konumlara, sorulara dokunmadan) için Düzenle › İçe aktar'a:

```json
{ "bilgiPaketi": [
  { "konu": "Kıyı Tipleri",
    "bilgi": "Konunun genel bilgisi",
    "objeler": { "Ria Kıyı": "Ria kıyı: …", "Boyuna Kıyı": "…" },
    "sorular": { "Ria kıyılar hangileridir?": "…" } }
] }
```

Konu ve obje **adıyla** eşleşir (Türkçe karakter/büyük harf önemsiz); `konu`
bir ad listesi de olabilir. Bulunamayanlar pencerede yazılır.

## Dışa aktarma ve geri yükleme

Düzenle › **⬇ Dışa aktar** üç seçenek sunar:

| Seçenek | Ne iner | Geri yükleme |
|---|---|---|
| Tek konu | Bu belgedeki biçimde konu kodu | İçe aktar › aynı adlı konu için Yeni / Üzerine yaz |
| Tüm konular | `{ "konular": [konuKodu, …] }` | Her konu için sorulur; "kalanların hepsine uygula" ile bir kez |
| Tüm uygulama | Yedek (ilerleme dahil) | "Yalnızca içerik" ya da "İçerik + ilerleme" |

**İlerleme kaybolmaz:** "Üzerine yaz" konunun kimliğini korur; günlük tekrar
kayıtları "konu + soru metni" ile tutulduğu için metni değiştirmediğin
sorularda istatistik aynen kalır. Dışa aktar → düzenle → içe aktar kayıpsızdır
(konumlar, şekiller, görseller, baloncuklar, bilgi metinleri geri gelir).

## Adlar nasıl eşleşir

- Büyük/küçük harf ve Türkçe karakter önemsiz: `"mugla"`, `"MUĞLA"`, `"Mugla"` hepsi Muğla.
- Kısaltmalar: **Afyon**, **Maraş**, **Urfa**, **Antep**, **İçel**.
- Bölgeler: `Marmara`, `Ege`, `Akdeniz`, `İç Anadolu`, `Karadeniz`, `Doğu Anadolu`,
  `Güneydoğu Anadolu`. Kısa hali (`"Doğu"`, `"Güneydoğu"`, `"İç"`) ve
  `"… Bölgesi"` de olur.
- Tanınmayan il ya da bölge olan satır atlanır ve pencerede yazılır.

## Hoşgörülen hatalar

- Kodun başında/sonunda ```` ```json ```` çitleri
- `}` ya da `]` öncesinde, ya da en sonda fazladan virgül

Tam yedek dosyası (`cografyam-yedek-….json`) buraya **yüklenmez** — o, Düzenle
ekranının üstündeki ⬆ İçe aktar ile geri yüklenir.

## Tam örnek

```json
{
  "konu": { "ad": "Madenler", "ikon": "⛏️", "renk": "#f59e0b", "aciklama": "Madenler hangi ilde çıkar?" },
  "ayar": { "cevapBirimi": "obje", "ilIsimleri": false, "objeGorunur": true, "objeAdlari": "cevapta" },
  "objeler": [
    { "ad": "Demir", "emoji": "🔩", "iller": ["Sivas/Divriği", "Malatya/Hekimhan", "Kayseri/Yahyalı"] },
    { "ad": "Krom", "emoji": "⚫", "iller": "Elazığ, Muğla, Eskişehir" },
    { "ad": "Bor", "emoji": "⚪", "iller": ["Balıkesir/Bigadiç", "Eskişehir/Kırka", "Kütahya/Emet"] },
    { "ad": "Bakır", "emoji": "🟠", "iller": ["Artvin/Murgul", "Kastamonu/Küre", "Elazığ/Maden"],
      "sorular": ["Bakır hangi illerimizde çıkarılır?"] },
    { "ad": "Boksit", "emoji": "🟤", "iller": ["Antalya/Akseki"] },
    { "ad": "Boksit", "emoji": "🟤", "iller": ["Konya/Seydişehir"], "cerceve": "işleniyor" },
    { "ad": "Linyit", "emoji": "🪨", "iller": ["Kahramanmaraş/Afşin", "Manisa/Soma", "Muğla/Yatağan"], "ekGoster": false },
    { "ad": "Taşkömürü", "emoji": "⬛", "il": "Zonguldak", "boyut": 3 }
  ],
  "sorular": [
    { "metin": "Türkiye'nin tek taşkömürü havzası hangi bölgededir?", "bolge": "Karadeniz" },
    { "metin": "Seydişehir Alüminyum Tesisleri hangi ilimizdedir?", "il": "Konya" }
  ]
}
```

## Claude'a içerik verirken

Serbest yazman yeterli. İşe yarayan bilgiler:

```
Konu: Madenler  (simge: ⛏️, renk: turuncu)
Cevap birimi: obje
Ayarlar: il isimleri kapalı, objeler baştan görünsün

Demir: Sivas (Divriği), Malatya (Hekimhan)
Bor: Balıkesir (Bigadiç), Eskişehir (Kırka)
Boksit işleniyor: Konya (Seydişehir)
Linyit: Manisa, Muğla — parantez gösterme

Yazılı sorular:
- Taşkömürü havzası hangi bölgede? → Karadeniz
```
