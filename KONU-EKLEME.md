# Konu Ekleme Rehberi

Yeni bir konuyu tek bir kodla doldurmak için. Kod; konunun adını, ayarlarını,
haritaya konacak objeleri ve yazılı soruları bir arada taşır.

## Akış

1. Uygulamada **yeni konu** oluştur (ad önemli değil, koddan değişebilir).
2. İçeriği hazırla — elle ya da Claude'a anlatarak (aşağıdaki şablon).
3. **Düzenle › konu seçicinin yanındaki ⚙ › konu kartındaki ⬆ İçe aktar**.
4. Kodu kutuya yapıştır **ya da** 📄 Dosya seç ile `.json` dosyasını seç.
5. Konu doluysa seç: **Üstüne ekle** (var olanlar kalır) / **Hepsini değiştir**
   (objeler ve yazılı sorular silinir; ad, simge ve ayarlar yalnızca kodda
   yazıyorsa değişir).
6. Sorun yoksa pencere kapanır ve özet çıkar. Atlanan satır varsa pencere açık
   kalır, hangisi olduğunu yazar — gerisi yine eklenmiştir.

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

## `sorular` (yazılı sorular)

Haritaya obje koymadan sorulan sorular. Cevap haritada il ya da bölgeye
tıklanarak verilir.

| Biçim | Cevap |
|---|---|
| `{ "metin": "…", "il": "Konya" }` | Tek il |
| `{ "metin": "…", "iller": ["Balıkesir", "Kütahya"] }` | Birden fazla il |
| `{ "metin": "…", "bolge": "Karadeniz" }` | Bölge |

Cevabı olmayan (il de bölge de yazılmamış) soru atlanır.

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
