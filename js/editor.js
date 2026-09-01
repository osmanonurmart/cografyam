/* ==========================================================
   Coğrafyam — Düzenle

   Tek liste, tek akış: her kart bir sorudur.
   Aynı adı taşıyan seçim birimleri tek kartta toplanır; kartın içindeki
   satırlar o sorunun konumlarıdır. Harita/Soru sekmesi, araç çubuğu ve
   Kaydet düğmesi yok — ne yaptığını açık kart belirler.
   ========================================================== */

let editorHarita = null;
let surukleme = null;
let cizim = null;                 // { noktalar:[], alan:bool }

/* Açık kart: objeli kartta ilk objenin kimliği, yazılı soruda sırası.
   Kimliğe bağlamak önemli — ad değişince gruplama anahtarı da değişir,
   kart altından kaymasın diye. */
let acikKart = null;              // { tip:"obje", id } | { tip:"soru", i }
let ekleModu = null;              // "isaret" | "cizgi" | "alan" | "balon"
let bekleyen = null;              // konumu henüz olmayan yeni kart
let simgeHedefi = null;           // simge kutusunun düzenlediği kart

const CIZGI_RENKLERI = ["#38bdf8", "#22c55e", "#f59e0b", "#ef4444", "#a78bfa", "#e2e8f0"];

const DESENLER = [
  ["duz", "Düz"], ["cizgili", "Çizgili"], ["tarali", "Çapraz"],
  ["noktali", "Noktalı"], ["dalgali", "Dalgalı"], ["tugla", "Tuğla"], ["igne", "İğne"]
];

const EKLE_IPUCU = {
  isaret: "Haritada bir ile tıkla",
  cizgi:  "Tıklaya tıklaya çiz · Enter bitirir · Esc iptal",
  alan:   "Kenarları tıklaya tıklaya çiz · Enter kapatır · Esc iptal",
  balon:  "Baloncuğun duracağı noktaya tıkla"
};

function editorAc() {
  const sec = $("#editor-konu");
  konuSeciciDoldur(sec);
  if (!konuBul(durum.editorKonuId)) durum.editorKonuId = durum.kutuphane[0].id;
  sec.value = durum.editorKonuId;

  ekranGoster("editor");

  if (!editorHarita) {
    const kap = document.createElement("div");
    kap.className = "editor-harita-ic";
    $("#editor-harita").appendChild(kap);
    editorHarita = new Harita(kap);
    editorHaritaOlaylari();
    zoomOlaylari();
  }
  onizlemeDurumuCiz();
  zoomDurumuCiz();
  editorTazele();
}

function editorKonu() { return konuBul(durum.editorKonuId); }

/* ----------------------------------------------------------
   KARTLAR
   Kart = soru. Objeli kartta konumlar, yazılı kartta tek hedef.
---------------------------------------------------------- */
function kartlar(konu) {
  const birim = konu.ayar.cevapBirimi || "il";
  const sorulanlar = new Set(birimeUyanlar(konu.objeler || [], birim).map(o => o.id));

  const gruplar = new Map();
  (konu.objeler || []).forEach(o => {
    const a = soruGrupAnahtari(o);
    if (!gruplar.has(a)) gruplar.set(a, []);
    gruplar.get(a).push(o);
  });

  const liste = [];
  gruplar.forEach(objeler => liste.push({
    tip: "obje", objeler, id: objeler[0].id,
    /* Cevap birimi Alan ya da Çizgi ise başka türdeki kartlar sorulmaz.
       Gizlemek yerine soluk gösteriyoruz — yoksa birimi değiştirdiğinde
       veriler silinmiş gibi görünür. */
    sorulur: sorulanlar.has(objeler[0].id)
  }));
  (konu.sorular || []).forEach((kayit, i) => liste.push({ tip: "soru", kayit, i, sorulur: true }));
  return liste;
}

function acikKartiBul(liste) {
  if (!acikKart) return null;
  if (acikKart.tip === "soru") return liste.find(k => k.tip === "soru" && k.i === acikKart.i) || null;
  return liste.find(k => k.tip === "obje" && k.objeler.some(o => o.id === acikKart.id)) || null;
}

function kartAc(kart) {
  acikKart = kart
    ? (kart.tip === "soru" ? { tip: "soru", i: kart.i } : { tip: "obje", id: kart.objeler[0].id })
    : null;
  if (!kart) ekleModu = null;
  editorTazele();
}

function acikObjeler() {
  const acik = acikKartiBul(kartlar(editorKonu()));
  return acik && acik.tip === "obje" ? acik.objeler : null;
}

/* ----------------------------------------------------------
   ÇİZİM
---------------------------------------------------------- */
function editorTazele() {
  const konu = editorKonu();
  if (!konu || !editorHarita) return;
  const onizleme = durum.editorOnizleme === "calis";
  const birim = konu.ayar.cevapBirimi || "il";

  editorHarita.objeleriCiz(konu.objeler);
  editorHarita.objeKat.style.pointerEvents = (cizim || onizleme) ? "none" : "auto";

  editorHarita.sinirModu(birim === "bolge" ? "bolge" : (konu.ayar.ilSinirlari === false ? "yok" : "il"));

  if (onizleme) {
    /* konuya girildiğinde nasıl görünecekse öyle */
    editorHarita.isimleriGoster(!!konu.ayar.ilIsimleri);
    const hepsiGorunur = birimObjeMi(birim) || konu.ayar.objeGorunur === "bastan";
    editorHarita.tumObjeler(hepsiGorunur);
    const hayalet = hayaletAktifMi(konu) && hepsiGorunur;
    editorHarita.hayaletUygula(hayalet ? konu.objeler.map(o => o.id) : null);
    const adlarAcik = konu.ayar.objeAdlari === "gorunsun" && !hayalet;
    editorHarita.adlariGoster(adlarAcik);
    $$(".obje-adi", editorHarita.adKat).forEach(t => t.classList.toggle("acik", adlarAcik));
    editorHarita.tumBalonlar(false);
  } else {
    editorHarita.hayaletUygula(null);
    editorHarita.isimleriGoster(true);
    editorHarita.tumObjeler(true);
    editorHarita.adlariGoster(true);
    $$(".obje-adi", editorHarita.adKat).forEach(t => t.classList.add("acik"));
    editorHarita.tumBalonlar(true);
  }

  const acik = acikKartiBul(kartlar(konu));
  const seciliIdler = new Set(acik && acik.tip === "obje" ? acik.objeler.map(o => o.id) : []);
  $$(".obje", editorHarita.objeKat).forEach(t => {
    t.classList.toggle("secili", seciliIdler.has(t.getAttribute("data-obje")));
  });
  /* tutamaklar yalnızca tek şekilli kartta anlamlı */
  const tekSekil = acik && acik.tip === "obje" && acik.objeler.length === 1
    && (acik.objeler[0].tip === "cizgi" || acik.objeler[0].tip === "alan");
  editorHarita.tutamaklariCiz(tekSekil ? acik.objeler[0] : null);

  kartListesiCiz();
}

/* Harita yeniden çizildikten sonra seçimi ve görünürlüğü tazeler.
   Kart listesine dokunmaz — yazarken odak kaçmasın diye. */
function editorTazeleHafif() {
  const acik = acikKartiBul(kartlar(editorKonu()));
  const idler = new Set(acik && acik.tip === "obje" ? acik.objeler.map(o => o.id) : []);
  editorHarita.tumObjeler(true);
  editorHarita.adlariGoster(true);
  editorHarita.tumBalonlar(true);
  $$(".obje-adi", editorHarita.adKat).forEach(t => t.classList.add("acik"));
  $$(".obje", editorHarita.objeKat).forEach(t => {
    t.classList.toggle("secili", idler.has(t.getAttribute("data-obje")));
  });
}

function kartListesiCiz() {
  const konu = editorKonu();
  const liste = $("#kart-listesi");
  const kart = kartlar(konu);
  const acik = acikKartiBul(kart);
  liste.innerHTML = "";

  if (bekleyen) liste.appendChild(bekleyenKartiCiz());
  else if (!kart.length) {
    liste.innerHTML = `<p class="bos-uyari kucuk">Henüz soru yok. Aşağıdaki <b>＋ Yeni</b> ile başla.</p>`;
  }

  kart.forEach(k => liste.appendChild(kartiCiz(k, acik === k)));
  kartEkleSatiriCiz();
}

function kartOzeti(k) {
  if (k.tip === "soru") {
    return { simge: "✎", ad: (k.kayit.metin || "").trim() || "(boş soru)", sayi: "" };
  }
  const ilk = k.objeler[0];
  return {
    simge: ogeSimgesi(ilk),
    ad: ilk.ad || "(adsız)",
    sayi: k.objeler.length > 1 ? k.objeler.length : ""
  };
}

function kartiCiz(k, acikMi) {
  const kutu = document.createElement("div");
  kutu.className = "kart" + (acikMi ? " acik" : "") + (k.sorulur ? "" : " sorulmaz");
  const o = kartOzeti(k);

  /* Başlık düğme DEĞİL: içinde simge düğmesi var, iç içe düğme geçersiz. */
  const bas = document.createElement("div");
  bas.className = "kart-bas tiklanir";
  const sekilli = k.tip === "obje" && (k.objeler[0].tip === "cizgi" || k.objeler[0].tip === "alan");
  bas.innerHTML = `
    ${k.tip === "obje" && !sekilli
      ? `<button class="kart-simge duzenlenir" data-simge-ac title="Simgeyi değiştir">
           ${guvenli(o.simge)}<span class="simge-kalem">✎</span></button>`
      : `<span class="kart-simge">${guvenli(o.simge)}</span>`}
    <b class="kart-ad">${guvenli(o.ad)}</b>
    ${o.sayi ? `<span class="sayi-rozet">${o.sayi}</span>` : ""}
    ${k.sorulur ? "" : `<span class="kart-not" title="Cevap birimi bu türü sormuyor">sorulmuyor</span>`}`;
  bas.addEventListener("click", ev => {
    if (ev.target.closest("[data-simge-ac]")) { ogeSimgeAc(k); return; }
    kartAc(acikMi ? null : k);
  });
  kutu.appendChild(bas);

  if (acikMi) kutu.appendChild(k.tip === "soru" ? soruKartiGovde(k) : objeKartiGovde(k));
  return kutu;
}

/* ---- yeni kart: adını yaz, haritaya tıkla ---- */
function bekleyenKartiCiz() {
  const kutu = document.createElement("div");
  kutu.className = "kart acik bekleyen";
  kutu.innerHTML = `
    <div class="kart-bas">
      <button class="kart-simge duzenlenir" id="bekleyen-simge" title="Simgeyi seç">
        ${guvenli(bekleyen.gorselId ? "🖼️" : (bekleyen.emoji || "📍"))}<span class="simge-kalem">✎</span>
      </button>
      <input class="kart-ad-alan" id="bekleyen-ad" value="${guvenli(bekleyen.ad)}"
             placeholder="Ad (örn. Bor yatakları)" autocomplete="off">
      <button class="satir-sil" id="bekleyen-iptal" title="Vazgeç">✕</button>
    </div>
    <div class="kart-govde">
      <p class="ekle-ipucu">${guvenli(EKLE_IPUCU[ekleModu] || EKLE_IPUCU.isaret)}</p>
      ${konumEkleSatiri()}
    </div>`;

  const alan = $("#bekleyen-ad", kutu);
  alan.addEventListener("input", () => { bekleyen.ad = alan.value; });
  $("#bekleyen-simge", kutu).addEventListener("click", () => ogeSimgeAc("bekleyen"));
  $("#bekleyen-iptal", kutu).addEventListener("click", () => {
    bekleyen = null; ekleModu = null; cizimiIptal(); editorTazele();
  });
  konumEkleOlaylari(kutu);
  setTimeout(() => {
    const a = $("#bekleyen-ad");
    if (a && document.activeElement !== a) a.focus();
  }, 30);
  return kutu;
}

function konumEkleSatiri() {
  const d = (mod, simge, ad) =>
    `<button class="konum-btn ${ekleModu === mod ? "secili" : ""}" data-ekle="${mod}" title="${ad}">${simge}</button>`;
  return `<div class="konum-ekle">
      <span class="alan-etiket">Konum ekle</span>
      ${d("isaret", "📍", "İşaret")}${d("cizgi", "〰️", "Çizgi")}${d("alan", "⬭", "Alan")}
    </div>`;
}

function konumEkleOlaylari(kap) {
  $$("[data-ekle]", kap).forEach(b => b.addEventListener("click", () => {
    const mod = b.dataset.ekle;
    ekleModu = ekleModu === mod ? null : mod;
    if (cizim) cizimiIptal();
    editorTazele();
  }));
}

/* ---- objeli kart ---- */
function objeKartiGovde(k) {
  const konu = editorKonu();
  const ilk = k.objeler[0];
  const sekilli = ilk.tip === "cizgi" || ilk.tip === "alan";
  const govde = document.createElement("div");
  govde.className = "kart-govde";

  const yazilanlar = [];
  k.objeler.forEach(o => (o.sorular || []).forEach(x => yazilanlar.push(x.metin || "")));

  govde.innerHTML = `
    <input class="kucuk-alan" data-ad value="${guvenli(ilk.ad)}" placeholder="Ad">

    <label class="alan-etiket">Konumlar <span class="sayi-rozet">${k.objeler.length}</span></label>
    <div class="konum-listesi">
      ${k.objeler.map(o => `
        <div class="konum-satir">
          <span class="konum-simge">${guvenli(ogeSimgesi(o))}</span>
          <span class="konum-il">${guvenli(o.iller.join(", ") || "—")}</span>
          <input class="kucuk-alan konum-ilce" data-ilce="${o.id}"
                 value="${guvenli(o.ilce || "")}" placeholder="İlçe">
          <button class="satir-sil" data-konum-sil="${o.id}" title="Bu konumu sil">✕</button>
        </div>`).join("")}
    </div>
    ${ekleModu ? `<p class="ekle-ipucu">${guvenli(EKLE_IPUCU[ekleModu])}</p>` : ""}
    ${konumEkleSatiri()}
    ${sekilli ? `<button class="ikincil-btn ince tam" data-il-yenile>${ilk.tip === "alan" ? "Kapsadığı" : "Geçtiği"} illeri yeniden bul</button>` : ""}

    <details class="kart-bolum">
      <summary>Soru metni</summary>
      <div class="ayar-satir minik">
        <div class="ayar-ad">İlçe ve çerçeve soruda görünsün</div>
        <button class="toggle ${ilk.ekGoster === false ? "" : "acik"}" data-ek role="switch"><span></span></button>
      </div>
      <p class="ekle-ipucu">Yazmazsan otomatik: <b>${guvenli(otomatikSoru(ilk, konu))}</b></p>
      ${yazilanlar.map((metin, i) => `
        <div class="soru-metin-satir">
          <textarea class="kucuk-alan" data-soru="${i}" rows="2" placeholder="Soru metni">${guvenli(metin)}</textarea>
          <button class="satir-sil" data-soru-sil="${i}">✕</button>
        </div>`).join("")}
      <button class="ikincil-btn ince tam" data-soru-ekle>＋ Soru ekle</button>
    </details>

    <details class="kart-bolum">
      <summary>Görünüm</summary>
      ${sekilli ? `
        <div class="kaydirici">
          <label class="alan-etiket">${ilk.tip === "alan" ? "Kenar kalınlığı" : "Kalınlık"} <b data-kalinlik-deger>${ilk.kalinlik || 3}</b></label>
          <input type="range" data-kalinlik min="0.5" max="10" step="0.5" value="${ilk.kalinlik || 3}">
        </div>
        ${ilk.tip === "alan" ? `
          <div class="kaydirici">
            <label class="alan-etiket">Doluluk <b data-saydam-deger>${Math.round((ilk.saydamlik ?? .45) * 100)}%</b></label>
            <input type="range" data-saydamlik min="0" max="1" step="0.05" value="${ilk.saydamlik ?? .45}">
          </div>
          <label class="alan-etiket">Desen</label>
          <div class="secenek-satir sarmal">
            ${DESENLER.map(([d, ad]) => `<button class="secenek ${(ilk.desen || "duz") === d ? "secili" : ""}" data-desen="${d}">${ad}</button>`).join("")}
          </div>` : ""}
        <label class="alan-etiket">Renk</label>
        <div class="secim-satir">
          ${CIZGI_RENKLERI.map(r => `<button class="sec-ogesi ${(ilk.renk || CIZGI_RENKLERI[0]) === r ? "secili" : ""}" data-renk="${r}" style="background:${r}"></button>`).join("")}
        </div>
      ` : `
        <button class="ikincil-btn ince tam" data-simge>${guvenli(ogeSimgesi(ilk))} Simgeyi değiştir</button>
        <div class="kaydirici">
          <label class="alan-etiket">Boyut <b data-boyut-deger>${Number(ilk.boyut || 2).toFixed(1)}</b></label>
          <div class="olcu-satir">
            <button class="olcu-btn" data-boyut-az>−</button>
            <input type="range" data-boyut min="0.4" max="4" step="0.1" value="${ilk.boyut || 2}">
            <button class="olcu-btn" data-boyut-cok>+</button>
          </div>
        </div>
        <div class="kaydirici">
          <label class="alan-etiket">Yön <b data-aci-deger>${ilk.aci || 0}°</b></label>
          <input type="range" data-aci min="-180" max="180" step="5" value="${ilk.aci || 0}">
        </div>
        <label class="alan-etiket">Çerçeve</label>
        <div class="cerceve-secim">
          <button class="cerceve-ogesi ${ilk.cerceve ? "" : "secili"}" data-cerceve="">Yok</button>
          ${CERCEVELER.map(c => `<button class="cerceve-ogesi ${ilk.cerceve === c.id ? "secili" : ""}" data-cerceve="${c.id}">${c.simge} ${guvenli(c.ad)}</button>`).join("")}
        </div>
      `}
    </details>

    <details class="kart-bolum">
      <summary>Baloncuklar <span class="sayi-rozet">${k.objeler.reduce((t, o) => t + (o.baloncuklar || []).length, 0)}</span></summary>
      ${k.objeler.map(o => (o.baloncuklar || []).map((b, i) => `
        <div class="balon-satir">
          <input class="kucuk-alan" data-balon="${o.id}:${i}" value="${guvenli(b.baslik || "")}" placeholder="Başlık">
          <button class="satir-sil" data-balon-sil="${o.id}:${i}">✕</button>
        </div>`).join("")).join("")}
      <button class="ikincil-btn ince tam" data-balon-ekle>＋ Baloncuk ekle</button>
    </details>

    <div class="kart-altlik">
      <button class="metin-btn" data-cogalt>Çoğalt</button>
      <button class="metin-btn tehlike" data-sil>Sil</button>
    </div>`;

  objeKartiOlaylari(govde, k);
  return govde;
}

function objeKartiOlaylari(govde, k) {
  const konu = editorKonu();
  const ilk = k.objeler[0];
  const hepsi = (alan, deger) => {
    k.objeler.forEach(o => { o[alan] = deger; });
    kutuphaneKaydet();
  };

  /* Ad grubun tamamına yazılır; liste yeniden çizilmez, çünkü yazarken
     gruplama anahtarı değişiyor ve kart altından kayardı. */
  const adAlani = $("[data-ad]", govde);
  adAlani.addEventListener("input", () => {
    hepsi("ad", adAlani.value);
    const bas = govde.parentElement.querySelector(".kart-ad");
    if (bas) bas.textContent = adAlani.value || "(adsız)";
    editorHarita.objeleriCiz(konu.objeler);
    editorTazeleHafif();
  });

  $$("[data-ilce]", govde).forEach(inp => inp.addEventListener("change", () => {
    const o = konu.objeler.find(x => x.id === inp.dataset.ilce);
    if (o) { o.ilce = inp.value.trim(); kutuphaneKaydet(); }
  }));

  $$("[data-konum-sil]", govde).forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.konumSil;
    konu.objeler = konu.objeler.filter(x => x.id !== id);
    if (acikKart && acikKart.id === id) {
      const kalan = k.objeler.find(x => x.id !== id);
      acikKart = kalan ? { tip: "obje", id: kalan.id } : null;
    }
    kutuphaneKaydet(); editorTazele();
  }));

  konumEkleOlaylari(govde);

  const yenile = $("[data-il-yenile]", govde);
  if (yenile) yenile.addEventListener("click", () => {
    k.objeler.forEach(o => {
      if (!o.noktalar) return;
      o.iller = o.tip === "alan" ? alaninIlleri(editorHarita, o.noktalar) : cizgininIlleri(editorHarita, o.noktalar);
    });
    kutuphaneKaydet(); editorTazele(); bildir("İller güncellendi");
  });

  /* soru metinleri gruba yayılmış olabilir; sırayla eşleştirilir */
  const metinYerleri = [];
  k.objeler.forEach(o => (o.sorular || []).forEach((x, i) => metinYerleri.push({ o, i })));
  $$("[data-soru]", govde).forEach(t => t.addEventListener("change", () => {
    const y = metinYerleri[+t.dataset.soru];
    if (!y) return;
    y.o.sorular[y.i].metin = t.value;
    kutuphaneKaydet();
  }));
  $$("[data-soru-sil]", govde).forEach(b => b.addEventListener("click", () => {
    const y = metinYerleri[+b.dataset.soruSil];
    if (!y) return;
    y.o.sorular.splice(y.i, 1);
    kutuphaneKaydet(); editorTazele();
  }));
  $("[data-ek]", govde).addEventListener("click", e => {
    const acik = !e.currentTarget.classList.contains("acik");
    hepsi("ekGoster", acik);
    editorTazele();
  });
  $("[data-soru-ekle]", govde).addEventListener("click", () => {
    if (!Array.isArray(ilk.sorular)) ilk.sorular = [];
    ilk.sorular.push({ metin: "" });
    kutuphaneKaydet(); editorTazele();
  });

  /* görünüm */
  const simge = $("[data-simge]", govde);
  if (simge) simge.addEventListener("click", () => ogeSimgeAc(k));

  const boyut = $("[data-boyut]", govde);
  if (boyut) {
    boyut.addEventListener("input", e => {
      $("[data-boyut-deger]", govde).textContent = Number(e.target.value).toFixed(1);
      k.objeler.forEach(o => boyutOnizle(o, parseFloat(e.target.value)));
    });
    boyut.addEventListener("change", e => boyutUygula(k, parseFloat(e.target.value)));
    $("[data-boyut-az]", govde).addEventListener("click", () => boyutUygula(k, (ilk.boyut || 2) - 0.1));
    $("[data-boyut-cok]", govde).addEventListener("click", () => boyutUygula(k, (ilk.boyut || 2) + 0.1));
  }
  const aci = $("[data-aci]", govde);
  if (aci) aci.addEventListener("input", e => {
    $("[data-aci-deger]", govde).textContent = e.target.value + "°";
    hepsi("aci", parseInt(e.target.value, 10));
    editorHarita.objeleriCiz(konu.objeler);
    editorTazeleHafif();
  });

  const kalinlik = $("[data-kalinlik]", govde);
  if (kalinlik) kalinlik.addEventListener("input", e => {
    $("[data-kalinlik-deger]", govde).textContent = e.target.value;
    hepsi("kalinlik", parseFloat(e.target.value));
    k.objeler.forEach(o => {
      const el = editorHarita.objeKat.querySelector(`[data-obje="${o.id}"] .cizgi-govde, [data-obje="${o.id}"] .alan-govde`);
      if (el) el.setAttribute("stroke-width", o.kalinlik);
    });
  });
  const saydam = $("[data-saydamlik]", govde);
  if (saydam) saydam.addEventListener("input", e => {
    $("[data-saydam-deger]", govde).textContent = Math.round(e.target.value * 100) + "%";
    hepsi("saydamlik", parseFloat(e.target.value));
    k.objeler.forEach(o => {
      const el = editorHarita.objeKat.querySelector(`[data-obje="${o.id}"] .alan-govde`);
      if (el) el.setAttribute("fill-opacity", o.saydamlik);
    });
  });
  $$("[data-desen]", govde).forEach(b => b.addEventListener("click", () => {
    hepsi("desen", b.dataset.desen); editorTazele();
  }));
  $$("[data-renk]", govde).forEach(b => b.addEventListener("click", () => {
    hepsi("renk", b.dataset.renk); editorTazele();
  }));
  $$("[data-cerceve]", govde).forEach(b => b.addEventListener("click", () => {
    hepsi("cerceve", b.dataset.cerceve || null); editorTazele();
  }));

  /* baloncuklar */
  $$("[data-balon]", govde).forEach(inp => inp.addEventListener("change", () => {
    const [id, i] = inp.dataset.balon.split(":");
    const o = konu.objeler.find(x => x.id === id);
    if (o) { o.baloncuklar[+i].baslik = inp.value; kutuphaneKaydet(); editorTazele(); }
  }));
  $$("[data-balon-sil]", govde).forEach(b => b.addEventListener("click", () => {
    const [id, i] = b.dataset.balonSil.split(":");
    const o = konu.objeler.find(x => x.id === id);
    if (o) { o.baloncuklar.splice(+i, 1); kutuphaneKaydet(); editorTazele(); }
  }));
  $("[data-balon-ekle]", govde).addEventListener("click", () => {
    ekleModu = "balon"; editorTazele();
  });

  /* altlık */
  $("[data-cogalt]", govde).addEventListener("click", () => {
    const yeniler = k.objeler.map(o => Object.assign(JSON.parse(JSON.stringify(o)), { id: yeniId() }));
    konu.objeler.push(...yeniler);
    acikKart = { tip: "obje", id: yeniler[0].id };
    kutuphaneKaydet(); editorTazele();
    bildir("Kart çoğaltıldı — adını değiştir");
  });
  $("[data-sil]", govde).addEventListener("click", () => {
    onay(`"${ilk.ad || "Bu kart"}" ve ${k.objeler.length} konumu silinecek.`,
         { baslik: "Kartı sil", ikon: ogeSimgesi(ilk) }).then(evet => {
      if (!evet) return;
      const idler = new Set(k.objeler.map(o => o.id));
      konu.objeler = konu.objeler.filter(o => !idler.has(o.id));
      acikKart = null;
      kutuphaneKaydet(); editorTazele();
    });
  });
}

/* ---- yazılı soru kartı (haritaya işaret koymadan) ---- */
function soruKartiGovde(k) {
  const konu = editorKonu();
  const govde = document.createElement("div");
  govde.className = "kart-govde";
  const hedef = k.kayit.bolge ? "B:" + k.kayit.bolge : "I:" + ((k.kayit.hedef || [])[0] || IL_ADLARI[0]);
  govde.innerHTML = `
    <textarea class="kucuk-alan" data-metin rows="2" placeholder="Soru metni">${guvenli(k.kayit.metin || "")}</textarea>
    <label class="alan-etiket">Cevap</label>
    <select class="secici tam" data-hedef>
      <optgroup label="Bölge">
        ${Object.keys(BOLGELER).map(b => `<option value="B:${guvenli(b)}" ${hedef === "B:" + b ? "selected" : ""}>${guvenli(b)} Bölgesi</option>`).join("")}
      </optgroup>
      <optgroup label="İl">
        ${IL_ADLARI.map(il => `<option value="I:${guvenli(il)}" ${hedef === "I:" + il ? "selected" : ""}>${guvenli(il)}</option>`).join("")}
      </optgroup>
    </select>
    <div class="kart-altlik">
      <button class="metin-btn tehlike" data-sil>Sil</button>
    </div>`;

  $("[data-metin]", govde).addEventListener("input", e => {
    k.kayit.metin = e.target.value;
    kutuphaneKaydet();
    const bas = govde.parentElement.querySelector(".kart-ad");
    if (bas) bas.textContent = e.target.value.trim() || "(boş soru)";
  });
  $("[data-hedef]", govde).addEventListener("change", e => {
    const d = e.target.value;
    if (d.startsWith("B:")) { k.kayit.bolge = d.slice(2); delete k.kayit.hedef; }
    else { k.kayit.hedef = [d.slice(2)]; delete k.kayit.bolge; }
    kutuphaneKaydet();
  });
  $("[data-sil]", govde).addEventListener("click", () => {
    konu.sorular.splice(k.i, 1);
    acikKart = null;
    kutuphaneKaydet(); editorTazele();
  });
  return govde;
}

/* ---- listenin altındaki ekleme satırı ---- */
function kartEkleSatiriCiz() {
  const konu = editorKonu();
  const birim = konu.ayar.cevapBirimi || "il";
  const satir = $("#kart-ekle-satir");
  const yaziliOlur = !birimObjeMi(birim);   // il/bölge sorusu haritaya işaret koymadan da sorulabilir
  satir.innerHTML = `
    <button class="ana-btn ince tam" id="btn-kart-yeni">＋ Yeni</button>
    ${yaziliOlur ? `<button class="ikincil-btn ince tam" id="btn-soru-yeni">＋ Yazılı soru</button>` : ""}`;

  $("#btn-kart-yeni").addEventListener("click", yeniKart);
  const y = $("#btn-soru-yeni");
  if (y) y.addEventListener("click", () => {
    konu.sorular.push({ metin: "", hedef: [IL_ADLARI[0]] });
    bekleyen = null;
    acikKart = { tip: "soru", i: konu.sorular.length - 1 };
    kutuphaneKaydet(); editorTazele();
  });
}

function yeniKart() {
  const birim = editorKonu().ayar.cevapBirimi || "il";
  bekleyen = { ad: "", emoji: "📍", gorselId: null, cerceve: null };
  ekleModu = birim === "alan" ? "alan" : birim === "cizgi" ? "cizgi" : "isaret";
  acikKart = null;
  editorTazele();
}

/* ----------------------------------------------------------
   SİMGE KUTUSU — emoji ızgarası + kendi görselin
---------------------------------------------------------- */
function ogeSimgeAc(k) {
  simgeHedefi = k;
  const kap = $("#oge-simge-secim");
  kap.innerHTML = "";
  paletOgeleri().forEach(oge => {
    const b = document.createElement("button");
    b.className = "sec-ogesi" + (oge.tip === "gorsel" ? " gorsel" : "");
    if (oge.tip === "gorsel") {
      const im = document.createElement("img");
      im.src = oge.veri; im.alt = oge.ad || "";
      b.appendChild(im);
      b.title = oge.ad || "Görsel";
    } else {
      b.textContent = oge.deger;
    }
    b.addEventListener("click", () => simgeUygula(oge));

    /* Yüklenen görseller depoda yer kaplar; silinebilir olmaları gerekir.
       Emojiler için silme yok — hepsi hazır listeden geliyor. */
    if (oge.tip === "gorsel") {
      const yuva = document.createElement("div");
      yuva.className = "sec-yuva";
      yuva.appendChild(b);
      const sil = document.createElement("button");
      sil.className = "sec-sil";
      sil.textContent = "✕";
      sil.title = "Görseli sil";
      sil.addEventListener("click", ev => { ev.stopPropagation(); gorseliSil(oge); });
      yuva.appendChild(sil);
      kap.appendChild(yuva);
      return;
    }
    kap.appendChild(b);
  });
  $("#oge-simge-ozel").value = "";
  $("#modal-oge-simge").classList.remove("gizli");
}

/* Görseli paletten kaldırır. Kullanan objeler varsa önce uyarır —
   silinen görselin yerine haritada ❔ kalır. */
function gorseliSil(oge) {
  const yerler = gorselKullanimi(oge.id);
  const uyari = yerler.length
    ? `"${oge.ad || "Bu görsel"}" ${yerler.length} yerde kullanılıyor. Silinirse oralarda simge kalmaz.`
    : `"${oge.ad || "Bu görsel"}" paletten silinecek.`;
  onay(uyari, { baslik: "Görseli sil", ikon: "🖼️" }).then(evet => {
    if (!evet) return;
    palet.gorseller = palet.gorseller.filter(g => g.id !== oge.id);
    paletKaydet();
    ogeSimgeAc(simgeHedefi);
    editorTazele();
  });
}

function simgeUygula(oge) {
  if (!simgeHedefi) return;
  if (simgeHedefi === "bekleyen") {
    if (oge.tip === "gorsel") { bekleyen.gorselId = oge.id; bekleyen.emoji = ""; }
    else { bekleyen.gorselId = null; bekleyen.emoji = oge.deger; }
  } else {
    simgeHedefi.objeler.forEach(o => {
      if (oge.tip === "gorsel") { o.gorselId = oge.id; o.emoji = ""; if (!o.ad) o.ad = oge.ad || ""; }
      else { o.gorselId = null; o.emoji = oge.deger; }
    });
    kutuphaneKaydet();
  }
  $("#modal-oge-simge").classList.add("gizli");
  editorTazele();
}

/* ----------------------------------------------------------
   BOYUT — sürüklerken yalnızca SVG ölçeklenir, bırakınca işlenir
---------------------------------------------------------- */
function boyutOnizle(o, yeni) {
  const g = editorHarita && editorHarita.objeKat.querySelector(`[data-obje="${o.id}"]`);
  if (!g) return;
  const k = objeKonum(editorKonu().objeler, o);
  const oran = yeni / (o.boyut || 2);
  g.setAttribute("transform",
    `translate(${k.x.toFixed(1)} ${k.y.toFixed(1)}) scale(${oran.toFixed(3)}) translate(${(-k.x).toFixed(1)} ${(-k.y).toFixed(1)})`);
}

function boyutUygula(k, yeni) {
  const b = Math.round(Math.min(4, Math.max(0.4, yeni)) * 10) / 10;
  k.objeler.forEach(o => { o.boyut = b; });
  kutuphaneKaydet();
  editorTazele();
}

function ogeSimgesi(o) {
  if (o.tip === "cizgi") return "〰️";
  if (o.tip === "alan") return "⬭";
  if (o.gorselId) return gorselBul(o.gorselId) ? "🖼️" : "❔";
  return o.emoji || "📍";
}

/* ----------------------------------------------------------
   HARİTA GÖRÜNÜMÜ
---------------------------------------------------------- */
/* ----------------------------------------------------------
   HARİTA GEZİNMESİ — Photoshop mantığı
   Ayrı bir "zoom modu" yok: tekerlek her zaman yakınlaştırır, orta tuş
   (ya da Space basılıyken sol tuş) gezdirir, sol tuş çizmeye devam eder.
   Dokunmatikte tek parmak çizer, iki parmak hem gezdirir hem yakınlaştırır.
   Eskiden zoom açıkken çizim tamamen kilitliydi; yakınlaşıp hassas
   çizmek imkânsızdı.
---------------------------------------------------------- */
let bosluk = false;      // Space basılı mı (gezinme tuşu)

function zoomDurumuCiz() {
  $("#btn-zoom-sifirla").classList.toggle("gizli", !editorHarita || editorHarita.tamGorunumMu());
  $("#editor-harita").classList.toggle("gezinir", bosluk);
}

function onizlemeDegistir() {
  durum.editorOnizleme = durum.editorOnizleme === "calis" ? "duzenle" : "calis";
  onizlemeDurumuCiz();
  editorTazele();
}

function onizlemeDurumuCiz() {
  const calisMi = durum.editorOnizleme === "calis";
  const b = $("#btn-onizleme");
  b.innerHTML = `⇄ <b>${calisMi ? "Çalış" : "Düzenle"}</b>`;
  b.classList.toggle("acik", calisMi);
  b.title = calisMi ? "Tıkla: Düzenle görünümüne dön" : "Tıkla: Çalış görünümünü gör";
}

/* Gezinme sürüyor mu? Sürüyorsa harita olayları çizim yapmaz. */
function gezinmeVarMi() { return !!(gezinme || ikiParmak); }

let gezinme = null;
let ikiParmak = null;
const dokunanlar = new Map();

function zoomOlaylari() {
  const kap = $(".editor-harita-ic");
  const uzaklik = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const orta = (a, b) => ({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 });

  kap.addEventListener("wheel", ev => {
    ev.preventDefault();
    editorHarita.yakinlastir(ev.deltaY < 0 ? 1.18 : 1 / 1.18, editorHarita.svgNokta(ev));
    zoomDurumuCiz();
  }, { passive: false });

  /* Orta tuş tarayıcının otomatik kaydırmasını açar; kapatılmalı. */
  kap.addEventListener("auxclick", ev => { if (ev.button === 1) ev.preventDefault(); });

  kap.addEventListener("pointerdown", ev => {
    if (ev.pointerType === "touch") {
      dokunanlar.set(ev.pointerId, ev);
      if (dokunanlar.size === 2) {
        const [a, b] = [...dokunanlar.values()];
        ikiParmak = { uzaklik: uzaklik(a, b) };
        cizimSurukleyiIptal();
      }
      return;
    }
    const gezdir = ev.button === 1 || (ev.button === 0 && bosluk);
    if (!gezdir) return;
    ev.preventDefault();
    gezinme = { bas: editorHarita.svgNokta(ev) };
    kap.setPointerCapture(ev.pointerId);
  });

  kap.addEventListener("pointermove", ev => {
    if (dokunanlar.has(ev.pointerId)) dokunanlar.set(ev.pointerId, ev);

    if (ikiParmak && dokunanlar.size === 2) {
      const [a, b] = [...dokunanlar.values()];
      const yeni = uzaklik(a, b);
      if (ikiParmak.uzaklik > 0 && Math.abs(yeni - ikiParmak.uzaklik) > 1) {
        editorHarita.yakinlastir(yeni / ikiParmak.uzaklik, editorHarita.svgNokta(orta(a, b)));
        ikiParmak.uzaklik = yeni;
      }
      if (ikiParmak.orta) {
        const n = editorHarita.svgNokta(orta(a, b));
        editorHarita.kaydir(n.x - ikiParmak.orta.x, n.y - ikiParmak.orta.y);
      }
      ikiParmak.orta = editorHarita.svgNokta(orta(a, b));
      return;
    }
    if (!gezinme) return;
    const n = editorHarita.svgNokta(ev);
    editorHarita.kaydir(n.x - gezinme.bas.x, n.y - gezinme.bas.y);
  });

  const bitir = ev => {
    dokunanlar.delete(ev.pointerId);
    if (dokunanlar.size < 2) ikiParmak = null;
    gezinme = null;
    zoomDurumuCiz();
  };
  kap.addEventListener("pointerup", bitir);
  kap.addEventListener("pointercancel", bitir);
  window.addEventListener("pointerup", bitir);

  /* Space: basılıyken sol tuş gezdirir. Yazı alanındayken devreye girmez. */
  document.addEventListener("keydown", ev => {
    if (ev.code !== "Space" || bosluk) return;
    if (!$("#ekran-editor").classList.contains("aktif")) return;
    if (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA") return;
    ev.preventDefault();
    bosluk = true;
    zoomDurumuCiz();
  });
  document.addEventListener("keyup", ev => {
    if (ev.code !== "Space") return;
    bosluk = false;
    gezinme = null;
    zoomDurumuCiz();
  });
}

/* İki parmak gelince yarım kalan sürüklemeyi geri al — parmaklardan biri
   objeyi kaydırmışsa harita gezerken obje de sürüklenmesin. */
function cizimSurukleyiIptal() {
  surukleme = null;
}

function editorHaritaOlaylari() {
  const svg = editorHarita.svg;

  svg.addEventListener("pointerdown", ev => {
    if (ev.button === 1 || bosluk || gezinmeVarMi()) return;   // gezinme tuşu çizmez
    if (ev.pointerType === "touch" && dokunanlar.size > 1) return;
    const n = editorHarita.svgNokta(ev);

    if (ekleModu === "cizgi" || ekleModu === "alan") { cizimNoktaEkle(n); return; }
    if (ekleModu === "balon") { baloncukEkle(n); return; }

    const tut = ev.target.closest(".tutamak");
    if (tut) {
      const objeler = acikObjeler();
      const o = objeler && objeler.length === 1 ? objeler[0] : null;
      if (!o || !o.noktalar) return;
      const i = +tut.getAttribute("data-nokta");
      surukleme = { obje: o, tip: "nokta", i, bas: n, basNokta: o.noktalar[i].slice() };
      svg.setPointerCapture(ev.pointerId);
      return;
    }

    const objeEl = ev.target.closest(".obje");
    if (objeEl) {
      const id = objeEl.getAttribute("data-obje");
      const o = editorKonu().objeler.find(x => x.id === id);
      if (!o) return;
      const kart = kartlar(editorKonu()).find(k => k.tip === "obje" && k.objeler.some(x => x.id === id));
      bekleyen = null;
      acikKart = { tip: "obje", id: kart ? kart.objeler[0].id : id };
      if (o.tip !== "cizgi" && o.tip !== "alan") {
        const k = objeKonum(editorKonu().objeler, o);
        surukleme = { obje: o, tip: "obje", tasindi: false, bas: n, basX: k.x, basY: k.y };
        svg.setPointerCapture(ev.pointerId);
      }
      editorTazele();
      return;
    }

    if (ekleModu === "isaret") {
      const g = ev.target.closest("g[data-plakakodu]");
      if (!g) return;
      const plaka = g.getAttribute("data-plakakodu");
      if (plaka === "00") return;
      konumEkle(plaka, n.x, n.y);
    }
  });

  svg.addEventListener("pointermove", ev => {
    if (!surukleme || gezinmeVarMi()) return;
    const o = surukleme.obje;
    const n = editorHarita.svgNokta(ev);
    const dx = n.x - surukleme.bas.x, dy = n.y - surukleme.bas.y;
    if (Math.abs(dx) + Math.abs(dy) < 1.2) return;
    surukleme.tasindi = true;

    if (surukleme.tip === "nokta") {
      o.noktalar[surukleme.i] = [surukleme.basNokta[0] + dx, surukleme.basNokta[1] + dy];
      const yol = o.tip === "alan" ? alanYolu(o.noktalar) : cizgiYolu(o.noktalar);
      $$(`[data-obje="${o.id}"] path`, editorHarita.objeKat).forEach(el => el.setAttribute("d", yol));
      const t = editorHarita.tutamakKat.querySelector(`[data-nokta="${surukleme.i}"]`);
      if (t) { t.setAttribute("cx", o.noktalar[surukleme.i][0]); t.setAttribute("cy", o.noktalar[surukleme.i][1]); }
      return;
    }

    o.x = surukleme.basX + dx;
    o.y = surukleme.basY + dy;
    editorHarita.objeleriCiz(editorKonu().objeler);
    editorTazeleHafif();
  });

  const birak = () => {
    if (!surukleme) return;
    const o = surukleme.obje;
    if (o && surukleme.tasindi) {
      if (surukleme.tip === "nokta") {
        o.iller = o.tip === "alan"
          ? alaninIlleri(editorHarita, o.noktalar)
          : cizgininIlleri(editorHarita, o.noktalar);
      } else {
        const yeniPlaka = editorHarita.ilBul(o.x, o.y);
        if (yeniPlaka && !o.iller.includes(PLAKA_AD[yeniPlaka])) {
          o.iller = [PLAKA_AD[yeniPlaka]];
          bildir("İl güncellendi: " + o.iller[0]);
        }
      }
      kutuphaneKaydet();
      editorTazele();
    }
    surukleme = null;
  };
  svg.addEventListener("pointerup", birak);
  svg.addEventListener("pointercancel", birak);
  svg.addEventListener("dblclick", ev => { if (cizim) { ev.preventDefault(); cizimiBitir(); } });
}

/* ----------------------------------------------------------
   KONUM EKLEME
---------------------------------------------------------- */
/* Açık kartın (ya da bekleyen yeni kartın) özelliklerini taşıyan yeni bir
   seçim birimi. Ad aynı olduğu için aynı soruda toplanır. */
function kartOrnegi() {
  const objeler = acikObjeler();
  if (objeler && objeler.length) {
    const ilk = objeler[0];
    return { ad: ilk.ad, emoji: ilk.emoji, gorselId: ilk.gorselId, cerceve: ilk.cerceve,
             boyut: ilk.boyut, aci: ilk.aci, renk: ilk.renk };
  }
  if (bekleyen) {
    return { ad: bekleyen.ad, emoji: bekleyen.emoji, gorselId: bekleyen.gorselId,
             cerceve: bekleyen.cerceve, boyut: 2, aci: 0, renk: null };
  }
  return null;
}

function konumEkle(plaka, x, y) {
  const ornek = kartOrnegi();
  if (!ornek) { bildir("Önce bir kart aç ya da ＋ Yeni'ye bas"); return; }
  const konu = editorKonu();
  const obje = {
    id: yeniId(), tip: "emoji",
    emoji: ornek.gorselId ? "" : (ornek.emoji || "📍"),
    gorselId: ornek.gorselId || null,
    ad: ornek.ad || "", iller: [PLAKA_AD[plaka]], ilce: "", cerceve: ornek.cerceve || null,
    x, y, boyut: ornek.boyut || 2, aci: ornek.aci || 0,
    noktalar: null, renk: null, kalinlik: 3, sorular: [], baloncuklar: []
  };
  konu.objeler.push(obje);
  if (bekleyen) { bekleyen = null; acikKart = { tip: "obje", id: obje.id }; }
  kutuphaneKaydet();
  editorTazele();
  bildir(`${PLAKA_AD[plaka]} eklendi`);
}

function cizimNoktaEkle(n) {
  const alanMi = ekleModu === "alan";
  if (!cizim) {
    cizim = { noktalar: [], alan: alanMi };
    cizim.onizleme = document.createElementNS(SVG_AD, "path");
    cizim.onizleme.setAttribute("class", "onizleme-yol " + (alanMi ? "alan" : "cizgi"));
    cizim.onizleme.setAttribute("stroke-width", alanMi ? 1.6 : 3);
    cizim.onizleme.setAttribute("stroke", CIZGI_RENKLERI[0]);
    cizim.onizleme.setAttribute("fill", alanMi ? CIZGI_RENKLERI[0] : "none");
    cizim.onizleme.setAttribute("fill-opacity", alanMi ? 0.28 : 0);
    editorHarita.objeKat.appendChild(cizim.onizleme);
    $("#btn-cizim-bitir").classList.remove("gizli");
    $("#btn-cizim-iptal").classList.remove("gizli");
  }
  cizim.noktalar.push([Math.round(n.x * 10) / 10, Math.round(n.y * 10) / 10]);
  cizim.onizleme.setAttribute("d",
    cizim.alan && cizim.noktalar.length > 2 ? alanYolu(cizim.noktalar) : cizgiYolu(cizim.noktalar));

  editorHarita.tutamakKat.innerHTML = "";
  cizim.noktalar.forEach(p => {
    const c = document.createElementNS(SVG_AD, "circle");
    c.setAttribute("cx", p[0]); c.setAttribute("cy", p[1]); c.setAttribute("r", 3);
    c.setAttribute("class", "tutamak");
    editorHarita.tutamakKat.appendChild(c);
  });
  $("#btn-cizim-bitir").textContent = cizim.alan
    ? `Alanı tamamla (${cizim.noktalar.length})`
    : `Çizimi bitir (${cizim.noktalar.length})`;
}

function cizimiBitir() {
  if (!cizim) return;
  const alanMi = cizim.alan;
  const enAz = alanMi ? 3 : 2;
  if (cizim.noktalar.length < enAz) {
    cizimiIptal();
    bildir(`En az ${enAz} nokta gerekiyor`);
    return;
  }
  const ornek = kartOrnegi() || { ad: "", renk: null };
  const konu = editorKonu();
  const obje = {
    id: yeniId(), tip: alanMi ? "alan" : "cizgi", emoji: alanMi ? "⬛" : "〰️",
    ad: ornek.ad || "", iller: [], ilce: "", cerceve: null,
    x: null, y: null, boyut: 2, aci: 0,
    noktalar: cizim.noktalar, renk: ornek.renk || CIZGI_RENKLERI[0],
    kalinlik: alanMi ? 1.4 : 3, desen: "duz", saydamlik: 0.45,
    baloncuklar: [], sorular: []
  };
  obje.iller = alanMi
    ? alaninIlleri(editorHarita, obje.noktalar)
    : cizgininIlleri(editorHarita, obje.noktalar);
  konu.objeler.push(obje);

  cizim.onizleme.remove();
  cizim = null;
  $("#btn-cizim-bitir").classList.add("gizli");
  $("#btn-cizim-iptal").classList.add("gizli");
  ekleModu = null;
  bekleyen = null;
  acikKart = { tip: "obje", id: obje.id };
  kutuphaneKaydet();
  editorTazele();
  bildir(`${alanMi ? "Alan" : "Çizgi"} eklendi`);
}

function cizimiIptal() {
  if (!cizim) return;
  cizim.onizleme.remove();
  cizim = null;
  editorHarita.tutamakKat.innerHTML = "";
  $("#btn-cizim-bitir").classList.add("gizli");
  $("#btn-cizim-iptal").classList.add("gizli");
}

function baloncukEkle(n) {
  const objeler = acikObjeler();
  if (!objeler || !objeler.length) { bildir("Önce bir kart aç"); ekleModu = null; return; }
  const o = objeler[0];
  if (!Array.isArray(o.baloncuklar)) o.baloncuklar = [];
  const plaka = editorHarita.ilBul(n.x, n.y);
  o.baloncuklar.push({
    x: Math.round(n.x * 10) / 10, y: Math.round(n.y * 10) / 10,
    baslik: "", il: plaka ? PLAKA_AD[plaka] : ""
  });
  ekleModu = null;
  kutuphaneKaydet();
  editorTazele();
  bildir("Baloncuk eklendi — başlığını yaz");
}

/* ----------------------------------------------------------
   OLAYLAR
---------------------------------------------------------- */
function editorOlaylari() {
  $("#editor-konu").addEventListener("change", e => {
    if (e.target.value === "__yeni__") { e.target.value = durum.editorKonuId; konuEkleModalAc(); return; }
    if (e.target.value === "__sirala__") { e.target.value = durum.editorKonuId; ustKonularAc(); return; }
    durum.editorKonuId = e.target.value;
    acikKart = null; bekleyen = null; ekleModu = null;
    cizimiIptal();
    editorTazele();
  });
  $("#btn-konu-yonet").addEventListener("click", () => konuAyarAc(durum.editorKonuId));

  $("#btn-onizleme").addEventListener("click", onizlemeDegistir);
  $("#btn-zoom-sifirla").addEventListener("click", () => {
    editorHarita.gorunumSifirla();
    zoomDurumuCiz();
  });

  $("#btn-cizim-bitir").addEventListener("click", cizimiBitir);
  $("#btn-cizim-iptal").addEventListener("click", () => { cizimiIptal(); ekleModu = null; editorTazele(); });

  $("#btn-konu-ekle-kaydet").addEventListener("click", konuEkleKaydet);
  $("#btn-konu-ekle-iptal").addEventListener("click", () => $("#modal-konu-ekle").classList.add("gizli"));
  $("#yeni-konu-ad").addEventListener("keydown", e => { if (e.key === "Enter") konuEkleKaydet(); });

  $("#btn-oge-simge-kapat").addEventListener("click", () => $("#modal-oge-simge").classList.add("gizli"));
  $("#modal-oge-simge").addEventListener("click", e => {
    if (e.target.id === "modal-oge-simge") e.target.classList.add("gizli");
  });
  $("#oge-simge-ozel").addEventListener("change", e => {
    const v = e.target.value.trim();
    if (v) simgeUygula({ tip: "emoji", deger: v });
  });
  $("#btn-oge-gorsel").addEventListener("click", () => $("#gorsel-dosya").click());
  $("#gorsel-dosya").addEventListener("change", async e => {
    const dosya = e.target.files && e.target.files[0];
    e.target.value = "";
    const oge = await gorselEkle(dosya);
    if (!oge) return;
    simgeUygula({ tip: "gorsel", id: oge.id, ad: oge.ad, veri: oge.veri });
  });

  $("#btn-disa-aktar").addEventListener("click", yedegiDisaAktar);
  $("#btn-ice-aktar").addEventListener("click", () => $("#yedek-dosya").click());
  $("#yedek-dosya").addEventListener("change", async e => {
    const dosya = e.target.files && e.target.files[0];
    e.target.value = "";
    await yedegiIceAktar(dosya);
  });

  document.addEventListener("keydown", e => {
    if (!$("#ekran-editor").classList.contains("aktif")) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "Enter" && cizim) { e.preventDefault(); cizimiBitir(); }
    else if (e.key === "Escape") {
      if (cizim) cizimiIptal();
      else if (bekleyen) { bekleyen = null; ekleModu = null; }
      else if (ekleModu) ekleModu = null;
      else acikKart = null;
      editorTazele();
    }
  });
}
