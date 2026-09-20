/* ==========================================================
   Coğrafyam — Günlük Tekrar

   Bütün konulardaki soruları hedef tarihe kadar tekrar ettirir.
   Bir soru "bilindi" sayılmak için İKİ KEZ ÜST ÜSTE doğru bilinmeli;
   aynı soru aynı gün ikinci kez sorulmaz, böylece ikinci doğru başka
   bir güne düşer ve bilgi kalıcı olur.

   Günlük kota = kalan iş / kalan gün. Kalan iş, her sorunun eksik
   doğru sayısının toplamıdır. Kota günün ilk açılışında sabitlenir;
   gün içinde konu eklensen bile kota oynamaz, ertesi gün yeniden
   hesaplanır.

   Durum `ayarlar.tekrar` içinde tutulur (buluta ayarlarla birlikte gider):
     { hedef: "2026-10-01", gun: "2026-09-20", kota: 40, cozulen: 12,
       kartlar: { "<konuId>::<soru metni>": { d: 0-2, g: "2026-09-20" } } }
   ========================================================== */

const TEKRAR_HEDEF = "2026-10-01";     // ilk dönemin bitişi
const TEKRAR_DONEM_GUN = 14;           // hedef geçince yeni dönem uzunluğu
const TEKRAR_BILME = 2;                // kaç kez üst üste doğru = bilindi

function tekrarBugun() { return new Date().toLocaleDateString("sv"); }

function tekrarGunFarki(a, b) {
  return Math.round((new Date(b + "T00:00") - new Date(a + "T00:00")) / 86400000);
}

function tekrarGunEkle(gun, adet) {
  const t = new Date(gun + "T00:00");
  t.setDate(t.getDate() + adet);
  return t.toLocaleDateString("sv");
}

/* Durumu okur; dönem bittiyse yeni dönem başlatır, yeni günde kotayı kurar */
function tekrarDurum() {
  const a = durum.ayarlar;
  const t = a.tekrar = Object.assign({ hedef: TEKRAR_HEDEF, gun: "", kota: 0, cozulen: 0, kartlar: {} }, a.tekrar || {});
  if (!t.kartlar || typeof t.kartlar !== "object") t.kartlar = {};
  const bugun = tekrarBugun();

  if (tekrarGunFarki(t.hedef, bugun) > 0) {        // dönem doldu: yenisi başlasın
    t.hedef = tekrarGunEkle(bugun, TEKRAR_DONEM_GUN);
    t.kartlar = {};
    t.gun = "";
  }
  if (t.gun !== bugun) {                            // yeni gün: kotayı sabitle
    t.gun = bugun;
    t.cozulen = 0;
    t.kota = tekrarKotaHesapla(t);
    ayarlariKaydet();
  }
  return t;
}

function tekrarAnahtar(konu, soru) { return konu.id + "::" + soru.metin; }

/* Bütün konuların soruları + her sorunun tekrar durumu */
function tekrarHavuzu(t) {
  const liste = [];
  durum.kutuphane.forEach(konu => {
    sorulariUret(konu).forEach(soru => {
      const anahtar = tekrarAnahtar(konu, soru);
      liste.push({ konu, soru, anahtar, kart: t.kartlar[anahtar] || { d: 0, g: "" } });
    });
  });
  return liste;
}

function tekrarKotaHesapla(t) {
  const havuz = tekrarHavuzu(t);
  const kalanIs = havuz.reduce((top, x) => top + Math.max(0, TEKRAR_BILME - x.kart.d), 0);
  const kalanGun = Math.max(1, tekrarGunFarki(tekrarBugun(), t.hedef) + 1);
  return Math.min(kalanIs, Math.ceil(kalanIs / kalanGun));
}

/* Öncelik: önce yanlış/pas geçtiklerin, sonra hiç sorulmamışlar,
   en son bir kez doğru bildiklerin (ikinci tur). Aynı gün sorulan gelmez. */
function tekrarSecim(t, adet) {
  if (adet <= 0) return [];
  const bugun = tekrarBugun();
  const gruplar = [[], [], []];
  tekrarHavuzu(t).forEach(x => {
    if (x.kart.d >= TEKRAR_BILME || x.kart.g === bugun) return;
    gruplar[x.kart.g ? (x.kart.d === 0 ? 0 : 2) : 1].push(x);
  });
  gruplar.forEach(g => {
    for (let i = g.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [g[i], g[j]] = [g[j], g[i]];
    }
  });
  const secilen = [...gruplar[0], ...gruplar[1], ...gruplar[2]].slice(0, adet);
  /* konu konu gidilsin: harita daha az değişsin */
  const sira = new Map(durum.kutuphane.map((k, i) => [k.id, i]));
  secilen.sort((a, b) => sira.get(a.konu.id) - sira.get(b.konu.id));
  return secilen;
}

function tekrarKalanBugun(t) { return Math.max(0, (t.kota || 0) - (t.cozulen || 0)); }

/* ---------------- ana ekran kartı ---------------- */
function tekrarKarti() {
  const t = tekrarDurum();
  const havuz = tekrarHavuzu(t);
  if (!havuz.length) return null;

  const kalan = tekrarKalanBugun(t);
  const bilinen = havuz.filter(x => x.kart.d >= TEKRAR_BILME).length;
  const kalanGun = Math.max(0, tekrarGunFarki(tekrarBugun(), t.hedef));
  const yuzde = t.kota ? Math.min(100, Math.round(100 * (t.cozulen || 0) / t.kota)) : 100;
  const hedefYazi = new Date(t.hedef + "T00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long" });

  const el = document.createElement("button");
  el.className = "tekrar-kart" + (kalan ? "" : " bitti");
  el.innerHTML = `
    <span class="tk-ikon">${kalan ? "🔁" : "✅"}</span>
    <span class="tk-yazi">
      <span class="tk-ad">Günlük Tekrar</span>
      <span class="tk-alt">${kalan
        ? `bugün ${kalan} soru kaldı · ${t.cozulen || 0}/${t.kota}`
        : `bugünlük tamam · ${t.cozulen || 0} soru`} · ${hedefYazi}'e ${kalanGun} gün</span>
      <span class="tk-cubuk"><span style="width:${yuzde}%"></span></span>
      <span class="tk-alt ince">${bilinen}/${havuz.length} soru öğrenildi</span>
    </span>`;
  el.addEventListener("click", () => tekrarBaslat(false));
  return el;
}

/* ---------------- çalışma ---------------- */
function tekrarBaslat(devam) {
  const t = tekrarDurum();
  const kalan = tekrarKalanBugun(t);
  const adet = devam ? Math.max(5, t.kota || 10) : kalan;
  if (!adet) { bildir("Bugünkü tekrar tamam — yarın yeni sorular gelecek"); return; }

  const secilen = tekrarSecim(t, adet);
  if (!secilen.length) {
    bildir(devam ? "Bugün sorulabilecek soru kalmadı — yarın devam" : "Bugünkü tekrar tamam");
    return;
  }

  durum.tekrarModu = true;
  durum.konu = secilen[0].konu;
  durum.sorular = secilen.map(x => Object.assign({}, x.soru, { _tekrarAnahtar: x.anahtar, _konuId: x.konu.id }));
  durum.siralama = null;
  durum.sonuclar = durum.sorular.map(() => null);
  durum.index = 0;
  durum.kalanIller = [];
  durum.kalanObjeler = [];
  durum.duraklatildi = false;
  durum.hayaletGecici = [];

  const h = haritayiHazirla();
  tekrarHaritaKonusu = null;
  $("#ortu-duraklat").classList.add("gizli");
  $("#ortu-bitis").classList.add("gizli");
  ekranGoster("calisma");
  soruyuGoster();
  requestAnimationFrame(mobilDuzen);
  haritaZoomDurumuCiz();
}

let tekrarHaritaKonusu = null;

/* Soru başka bir konuya aitse harita ve ayarlar o konuya göre kurulur */
function tekrarKonuyuHazirla(soru) {
  const konu = konuBul(soru._konuId);
  if (!konu) return;
  durum.konu = konu;
  if (tekrarHaritaKonusu === konu.id) return;
  tekrarHaritaKonusu = konu.id;
  /* il sınırları ve boyama soruyuGoster içinde konunun ayarına göre kurulur */
  calismaHarita.isimleriGoster(konu.ayar.ilIsimleri);
  calismaHarita.objeleriCiz(konu.objeler || []);
  $("#calisma-konu").textContent = "🔁 " + konu.ad;
}

/* Cevap sonucu: doğru bilinen sayaç ilerler, yanlış/pas sıfırlar */
function tekrarSonucYaz(soru, basarili) {
  if (!soru || !soru._tekrarAnahtar) return;
  const t = tekrarDurum();
  const kart = t.kartlar[soru._tekrarAnahtar] || { d: 0, g: "" };
  kart.d = basarili ? Math.min(TEKRAR_BILME, kart.d + 1) : 0;
  kart.g = tekrarBugun();
  t.kartlar[soru._tekrarAnahtar] = kart;
  t.cozulen = (t.cozulen || 0) + 1;
  ayarlariKaydet();
}

function tekrarBitis() {
  const t = tekrarDurum();
  const s = sayilar(durum.sonuclar);
  const kalan = tekrarKalanBugun(t);
  const havuz = tekrarHavuzu(t);
  const bilinen = havuz.filter(x => x.kart.d >= TEKRAR_BILME).length;
  const baskaVar = tekrarSecim(t, 1).length > 0;

  $("#bitis-ozet").textContent =
    `${durum.sorular.length} soru: ${s.dogru} doğru, ${s.yanlis} yanlış, ${s.pas} pas. ` +
    (kalan ? `Bugün ${kalan} soru kaldı.` : "Bugünkü tekrar tamam.") +
    ` Öğrenilen: ${bilinen}/${havuz.length}.`;
  const btn = $("#btn-bastan");
  btn.textContent = kalan ? "Devam et →" : "Fazladan çalış →";
  btn.classList.toggle("gizli", !baskaVar);
  $("#ilerleme-dolu").style.width = "100%";
  $("#ortu-bitis").classList.remove("gizli");
  ses("bitis");
  titre("bitis");
}

/* Bitiş ekranındaki düğme: günün kalanı ya da fazladan çalışma */
function tekrarDevamEt() {
  const t = tekrarDurum();
  $("#ortu-bitis").classList.add("gizli");
  tekrarBaslat(tekrarKalanBugun(t) === 0);
}
