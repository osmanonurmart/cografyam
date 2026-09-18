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
                "objeGorunur", "objeAdlari" },
     "objeler": [ { "ad", "emoji", "iller": ["Mardin", "Balıkesir/Bigadiç"],
                    "ilce", "cerceve", "ekGoster", "boyut", "sorular": ["…"] } ],
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
function iceCoz(metin) {
  let m = String(metin || "").trim()
    .replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
  if (!m) throw new Error("Kutu boş — kodu yapıştır ya da dosya seç");
  m = m.replace(/,\s*([}\]])/g, "$1").replace(/,\s*$/, "");
  let veri;
  try { veri = JSON.parse(m); }
  catch (e) { throw new Error("Kod okunamadı — geçerli bir JSON değil (" + e.message + ")"); }
  if (!veri || typeof veri !== "object" || Array.isArray(veri)) throw new Error("Kod bir { … } nesnesi olmalı");
  if (veri.uygulama === "cografyam" && veri.veri) {
    throw new Error("Bu bir tam yedek dosyası. Onu Düzenle ekranındaki ⬆ İçe aktar ile yükle.");
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
  ["ilIsimleri", "ilSinirlari", "hayalet"].forEach(ad => {
    if (typeof a[ad] === "boolean") sonuc.ayar[ad] = a[ad];
  });
  if (typeof a.objeGorunur === "boolean") sonuc.ayar.objeGorunur = a.objeGorunur ? "bastan" : "cevapta";
  else if (a.objeGorunur === "bastan" || a.objeGorunur === "cevapta") sonuc.ayar.objeGorunur = a.objeGorunur;
  if (["gorunsun", "cevapta", "hic"].includes(a.objeAdlari)) sonuc.ayar.objeAdlari = a.objeAdlari;

  (Array.isArray(veri.objeler) ? veri.objeler : []).forEach((o, sira) => {
    if (!o || typeof o !== "object") return;
    const ad = String(o.ad || "").trim();
    const etiket = ad || `${sira + 1}. obje`;
    const cerceve = o.cerceve ? iceCerceveBul(o.cerceve) : null;
    if (cerceve === undefined) hatalar.push(`${etiket}: çerçeve "${o.cerceve}" tanınmadı, çerçevesiz eklendi`);
    const sorular = iceMetinler(o.sorular || o.soru).map(metin => ({ metin }));
    const boyut = Number(o.boyut);

    /* "Balıkesir/Bigadiç" biçimi ilçeyi o ile özel verir */
    const yerler = [...iceListe(o.iller), ...iceListe(o.il)];
    if (!yerler.length) { hatalar.push(`${etiket}: il yazılmamış, atlandı`); return; }
    let ilk = true;
    yerler.forEach(yer => {
      const [ilAd, ilceAd] = String(yer).split("/").map(s => s.trim());
      const il = iceIlBul(ilAd);
      if (!il) { hatalar.push(`${etiket}: "${ilAd}" diye bir il yok, atlandı`); return; }
      sonuc.objeler.push({
        id: yeniId(), tip: "emoji",
        emoji: String(o.emoji || "📍").trim() || "📍", gorselId: null,
        ad, iller: [il], ilce: ilceAd || String(o.ilce || "").trim(),
        cerceve: cerceve || null, ekGoster: o.ekGoster !== false,
        x: null, y: null, boyut: boyut > 0 ? boyut : 2, aci: 0,
        noktalar: null, renk: null, kalinlik: 3, baloncuklar: [],
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
      sonuc.sorular.push({ metin, bolge });
      return;
    }
    const hedef = [];
    [...iceListe(s.iller), ...iceListe(s.il), ...iceListe(s.hedef)].forEach(ad => {
      const il = iceIlBul(ad);
      if (!il) hatalar.push(`${etiket}: "${ad}" diye bir il yok`);
      else if (!hedef.includes(il)) hedef.push(il);
    });
    if (!hedef.length) { hatalar.push(`${etiket}: cevap ili ya da bölgesi yok, atlandı`); return; }
    sonuc.sorular.push({ metin, hedef });
  });

  return { sonuc, hatalar };
}

function konuIceAc(konu) {
  iceKonu = konu;
  $("#ice-metin").value = "";
  $("#ice-sonuc").className = "ice-sonuc gizli";
  $("#ice-sonuc").innerHTML = "";
  const dolu = (konu.objeler || []).length + (konu.sorular || []).length > 0;
  $("#ice-mod").classList.toggle("gizli", !dolu);
  $$("#ice-mod-secim .secenek").forEach(b => b.classList.toggle("secili", b.dataset.deger === "ekle"));
  $("#btn-ice-uygula").classList.remove("gizli");
  $("#btn-ice-kapat").textContent = "Vazgeç";
  $("#modal-konu-ice").classList.remove("gizli");
  setTimeout(() => $("#ice-metin").focus(), 60);
}

function iceKapat() {
  $("#modal-konu-ice").classList.add("gizli");
  iceKonu = null;
}

function iceSonucGoster(baslik, hatalar, basarili) {
  const kutu = $("#ice-sonuc");
  kutu.className = "ice-sonuc" + (basarili ? " basarili" : "");
  kutu.innerHTML = `<b>${guvenli(baslik)}</b>` + (hatalar.length
    ? `<ul>${hatalar.map(h => `<li>${guvenli(h)}</li>`).join("")}</ul>` : "");
}

function konuIceUygula() {
  const konu = iceKonu && konuBul(iceKonu.id);
  if (!konu) { iceKapat(); return; }

  let veri;
  try { veri = iceCoz($("#ice-metin").value); }
  catch (e) { iceSonucGoster(e.message, [], false); return; }

  const { sonuc, hatalar } = iceHazirla(veri);
  const eklenecek = sonuc.objeler.length + sonuc.sorular.length;
  if (!eklenecek && !Object.keys(sonuc.konu).length && !Object.keys(sonuc.ayar).length) {
    iceSonucGoster("Eklenecek bir şey bulunamadı", hatalar, false);
    return;
  }

  const secili = $("#ice-mod-secim .secenek.secili");
  const degistir = !$("#ice-mod").classList.contains("gizli") && secili && secili.dataset.deger === "degistir";
  if (degistir) { konu.objeler = []; konu.sorular = []; }
  konu.objeler.push(...sonuc.objeler);
  konu.sorular = (konu.sorular || []).concat(sonuc.sorular);
  Object.assign(konu, sonuc.konu);
  Object.assign(konu.ayar, sonuc.ayar);

  konuAyarUygula(konu);                      // kaydeder, açık harita varsa tazeler
  konuSeciciDoldur($("#konu-ayar-sec"));
  $("#konu-ayar-sec").value = konu.id;
  konuAyarEkraniCiz();

  const iller = new Set(sonuc.objeler.map(o => o.iller[0])).size;
  const ozet = `${sonuc.objeler.length} obje (${iller} il), ${sonuc.sorular.length} yazılı soru ` +
               (degistir ? "ile konu yenilendi" : "eklendi");
  if (!hatalar.length) { iceKapat(); bildir(ozet, 3200); return; }

  /* uyarı varsa pencere açık kalsın ki hangi satırın atlandığı görülsün */
  iceSonucGoster(ozet + " — şunlara dikkat:", hatalar, true);
  $("#ice-mod").classList.add("gizli");
  $("#btn-ice-uygula").classList.add("gizli");
  $("#btn-ice-kapat").textContent = "Kapat";
}

function konuIceOlaylari() {
  $("#btn-ice-uygula").addEventListener("click", konuIceUygula);
  $("#btn-ice-kapat").addEventListener("click", iceKapat);
  $("#modal-konu-ice").addEventListener("click", e => {
    if (e.target.id === "modal-konu-ice") iceKapat();
  });
  $$("#ice-mod-secim .secenek").forEach(b => b.addEventListener("click", () => {
    $$("#ice-mod-secim .secenek").forEach(x => x.classList.toggle("secili", x === b));
  }));
  $("#btn-ice-dosya").addEventListener("click", () => $("#ice-dosya").click());
  $("#ice-dosya").addEventListener("change", async e => {
    const dosya = e.target.files[0];
    e.target.value = "";
    if (!dosya) return;
    try { $("#ice-metin").value = await dosya.text(); }
    catch (err) { iceSonucGoster("Dosya okunamadı", [], false); return; }
    konuIceUygula();
  });
}
