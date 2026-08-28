/* ==========================================================
   Coğrafyam — bulut senkronu (Firestore, giriş yok)

   Kart Kutusu ile aynı mantık: oturum açma yok, herkes aynı veriyi
   görür. Uygulama açılır açılmaz Firestore'a bağlanır; konular,
   objeler ve ilerleme bütün cihazlarda ortaktır.

   localStorage kaldırılmadı, YEREL AYNA olarak kaldı. Uygulamanın geri
   kalanı hâlâ senkron `Depo.oku` ile okuyor; bu katman iki yönü bağlar:

     bulut -> yerel   onSnapshot geleni localStorage'a yazar, ekranı tazeler
     yerel -> bulut   Depo.yaz dürtülür, 800 ms bekletip toplu gönderir

   Böylece bütün ekranlar dokunulmadan çalışıyor ve internet yokken
   uygulama yerel aynadan okumaya devam ediyor.

   Koleksiyonlar:
     konular/{id}      konu, objeleri ve soruları
     ustKonular/{id}   ana ekran grupları
     gorseller/{id}    palet görselleri
     ayarlar/genel     genel ayarlar
     ilerleme/genel    konu başına kalınan yer ve sonuçlar
     gunluk/genel      günlük soru sayacı
   ========================================================== */

const Bulut = {
  acik: false,
  hazir: false,
  bagli: true,      // ilk bağlantı denemesi başarılı mı
  _db: null,
  _dinleyiciler: [],
  _bekleyen: new Set(),
  _zaman: null,
  _uygulanan: false,    // snapshot uygularken geri gönderme döngüsünü kes
  _tamamlandi: new Set(),   // buluta bir kez tamamlanan koleksiyonlar

  baslat() {
    if (typeof firebase === "undefined" || typeof FIREBASE_YAPILANDIRMA === "undefined") {
      console.warn("Firebase yüklenemedi — uygulama yalnızca bu cihazda çalışacak");
      return false;
    }
    firebase.initializeApp(FIREBASE_YAPILANDIRMA);
    this._db = firebase.firestore();

    /* Çevrimdışı kalıcılık: internetsizken de Firestore'dan okunur,
       yazılanlar sıraya girer ve bağlantı gelince gönderilir. */
    this._db.enablePersistence({ synchronizeTabs: true }).catch(e => {
      if (e.code === "failed-precondition") console.warn("Çevrimdışı kalıcılık: birden fazla sekme açık");
      else if (e.code === "unimplemented") console.warn("Tarayıcı çevrimdışı kalıcılığı desteklemiyor");
    });

    this.acik = true;
    this._ilkYukleme();
    return true;
  },

  /* Uygulama açılırken: bulutta içerik varsa onu bekle, yoksa bu
     cihazdakini yükle. Sonra dinlemeye geç.

     Süre sınırı neden var? Firestore bozuk yapılandırmada (yanlış
     projectId, silinmiş API anahtarı, ağın engellediği bir bağlantı)
     hata fırlatmıyor — sessizce asılıyor. Sınır olmasaydı uygulama
     açılış ekranında sonsuza kadar bekler, kullanıcı hiçbir şey
     yapamazdı. Süre dolarsa yerel aynayla açılır; bağlantı sonradan
     gelirse dinleyiciler zaten devreye girer. */
  async _ilkYukleme() {
    const SINIR = 6000;
    try {
      const anlik = await Promise.race([
        this._db.collection("konular").get(),
        new Promise((_, hata) => setTimeout(() => hata(new Error("zaman aşımı")), SINIR))
      ]);
      if (anlik.empty && Depo.oku("kutuphane", []).length) {
        await this.tumIcerigiGonder(true);   // ilk kurulum: yereli buluta taşı
      }
    } catch (e) {
      console.warn("İlk yükleme başarısız:", e);
      bildir("Buluta bağlanılamadı — şimdilik bu cihazda çalışılıyor");
      this.bagli = false;
    }
    this._dinlemeyeBasla();
    this.hazir = true;
    bulutHazir();
  },

  /* ---------------- bulut -> yerel ---------------- */
  _dinlemeyeBasla() {
    const ekle = d => this._dinleyiciler.push(d);

    ekle(this._db.collection("konular").onSnapshot(s => {
      const konular = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
      konular.sort((a, b) => (a.sira || 0) - (b.sira || 0));
      if (this._bosBulutuYoksay("kutuphane", konular)) return;
      this._yerelYaz("kutuphane", konular);
    }, e => this._hata("konular", e)));

    ekle(this._db.collection("ustKonular").onSnapshot(s => {
      const ustler = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
      ustler.sort((a, b) => (a.sira || 0) - (b.sira || 0));
      if (this._bosBulutuYoksay("ustKonular", ustler)) return;
      this._yerelYaz("ustKonular", ustler);
    }, e => this._hata("ustKonular", e)));

    ekle(this._db.collection("gorseller").onSnapshot(s => {
      const g = s.docs.map(d => ({ id: d.id, ad: d.data().ad, veri: d.data().veri }));
      const p = Depo.oku("palet", {}) || {};
      if (!g.length && (p.gorseller || []).length) return;
      this._yerelYaz("palet", { silinen: p.silinen || [], gorseller: g });
    }, e => this._hata("gorseller", e)));

    TEKIL_BELGELER.forEach(([anahtar, koleksiyon]) => {
      ekle(this._db.collection(koleksiyon).doc("genel").onSnapshot(d => {
        if (d.exists) this._yerelYaz(anahtar, d.data().kayit || {});
      }, e => this._hata(koleksiyon, e)));
    });
  },

  /* Bulut boş, yerelde içerik var: yereli SİLME — boş listeyi yerele
     yazmak bu cihazdaki her şeyi silmek olurdu.

     Ama yalnızca korumak yetmiyordu: bulut o koleksiyon için boş kaldığı
     sürece her açılışta uyarı çıkıyor ve durum hiç düzelmiyordu. Bu,
     bulut kurulduktan sonra hiç dokunulmamış bir koleksiyonun başına
     geliyor (gönderim ancak Depo.yaz ile tetikleniyor). Doğrusu eksiği
     tamamlamak: yereli bir kez yukarı gönder, sonrası normal akış. */
  _bosBulutuYoksay(anahtar, gelen) {
    if (gelen.length) return false;
    const yerel = Depo.oku(anahtar, []);
    if (!yerel.length) return false;

    if (!this._tamamlandi.has(anahtar)) {
      this._tamamlandi.add(anahtar);
      this._anahtariGonder(anahtar)
        .then(() => bildir("Bu cihazdaki içerik buluta yüklendi"))
        .catch(e => console.warn("Eksik içerik yüklenemedi:", anahtar, e));
    }
    return true;
  },

  _hata(nerede, e) {
    console.warn("Bulut dinleyici hatası:", nerede, e);
    if (e && e.code === "permission-denied") bildir("Bulut izni yok: " + nerede);
  },

  _yerelYaz(anahtar, deger) {
    this._uygulanan = true;
    try {
      localStorage.setItem(ONEK + anahtar, JSON.stringify(deger));
    } catch (e) {
      if (kotaHatasiMi(e)) depoDoluUyar();
    } finally {
      this._uygulanan = false;
    }
    bulutVerisiGeldi(anahtar);
  },

  /* ---------------- yerel -> bulut ---------------- */
  degisti(anahtar) {
    if (!this.acik || this._uygulanan) return;
    if (!BULUT_ANAHTARLARI.includes(anahtar)) return;
    this._bekleyen.add(anahtar);
    clearTimeout(this._zaman);
    this._zaman = setTimeout(() => this._gonder(), 800);
  },

  async _gonder() {
    const anahtarlar = [...this._bekleyen];
    this._bekleyen.clear();
    for (const a of anahtarlar) {
      try { await this._anahtariGonder(a); }
      catch (e) {
        console.warn("Buluta gönderilemedi:", a, e);
        /* Sessiz kalmak en kötüsü: kullanıcı sildiğini sanıp devam ediyor,
           sonraki snapshot değişikliği geri getiriyor ve neden olduğu
           anlaşılmıyor. Bu hata bir kez yaşandı — silme kuralı
           reddediyordu ve hiçbir yerde görünmüyordu. */
        bildir(e && e.code === "permission-denied"
          ? "Bulut değişikliği reddetti — bu değişiklik kaydedilmedi"
          : "Buluta gönderilemedi — bağlantıyı kontrol et");
      }
    }
  },

  _anahtariGonder(anahtar) {
    if (anahtar === "kutuphane")  return this._koleksiyonEsitle("konular", Depo.oku("kutuphane", []));
    if (anahtar === "ustKonular") return this._koleksiyonEsitle("ustKonular", Depo.oku("ustKonular", []));
    if (anahtar === "palet") {
      const p = Depo.oku("palet", {});
      return this._koleksiyonEsitle("gorseller",
        (p.gorseller || []).map(g => ({ id: g.id, ad: g.ad, veri: g.veri })));
    }
    const tekil = TEKIL_BELGELER.find(t => t[0] === anahtar);
    if (tekil) return this._db.collection(tekil[1]).doc("genel").set({ kayit: Depo.oku(anahtar, {}) });
  },

  /* Yerel listeyi koleksiyonla eşitler: eklenen/değişen yazılır,
     yerelde olmayan bulut belgesi silinir. */
  async _koleksiyonEsitle(koleksiyon, liste) {
    const ref = this._db.collection(koleksiyon);
    const mevcut = await ref.get();
    const yerelIdler = new Set(liste.map(x => x.id));
    const yigin = this._db.batch();

    liste.forEach(oge => {
      const kopya = Object.assign({}, oge);
      delete kopya.id;
      yigin.set(ref.doc(oge.id), kopya);
    });
    mevcut.docs.forEach(d => { if (!yerelIdler.has(d.id)) yigin.delete(d.ref); });

    await yigin.commit();
  },

  async tumIcerigiGonder(sessiz) {
    await this._koleksiyonEsitle("konular", Depo.oku("kutuphane", []));
    await this._koleksiyonEsitle("ustKonular", Depo.oku("ustKonular", []));
    const p = Depo.oku("palet", {});
    await this._koleksiyonEsitle("gorseller", (p.gorseller || []).map(g => ({ id: g.id, ad: g.ad, veri: g.veri })));
    for (const [anahtar, koleksiyon] of TEKIL_BELGELER) {
      await this._db.collection(koleksiyon).doc("genel").set({ kayit: Depo.oku(anahtar, {}) });
    }
    if (!sessiz) bildir("İçerik buluta yüklendi");
  }
};

/* Tek belgede duran kayıtlar: koleksiyon/genel */
const TEKIL_BELGELER = [["ayarlar", "ayarlar"], ["ilerleme", "ilerleme"], ["gunluk", "gunluk"]];

/* `pano` (kopyala-yapıştır) bilinçli olarak yerelde bırakıldı. */
const BULUT_ANAHTARLARI = ["kutuphane", "ustKonular", "palet", "ayarlar", "ilerleme", "gunluk"];
