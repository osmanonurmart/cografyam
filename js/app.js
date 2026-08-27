/* ==========================================================
   Coğrafyam — uygulama mantığı
   ========================================================== */

const $  = (s, k = document) => k.querySelector(s);
const $$ = (s, k = document) => Array.from(k.querySelectorAll(s));
const SVG_AD = "http://www.w3.org/2000/svg";

/* ----------------------------------------------------------
   DEPO — Firebase'e geçişte sadece burası değişecek
---------------------------------------------------------- */
const ONEK = "cografyam.v1.";
const Depo = {
  oku(anahtar, varsayilan) {
    try {
      const ham = localStorage.getItem(ONEK + anahtar);
      return ham === null ? varsayilan : JSON.parse(ham);
    } catch (e) {
      console.warn("Depo okunamadı:", anahtar, e);
      return varsayilan;
    }
  },
  yaz(anahtar, deger) {
    try {
      localStorage.setItem(ONEK + anahtar, JSON.stringify(deger));
      // yerel ayna yazıldı; bulut katmanı varsa aynısını oraya da taşır
      if (typeof Bulut !== "undefined") Bulut.degisti(anahtar);
      return true;
    } catch (e) {
      console.error("Depo yazılamadı:", anahtar, e);
      if (kotaHatasiMi(e)) depoDoluUyar();
      else bildir("Kaydedilemedi: " + (e && e.message ? e.message : "bilinmeyen hata"));
      return false;
    }
  },
  /* deponun kabaca ne kadarını doldurduğumuz — tarayıcı her karakteri 2 bayt sayar */
  kullanim() {
    let bayt = 0;
    try {
      for (const a in localStorage) {
        if (!Object.prototype.hasOwnProperty.call(localStorage, a)) continue;
        bayt += (a.length + String(localStorage[a]).length) * 2;
      }
    } catch (e) { return { bayt: 0, oran: 0 }; }
    return { bayt, oran: bayt / DEPO_SINIRI };
  }
};

/* Tarayıcı kotası origin başına ~5 MB. Yalnızca yüklenen görseller bunu zorlar. */
const DEPO_SINIRI = 5 * 1024 * 1024;

function kotaHatasiMi(e) {
  return !!e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
                 e.code === 22 || e.code === 1014);
}

function depoDoluUyar() {
  const k = Depo.kullanim();
  onay(
    `Tarayıcı deposu doldu (${(k.bayt / 1048576).toFixed(1)} MB / 5 MB), bu yüzden son değişiklik KAYDEDİLMEDİ.\n\n` +
    `Yer açmak için paletten kullanmadığın görselleri sil ya da bazı konuları kaldır. ` +
    `Önce "Dışa aktar" ile yedek almanı öneririm — yedek dosyası tarayıcı deposunda yer kaplamaz.`,
    { baslik: "Depo doldu", ikon: "🈵", evet: "Anladım", hayir: "Kapat", tehlikeli: false }
  );
}

/* ----------------------------------------------------------
   DURUM
---------------------------------------------------------- */
const durum = {
  profiller: [],
  aktifProfilId: null,
  ayarlar: { birikimli: false },
  kutuphane: [],
  ustKonular: [],

  konu: null,
  sorular: [],
  index: 0,
  sonuclar: [],
  kilit: false,
  bulunanlar: [],      // "hepsini bul" modunda bulunan iller
  yanlisDenendi: false,// bu soruda en az bir yanlış deneme oldu mu
  kalanIller: [],      // birikimli: doğru bilinen illerin adları haritada kalır
  kalanObjeler: [],    // birikimli: doğru bilinen objelerin adları haritada kalır
  hayaletGecici: [],   // hayalet mod: yanlış cevapta doğrusunun kısa süreli açılması
  duraklatildi: false,
  zamanlayici: null,

  ekranGecmisi: [],
  editorOnizleme: "duzenle",
  secimModu: false,
  seciliCoklu: new Set(),
  editorKonuId: null,
  seciliObjeId: null
};

const AVATARLAR = ["🙂", "🦊", "🐼", "🐯", "🦉", "🐢", "🦅", "🐬", "🌍", "⛰️", "🚀", "📚"];
const RENKLER   = ["#3b82f6", "#8b5cf6", "#ef4444", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6", "#64748b"];
const BOLGE_RENKLERI = {
  "Marmara":           "#4f7fc4",
  "Ege":               "#b06ea8",
  "Akdeniz":           "#c2793f",
  "İç Anadolu":        "#b39338",
  "Karadeniz":         "#3f8f6d",
  "Doğu Anadolu":      "#6f63b8",
  "Güneydoğu Anadolu": "#b25757"
};

const VARSAYILAN_EMOJILER = ["⛰️", "🏔️", "🌋", "🌾", "💧", "🌊", "🧪", "⚫", "🟤", "🟠", "🔩", "⚙️", "🛢️", "🔷", "🔴", "⬜", "🪨", "⛏️", "🏭", "🌲", "🐑", "🍇", "🌻", "🚢", "✈️", "📍", "⭐", "🔥"];

/* ----------------------------------------------------------
   PALET — yerleşik emojiler + kullanıcının yüklediği görseller
   Depo: { silinen:["⚫",…], gorseller:[{id, ad, veri}] }
   `veri` bir data: URL — PNG/JPG/WebP 128×128 PNG'ye küçültülür,
   SVG olduğu gibi saklanır (küçük ve ölçeklenebilir).
---------------------------------------------------------- */
const GORSEL_BOY = 128;
let palet = { silinen: [], gorseller: [] };

function paletYukle() {
  const p = Depo.oku("palet", {});
  palet = {
    silinen: Array.isArray(p.silinen) ? p.silinen : [],
    gorseller: Array.isArray(p.gorseller) ? p.gorseller : []
  };
}
function paletKaydet() { return Depo.yaz("palet", palet); }

/* Paletin gösterim sırası: önce kendi görsellerin, sonra silinmemiş emojiler */
function paletOgeleri() {
  return [
    ...palet.gorseller.map(g => ({ tip: "gorsel", id: g.id, ad: g.ad, veri: g.veri })),
    ...VARSAYILAN_EMOJILER.filter(e => !palet.silinen.includes(e)).map(e => ({ tip: "emoji", deger: e }))
  ];
}
function gorselBul(id) { return palet.gorseller.find(g => g.id === id) || null; }

/* Bir görselin kaç objede kullanıldığı — silmeden önce uyarmak için */
function gorselKullanimi(id) {
  const yerler = [];
  durum.kutuphane.forEach(k => (k.objeler || []).forEach(o => {
    if (o.gorselId === id) yerler.push({ konu: k.ad, obje: o.ad || "(adsız)" });
  }));
  return yerler;
}

const SURE_DOGRU = 800;   // yanlış cevap bekleme süresi Ayarlar'daki kaydırıcıdan gelir

/* Konu kutusundaki durum simgeleri.
   Yazı karakteri (▶ ✓ ∅) yerine SVG: yazı tipine göre yana kayıyor, dairenin
   ortasında durmuyordu. Üçgen, göz merkezde görsün diye 1 birim sağa kaydırıldı —
   üçgenin ağırlık merkezi tabanına yakın olduğu için tam ortalamak eğri durur. */
const DURUM_SIMGESI = {
  basla: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.2 L17.4 12 L9 17.8 Z"/></svg>`,
  bitti: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
            stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 12.4 L10 16.9 L18.5 7.6"/></svg>`,
  yok:   `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="7.4"/><path d="M6.8 17.2 L17.2 6.8" stroke-linecap="round"/></svg>`
};

/* ----------------------------------------------------------
   YARDIMCILAR
---------------------------------------------------------- */
/* Uygulama içi onay kutusu — tarayıcının confirm() penceresi yerine.
   Kullanımı: onay("Silinsin mi?").then(evet => { ... }) */
function onay(mesaj, secenek = {}) {
  return new Promise(cozum => {
    const kutu = $("#modal-onay");
    $("#onay-baslik").textContent = secenek.baslik || "Emin misin?";
    $("#onay-mesaj").textContent = mesaj;
    $("#onay-ikon").textContent = secenek.ikon || "⚠️";
    const evet = $("#btn-onay-evet");
    evet.textContent = secenek.evet || "Sil";
    evet.className = secenek.tehlikeli === false ? "ana-btn buyuk" : "tehlike-btn buyuk";
    $("#btn-onay-hayir").textContent = secenek.hayir || "Vazgeç";
    kutu.classList.remove("gizli");

    const kapat = (sonuc) => {
      kutu.classList.add("gizli");
      evet.removeEventListener("click", evetTik);
      $("#btn-onay-hayir").removeEventListener("click", hayirTik);
      kutu.removeEventListener("click", disTik);
      document.removeEventListener("keydown", tus);
      cozum(sonuc);
    };
    const evetTik = () => kapat(true);
    const hayirTik = () => kapat(false);
    const disTik = (e) => { if (e.target === kutu) kapat(false); };
    const tus = (e) => {
      if (e.key === "Escape") kapat(false);
      if (e.key === "Enter") kapat(true);
    };
    evet.addEventListener("click", evetTik);
    $("#btn-onay-hayir").addEventListener("click", hayirTik);
    kutu.addEventListener("click", disTik);
    document.addEventListener("keydown", tus);
    setTimeout(() => evet.focus(), 60);
  });
}

/* ---- ses ve titreşim ----
   Sesler koda gömülü: dosya yok, Web Audio ile üretiliyor. */
let _sesBaglam = null;
function sesBaglami() {
  if (_sesBaglam) return _sesBaglam;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { _sesBaglam = new AC(); } catch (e) { return null; }
  return _sesBaglam;
}

/* [frekans, başlangıç(sn), süre(sn), ses seviyesi] dizisi */
const SESLER = {
  dogru:  [[660, 0, .09, .16], [990, .07, .13, .16]],
  yanlis: [[300, 0, .13, .15], [200, .1, .17, .13]],
  bitis:  [[523, 0, .12, .15], [659, .11, .12, .15], [784, .22, .26, .16]],
  tik:    [[1100, 0, .035, .05]],
  uyari:  [[880, 0, .05, .07]]
};

function ses(tip) {
  if (!durum.ayarlar.ses) return;
  const b = sesBaglami();
  if (!b) return;
  if (b.state === "suspended") b.resume();
  const desen = SESLER[tip];
  if (!desen) return;
  const simdi = b.currentTime;
  desen.forEach(([frekans, basla, sure, seviye]) => {
    const o = b.createOscillator(), g = b.createGain();
    o.type = "sine";
    o.frequency.value = frekans;
    g.gain.setValueAtTime(0, simdi + basla);
    g.gain.linearRampToValueAtTime(seviye, simdi + basla + .012);
    g.gain.exponentialRampToValueAtTime(.0001, simdi + basla + sure);
    o.connect(g); g.connect(b.destination);
    o.start(simdi + basla);
    o.stop(simdi + basla + sure + .02);
  });
}

const TITRESIMLER = { dogru: 25, yanlis: [55, 45, 55], bitis: [40, 60, 40] };
function titre(tip) {
  if (!durum.ayarlar.titresim) return;
  if (!navigator.vibrate) return;          // iOS Safari desteklemiyor
  const d = TITRESIMLER[tip];
  if (d) navigator.vibrate(d);
}

function bildir(mesaj, sure = 2400) {
  const k = $("#bildirim");
  k.textContent = mesaj;
  k.classList.add("gorunur");
  clearTimeout(bildir._z);
  bildir._z = setTimeout(() => k.classList.remove("gorunur"), sure);
}

/* "İstanbul (Asya)" -> "istanbul" ; "Hakkâri" -> "hakkari" */
function sadelestir(s) {
  return (s || "")
    .replace(/\s*\(.*?\)\s*/g, "")
    .replace(/[âÂ]/g, "a").replace(/[îÎ]/g, "i").replace(/[ûÛ]/g, "u")
    .trim()
    .toLocaleLowerCase("tr");
}

function karart(hex, oran) {
  const s = hex.replace("#", "");
  const r = Math.round(parseInt(s.slice(0, 2), 16) * oran);
  const g = Math.round(parseInt(s.slice(2, 4), 16) * oran);
  const b = Math.round(parseInt(s.slice(4, 6), 16) * oran);
  return `rgb(${r},${g},${b})`;
}

function yeniId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function ekranGoster(ad, gecmiseEkle = true) {
  const simdiki = ($$(".ekran").find(e => e.classList.contains("aktif")) || {}).id;
  if (gecmiseEkle && simdiki && simdiki !== "ekran-" + ad) {
    durum.ekranGecmisi.push(simdiki.replace("ekran-", ""));
    if (durum.ekranGecmisi.length > 12) durum.ekranGecmisi.shift();
  }
  $$(".ekran").forEach(e => e.classList.remove("aktif"));
  $("#ekran-" + ad).classList.add("aktif");
  document.body.classList.toggle("calismada", ad === "calisma");
}

/* geri: bir önceki ekrana dön, geçmiş boşsa ana ekrana */
function geriGit() {
  const onceki = durum.ekranGecmisi.pop();
  if (!onceki || onceki === "profil" || onceki === "calisma") { anaEkranaGec(); return; }
  if (onceki === "ana") { anaEkranaGec(); return; }
  if (onceki === "editor") { ekranGoster("editor", false); return; }
  if (onceki === "konu-ayar") { konuAyarEkraniCiz(); ekranGoster("konu-ayar", false); return; }
  if (onceki === "ust-konular") { ustKonuListesiCiz(); ekranGoster("ust-konular", false); return; }
  ekranGoster(onceki, false);
}

function guvenli(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---- il adı <-> plaka dizini (SVG metninden, DOM gerekmeden) ---- */
const AD_PLAKA = {};
const PLAKA_AD = {};
(function ilDizini() {
  const re = /data-plakakodu="(\d{2})"[^>]*data-iladi="([^"]+)"/g;
  let m;
  while ((m = re.exec(TURKIYE_SVG)) !== null) {
    if (m[1] === "00") continue;
    const ad = m[2].replace(/\s*\(.*?\)\s*/g, "").trim();
    AD_PLAKA[sadelestir(ad)] = m[1];
    if (!PLAKA_AD[m[1]]) PLAKA_AD[m[1]] = ad;
  }
})();

const IL_ADLARI = Object.keys(PLAKA_AD).sort().map(p => PLAKA_AD[p])
  .sort((a, b) => a.localeCompare(b, "tr"));

function plakaBul(ilAdi) { return AD_PLAKA[sadelestir(ilAdi)] || null; }

function bolgeBul(ilAdi) {
  const hedef = sadelestir(ilAdi);
  for (const [bolge, iller] of Object.entries(BOLGELER)) {
    if (iller.some(i => sadelestir(i) === hedef)) return bolge;
  }
  return null;
}

/* ----------------------------------------------------------
   KÜTÜPHANE (konular + objeler + sorular)
---------------------------------------------------------- */
function kutuphaneYukle() {
  let k = Depo.oku("kutuphane", null);
  if (!k || !Array.isArray(k) || !k.length) {
    k = JSON.parse(JSON.stringify(TOHUM_KONULAR));
  }
  // eksik alanları tamamla + objelere id ver
  k.forEach(konu => {
    konu.ayar = Object.assign({
      ilIsimleri: true, objeGorunur: "cevapta", cevapBirimi: "il",
      objeAdlari: "cevapta", ilSinirlari: true
    }, konu.ayar || {});
    delete konu.ayar.grup;                       // eski grup sistemi kaldırıldı
    if (konu.ustKonuId === undefined) konu.ustKonuId = null;
    if (typeof konu.sira !== "number") konu.sira = 0;
    konu.objeler = (konu.objeler || []).map(o => {
      const obje = Object.assign({
        id: yeniId(), tip: "emoji", emoji: "📍", ad: "", iller: [], soruMetni: "",
        x: null, y: null, boyut: 1, aci: 0,
        noktalar: null, renk: null, kalinlik: 3,
        desen: "duz", saydamlik: 0.45,
        baloncuklar: [],
        sorular: []               // çoklu soru metni: [{metin}]
      }, o);
      if (!Array.isArray(obje.baloncuklar)) obje.baloncuklar = [];
      // eski tek illi kayıtları çoklu il modeline taşı
      if (o.il && !o.iller) obje.iller = [o.il];
      delete obje.il;
      delete obje.cevapBirimi;                       // cevap birimi artık konu ayarında
      if (!Array.isArray(obje.sorular)) obje.sorular = [];
      if (obje.soruMetni && !obje.sorular.length) obje.sorular = [{ metin: obje.soruMetni }];
      delete obje.soruMetni;
      if (!Array.isArray(obje.iller)) obje.iller = [];
      return obje;
    });
    konu.sorular = konu.sorular || [];
  });
  // sırası hiç verilmemişse mevcut diziliş sırasını sabitle
  if (k.every(x => x.sira === 0)) k.forEach((x, i) => { x.sira = i; });
  durum.kutuphane = k;
}

/* ---- üst konular (ana ekrandaki kapsayıcı kutular) ---- */
function ustKonulariYukle() {
  durum.ustKonular = Depo.oku("ustKonular", []);
}
function ustKonulariKaydet() {
  Depo.yaz("ustKonular", durum.ustKonular);
}
function ustKonuBul(id) {
  return durum.ustKonular.find(u => u.id === id) || null;
}
function ustKonuEkle(ad, ikon, renk) {
  const u = {
    id: "u" + yeniId(), ad, ikon: ikon || "📁", renk: renk || RENKLER[0],
    sira: enBuyukSira() + 1
  };
  durum.ustKonular.push(u);
  ustKonulariKaydet();
  return u;
}
function ustKonuSil(u) {
  durum.kutuphane.forEach(k => { if (k.ustKonuId === u.id) k.ustKonuId = null; });
  durum.ustKonular = durum.ustKonular.filter(x => x.id !== u.id);
  ustKonulariKaydet();
  kutuphaneKaydet();
}
function enBuyukSira() {
  const hepsi = [...durum.kutuphane.map(k => k.sira || 0), ...durum.ustKonular.map(u => u.sira || 0)];
  return hepsi.length ? Math.max(...hepsi) : 0;
}

/* Ana ekranın sıralı öğe listesi: kapsayıcılar ve kapsayıcısız konular
   aynı havuzda, kendi sıralarına göre. */
function anaEkranOgeleri() {
  const ogeler = [
    ...durum.ustKonular.map(u => ({ tip: "ust", sira: u.sira || 0, ust: u })),
    ...durum.kutuphane.filter(k => !k.ustKonuId || !ustKonuBul(k.ustKonuId))
                      .map(k => ({ tip: "konu", sira: k.sira || 0, konu: k }))
  ];
  ogeler.sort((a, b) => (a.sira - b.sira) || 0);
  return ogeler;
}

function ustKonununKonulari(ustId) {
  return durum.kutuphane
    .filter(k => k.ustKonuId === ustId)
    .sort((a, b) => (a.sira || 0) - (b.sira || 0));
}

function kutuphaneKaydet() {
  Depo.yaz("kutuphane", durum.kutuphane);
}

function konuBul(id) {
  return durum.kutuphane.find(k => k.id === id) || null;
}

function konuHazirMi(konu) {
  return (konu.objeler && konu.objeler.length > 0) || (konu.sorular && konu.sorular.length > 0);
}

/* Objenin cevap birimi: kendi ayarı "konu" ise konunun varsayılanı geçerli */
/* Konudan soru listesi üretir.
   Bir objenin birden fazla soru metni olabilir; her biri ayrı soru olur.
   Cevap birimi konu ayarından gelir (obje düzeyinde ayar yok). */
function sorulariUret(konu) {
  const birim = konu.ayar.cevapBirimi || "il";

  if (konu.objeler && konu.objeler.length) {
    const liste = [];
    konu.objeler.forEach(o => {
      const metinler = (o.sorular || []).map(x => (x.metin || "").trim()).filter(Boolean);
      if (!metinler.length) {
        metinler.push(
          birim === "obje" ? `Hangisi ${o.ad}?`
          : birim === "bolge" ? `${o.ad} hangi bölgemizdedir?`
          : (o.iller.length > 1 ? `${o.ad} hangi illerimizdedir?` : `${o.ad} hangi ilimizdedir?`));
      }
      metinler.forEach(metin => liste.push({
        metin,
        birim,
        hedefIller: o.iller.slice(),
        hedefObjeler: birim === "obje" ? [o.id] : [],
        objeId: o.id
      }));
    });
    return liste;
  }

  // objesiz konular (elle yazılmış sorular)
  const varsayilan = birim === "obje" ? "il" : birim;
  return (konu.sorular || []).map(s => {
    if (s.bolge) {
      return { metin: s.metin, birim: "bolge", bolge: s.bolge, hedefIller: (BOLGELER[s.bolge] || []).slice() };
    }
    return { metin: s.metin, birim: varsayilan, hedefIller: (s.hedef || []).slice() };
  });
}

/* ----------------------------------------------------------
   GÖRSEL YÜKLEME
   Raster dosyalar 128×128 PNG'ye küçültülür: 2 MB'lık bir fotoğraf
   depoda 5 MB yer kaplarken, küçültülmüş hali ~10-40 KB'a iner.
   SVG metin olduğu için zaten küçük — dokunmadan saklanır.
---------------------------------------------------------- */
function dosyayiOku(dosya) {
  return new Promise((coz, hata) => {
    const okuyucu = new FileReader();
    okuyucu.onload = () => coz(okuyucu.result);
    okuyucu.onerror = () => hata(new Error("Dosya okunamadı"));
    okuyucu.readAsDataURL(dosya);
  });
}

async function gorseliKucult(dosya) {
  const ham = await dosyayiOku(dosya);
  if (dosya.type === "image/svg+xml") return ham;      // SVG olduğu gibi

  const img = new Image();
  await new Promise((coz, hata) => {
    img.onload = coz;
    img.onerror = () => hata(new Error("Görsel açılamadı"));
    img.src = ham;
  });

  // en-boy oranını koru, 128×128 kutuya ortala (şeffaf zemin)
  const olcek = Math.min(GORSEL_BOY / img.width, GORSEL_BOY / img.height, 1);
  const en = Math.max(1, Math.round(img.width * olcek));
  const boy = Math.max(1, Math.round(img.height * olcek));
  const tuval = document.createElement("canvas");
  tuval.width = GORSEL_BOY; tuval.height = GORSEL_BOY;
  const ctx = tuval.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (GORSEL_BOY - en) / 2, (GORSEL_BOY - boy) / 2, en, boy);
  return tuval.toDataURL("image/png");
}

/* Dosya adından makul bir ad çıkarır: "bor-madeni_02.PNG" -> "Bor madeni 02" */
function dosyaAdindanAd(dosyaAdi) {
  const g = (dosyaAdi || "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  if (!g) return "Görsel";
  return g.charAt(0).toLocaleUpperCase("tr") + g.slice(1);
}

async function gorselEkle(dosya) {
  if (!dosya) return null;
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(dosya.type)) {
    bildir("Yalnızca PNG, JPG, WebP ve SVG eklenebilir");
    return null;
  }
  let veri;
  try { veri = await gorseliKucult(dosya); }
  catch (e) { bildir("Görsel işlenemedi: " + e.message); return null; }

  const oge = { id: yeniId(), ad: dosyaAdindanAd(dosya.name), veri };
  palet.gorseller.unshift(oge);
  if (!paletKaydet()) { palet.gorseller.shift(); return null; }   // depo doluysa geri al
  return oge;
}

/* ----------------------------------------------------------
   YEDEKLEME — her şey tek .json dosyasında
---------------------------------------------------------- */
const YEDEK_ANAHTARLARI = ["profiller", "aktifProfil", "kutuphane", "ustKonular",
                           "ayarlar", "ilerleme", "gunluk", "palet", "pano"];

function yedegiDisaAktar() {
  const yedek = { uygulama: "cografyam", surum: 1, tarih: new Date().toISOString(), veri: {} };
  YEDEK_ANAHTARLARI.forEach(a => {
    const ham = localStorage.getItem(ONEK + a);
    if (ham !== null) { try { yedek.veri[a] = JSON.parse(ham); } catch (e) {} }
  });

  const bag = new Blob([JSON.stringify(yedek)], { type: "application/json" });
  const url = URL.createObjectURL(bag);
  const g = new Date();
  const iki = n => String(n).padStart(2, "0");
  const a = document.createElement("a");
  a.href = url;
  a.download = `cografyam-yedek-${g.getFullYear()}${iki(g.getMonth() + 1)}${iki(g.getDate())}-${iki(g.getHours())}${iki(g.getMinutes())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  const kb = Math.round(bag.size / 1024);
  bildir(`Yedek indirildi — ${durum.kutuphane.length} konu, ${palet.gorseller.length} görsel (${kb} KB)`);
}

async function yedegiIceAktar(dosya) {
  if (!dosya) return;
  let yedek;
  try { yedek = JSON.parse(await dosya.text()); }
  catch (e) { bildir("Dosya okunamadı — geçerli bir JSON değil"); return; }

  if (!yedek || yedek.uygulama !== "cografyam" || !yedek.veri) {
    bildir("Bu dosya bir Coğrafyam yedeği değil");
    return;
  }

  const konuSayisi = (yedek.veri.kutuphane || []).length;
  const gorselSayisi = ((yedek.veri.palet || {}).gorseller || []).length;
  const tarih = yedek.tarih ? new Date(yedek.tarih).toLocaleString("tr-TR") : "bilinmiyor";
  const tamam = await onay(
    `${tarih} tarihli yedek: ${konuSayisi} konu, ${gorselSayisi} görsel.\n\n` +
    `Şu andaki TÜM konuların, görsellerin, profillerin ve ilerlemen bununla değiştirilecek. Bu işlem geri alınamaz.`,
    { baslik: "Yedeği geri yükle", ikon: "⬆", evet: "Geri yükle" }
  );
  if (!tamam) return;

  try {
    YEDEK_ANAHTARLARI.forEach(a => {
      if (Object.prototype.hasOwnProperty.call(yedek.veri, a)) {
        localStorage.setItem(ONEK + a, JSON.stringify(yedek.veri[a]));
      } else {
        localStorage.removeItem(ONEK + a);
      }
    });
  } catch (e) {
    if (kotaHatasiMi(e)) { depoDoluUyar(); return; }
    bildir("Geri yüklenemedi: " + e.message);
    return;
  }
  location.reload();
}

/* ----------------------------------------------------------
   GENEL AYARLAR
---------------------------------------------------------- */
function ayarlariYukle() {
  durum.ayarlar = Object.assign({ birikimli: false, yanlisSure: 6.5, ses: true, titresim: true }, Depo.oku("ayarlar", {}));
}
function ayarlariKaydet() {
  Depo.yaz("ayarlar", durum.ayarlar);
}

/* ----------------------------------------------------------
   PROFİLLER
---------------------------------------------------------- */
/* Giriş yok; tek ortak kimlik var (bkz. ORTAK_KIMLIK). İlerleme
   kayıtları hâlâ bu kimliğe göre tutuluyor, böylece alttaki kod
   olduğu gibi kaldı. */
function aktifProfil() {
  return durum.profiller.find(p => p.id === durum.aktifProfilId) || null;
}

/* ----------------------------------------------------------
   İLERLEME
---------------------------------------------------------- */
function ilerlemeOku(konuId) {
  const tum = Depo.oku("ilerleme", {});
  return (tum[durum.aktifProfilId] || {})[konuId] || null;
}

function ilerlemeYaz(konuId, kayit) {
  const tum = Depo.oku("ilerleme", {});
  if (!tum[durum.aktifProfilId]) tum[durum.aktifProfilId] = {};
  if (kayit === null) delete tum[durum.aktifProfilId][konuId];
  else tum[durum.aktifProfilId][konuId] = kayit;
  Depo.yaz("ilerleme", tum);
}

function ilerlemeKaydet() {
  if (!durum.konu || !durum.aktifProfilId) return;
  ilerlemeYaz(durum.konu.id, {
    index: durum.index,
    sonuclar: durum.sonuclar,
    toplam: durum.sorular.length,
    kalanIller: durum.kalanIller,
    kalanObjeler: durum.kalanObjeler,
    guncelleme: Date.now()
  });
}

/* ---- günlük çalışma özeti ---- */
function bugununAnahtari() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function gunlukEkle(dogruMu) {
  if (!durum.aktifProfilId) return;
  const tum = Depo.oku("gunluk", {});
  const p = tum[durum.aktifProfilId] || (tum[durum.aktifProfilId] = {});
  const g = bugununAnahtari();
  if (!p[g]) p[g] = { soru: 0, dogru: 0 };
  p[g].soru++;
  if (dogruMu) p[g].dogru++;
  Depo.yaz("gunluk", tum);
}

function bugunkuOzet() {
  const tum = Depo.oku("gunluk", {});
  const p = tum[durum.aktifProfilId] || {};
  return p[bugununAnahtari()] || { soru: 0, dogru: 0 };
}

function ozetiCiz() {
  const o = bugunkuOzet();
  const kap = $("#gunluk-ozet");
  if (!kap) return;
  if (!o.soru) {
    kap.innerHTML = `<span class="ozet-bos">Bugün henüz çalışmadın</span>`;
    return;
  }
  const oran = Math.round((o.dogru / o.soru) * 100);
  kap.innerHTML = `
    <span class="ozet-parca"><b>${o.soru}</b> soru</span>
    <span class="ozet-ayrac">·</span>
    <span class="ozet-parca dogru"><b>${o.dogru}</b> doğru</span>
    <span class="ozet-ayrac">·</span>
    <span class="ozet-parca oran">%${oran}</span>`;
}

/* ---- istatistikler ---- */
function gunEkle(anahtar, gun) {
  const d = new Date(anahtar + "T00:00:00");
  d.setDate(d.getDate() + gun);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function istatistikleriTopla() {
  const gunluk = (Depo.oku("gunluk", {})[durum.aktifProfilId]) || {};
  const bugun = bugununAnahtari();

  let toplamSoru = 0, toplamDogru = 0, haftaSoru = 0, haftaDogru = 0;
  const sonYedi = [];
  for (let i = 6; i >= 0; i--) sonYedi.push(gunEkle(bugun, -i));

  Object.entries(gunluk).forEach(([g, v]) => {
    toplamSoru += v.soru; toplamDogru += v.dogru;
    if (sonYedi.includes(g)) { haftaSoru += v.soru; haftaDogru += v.dogru; }
  });

  // üst üste çalışılan gün sayısı
  let seri = 0, imlec = bugun;
  if (!gunluk[bugun]) imlec = gunEkle(bugun, -1);   // bugün henüz çalışmadıysa dünden say
  while (gunluk[imlec] && gunluk[imlec].soru > 0) { seri++; imlec = gunEkle(imlec, -1); }

  const konular = durum.kutuphane.map(k => {
    const kayit = ilerlemeOku(k.id);
    const s = sayilar(kayit && kayit.sonuclar);
    const toplam = sorulariUret(k).length;
    return {
      ad: k.ad, ikon: k.ikon, renk: k.renk, toplam,
      cevaplanan: s.cevaplanan, dogru: s.dogru, yanlis: s.yanlis, pas: s.pas,
      yuzde: toplam ? Math.round((s.cevaplanan / toplam) * 100) : 0,
      basari: s.dogru + s.yanlis ? Math.round((s.dogru / (s.dogru + s.yanlis)) * 100) : null
    };
  });

  return {
    bugun: gunluk[bugun] || { soru: 0, dogru: 0 },
    hafta: { soru: haftaSoru, dogru: haftaDogru },
    toplam: { soru: toplamSoru, dogru: toplamDogru },
    seri,
    gunSayisi: Object.keys(gunluk).length,
    sonYedi: sonYedi.map(g => ({ gun: g, ...(gunluk[g] || { soru: 0, dogru: 0 }) })),
    konular
  };
}

function istatistikAc() {
  const i = istatistikleriTopla();
  const oran = (d, s) => (s ? Math.round((d / s) * 100) : 0);
  const enYuksek = Math.max(1, ...i.sonYedi.map(g => g.soru));
  const gunAdi = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

  const bitmis = i.konular.filter(k => k.toplam && k.cevaplanan >= k.toplam).length;
  const calisilan = i.konular.filter(k => k.cevaplanan > 0);
  const zayif = calisilan.filter(k => k.basari !== null).sort((a, b) => a.basari - b.basari).slice(0, 3);

  $("#istatistik-govde").innerHTML = `
    <div class="ist-kutular">
      <div class="ist-kutu">
        <div class="ist-sayi">${i.bugun.soru}</div>
        <div class="ist-etiket">bugün soru</div>
      </div>
      <div class="ist-kutu">
        <div class="ist-sayi yesil">%${oran(i.bugun.dogru, i.bugun.soru)}</div>
        <div class="ist-etiket">bugün doğru</div>
      </div>
      <div class="ist-kutu">
        <div class="ist-sayi">${i.hafta.soru}</div>
        <div class="ist-etiket">bu hafta</div>
      </div>
      <div class="ist-kutu">
        <div class="ist-sayi mavi">${i.seri}</div>
        <div class="ist-etiket">gün üst üste</div>
      </div>
    </div>

    <h4 class="ist-baslik">Son 7 gün</h4>
    <div class="ist-grafik">
      ${i.sonYedi.map(g => {
        const y = Math.round((g.soru / enYuksek) * 100);
        const gun = new Date(g.gun + "T00:00:00");
        return `<div class="ist-sutun" title="${g.gun}: ${g.soru} soru, ${g.dogru} doğru">
          <div class="ist-cubuk-yuva"><div class="ist-cubuk" style="height:${g.soru ? Math.max(y, 6) : 0}%"></div></div>
          <span class="ist-gun">${gunAdi[gun.getDay()]}</span>
        </div>`;
      }).join("")}
    </div>

    <h4 class="ist-baslik">Tüm zamanlar</h4>
    <div class="ist-satirlar">
      <div class="ist-satir"><span>Toplam soru</span><b>${i.toplam.soru}</b></div>
      <div class="ist-satir"><span>Doğru oranı</span><b class="yesil">%${oran(i.toplam.dogru, i.toplam.soru)}</b></div>
      <div class="ist-satir"><span>Çalışılan gün</span><b>${i.gunSayisi}</b></div>
      <div class="ist-satir"><span>Tamamlanan konu</span><b>${bitmis} / ${i.konular.filter(k => k.toplam).length}</b></div>
    </div>

    ${zayif.length ? `
      <h4 class="ist-baslik">En çok zorlandıkların</h4>
      <div class="ist-satirlar">
        ${zayif.map(k => `<div class="ist-satir">
          <span>${guvenli(k.ikon)} ${guvenli(k.ad)}</span>
          <b class="${k.basari < 50 ? "kirmizi" : ""}">%${k.basari}</b>
        </div>`).join("")}
      </div>` : ""}

    <h4 class="ist-baslik">Konular</h4>
    <div class="ist-konular">
      ${i.konular.filter(k => k.toplam).map(k => `
        <div class="ist-konu">
          <span class="ist-konu-ikon">${guvenli(k.ikon)}</span>
          <div class="ist-konu-orta">
            <div class="ist-konu-ad">${guvenli(k.ad)}</div>
            <div class="ist-konu-cubuk"><i style="width:${k.yuzde}%;background:${guvenli(k.renk)}"></i></div>
          </div>
          <span class="ist-konu-sayi">${k.cevaplanan}/${k.toplam}</span>
        </div>`).join("")}
    </div>`;

  $("#modal-istatistik").classList.remove("gizli");
}

function sayilar(sonuclar) {
  const s = { dogru: 0, yanlis: 0, pas: 0, cevaplanan: 0 };
  (sonuclar || []).forEach(x => { if (!x) return; s[x]++; s.cevaplanan++; });
  return s;
}

/* ==========================================================
   HARİTA
   Aynı sınıf hem çalışma ekranında hem harita düzenlemede
   kullanılır; her kapsayıcının kendi kopyası olur.
   ========================================================== */
class Harita {
  constructor(kapsayici) {
    this.kapsayici = kapsayici;
    kapsayici.innerHTML = TURKIYE_SVG;
    this.svg = kapsayici.querySelector("svg");
    this.svg.removeAttribute("id");
    this.gruplar = {};

    $$("g[data-plakakodu]", this.svg).forEach(g => {
      const p = g.getAttribute("data-plakakodu");
      if (p === "00") { g.classList.add("pasif-alan"); return; }
      (this.gruplar[p] = this.gruplar[p] || []).push(g);
    });
    const gk = this.svg.querySelector("#guney-kibris");
    if (gk) gk.classList.add("pasif-alan");

    // çevre ülke/deniz adlarına yer açmak için çerçeveyi genişlet
    this.svg.setAttribute("viewBox", HARITA_VIEWBOX);
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    this.kimlik = "h" + Math.random().toString(36).slice(2, 7);
    this.arkaKat  = this.katmanEkle("katman-arka", true);   // illerin ALTINA
    this.hatKat   = this.katmanEkle("katman-hat");
    this.cevreKat = this.katmanEkle("katman-cevre");
    this.isimKat  = this.katmanEkle("katman-isim");
    this.objeKat  = this.katmanEkle("katman-obje");
    this.adKat    = this.katmanEkle("katman-obje-ad");
    this.balonKat = this.katmanEkle("katman-balon");
    this.tutamakKat = this.katmanEkle("katman-tutamak");
    this.komsulariCiz();
    this.cevreyiCiz();
    this.isimleriCiz();
  }

  /* komşu ülke sınırları — sadece görsel referans, tıklanamaz */
  komsulariCiz() {
    if (typeof KOMSU_ULKELER === "undefined") return;
    KOMSU_ULKELER.forEach(([ad, d]) => {
      const p = document.createElementNS(SVG_AD, "path");
      p.setAttribute("d", d);
      p.setAttribute("class", "komsu");
      const b = document.createElementNS(SVG_AD, "title");
      b.textContent = ad;
      p.appendChild(b);
      this.arkaKat.appendChild(p);
    });
  }

  /* verilen SVG noktası hangi ilin içinde? (bbox ile ön eleme yapar) */
  ilBul(x, y) {
    if (!this._nokta) this._nokta = this.svg.createSVGPoint();
    const n = this._nokta;
    n.x = x; n.y = y;
    for (const [plaka, m] of Object.entries(IL_MERKEZ)) {
      if (x < m[0] - m[2] / 2 - 1 || x > m[0] + m[2] / 2 + 1 ||
          y < m[1] - m[3] / 2 - 1 || y > m[1] + m[3] / 2 + 1) continue;
      for (const g of (this.gruplar[plaka] || []))
        for (const p of g.querySelectorAll("path")) {
          try { if (p.isPointInFill(n)) return plaka; } catch (e) { /* eski tarayıcı */ }
        }
    }
    return null;
  }

  /* komşu ülkeler ve denizler — her zaman görünür, konu ayarından bağımsız */
  cevreyiCiz() {
    this.cevreKat.innerHTML = "";
    CEVRE_ETIKETLERI.forEach(([x, y, metin, tip, boy]) => {
      const t = document.createElementNS(SVG_AD, "text");
      t.setAttribute("x", x);
      t.setAttribute("y", y);
      t.setAttribute("class", "cevre-adi " + tip);
      t.setAttribute("font-size", boy || 11);
      t.textContent = metin;
      this.cevreKat.appendChild(t);
    });
  }

  katmanEkle(sinif, enAlta) {
    const g = document.createElementNS(SVG_AD, "g");
    g.setAttribute("class", sinif);
    g.style.pointerEvents = "none";
    if (enAlta) this.svg.insertBefore(g, this.svg.firstChild);
    else this.svg.appendChild(g);
    return g;
  }

  isimleriCiz() {
    this.isimKat.innerHTML = "";
    Object.keys(IL_MERKEZ).forEach(plaka => {
      const [mx, my, w, h] = IL_MERKEZ[plaka];
      const kaydir = IL_ETIKET_KAYDIR[plaka] || [0, 0];
      const ad = PLAKA_AD[plaka] || "";
      const t = document.createElementNS(SVG_AD, "text");
      const boy = Math.max(5, Math.min(10.5, (w * 1.55) / Math.max(4, ad.length)));
      t.setAttribute("x", mx + kaydir[0]);
      t.setAttribute("y", my + Math.min(h * 0.24, 9) + kaydir[1]);
      t.setAttribute("class", "il-adi");
      t.setAttribute("data-il-ad", plaka);
      t.setAttribute("font-size", boy.toFixed(1));
      t.textContent = ad;
      this.isimKat.appendChild(t);
    });
  }

  isimleriGoster(goster) {
    this.isimKat.classList.toggle("acik", !!goster);
  }

  /* tek bir ilin adını göster/gizle (birikimli öğrenme için) */
  ilAdiGoster(plaka, goster) {
    const t = this.isimKat.querySelector(`[data-il-ad="${plaka}"]`);
    if (t) t.classList.toggle("acik", !!goster);
  }
  ilAdlariniTemizle() {
    $$(".il-adi.acik", this.isimKat).forEach(t => t.classList.remove("acik"));
  }

  /* --- objeler: emoji · çizgi · alan --- */
  objeleriCiz(objeler) {
    this.objeKat.innerHTML = "";
    this.tutamakKat.innerHTML = "";
    this.adKat.innerHTML = "";
    this.balonKat.innerHTML = "";
    this.objeKat.style.pointerEvents = "none";
    this.desenleriHazirla();

    (objeler || []).forEach(o => {
      const g = document.createElementNS(SVG_AD, "g");
      g.setAttribute("class", "obje " + (o.tip || "emoji"));
      g.setAttribute("data-obje", o.id);

      if (o.tip === "cizgi") {
        const yol = document.createElementNS(SVG_AD, "path");
        yol.setAttribute("d", cizgiYolu(o.noktalar));
        yol.setAttribute("class", "cizgi-govde");
        yol.setAttribute("stroke-width", o.kalinlik || 3);
        yol.setAttribute("stroke", o.renk || "#38bdf8");
        // ince çizgiyi ıskalamamak için görünmez kalın tıklama şeridi
        const serit = document.createElementNS(SVG_AD, "path");
        serit.setAttribute("d", yol.getAttribute("d"));
        serit.setAttribute("class", "tiklama-seridi");
        g.appendChild(serit);
        g.appendChild(yol);

      } else if (o.tip === "alan") {
        const yol = document.createElementNS(SVG_AD, "path");
        yol.setAttribute("d", alanYolu(o.noktalar));
        yol.setAttribute("class", "alan-govde");
        yol.setAttribute("fill", o.renk || "#38bdf8");
        yol.setAttribute("fill-opacity", o.saydamlik != null ? o.saydamlik : 0.45);
        yol.setAttribute("stroke", o.renk || "#38bdf8");
        g.appendChild(yol);
        if (o.desen && o.desen !== "duz") {
          const desenKat = document.createElementNS(SVG_AD, "path");
          desenKat.setAttribute("d", yol.getAttribute("d"));
          desenKat.setAttribute("class", "alan-desen");
          desenKat.setAttribute("fill", `url(#desen-${o.desen})`);
          g.appendChild(desenKat);
        }

      } else {
        const k = objeKonum(objeler, o);
        const boy = 13 * (o.boyut || 1);
        const yerlesim = `translate(${k.x.toFixed(1)} ${k.y.toFixed(1)}) rotate(${o.aci || 0})`;
        const gorsel = o.gorselId ? gorselBul(o.gorselId) : null;

        if (o.gorselId && gorsel) {
          const en = boy * 1.55;                       // emojiyle kabaca aynı görsel ağırlık
          const im = document.createElementNS(SVG_AD, "image");
          im.setAttribute("class", "emoji-govde gorsel-govde");
          im.setAttribute("x", (-en / 2).toFixed(2));
          im.setAttribute("y", (-en / 2).toFixed(2));
          im.setAttribute("width", en.toFixed(2));
          im.setAttribute("height", en.toFixed(2));
          im.setAttribute("preserveAspectRatio", "xMidYMid meet");
          im.setAttribute("href", gorsel.veri);
          im.setAttribute("transform", yerlesim);
          g.appendChild(im);
        } else {
          const t = document.createElementNS(SVG_AD, "text");
          t.setAttribute("class", "emoji-govde");
          t.setAttribute("font-size", boy.toFixed(1));
          t.setAttribute("transform", yerlesim);
          // görsel paletten silinmişse obje kaybolmasın, yerini belli etsin
          t.textContent = o.gorselId ? "🖼️" : (o.emoji || "📍");
          g.appendChild(t);
        }
      }

      this.hayaletIsaretiCiz(g, o, objeler);
      this.objeKat.appendChild(g);
      this.objeAdiCiz(o, objeler);
      this.baloncuklariCiz(o);
    });
  }

  /* Hayalet işareti — objenin kimliği gizliyken gövdesinin yerinde duran ❓.
     Her objede baştan üretilir, yalnızca .hayalet sınıfıyla görünür olur. */
  hayaletIsaretiCiz(g, obje, objeler) {
    let x, y, boy;
    if (obje.tip === "cizgi" || obje.tip === "alan") {
      const yer = objeEtiketYeri(obje, objeler);
      if (!yer) return;
      x = yer.x; y = obje.tip === "cizgi" ? yer.y + 5 : yer.y;   // çizgide etiket 5px yukarı kaydırılmıştı
      boy = 11;
    } else {
      const k = objeKonum(objeler, obje);
      x = k.x; y = k.y; boy = 13 * (obje.boyut || 1);
    }
    const t = document.createElementNS(SVG_AD, "text");
    t.setAttribute("class", "hayalet-isaret");
    t.setAttribute("font-size", boy.toFixed(1));
    t.setAttribute("x", x.toFixed(1));
    t.setAttribute("y", y.toFixed(1));
    t.textContent = "❓";
    g.appendChild(t);
  }

  /* Verilen objeleri hayalete çevirir, kalanları gerçek haline döndürür. */
  hayaletUygula(idler) {
    const kume = idler ? new Set(idler) : null;
    $$(".obje", this.objeKat).forEach(g => {
      g.classList.toggle("hayalet", !!kume && kume.has(g.getAttribute("data-obje")));
    });
  }

  /* obje adı — konu ayarına göre gösterilir */
  objeAdiCiz(obje, objeler) {
    if (!obje.ad) return;
    const yer = objeEtiketYeri(obje, objeler);
    if (!yer) return;
    const t = document.createElementNS(SVG_AD, "text");
    t.setAttribute("class", "obje-adi");
    t.setAttribute("data-obje-ad", obje.id);
    t.setAttribute("x", yer.x.toFixed(1));
    t.setAttribute("y", yer.y.toFixed(1));
    t.setAttribute("font-size", 9);
    t.textContent = obje.ad;
    this.adKat.appendChild(t);
  }

  /* baloncuklar — cevaptan sonra görünen açıklama noktaları */
  baloncuklariCiz(obje) {
    (obje.baloncuklar || []).forEach((b, i) => {
      const g = document.createElementNS(SVG_AD, "g");
      g.setAttribute("class", "baloncuk");
      g.setAttribute("data-balon", obje.id + ":" + i);
      g.setAttribute("transform", `translate(${b.x} ${b.y})`);

      const nokta = document.createElementNS(SVG_AD, "circle");
      nokta.setAttribute("r", 3.2);
      nokta.setAttribute("class", "balon-nokta");
      g.appendChild(nokta);

      const yazi = [b.baslik, b.il].filter(Boolean).join(" · ");
      const en = Math.max(24, yazi.length * 4.6 + 10);
      const kutu = document.createElementNS(SVG_AD, "rect");
      kutu.setAttribute("x", -en / 2); kutu.setAttribute("y", -20);
      kutu.setAttribute("width", en); kutu.setAttribute("height", 13);
      kutu.setAttribute("rx", 4);
      kutu.setAttribute("class", "balon-kutu");
      g.appendChild(kutu);

      const t = document.createElementNS(SVG_AD, "text");
      t.setAttribute("y", -13.5);
      t.setAttribute("class", "balon-yazi");
      t.setAttribute("font-size", 7.5);
      t.textContent = yazi;
      g.appendChild(t);

      this.balonKat.appendChild(g);
    });
  }

  /* alan desenleri (<defs><pattern>) — bir kez üretilir */
  desenleriHazirla() {
    if (this.svg.querySelector("[id^='desen-']")) return;
    const defs = this.defsAl();
    defs.insertAdjacentHTML("beforeend", `
      <pattern id="desen-cizgili" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,.55)" stroke-width="1.4"/>
      </pattern>
      <pattern id="desen-tarali" width="6" height="6" patternUnits="userSpaceOnUse">
        <path d="M0,0 l6,6 M6,0 l-6,6" stroke="rgba(255,255,255,.5)" stroke-width="1.1" fill="none"/>
      </pattern>
      <pattern id="desen-noktali" width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="1.2" fill="rgba(255,255,255,.6)"/>
      </pattern>
      <pattern id="desen-dalgali" width="10" height="6" patternUnits="userSpaceOnUse">
        <path d="M0,3 q2.5,-2.6 5,0 t5,0" stroke="rgba(255,255,255,.55)" stroke-width="1.1" fill="none"/>
      </pattern>
      <pattern id="desen-tugla" width="10" height="6" patternUnits="userSpaceOnUse">
        <path d="M0,0 h10 M0,3 h10 M0,0 v3 M5,3 v3" stroke="rgba(255,255,255,.45)" stroke-width="1" fill="none"/>
      </pattern>
      <pattern id="desen-igne" width="8" height="8" patternUnits="userSpaceOnUse">
        <path d="M4,1.5 l2.2,5 h-4.4 z" fill="rgba(255,255,255,.55)"/>
      </pattern>`);
  }

  adlariGoster(goster) {
    this.adKat.classList.toggle("acik", !!goster);
  }
  objeAdiGoster(objeId, goster) {
    const t = this.adKat.querySelector(`[data-obje-ad="${objeId}"]`);
    if (t) t.classList.toggle("acik", !!goster);
  }
  balonlariGoster(objeId, goster) {
    $$(`[data-balon^="${objeId}:"]`, this.balonKat).forEach(g => g.classList.toggle("acik", !!goster));
  }
  tumBalonlar(goster) {
    $$(".baloncuk", this.balonKat).forEach(g => g.classList.toggle("acik", !!goster));
  }

  /* seçili çizginin noktalarını sürüklenebilir tutamak olarak göster */
  tutamaklariCiz(obje) {
    this.tutamakKat.innerHTML = "";
    if (!obje || obje.tip !== "cizgi" || !obje.noktalar) return;
    this.tutamakKat.style.pointerEvents = "auto";
    obje.noktalar.forEach((n, i) => {
      const c = document.createElementNS(SVG_AD, "circle");
      c.setAttribute("cx", n[0]); c.setAttribute("cy", n[1]); c.setAttribute("r", 4);
      c.setAttribute("class", "tutamak");
      c.setAttribute("data-nokta", i);
      this.tutamakKat.appendChild(c);
    });
  }

  objeGoster(objeId, goster) {
    const t = this.objeKat.querySelector(`[data-obje="${objeId}"]`);
    if (t) t.classList.toggle("gorunur", !!goster);
  }

  tumObjeler(goster) {
    $$(".obje", this.objeKat).forEach(t => t.classList.toggle("gorunur", !!goster));
  }

  /* ---- dış hat katmanı ----
     İl sınırlarını gizleyip yalnızca istenen grupların DIŞ hattını gösterir.
     Maske hilesi: grubun kendisi maskede siyah olduğu için içteki il çizgileri
     görünmez; kalın konturun sadece dışarı taşan yarısı kalır. */
  disHatlariCiz(gruplar) {
    this.hatKat.innerHTML = "";
    const defs = this.defsAl();
    $$("mask[data-hat]", defs).forEach(m => m.remove());
    if (!gruplar || !gruplar.length) return;

    gruplar.forEach((plakalar, i) => {
      const maskeId = `hat-maske-${this.kimlik}-${i}`;
      const maske = document.createElementNS(SVG_AD, "mask");
      maske.setAttribute("id", maskeId);
      maske.setAttribute("data-hat", "1");
      maske.setAttribute("maskUnits", "userSpaceOnUse");

      const zemin = document.createElementNS(SVG_AD, "rect");
      zemin.setAttribute("x", -200); zemin.setAttribute("y", -200);
      zemin.setAttribute("width", 1600); zemin.setAttribute("height", 1000);
      zemin.setAttribute("fill", "white");
      maske.appendChild(zemin);

      const hat = document.createElementNS(SVG_AD, "g");
      hat.setAttribute("class", "dis-hat");
      hat.setAttribute("mask", `url(#${maskeId})`);

      plakalar.forEach(plaka => {
        (this.gruplar[plaka] || []).forEach(g => {
          g.querySelectorAll("path").forEach(yol => {
            const kara = yol.cloneNode(false);
            kara.setAttribute("fill", "black");
            /* Komşu iller birbirine tam değmediği için maskede aralarında
               saç teli kadar beyaz şerit kalıyordu; kalın konturun yalnızca
               dışarı taşan yarısı görünsün derken TÜM il sınırları o
               boşluklardan sızıp açık mavi çizgi olarak çiziliyordu — yani
               "sınırları kaldır" onları silmek yerine belirginleştiriyordu.
               Kontur da siyaha boyanınca komşu maskeler üst üste biniyor,
               içeride hiç boşluk kalmıyor, sadece gerçek dış hat görünüyor. */
            kara.setAttribute("stroke", "black");
            kara.setAttribute("stroke-width", "1.6");
            kara.setAttribute("stroke-linejoin", "round");
            kara.removeAttribute("class");
            maske.appendChild(kara);

            const kenar = yol.cloneNode(false);
            kenar.removeAttribute("class");
            hat.appendChild(kenar);
          });
        });
      });

      defs.appendChild(maske);
      this.hatKat.appendChild(hat);
    });
  }

  defsAl() {
    let d = this.svg.querySelector("defs");
    if (!d) { d = document.createElementNS(SVG_AD, "defs"); this.svg.insertBefore(d, this.svg.firstChild); }
    return d;
  }

  /* konu ayarına göre sınır görünümü:
     mod = "il"    -> normal il sınırları
           "yok"   -> çıplak Türkiye (sadece ülke dış hattı)
           "bolge" -> bölge içi sınırlar yok, bölgeler arası hatlar var */
  /* ---- sınır zemini ----
     Kaynak SVG'de komşu il şekilleri birbirine tam değmiyor; aralarındaki
     saç teli kadar boşluktan koyu sayfa zemini sızıyor ve tam olarak il
     sınırı gibi görünüyor. Konturu kalınlaştırmak yüksek büyütmede işe
     yarıyor ama haritanın küçüldüğü normal görünümde kenar yumuşatması
     yüzünden yine ince çizgiler kalıyor.
     Kesin çözüm: illerin ALTINA aynı renkte tek parça bir zemin sermek.
     Boşluklardan artık koyu zemin değil, ilin kendi rengi görünüyor. */
  sinirZemini(goster) {
    const eski = this.arkaKat.querySelector(".sinir-zemin");
    if (eski) eski.remove();
    if (!goster) return;

    const zemin = document.createElementNS(SVG_AD, "g");
    zemin.setAttribute("class", "sinir-zemin");
    Object.values(this.gruplar).flat().forEach(g => {
      g.querySelectorAll("path").forEach(yol => {
        const k = yol.cloneNode(false);
        k.removeAttribute("class");
        k.setAttribute("fill", "currentColor");
        k.setAttribute("stroke", "currentColor");
        k.setAttribute("stroke-width", "1.6");
        k.setAttribute("stroke-linejoin", "round");
        zemin.appendChild(k);
      });
    });
    this.arkaKat.appendChild(zemin);
  }

  sinirModu(mod) {
    this.kapsayici.classList.toggle("sinirsiz", mod !== "il");
    this.sinirZemini(mod === "yok");
    if (mod === "yok") {
      this.disHatlariCiz([Object.keys(this.gruplar)]);
    } else if (mod === "bolge") {
      this.disHatlariCiz(Object.values(BOLGELER).map(iller =>
        iller.map(plakaBul).filter(Boolean)));
    } else {
      this.disHatlariCiz(null);
    }
  }

  /* obje moduna cevap verilince objenin kendisi boyanır */  /* obje moduna cevap verilince objenin kendisi boyanır */
  objeIsaretle(objeId, sinif) {
    const g = this.objeKat.querySelector(`[data-obje="${objeId}"]`);
    if (g) g.classList.add(sinif);
  }
  objeIsaretleriTemizle() {
    $$(".obje", this.objeKat).forEach(g => g.classList.remove("dogru", "yanlis", "ipucu"));
    $$(".obje-adi", this.adKat).forEach(t => t.classList.remove("acik"));
  }

  /* --- boyama --- */
  temizle() {
    Object.values(this.gruplar).flat().forEach(g =>
      g.classList.remove("dogru", "yanlis", "ipucu", "vurgu"));
    this.kapsayici.classList.remove("kilit");
  }
  boya(plaka, sinif) {
    (this.gruplar[plaka] || []).forEach(g => g.classList.add(sinif));
  }
  boyaIller(iller, sinif) {
    iller.forEach(il => { const p = plakaBul(il); if (p) this.boya(p, sinif); });
  }
  vurguTemizle() {
    Object.values(this.gruplar).flat().forEach(g => g.classList.remove("vurgu"));
  }

  /* ---- görünüm (zoom / kaydırma) ----
     viewBox'ı değiştirir; svgNokta() getScreenCTM kullandığı için
     yakınlaştırılmış haldeyken de tıklama koordinatları doğru kalır. */
  gorunumAl() {
    const v = (this.svg.getAttribute("viewBox") || HARITA_VIEWBOX).split(/[\s,]+/).map(Number);
    return { x: v[0], y: v[1], en: v[2], boy: v[3] };
  }
  gorunumYaz(g) {
    this.svg.setAttribute("viewBox", `${g.x} ${g.y} ${g.en} ${g.boy}`);
  }
  gorunumSifirla() {
    this.svg.setAttribute("viewBox", HARITA_VIEWBOX);
  }
  tamGorunumMu() {
    return (this.svg.getAttribute("viewBox") || "") === HARITA_VIEWBOX;
  }
  /* çapa noktası (SVG koordinatı) sabit kalacak şekilde ölçekler */
  yakinlastir(carpan, capa) {
    const tam = HARITA_VIEWBOX.split(/[\s,]+/).map(Number);
    const g = this.gorunumAl();
    // 1x'ten uzağa, 25x'ten yakına gitmesin
    const yeniEn = Math.min(tam[2], Math.max(tam[2] / 25, g.en / carpan));
    const olcek = yeniEn / g.en;
    const yeniBoy = g.boy * olcek;
    this.gorunumYaz({
      x: capa.x - (capa.x - g.x) * olcek,
      y: capa.y - (capa.y - g.y) * olcek,
      en: yeniEn, boy: yeniBoy
    });
  }
  kaydir(dx, dy) {
    const g = this.gorunumAl();
    this.gorunumYaz({ x: g.x - dx, y: g.y - dy, en: g.en, boy: g.boy });
  }

  /* ekran noktasını SVG koordinatına çevirir */
  svgNokta(ev) {
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = this.svg.createSVGPoint();
    p.x = ev.clientX; p.y = ev.clientY;
    const s = p.matrixTransform(ctm.inverse());
    return { x: s.x, y: s.y };
  }
}

/* Nokta dizisinden yumuşak eğri (Catmull-Rom → kübik Bézier).
   Akarsular köşeli değil, doğal aksın diye. */
function cizgiYolu(nok) {
  if (!nok || nok.length < 2) return "";
  const s = (v) => v.toFixed(1);
  if (nok.length === 2) return `M${s(nok[0][0])},${s(nok[0][1])}L${s(nok[1][0])},${s(nok[1][1])}`;
  let d = `M${s(nok[0][0])},${s(nok[0][1])}`;
  for (let i = 0; i < nok.length - 1; i++) {
    const p0 = nok[i - 1] || nok[i], p1 = nok[i], p2 = nok[i + 1], p3 = nok[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${s(c1x)},${s(c1y)} ${s(c2x)},${s(c2y)} ${s(p2[0])},${s(p2[1])}`;
  }
  return d;
}

/* Kapalı alan yolu — çizgiyle aynı yumuşatma, sonunda kapanır */
function alanYolu(nok) {
  if (!nok || nok.length < 3) return "";
  const kapali = nok.concat([nok[0]]);
  return cizgiYolu(kapali) + "Z";
}

/* Obje adı etiketinin yeri: emoji için üstü, çizgi/alan için orta nokta */
function objeEtiketYeri(obje, objeler) {
  if (obje.tip === "cizgi" && obje.noktalar && obje.noktalar.length) {
    const n = obje.noktalar[Math.floor(obje.noktalar.length / 2)];
    return { x: n[0], y: n[1] - 5 };
  }
  if (obje.tip === "alan" && obje.noktalar && obje.noktalar.length) {
    const t = obje.noktalar.reduce((a, n) => [a[0] + n[0], a[1] + n[1]], [0, 0]);
    return { x: t[0] / obje.noktalar.length, y: t[1] / obje.noktalar.length };
  }
  const k = objeKonum(objeler, obje);
  return { x: k.x, y: k.y - 9 * (obje.boyut || 1) };
}

/* Çizginin geçtiği illeri bulur — akarsuyu çizince cevap illeri kendiliğinden çıkar */
function cizgininIlleri(harita, noktalar) {
  const bulunan = [];
  const ekle = (plaka) => {
    if (plaka && !bulunan.includes(plaka)) bulunan.push(plaka);
  };
  for (let i = 0; i < noktalar.length - 1; i++) {
    const [x1, y1] = noktalar[i], [x2, y2] = noktalar[i + 1];
    const uzunluk = Math.hypot(x2 - x1, y2 - y1);
    const adim = Math.max(2, Math.ceil(uzunluk / 4));
    for (let j = 0; j <= adim; j++) {
      const t = j / adim;
      ekle(harita.ilBul(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t));
    }
  }
  return bulunan.map(p => PLAKA_AD[p]);
}

/* Alanın kapsadığı iller — alan içine düşen il merkezleri + kenar örneklemesi */
function alaninIlleri(harita, noktalar) {
  const bulunan = [];
  const ekle = (p) => { if (p && !bulunan.includes(p)) bulunan.push(p); };

  // kenarlardan geçtiği iller
  const kapali = noktalar.concat([noktalar[0]]);
  for (let i = 0; i < kapali.length - 1; i++) {
    const [x1, y1] = kapali[i], [x2, y2] = kapali[i + 1];
    const adim = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 5));
    for (let j = 0; j <= adim; j++) {
      const t = j / adim;
      ekle(harita.ilBul(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t));
    }
  }
  // merkezi alanın içinde kalan iller
  Object.keys(IL_MERKEZ).forEach(plaka => {
    const [mx, my] = IL_MERKEZ[plaka];
    if (noktaPoligondaMi(mx, my, noktalar)) ekle(plaka);
  });
  return bulunan.map(p => PLAKA_AD[p]);
}

/* ışın atma (ray casting) — nokta poligonun içinde mi */
function noktaPoligondaMi(x, y, poligon) {
  let icinde = false;
  for (let i = 0, j = poligon.length - 1; i < poligon.length; j = i++) {
    const [xi, yi] = poligon[i], [xj, yj] = poligon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) icinde = !icinde;
  }
  return icinde;
}

/* Objenin haritadaki yeri: x/y verilmişse o, yoksa il merkezi.
   Aynı ilde birden fazla obje varsa çakışmasın diye dağıtılır. */
function objeKonum(objeler, obje) {
  if (obje.x != null && obje.y != null) return { x: obje.x, y: obje.y };
  const ilk = (obje.iller && obje.iller[0]) || "";
  const plaka = plakaBul(ilk);
  const m = IL_MERKEZ[plaka] || [503, 263, 40, 40];
  const ayni = (objeler || []).filter(o =>
    sadelestir((o.iller && o.iller[0]) || "") === sadelestir(ilk) && o.x == null && o.y == null);
  const i = ayni.indexOf(obje);
  const temelY = m[1] - Math.min(m[3] * 0.14, 6);
  if (ayni.length <= 1 || i < 0) return { x: m[0], y: temelY };
  const yaricap = Math.max(6, Math.min(m[2], m[3]) * 0.24);
  const a = (Math.PI * 2 * i) / ayni.length - Math.PI / 2;
  return { x: m[0] + Math.cos(a) * yaricap, y: temelY + Math.sin(a) * yaricap };
}

/* ==========================================================
   ANA EKRAN
   ========================================================== */
function anaEkranaGec() {
  const p = aktifProfil();
  if (!p) return;
  ozetiCiz();
  konulariCiz();
  durum.ekranGecmisi = [];
  ekranGoster("ana", false);
}

function konulariCiz() {
  const grid = $("#konu-grid");
  grid.innerHTML = "";

  const ogeler = anaEkranOgeleri();
  if (!ogeler.length) {
    grid.innerHTML = `<p class="bos-uyari">Henüz konu yok. <b>Ayarlar › Konu Ayarları</b>'ndan ya da düzenleme ekranlarından yeni konu ekleyebilirsin.</p>`;
    return;
  }

  let serbestKap = null;   // arka arkaya gelen kapsayıcısız konular tek ızgarada toplanır
  const serbestBitir = () => { serbestKap = null; };

  ogeler.forEach(oge => {
    if (oge.tip === "konu") {
      if (!serbestKap) {
        serbestKap = document.createElement("div");
        serbestKap.className = "serbest-govde";
        grid.appendChild(serbestKap);
      }
      serbestKap.appendChild(konuKutusu(oge.konu));
      return;
    }

    serbestBitir();
    const u = oge.ust;
    const altlar = ustKonununKonulari(u.id);

    const kap = document.createElement("section");
    kap.className = "ust-kutu";
    kap.style.setProperty("--u1", u.renk);
    kap.style.setProperty("--u2", karart(u.renk, 0.42));
    kap.innerHTML = `
      <header class="ust-baslik">
        <span class="ust-emoji">${guvenli(u.ikon)}</span>
        <span class="ust-ad">${guvenli(u.ad)}</span>
        <span class="sayi-rozet">${altlar.length}</span>
      </header>
      <div class="ust-govde"></div>`;

    const govde = $(".ust-govde", kap);
    if (!altlar.length) {
      govde.innerHTML = `<p class="ust-bos">Bu kutu boş — Ayarlar › Üst Konular'dan içine konu taşı</p>`;
    } else {
      altlar.forEach(k => govde.appendChild(konuKutusu(k)));
    }
    grid.appendChild(kap);
  });
}

function konuKutusu(konu) {
  const toplam = sorulariUret(konu).length;
  const kayit = ilerlemeOku(konu.id);
  const s = sayilar(kayit && kayit.sonuclar);
  const yuzde = toplam ? Math.round((s.cevaplanan / toplam) * 100) : 0;
  const yarim = s.cevaplanan > 0 && s.cevaplanan < toplam;
  const bitti = toplam > 0 && s.cevaplanan >= toplam;

  // durum: yazı yok, simge + ilerleme halkası
  let simge, baslikMetni;
  if (!toplam)     { simge = DURUM_SIMGESI.yok;   baslikMetni = "Bu konuda henüz soru yok"; }
  else if (bitti)  { simge = DURUM_SIMGESI.bitti; baslikMetni = `Tamamlandı — ${s.dogru}/${toplam} doğru`; }
  else if (yarim)  { simge = DURUM_SIMGESI.basla; baslikMetni = `Devam et — ${s.cevaplanan}/${toplam}`; }
  else             { simge = DURUM_SIMGESI.basla; baslikMetni = `Başla — ${toplam} soru`; }

  const cevre = 2 * Math.PI * 13;
  const dolu = (yuzde / 100) * cevre;

  const kutu = document.createElement("div");
  kutu.className = "konu-kutu" + (toplam ? "" : " pasif") + (bitti ? " bitti" : "");
  kutu.style.setProperty("--k1", konu.renk);
  kutu.style.setProperty("--k2", karart(konu.renk, 0.45));
  kutu.innerHTML = `
    <div class="k-emoji">${guvenli(konu.ikon)}</div>
    <div class="k-ad">${guvenli(konu.ad)}</div>
    <div class="k-eylem">
      <button class="k-durum" title="${guvenli(baslikMetni)}" aria-label="${guvenli(baslikMetni)}">
        <svg class="k-halka" viewBox="0 0 32 32" aria-hidden="true">
          <circle class="halka-zemin" cx="16" cy="16" r="13"></circle>
          <circle class="halka-dolu" cx="16" cy="16" r="13"
                  stroke-dasharray="${dolu.toFixed(1)} ${cevre.toFixed(1)}"></circle>
        </svg>
        <span class="k-simge">${simge}</span>
      </button>
      ${(yarim || bitti)
        ? `<button class="k-sifirla" title="Sıfırdan başla" aria-label="Sıfırdan başla">↺</button>`
        : `<span class="k-sifirla bos" aria-hidden="true"></span>`}
    </div>`;

  kutu.addEventListener("click", ev => {
    if (ev.target.closest(".k-sifirla")) { konuSifirla(konu); return; }
    if (!toplam) { bildir(`"${konu.ad}" konusunda henüz soru yok`); return; }
    konuyuBaslat(konu);
  });
  return kutu;
}

function konuSifirla(konu) {
  onay(`"${konu.ad}" konusunda kaldığın yer ve doğru/yanlış kayıtların silinip konu baştan başlayacak.`,
       { baslik: "Sıfırdan başla", ikon: "↺", evet: "Sıfırdan başla", tehlikeli: false }).then(evet => {
    if (!evet) return;
    ilerlemeYaz(konu.id, null);
    konuyuBaslat(konu);
  });
}

/* ==========================================================
   ÇALIŞMA
   ========================================================== */
let calismaHarita = null;

function haritayiHazirla() {
  if (calismaHarita) return calismaHarita;
  calismaHarita = new Harita($("#harita-alan"));

  calismaHarita.svg.addEventListener("click", ev => {
    // obje modunda önce objeye bakılır
    const objeEl = ev.target.closest(".obje[data-obje]");
    if (objeEl) {
      const soru = durum.sorular[durum.index];
      if (soru && soru.birim === "obje") { objeyeCevapla(objeEl.getAttribute("data-obje")); return; }
    }
    const soru = durum.sorular[durum.index];
    if (soru && soru.birim === "obje") return;   // obje modunda iller tıklanmaz
    const g = ev.target.closest("g[data-plakakodu]");
    if (!g) return;
    const plaka = g.getAttribute("data-plakakodu");
    if (plaka === "00") return;
    cevapla(plaka);
  });

  return calismaHarita;
}

function konuyuBaslat(konu) {
  durum.konu = konu;
  durum.sorular = sorulariUret(konu);

  const kayit = ilerlemeOku(konu.id);
  const bitmis = kayit && kayit.index >= durum.sorular.length;
  if (kayit && !bitmis) {
    durum.index = kayit.index || 0;
    durum.sonuclar = (kayit.sonuclar || []).slice(0, durum.sorular.length);
    durum.kalanIller = (kayit.kalanIller || []).slice();
    durum.kalanObjeler = (kayit.kalanObjeler || []).slice();
  } else {
    durum.index = 0;
    durum.sonuclar = [];
  }
  while (durum.sonuclar.length < durum.sorular.length) durum.sonuclar.push(null);

  durum.duraklatildi = false;
  durum.kilit = false;
  if (!kayit || bitmis) { durum.kalanIller = []; durum.kalanObjeler = []; }
  const h = haritayiHazirla();
  h.isimleriGoster(konu.ayar.ilIsimleri);
  h.objeleriCiz(konu.objeler || []);

  $("#calisma-konu").textContent = konu.ad;
  $("#ortu-duraklat").classList.add("gizli");
  $("#ortu-bitis").classList.add("gizli");
  ekranGoster("calisma");
  soruyuGoster();

  if (kayit && !bitmis && kayit.index > 0) bildir("Kaldığın yerden devam");
}

/* Birikimli öğrenme: doğru bilinenlerin adları haritada kalır.
   Konu ayarı "il isimleri açık" ise zaten hepsi yazılıdır, bu katman onun üstüne biner. */
function isimleriTazele() {
  if (!calismaHarita || !durum.konu) return;
  calismaHarita.ilAdlariniTemizle();
  $$(".obje-adi", calismaHarita.adKat).forEach(t => t.classList.remove("acik"));

  if (!durum.ayarlar.birikimli) return;
  durum.kalanIller.forEach(p => calismaHarita.ilAdiGoster(p, true));
  if (durum.konu.ayar.objeAdlari !== "hic") {
    durum.kalanObjeler.forEach(id => calismaHarita.objeAdiGoster(id, true));
  }
}

/* ----------------------------------------------------------
   HAYALET MOD
   Konudaki objeler kimliklerini gizleyerek (emoji yerine ❓, çizgi/alan
   nötr gri) başlar; doğru bilinen obje gerçek haline döner. Yalnızca
   cevap birimi "İl" olmayan konularda anlamlı — il sorusunda objenin
   şekli zaten cevabı vermez, gizlemek bir şey kazandırmaz.
---------------------------------------------------------- */
function hayaletAktifMi(konu) {
  return !!(konu && konu.ayar && konu.ayar.hayalet && (konu.ayar.cevapBirimi || "il") !== "il");
}

/* Kimliği açılmış objeler: kalıcılık "Birikimli öğrenme" ayarına bağlıdır. */
function hayaletAcilanlar() {
  const acik = new Set(durum.hayaletGecici);
  if (durum.ayarlar.birikimli) durum.kalanObjeler.forEach(id => acik.add(id));
  const soru = durum.sorular[durum.index];
  if (soru && soru.birim === "obje") durum.bulunanlar.forEach(id => acik.add(id));
  if (durum.kilit && soru && soru.objeId) acik.add(soru.objeId);
  return acik;
}

function hayaletTazele() {
  const konu = durum.konu;
  if (!konu || !calismaHarita) return;
  if (!hayaletAktifMi(konu)) { calismaHarita.hayaletUygula(null); return; }

  const acik = hayaletAcilanlar();
  const gizli = (konu.objeler || []).map(o => o.id).filter(id => !acik.has(id));
  calismaHarita.hayaletUygula(gizli);
  // hayaletteki objenin adı yazılırsa gizlemenin anlamı kalmaz
  gizli.forEach(id => calismaHarita.objeAdiGoster(id, false));
  if (konu.ayar.objeAdlari !== "hic") {
    acik.forEach(id => calismaHarita.objeAdiGoster(id, true));
  }
}

function objeleriTazele() {
  objeGorunurlukTazele();
  hayaletTazele();
}

/* Objelerin görünürlüğünü, konu ayarı + birikimli ayarına göre tazeler */
function objeGorunurlukTazele() {
  const konu = durum.konu;
  if (!konu || !calismaHarita) return;
  const objeliMi = konu.objeler && konu.objeler.length;
  if (!objeliMi) return;

  const soru = durum.sorular[durum.index];
  const objeModu = soru && soru.birim === "obje";

  // adlar — hayalet modda toplu gösterim kapalı, adlar tek tek açılır
  const adlarAcik = konu.ayar.objeAdlari === "gorunsun" && !hayaletAktifMi(konu);
  calismaHarita.adlariGoster(adlarAcik);
  if (adlarAcik) {
    $$(".obje-adi", calismaHarita.adKat).forEach(t => t.classList.add("acik"));
  }

  // obje modunda hepsi görünür olmalı — tıklanacaklar
  if (objeModu || konu.ayar.objeGorunur === "bastan") {
    calismaHarita.tumObjeler(true);
    return;
  }

  calismaHarita.tumObjeler(false);

  if (durum.ayarlar.birikimli) {
    // cevaplanmış (pas hariç) tüm objeler haritada birikir
    durum.sorular.forEach((soru, i) => {
      if (soru.objeId && durum.sonuclar[i] && durum.sonuclar[i] !== "pas") {
        calismaHarita.objeGoster(soru.objeId, true);
      }
    });
  }

  // içinde bulunduğumuz soru cevaplandıysa objesi her hâlükârda görünür
  const suanki = durum.sorular[durum.index];
  if (durum.kilit && suanki && suanki.objeId) {
    calismaHarita.objeGoster(suanki.objeId, true);
  }
}

function soruyuGoster() {
  clearTimeout(durum.zamanlayici);
  clearTimeout(durum.uyariZamani);
  durum.kilit = false;
  durum.bulunanlar = [];
  durum.yanlisDenendi = false;
  durum.hayaletGecici = [];
  calismaHarita.temizle();

  const soru = durum.sorular[durum.index];
  if (!soru) { bitir(); return; }

  $("#soru-metin").textContent = soru.metin;
  const gb = $("#geri-bildirim");
  gb.textContent = "";
  gb.className = "geri-bildirim";

  calismaHarita.tumBalonlar(false);
  calismaHarita.objeIsaretleriTemizle();
  isimleriTazele();
  const objeModu = soru.birim === "obje";
  const bolgeModu = soru.birim === "bolge";
  $("#harita-alan").classList.toggle("obje-modu", objeModu);
  $("#harita-alan").classList.toggle("bolge-modu", bolgeModu);
  calismaHarita.sinirModu(bolgeModu ? "bolge" : (durum.konu.ayar.ilSinirlari === false ? "yok" : "il"));
  calismaHarita.objeKat.style.pointerEvents = objeModu ? "auto" : "none";

  objeleriTazele();
  basliklariGuncelle();
  dugmeleriGuncelle();
}

function basliklariGuncelle() {
  const s = sayilar(durum.sonuclar);
  const toplam = durum.sorular.length;
  $("#calisma-sayac").textContent = `Soru ${Math.min(durum.index + 1, toplam)} / ${toplam}`;
  $("#skor-dogru").textContent = s.dogru;
  $("#skor-yanlis").textContent = s.yanlis;
  $("#skor-pas").textContent = s.pas;
  $("#ilerleme-dolu").style.width = toplam ? (durum.index / toplam) * 100 + "%" : "0%";
}

function dugmeleriGuncelle() {
  $("#btn-geri").disabled   = durum.index === 0 || durum.duraklatildi;
  $("#btn-pas").disabled    = durum.duraklatildi;
  $("#btn-durdur").disabled = durum.duraklatildi;
  $("#btn-devam").disabled  = !durum.duraklatildi;
}

/* İl / bölge cevabı.
   Kural: yanlış cevap soruyu bitirmez — doğrusu gösterilir, süre dolunca
   silinir ve aynı soruda kalınır. Birden fazla doğru hedef varsa hepsi bulunmalı.
   Soruyu yalnızca doğru cevap ya da "Pas" bitirir. */
function cevapla(plaka) {
  if (durum.kilit || durum.duraklatildi) return;
  const soru = durum.sorular[durum.index];
  if (!soru) return;

  const gb = $("#geri-bildirim");
  calismaHarita.vurguTemizle();

  /* ---- bölge ---- */
  if (soru.birim === "bolge") {
    const secilen = bolgeBul(PLAKA_AD[plaka]);
    const hedef = soru.bolge || (soru.hedefIller[0] ? bolgeBul(soru.hedefIller[0]) : null);
    if (secilen && hedef && secilen === hedef) {
      calismaHarita.boyaIller(BOLGELER[secilen] || [], "dogru");
      soruyuBitir(`Doğru — ${secilen} Bölgesi`);
    } else {
      if (secilen) calismaHarita.boyaIller(BOLGELER[secilen] || [], "yanlis");
      if (hedef) calismaHarita.boyaIller(BOLGELER[hedef] || [], "ipucu");
      yanlisDeneme(`Yanlış — doğrusu: ${hedef || "?"} Bölgesi`);
    }
    return;
  }

  /* ---- il ---- */
  const hedefler = soru.hedefIller.map(plakaBul).filter(Boolean);
  calismaHarita.ilAdiGoster(plaka, true);

  if (hedefler.includes(plaka)) {
    if (!durum.bulunanlar.includes(plaka)) durum.bulunanlar.push(plaka);
    calismaHarita.boya(plaka, "dogru");
    if (durum.ayarlar.birikimli && !durum.kalanIller.includes(plaka)) durum.kalanIller.push(plaka);

    if (durum.bulunanlar.length < hedefler.length) {
      ses("dogru"); titre("dogru");
      gb.textContent = `${durum.bulunanlar.length}/${hedefler.length} bulundu — devam`;
      gb.className = "geri-bildirim dogru";
      return;                                   // soru sürüyor
    }
    soruyuBitir(`Doğru — ${hedefler.map(h => PLAKA_AD[h]).join(", ")}`);
  } else {
    calismaHarita.boya(plaka, "yanlis");
    hedefler.forEach(h => {
      if (!durum.bulunanlar.includes(h)) calismaHarita.boya(h, "ipucu");
      calismaHarita.ilAdiGoster(h, true);
    });
    yanlisDeneme(`Yanlış — doğrusu: ${hedefler.map(h => PLAKA_AD[h]).join(", ")}`);
  }
}

/* yanlış deneme: doğrusunu göster, süre dolunca temizle ve AYNI soruda kal */
function yanlisDeneme(aciklama) {
  durum.yanlisDenendi = true;
  durum.kilit = true;
  /* hayalet modda doğrusu bekleme süresince gerçek şekliyle görünür,
     süre dolunca tekrarDene onu yeniden ❓'ye çevirir */
  const soruYD = durum.sorular[durum.index];
  if (hayaletAktifMi(durum.konu) && soruYD) {
    (soruYD.hedefObjeler && soruYD.hedefObjeler.length ? soruYD.hedefObjeler
      : (soruYD.objeId ? [soruYD.objeId] : [])).forEach(id => {
        if (!durum.hayaletGecici.includes(id)) durum.hayaletGecici.push(id);
      });
    hayaletTazele();
  }
  ses("yanlis"); titre("yanlis");
  $("#harita-alan").classList.add("kilit");

  const gb = $("#geri-bildirim");
  gb.textContent = aciklama;
  gb.className = "geri-bildirim yanlis";
  cevapSonrasiGoster();
  dugmeleriGuncelle();

  const bekleme = Math.round((durum.ayarlar.yanlisSure ?? 6.5) * 1000);
  clearTimeout(durum.uyariZamani);
  if (bekleme > 1500) durum.uyariZamani = setTimeout(() => ses("uyari"), bekleme - 700);
  clearTimeout(durum.zamanlayici);
  durum.zamanlayici = setTimeout(tekrarDene, bekleme);
}

/* aynı soruya dön: işaretleri sil, bulunmuş doğruları koru */
function tekrarDene() {
  if (durum.duraklatildi) return;
  clearTimeout(durum.uyariZamani);
  durum.hayaletGecici = [];      // doğrusu tekrar ❓'ye döner
  durum.kilit = false;
  $("#harita-alan").classList.remove("kilit");
  calismaHarita.temizle();
  calismaHarita.objeIsaretleriTemizle();
  calismaHarita.tumBalonlar(false);
  isimleriTazele();
  objeleriTazele();

  const soru = durum.sorular[durum.index];
  const objeModu = soru && soru.birim === "obje";
  durum.bulunanlar.forEach(x => {
    if (objeModu) { calismaHarita.objeIsaretle(x, "dogru"); calismaHarita.objeAdiGoster(x, true); }
    else calismaHarita.boya(x, "dogru");
  });

  const gb = $("#geri-bildirim");
  if (durum.bulunanlar.length) {
    const toplam = objeModu ? soru.hedefObjeler.length : soru.hedefIller.length;
    gb.textContent = `${durum.bulunanlar.length}/${toplam} bulundu — devam`;
    gb.className = "geri-bildirim dogru";
  } else {
    gb.textContent = "Tekrar dene";
    gb.className = "geri-bildirim";
  }
  dugmeleriGuncelle();
}

/* soruyu tamamla: sonuç ilk denemeye göre yazılır */
function soruyuBitir(aciklama) {
  const basarili = !durum.yanlisDenendi;
  durum.sonuclar[durum.index] = basarili ? "dogru" : "yanlis";
  durum.kilit = true;
  gunlukEkle(basarili);
  ses("dogru"); titre("dogru");
  $("#harita-alan").classList.add("kilit");

  const gb = $("#geri-bildirim");
  gb.textContent = aciklama;
  gb.className = "geri-bildirim dogru";

  objeleriTazele();
  cevapSonrasiGoster();
  basliklariGuncelle();
  dugmeleriGuncelle();
  ilerlemeKaydet();
  clearTimeout(durum.zamanlayici);
  durum.zamanlayici = setTimeout(sonrakiSoru, SURE_DOGRU);
}

/* Obje moduna tıklama — haritadaki çizgi/alan/emoji objesine tıklanır.
   İl cevabıyla aynı kural: yanlış soruyu bitirmez, doğru(lar) bulununca geçer. */
function objeyeCevapla(objeId) {
  if (durum.kilit || durum.duraklatildi) return;
  const soru = durum.sorular[durum.index];
  if (!soru || soru.birim !== "obje") return;

  const hedefler = soru.hedefObjeler;
  const objeAdi = (id) => {
    const o = durum.konu.objeler.find(x => x.id === id);
    return o ? (o.ad || "(adsız)") : "?";
  };
  const gb = $("#geri-bildirim");

  if (hedefler.includes(objeId)) {
    if (!durum.bulunanlar.includes(objeId)) durum.bulunanlar.push(objeId);
    calismaHarita.objeIsaretle(objeId, "dogru");
    calismaHarita.objeAdiGoster(objeId, true);
    if (durum.ayarlar.birikimli && !durum.kalanObjeler.includes(objeId)) durum.kalanObjeler.push(objeId);
    hayaletTazele();   // doğru bilinen obje gerçek haline döner

    if (durum.bulunanlar.length < hedefler.length) {
      ses("dogru"); titre("dogru");
      gb.textContent = `${durum.bulunanlar.length}/${hedefler.length} bulundu — devam`;
      gb.className = "geri-bildirim dogru";
      return;
    }
    soruyuBitir(`Doğru — ${hedefler.map(objeAdi).join(", ")}`);
  } else {
    calismaHarita.objeIsaretle(objeId, "yanlis");
    hedefler.forEach(h => {
      if (!durum.bulunanlar.includes(h)) calismaHarita.objeIsaretle(h, "ipucu");
      calismaHarita.objeAdiGoster(h, true);
    });
    yanlisDeneme(`Yanlış — tıkladığın: ${objeAdi(objeId)} · doğrusu: ${hedefler.map(objeAdi).join(", ")}`);
  }
}

/* cevaptan sonra: objenin adı ve baloncukları açılır */
function cevapSonrasiGoster() {
  const soru = durum.sorular[durum.index];
  if (!soru || !soru.objeId) return;
  if (durum.konu.ayar.objeAdlari !== "hic") calismaHarita.objeAdiGoster(soru.objeId, true);
  calismaHarita.balonlariGoster(soru.objeId, true);
}

function sonrakiSoru() {
  if (durum.duraklatildi) return;
  durum.index++;
  ilerlemeKaydet();
  if (durum.index >= durum.sorular.length) { bitir(); return; }
  soruyuGoster();
}

function oncekiSoru() {
  if (durum.index === 0) return;
  clearTimeout(durum.zamanlayici);
  durum.index--;
  durum.sonuclar[durum.index] = null;
  ilerlemeKaydet();
  soruyuGoster();
}

function pasGec() {
  if (durum.duraklatildi) return;
  clearTimeout(durum.zamanlayici);
  clearTimeout(durum.uyariZamani);
  durum.sonuclar[durum.index] = "pas";
  gunlukEkle(false);
  sonrakiSoru();
}

function durdur() {
  if (durum.duraklatildi) return;
  clearTimeout(durum.zamanlayici);
  durum.duraklatildi = true;
  ilerlemeKaydet();
  $("#ortu-duraklat").classList.remove("gizli");
  dugmeleriGuncelle();
}

function devamEt() {
  if (!durum.duraklatildi) return;
  durum.duraklatildi = false;
  $("#ortu-duraklat").classList.add("gizli");
  if (durum.kilit) {
    const devamEden = durum.sonuclar[durum.index] == null;
    durum.zamanlayici = setTimeout(devamEden ? tekrarDene : sonrakiSoru, 400);
  }
  dugmeleriGuncelle();
}

function bitir() {
  clearTimeout(durum.zamanlayici);
  durum.index = durum.sorular.length;
  ilerlemeKaydet();
  const s = sayilar(durum.sonuclar);
  $("#bitis-ozet").textContent =
    `${durum.sorular.length} sorudan ${s.dogru} doğru, ${s.yanlis} yanlış, ${s.pas} pas.`;
  $("#ilerleme-dolu").style.width = "100%";
  $("#ortu-bitis").classList.remove("gizli");
  ses("bitis");
  titre("bitis");
}

function bastanBasla() {
  $("#ortu-bitis").classList.add("gizli");
  durum.index = 0;
  durum.sonuclar = durum.sorular.map(() => null);
  durum.kalanIller = [];
  durum.kalanObjeler = [];
  ilerlemeKaydet();
  soruyuGoster();
}

function calismadanCik() {
  clearTimeout(durum.zamanlayici);
  ilerlemeKaydet();
  durum.duraklatildi = false;
  $("#ortu-duraklat").classList.add("gizli");
  $("#ortu-bitis").classList.add("gizli");
  anaEkranaGec();
}

/* ==========================================================
   KONU AYARLARI (konu bazlı)
   ========================================================== */
function konuAyarIcerik(konu, hedefEl) {
  const a = konu.ayar;
  hedefEl.innerHTML = `
    <div class="ayar-satir">
      <div class="ayar-yazi">
        <div class="ayar-ad">İl isimleri görünsün</div>
        <div class="ayar-alt">Harita üzerinde il adları yazılı olur.</div>
      </div>
      <button class="toggle ${a.ilIsimleri ? "acik" : ""}" data-ayar="ilIsimleri" role="switch"><span></span></button>
    </div>

    <div class="ayar-satir">
      <div class="ayar-yazi">
        <div class="ayar-ad">Objeler baştan görünsün</div>
        <div class="ayar-alt">Açık: konudaki tüm objeler en baştan haritada durur. Kapalı: gizli başlar, cevaplayınca çıkar (Ayarlar &gt; Birikimli öğrenme kuralına göre). <i>Obje modundaki sorularda objeler zaten görünür olmak zorundadır.</i></div>
      </div>
      <button class="toggle ${a.objeGorunur === "bastan" ? "acik" : ""}" data-ayar="objeGorunur" role="switch"><span></span></button>
    </div>

    <div class="ayar-satir dikey">
      <div class="ayar-yazi">
        <div class="ayar-ad">Cevap birimi (varsayılan)</div>
        <div class="ayar-alt">Bu konudaki soruların neye tıklanarak cevaplanacağı. Konunun tamamı için geçerlidir.</div>
      </div>
      <div class="secenek-satir" data-secenek="cevapBirimi">
        <button class="secenek ${a.cevapBirimi === "il" ? "secili" : ""}" data-deger="il">İl</button>
        <button class="secenek ${a.cevapBirimi === "bolge" ? "secili" : ""}" data-deger="bolge">Bölge</button>
        <button class="secenek ${a.cevapBirimi === "obje" ? "secili" : ""}" data-deger="obje">Obje</button>
      </div>
    </div>

    <div class="ayar-satir">
      <div class="ayar-yazi">
        <div class="ayar-ad">İl sınırlarını kaldır</div>
        <div class="ayar-alt">Açıkken çıplak Türkiye haritası görünür — il çizgileri kaybolur, yalnızca ülke dış hattı kalır. Tıklama yine çalışır.</div>
      </div>
      <button class="toggle ${a.ilSinirlari === false ? "acik" : ""}" data-ayar="ilSinirlari" role="switch"><span></span></button>
    </div>

    <div class="ayar-satir ${(a.cevapBirimi || "il") === "il" ? "pasif-ayar" : ""}">
      <div class="ayar-yazi">
        <div class="ayar-ad">Hayalet mod</div>
        <div class="ayar-alt">Objeler kimliklerini gizleyerek başlar: emoji yerine ❓, çizgi ve alanlar nötr gri. Doğru bildiğin obje gerçek haline döner; kalıcılığı <b>Ayarlar &gt; Birikimli öğrenme</b>'ye bağlıdır. Yanlış cevapta doğrusu bir an görünür, sonra yeniden ❓ olur.
        ${(a.cevapBirimi || "il") === "il"
          ? `<i>Cevap birimi <b>İl</b> olduğu için kapalı — il sorusunda objenin şekli zaten cevabı vermez.</i>`
          : `<i>Objeler baştan görünmüyorsa devreye girmez: yukarıdaki “Objeler baştan görünsün” anahtarını da aç.</i>`}</div>
      </div>
      <button class="toggle ${a.hayalet ? "acik" : ""}" data-ayar="hayalet" role="switch"
              ${(a.cevapBirimi || "il") === "il" ? "disabled" : ""}><span></span></button>
    </div>

    <div class="ayar-satir dikey">
      <div class="ayar-yazi">
        <div class="ayar-ad">Obje adları</div>
        <div class="ayar-alt">Akarsu/dağ adlarının haritada ne zaman yazılacağı.</div>
      </div>
      <div class="secenek-satir" data-secenek="objeAdlari">
        <button class="secenek ${a.objeAdlari === "gorunsun" ? "secili" : ""}" data-deger="gorunsun">Hep görünsün</button>
        <button class="secenek ${a.objeAdlari === "cevapta" ? "secili" : ""}" data-deger="cevapta">Cevaptan sonra</button>
        <button class="secenek ${a.objeAdlari === "hic" ? "secili" : ""}" data-deger="hic">Hiç</button>
      </div>
    </div>

`;

  $$(".toggle", hedefEl).forEach(t => {
    t.addEventListener("click", () => {
      const alan = t.dataset.ayar;
      const acik = !t.classList.contains("acik");
      t.classList.toggle("acik", acik);
      if (alan === "ilIsimleri") konu.ayar.ilIsimleri = acik;
      else if (alan === "objeGorunur") konu.ayar.objeGorunur = acik ? "bastan" : "cevapta";
      else if (alan === "ilSinirlari") konu.ayar.ilSinirlari = !acik;   // anahtar "kaldır" demek
      else if (alan === "hayalet") konu.ayar.hayalet = acik;
      konuAyarUygula(konu);
    });
  });

  $$(".secenek-satir", hedefEl).forEach(satir => {
    $$(".secenek", satir).forEach(b => {
      b.addEventListener("click", () => {
        $$(".secenek", satir).forEach(x => x.classList.remove("secili"));
        b.classList.add("secili");
        konu.ayar[satir.dataset.secenek] = b.dataset.deger;
        konuAyarUygula(konu);
        // cevap birimi hayalet modun açılabilirliğini belirler — paneli tazele
        if (satir.dataset.secenek === "cevapBirimi") konuAyarIcerik(konu, hedefEl);
      });
    });
  });

}

function konuAyarUygula(konu) {
  kutuphaneKaydet();
  if (durum.konu && durum.konu.id === konu.id && calismaHarita) {
    calismaHarita.isimleriGoster(konu.ayar.ilIsimleri);
    durum.sorular = sorulariUret(konu);
    soruyuGoster();
  }
  if (typeof editorHarita !== "undefined" && editorHarita &&
      $("#ekran-editor").classList.contains("aktif")) editorTazele();
}

function konuAyarModalAc(konu) {
  konuAyarAc(konu.id);
}

/* ==========================================================
   AYARLAR EKRANI
   ========================================================== */
const SURE_SECENEKLERI = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 6.5, 7, 8, 9, 10];

function ayarEkraniCiz() {
  $("#toggle-birikimli").classList.toggle("acik", durum.ayarlar.birikimli);
  $("#toggle-ses").classList.toggle("acik", durum.ayarlar.ses);
  $("#toggle-titresim").classList.toggle("acik", durum.ayarlar.titresim);
  const sec = $("#sure-sec");
  sec.innerHTML = SURE_SECENEKLERI
    .map(v => `<option value="${v}">${String(v).replace(".", ",")} saniye</option>`).join("");
  // kayıtlı değer listede yoksa en yakınına otur
  const kayitli = durum.ayarlar.yanlisSure;
  const enYakin = SURE_SECENEKLERI.reduce((a, b) =>
    Math.abs(b - kayitli) < Math.abs(a - kayitli) ? b : a);
  if (enYakin !== kayitli) { durum.ayarlar.yanlisSure = enYakin; ayarlariKaydet(); }
  sec.value = String(enYakin);
  ilerlemeKonuSeciciDoldur();
  ekranGoster("ayarlar");
}

function ilerlemeKonuSeciciDoldur() {
  const sec = $("#ilerleme-konu-sec");
  const kayitli = durum.kutuphane.filter(k => ilerlemeOku(k.id));
  if (!kayitli.length) {
    sec.innerHTML = `<option value="">— kayıt yok —</option>`;
    sec.disabled = true;
    $("#btn-konu-ilerleme-sil").disabled = true;
    return;
  }
  sec.disabled = false;
  $("#btn-konu-ilerleme-sil").disabled = false;
  sec.innerHTML = kayitli.map(k => {
    const s = sayilar(ilerlemeOku(k.id).sonuclar);
    return `<option value="${k.id}">${guvenli(k.ikon + " " + k.ad)} (${s.cevaplanan})</option>`;
  }).join("");
}

/* ==========================================================
   KONU EKLE / SİL
   ========================================================== */
const KONU_IKONLARI = ["🗺️", "🧭", "⛏️", "🌾", "⛰️", "💧", "🌋", "🏞️", "🌊", "🌡️", "🌲", "🐑", "🏭", "🚜", "🛣️", "🏛️", "🍇", "🐟", "☀️", "❄️", "📊", "📌"];
let yeniKonuIkon = KONU_IKONLARI[0];
let yeniKonuRenk = RENKLER[0];

/* Seçicideki sıra ana ekranla aynı olmalı: üst konular ve kapsayıcısız konular
   `sira` alanına göre dizilir, üst konunun altındakiler kendi grubunda kalır. */
function konuSeciciDoldur(sec) {
  const secenek = k => `<option value="${k.id}">${guvenli(k.ikon + " " + k.ad)}</option>`;

  const parcalar = anaEkranOgeleri().map(oge => {
    if (oge.tip === "konu") return secenek(oge.konu);
    const altlar = ustKonununKonulari(oge.ust.id);
    if (!altlar.length) return "";
    return `<optgroup label="${guvenli(oge.ust.ikon + " " + oge.ust.ad)}">` +
           altlar.map(secenek).join("") + `</optgroup>`;
  });

  sec.innerHTML = parcalar.join("")
    + `<option value="__yeni__">➕ Yeni konu ekle…</option>`
    + `<option value="__sirala__">⇅ Sırala…</option>`;
}

function konuEkleSecimCiz() {
  const i = $("#konu-ikon-secim");
  i.innerHTML = "";
  KONU_IKONLARI.forEach(ik => {
    const b = document.createElement("button");
    b.className = "sec-ogesi" + (ik === yeniKonuIkon ? " secili" : "");
    b.textContent = ik;
    b.addEventListener("click", () => { yeniKonuIkon = ik; konuEkleSecimCiz(); });
    i.appendChild(b);
  });
  const r = $("#konu-renk-secim");
  r.innerHTML = "";
  RENKLER.forEach(rk => {
    const b = document.createElement("button");
    b.className = "sec-ogesi" + (rk === yeniKonuRenk ? " secili" : "");
    b.style.background = rk;
    b.addEventListener("click", () => { yeniKonuRenk = rk; konuEkleSecimCiz(); });
    r.appendChild(b);
  });
}

function konuEkleModalAc() {
  $("#yeni-konu-ad").value = "";
  $("#yeni-konu-aciklama").value = "";
  yeniKonuIkon = KONU_IKONLARI[0];
  yeniKonuRenk = RENKLER[Math.floor(Math.random() * RENKLER.length)];
  konuEkleSecimCiz();
  $("#modal-konu-ekle").classList.remove("gizli");
  setTimeout(() => $("#yeni-konu-ad").focus(), 50);
}

function konuEkleKaydet() {
  const ad = $("#yeni-konu-ad").value.trim();
  if (!ad) { bildir("Konu adı yaz"); return; }
  const konu = {
    id: "k" + yeniId(),
    ad,
    ikon: yeniKonuIkon,
    renk: yeniKonuRenk,
    aciklama: $("#yeni-konu-aciklama").value.trim(),
    ayar: { ilIsimleri: true, objeGorunur: "cevapta", cevapBirimi: "il" },
    objeler: [],
    sorular: []
  };
  durum.kutuphane.push(konu);
  kutuphaneKaydet();
  durum.editorKonuId = konu.id;
  durum.seciliObjeId = null;
  $("#modal-konu-ekle").classList.add("gizli");
  bildir(`"${ad}" eklendi — Harita Düzenle'den obje yerleştir`);

  if ($("#ekran-editor").classList.contains("aktif")) {
    konuSeciciDoldur($("#editor-konu"));
    $("#editor-konu").value = konu.id;
    editorTazele();
  } else {
    konuSeciciDoldur($("#soru-duzen-konu"));
    $("#soru-duzen-konu").value = konu.id;
    soruTablosuCiz();
  }
}

/* Hazır coğrafya içeriği — Natural Earth verisinden üretilmiş akarsu ve göller */
function hazirIcerikEkle() {
  if (typeof HAZIR_AKARSULAR === "undefined") { bildir("Hazır içerik dosyası bulunamadı"); return; }
  let eklenen = 0;

  const konuKur = (id, ad, ikon, renk, aciklama, ayar) => {
    let k = durum.kutuphane.find(x => x.id === id);
    if (!k) {
      k = { id, ad, ikon, renk, aciklama, ayar, objeler: [], sorular: [] };
      durum.kutuphane.push(k);
    }
    return k;
  };

  const akarsu = konuKur("hazir-akarsular", "Akarsular", "〰️", "#0ea5e9",
    "Türkiye'nin akarsuları",
    { ilIsimleri: false, objeGorunur: "bastan", cevapBirimi: "obje", objeAdlari: "cevapta" });

  HAZIR_AKARSULAR.forEach(a => {
    if (akarsu.objeler.some(o => o.ad === a.ad)) return;
    akarsu.objeler.push({
      id: yeniId(), tip: "cizgi", emoji: "〰️", ad: a.ad, iller: [], soruMetni: "",
      x: null, y: null, boyut: 1, aci: 0,
      noktalar: a.noktalar, renk: "#38bdf8", kalinlik: 2.4,
      desen: "duz", saydamlik: 0.45, baloncuklar: [], cevapBirimi: "konu"
    });
    eklenen++;
  });

  const gol = konuKur("hazir-goller", "Göller ve Barajlar", "💧", "#06b6d4",
    "Göller, baraj gölleri",
    { ilIsimleri: false, objeGorunur: "bastan", cevapBirimi: "obje", objeAdlari: "cevapta" });

  HAZIR_GOLLER.forEach(a => {
    if (gol.objeler.some(o => o.ad === a.ad)) return;
    gol.objeler.push({
      id: yeniId(), tip: "alan", emoji: "💧", ad: a.ad, iller: [], soruMetni: "",
      x: null, y: null, boyut: 1, aci: 0,
      noktalar: a.noktalar, renk: "#38bdf8", kalinlik: 1.4,
      desen: "duz", saydamlik: 0.75, baloncuklar: [], cevapBirimi: "konu"
    });
    eklenen++;
  });

  kutuphaneKaydet();
  bildir(eklenen ? `${eklenen} obje eklendi — Harita Düzenle'den düzeltebilirsin` : "Hazır içerik zaten ekli");
  anaEkranaGec();
}

function konuSil(konu) {
  if (durum.kutuphane.length <= 1) { bildir("Son konuyu silemezsin"); return; }
  onay(`"${konu.ad}" konusu, içindeki ${konu.objeler.length} obje ve tüm soruları silinecek.`,
       { baslik: "Konuyu sil", ikon: konu.ikon, evet: "Konuyu sil" }).then(evet => {
    if (!evet) return;
    durum.kutuphane = durum.kutuphane.filter(k => k.id !== konu.id);
    kutuphaneKaydet();
    const tum = Depo.oku("ilerleme", {});
    Object.keys(tum).forEach(p => { delete tum[p][konu.id]; });
    Depo.yaz("ilerleme", tum);
    durum.editorKonuId = durum.kutuphane[0].id;
    if ($("#ekran-ust-konular").classList.contains("aktif")) ustKonuListesiCiz();
    bildir("Konu silindi");
  });
}

/* ==========================================================
   SORU SEKMESİ — objelerin illeri ve soru metinleri
   ========================================================== */
function soruTablosuCiz() {
  const konu = konuBul(durum.editorKonuId);
  if (!konu) return;

  const tablo = $("#soru-tablo");
  tablo.innerHTML = "";
  const objeli = konu.objeler && konu.objeler.length;
  $("#soru-sayisi").textContent = sorulariUret(konu).length;

  /* ---- objesiz konu: elle yazılmış sorular ---- */
  if (!objeli) {
    if (!konu.sorular.length) {
      tablo.innerHTML = `<p class="bos-uyari kucuk">Bu konuda henüz soru yok. Aşağıdan ekleyebilir ya da <b>Harita</b> sekmesinden obje koyabilirsin.</p>`;
    }
    konu.sorular.forEach((kayit, i) => {
      const satir = document.createElement("div");
      satir.className = "soru-satir";
      satir.innerHTML = `
        <span class="satir-emoji">${i + 1}</span>
        <div class="satir-alanlar">
          <input class="kucuk-alan" value="${guvenli(kayit.metin)}" placeholder="Soru metni">
          <span class="satir-il">${guvenli(kayit.bolge ? kayit.bolge : (kayit.hedef || []).join(", "))}</span>
        </div>
        <button class="satir-sil" title="Sil">✕</button>`;
      $("input", satir).addEventListener("change", e => {
        kayit.metin = e.target.value; kutuphaneKaydet(); bildir("Kaydedildi");
      });
      $(".satir-sil", satir).addEventListener("click", () => {
        onay(`"${kayit.metin || "Bu soru"}" silinecek.`, { baslik: "Soruyu sil", ikon: "🗑️" }).then(evet => {
          if (!evet) return;
          konu.sorular.splice(i, 1); kutuphaneKaydet(); soruTablosuCiz();
        });
      });
      tablo.appendChild(satir);
    });

    $("#soru-ekle-alani").innerHTML = `
      <label class="alan-etiket">Yeni soru</label>
      <input class="kucuk-alan" id="yeni-soru-metin" placeholder="Soru metni">
      <select class="secici tam" id="yeni-soru-hedef">
        <optgroup label="Bölge">
          ${Object.keys(BOLGELER).map(b => `<option value="B:${guvenli(b)}">${guvenli(b)} Bölgesi</option>`).join("")}
        </optgroup>
        <optgroup label="İl">
          ${IL_ADLARI.map(il => `<option value="I:${guvenli(il)}">${guvenli(il)}</option>`).join("")}
        </optgroup>
      </select>
      <button class="ana-btn ince tam" id="btn-soru-ekle">Soruyu ekle</button>`;
    $("#btn-soru-ekle").addEventListener("click", () => {
      const metin = $("#yeni-soru-metin").value.trim();
      const hedef = $("#yeni-soru-hedef").value;
      if (!metin) { bildir("Soru metni yaz"); return; }
      if (hedef.startsWith("B:")) konu.sorular.push({ metin, bolge: hedef.slice(2) });
      else konu.sorular.push({ metin, hedef: [hedef.slice(2)] });
      kutuphaneKaydet(); soruTablosuCiz(); bildir("Soru eklendi");
    });
    return;
  }

  /* ---- objeli konu: obje listesi, seçiliyi düzenle ---- */
  $("#soru-ekle-alani").innerHTML = "";
  konu.objeler.forEach(o => {
    const secili = o.id === durum.seciliObjeId;
    const kart = document.createElement("div");
    kart.className = "soru-obje" + (secili ? " secili" : "");
    const simge = o.tip === "cizgi" ? "〰️" : o.tip === "alan" ? "⬭" : (o.emoji || "📍");
    const soruAdet = (o.sorular || []).filter(x => (x.metin || "").trim()).length;

    kart.innerHTML = `
      <button class="soru-obje-bas">
        <span class="satir-emoji">${guvenli(simge)}</span>
        <b>${guvenli(o.ad || "(adsız)")}</b>
        <span class="sayi-rozet">${soruAdet || 1}</span>
      </button>`;

    $(".soru-obje-bas", kart).addEventListener("click", () => {
      durum.seciliObjeId = secili ? null : o.id;
      soruTablosuCiz();
    });

    if (secili) {
      const govde = document.createElement("div");
      govde.className = "soru-obje-govde";
      govde.innerHTML = `
        <label class="alan-etiket">İller <span class="sayi-rozet">${o.iller.length}</span></label>
        <div class="il-rozetleri">
          ${o.iller.map(il => `<span class="il-rozet">${guvenli(il)}<button data-il-sil="${guvenli(il)}">✕</button></span>`).join("")}
          ${o.iller.length ? "" : `<span class="bos-il">Henüz il yok</span>`}
        </div>
        <div class="ekle-satir dar">
          <select class="secici tam" id="il-ekle-sec">
            ${IL_ADLARI.map(il => `<option value="${guvenli(il)}">${guvenli(il)}</option>`).join("")}
          </select>
          <button class="ikincil-btn ince" id="btn-il-ekle">Ekle</button>
        </div>
        ${(o.tip === "cizgi" || o.tip === "alan")
          ? `<button class="ikincil-btn ince tam" id="btn-il-yenile">${o.tip === "alan" ? "Kapsadığı" : "Geçtiği"} illeri yeniden bul</button>` : ""}

        <label class="alan-etiket">Sorular</label>
        <div class="soru-metinleri">
          ${(o.sorular || []).map((sr, i) => `
            <div class="soru-metin-satir">
              <textarea class="kucuk-alan" data-soru="${i}" rows="2"
                placeholder="Soru metni">${guvenli(sr.metin || "")}</textarea>
              <button class="satir-sil" data-soru-sil="${i}" title="Sil">✕</button>
            </div>`).join("")}
          ${(o.sorular || []).length ? "" :
            `<p class="bos-uyari kucuk">Soru yazmazsan otomatik üretilir: <b>${guvenli(otomatikSoru(o, konu))}</b></p>`}
        </div>
        <button class="ikincil-btn ince tam" id="btn-soru-metin-ekle">＋ Soru ekle</button>`;
      kart.appendChild(govde);

      $$("[data-il-sil]", govde).forEach(b => b.addEventListener("click", () => {
        o.iller = o.iller.filter(x => x !== b.dataset.ilSil);
        kutuphaneKaydet(); soruTablosuCiz();
      }));
      $("#btn-il-ekle", govde).addEventListener("click", () => {
        const il = $("#il-ekle-sec", govde).value;
        if (o.iller.includes(il)) { bildir(il + " zaten ekli"); return; }
        o.iller.push(il); kutuphaneKaydet(); soruTablosuCiz();
      });
      const yenile = $("#btn-il-yenile", govde);
      if (yenile) yenile.addEventListener("click", () => {
        if (!editorHarita) return;
        o.iller = o.tip === "alan"
          ? alaninIlleri(editorHarita, o.noktalar)
          : cizgininIlleri(editorHarita, o.noktalar);
        kutuphaneKaydet(); soruTablosuCiz();
        bildir(o.iller.length + " il bulundu");
      });
      $$("[data-soru]", govde).forEach(t => t.addEventListener("change", () => {
        o.sorular[+t.dataset.soru].metin = t.value;
        kutuphaneKaydet(); bildir("Kaydedildi");
      }));
      $$("[data-soru-sil]", govde).forEach(b => b.addEventListener("click", () => {
        o.sorular.splice(+b.dataset.soruSil, 1);
        kutuphaneKaydet(); soruTablosuCiz();
      }));
      $("#btn-soru-metin-ekle", govde).addEventListener("click", () => {
        if (!Array.isArray(o.sorular)) o.sorular = [];
        o.sorular.push({ metin: "" });
        kutuphaneKaydet(); soruTablosuCiz();
      });
    }
    tablo.appendChild(kart);
  });
}

/* soru yazılmamışsa gösterilecek otomatik metin */
function otomatikSoru(o, konu) {
  const birim = konu.ayar.cevapBirimi || "il";
  if (birim === "obje") return `Hangisi ${o.ad || "…"}?`;
  if (birim === "bolge") return `${o.ad || "…"} hangi bölgemizdedir?`;
  return o.iller.length > 1 ? `${o.ad || "…"} hangi illerimizdedir?` : `${o.ad || "…"} hangi ilimizdedir?`;
}

/* Harita Düzenle (editör) kodu js/editor.js dosyasında. */

/* ==========================================================
   OLAYLAR
   ========================================================== */
function olaylariBagla() {
  /* giriş / hesap */
  $("#btn-bulut").addEventListener("click", bulutBilgisi);

  /* ana ekran */
  $("#btn-ayarlar").addEventListener("click", ayarEkraniCiz);
  $("#btn-ayarlar-cik").addEventListener("click", anaEkranaGec);
  $("#btn-istatistik").addEventListener("click", istatistikAc);
  $("#btn-istatistik-kapat").addEventListener("click", () => $("#modal-istatistik").classList.add("gizli"));
  $("#modal-istatistik").addEventListener("click", e => {
    if (e.target.id === "modal-istatistik") $("#modal-istatistik").classList.add("gizli");
  });

  $("#btn-duzenle").addEventListener("click", editorAc);
  $("#btn-editor-cik").addEventListener("click", geriGit);

  /* ayarlar */
  $("#toggle-birikimli").addEventListener("click", () => {
    durum.ayarlar.birikimli = !durum.ayarlar.birikimli;
    $("#toggle-birikimli").classList.toggle("acik", durum.ayarlar.birikimli);
    ayarlariKaydet();
    if (durum.konu && calismaHarita) { isimleriTazele(); objeleriTazele(); }
  });
  $("#sure-sec").addEventListener("change", e => {
    durum.ayarlar.yanlisSure = parseFloat(e.target.value);
    ayarlariKaydet();
    ses("tik");
  });
  $("#toggle-ses").addEventListener("click", () => {
    durum.ayarlar.ses = !durum.ayarlar.ses;
    $("#toggle-ses").classList.toggle("acik", durum.ayarlar.ses);
    ayarlariKaydet();
    if (durum.ayarlar.ses) ses("dogru");
  });
  $("#toggle-titresim").addEventListener("click", () => {
    durum.ayarlar.titresim = !durum.ayarlar.titresim;
    $("#toggle-titresim").classList.toggle("acik", durum.ayarlar.titresim);
    ayarlariKaydet();
    if (durum.ayarlar.titresim) {
      titre("dogru");
      if (!navigator.vibrate) bildir("Bu tarayıcı titreşimi desteklemiyor (iPhone)");
    }
  });
  $("#btn-konu-ilerleme-sil").addEventListener("click", () => {
    const konu = konuBul($("#ilerleme-konu-sec").value);
    if (!konu) return;
    onay(`"${konu.ad}" konusunda kaldığın yer ve doğru/yanlış kayıtların silinecek.`,
         { baslik: "İlerlemeyi sil", ikon: konu.ikon, evet: "Sil" }).then(evet => {
      if (!evet) return;
      ilerlemeYaz(konu.id, null);
      ilerlemeKonuSeciciDoldur();
      bildir(`"${konu.ad}" ilerlemesi silindi`);
    });
  });
  $("#btn-ilerleme-sil").addEventListener("click", () => {
    onay("Bu profilin tüm konulardaki kayıtları ve istatistikleri silinecek. Konuların ve objelerin durur.",
         { baslik: "İlerlemeyi temizle", ikon: "🧹", evet: "Temizle" }).then(evet => {
      if (!evet) return;
      const tum = Depo.oku("ilerleme", {});
      delete tum[durum.aktifProfilId];
      Depo.yaz("ilerleme", tum);
      const gun = Depo.oku("gunluk", {});
      delete gun[durum.aktifProfilId];
      Depo.yaz("gunluk", gun);
      bildir("İlerleme ve istatistikler temizlendi");
      anaEkranaGec();
    });
  });

  $("#btn-geri").addEventListener("click", () => { ses("tik"); oncekiSoru(); });
  $("#btn-pas").addEventListener("click", () => { ses("tik"); pasGec(); });
  $("#btn-durdur").addEventListener("click", () => { ses("tik"); durdur(); });
  $("#btn-devam").addEventListener("click", () => { ses("tik"); devamEt(); });
  $("#btn-cikis").addEventListener("click", calismadanCik);
  $("#btn-ortu-devam").addEventListener("click", devamEt);
  $("#btn-ortu-cik").addEventListener("click", calismadanCik);
  $("#btn-bastan").addEventListener("click", bastanBasla);
  $("#btn-bitis-cik").addEventListener("click", calismadanCik);

  editorOlaylari();
  konuDuzenOlaylari();

  document.addEventListener("keydown", e => {
    if (!$("#ekran-calisma").classList.contains("aktif")) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowLeft")  { e.preventDefault(); oncekiSoru(); }
    if (e.key === "ArrowRight") { e.preventDefault(); pasGec(); }
    if (e.code === "Space")     { e.preventDefault(); durum.duraklatildi ? devamEt() : durdur(); }
    if (e.key === "Escape")     { calismadanCik(); }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") ilerlemeKaydet();
  });
  window.addEventListener("pagehide", ilerlemeKaydet);
}

/* ==========================================================
   BAŞLAT
   ========================================================== */
/* ==========================================================
   BULUT KÖPRÜSÜ — bulut.js buradaki iki fonksiyonu çağırır
   ========================================================== */

/* Giriş yok: herkes aynı veriyi görür, kullanıcı ayrımı yapılmaz.
   İlerleme kayıtları hâlâ bir kimliğe göre tutuluyor; o kimlik artık
   sabit "ortak". */
const ORTAK_KIMLIK = "ortak";

function bulutHazir() {
  ayarlariYukle();
  paletYukle();
  kutuphaneYukle();
  ustKonulariYukle();
  bulutDurumu(true);
  anaEkranaGec();
}

/* Buluttan yeni veri indi: yerel ayna güncellendi, ekranı tazele */
function bulutVerisiGeldi(anahtar) {
  if (typeof Bulut === "undefined" || !Bulut.hazir) return;

  if (anahtar === "ayarlar") ayarlariYukle();
  if (anahtar === "palet") paletYukle();
  if (anahtar === "kutuphane") durum.kutuphane = Depo.oku("kutuphane", []);
  if (anahtar === "ustKonular") durum.ustKonular = Depo.oku("ustKonular", []);

  const aktif = ($("section.ekran.aktif") || {}).id;
  if (aktif === "ekran-ana") { ozetiCiz(); konulariCiz(); }
  else if (aktif === "ekran-editor" && typeof editorTazele === "function") {
    konuSeciciDoldur($("#editor-konu"));
    $("#editor-konu").value = durum.editorKonuId;
    if (typeof emojileriCiz === "function") emojileriCiz();
    editorTazele();
  }
}

/* Bulut kutusu: neyin ortak olduğunu anlatır */
function bulutBilgisi() {
  const bagli = typeof Bulut !== "undefined" && Bulut.acik;
  onay(
    bagli
      ? "Konular, objeler ve ilerlemen buluta kayıtlı.\n\n" +
        "Hangi cihazdan açarsan aç aynısını görürsün; bir değişiklik yaptığında " +
        "diğer cihazlar birkaç saniye içinde güncellenir.\n\n" +
        "İnternet yokken de çalışır: yazdıkların sıraya girer, bağlantı gelince gönderilir."
      : "Buluta bağlanılamadı.\n\nUygulama çalışmaya devam ediyor ama yaptığın " +
        "değişiklikler yalnızca bu cihazda kalıyor.",
    { baslik: bagli ? "Bulut bağlı" : "Yerel kip", ikon: bagli ? "☁" : "⛌",
      evet: "Tamam", hayir: "Kapat", tehlikeli: false });
}

function bulutDurumu(bagli) {
  $("#bulut-simge").textContent = bagli ? "☁" : "⛌";
  $("#bulut-ad").textContent = bagli ? "Bulut" : "Yerel";
  $("#btn-bulut").title = bagli
    ? "Konular ve ilerleme bütün cihazlarında ortak"
    : "Buluta bağlanılamadı — değişiklikler yalnızca bu cihazda";
}

/* Herkes düzenleyebilir — giriş olmadığı için rol ayrımı yok */
function adminMi() { return true; }

function baslat() {
  durum.profiller = [{ id: ORTAK_KIMLIK, ad: "Coğrafyam", avatar: "🙂", renk: RENKLER[0], rol: "admin" }];
  durum.aktifProfilId = ORTAK_KIMLIK;
  olaylariBagla();

  if (location.protocol !== "file:" && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  /* Firebase yüklenemezse (dosyadan açma, ağ yok, SDK engelli) uygulama
     eskisi gibi yalnızca bu cihazda çalışır — veri kaybolmaz. */
  if (typeof Bulut !== "undefined" && Bulut.baslat()) return;
  yerelKipeDus();
}

function yerelKipeDus() {
  ayarlariYukle();
  paletYukle();
  kutuphaneYukle();
  ustKonulariYukle();
  bulutDurumu(false);
  anaEkranaGec();
}

document.addEventListener("DOMContentLoaded", baslat);
