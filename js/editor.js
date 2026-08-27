/* ==========================================================
   Coğrafyam — Harita Düzenle (editör)
   Üç araç: Seç · Yerleştir · Çiz
   ========================================================== */

let editorHarita = null;
/* Paletten seçili öge: {tip:"emoji", deger} ya da {tip:"gorsel", id, ad, veri} */
let secilenOge = null;
let surukleme = null;
let cizim = null;                     // { noktalar:[], onizleme:<path> }

const CIZGI_RENKLERI = ["#38bdf8", "#22c55e", "#f59e0b", "#ef4444", "#a78bfa", "#e2e8f0"];

const ARAC_IPUCU = {
  sec: "Objeye tıkla: seç · sürükle: taşı · noktaları düzelt",
  yerlestir: "Haritada bir ile tıkla → emoji objesi eklenir",
  ciz: "Tıklaya tıklaya çiz · çift tık veya Enter bitirir · Esc iptal",
  alan: "Alanın kenarlarını tıklaya tıklaya çiz · Enter kapatır · Esc iptal",
  balon: "Seçili objenin üstünde bir noktaya tıkla → baloncuk eklenir"
};

const DESENLER = [
  ["duz", "Düz"], ["cizgili", "Çizgili"], ["tarali", "Çapraz"],
  ["noktali", "Noktalı"], ["dalgali", "Dalgalı"], ["tugla", "Tuğla"], ["igne", "İğne"]
];

function editorAc() {
  const sec = $("#editor-konu");
  konuSeciciDoldur(sec);
  if (!konuBul(durum.editorKonuId)) durum.editorKonuId = durum.kutuphane[0].id;
  sec.value = durum.editorKonuId;

  ekranGoster("editor");
  modSec(durum.editorMod || "harita");

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
  emojileriCiz();
  aracSec(durum.editorArac || "sec");
}

/* Seçili öge hâlâ palette duruyor mu? (silinmiş olabilir) */
function ogeGecerliMi(oge) {
  if (!oge) return false;
  return oge.tip === "gorsel" ? !!gorselBul(oge.id) : !palet.silinen.includes(oge.deger);
}

/* Palet: başta ＋ (kendi görselini yükle), sonra görsellerin, sonra emojiler.
   Her ögenin köşesinde ✕ ile paletten kaldırma. */
function emojileriCiz() {
  const k = $("#emoji-secim");
  const ogeler = paletOgeleri();
  if (!ogeGecerliMi(secilenOge)) secilenOge = ogeler[0] || null;
  k.innerHTML = "";

  const ekle = document.createElement("button");
  ekle.className = "sec-ogesi ekle";
  ekle.textContent = "＋";
  ekle.title = "Kendi görselini ekle (PNG, JPG, WebP, SVG)";
  ekle.addEventListener("click", () => $("#gorsel-dosya").click());
  k.appendChild(ekle);

  ogeler.forEach(oge => {
    const yuva = document.createElement("div");
    yuva.className = "sec-yuva";

    const b = document.createElement("button");
    const secili = secilenOge && (oge.tip === "gorsel"
      ? (secilenOge.tip === "gorsel" && secilenOge.id === oge.id)
      : (secilenOge.tip === "emoji" && secilenOge.deger === oge.deger));
    b.className = "sec-ogesi" + (oge.tip === "gorsel" ? " gorsel" : "") + (secili ? " secili" : "");
    if (oge.tip === "gorsel") {
      const im = document.createElement("img");
      im.src = oge.veri;
      im.alt = oge.ad || "";
      b.appendChild(im);
      b.title = oge.ad || "Görsel";
    } else {
      b.textContent = oge.deger;
    }
    b.addEventListener("click", () => { secilenOge = oge; $("#emoji-ozel").value = ""; emojileriCiz(); });
    yuva.appendChild(b);

    if (oge.tip === "gorsel") {
      const ad = document.createElement("button");
      ad.className = "sec-sil sec-ad";
      ad.textContent = "✎";
      ad.title = "Adını değiştir";
      ad.addEventListener("click", (e) => { e.stopPropagation(); gorselAdiniDuzenle(oge); });
      yuva.appendChild(ad);
    }

    const sil = document.createElement("button");
    sil.className = "sec-sil";
    sil.textContent = "✕";
    sil.title = "Paletten kaldır";
    sil.addEventListener("click", (e) => { e.stopPropagation(); paletOgesiniSil(oge); });
    yuva.appendChild(sil);

    k.appendChild(yuva);
  });
}

/* Görsel adını paletin altındaki satırda düzenle — ayrı bir pencere açmadan */
function gorselAdiniDuzenle(oge) {
  const eski = $("#gorsel-ad-satir");
  if (eski) eski.remove();

  const satir = document.createElement("div");
  satir.id = "gorsel-ad-satir";
  satir.className = "panel-satir";
  satir.innerHTML = `<input type="text" class="kucuk-alan" id="gorsel-ad-alani" maxlength="40">
                     <button class="ana-btn ince" id="gorsel-ad-kaydet">Kaydet</button>`;
  $("#emoji-bolumu").appendChild(satir);

  const alan = $("#gorsel-ad-alani");
  alan.value = oge.ad || "";
  alan.focus(); alan.select();

  const kaydet = () => {
    const g = gorselBul(oge.id);
    if (g) { g.ad = alan.value.trim() || g.ad; paletKaydet(); }
    satir.remove();
    emojileriCiz();
  };
  $("#gorsel-ad-kaydet").addEventListener("click", kaydet);
  alan.addEventListener("keydown", e => {
    if (e.key === "Enter") kaydet();
    if (e.key === "Escape") satir.remove();
  });
}

async function paletOgesiniSil(oge) {
  if (oge.tip === "emoji") {
    palet.silinen.push(oge.deger);
    paletKaydet();
    emojileriCiz();
    bildir(`${oge.deger} paletten kaldırıldı`);
    return;
  }

  const kullanim = gorselKullanimi(oge.id);
  if (kullanim.length) {
    const nerede = kullanim.slice(0, 4).map(y => `• ${y.konu} › ${y.obje}`).join("\n");
    const tamam = await onay(
      `"${oge.ad}" şu an ${kullanim.length} objede kullanılıyor:\n${nerede}` +
      (kullanim.length > 4 ? `\n• …ve ${kullanim.length - 4} tane daha` : "") +
      `\n\nSilersen bu objeler haritada 🖼️ olarak kalır.`,
      { baslik: "Görsel kullanımda", ikon: "🖼️", evet: "Yine de sil" });
    if (!tamam) return;
  }

  palet.gorseller = palet.gorseller.filter(g => g.id !== oge.id);
  paletKaydet();
  if (secilenOge && secilenOge.tip === "gorsel" && secilenOge.id === oge.id) secilenOge = null;
  emojileriCiz();
  editorTazele();
  bildir(`"${oge.ad}" silindi`);
}

/* Palet ögesinin obje listesinde/haritada görünecek küçük hâli */
function ogeSimgesi(o) {
  if (o.tip === "cizgi") return "〰️";
  if (o.tip === "alan") return "⬭";
  if (o.gorselId) {
    const g = gorselBul(o.gorselId);
    return g ? `<img class="satir-gorsel" src="${guvenli(g.veri)}" alt="">` : "🖼️";
  }
  return guvenli(o.emoji || "📍");
}

function editorKonu() { return konuBul(durum.editorKonuId); }

function seciliObje() {
  const konu = editorKonu();
  return konu ? konu.objeler.find(o => o.id === durum.seciliObjeId) : null;
}

/* ---------------- araçlar ---------------- */
function aracSec(arac) {
  if (cizim && arac !== "ciz" && arac !== "alan") cizimiIptal();
  if (arac === "balon" && !seciliObje()) { bildir("Önce bir obje seç"); return; }
  durum.editorArac = arac;
  $$("#arac-segment .segment-btn").forEach(b => b.classList.toggle("secili", b.dataset.arac === arac));
  $("#emoji-bolumu").classList.toggle("gizli", arac !== "yerlestir");
  $("#editor-harita").classList.toggle("ciz-modu", arac === "ciz" || arac === "alan" || arac === "balon");
  $("#btn-cizim-bitir").classList.add("gizli");
  $("#btn-cizim-iptal").classList.add("gizli");
  editorTazele();
}

/* harita ↔ soru modu */
function modSec(mod) {
  durum.editorMod = mod;
  $$("#mod-segment .segment-btn").forEach(b => b.classList.toggle("secili", b.dataset.mod === mod));
  const haritaModu = mod === "harita";
  $("#panel-harita").classList.toggle("gizli", !haritaModu);
  $("#panel-soru").classList.toggle("gizli", haritaModu);
  $("#arac-segment").classList.toggle("gizli", !haritaModu);
  if (haritaModu) editorTazele();
  else { if (cizim) cizimiIptal(); soruTablosuCiz(); }
}

function editorTazele() {
  const konu = editorKonu();
  if (!konu || !editorHarita) return;
  const onizleme = durum.editorOnizleme === "calis";

  editorHarita.objeleriCiz(konu.objeler);
  const cizimModu = durum.editorArac === "ciz" || durum.editorArac === "alan" || durum.editorArac === "balon";
  editorHarita.objeKat.style.pointerEvents = (cizimModu || onizleme) ? "none" : "auto";

  if (onizleme) {
    /* konuya girildiğinde nasıl görünecekse öyle */
    const birim = konu.ayar.cevapBirimi || "il";
    editorHarita.sinirModu(birim === "bolge" ? "bolge" : (konu.ayar.ilSinirlari === false ? "yok" : "il"));
    editorHarita.isimleriGoster(!!konu.ayar.ilIsimleri);
    const hepsiGorunur = birim === "obje" || konu.ayar.objeGorunur === "bastan";
    editorHarita.tumObjeler(hepsiGorunur);
    // hayalet mod: konuya girildiğinde objeler ❓ olarak başlar
    const hayalet = hayaletAktifMi(konu) && hepsiGorunur;
    editorHarita.hayaletUygula(hayalet ? konu.objeler.map(o => o.id) : null);
    const adlarAcik = konu.ayar.objeAdlari === "gorunsun" && !hayalet;
    editorHarita.adlariGoster(adlarAcik);
    $$(".obje-adi", editorHarita.adKat).forEach(t => t.classList.toggle("acik", adlarAcik));
    editorHarita.tumBalonlar(false);
  } else {
    /* düzenleme: objeler ve adlar hep açık, ama sınır görünümü konu ayarına uyar —
       "İl sınırlarını kaldır" anahtarının etkisi burada da görünsün diye */
    const birimD = konu.ayar.cevapBirimi || "il";
    editorHarita.sinirModu(birimD === "bolge" ? "bolge" : (konu.ayar.ilSinirlari === false ? "yok" : "il"));
    editorHarita.hayaletUygula(null);
    editorHarita.isimleriGoster(true);
    editorHarita.tumObjeler(true);
    editorHarita.adlariGoster(true);
    $$(".obje-adi", editorHarita.adKat).forEach(t => t.classList.add("acik"));
    editorHarita.tumBalonlar(true);
  }
  $$(".obje", editorHarita.objeKat).forEach(t => {
    t.classList.toggle("secili", t.getAttribute("data-obje") === durum.seciliObjeId);
  });
  editorHarita.tutamaklariCiz(durum.editorArac === "sec" ? seciliObje() : null);
  objeListesiCiz();
  objePaneliCiz();
}

function objeListesiCiz() {
  const konu = editorKonu();
  const liste = $("#obje-listesi");
  $("#obje-sayisi").textContent = konu.objeler.length;
  $("#btn-obje-yapistir").classList.toggle("gizli", !panoDolu());
  $("#btn-obje-kopyala").classList.toggle("gizli", !durum.seciliCoklu.size);
  $("#btn-obje-sec").classList.toggle("secili", durum.secimModu);
  liste.innerHTML = "";
  if (!konu.objeler.length) return;

  konu.objeler.forEach(o => {
    const s = document.createElement("button");
    s.className = "obje-satir" + (o.id === durum.seciliObjeId ? " secili" : "") +
                  (durum.seciliCoklu.has(o.id) ? " isaretli" : "");
    s.innerHTML = `
      ${durum.secimModu ? `<span class="secim-kutu">${durum.seciliCoklu.has(o.id) ? "☑" : "☐"}</span>` : ""}
      <span>${ogeSimgesi(o)}</span><b>${guvenli(o.ad || "(adsız)")}</b><i>${guvenli(o.iller.join(", ") || "—")}</i>`;
    s.addEventListener("click", () => {
      if (durum.secimModu) {
        if (durum.seciliCoklu.has(o.id)) durum.seciliCoklu.delete(o.id);
        else durum.seciliCoklu.add(o.id);
      } else {
        durum.seciliObjeId = o.id;
      }
      editorTazele();
    });
    liste.appendChild(s);
  });
}

/* ---------------- kopyala / yapıştır ---------------- */
function panoDolu() {
  const p = Depo.oku("pano", []);
  return Array.isArray(p) && p.length > 0;
}

function objeleriKopyala() {
  const konu = editorKonu();
  const secilenler = konu.objeler.filter(o => durum.seciliCoklu.has(o.id));
  if (!secilenler.length) { bildir("Önce obje seç"); return; }
  Depo.yaz("pano", JSON.parse(JSON.stringify(secilenler)));
  bildir(`${secilenler.length} obje kopyalandı — başka konuya geçip yapıştır`);
  editorTazele();
}

function objeleriYapistir() {
  const pano = Depo.oku("pano", []);
  if (!pano.length) { bildir("Pano boş"); return; }
  const konu = editorKonu();
  const yeniler = pano.map(o => Object.assign({}, o, { id: yeniId() }));
  konu.objeler.push(...yeniler);
  kutuphaneKaydet();
  durum.seciliObjeId = yeniler[yeniler.length - 1].id;
  durum.seciliCoklu.clear();
  durum.secimModu = false;
  editorTazele();
  bildir(`${yeniler.length} obje yapıştırıldı`);
}

/* ---------------- seçili obje paneli ---------------- */
let sonPanelObjeId = null;

function objePaneliCiz() {
  const o = seciliObje();
  const panel = $("#obje-panel");
  if (!o) { panel.classList.add("gizli"); panel.innerHTML = ""; sonPanelObjeId = null; return; }
  panel.classList.remove("gizli");
  /* panel listenin altında olduğu için yeni seçimde görünür alana getir */
  if (sonPanelObjeId !== o.id) {
    sonPanelObjeId = o.id;
    setTimeout(() => panel.scrollIntoView({ behavior: "smooth", block: "nearest" }), 30);
  }
  const cizgiMi = o.tip === "cizgi";
  const alanMi = o.tip === "alan";
  const sekilli = cizgiMi || alanMi;
  const tipAd = cizgiMi ? "çizgi" : alanMi ? "alan" : "obje";

  panel.innerHTML = `
    <label class="alan-etiket">Seçili ${tipAd}</label>
    <input type="text" id="obje-ad" class="kucuk-alan" placeholder="Ad (örn. Kızılırmak)" value="${guvenli(o.ad)}">

    ${sekilli ? `
      <div class="kaydirici">
        <label class="alan-etiket">${alanMi ? "Kenar kalınlığı" : "Kalınlık"} <b id="kalinlik-deger">${o.kalinlik || 3}</b></label>
        <input type="range" id="obje-kalinlik" min="0.5" max="10" step="0.5" value="${o.kalinlik || 3}">
      </div>
      ${alanMi ? `
        <div class="kaydirici">
          <label class="alan-etiket">Doluluk <b id="saydam-deger">${Math.round((o.saydamlik ?? .45) * 100)}%</b></label>
          <input type="range" id="obje-saydamlik" min="0" max="1" step="0.05" value="${o.saydamlik ?? .45}">
        </div>
        <label class="alan-etiket">Desen</label>
        <div class="secenek-satir sarmal" id="alan-desen">
          ${DESENLER.map(([d, ad]) => `<button class="secenek ${(o.desen || "duz") === d ? "secili" : ""}" data-deger="${d}">${ad}</button>`).join("")}
        </div>` : ""}
      <label class="alan-etiket">Renk</label>
      <div class="secim-satir" id="cizgi-renk"></div>
    ` : `
      <div class="kaydirici">
        <label class="alan-etiket">Boyut <b id="boyut-deger">${Number(o.boyut || 1).toFixed(1)}</b></label>
        <input type="range" id="obje-boyut" min="0.4" max="3" step="0.1" value="${o.boyut || 1}">
      </div>
      <div class="kaydirici">
        <label class="alan-etiket">Yön / döndürme <b id="aci-deger">${o.aci || 0}°</b></label>
        <input type="range" id="obje-aci" min="-180" max="180" step="5" value="${o.aci || 0}">
      </div>
    `}

    <label class="alan-etiket">Baloncuklar <span class="sayi-rozet">${(o.baloncuklar || []).length}</span></label>
    <div class="balon-listesi">
      ${(o.baloncuklar || []).map((b, i) => `
        <div class="balon-satir">
          <input class="kucuk-alan" data-balon-baslik="${i}" value="${guvenli(b.baslik || "")}" placeholder="Başlık">
          <select class="secici tam" data-balon-il="${i}">
            <option value="">— il yok —</option>
            ${IL_ADLARI.map(il => `<option value="${guvenli(il)}" ${b.il === il ? "selected" : ""}>${guvenli(il)}</option>`).join("")}
          </select>
          <button class="satir-sil" data-balon-sil="${i}">✕</button>
        </div>`).join("") || `<span class="bos-il">Baloncuk yok</span>`}
    </div>
    <button class="ikincil-btn ince tam" id="btn-balon-ekle">＋ Baloncuk ekle</button>

    <div class="panel-btnler dikey">
      <button class="ana-btn ince tam" id="btn-obje-kaydet">Kaydet</button>
      <button class="tehlike-btn tam" id="btn-obje-sil">${cizgiMi ? "Çizgiyi" : alanMi ? "Alanı" : "Objeyi"} sil</button>
    </div>`;

  $("#obje-ad").addEventListener("input", e => objeGuncelle("ad", e.target.value, true));

  $$("[data-balon-baslik]", panel).forEach(inp => inp.addEventListener("change", () => {
    o.baloncuklar[+inp.dataset.balonBaslik].baslik = inp.value;
    kutuphaneKaydet(); editorTazele();
  }));
  $$("[data-balon-il]", panel).forEach(sel => sel.addEventListener("change", () => {
    o.baloncuklar[+sel.dataset.balonIl].il = sel.value;
    kutuphaneKaydet(); editorTazele();
  }));
  $$("[data-balon-sil]", panel).forEach(b => b.addEventListener("click", () => {
    o.baloncuklar.splice(+b.dataset.balonSil, 1);
    kutuphaneKaydet(); editorTazele();
  }));
  $("#btn-balon-ekle").addEventListener("click", () => aracSec("balon"));

  $("#btn-obje-kaydet").addEventListener("click", () => {
    o.ad = $("#obje-ad").value;
    kutuphaneKaydet(); editorTazele(); bildir("Kaydedildi");
  });
  $("#btn-obje-sil").addEventListener("click", () => {
    const ad = o.ad || (cizgiMi ? "Bu çizgi" : alanMi ? "Bu alan" : o.emoji);
    onay(`"${ad}" haritadan silinecek.`,
         { baslik: `${tipAd.charAt(0).toLocaleUpperCase("tr") + tipAd.slice(1)} sil`,
           ikon: cizgiMi ? "〰️" : alanMi ? "⬭" : (o.emoji || "📍") }).then(evet => {
      if (!evet) return;
      const konu = editorKonu();
      konu.objeler = konu.objeler.filter(x => x.id !== o.id);
      durum.seciliObjeId = null;
      kutuphaneKaydet(); editorTazele();
    });
  });

  if (sekilli) {
    const desenKap = $("#alan-desen");
    if (desenKap) $$(".secenek", desenKap).forEach(b => b.addEventListener("click", () => {
      o.desen = b.dataset.deger; kutuphaneKaydet(); editorTazele();
    }));
    const sayd = $("#obje-saydamlik");
    if (sayd) sayd.addEventListener("input", e => {
      $("#saydam-deger").textContent = Math.round(e.target.value * 100) + "%";
      o.saydamlik = parseFloat(e.target.value);
      kutuphaneKaydet();
      const el = editorHarita.objeKat.querySelector(`[data-obje="${o.id}"] .alan-govde`);
      if (el) el.setAttribute("fill-opacity", o.saydamlik);
    });
    $("#obje-kalinlik").addEventListener("input", e => {
      $("#kalinlik-deger").textContent = e.target.value;
      o.kalinlik = parseFloat(e.target.value);
      kutuphaneKaydet();
      const el = editorHarita.objeKat.querySelector(`[data-obje="${o.id}"] .cizgi-govde, [data-obje="${o.id}"] .alan-govde`);
      if (el) el.setAttribute("stroke-width", o.kalinlik);
    });
    const rk = $("#cizgi-renk");
    CIZGI_RENKLERI.forEach(r => {
      const b = document.createElement("button");
      b.className = "sec-ogesi" + ((o.renk || CIZGI_RENKLERI[0]) === r ? " secili" : "");
      b.style.background = r;
      b.addEventListener("click", () => objeGuncelle("renk", r));
      rk.appendChild(b);
    });
  } else {
    $("#obje-boyut").addEventListener("input", e => {
      $("#boyut-deger").textContent = Number(e.target.value).toFixed(1);
      objeGuncelle("boyut", parseFloat(e.target.value));
    });
    $("#obje-aci").addEventListener("input", e => {
      $("#aci-deger").textContent = e.target.value + "°";
      objeGuncelle("aci", parseInt(e.target.value, 10));
    });
  }
}

/* sadeceListe: yazarken haritayı yeniden çizip odağı kaçırmamak için */
function objeGuncelle(alan, deger, sadeceListe) {
  const o = seciliObje();
  if (!o) return;
  o[alan] = deger;
  kutuphaneKaydet();
  if (sadeceListe) objeListesiCiz();
  else editorTazele();
}

/* ---------------- harita olayları ---------------- */
/* ---------------- zoom ----------------
   Zoom açıkken harita tekerlekle yakınlaşır, sürüklenerek gezilir ve
   objeler tıklanmaz — sürükleme yanlışlıkla obje taşımasın diye.
   Kapattığında yakınlaşma korunur: yakınlaştır, kapat, hassasça yerleştir. */
function zoomDurumuCiz() {
  const acik = !!durum.editorZoom;
  const b = $("#btn-zoom");
  b.innerHTML = `🔍 <b>Zoom ${acik ? "aktif" : "pasif"}</b>`;
  b.classList.toggle("acik", acik);
  $("#editor-harita").classList.toggle("zoom-modu", acik);
  $("#btn-zoom-sifirla").classList.toggle("gizli", !editorHarita || editorHarita.tamGorunumMu());
}

function zoomDegistir() {
  durum.editorZoom = !durum.editorZoom;
  if (durum.editorZoom && cizim) cizimiIptal();
  zoomDurumuCiz();
  bildir(durum.editorZoom
    ? "Zoom açık — tekerlekle yakınlaştır, sürükleyerek gez"
    : "Zoom kapalı — düzenlemeye devam");
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

function zoomOlaylari() {
  /* Olaylar haritanın kendi kapsayıcısına bağlanır (araç çubuğuna değil);
     böylece düğmelere basınca pointer yakalaması tıklamayı yutmaz. */
  const kap = $(".editor-harita-ic");

  kap.addEventListener("wheel", ev => {
    if (!durum.editorZoom) return;
    ev.preventDefault();
    editorHarita.yakinlastir(ev.deltaY < 0 ? 1.18 : 1 / 1.18, editorHarita.svgNokta(ev));
    zoomDurumuCiz();
  }, { passive: false });

  let gezinme = null;
  kap.addEventListener("pointerdown", ev => {
    if (!durum.editorZoom) return;
    ev.preventDefault();
    gezinme = { bas: editorHarita.svgNokta(ev), id: ev.pointerId };
    kap.setPointerCapture(ev.pointerId);
  });
  kap.addEventListener("pointermove", ev => {
    if (!gezinme) return;
    const n = editorHarita.svgNokta(ev);
    editorHarita.kaydir(n.x - gezinme.bas.x, n.y - gezinme.bas.y);
  });
  const bitir = () => { gezinme = null; zoomDurumuCiz(); };
  kap.addEventListener("pointerup", bitir);
  kap.addEventListener("pointercancel", bitir);
}

function editorHaritaOlaylari() {
  const svg = editorHarita.svg;

  svg.addEventListener("pointerdown", ev => {
    if (durum.editorZoom) return;          // zoom modunda harita sadece gezilir
    const n = editorHarita.svgNokta(ev);

    if (durum.editorArac === "ciz" || durum.editorArac === "alan") { cizimNoktaEkle(n); return; }
    if (durum.editorArac === "balon") { baloncukEkle(n); return; }

    const tut = ev.target.closest(".tutamak");
    if (tut) {
      const o = seciliObje();
      if (!o || !o.noktalar) return;
      const i = +tut.getAttribute("data-nokta");
      surukleme = { tip: "nokta", i, bas: n, basNokta: o.noktalar[i].slice() };
      svg.setPointerCapture(ev.pointerId);
      return;
    }

    const objeEl = ev.target.closest(".obje");
    if (objeEl) {
      durum.seciliObjeId = objeEl.getAttribute("data-obje");
      const o = seciliObje();
      if (o && o.tip !== "cizgi" && o.tip !== "alan") {
        const k = objeKonum(editorKonu().objeler, o);
        surukleme = { tip: "obje", tasindi: false, bas: n, basX: k.x, basY: k.y };
        svg.setPointerCapture(ev.pointerId);
      }
      editorTazele();
      return;
    }

    if (durum.editorArac === "yerlestir") {
      const g = ev.target.closest("g[data-plakakodu]");
      if (!g) return;
      const plaka = g.getAttribute("data-plakakodu");
      if (plaka === "00") return;
      objeEkle(plaka, n.x, n.y);
    }
  });

  svg.addEventListener("pointermove", ev => {
    if (!surukleme) return;
    const o = seciliObje();
    if (!o) return;
    const n = editorHarita.svgNokta(ev);
    const dx = n.x - surukleme.bas.x, dy = n.y - surukleme.bas.y;
    if (Math.abs(dx) + Math.abs(dy) < 1.2) return;
    surukleme.tasindi = true;

    if (surukleme.tip === "nokta") {
      o.noktalar[surukleme.i] = [surukleme.basNokta[0] + dx, surukleme.basNokta[1] + dy];
      const yol = o.tip === "alan" ? alanYolu(o.noktalar) : cizgiYolu(o.noktalar);
      $$(`[data-obje="${o.id}"] path`, editorHarita.objeKat).forEach(el => el.setAttribute("d", yol));
      const t = editorHarita.tutamakKat.querySelector(`[data-nokta="${surukleme.i}"]`);
      if (t) {
        t.setAttribute("cx", o.noktalar[surukleme.i][0]);
        t.setAttribute("cy", o.noktalar[surukleme.i][1]);
      }
      return;
    }

    o.x = surukleme.basX + dx;
    o.y = surukleme.basY + dy;
    const el = editorHarita.objeKat.querySelector(`[data-obje="${o.id}"] .emoji-govde`);
    if (el) el.setAttribute("transform", `translate(${o.x.toFixed(1)} ${o.y.toFixed(1)}) rotate(${o.aci || 0})`);
  });

  const birak = () => {
    if (!surukleme) return;
    const o = seciliObje();
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

/* ---------------- çizim ---------------- */
function cizimNoktaEkle(n) {
  const alanMi = durum.editorArac === "alan";
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
    $("#btn-cizim-bitir").textContent = alanMi ? "Alanı kapat" : "Çizimi bitir";
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
  const konu = editorKonu();
  const obje = {
    id: yeniId(), tip: alanMi ? "alan" : "cizgi", emoji: alanMi ? "⬛" : "〰️",
    ad: "", iller: [],
    x: null, y: null, boyut: 1, aci: 0,
    noktalar: cizim.noktalar, renk: CIZGI_RENKLERI[0],
    kalinlik: alanMi ? 1.4 : 3, desen: "duz", saydamlik: 0.45,
    baloncuklar: [], sorular: []
  };
  obje.iller = alanMi
    ? alaninIlleri(editorHarita, obje.noktalar)
    : cizgininIlleri(editorHarita, obje.noktalar);
  konu.objeler.push(obje);
  durum.seciliObjeId = obje.id;

  cizim.onizleme.remove();
  cizim = null;
  kutuphaneKaydet();
  aracSec("sec");
  bildir(`${alanMi ? "Alan" : "Çizgi"} eklendi — adını yaz`);
  setTimeout(() => { const a = $("#obje-ad"); if (a) a.focus(); }, 60);
}

/* baloncuk: seçili objenin üstünde işaret noktası */
function baloncukEkle(n) {
  const o = seciliObje();
  if (!o) { bildir("Önce bir obje seç"); aracSec("sec"); return; }
  if (!Array.isArray(o.baloncuklar)) o.baloncuklar = [];
  const plaka = editorHarita.ilBul(n.x, n.y);
  o.baloncuklar.push({
    x: Math.round(n.x * 10) / 10,
    y: Math.round(n.y * 10) / 10,
    baslik: "",
    il: plaka ? PLAKA_AD[plaka] : ""
  });
  kutuphaneKaydet();
  aracSec("sec");
  bildir("Baloncuk eklendi — panelden başlığını yaz");
}

function cizimiIptal() {
  if (!cizim) return;
  cizim.onizleme.remove();
  cizim = null;
  editorHarita.tutamakKat.innerHTML = "";
  $("#btn-cizim-bitir").classList.add("gizli");
  $("#btn-cizim-iptal").classList.add("gizli");
}

function objeEkle(plaka, x, y) {
  const konu = editorKonu();
  const ozel = $("#emoji-ozel").value.trim();
  const gorselMi = !ozel && secilenOge && secilenOge.tip === "gorsel";
  const emoji = ozel || (secilenOge && secilenOge.tip === "emoji" ? secilenOge.deger : "📍");

  const obje = {
    id: yeniId(), tip: "emoji",
    emoji: gorselMi ? "" : emoji,
    gorselId: gorselMi ? secilenOge.id : null,
    ad: gorselMi ? secilenOge.ad : "", iller: [PLAKA_AD[plaka]],
    x, y, boyut: 1, aci: 0, noktalar: null, renk: null, kalinlik: 3, sorular: []
  };
  konu.objeler.push(obje);
  durum.seciliObjeId = obje.id;
  kutuphaneKaydet();
  editorTazele();
  const a = $("#obje-ad"); if (a) a.focus();
  bildir(`${gorselMi ? secilenOge.ad : emoji} · ${PLAKA_AD[plaka]} iline eklendi — adını yaz`);
}

/* ---------------- olaylar ---------------- */
function editorOlaylari() {
  $("#editor-konu").addEventListener("change", e => {
    if (e.target.value === "__yeni__") { e.target.value = durum.editorKonuId; konuEkleModalAc(); return; }
    if (e.target.value === "__sirala__") { e.target.value = durum.editorKonuId; ustKonularAc(); return; }
    durum.editorKonuId = e.target.value;
    durum.seciliObjeId = null;
    durum.seciliCoklu.clear();
    modSec(durum.editorMod || "harita");
  });
  $$("#mod-segment .segment-btn").forEach(b =>
    b.addEventListener("click", () => modSec(b.dataset.mod)));
  $("#btn-konu-yonet").addEventListener("click", () => konuAyarAc(durum.editorKonuId));

  $("#btn-onizleme").addEventListener("click", onizlemeDegistir);
  $("#btn-zoom").addEventListener("click", zoomDegistir);
  $("#btn-zoom-sifirla").addEventListener("click", () => {
    editorHarita.gorunumSifirla();
    zoomDurumuCiz();
  });
  $("#btn-obje-sec").addEventListener("click", () => {
    durum.secimModu = !durum.secimModu;
    if (!durum.secimModu) durum.seciliCoklu.clear();
    editorTazele();
  });
  $("#btn-obje-kopyala").addEventListener("click", objeleriKopyala);
  $("#btn-obje-yapistir").addEventListener("click", objeleriYapistir);
  $("#btn-konu-ekle-kaydet").addEventListener("click", konuEkleKaydet);
  $("#btn-konu-ekle-iptal").addEventListener("click", () => $("#modal-konu-ekle").classList.add("gizli"));
  $("#yeni-konu-ad").addEventListener("keydown", e => { if (e.key === "Enter") konuEkleKaydet(); });

  $$("#arac-segment .segment-btn").forEach(b => b.addEventListener("click", () => aracSec(b.dataset.arac)));
  $("#btn-cizim-bitir").addEventListener("click", cizimiBitir);
  $("#btn-cizim-iptal").addEventListener("click", () => { cizimiIptal(); aracSec("sec"); });
  $("#btn-obje-ekle").addEventListener("click", () => {
    aracSec("yerlestir");
    bildir("Haritada bir ile tıkla — ya da Çiz aracıyla akarsu çiz");
  });

  $("#emoji-ozel").addEventListener("input", e => {
    if (e.target.value.trim()) {
      $$("#emoji-secim .sec-ogesi").forEach(b => b.classList.remove("secili"));
    }
  });

  $("#gorsel-dosya").addEventListener("change", async e => {
    const dosya = e.target.files && e.target.files[0];
    e.target.value = "";                     // aynı dosya tekrar seçilebilsin
    const oge = await gorselEkle(dosya);
    if (!oge) return;
    secilenOge = { tip: "gorsel", id: oge.id, ad: oge.ad, veri: oge.veri };
    $("#emoji-ozel").value = "";
    emojileriCiz();
    aracSec("yerlestir");
    bildir(`"${oge.ad}" palete eklendi — haritada bir ile tıkla`);
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
    else if (e.key === "Escape") { if (cizim) cizimiIptal(); else aracSec("sec"); }
    else if (e.key === "1") aracSec("sec");
    else if (e.key === "2") aracSec("yerlestir");
    else if (e.key === "3") aracSec("ciz");
    else if (e.key === "4") aracSec("alan");
    else if (e.key === "5") aracSec("balon");
  });
}
