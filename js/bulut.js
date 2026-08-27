/* ==========================================================
   Coğrafyam — bulut senkronu (Firebase Auth + Firestore)

   Tasarım kararı: localStorage kaldırılmadı, YEREL AYNA olarak kaldı.
   Uygulamanın geri kalanı hâlâ senkron `Depo.oku` ile okuyor; bu katman
   yalnızca iki yönü bağlıyor:

     bulut -> yerel   onSnapshot dinleyicileri geleni localStorage'a yazar
                      ve ekranı tazeler
     yerel -> bulut   Depo.yaz her yazdığında burayı dürter, 800 ms
                      bekletip toplu gönderir

   Böylece tüm ekranlar olduğu gibi çalışmaya devam ediyor ve çevrimdışıyken
   uygulama yerel aynadan okumaya devam ediyor.

   Veri modeli:
     konular/{id}                     içerik — herkes okur, yönetici yazar
     ustKonular/{id}                  içerik
     gorseller/{id}                   içerik (palet görselleri)
     yoneticiler/{uid}                rol listesi, istemci yazamaz
     kullanicilar/{uid}               hesap bilgisi
     kullanicilar/{uid}/veri/ilerleme kişisel
     kullanicilar/{uid}/veri/ayarlar  kişisel
     kullanicilar/{uid}/veri/gunluk   kişisel
   ========================================================== */

const Bulut = {
  acik: false,          // Firebase yüklendi ve başlatıldı mı
  kullanici: null,      // firebase.User
  yonetici: false,      // içerik yazma yetkisi
  ilkYuklemeBitti: false,
  _db: null,
  _auth: null,
  _dinleyiciler: [],
  _bekleyen: new Set(),
  _zaman: null,
  _uygulanan: false,    // snapshot uygularken Depo.yaz döngüsünü kes

  /* ---------------- başlatma ---------------- */
  baslat() {
    if (typeof firebase === "undefined" || typeof FIREBASE_YAPILANDIRMA === "undefined") {
      console.warn("Firebase yüklenemedi — uygulama yalnızca bu cihazda çalışacak");
      return false;
    }
    firebase.initializeApp(FIREBASE_YAPILANDIRMA);
    this._auth = firebase.auth();
    this._db = firebase.firestore();

    /* Çevrimdışı kalıcılık: uygulama internetsizken de Firestore'dan okur,
       yazılanlar sıraya girer ve bağlantı gelince gönderilir. */
    this._db.enablePersistence({ synchronizeTabs: true }).catch(e => {
      if (e.code === "failed-precondition") console.warn("Çevrimdışı kalıcılık: birden fazla sekme açık");
      else if (e.code === "unimplemented") console.warn("Tarayıcı çevrimdışı kalıcılığı desteklemiyor");
    });

    this.acik = true;
    this._auth.onAuthStateChanged(k => this._oturumDegisti(k));
    return true;
  },

  /* ---------------- oturum ---------------- */
  async girisYap() {
    const saglayici = new firebase.auth.GoogleAuthProvider();
    saglayici.setCustomParameters({ prompt: "select_account" });
    try {
      await this._auth.signInWithPopup(saglayici);
    } catch (e) {
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return;
      if (e.code === "auth/unauthorized-domain") {
        bildir("Bu adres Firebase'de yetkili değil — Authentication › Settings › Authorized domains");
        return;
      }
      /* Pop-up engelliyse yönlendirmeli akışa düş */
      if (e.code === "auth/popup-blocked") { this._auth.signInWithRedirect(saglayici); return; }
      bildir("Giriş yapılamadı: " + (e.message || e.code));
    }
  },

  async cikisYap() {
    this._dinleyicileriKapat();
    await this._auth.signOut();
    location.reload();
  },

  async _oturumDegisti(k) {
    this._dinleyicileriKapat();
    this.kullanici = k;
    this.yonetici = false;
    this.ilkYuklemeBitti = false;

    if (!k) { girisEkraniniGoster(); return; }

    // rol: yoneticiler/{uid} belgesi varsa içerik yazabilir
    try {
      const y = await this._db.collection("yoneticiler").doc(k.uid).get();
      this.yonetici = y.exists;
    } catch (e) { this.yonetici = false; }

    await this._hesabiYaz(k);
    await this._ilkEsitleme();
    this._dinlemeyeBasla();
    oturumHazir(k);
  },

  _hesabiYaz(k) {
    return this._db.collection("kullanicilar").doc(k.uid).set({
      ad: k.displayName || "",
      eposta: k.email || "",
      foto: k.photoURL || "",
      sonGiris: Date.now()
    }, { merge: true }).catch(e => console.warn("Hesap yazılamadı", e));
  },

  /* ---------------- ilk eşitleme ----------------
     Bulutta içerik yoksa ve bu cihazda varsa, yöneticiye yükleme teklifi
     yapılır. Tersi durumda bulut yereli ezer — bulut daima kaynaktır. */
  async _ilkEsitleme() {
    const anlik = await this._db.collection("konular").limit(1).get();
    const bulutBos = anlik.empty;
    const yerel = Depo.oku("kutuphane", []);

    if (bulutBos && this.yonetici && yerel.length) {
      const tamam = await onay(
        `Bulutta henüz içerik yok. Bu cihazdaki ${yerel.length} konuyu buluta yükleyeyim mi?\n\n` +
        `Yükledikten sonra bütün cihazlarında aynı konular görünür.`,
        { baslik: "İçeriği buluta taşı", ikon: "☁", evet: "Yükle", tehlikeli: false });
      if (tamam) await this.tumIcerigiGonder();
    }
  },

  /* ---------------- bulut -> yerel ---------------- */
  _dinlemeyeBasla() {
    const uid = this.kullanici.uid;
    const ekle = (d) => this._dinleyiciler.push(d);

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
      if (!g.length && (p.gorseller || []).length) return;   // bkz. _bosBulutuYoksay
      this._yerelYaz("palet", { silinen: p.silinen || [], gorseller: g });
    }, e => this._hata("gorseller", e)));

    const veri = this._db.collection("kullanicilar").doc(uid).collection("veri");
    ekle(veri.doc("ilerleme").onSnapshot(d => {
      if (d.exists) this._yerelYaz("ilerleme", d.data().kayit || {});
    }, e => this._hata("ilerleme", e)));
    ekle(veri.doc("ayarlar").onSnapshot(d => {
      if (d.exists) this._yerelYaz("ayarlar", d.data().kayit || {});
    }, e => this._hata("ayarlar", e)));
    ekle(veri.doc("gunluk").onSnapshot(d => {
      if (d.exists) this._yerelYaz("gunluk", d.data().kayit || {});
    }, e => this._hata("gunluk", e)));
  },

  /* Bulut boş, yerelde içerik var: yereli SİLME.
     Bu durum iki şekilde oluşur — henüz hiçbir şey yüklenmemiştir ya da
     kullanıcı yönetici olmadığı için yükleme yapılamamıştır. İkisinde de
     boş listeyi yerele yazmak, kişinin bu cihazdaki bütün konularını
     silmek demek olurdu. Bulut dolduğu anda normal akış devam eder. */
  _bosBulutuYoksay(anahtar, gelen) {
    if (gelen.length) return false;
    const yerel = Depo.oku(anahtar, []);
    if (!yerel.length) return false;
    if (!this._uyardi) {
      this._uyardi = true;
      bildir("Bulutta içerik yok — bu cihazdaki konular korundu");
    }
    return true;
  },

  _hata(nerede, e) {
    console.warn("Bulut dinleyici hatası:", nerede, e);
    if (e && e.code === "permission-denied") bildir("Bulut izni yok: " + nerede);
  },

  /* Snapshot'tan geleni yerel aynaya yazar ve ekranı tazeler.
     `_uygulanan` bayrağı, bu yazmanın tekrar buluta gönderilmesini engeller. */
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

  /* ---------------- yerel -> bulut ----------------
     Depo.yaz her çağrıldığında burası dürtülür. Aynı anahtar arka arkaya
     yazılırsa (kaydırıcı sürüklemesi gibi) tek gönderiye iner. */
  degisti(anahtar) {
    if (!this.acik || !this.kullanici || this._uygulanan) return;
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
        if (e && e.code === "permission-denied" && ICERIK_ANAHTARLARI.includes(a)) {
          bildir("İçeriği değiştirme yetkin yok — bu cihazda kaldı");
        }
      }
    }
  },

  async _anahtariGonder(anahtar) {
    const uid = this.kullanici.uid;

    if (anahtar === "kutuphane")  return this._koleksiyonEsitle("konular", Depo.oku("kutuphane", []));
    if (anahtar === "ustKonular") return this._koleksiyonEsitle("ustKonular", Depo.oku("ustKonular", []));
    if (anahtar === "palet") {
      const p = Depo.oku("palet", {});
      return this._koleksiyonEsitle("gorseller",
        (p.gorseller || []).map(g => ({ id: g.id, ad: g.ad, veri: g.veri })));
    }

    const veri = this._db.collection("kullanicilar").doc(uid).collection("veri");
    if (anahtar === "ilerleme") return veri.doc("ilerleme").set({ kayit: Depo.oku("ilerleme", {}) });
    if (anahtar === "ayarlar")  return veri.doc("ayarlar").set({ kayit: Depo.oku("ayarlar", {}) });
    if (anahtar === "gunluk")   return veri.doc("gunluk").set({ kayit: Depo.oku("gunluk", {}) });
  },

  /* Yerel listeyi koleksiyonla eşitler: eklenen/değişen yazılır,
     yerelde olmayan bulut belgesi silinir. */
  async _koleksiyonEsitle(koleksiyon, liste) {
    if (!this.yonetici) return;
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

  async tumIcerigiGonder() {
    await this._koleksiyonEsitle("konular", Depo.oku("kutuphane", []));
    await this._koleksiyonEsitle("ustKonular", Depo.oku("ustKonular", []));
    const p = Depo.oku("palet", {});
    await this._koleksiyonEsitle("gorseller", (p.gorseller || []).map(g => ({ id: g.id, ad: g.ad, veri: g.veri })));
    bildir("İçerik buluta yüklendi");
  },

  _dinleyicileriKapat() {
    this._dinleyiciler.forEach(d => { try { d(); } catch (e) {} });
    this._dinleyiciler = [];
  }
};

/* Buluta taşınan anahtarlar. `pano` (kopyala-yapıştır) bilinçli olarak
   yerelde bırakıldı — cihazlar arası taşınmasının anlamı yok. */
const ICERIK_ANAHTARLARI = ["kutuphane", "ustKonular", "palet"];
const KISISEL_ANAHTARLAR = ["ilerleme", "ayarlar", "gunluk"];
const BULUT_ANAHTARLARI  = [...ICERIK_ANAHTARLARI, ...KISISEL_ANAHTARLAR];
