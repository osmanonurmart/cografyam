/* ==========================================================
   Coğrafyam — Günlük Tekrar (tur mantığı)

   Sınav gününe kadar bütün soruları tekrar tekrar dolaştırır:
   sabit bir sırada ilerleyen bir imleç vardır; her gün, seçtiğin süre
   dolana kadar sıradan soru alınır; bilinemeyenler ertesi günün başına
   yazılır. Gün içinde liste DEĞİŞMEZ — "bugün kaç kaldı" oynamasın.

   İki kez üst üste doğru bilinen soru öğrenilmiş sayılır ve sonraki
   turlarda atlanır; yanlış bilinirse sayaç sıfırlanır ve geri döner.

   Durum kişiye özeldir: ayarlar.tekrar[profilId]
     { sinav, dakika, sira[], pos, tur, gun, liste[], yapilan[],
       bilinemeyen[], borc[], borcSayisi, gunBasi{pos,tur,borc},
       ogrenildi{anahtar:0-2}, hiz{tahmin,gercek,n} }

   Mantığın tam anlatımı: "Günlük görev (sınav planı) — taşınabilir mantık".
   ========================================================== */

const TEKRAR_SINAV = "2026-10-01";
const TEKRAR_DAKIKALAR = [15, 30, 45, 60, 90, 120];
const TEKRAR_BILME = 2;              // kaç kez üst üste doğru = öğrenildi
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

  const ogeler = tekrarOgeler();
  tekrarSirayiGuncelle(t, ogeler);

  const bugun = tekrarBugun();
  if (t.gun !== bugun) tekrarYeniGun(t, ogeler);
  return t;
}

function tekrarOgrenildiMi(t, anahtar) { return (t.ogrenildi[anahtar] || 0) >= TEKRAR_BILME; }

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
  let kullanilan = 0, borctan = 0, yeniTur = false;
  let pos = bas.pos, tur = bas.tur;
  const borc = bas.borc.filter(a => ogeler.has(a));

  const al = anahtar => {
    if (eklenen.has(anahtar)) return;
    eklenen.add(anahtar);
    liste.push(anahtar);
    kullanilan += tekrarSure(ogeler.get(anahtar), katsayi);
  };

  while (borc.length && (!liste.length || kullanilan < butce)) { al(borc.shift()); borctan++; }

  for (let güvenlik = 0; güvenlik < t.sira.length; güvenlik++) {
    if (liste.length && kullanilan >= butce) break;
    if (pos >= t.sira.length) { pos = 0; tur++; yeniTur = true; }
    const anahtar = t.sira[pos++];
    if (!tekrarOgrenildiMi(t, anahtar)) al(anahtar);      // öğrenilenler turda atlanır
  }

  /* her yeni turda sıra yeniden karışsın — aynı diziliş tekrar etmesin */
  if (yeniTur) t.karisik = false;
  t.liste = liste;
  t.borc = borc;
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
    const k = konular.get(oge.konu.id) || { konu: oge.konu, toplam: 0, ogrenilen: 0 };
    k.toplam++;
    if (tekrarOgrenildiMi(t, oge.anahtar)) k.ogrenilen++;
    konular.set(oge.konu.id, k);
  });
  return [...konular.values()].map(k =>
    Object.assign(k, { yuzde: k.toplam ? Math.round(100 * k.ogrenilen / k.toplam) : 0 }));
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
  const zayif = konular.filter(k => k.yuzde < 100).slice(0, 3);
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
    <p class="tekrar-tahmin"><b>${o.ogrenilen}/${o.toplam}</b> soru öğrenildi
      <span class="ince">İki kez üst üste doğru bilinen soru sonraki turlarda atlanır; yanlış bilirsen geri döner.</span></p>

    ${zayif.length ? `
      <h2 class="bolum-baslik">En zayıf konular</h2>
      <div class="tekrar-liste">${zayif.map(k => tekrarSatiri(k, true)).join("")}</div>` : ""}

    <h2 class="bolum-baslik">Tüm konular</h2>
    <div class="tekrar-liste">${konular.map(k => tekrarSatiri(k, false)).join("")}</div>`;

  const basla = $("#btn-tekrar-basla");
  if (basla) basla.addEventListener("click", () => tekrarBaslat());
  $$("#tekrar-sure-secim .secenek").forEach(b =>
    b.addEventListener("click", () => tekrarSureAyarla(+b.dataset.dk)));
  $("#tekrar-sinav").addEventListener("change", e => tekrarSinavAyarla(e.target.value));
}

function tekrarSatiri(k, vurgu) {
  return `
    <div class="tekrar-satir${vurgu ? " zayif" : ""}">
      <span class="ts-ikon">${guvenli(k.konu.ikon)}</span>
      <span class="ts-yazi">
        <span class="ts-ad">${guvenli(k.konu.ad)}</span>
        <span class="ts-cubuk"><span style="width:${k.yuzde}%;background:${guvenli(k.konu.renk)}"></span></span>
      </span>
      <span class="ts-sayi">%${k.yuzde}<small>${k.ogrenilen}/${k.toplam}</small></span>
    </div>`;
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

  t.ogrenildi[anahtar] = basarili ? Math.min(TEKRAR_BILME, (t.ogrenildi[anahtar] || 0) + 1) : 0;
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
