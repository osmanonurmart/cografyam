/* ==========================================================
   Coğrafyam — Günlük Tekrar (tur mantığı)

   Sınav gününe kadar bütün soruları tekrar tekrar dolaştırır:
   sabit bir sırada ilerleyen bir imleç vardır; her gün, seçtiğin süre
   dolana kadar sıradan soru alınır; bilinemeyenler ertesi günün başına
   yazılır. Gün içinde liste DEĞİŞMEZ — "bugün kaç kaldı" oynamasın.

   Öğrenme GÜN üzerinden ölçülür: iki AYRI günde üst üste doğru bilinen
   soru öğrenilmiş sayılır (aynı gün ikinci kez doğru bilmek saymaz).
   Sonra gittikçe seyrek sorulur: 3, 6, 10, 15 gün. Yanlış bilinirse seri
   sıfırlanır ve soru her turda gelmeye döner.
   Yalnızca Günlük Tekrar'daki cevaplar sayılır.

   Durum kişiye özeldir: ayarlar.tekrar[profilId]
     { sinav, dakika, sira[], pos, tur, gun, liste[], yapilan[],
       bilinemeyen[], borc[], borcSayisi, gunBasi{pos,tur,borc},
       ogrenildi{anahtar:seri}, sonGun{anahtar:"YYYY-AA-GG"},
       deneme{anahtar:[doğru, yanlış]}, hiz{tahmin,gercek,n} }

   Mantığın tam anlatımı: "Günlük görev (sınav planı) — taşınabilir mantık".
   ========================================================== */

const TEKRAR_SINAV = "2026-10-01";
const TEKRAR_DAKIKALAR = [15, 30, 45, 60, 90, 120];
const TEKRAR_BILME = 2;              // kaç AYRI günde üst üste doğru = öğrenildi
const TEKRAR_ARALIK = [3, 6, 10, 15];  // öğrendikten sonra kaç gün sonra tekrar sorulur
const SURE_TABAN = 4;                // sn — okuma, düşünme, tıklama
const SURE_KARAKTER = 15;            // karakter/sn
const SURE_HEDEF_EK = 1.5;           // sn — ikinci ve sonraki her hedef için

function tekrarBugun() { return new Date().toLocaleDateString("sv"); }

function tekrarGunFarki(a, b) {
  return Math.round((new Date(b + "T00:00") - new Date(a + "T00:00")) / 86400000);
}

function tekrarGunEkle(gun, adet) {
  const t = new Date(gun + "T00:00");
  t.setDate(t.getDate() + adet);
  return t.toLocaleDateString("sv");
}

/* ---------------- öğeler ve sıra ---------------- */
function tekrarAnahtar(konu, soru) { return konu.id + "::" + soru.metin; }

/* Bütün soruların belirli (rastgele olmayan) sırası: konu sırası → soru sırası */
function tekrarOgeler() {
  const harita = new Map();
  durum.kutuphane.forEach(konu => {
    sorulariUret(konu).forEach(soru => {
      const anahtar = tekrarAnahtar(konu, soru);
      if (!harita.has(anahtar)) harita.set(anahtar, { anahtar, konu, soru });
    });
  });
  return harita;
}

function karistir(dizi) {
  for (let i = dizi.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dizi[i], dizi[j]] = [dizi[j], dizi[i]];
  }
  return dizi;
}

/* Silinen soru sıradan düşer (imleci kaydırmaz), yeni sorular karıştırılıp
   sıranın görülmemiş kısmına eklenir. Sıra konu konu değil KARIŞIKTIR:
   bir günde farklı konulardan sorular arka arkaya gelir. */
function tekrarSirayiGuncelle(t, ogeler) {
  const yeni = [];
  let yeniPos = 0;
  (t.sira || []).forEach((anahtar, i) => {
    if (!ogeler.has(anahtar)) return;
    if (i < t.pos) yeniPos++;
    yeni.push(anahtar);
  });
  const varOlan = new Set(yeni);
  const eklenecek = [];
  ogeler.forEach((_, anahtar) => { if (!varOlan.has(anahtar)) eklenecek.push(anahtar); });
  t.sira = yeni.concat(karistir(eklenecek));
  t.pos = Math.min(yeniPos, t.sira.length);

  /* eski sürümden gelen konu konu sıralı liste bir kez karıştırılır;
     yalnızca bu turda görülmemiş kısım karışır ki imleç bozulmasın */
  if (!t.karisik) {
    const kalan = karistir(t.sira.slice(t.pos));
    t.sira = t.sira.slice(0, t.pos).concat(kalan);
    t.karisik = true;
  }
}

/* ---------------- süre tahmini ---------------- */
function tekrarKatsayi(t) {
  const h = t.hiz || {};
  if (!h.n || h.n < 20 || !h.tahmin) return 1;
  return Math.min(3, Math.max(0.5, h.gercek / h.tahmin));
}

function tekrarHamSure(oge) {
  const s = oge.soru;
  const hedef = Math.max(1, (s.hedefIller || []).length, (s.hedefObjeler || []).length);
  return SURE_TABAN + (s.metin || "").length / SURE_KARAKTER + (hedef - 1) * SURE_HEDEF_EK;
}

function tekrarSure(oge, katsayi) { return tekrarHamSure(oge) * katsayi; }

/* ---------------- durum ---------------- */
function tekrarDurum() {
  const a = durum.ayarlar;
  if (!a.tekrar || a.tekrar.kartlar) a.tekrar = {};          // çok eski biçimler
  const kimlik = durum.aktifProfilId || ORTAK_KIMLIK;
  const t = a.tekrar[kimlik] = Object.assign({
    sinav: TEKRAR_SINAV, dakika: 60, sira: [], pos: 0, tur: 1,
    gun: "", liste: [], yapilan: [], bilinemeyen: [], borc: [], borcSayisi: 0,
    gunBasi: null, ogrenildi: {}, hiz: { tahmin: 0, gercek: 0, n: 0 }
  }, a.tekrar[kimlik] || {});

  if (t.kartlar) {                       // "iki doğru = öğrenildi" biçiminden taşı
    t.ogrenildi = t.ogrenildi || {};
    Object.entries(t.kartlar).forEach(([anahtar, k]) => { t.ogrenildi[anahtar] = k.d || 0; });
    delete t.kartlar; delete t.kota; delete t.cozulen; delete t.hedef;
    t.gun = "";                          // günün listesi yeni mantıkla kurulsun
  }
  if (!Array.isArray(t.liste)) { t.liste = []; t.gun = ""; }
  if (t.sonTur || t.listeTur) { delete t.sonTur; delete t.listeTur; }   // tur temelli eski alanlar
  if (!t.deneme) {
    /* Soru başına doğru/yanlış sayısı sonradan eklendi. Geçmişi elde kalan
       izlerden başlat: bugün bilinemeyenler 1 yanlış, serisi olanlar seri
       kadar doğru (seri = üst üste doğru, en az o kadar doğru var demek). */
    t.deneme = {};
    Object.entries(t.ogrenildi || {}).forEach(([a, seri]) => { if (seri > 0) t.deneme[a] = [seri, 0]; });
    (t.bilinemeyen || []).forEach(a => { const d = t.deneme[a] || [0, 0]; d[1] = Math.max(d[1], 1); t.deneme[a] = d; });
  }

  const ogeler = tekrarOgeler();
  tekrarSirayiGuncelle(t, ogeler);

  const bugun = tekrarBugun();
  if (t.gun !== bugun) tekrarYeniGun(t, ogeler);
  else tekrarCiftMetinleriAt(t, ogeler);
  return t;
}

function tekrarOgrenildiMi(t, anahtar) { return (t.ogrenildi[anahtar] || 0) >= TEKRAR_BILME; }

/* Sorulma sırası gelmiş mi? Öğrenilmemiş soru her turda gelir. Öğrenilmiş
   soru, en son doğru bilindiği GÜNDEN şu kadar gün sonra gelir:
   2. doğru → 3 gün, 3. → 6, 4. → 10, sonrası 15. Günü bilinmeyen eski
   kayıt bir kez sorulur, sonrası kendiliğinden oturur. */
function tekrarBeklemeGunu(seri) {
  const i = Math.min(seri - TEKRAR_BILME, TEKRAR_ARALIK.length - 1);
  return TEKRAR_ARALIK[Math.max(0, i)];
}

function tekrarSirasiGeldi(t, anahtar) {
  const seri = t.ogrenildi[anahtar] || 0;
  if (seri < TEKRAR_BILME) return true;
  const son = (t.sonGun || {})[anahtar];
  if (!son) return true;
  return tekrarGunFarki(son, tekrarBugun()) >= tekrarBeklemeGunu(seri);
}

/* Eski kuralla kurulmuş günün listesinde aynı metin iki kez olabilir
   (aynı soru birden fazla konuda). Cevaplanmamış olan fazlalık atılır;
   sırasını kaybetmez, başka gün gelir. */
function tekrarCiftMetinleriAt(t, ogeler) {
  const yapilan = new Set(t.yapilan || []);
  const gorulen = new Set();
  const kalan = [];
  let atilan = 0;
  (t.liste || []).forEach(a => {
    const oge = ogeler.get(a);
    const metin = oge ? (oge.soru.metin || "").trim() : "";
    if (metin && gorulen.has(metin) && !yapilan.has(a)) { atilan++; return; }
    if (metin) gorulen.add(metin);
    kalan.push(a);
  });
  if (!atilan) return;
  t.liste = kalan;
  ayarlariKaydet();
}

/* ---------------- günün listesi ---------------- */
function tekrarYeniGun(t, ogeler) {
  const canli = new Set(ogeler.keys());
  const borc = [];
  const ekle = a => { if (canli.has(a) && !borc.includes(a)) borc.push(a); };
  (t.bilinemeyen || []).forEach(ekle);                                  // dün bilinemeyenler
  (t.liste || []).forEach(a => { if (!(t.yapilan || []).includes(a)) ekle(a); });  // dün yetişmeyenler
  (t.borc || []).forEach(ekle);                                         // eski borç

  t.gunBasi = { pos: t.pos, tur: t.tur, borc: borc.slice() };
  t.gun = tekrarBugun();
  t.yapilan = [];
  t.bilinemeyen = [];
  tekrarListeyiDoldur(t, ogeler);
  ayarlariKaydet();
}

/* Günün listesini gün başındaki imleçten kurar. Saftır: kaydetmez,
   rastgelelik içermez — aynı girdiyle aynı listeyi verir. */
function tekrarListeyiDoldur(t, ogeler) {
  ogeler = ogeler || tekrarOgeler();
  const bas = t.gunBasi || { pos: t.pos, tur: t.tur, borc: [] };
  const butce = (t.dakika || 60) * 60;
  const katsayi = tekrarKatsayi(t);
  const liste = [];
  const eklenen = new Set();
  /* Aynı soru metni birden fazla konuda olabilir (ör. "Hangisi Uludağ?"
     Kıvrım Dağlar, Buzul Dağları ve Kayak Merkezleri'nde). Bunlar ayrı
     kayıtlardır; ikisi de aynı günün listesine girerse karışık sırada yan
     yana düşüp aynı soru iki kez sorulmuş gibi görünüyordu. Günde bir
     metin bir kez: atlanan, sırasını kaybetmeden başka gün gelir. */
  const metinler = new Set();
  let kullanilan = 0, borctan = 0, yeniTur = false;
  let pos = bas.pos, tur = bas.tur;
  const borc = bas.borc.filter(a => ogeler.has(a));

  const al = (anahtar) => {
    if (eklenen.has(anahtar)) return false;
    const oge = ogeler.get(anahtar);
    const metin = oge ? (oge.soru.metin || "").trim() : "";
    if (metin && metinler.has(metin)) return false;
    metinler.add(metin);
    eklenen.add(anahtar);
    liste.push(anahtar);
    kullanilan += tekrarSure(oge, katsayi);
    return true;
  };

  const kalanBorc = [];              // metni bugün zaten sorulan borçlar yarına kalır
  while (borc.length && (!liste.length || kullanilan < butce)) {
    const a = borc.shift();
    if (al(a)) borctan++; else kalanBorc.push(a);
  }

  for (let güvenlik = 0; güvenlik < t.sira.length; güvenlik++) {
    if (liste.length && kullanilan >= butce) break;
    if (pos >= t.sira.length) { pos = 0; tur++; yeniTur = true; }
    const anahtar = t.sira[pos++];
    if (tekrarSirasiGeldi(t, anahtar)) al(anahtar);        // öğrenilenler seyrek gelir
  }

  /* her yeni turda sıra yeniden karışsın — aynı diziliş tekrar etmesin */
  if (yeniTur) t.karisik = false;
  t.liste = liste;
  t.borc = kalanBorc.concat(borc);
  t.borcSayisi = borctan;
  t.pos = pos;
  t.tur = tur;
}

function tekrarKalanlar(t) {
  const yapilan = new Set(t.yapilan || []);
  return (t.liste || []).filter(a => !yapilan.has(a));
}

/* Gün içinde süre değişirse liste gün başındaki imleçten yeniden kurulur */
function tekrarSureAyarla(dakika) {
  const t = tekrarDurum();
  t.dakika = dakika;
  const yapilan = (t.yapilan || []).slice();
  tekrarListeyiDoldur(t);
  yapilan.forEach(a => { if (!t.liste.includes(a)) t.liste.unshift(a); });   // çalışılan kaybolmasın
  ayarlariKaydet();
  tekrarEkraniCiz();
}

function tekrarSinavAyarla(tarih) {
  const t = tekrarDurum();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return;
  t.sinav = tarih;
  ayarlariKaydet();
  tekrarEkraniCiz();
}

/* ---------------- gösterilen değerler ---------------- */
function tekrarOzet(t) {
  const ogeler = tekrarOgeler();
  const toplam = t.sira.length;
  const katsayi = tekrarKatsayi(t);
  const ortSure = toplam
    ? t.sira.reduce((s, a) => s + tekrarSure(ogeler.get(a), katsayi), 0) / toplam : 0;
  const kalanGun = Math.max(0, tekrarGunFarki(tekrarBugun(), t.sinav));
  const gunlukKapasite = ortSure ? Math.min(toplam, ((t.dakika || 60) * 60) / ortSure) : 0;
  const turIlerlemesi = toplam ? (t.tur - 1) + t.pos / toplam : 0;
  const gelecekGun = Math.max(0, kalanGun - 1);
  const tahminiTur = turIlerlemesi + (toplam ? gelecekGun * gunlukKapasite / toplam : 0);
  const ogrenilen = t.sira.filter(a => tekrarOgrenildiMi(t, a)).length;

  return { ogeler, toplam, ortSure, kalanGun, gelecekGun, gunlukKapasite, turIlerlemesi,
           tahminiTur, ogrenilen, tur: t.tur,
           kalan: tekrarKalanlar(t).length, gunluk: (t.liste || []).length };
}

/* Konu başına öğrenme tablosu */
function tekrarKonuOzeti(t, ogeler) {
  const konular = new Map();
  (ogeler || tekrarOgeler()).forEach(oge => {
    const k = konular.get(oge.konu.id) ||
      { konu: oge.konu, toplam: 0, ogrenilen: 0, yolda: 0, denenen: 0, dogru: 0, yanlis: 0 };
    k.toplam++;
    const seri = t.ogrenildi[oge.anahtar] || 0;
    if (seri >= TEKRAR_BILME) k.ogrenilen++;
    else if (seri > 0) k.yolda++;
    const d = (t.deneme || {})[oge.anahtar];
    if (d) { k.denenen++; k.dogru += d[0]; k.yanlis += d[1]; }
    konular.set(oge.konu.id, k);
  });
  return [...konular.values()].map(k =>
    Object.assign(k, {
      yuzde: k.toplam ? Math.round(100 * k.ogrenilen / k.toplam) : 0,
      oran: k.dogru + k.yanlis ? k.dogru / (k.dogru + k.yanlis) : null
    }));
}

/* ---------------- ana ekran kartı ---------------- */
function tekrarKarti() {
  const t = tekrarDurum();
  if (!t.sira.length) return null;
  const o = tekrarOzet(t);

  const cevre = 2 * Math.PI * 13;
  const yuzde = o.gunluk ? Math.round(100 * (o.gunluk - o.kalan) / o.gunluk) : 100;
  const kutu = document.createElement("div");
  kutu.className = "konu-kutu tekrar-kutu" + (o.kalan ? "" : " bitti");
  kutu.style.setProperty("--k1", "#0ea5e9");
  kutu.style.setProperty("--k2", karart("#0ea5e9", 0.45));
  kutu.innerHTML = `
    <div class="kart-yuz on">
      <div class="k-emoji">${o.kalan ? "🔁" : "✅"}</div>
      <div class="k-ad">Günlük Tekrar</div>
      <div class="k-eylem">
        <span class="k-durum" title="${o.kalan ? `Bugün ${o.kalan} soru kaldı` : "Bugünlük tamam"}">
          <svg class="k-halka" viewBox="0 0 32 32" aria-hidden="true">
            <circle class="halka-zemin" cx="16" cy="16" r="13"></circle>
            <circle class="halka-dolu" cx="16" cy="16" r="13"
                    stroke-dasharray="${(yuzde / 100) * cevre} ${cevre}"></circle>
          </svg>
          <span class="k-simge">${o.kalan || "✓"}</span>
        </span>
      </div>
    </div>`;
  kutu.addEventListener("click", tekrarEkraniAc);
  return kutu;
}

/* ---------------- durum ekranı ---------------- */
function tekrarEkraniAc() {
  tekrarEkraniCiz();
  ekranGoster("tekrar");
}

function tekrarEkraniCiz() {
  const t = tekrarDurum();
  const o = tekrarOzet(t);
  const p = aktifProfil();
  const konular = tekrarKonuOzeti(t, o.ogeler).sort((a, b) => a.yuzde - b.yuzde || b.toplam - a.toplam);
  /* Zayıf konu: Günlük Tekrar'da doğru bilme oranı en düşük olanlar. Hiç
     sorulmamış konu zayıf sayılmaz — öğrenilme yüzdesi herkes %0'dayken
     bütün konular zayıf görünüyordu. */
  const zayif = konular.filter(k => k.denenen >= 3 && k.oran < 1)
    .sort((a, b) => a.oran - b.oran || b.yanlis - a.yanlis).slice(0, 3);
  const yolda = o.ogeler.size ? t.sira.filter(a => { const s = t.ogrenildi[a] || 0; return s > 0 && s < TEKRAR_BILME; }).length : 0;
  const dk = t.dakika || 60;
  const gerekenDk = o.gelecekGun === 0 ? null : Math.ceil(
    (1 - o.turIlerlemesi) * o.toplam * o.ortSure / Math.max(1, o.kalanGun - 1) / 60);

  $("#tekrar-govde").innerHTML = `
    <div class="tekrar-ust">
      <div class="tekrar-halka" style="--y:${o.gunluk ? Math.round(100 * (o.gunluk - o.kalan) / o.gunluk) : 100}">
        <span>${o.kalan || "✓"}</span>
      </div>
      <div class="tekrar-ozet">
        <div class="tekrar-baslik">${p ? guvenli(p.avatar + " " + p.ad) : "Günlük Tekrar"}</div>
        <div class="tekrar-alt">bugün ${o.gunluk - o.kalan}/${o.gunluk} soru${t.borcSayisi ? ` · ${t.borcSayisi}'i önceki günlerden` : ""}</div>
        <div class="tekrar-alt">${o.tur}. tur · %${Math.round(100 * (o.toplam ? t.pos / o.toplam : 0))} · sınava ${o.kalanGun} gün</div>
      </div>
    </div>

    <button class="ana-btn tam" id="btn-tekrar-basla" ${o.kalan ? "" : "disabled"}>
      ${o.kalan ? `Başla — ${o.kalan} soru` : "Bugünlük tamam ✓"}
    </button>

    <h2 class="bolum-baslik">Günlük süre</h2>
    <div class="secenek-satir sarmal" id="tekrar-sure-secim">
      ${TEKRAR_DAKIKALAR.map(d => `<button class="secenek ${d === dk ? "secili" : ""}" data-dk="${d}">${d} dk</button>`).join("")}
    </div>
    <p class="tekrar-tahmin ${o.tahminiTur < 1 ? "uyari" : ""}">
      ${o.tahminiTur >= 1
        ? `Bu tempoyla sınava kadar her soru yaklaşık <b>${o.tahminiTur.toFixed(1)} kez</b> tekrar edilir.`
        : `Bu tempoyla sınava kadar soruların tamamı bitmiyor${gerekenDk ? ` — günde ${gerekenDk} dakika gerekir` : ""}.`}
      <span class="ince">Günde ${Math.round(o.gunlukKapasite)} soru · soru başına ~${o.ortSure.toFixed(0)} sn</span>
    </p>

    <h2 class="bolum-baslik">Sınav tarihi</h2>
    <input type="date" class="kucuk-alan" id="tekrar-sinav" value="${t.sinav}">

    <h2 class="bolum-baslik">Öğrenilen sorular</h2>
    <p class="tekrar-tahmin"><b>${o.ogrenilen}/${o.toplam}</b> soru öğrenildi${yolda ? ` · <b>${yolda}</b> yolda (1 kez doğru)` : ""}
      <span class="ince">İki AYRI günde üst üste doğru bilinen soru öğrenilmiş sayılır
        (aynı gün ikinci kez bilmek saymaz). Sonra seyrelerek sorulur: 3 gün, yine bilirsen 6,
        sonra 10, sonra 15 gün. Yanlış bilirsen her turda gelmeye döner.
        Yalnızca Günlük Tekrar'daki cevaplar sayılır.</span></p>

    ${zayif.length ? `
      <h2 class="bolum-baslik">En zayıf konular <small class="ince">doğru bilme oranına göre</small></h2>
      <div class="tekrar-liste">${zayif.map(k => tekrarSatiri(k, true)).join("")}</div>` : ""}

    <h2 class="bolum-baslik">Tüm konular</h2>
    <div class="tekrar-liste">${konular.map(k => tekrarSatiri(k, false)).join("")}</div>`;

  const basla = $("#btn-tekrar-basla");
  if (basla) basla.addEventListener("click", () => tekrarBaslat());
  $$("#tekrar-govde .tekrar-satir[data-konu]").forEach(satir => satir.addEventListener("click", () => {
    const acik = satir.nextElementSibling && satir.nextElementSibling.classList.contains("tekrar-detay");
    $$("#tekrar-govde .tekrar-detay").forEach(d => d.remove());
    $$("#tekrar-govde .tekrar-satir.acik").forEach(s => s.classList.remove("acik"));
    if (acik) return;
    satir.classList.add("acik");
    satir.insertAdjacentHTML("afterend", tekrarKonuDetay(t, o.ogeler, satir.dataset.konu));
  }));
  $$("#tekrar-sure-secim .secenek").forEach(b =>
    b.addEventListener("click", () => tekrarSureAyarla(+b.dataset.dk)));
  $("#tekrar-sinav").addEventListener("change", e => tekrarSinavAyarla(e.target.value));
}

function tekrarSatiri(k, vurgu) {
  return `
    <div class="tekrar-satir tiklanir${vurgu ? " zayif" : ""}" data-konu="${guvenli(k.konu.id)}">
      <span class="ts-ikon">${guvenli(k.konu.ikon)}</span>
      <span class="ts-yazi">
        <span class="ts-ad">${guvenli(k.konu.ad)}</span>
        <span class="ts-cubuk"><span style="width:${k.yuzde}%;background:${guvenli(k.konu.renk)}"></span></span>
      </span>
      <span class="ts-sayi">${vurgu && k.oran != null ? `%${Math.round(100 * k.oran)} doğru` : `%${k.yuzde}`}<small>${k.ogrenilen}/${k.toplam} öğrenildi${k.yolda ? ` · ${k.yolda} yolda` : ""}</small></span>
    </div>`;
}

/* Konuya dokununca: o konudaki her soru, kaç kez doğru / yanlış bilindiği
   ve durumu. Önce en çok yanlış yapılanlar, hiç sorulmayanlar en sonda. */
function tekrarKonuDetay(t, ogeler, konuId) {
  const satirlar = [...ogeler.values()].filter(o => o.konu.id === konuId).map(o => {
    const d = (t.deneme || {})[o.anahtar] || [0, 0];
    const seri = t.ogrenildi[o.anahtar] || 0;
    return { metin: o.soru.metin, dogru: d[0], yanlis: d[1], seri };
  }).sort((a, b) => (b.yanlis - a.yanlis) || ((a.dogru + a.yanlis === 0) - (b.dogru + b.yanlis === 0))
                    || (a.seri - b.seri));
  const durumu = r => r.seri >= TEKRAR_BILME ? `<span class="td-rozet ogrenildi">öğrenildi</span>`
                    : r.seri > 0 ? `<span class="td-rozet yolda">yolda</span>`
                    : r.dogru + r.yanlis ? "" : `<span class="td-rozet yok">sorulmadı</span>`;
  return `<div class="tekrar-detay">${satirlar.map(r => `
      <div class="td-satir">
        <span class="td-metin">${guvenli(r.metin)}</span>
        ${durumu(r)}
        <span class="td-sayi"><b class="d">✓ ${r.dogru}</b><b class="y">✕ ${r.yanlis}</b></span>
      </div>`).join("")}</div>`;
}

/* ---------------- çalışma ---------------- */
let tekrarHaritaKonusu = null;
let tekrarSoruBasi = 0;

function tekrarBaslat() {
  const t = tekrarDurum();
  const ogeler = tekrarOgeler();
  const kuyruk = karistir(tekrarKalanlar(t).filter(a => ogeler.has(a)).map(a => ogeler.get(a)));
  if (!kuyruk.length) { bildir("Bugünkü tekrar tamam — yarın yeni sorular gelecek"); return; }

  durum.tekrarModu = true;
  durum.konu = kuyruk[0].konu;
  durum.sorular = kuyruk.map(x => Object.assign({}, x.soru, { _tekrarAnahtar: x.anahtar, _konuId: x.konu.id }));
  durum.siralama = null;
  durum.sonuclar = durum.sorular.map(() => null);
  durum.index = 0;
  durum.kalanIller = [];
  durum.kalanObjeler = [];
  durum.duraklatildi = false;
  durum.hayaletGecici = [];

  haritayiHazirla();
  tekrarHaritaKonusu = null;
  $("#ortu-duraklat").classList.add("gizli");
  $("#ortu-bitis").classList.add("gizli");
  ekranGoster("calisma");
  soruyuGoster();
  requestAnimationFrame(mobilDuzen);
  haritaZoomDurumuCiz();
}

/* Soru başka bir konuya aitse harita ve ayarlar o konuya göre kurulur */
function tekrarKonuyuHazirla(soru) {
  tekrarSoruBasi = performance.now();
  const konu = konuBul(soru._konuId);
  if (!konu) return;
  durum.konu = konu;
  if (tekrarHaritaKonusu === konu.id) return;
  tekrarHaritaKonusu = konu.id;
  calismaHarita.isimleriGoster(konu.ayar.ilIsimleri);
  calismaHarita.objeleriCiz(konu.objeler || []);
  $("#calisma-konu").textContent = "🔁 " + konu.ad;
}

/* Cevap: bugünkü listeden düşer, bilinemeyen ertesi günün başına gider.
   Süre ölçümü tahmini kendi kendine ayarlar. */
function tekrarSonucYaz(soru, basarili) {
  if (!soru || !soru._tekrarAnahtar) return;
  const t = tekrarDurum();
  const anahtar = soru._tekrarAnahtar;

  const olculen = (performance.now() - tekrarSoruBasi) / 1000;
  if (tekrarSoruBasi && olculen > 0.5) {
    const h = t.hiz || (t.hiz = { tahmin: 0, gercek: 0, n: 0 });
    const oge = tekrarOgeler().get(anahtar);
    if (oge) {
      h.tahmin += tekrarHamSure(oge);
      h.gercek += Math.min(olculen, 90);
      h.n++;
    }
  }

  /* Seri GÜN sayar: aynı gün ikinci kez doğru bilmek seriyi artırmaz,
     çünkü "öğrendim" demek için araya bir gecenin girmesi gerekir. */
  if (!t.sonGun) t.sonGun = {};
  const bugun = tekrarBugun();
  if (!basarili) t.ogrenildi[anahtar] = 0;
  else if (t.sonGun[anahtar] !== bugun) t.ogrenildi[anahtar] = Math.min(20, (t.ogrenildi[anahtar] || 0) + 1);
  t.sonGun[anahtar] = bugun;
  if (!t.deneme) t.deneme = {};
  const d = t.deneme[anahtar] || [0, 0];
  d[basarili ? 0 : 1]++;
  t.deneme[anahtar] = d;
  if (t.liste.includes(anahtar)) {
    if (!t.yapilan.includes(anahtar)) t.yapilan.push(anahtar);
    if (!basarili && !t.bilinemeyen.includes(anahtar)) t.bilinemeyen.push(anahtar);
  }
  ayarlariKaydet();
}

function tekrarBitis() {
  const t = tekrarDurum();
  const o = tekrarOzet(t);
  const s = sayilar(durum.sonuclar);

  $("#bitis-ozet").textContent =
    `${durum.sorular.length} soru: ${s.dogru} doğru, ${s.yanlis} yanlış, ${s.pas} pas. ` +
    (o.kalan ? `Bugün ${o.kalan} soru kaldı.` : "Bugünkü tekrar tamam — yarın devam.") +
    ` ${o.tur}. tur · öğrenilen ${o.ogrenilen}/${o.toplam}.`;
  const btn = $("#btn-bastan");
  btn.textContent = "Devam et →";
  btn.classList.toggle("gizli", !o.kalan);
  $("#ilerleme-dolu").style.width = "100%";
  $("#ortu-bitis").classList.remove("gizli");
  ses("bitis");
  titre("bitis");
}

function tekrarDevamEt() {
  $("#ortu-bitis").classList.add("gizli");
  tekrarBaslat();
}

function tekrarOlaylari() {
  $("#btn-tekrar-cik").addEventListener("click", () => anaEkranaGec());
}
