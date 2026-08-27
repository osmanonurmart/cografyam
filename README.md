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

1. `index.html` içindeki `?s=32` → `?s=33` (9 yerde)
2. `sw.js` içindeki `SURUM` **ve** `DOSYALAR` listesindeki `?s=32`

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
- **Cevap birimi konu düzeyinde:** İl / Bölge / Obje. Tek tek objelerde ayarı yok.
- **Hayalet mod** yalnızca cevap birimi "İl" olmayan konularda açılır.
- **İl sınırlarını kaldır:** kaynak SVG'de komşu iller birbirine tam değmiyor.
  Hem maskeye hem illere aynı renkte kontur veriliyor, altına da tek parça zemin
  seriliyor — üçü birden olmazsa sınırlar geri geliyor.
- **Depo sınırı** origin başına ~5 MB ve her karakter 2 bayt sayılıyor. Metin bu
  sınırı zorlamaz; yalnızca yüklenen görseller zorlar (128×128 PNG ≈ 14-40 KB).
- **Yedek:** Düzenle ekranındaki ⬇ Dışa aktar / ⬆ İçe aktar.

### Kaynak

Harita: [SVG Türkiye Haritası](https://github.com/dnomak/svg-turkiye-haritasi) — MIT, Doğukan Güven Nomak.
Komşu sınırlar ve hazır içerik: Natural Earth (kamu malı).
