/* ==========================================================
   Coğrafyam — Üst Konular ve Konu Ayarları ekranları
   ========================================================== */

const UST_IKONLARI = ["📁", "🌍", "⛰️", "🏙️", "🏭", "🌦️", "🧭", "🗺️", "🌊", "🌱", "📊", "🧱"];

/* ==========================================================
   ÜST KONULAR — sürükle bırak sıralama ve kapsayıcıya taşıma
   ========================================================== */
function ustKonularAc() {
  ustKonuListesiCiz();
  ekranGoster("ust-konular");
}

function ustKonuListesiCiz() {
  const liste = $("#ust-konu-listesi");
  liste.innerHTML = "";

  const ogeler = anaEkranOgeleri();
  if (!ogeler.length) {
    liste.innerHTML = `<p class="bos-uyari">Henüz konu yok.</p>`;
    return;
  }

  const kok = document.createElement("div");
  kok.className = "sirali-bolge";
  kok.dataset.bolge = "kok";
  liste.appendChild(kok);

  ogeler.forEach(oge => {
    if (oge.tip === "konu") {
      kok.appendChild(konuSatiri(oge.konu));
      return;
    }
    const u = oge.ust;
    const blok = document.createElement("div");
    blok.className = "ust-blok";
    blok.dataset.ust = u.id;
    blok.style.setProperty("--u1", u.renk);
    blok.dataset.sira = u.sira || 0;

    blok.innerHTML = `
      <div class="duzen-satir ust-satir" data-tip="ust" data-id="${u.id}">
        <span class="tutamak-sirala" title="Sürükleyerek sırala">⠿</span>
        <button class="satir-emoji-btn" data-emoji-ust="${u.id}" title="Simge değiştir">${guvenli(u.ikon)}</button>
        <input class="kucuk-alan satir-ad" data-ad-ust="${u.id}" value="${guvenli(u.ad)}" placeholder="Üst konu adı">
        <button class="renk-nokta" data-renk-ust="${u.id}" style="background:${guvenli(u.renk)}" title="Renk"></button>
        <button class="satir-sil" data-sil-ust="${u.id}" title="Sil">✕</button>
      </div>
      <div class="sirali-bolge ic-bolge" data-bolge="${u.id}"></div>`;

    const icBolge = $(".ic-bolge", blok);
    const altlar = ustKonununKonulari(u.id);
    if (!altlar.length) {
      icBolge.innerHTML = `<p class="ic-bos">Buraya konu sürükle</p>`;
    } else {
      altlar.forEach(k => icBolge.appendChild(konuSatiri(k)));
    }
    kok.appendChild(blok);
  });

  ustKonuOlaylari();
  $$(".sirali-bolge").forEach(b => suruklenebilirYap(b));
}

function konuSatiri(konu) {
  const el = document.createElement("div");
  el.className = "duzen-satir konu-satiri";
  el.dataset.tip = "konu";
  el.dataset.id = konu.id;
  el.dataset.sira = konu.sira || 0;
  const soru = sorulariUret(konu).length;
  el.innerHTML = `
    <span class="tutamak-sirala" title="Sürükleyerek sırala veya bir kutuya taşı">⠿</span>
    <span class="satir-emoji-btn dusuk">${guvenli(konu.ikon)}</span>
    <span class="satir-ad-metin">${guvenli(konu.ad)}</span>
    <span class="sayi-rozet">${soru}</span>
    <button class="satir-ayar" data-ayar-konu="${konu.id}" title="Konu ayarları">⚙</button>
    <button class="satir-sil" data-sil-konu="${konu.id}" title="Konuyu sil">✕</button>`;
  return el;
}

function ustKonuOlaylari() {
  $$("[data-ad-ust]").forEach(inp => inp.addEventListener("change", () => {
    const u = ustKonuBul(inp.dataset.adUst);
    if (!u) return;
    u.ad = inp.value.trim() || "Adsız";
    ustKonulariKaydet();
    bildir("Kaydedildi");
  }));

  $$("[data-emoji-ust]").forEach(b => b.addEventListener("click", () => {
    const u = ustKonuBul(b.dataset.emojiUst);
    if (!u) return;
    const i = UST_IKONLARI.indexOf(u.ikon);
    u.ikon = UST_IKONLARI[(i + 1) % UST_IKONLARI.length];
    ustKonulariKaydet();
    ustKonuListesiCiz();
  }));

  $$("[data-renk-ust]").forEach(b => b.addEventListener("click", () => {
    const u = ustKonuBul(b.dataset.renkUst);
    if (!u) return;
    const i = RENKLER.indexOf(u.renk);
    u.renk = RENKLER[(i + 1) % RENKLER.length];
    ustKonulariKaydet();
    ustKonuListesiCiz();
  }));

  $$("[data-sil-ust]").forEach(b => b.addEventListener("click", () => {
    const u = ustKonuBul(b.dataset.silUst);
    if (!u) return;
    const adet = ustKonununKonulari(u.id).length;
    onay(`"${u.ad}" kutusu silinecek. İçindeki ${adet} konu silinmez, kapsayıcısız hale gelir.`,
         { baslik: "Üst konuyu sil", ikon: u.ikon, evet: "Kutuyu sil" }).then(evet => {
      if (!evet) return;
      ustKonuSil(u);
      ustKonuListesiCiz();
      bildir("Üst konu silindi");
    });
  }));

  $$("[data-ayar-konu]").forEach(b => b.addEventListener("click", () => {
    konuAyarAc(b.dataset.ayarKonu);
  }));

  $$("[data-sil-konu]").forEach(b => b.addEventListener("click", () => {
    const k = konuBul(b.dataset.silKonu);
    if (k) konuSil(k);
  }));
}

/* ---------------- sürükle bırak ---------------- */
let surukleDurum = null;

function suruklenebilirYap(bolge) {
  bolge.addEventListener("pointerdown", ev => {
    const tut = ev.target.closest(".tutamak-sirala");
    if (!tut) return;
    const satir = tut.closest(".duzen-satir");
    if (!satir) return;
    // üst konu satırında tüm bloğu taşı
    const tasinan = satir.dataset.tip === "ust" ? satir.closest(".ust-blok") : satir;
    if (!tasinan) return;

    ev.preventDefault();
    const kutu = tasinan.getBoundingClientRect();
    const yer = document.createElement("div");
    yer.className = "surukle-yeri";
    yer.style.height = kutu.height + "px";

    surukleDurum = {
      el: tasinan,
      yer,
      tip: satir.dataset.tip,
      id: satir.dataset.id,
      kaydirmaY: ev.clientY - kutu.top,
      genislik: kutu.width
    };

    tasinan.parentNode.insertBefore(yer, tasinan);
    tasinan.classList.add("suruklenen");
    tasinan.style.width = kutu.width + "px";
    tasinan.style.top = kutu.top + "px";
    tasinan.style.left = kutu.left + "px";
    document.body.appendChild(tasinan);

    document.addEventListener("pointermove", surukleHareket);
    document.addEventListener("pointerup", surukleBirak, { once: true });
  });
}

function surukleHareket(ev) {
  if (!surukleDurum) return;
  const { el, yer, tip } = surukleDurum;
  el.style.top = (ev.clientY - surukleDurum.kaydirmaY) + "px";

  el.style.pointerEvents = "none";
  const altinda = document.elementFromPoint(ev.clientX, ev.clientY);
  el.style.pointerEvents = "";
  if (!altinda) return;

  // hedef bölge: üst konu blokları sadece kökte durabilir
  let bolge = altinda.closest(".sirali-bolge");
  if (!bolge) return;
  if (tip === "ust" && bolge.dataset.bolge !== "kok") bolge = $('[data-bolge="kok"]');
  if (!bolge) return;

  const bosYazi = $(".ic-bos", bolge);
  if (bosYazi) bosYazi.remove();

  const komsu = [...bolge.children].filter(c =>
    c !== yer && (c.classList.contains("duzen-satir") || c.classList.contains("ust-blok")));

  let hedef = null;
  for (const k of komsu) {
    const r = k.getBoundingClientRect();
    if (ev.clientY < r.top + r.height / 2) { hedef = k; break; }
  }
  if (hedef) bolge.insertBefore(yer, hedef);
  else bolge.appendChild(yer);
}

function surukleBirak() {
  document.removeEventListener("pointermove", surukleHareket);
  if (!surukleDurum) return;
  const { el, yer } = surukleDurum;

  yer.parentNode.insertBefore(el, yer);
  yer.remove();
  el.classList.remove("suruklenen");
  el.style.width = el.style.top = el.style.left = "";
  surukleDurum = null;

  siralamayiKaydet();
  ustKonuListesiCiz();
  bildir("Sıralama kaydedildi");
}

/* DOM'daki yeni dizilişi veriye yazar */
function siralamayiKaydet() {
  let sayac = 0;
  const kok = $('[data-bolge="kok"]');
  if (!kok) return;

  [...kok.children].forEach(c => {
    if (c.classList.contains("ust-blok")) {
      const u = ustKonuBul(c.dataset.ust);
      if (u) u.sira = sayac++;
      const ic = $(".ic-bolge", c);
      let icSayac = 0;
      if (ic) [...ic.children].forEach(s => {
        if (!s.classList.contains("konu-satiri")) return;
        const k = konuBul(s.dataset.id);
        if (k) { k.ustKonuId = c.dataset.ust; k.sira = icSayac++; }
      });
    } else if (c.classList.contains("konu-satiri")) {
      const k = konuBul(c.dataset.id);
      if (k) { k.ustKonuId = null; k.sira = sayac++; }
    }
  });

  ustKonulariKaydet();
  kutuphaneKaydet();
}

/* ==========================================================
   KONU AYARLARI EKRANI
   ========================================================== */
function konuAyarAc(konuId) {
  const sec = $("#konu-ayar-sec");
  konuSeciciDoldur(sec);
  const hedef = konuId || durum.editorKonuId;
  durum.editorKonuId = konuBul(hedef) ? hedef : durum.kutuphane[0].id;
  sec.value = durum.editorKonuId;
  konuAyarEkraniCiz();
  ekranGoster("konu-ayar");
}

function konuAyarEkraniCiz() {
  const konu = konuBul(durum.editorKonuId);
  if (!konu) return;
  const govde = $("#konu-ayar-govde");
  const soru = sorulariUret(konu).length;
  const ust = konu.ustKonuId ? ustKonuBul(konu.ustKonuId) : null;

  /* Üst kart hem özet hem düzenleme yüzeyi: ada tıkla adı yaz,
     simgeye tıkla simge ve rengi seç. Ayrı bir "Görünüm" bölümü yok. */
  govde.innerHTML = `
    <div class="konu-ozet" style="--k1:${guvenli(konu.renk)};--k2:${karart(konu.renk, 0.45)}">
      <button class="ozet-emoji" id="btn-konu-gorunum" title="Simge ve rengi değiştir">${guvenli(konu.ikon)}</button>
      <div class="ozet-yazi">
        <input class="ozet-ad" id="konu-ad-alan" value="${guvenli(konu.ad)}" maxlength="28"
               placeholder="Konu adı" title="Adı değiştirmek için tıkla">
        <div class="ozet-alt">${soru} soru · ${ust ? guvenli(ust.ikon + " " + ust.ad) : "kapsayıcısız"}</div>
      </div>
      <button class="ozet-ice" id="btn-konu-ice" title="Koddan ya da dosyadan içerik ekle">⬆<span> İçe aktar</span></button>
    </div>
    <div class="ayar-alani" id="ayar-alani"></div>
    <button class="ana-btn tam" id="btn-ayardan-duzenle">Sorulara geç →</button>`;

  konuAyarIcerik(konu, $("#ayar-alani"));

  const adAlani = $("#konu-ad-alan");
  adAlani.addEventListener("input", () => {
    konu.ad = adAlani.value.trim() || konu.ad;
    kutuphaneKaydet();
  });
  adAlani.addEventListener("change", () => {
    konuSeciciDoldur($("#konu-ayar-sec"));
    $("#konu-ayar-sec").value = konu.id;
  });

  $("#btn-konu-gorunum").addEventListener("click", () => konuGorunumAc(konu));
  $("#btn-konu-ice").addEventListener("click", () => konuIceAc(konu));
  /* Akışın devamı: ayarları seçtin, şimdi soruları yaz */
  $("#btn-ayardan-duzenle").addEventListener("click", () => {
    durum.editorKonuId = konu.id;
    editorAc();
  });
}

/* Simge ve renk kutusu — seçim anında uygulanır, kaydet düğmesi yok. */
function konuGorunumAc(konu) {
  const kutu = $("#modal-konu-gorunum");
  const ikonlar = $("#gorunum-ikon-secim");
  const renkler = $("#gorunum-renk-secim");

  const ciz = () => {
    ikonlar.innerHTML = "";
    KONU_IKONLARI.forEach(i => {
      const b = document.createElement("button");
      b.className = "sec-ogesi" + (konu.ikon === i ? " secili" : "");
      b.textContent = i;
      b.addEventListener("click", () => {
        konu.ikon = i;
        kutuphaneKaydet();
        ciz();
        konuAyarEkraniCiz();
      });
      ikonlar.appendChild(b);
    });
    renkler.innerHTML = "";
    RENKLER.forEach(r => {
      const b = document.createElement("button");
      b.className = "renk-nokta" + (konu.renk === r ? " secili" : "");
      b.style.background = r;
      b.addEventListener("click", () => {
        konu.renk = r;
        kutuphaneKaydet();
        ciz();
        konuAyarEkraniCiz();
      });
      renkler.appendChild(b);
    });
  };

  ciz();
  kutu.classList.remove("gizli");
}

function konuDuzenOlaylari() {
  $("#btn-ust-konu-cik").addEventListener("click", geriGit);
  $("#btn-konu-ayar-cik").addEventListener("click", geriGit);

  $("#btn-ust-konu-ekle").addEventListener("click", () => {
    const u = ustKonuEkle("Yeni kutu", UST_IKONLARI[0], RENKLER[Math.floor(Math.random() * RENKLER.length)]);
    ustKonuListesiCiz();
    bildir("Üst konu eklendi — adını yaz, içine konu sürükle");
    setTimeout(() => {
      const alan = $(`[data-ad-ust="${u.id}"]`);
      if (alan) { alan.focus(); alan.select(); }
    }, 60);
  });

  $("#konu-ayar-sec").addEventListener("change", e => {
    if (e.target.value === "__yeni__") { e.target.value = durum.editorKonuId; konuEkleModalAc(); return; }
    if (e.target.value === "__sirala__") { e.target.value = durum.editorKonuId; ustKonularAc(); return; }
    durum.editorKonuId = e.target.value;
    konuAyarEkraniCiz();
  });
  $("#btn-yeni-konu-ayar").addEventListener("click", konuEkleModalAc);

  konuIceOlaylari();

  $("#btn-gorunum-kapat").addEventListener("click", () => $("#modal-konu-gorunum").classList.add("gizli"));
  $("#modal-konu-gorunum").addEventListener("click", e => {
    if (e.target.id === "modal-konu-gorunum") e.target.classList.add("gizli");
  });
}

/* ==========================================================
   KONU İÇE AKTAR — tek kodla konuyu doldurur
   Biçim (her alan isteğe bağlı):
   {
     "konu":  { "ad", "ikon", "renk", "aciklama" },
     "ayar":  { "cevapBirimi", "ilIsimleri", "ilSinirlari", "hayalet",
                "objeGorunur", "objeAdlari", "birikmesin", "ilCevapta" },
     "objeler": [ { "ad", "emoji", "iller": ["Mardin", "Balıkesir/Bigadiç"],
                    "ilce", "cerceve", "ekGoster", "boyut", "sorular": ["…"] },
                  { "tip": "alan" | "cizgi", "ad", "noktalar": [[x, y], …],
                    "renk", "desen", "saydamlik", "kalinlik", "iller", "sorular" } ],
     "sorular": [ { "metin", "il" | "iller" | "bolge" } ]
   }
   Her il ayrı bir seçim birimi olur ama aynı adı taşıdıkları için tek
   soruda toplanır. x/y boş bırakılır: objeKonum onları il yazısının
   yanına koyar, aynı ildekileri etrafa dağıtır.
   ========================================================== */
let iceKonu = null;

/* Türkçe harfleri ve büyük/küçük farkını yok sayar: "MUGLA" = "Muğla" */
function iceKatla(s) {
  const tablo = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
  return String(s == null ? "" : s).toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]/g, c => tablo[c])
    .replace(/\s+/g, " ").trim();
}

const IL_TAKMA_ADLARI = {
  afyon: "Afyonkarahisar", maras: "Kahramanmaraş", "k.maras": "Kahramanmaraş",
  urfa: "Şanlıurfa", antep: "Gaziantep", icel: "Mersin"
};

function iceIlBul(ad) {
  const k = iceKatla(ad);
  if (!k) return null;
  if (IL_TAKMA_ADLARI[k]) return IL_TAKMA_ADLARI[k];
  return IL_ADLARI.find(il => iceKatla(il) === k) || null;
}

function iceBolgeBul(ad) {
  const k = iceKatla(ad).replace(/ bolgesi$/, "");
  return Object.keys(BOLGELER).find(b =>
    iceKatla(b) === k || iceKatla(b).replace(/ anadolu$/, "") === k) || null;
}

/* null = çerçeve yok, undefined = yazılmış ama tanınmadı */
function iceCerceveBul(ad) {
  const k = iceKatla(ad);
  if (!k) return null;
  const c = CERCEVELER.find(c => iceKatla(c.id) === k || iceKatla(c.ad) === k || c.simge === ad);
  return c ? c.id : undefined;
}

/* Metni ya da diziyi listeye çevirir: "Mardin, Muğla" -> ["Mardin", "Muğla"] */
function iceListe(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return v.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  return [];
}

function iceMetinler(v) {
  return iceListe(v).map(x => typeof x === "string" ? x : (x && x.metin) || "")
    .map(s => String(s).trim()).filter(Boolean);
}

/* Yapıştırılan metni çözer. ```json çitleri ve sondaki virgüller
   (yapay zekâ çıktısında sık görülür) sorun çıkarmasın. */
function iceCoz(metin, yedekOlabilir) {
  let m = String(metin || "").trim()
    .replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
  if (!m) throw new Error("Kutu boş — kodu yapıştır ya da dosya seç");
  m = m.replace(/,\s*([}\]])/g, "$1").replace(/,\s*$/, "");
  let veri;
  try { veri = JSON.parse(m); }
  catch (e) { throw new Error("Kod okunamadı — geçerli bir JSON değil (" + e.message + ")"); }
  if (!veri || typeof veri !== "object" || Array.isArray(veri)) throw new Error("Kod bir { … } nesnesi olmalı");
  if (yedekMi(veri) && !yedekOlabilir) {
    throw new Error("Bu bir tüm uygulama yedeği. Onu Düzenle ekranındaki ⬆ İçe aktar ile yükle.");
  }
  return veri;
}

/* Kodu konuya uygulanacak parçalara çevirir; hiçbir şeyi değiştirmez. */
function iceHazirla(veri) {
  const hatalar = [];
  const sonuc = { konu: {}, ayar: {}, objeler: [], sorular: [] };

  const k = veri.konu || {};
  if (typeof k.ad === "string" && k.ad.trim()) sonuc.konu.ad = k.ad.trim().slice(0, 28);
  if (typeof k.ikon === "string" && k.ikon.trim()) sonuc.konu.ikon = k.ikon.trim();
  if (typeof k.aciklama === "string") sonuc.konu.aciklama = k.aciklama.trim().slice(0, 40);
  if (typeof k.bilgi === "string") sonuc.konu.bilgi = iceBilgi(k.bilgi);
  if (k.renk !== undefined) {
    if (/^#[0-9a-f]{6}$/i.test(k.renk)) sonuc.konu.renk = k.renk;
    else hatalar.push(`Renk "${k.renk}" tanınmadı — #3b82f6 gibi yazılmalı`);
  }

  const a = veri.ayar || {};
  if (a.cevapBirimi !== undefined) {
    const b = BIRIMLER.find(([d, ad]) =>
      iceKatla(d) === iceKatla(a.cevapBirimi) || iceKatla(ad) === iceKatla(a.cevapBirimi));
    if (b) sonuc.ayar.cevapBirimi = b[0];
    else hatalar.push(`Cevap birimi "${a.cevapBirimi}" tanınmadı (il, bolge, obje, alan, cizgi)`);
  }
  ["ilIsimleri", "ilSinirlari", "hayalet", "birikmesin", "ilCevapta"].forEach(ad => {
    if (typeof a[ad] === "boolean") sonuc.ayar[ad] = a[ad];
  });
  if (typeof a.objeGorunur === "boolean") sonuc.ayar.objeGorunur = a.objeGorunur ? "bastan" : "cevapta";
  else if (a.objeGorunur === "bastan" || a.objeGorunur === "cevapta") sonuc.ayar.objeGorunur = a.objeGorunur;
  if (["gorunsun", "cevapta", "hic"].includes(a.objeAdlari)) sonuc.ayar.objeAdlari = a.objeAdlari;

  (Array.isArray(veri.objeler) ? veri.objeler : []).forEach((o, sira) => {
    if (!o || typeof o !== "object") return;
    const ad = String(o.ad || "").trim();
    const etiket = ad || `${sira + 1}. obje`;
    if (o.tip === "alan" || o.tip === "cizgi") {
      const obje = iceSekilHazirla(o, ad, etiket, hatalar);
      if (obje) sonuc.objeler.push(obje);
      return;
    }
    const cerceve = o.cerceve ? iceCerceveBul(o.cerceve) : null;
    if (cerceve === undefined) hatalar.push(`${etiket}: çerçeve "${o.cerceve}" tanınmadı, çerçevesiz eklendi`);
    const sorular = iceMetinler(o.sorular || o.soru).map(metin => ({ metin }));
    const boyut = Number(o.boyut);

    /* "Balıkesir/Bigadiç" biçimi ilçeyi o ile özel verir */
    const yerler = [...iceListe(o.iller), ...iceListe(o.il)];
    if (!yerler.length) { hatalar.push(`${etiket}: il yazılmamış, atlandı`); return; }
    let ilk = true;
    const tekYer = yerler.length === 1;
    const sayi = v => (v === null || v === undefined || v === "" || !Number.isFinite(+v)) ? null : +v;
    yerler.forEach(yer => {
      const [ilAd, ilceAd] = String(yer).split("/").map(s => s.trim());
      const il = iceIlBul(ilAd);
      if (!il) { hatalar.push(`${etiket}: "${ilAd}" diye bir il yok, atlandı`); return; }
      sonuc.objeler.push({
        id: yeniId(), tip: "emoji",
        /* görselli objede emoji boş olabilir; dışa aktarımdan geri gelirken 📍 olmasın */
        emoji: o.gorselId && o.emoji === "" ? "" : (String(o.emoji || "📍").trim() || "📍"),
        gorselId: typeof o.gorselId === "string" && o.gorselId ? o.gorselId : null,
        ad, iller: [il], ilce: ilceAd || String(o.ilce || "").trim(),
        cerceve: cerceve || null, ekGoster: o.ekGoster !== false,
        x: tekYer ? sayi(o.x) : null, y: tekYer ? sayi(o.y) : null,
        boyut: boyut > 0 ? boyut : 2, aci: sayi(o.aci) || 0,
        noktalar: null, renk: null, kalinlik: 3, baloncuklar: iceBaloncuklar(o),
        bilgi: iceBilgi(o.bilgi),
        sorular: ilk ? sorular : []          // metinler gruba ortak, bir kez yeter
      });
      ilk = false;
    });
  });

  (Array.isArray(veri.sorular) ? veri.sorular : []).forEach((s, sira) => {
    const metin = typeof s === "string" ? s.trim() : String((s && s.metin) || "").trim();
    const etiket = metin ? `"${metin.length > 30 ? metin.slice(0, 30) + "…" : metin}"` : `${sira + 1}. soru`;
    if (!metin) { hatalar.push(`${etiket}: metin yok, atlandı`); return; }
    if (s.bolge) {
      const bolge = iceBolgeBul(s.bolge);
      if (!bolge) { hatalar.push(`${etiket}: "${s.bolge}" diye bir bölge yok, atlandı`); return; }
      sonuc.sorular.push(iceBilgiEkle({ metin, bolge }, s));
      return;
    }
    /* Cevabı haritadaki şekiller olan soru: adlar konuya yazılırken
       kimliklere çevrilir (objeler o sırada oluşuyor). */
    const sekilAdlari = iceListe(s.objeler).concat(iceListe(s.sekiller));
    if (sekilAdlari.length) { sonuc.sorular.push(iceBilgiEkle({ metin, objeAdlari: sekilAdlari }, s)); return; }

    const hedef = [];
    [...iceListe(s.iller), ...iceListe(s.il), ...iceListe(s.hedef)].forEach(ad => {
      const il = iceIlBul(ad);
      if (!il) hatalar.push(`${etiket}: "${ad}" diye bir il yok`);
      else if (!hedef.includes(il)) hedef.push(il);
    });
    if (!hedef.length) { hatalar.push(`${etiket}: cevap ili ya da bölgesi yok, atlandı`); return; }
    sonuc.sorular.push(iceBilgiEkle({ metin, hedef }, s));
  });

  return { sonuc, hatalar };
}

/* Alan ve çizgi objeleri: "noktalar" uygulamanın harita koordinatlarıdır
   (SVG viewBox birimi), enlem/boylam değil. Harita stilize olduğu için
   gerçek koordinat basit bir formülle doğru yere düşmüyor (Ege'de 25
   birime kadar kayıyor); dönüşüm içe aktarmadan önce dışarıda yapılır. */
const ICE_DESENLER = ["duz", "cizgili", "tarali", "noktali", "dalgali", "tugla", "igne"];

function iceSekilHazirla(o, ad, etiket, hatalar) {
  const alanMi = o.tip === "alan";
  const noktalar = (Array.isArray(o.noktalar) ? o.noktalar : [])
    .filter(n => Array.isArray(n) && n.length >= 2 && Number.isFinite(+n[0]) && Number.isFinite(+n[1]))
    .map(n => [+(+n[0]).toFixed(1), +(+n[1]).toFixed(1)]);
  const enAz = alanMi ? 3 : 2;
  if (noktalar.length < enAz) {
    hatalar.push(`${etiket}: ${alanMi ? "alan" : "çizgi"} için en az ${enAz} nokta gerekiyor, atlandı`);
    return null;
  }
  if (noktalar.some(([x, y]) => x < -100 || x > 1150 || y < -100 || y > 650)) {
    hatalar.push(`${etiket}: noktalar haritanın dışında (x 0–1007, y 0–527 olmalı), atlandı`);
    return null;
  }

  /* iller: kodda yazıyorsa o, yoksa şeklin geçtiği iller hesaplanır */
  let iller = [];
  const yazilan = [...iceListe(o.iller), ...iceListe(o.il)];
  if (yazilan.length) {
    yazilan.forEach(a => {
      const il = iceIlBul(a);
      if (!il) hatalar.push(`${etiket}: "${a}" diye bir il yok`);
      else if (!iller.includes(il)) iller.push(il);
    });
  } else {
    const h = iceHaritasi();
    iller = alanMi ? alaninIlleri(h, noktalar) : cizgininIlleri(h, noktalar);
  }

  let renk = CIZGI_RENKLERI[0];
  if (o.renk !== undefined) {
    if (/^#[0-9a-f]{6}$/i.test(o.renk)) renk = o.renk;
    else hatalar.push(`${etiket}: renk "${o.renk}" tanınmadı, varsayılan kullanıldı`);
  }
  let desen = "duz";
  if (o.desen !== undefined) {
    const d = ICE_DESENLER.find(x => iceKatla(x) === iceKatla(o.desen));
    if (d) desen = d;
    else hatalar.push(`${etiket}: desen "${o.desen}" tanınmadı (${ICE_DESENLER.join(", ")})`);
  }
  const saydamlik = Number(o.saydamlik);
  const kalinlik = Number(o.kalinlik);

  return {
    id: yeniId(), tip: o.tip, emoji: alanMi ? "⬛" : "〰️", gorselId: null,
    ad, iller, ilce: "", cerceve: null, ekGoster: o.ekGoster !== false,
    x: null, y: null, boyut: 2, aci: 0,
    noktalar, renk, desen,
    kalinlik: kalinlik > 0 ? kalinlik : (alanMi ? 1.4 : 3),
    saydamlik: saydamlik >= 0 && saydamlik <= 1 ? saydamlik : 0.45,
    baloncuklar: iceBaloncuklar(o),
    bilgi: iceBilgi(o.bilgi),
    sorular: iceMetinler(o.sorular || o.soru).map(metin => ({ metin }))
  };
}

/* Bilgi kutusu metni: düz yazı, en çok 1200 karakter */
function iceBilgi(v) { return typeof v === "string" ? v.trim().slice(0, 1200) : ""; }
function iceBilgiEkle(kayit, kaynak) {
  const b = iceBilgi(kaynak && kaynak.bilgi);
  if (b) kayit.bilgi = b;
  return kayit;
}
/* Baloncuklar dışa aktarılan koddan geri gelsin (kayıpsız gidiş-dönüş) */
function iceBaloncuklar(o) {
  return (Array.isArray(o.baloncuklar) ? o.baloncuklar : [])
    .filter(b => b && Number.isFinite(+b.x) && Number.isFinite(+b.y))
    .map(b => ({ x: +b.x, y: +b.y, baslik: String(b.baslik || ""), il: String(b.il || "") }));
}

/* İl bulmak için gerçek bir harita gerekir (isPointInFill): sayfaya bağlı
   ama ekran dışında, bir kez kurulup tekrar kullanılır. */
let _iceHarita = null;
function iceHaritasi() {
  if (_iceHarita) return _iceHarita;
  const kutu = document.createElement("div");
  kutu.style.cssText = "position:fixed;left:-10000px;top:0;width:400px;height:220px;visibility:hidden;pointer-events:none";
  kutu.setAttribute("aria-hidden", "true");
  document.body.appendChild(kutu);
  _iceHarita = new Harita(kutu);
  return _iceHarita;
}

/* Pencere iki yerden açılır:
   - Konu ayarları (konu verilir): kod o konuya aktarılır — Üstüne ekle /
     Hepsini değiştir.
   - Düzenle (konu = null): ne olduğu içeride anlaşılır. Tüm uygulama
     yedeğiyse geri yükleme; konu koduysa koddaki ada bakılır — bu adda
     konu yoksa yeni konu, varsa Yeni konu / Üzerine yaz / İptal sorulur. */
let iceDosyaAdi = "";
let iceBekleyen = null;            // ad çakışması sorulurken hazırlanmış içerik
let iceKuyruk = [];                // birden fazla dosya seçildiyse sıradakiler
let iceOzetler = [];               // toplu aktarmanın dosya başına sonucu
let iceToplam = 0;                 // 0 = tek dosya/yapıştırma
let iceHepsine = null;             // toplu aktarmada "kalanların hepsine" seçilen yanıt

/* Sıradaki dosyayı işler; kuyruk bitince toplu özeti gösterir. */
function iceSiradakiDosya() {
  const d = iceKuyruk.shift();
  if (!d) { iceTopluBitir(); return; }
  iceDosyaAdi = d.ad;
  $("#ice-metin").value = d.metin;
  konuIceUygula();
}

function iceTopluKaydet(ozet, hatalar) {
  iceOzetler.push({ ad: iceDosyaAdi, ozet, hatalar: hatalar || [] });
  $("#ice-cakisma").classList.add("gizli");
  iceSiradakiDosya();
}

function iceTopluBitir() {
  const toplam = iceToplam;
  iceHepsineSifirla();
  const uyarili = iceOzetler.filter(o => o.hatalar.length);
  const aktarilan = iceOzetler.filter(o => !o.atlandi).length;
  iceToplam = 0;
  iceKuyruk = [];
  if (!uyarili.length) {
    const ozetler = iceOzetler;
    iceKapat();
    bildir(`${aktarilan}/${toplam} içe aktarıldı`, 3600);
    iceOzetler = ozetler;
    return;
  }
  const satirlar = [];
  iceOzetler.forEach(o => o.hatalar.forEach(h => satirlar.push(`${o.ad}: ${h}`)));
  iceSonucGoster(`${aktarilan}/${toplam} dosya içe aktarıldı — şunlara dikkat:`, satirlar, aktarilan > 0);
  $("#btn-ice-uygula").classList.add("gizli");
  $("#btn-ice-kapat").textContent = "Kapat";
}

function konuIceAc(konu) {
  iceKonu = konu;
  iceDosyaAdi = "";
  iceBekleyen = null;
  iceKuyruk = [];
  iceOzetler = [];
  iceToplam = 0;
  const genel = !konu;
  $("#ice-baslik").textContent = genel ? "İçe aktar" : "Konuya içe aktar";
  $("#ice-aciklama").textContent = genel
    ? "Konu kodunu ya da tüm uygulama yedeğini yapıştır veya .json dosyasını seç."
    : "Aldığın kodu yapıştır ya da .json dosyasını seç.";
  $("#ice-metin").value = "";
  $("#ice-sonuc").className = "ice-sonuc gizli";
  $("#ice-sonuc").innerHTML = "";
  $("#ice-cakisma").classList.add("gizli");
  const dolu = !genel && (konu.objeler || []).length + (konu.sorular || []).length > 0;
  $("#ice-mod").classList.toggle("gizli", !dolu);
  $$("#ice-mod-secim .secenek").forEach(b => b.classList.toggle("secili", b.dataset.deger === "ekle"));
  $("#btn-ice-uygula").classList.remove("gizli");
  $("#btn-ice-kapat").textContent = "Vazgeç";
  $("#modal-konu-ice").classList.remove("gizli");
  setTimeout(() => $("#ice-metin").focus(), 60);
}

function iceHepsineSifirla() {
  iceHepsine = null;
  const k = $("#ice-hepsine");
  if (k) k.checked = false;
}

function iceKapat() {
  iceHepsineSifirla();
  $("#modal-konu-ice").classList.add("gizli");
  iceKonu = null;
  iceBekleyen = null;
}

function iceSonucGoster(baslik, hatalar, basarili) {
  const kutu = $("#ice-sonuc");
  kutu.className = "ice-sonuc" + (basarili ? " basarili" : "");
  kutu.innerHTML = `<b>${guvenli(baslik)}</b>` + (hatalar.length
    ? `<ul>${hatalar.map(h => `<li>${guvenli(h)}</li>`).join("")}</ul>` : "");
}

function iceBosMu(sonuc) {
  return !sonuc.objeler.length && !sonuc.sorular.length &&
         !Object.keys(sonuc.konu).length && !Object.keys(sonuc.ayar).length;
}

/* Hazırlanmış içeriği konuya yazar, kaydeder; özet metni döndürür. */
function iceKonuyaYaz(konu, sonuc, degistir) {
  if (degistir) { konu.objeler = []; konu.sorular = []; }
  konu.objeler.push(...sonuc.objeler);
  konu.sorular = (konu.sorular || []).concat(sonuc.sorular);

  /* şekil adları -> kimlikler (objeler artık konunun içinde).
     Hiçbiri bulunamazsa soru cevapsız kalırdı; atılır. */
  konu.sorular = konu.sorular.filter(sr => {
    if (!sr.objeAdlari) return true;
    const idler = [];
    sr.objeAdlari.forEach(ad => {
      const o = konu.objeler.find(x => iceKatla(x.ad || "") === iceKatla(ad));
      if (o && !idler.includes(o.id)) idler.push(o.id);
    });
    delete sr.objeAdlari;
    sr.objeler = idler;
    return idler.length > 0;
  });
  Object.assign(konu, sonuc.konu);
  Object.assign(konu.ayar, sonuc.ayar);
  konuAyarUygula(konu);                      // kaydeder, açık harita varsa tazeler

  const isaretler = sonuc.objeler.filter(o => o.tip === "emoji");
  const alanlar = sonuc.objeler.filter(o => o.tip === "alan").length;
  const cizgiler = sonuc.objeler.filter(o => o.tip === "cizgi").length;
  const parcalar = [];
  if (isaretler.length) parcalar.push(`${isaretler.length} obje (${new Set(isaretler.map(o => o.iller[0])).size} il)`);
  if (alanlar) parcalar.push(`${alanlar} alan`);
  if (cizgiler) parcalar.push(`${cizgiler} çizgi`);
  parcalar.push(`${sonuc.sorular.length} yazılı soru`);
  return parcalar.join(", ") + " " + (degistir ? "ile konu yenilendi" : "eklendi");
}

/* Uyarı yoksa pencere kapanır; varsa açık kalır ki atlanan satırlar görülsün */
function iceBitir(ozet, hatalar) {
  if (iceToplam) { iceTopluKaydet(ozet, hatalar); return; }
  if (!hatalar.length) { iceKapat(); bildir(ozet, 3200); return; }
  iceSonucGoster(ozet + " — şunlara dikkat:", hatalar, true);
  $("#ice-mod").classList.add("gizli");
  $("#ice-cakisma").classList.add("gizli");
  $("#btn-ice-uygula").classList.add("gizli");
  $("#btn-ice-kapat").textContent = "Kapat";
}

function konuIceUygula() {
  let veri;
  try { veri = iceCoz($("#ice-metin").value, !iceKonu); }
  catch (e) {
    if (iceToplam) { iceOzetler.push({ ad: iceDosyaAdi, ozet: "", hatalar: [e.message], atlandi: true }); iceSiradakiDosya(); return; }
    iceSonucGoster(e.message, [], false);
    return;
  }
  if (!iceKonu) { iceGenelUygula(veri); return; }

  const konu = konuBul(iceKonu.id);
  if (!konu) { iceKapat(); return; }
  const { sonuc, hatalar } = iceHazirla(veri);
  if (iceBosMu(sonuc)) { iceBosUyar(hatalar); return; }

  const secili = $("#ice-mod-secim .secenek.secili");
  const degistir = !$("#ice-mod").classList.contains("gizli") && secili && secili.dataset.deger === "degistir";
  const ozet = iceKonuyaYaz(konu, sonuc, degistir);
  konuSeciciDoldur($("#konu-ayar-sec"));
  $("#konu-ayar-sec").value = konu.id;
  konuAyarEkraniCiz();
  iceBitir(ozet, hatalar);
}

/* ---- Düzenle'den: yedek mi, konu kodu mu? ---- */
function iceGenelUygula(veri) {
  if (yedekMi(veri)) { iceKapat(); yedegiIceAktar(veri); return; }
  if (Array.isArray(veri.bilgiPaketi)) { iceBilgiPaketi(veri.bilgiPaketi); return; }

  /* "Tüm konular" dışa aktarımı: { konular: [konuKodu, …] } — her biri
     sıradaki dosya gibi işlenir, çakışmada yine Yeni/Üzerine yaz sorulur. */
  if (Array.isArray(veri.konular)) {
    const parcalar = veri.konular.filter(k => k && typeof k === "object")
      .map((k, i) => ({ ad: (k.konu && k.konu.ad) || `${i + 1}. konu`, metin: JSON.stringify(k) }));
    if (!parcalar.length) { iceBosUyar([]); return; }
    if (iceToplam) { iceKuyruk = parcalar.concat(iceKuyruk); iceToplam += parcalar.length - 1; }
    else { iceKuyruk = parcalar; iceOzetler = []; iceToplam = parcalar.length; }
    iceSiradakiDosya();
    return;
  }

  const { sonuc, hatalar } = iceHazirla(veri);
  if (iceBosMu(sonuc)) { iceBosUyar(hatalar); return; }
  const ad = sonuc.konu.ad || (iceDosyaAdi ? dosyaAdindanAd(iceDosyaAdi).slice(0, 28) : "") || "Yeni konu";
  iceBekleyen = { sonuc, hatalar, ad };

  const ayni = iceAdlaBul(ad);
  if (!ayni) { iceYeniKonuya(ad); return; }
  if (iceHepsine) { iceCakismaSecildi(iceHepsine); return; }     // "kalanların hepsine" seçildi
  $("#ice-hepsine-satir").classList.toggle("gizli", !(iceToplam && iceKuyruk.length));
  $("#ice-cakisma-yazi").textContent =
    (iceToplam ? `${iceDosyaAdi}: ` : "") + `"${ayni.ad}" adında bir konu zaten var. Ne yapalım?`;
  $("#ice-cakisma").classList.remove("gizli");
  $("#ice-sonuc").className = "ice-sonuc gizli";
  $("#btn-ice-uygula").classList.add("gizli");
}

function iceBosUyar(hatalar) {
  if (iceToplam) { iceOzetler.push({ ad: iceDosyaAdi, ozet: "", hatalar: hatalar.concat("içinde eklenecek bir şey yok"), atlandi: true }); iceSiradakiDosya(); return; }
  iceSonucGoster("Eklenecek bir şey bulunamadı", hatalar, false);
}

function iceAdlaBul(ad) {
  return durum.kutuphane.find(k => iceKatla(k.ad) === iceKatla(ad)) || null;
}

function iceCakismaSecildi(secim) {
  const b = iceBekleyen;
  if (!iceHepsine && iceToplam && $("#ice-hepsine").checked) iceHepsine = secim;
  if (!b || secim === "iptal") {
    if (iceToplam) { iceOzetler.push({ ad: iceDosyaAdi, ozet: "", hatalar: [], atlandi: true }); $("#ice-cakisma").classList.add("gizli"); iceSiradakiDosya(); return; }
    iceKapat();
    return;
  }
  $("#ice-cakisma").classList.add("gizli");
  if (secim === "uzerine") {
    const konu = iceAdlaBul(b.ad);
    if (!konu) { iceYeniKonuya(b.ad); return; }
    const ozet = iceKonuyaYaz(konu, b.sonuc, true);
    iceEditoreGec(konu);
    iceBitir(`"${konu.ad}": ${ozet}`, b.hatalar);
    return;
  }
  /* yeni konu: aynı ad kalmasın, sonuna (2), (3)… */
  let n = 2, yeniAd;
  do { yeniAd = `${b.ad} (${n++})`; } while (iceAdlaBul(yeniAd));
  iceYeniKonuya(yeniAd);
}

function iceYeniKonuya(ad) {
  const b = iceBekleyen;
  const konu = {
    id: "k" + yeniId(), ad,
    ikon: KONU_IKONLARI[0], renk: RENKLER[Math.floor(Math.random() * RENKLER.length)], aciklama: "",
    ayar: { ilIsimleri: true, objeGorunur: "cevapta", cevapBirimi: "il", objeAdlari: "cevapta", ilSinirlari: true },
    objeler: [], sorular: [], ustKonuId: null, sira: enBuyukSira() + 1
  };
  durum.kutuphane.push(konu);
  delete b.sonuc.konu.ad;                    // ad zaten verildi ("(2)" eki korunsun)
  const ozet = iceKonuyaYaz(konu, b.sonuc, false);
  iceEditoreGec(konu);
  iceBitir(`"${ad}" oluşturuldu: ${ozet}`, b.hatalar);
}

/* Düzenle ekranı açıksa yeni/yenilenen konuya geç, eklenenler görünsün */
/* Bilgi paketi: yalnızca bilgi metinlerini, konu ve obje ADINA göre mevcut
   konulara yazar. Şekillere, konumlara, sorulara dokunmaz — elle yapılan
   düzeltmeler kaybolmasın diye konu kodu yerine bu kullanılır.
   [{ konu: "Ad" | ["Ad", "Diğer ad"], bilgi?, objeler?: {ad: metin}, sorular?: {metin: metin} }] */
function iceBilgiPaketi(paket) {
  const hatalar = [];
  let obje = 0, soru = 0, konuSay = 0;
  paket.forEach(p => {
    const adlar = [].concat((p && p.konu) || []).map(String);
    const konular = adlar.map(iceAdlaBul).filter(Boolean);
    if (!konular.length) { hatalar.push(`"${adlar[0] || "?"}" adında konu yok, atlandı`); return; }
    konular.forEach(konu => {
      konuSay++;
      if (typeof p.bilgi === "string") konu.bilgi = iceBilgi(p.bilgi);
      Object.entries(p.objeler || {}).forEach(([ad, metin]) => {
        const hedef = (konu.objeler || []).filter(o => iceKatla(o.ad || "") === iceKatla(ad));
        if (!hedef.length) { hatalar.push(`${konu.ad}: "${ad}" objesi yok`); return; }
        hedef.forEach(o => { o.bilgi = iceBilgi(metin); });
        obje++;
      });
      Object.entries(p.sorular || {}).forEach(([m, metin]) => {
        const hedef = (konu.sorular || []).filter(s => iceKatla(s.metin || "") === iceKatla(m));
        if (!hedef.length) { hatalar.push(`${konu.ad}: "${m.slice(0, 30)}…" sorusu yok`); return; }
        hedef.forEach(s => { s.bilgi = iceBilgi(metin); });
        soru++;
      });
    });
  });
  kutuphaneKaydet();
  iceBitir(`Bilgi eklendi: ${konuSay} konu, ${obje} obje, ${soru} soru`, hatalar);
}

/* ---- dışa aktarma: içe aktarılabilir konu kodu ----
   Kayıpsız gidiş-dönüş: içe aktarırken "Üzerine yaz" konunun kimliğini
   korur, soru metinleri de aynı kaldığı için ilerleme ve günlük tekrar
   kayıtları (konu + soru metni) yerinde kalır. */
function konuKodu(konu) {
  const a = konu.ayar || {};
  const kod = { konu: { ad: konu.ad, ikon: konu.ikon, renk: konu.renk, aciklama: konu.aciklama || "" },
                ayar: {}, objeler: [], sorular: [] };
  if (konu.bilgi) kod.konu.bilgi = konu.bilgi;
  if (a.cevapBirimi) kod.ayar.cevapBirimi = a.cevapBirimi;
  ["ilIsimleri", "ilSinirlari", "hayalet", "birikmesin", "ilCevapta"].forEach(k => {
    if (typeof a[k] === "boolean") kod.ayar[k] = a[k];
  });
  if (a.objeGorunur) kod.ayar.objeGorunur = a.objeGorunur;
  if (a.objeAdlari) kod.ayar.objeAdlari = a.objeAdlari;

  const adi = id => { const o = (konu.objeler || []).find(x => x.id === id); return o ? o.ad : null; };
  (konu.objeler || []).forEach(o => {
    const c = { ad: o.ad || "" };
    if (o.tip === "alan" || o.tip === "cizgi") {
      Object.assign(c, { tip: o.tip, renk: o.renk, kalinlik: o.kalinlik, noktalar: o.noktalar, iller: o.iller || [] });
      if (o.tip === "alan") { c.desen = o.desen || "duz"; c.saydamlik = o.saydamlik; }
    } else {
      const iller = o.iller || [];
      if (iller.length === 1) c.il = o.ilce ? `${iller[0]}/${o.ilce}` : iller[0];
      else { c.iller = iller; if (o.ilce) c.ilce = o.ilce; }
      c.emoji = o.gorselId ? (o.emoji || "") : (o.emoji || "📍");
      if (o.gorselId) c.gorselId = o.gorselId;
      if (o.cerceve) c.cerceve = o.cerceve;
      if (o.ekGoster === false) c.ekGoster = false;
      if (o.boyut && o.boyut !== 2) c.boyut = o.boyut;
      if (o.x != null && o.y != null) { c.x = o.x; c.y = o.y; }
      if (o.aci) c.aci = o.aci;
    }
    const sorular = (o.sorular || []).map(s => s.metin).filter(Boolean);
    if (sorular.length) c.sorular = sorular;
    if (o.bilgi) c.bilgi = o.bilgi;
    if ((o.baloncuklar || []).length) c.baloncuklar = o.baloncuklar;
    kod.objeler.push(c);
  });
  (konu.sorular || []).forEach(s => {
    const c = { metin: s.metin || "" };
    if (Array.isArray(s.objeler)) c.objeler = s.objeler.map(adi).filter(Boolean);
    else if (s.bolge) c.bolge = s.bolge;
    else c.iller = s.hedef || [];
    if (s.bilgi) c.bilgi = s.bilgi;
    kod.sorular.push(c);
  });
  return kod;
}

function jsonIndir(dosyaAdi, veri) {
  const bag = new Blob([JSON.stringify(veri, null, 1)], { type: "application/json" });
  const url = URL.createObjectURL(bag);
  const a = document.createElement("a");
  a.href = url;
  a.download = dosyaAdi;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return Math.round(bag.size / 1024);
}

function dosyaAdiYap(ad) {
  return iceKatla(ad).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "konu";
}

function disaAktarAc() {
  const sec = $("#disa-konu");
  sec.innerHTML = durum.kutuphane.slice().sort((a, b) => a.ad.localeCompare(b.ad, "tr"))
    .map(k => `<option value="${guvenli(k.id)}">${guvenli(k.ad)}</option>`).join("");
  if (durum.editorKonuId) sec.value = durum.editorKonuId;
  $("#modal-disa").classList.remove("gizli");
}

function disaAktarOlaylari() {
  const kapat = () => $("#modal-disa").classList.add("gizli");
  $("#btn-disa-kapat").addEventListener("click", kapat);
  $("#modal-disa").addEventListener("click", e => { if (e.target.id === "modal-disa") kapat(); });
  $("#btn-disa-tek").addEventListener("click", () => {
    const konu = konuBul($("#disa-konu").value);
    if (!konu) return;
    const kb = jsonIndir(`${dosyaAdiYap(konu.ad)}.json`, konuKodu(konu));
    kapat();
    bildir(`"${konu.ad}" indirildi (${kb} KB)`);
  });
  $("#btn-disa-hepsi").addEventListener("click", () => {
    const veri = { konular: durum.kutuphane.map(konuKodu) };
    const g = new Date(), iki = n => String(n).padStart(2, "0");
    const kb = jsonIndir(`cografyam-konular-${g.getFullYear()}${iki(g.getMonth() + 1)}${iki(g.getDate())}.json`, veri);
    kapat();
    bildir(`${veri.konular.length} konu indirildi (${kb} KB)`);
  });
  $("#btn-disa-yedek").addEventListener("click", () => { kapat(); yedegiDisaAktar(); });
}

function iceEditoreGec(konu) {
  durum.editorKonuId = konu.id;
  if (!$("#ekran-editor").classList.contains("aktif")) return;
  const sec = $("#editor-konu");
  konuSeciciDoldur(sec);
  sec.value = konu.id;
  sec.dispatchEvent(new Event("change"));
}

function konuIceOlaylari() {
  disaAktarOlaylari();
  $("#btn-ice-uygula").addEventListener("click", konuIceUygula);
  $("#btn-ice-kapat").addEventListener("click", iceKapat);
  $("#modal-konu-ice").addEventListener("click", e => {
    if (e.target.id === "modal-konu-ice") iceKapat();
  });
  $$("#ice-mod-secim .secenek").forEach(b => b.addEventListener("click", () => {
    $$("#ice-mod-secim .secenek").forEach(x => x.classList.toggle("secili", x === b));
  }));
  $$("#ice-cakisma [data-cakisma]").forEach(b =>
    b.addEventListener("click", () => iceCakismaSecildi(b.dataset.cakisma)));
  $("#ice-metin").addEventListener("input", () => { iceDosyaAdi = ""; });
  $("#btn-ice-dosya").addEventListener("click", () => $("#ice-dosya").click());
  $("#ice-dosya").addEventListener("change", async e => {
    const dosyalar = [...e.target.files];
    e.target.value = "";
    if (!dosyalar.length) return;
    let icerik;
    try { icerik = await Promise.all(dosyalar.map(async d => ({ ad: d.name, metin: await d.text() }))); }
    catch (err) { iceSonucGoster("Dosya okunamadı", [], false); return; }

    if (icerik.length === 1) {
      iceDosyaAdi = icerik[0].ad;
      $("#ice-metin").value = icerik[0].metin;
      konuIceUygula();
      return;
    }
    /* birden fazla dosya: sırayla işlenir, çakışma çıkarsa o dosya için sorulur */
    iceKuyruk = icerik;
    iceOzetler = [];
    iceToplam = icerik.length;
    iceSiradakiDosya();
  });
}
