# Günlük görev (sınav planı) — taşınabilir mantık

Bir sınav tarihine kadar **tüm öğeleri** (kart, soru, konu…) tekrar tekrar
dolaştıran günlük çalışma listesi. Kart Kutusu'nda çalışan mantığın
uygulamadan bağımsız anlatımı: veritabanı, çatı ve arayüz seçimi serbest.

Özeti tek cümleyle: *sabit bir sırada baştan sona dönen bir imleç vardır; her
gün, o günün süresi dolana kadar sıradan öğe alınır; bilinemeyenler ertesi
günün başına yazılır.*

---

## 1. Temel kavramlar

| Kavram | Anlamı |
|---|---|
| **Öğe (item)** | Tekrar edilecek en küçük birim (kart, soru). `id`, metin ve grup bilgisi taşır. |
| **Sıra (order)** | Tüm öğelerin sabit sırası. Rastgele değildir, deterministiktir. |
| **İmleç (pos)** | Sırada kaçıncı öğeye gelindiği. |
| **Tur (pass)** | Sıranın kaç kez baştan sona dolaşıldığı. `pos` sona gelince `pass` artar ve `pos` sıfırlanır. |
| **Günlük süre (minutes)** | Kullanıcının ayırdığı dakika. Günün listesi bu süreye göre kurulur. |
| **Liste (list)** | Bugün çalışılacak öğe id'leri. Gün içinde **değişmez**. |
| **Borç (backlog)** | Önceki günlerden devreden öğeler: bilinemeyenler ve o gün yetişmeyenler. |

**Neden gün sonunda değil de gün başında sabit liste?** Kullanıcı gün içinde
"bugün ne kadar kaldı" sorusunun cevabının oynamasını istemez. Liste sabit
olduğu için ilerleme çubuğu ve kalan süre güvenilirdir.

---

## 2. Veri modeli

Kişi başına tek bir `dailyPlan` nesnesi. Kullanıcı hesabının altında tutmak
yeterlidir; ayrı koleksiyon gerekmez.

```jsonc
{
  "examDate": "2026-10-01",   // sınav günü (çalışılmaz)
  "minutes": 90,              // günlük süre

  "order": ["id1", "id2", "..."],  // tüm öğelerin sabit sırası
  "pos": 1240,                     // sıradaki öğenin indeksi
  "pass": 3,                       // kaçıncı tur (1'den başlar)

  "day": "2026-09-20",        // listenin ait olduğu gün
  "list": ["id7", "id9"],     // bugünün listesi (gün içinde sabit)
  "done": ["id7"],            // bugün cevaplananlar
  "failed": ["id9"],          // bugün bilinemeyenler → yarına
  "backlog": ["id42"],        // devreden, henüz listeye girmemiş borç
  "carriedCount": 12,         // bugünkü listenin kaçı borçtan geldi (gösterim)

  // Günün başındaki durum. Gün içinde süre değişirse liste bununla
  // yeniden kurulur; yoksa imleç ikinci kez ilerletilmiş olurdu.
  "dayStart": { "pos": 1100, "pass": 3, "backlog": ["id42", "id43"] }
}
```

Ayrıca hız ölçümü için kullanıcı belgesinde:

```jsonc
"speed": { "pred": 5231.4, "act": 6120.8, "n": 418 }
```

**Boyut:** `order` on binlerce id'ye kadar sorunsuzdur (1000 id ≈ 20 KB).
Öğe sayısı çok büyükse `order`'ı saklamak yerine deterministik bir
sıralamadan (ör. `groupName, createdAt, id`) her açılışta üretebilirsin;
o zaman yalnızca `pos` ve `pass` saklanır.

---

## 3. Süre tahmini

Günlük listenin kaç öğe alacağını bu belirler.

```
tahmin(öğe) = TABAN + (ön_metin.uzunluk + arka_metin.uzunluk) / KARAKTER_HIZI
              + (görsel varsa GÖRSEL_EK)

TABAN = 4 sn          // çevirme, düşünme, düğmeye basma
KARAKTER_HIZI = 15    // karakter/sn, gözle okuma
GÖRSEL_EK = 3 sn
```

**Kendini ayarlama.** Her cevapta, öğenin ekrana gelişiyle cevap arasındaki
süre ölçülür ve tahminle birlikte toplanır:

```
pred += tahmin(öğe)
act  += min(ölçülen_sn, 90)     // telefonu bırakınca sapmasın diye tavan
n    += 1
```

Sonra bütün tahminler bir çarpanla düzeltilir:

```
katsayı = (n < 20) ? 1 : clamp(act / pred, 0.5, 3)
gerçek_tahmin(öğe) = tahmin(öğe) * katsayı
```

20 örnekten önce düzeltme yapılmaz; çarpan 0,5–3 arasına sıkıştırılır ki tek
bir uzun mola bütün planı bozmasın. Ölçüm 0,5 sn'den kısaysa (yanlış dokunma)
sayılmaz.

---

## 4. Sıranın güncel tutulması

Her açılışta `order`, canlı öğe listesiyle uzlaştırılır:

```
pool  = kullanıcının görebildiği tüm öğeler, deterministik sırada
        (ör. grup adı → oluşturulma zamanı → id)
live  = pool'daki id kümesi

yeniOrder = []
yeniPos   = 0
for (id, i) in order:
    if id not in live: continue          // silinmiş öğe düşer
    if i < pos: yeniPos += 1             // imleç kaymasın diye sayılır
    yeniOrder.append(id)

for id in pool:                          // yeni öğeler sona eklenir
    if id not in yeniOrder: yeniOrder.append(id)
```

Silinen öğe imleci kaydırmaz; yeni öğe içinde bulunulan turun sonunda gelir.

---

## 5. Günün listesini kurmak

Gün değiştiyse (`plan.day != bugün`) önce borç toplanır, sonra liste kurulur.

```
// 5.1 — borç devri
borç = dün_bilinemeyenler          // failed
     + dünkü_listede_cevaplanmamışlar   // list - done
     + eski_borç                    // backlog
borç = tekrarsızlaştır(borç) ∩ live

dayStart = { pos, pass, backlog: borç }
```

```
// 5.2 — listeyi doldur (dayStart'tan başlar)
bütçe = minutes * 60
liste = []; kullanılan = 0; carried = 0
pos', pass' = dayStart.pos, dayStart.pass
borç' = dayStart.backlog kopyası

al(id):                       // tekrar eklemez
    liste.append(id)
    kullanılan += gerçek_tahmin(öğe(id))

// önce borç
while borç' boş değil and (liste boş or kullanılan < bütçe):
    al(borç'.shift()); carried += 1

// sonra sıradan, en fazla BİR TUR
for guard in 0..order.uzunluk-1:
    if not (liste boş or kullanılan < bütçe): break
    if pos' >= order.uzunluk: pos' = 0; pass' += 1
    al(order[pos']); pos' += 1

plan.list = liste; plan.backlog = borç'; plan.pos = pos'; plan.pass = pass'
plan.carriedCount = carried
plan.day = bugün; plan.done = []; plan.failed = []
```

Dikkat edilecek noktalar:

- **Koşul sırası:** `kullanılan < bütçe` kontrolü öğe eklenmeden *önce*
  yapılır, yani gün bütçeyi en fazla bir öğe kadar aşar. `liste boş` şartı,
  bütçe çok küçükse bile günde en az bir öğe gelmesini garantiler.
- **`guard` sayacı:** bir gün en fazla bir tur olabilir. Bütçe tüm öğelerden
  büyükse liste tüm öğeler olur, aynı gün ikinci tura girilmez.
- **Borç bütçeye dahildir.** Çok bilinemeyen bir günün ertesinde tur daha
  yavaş ilerler ama günlük süre sabit kalır. (Alternatif: borcu bütçenin
  üstüne eklemek — tur hızı sabit kalır, bazı günler uzar.)
- Bütçeye sığmayan borç `backlog`'da bekler, sonraki günlere taşar.

**Bu fonksiyon saf olmalı:** rastgelelik içermez, kaydetmeden çağrılabilir.
Böylece ana ekrandaki rozet (bugün kalan sayısı) planı diske yazmadan
hesaplanabilir ve kaydedilince aynı sonuç çıkar.

---

## 6. Cevapların işlenmesi

```
cevapla(kullanıcı, öğeId, doğru):
    plan = bugünkü_plan(kullanıcı)          // gerekirse yeni gün kurulur
    if öğeId not in plan.list: return       // bugünkü listede değil, dokunma
    if öğeId not in plan.done:   plan.done.append(öğeId)
    if not doğru and öğeId not in plan.failed: plan.failed.append(öğeId)
    kaydet(plan)
```

- **Bilinemeyen öğe aynı gün tekrar sorulmaz**, ertesi günün başına gelir.
  (Aynı gün de sormak istenirse listeye ikinci kez eklenir; o zaman günlük
  süre tahmini sapar.)
- **Çift çalışmayı önleme:** kullanıcı öğeyi başka bir ekranda (normal
  çalışma, arama, serbest tekrar) cevaplasa bile aynı fonksiyon çağrılır;
  öğe bugünkü listedeyse görevden düşer.
- **Çok kullanıcılı kullanım:** bir cevap birden fazla kişiyi etkiliyorsa
  (birlikte çalışma) her kişi için ayrı ayrı çağrılır. Görevi hiç açmamış
  kişinin planı yoksa atlanır.
- **Geri al:** çağrıdan önce `{done, failed}` kopyası saklanır; geri alınca
  bu iki dizi eski haline yazılır.

---

## 7. Gün içinde süre değişirse

```
ayarla_süre(dakika):
    plan = bugünkü_plan()
    plan.minutes = dakika
    listeyi_doldur(plan)                       // dayStart'tan yeniden
    // bugün çalışılmış ama yeni listeye girmeyenler kaybolmasın
    plan.list = [...done - liste] + plan.list
    kaydet(plan)
```

`dayStart` olmadan bu işlem imleci ikinci kez ilerletir ve öğeler atlanır.

---

## 8. Gösterilen değerler

```
kalanGün      = tamsayı_gün(examDate - bugün)        // sınav günü hariç
toplam        = order.uzunluk
ortSüre       = order üzerindeki gerçek_tahmin ortalaması
günlükKapasite= min(toplam, minutes * 60 / ortSüre)  // bir gün ≤ bir tur
turİlerlemesi = (pass - 1) + pos / toplam
gelecekGün    = max(0, kalanGün - 1)                 // bugünün listesi kurulu
tahminiTur    = turİlerlemesi + gelecekGün * günlükKapasite / toplam
```

- `tahminiTur ≥ 1` → "Bu tempoyla her öğe yaklaşık **2,4 kez** tekrar edilir."
- `tahminiTur < 1` → uyarı ve gereken süre:

```
gerekenDakika = ceil((1 - turİlerlemesi) * toplam * ortSüre / gelecekGün / 60)
```

Ekranda ayrıca: bugünkü `done/list` ilerleme çubuğu, kalan öğe ve kalan süre,
`carriedCount` varsa "önceki günlerden kalan N öğe", tur numarası ve yüzdesi.

Ana ekran rozeti: kalan öğe sayısı; sıfırsa onay işareti.

---

## 9. Çalışma oturumu

```
başlat():
    plan = bugünkü_plan(); kaydet_gerekiyorsa(plan)
    kuyruk = plan.list.filter(id => öğe_var(id) and id not in plan.done)
    if kuyruk boş: return
    // kuyruk sırayla dolaşılır; yanlış cevapta öğe sona atılmaz
    // kuyruk bitince oturum biter
```

Görev kuyruğu kalıcı değildir; kalıcı olan `plan.done`. Uygulama kapanıp
açılsa bile "kalan" doğru hesaplanır. Bu yüzden görev kuyruğu, varsa
uygulamanın kendi çalışma sırası/rotasyon kaydına **yazmamalıdır**.

---

## 10. Sınır durumları

| Durum | Davranış |
|---|---|
| Hiç öğe yok | Rozet gizlenir, görev ekranı boş durum gösterir. |
| Öğe silindi | `order`, `list`, `backlog` okunurken canlı id'lerle süzülür. |
| Gün atlandı | O günün listesi hiç kurulmaz; ertesi gün hepsi borç olur. |
| Birden çok gün atlandı | Borç birikir, her gün bütçe kadarı işlenir. |
| Sınav günü geçti | Uyarı gösterilir, tarih değiştirilebilir; liste kurulmaya devam eder. |
| Bütçe tek öğeden küçük | Günde en az bir öğe gelir. |
| Bütçe tüm öğelerden büyük | Liste bir turla sınırlıdır. |
| Saat dilimi / gece yarısı | Gün anahtarı **yerel tarihten** üretilir (`YYYY-M-D`). Ayrı bir sıfırlama işi gerekmez; yeni gün, ilk açılışta anlaşılır. |

---

## 11. Test kontrol listesi

Sahte bir tarih kaynağı (`Date` sarmalayıcı) ile günler ilerletilerek:

1. Süre seçimine göre liste uzunluğu ve toplam tahmini sürenin bütçeyi tutması.
2. Bilinemeyen öğenin ertesi günün **başında** gelmesi.
3. Bir gün atlanınca yetişmeyenlerin öne taşınması.
4. Gün ortasında süre değişince çalışılanların listede kalması, imlecin
   ikinci kez ilerlememesi.
5. Geri al işleminin `done`/`failed` üzerindeki etkisi.
6. Görev dışı bir ekranda verilen cevabın görevden düşmesi.
7. Yeni öğenin sıranın sonuna eklenmesi, silinen öğenin imleci kaydırmaması.
8. Tur sonunda `pass` artışı ve baştan başlama.
9. Sınav tarihi değişince kalan gün ve tahmini tur sayısının güncellenmesi.
10. Tahmini tur sayısının, günde en fazla bir tur kuralını aşmaması.

---

## 12. Bu mantığın bilinçli sınırları

- **Aralıklı tekrar (SM-2 / Anki) değildir.** Öğenin ne zaman geleceğini
  zorluk değil, sabit sıra belirler. Amaç "sınava kadar her şeyi N kez
  görmek"tir, uzun vadeli hatırlama eğrisi değil.
- Zor öğeler yalnızca bilinemedikleri gün bir kez öne alınır; kalıcı bir
  öncelik kazanmazlar. İstenirse `failed` geçmişi sayılıp bu öğeler her turda
  öne alınabilir.
- Konular gün içinde karıştırılmaz; sıra grup grup ilerler. Karıştırmak için
  `pool` sıralamasını değiştirmek yeterlidir (sıra deterministik kaldığı
  sürece geri kalan mantık aynı çalışır).
