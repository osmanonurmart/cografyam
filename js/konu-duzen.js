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

  govde.innerHTML = `
    <div class="konu-ozet" style="--k1:${guvenli(konu.renk)};--k2:${karart(konu.renk, 0.45)}">
      <span class="ozet-emoji">${guvenli(konu.ikon)}</span>
      <div class="ozet-yazi">
        <div class="ozet-ad">${guvenli(konu.ad)}</div>
        <div class="ozet-alt">${soru} soru · ${ust ? guvenli(ust.ikon + " " + ust.ad) : "kapsayıcısız"}</div>
      </div>
    </div>
    <div class="ayar-alani" id="ayar-alani"></div>
    <h2 class="bolum-baslik">Görünüm</h2>
    <div class="ayar-satir">
      <div class="ayar-yazi">
        <div class="ayar-ad">Konu adı ve simgesi</div>
        <div class="ayar-alt">Ana ekranda görünen ad ve emoji.</div>
      </div>
    </div>
    <div class="ekle-satir">
      <button class="ikincil-btn" id="btn-konu-emoji">${guvenli(konu.ikon)}</button>
      <input class="kucuk-alan" id="konu-ad-alan" value="${guvenli(konu.ad)}" placeholder="Konu adı">
      <button class="renk-nokta buyuk" id="btn-konu-renk" style="background:${guvenli(konu.renk)}"></button>
    </div>`;

  konuAyarIcerik(konu, $("#ayar-alani"));

  $("#konu-ad-alan").addEventListener("change", e => {
    konu.ad = e.target.value.trim() || konu.ad;
    kutuphaneKaydet();
    konuSeciciDoldur($("#konu-ayar-sec"));
    $("#konu-ayar-sec").value = konu.id;
    konuAyarEkraniCiz();
  });
  $("#btn-konu-emoji").addEventListener("click", () => {
    const i = KONU_IKONLARI.indexOf(konu.ikon);
    konu.ikon = KONU_IKONLARI[(i + 1) % KONU_IKONLARI.length];
    kutuphaneKaydet();
    konuAyarEkraniCiz();
  });
  $("#btn-konu-renk").addEventListener("click", () => {
    const i = RENKLER.indexOf(konu.renk);
    konu.renk = RENKLER[(i + 1) % RENKLER.length];
    kutuphaneKaydet();
    konuAyarEkraniCiz();
  });
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
}
