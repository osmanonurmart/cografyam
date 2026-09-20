/* ==========================================================
   Coğrafyam — Günlük Tekrar

   Bütün konulardaki soruları hedef tarihe kadar tekrar ettirir.
   Bir soru "öğrenildi" sayılmak için İKİ KEZ ÜST ÜSTE doğru bilinmeli;
   aynı soru aynı gün ikinci kez sorulmaz, böylece ikinci doğru başka
   bir güne düşer ve bilgi kalıcı olur.

   Öğrenilen soru havuzdan çıkmaz, SEYRELİR: TEKRAR_HATIRLATMA gün
   sonra hatırlatma olarak bir kez gelir. Yine doğruysa süre yeniden
   başlar, yanlışsa soru öğrenme havuzuna geri döner.

   Günlük kota = kalan iş / kalan gün. Kalan iş, öğrenilmemiş soruların
   eksik doğru sayısının toplamıdır. Kota günün ilk açılışında sabitlenir.

   Durum KİŞİYE ÖZEL: ayarlar.tekrar[profilId] içinde durur.
     { hedef, gun, kota, cozulen, kartlar: { "<konuId>::<soru>": {d, g} } }
   ========================================================== */

const TEKRAR_HEDEF = "2026-10-01";     // ilk dönemin bitişi
const TEKRAR_DONEM_GUN = 14;           // hedef geçince yeni dönem uzunluğu
const TEKRAR_BILME = 2;                // kaç kez üst üste doğru = öğrenildi
const TEKRAR_HATIRLATMA = 5;           // öğrenilen soru kaç gün sonra hatırlatılsın

function tekrarBugun() { return new Date().toLocaleDateString("sv"); }

function tekrarGunFarki(a, b) {
  return Math.round((new Date(b + "T00:00") - new Date(a + "T00:00")) / 86400000);
}

function tekrarGunEkle(gun, adet) {
  const t = new Date(gun + "T00:00");
  t.setDate(t.getDate() + adet);
  return t.toLocaleDateString("sv");
}

/* Aktif profilin durumu; dönem bittiyse yeni dönem, yeni günde yeni kota */
function tekrarDurum() {
  const a = durum.ayarlar;
  if (!a.tekrar) a.tekrar = {};
  if (a.tekrar.kartlar) {                                      // profiller öncesi biçim
    const ilk = durum.profiller[0] && durum.profiller[0].id;
    a.tekrar = ilk ? { [ilk]: a.tekrar } : {};
  }
  const kimlik = durum.aktifProfilId || ORTAK_KIMLIK;
  const t = a.tekrar[kimlik] = Object.assign(
    { hedef: TEKRAR_HEDEF, gun: "", kota: 0, cozulen: 0, kartlar: {} }, a.tekrar[kimlik] || {});
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

function tekrarOgrenildiMi(kart) { return kart.d >= TEKRAR_BILME; }

/* Öğrenilen soru hatırlatma zamanı geldi mi? */
function tekrarHatirlatmaMi(kart, bugun) {
  return tekrarOgrenildiMi(kart) && kart.g && tekrarGunFarki(kart.g, bugun) >= TEKRAR_HATIRLATMA;
}

function tekrarKotaHesapla(t) {
  const havuz = tekrarHavuzu(t);
  const kalanIs = havuz.reduce((top, x) => top + Math.max(0, TEKRAR_BILME - x.kart.d), 0);
  const kalanGun = Math.max(1, tekrarGunFarki(tekrarBugun(), t.hedef) + 1);
  return Math.max(kalanIs ? 1 : 0, Math.min(kalanIs, Math.ceil(kalanIs / kalanGun)));
}

/* Öncelik: yanlış/pas > hiç sorulmamış > bir kez doğru > hatırlatma.
   Aynı gün sorulmuş soru gelmez. */
function tekrarSecim(t, adet) {
  if (adet <= 0) return [];
  const bugun = tekrarBugun();
  const gruplar = [[], [], [], []];
  tekrarHavuzu(t).forEach(x => {
    if (x.kart.g === bugun) return;
    if (tekrarOgrenildiMi(x.kart)) {
      if (tekrarHatirlatmaMi(x.kart, bugun)) gruplar[3].push(x);
      return;
    }
    gruplar[x.kart.g ? (x.kart.d === 0 ? 0 : 2) : 1].push(x);
  });
  gruplar.forEach(g => {
    for (let i = g.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [g[i], g[j]] = [g[j], g[i]];
    }
  });
  /* kotanın bir kısmı hatırlatmalara ayrılır; yoksa öğrenilenler hiç
     gelmezdi (öğrenilmemiş soru bitene kadar sıra onlara gelmiyordu) */
  const hatirlatma = gruplar[3];
  const pay = Math.min(hatirlatma.length, Math.max(1, Math.round(adet * 0.2)));
  const yeniler = [].concat(gruplar[0], gruplar[1], gruplar[2]).slice(0, adet - pay);
  const secilen = yeniler.concat(hatirlatma.slice(0, adet - yeniler.length));
  /* konu konu gidilsin: harita daha az değişsin */
  const sira = new Map(durum.kutuphane.map((k, i) => [k.id, i]));
  secilen.sort((a, b) => sira.get(a.konu.id) - sira.get(b.konu.id));
  return secilen;
}

function tekrarKalanBugun(t) { return Math.max(0, (t.kota || 0) - (t.cozulen || 0)); }

/* Konu başına öğrenme tablosu — durum ekranı ve zayıf konular için */
function tekrarKonuOzeti(t) {
  const bugun = tekrarBugun();
  const konular = new Map();
  tekrarHavuzu(t).forEach(x => {
    const k = konular.get(x.konu.id) ||
      { konu: x.konu, toplam: 0, ogrenilen: 0, baslanan: 0, hatirlatma: 0 };
    k.toplam++;
    if (tekrarOgrenildiMi(x.kart)) k.ogrenilen++;
    else if (x.kart.d > 0) k.baslanan++;
    if (tekrarHatirlatmaMi(x.kart, bugun)) k.hatirlatma++;
    konular.set(x.konu.id, k);
  });
  return [...konular.values()].map(k =>
    Object.assign(k, { yuzde: k.toplam ? Math.round(100 * k.ogrenilen / k.toplam) : 0 }));
}

/* ---------------- ana ekran kartı (konu kutuları gibi) ---------------- */
function tekrarKarti() {
  const t = tekrarDurum();
  const havuz = tekrarHavuzu(t);
  if (!havuz.length) return null;

  const kalan = tekrarKalanBugun(t);
  const ogrenilen = havuz.filter(x => tekrarOgrenildiMi(x.kart)).length;
  const yuzde = Math.round(100 * ogrenilen / havuz.length);

  const cevre = 2 * Math.PI * 13;
  const kutu = document.createElement("div");
  kutu.className = "konu-kutu tekrar-kutu" + (kalan ? "" : " bitti");
  kutu.style.setProperty("--k1", "#0ea5e9");
  kutu.style.setProperty("--k2", karart("#0ea5e9", 0.45));
  kutu.innerHTML = `
    <div class="k-emoji">${kalan ? "🔁" : "✅"}</div>
    <div class="k-ad">Günlük Tekrar</div>
    <div class="k-eylem">
      <button class="k-durum" title="${kalan ? `Bugün ${kalan} soru` : "Bugünlük tamam"}">
        <svg class="k-halka" viewBox="0 0 32 32" aria-hidden="true">
          <circle class="halka-zemin" cx="16" cy="16" r="13"></circle>
          <circle class="halka-dolu" cx="16" cy="16" r="13"
                  stroke-dasharray="${(yuzde / 100) * cevre} ${cevre}"></circle>
        </svg>
        <span class="k-simge">${kalan ? kalan : "✓"}</span>
      </button>
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
  const havuz = tekrarHavuzu(t);
  const ogrenilen = havuz.filter(x => tekrarOgrenildiMi(x.kart)).length;
  const baslanan = havuz.filter(x => !tekrarOgrenildiMi(x.kart) && x.kart.d > 0).length;
  const yuzde = havuz.length ? Math.round(100 * ogrenilen / havuz.length) : 0;
  const kalan = tekrarKalanBugun(t);
  const kalanGun = Math.max(0, tekrarGunFarki(tekrarBugun(), t.hedef));
  const hedefYazi = new Date(t.hedef + "T00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  const konular = tekrarKonuOzeti(t).sort((a, b) => a.yuzde - b.yuzde || b.toplam - a.toplam);
  const zayif = konular.filter(k => k.yuzde < 100).slice(0, 3);
  const p = aktifProfil();

  $("#tekrar-govde").innerHTML = `
    <div class="tekrar-ust">
      <div class="tekrar-halka" style="--y:${yuzde}">
        <span>%${yuzde}</span>
      </div>
      <div class="tekrar-ozet">
        <div class="tekrar-baslik">${p ? guvenli(p.avatar + " " + p.ad) : "Günlük Tekrar"}</div>
        <div class="tekrar-alt">${ogrenilen}/${havuz.length} soru öğrenildi · ${baslanan} soru yolda</div>
        <div class="tekrar-alt">${hedefYazi}'e ${kalanGun} gün · bugün ${t.cozulen || 0}/${t.kota || 0} soru</div>
      </div>
    </div>

    <button class="ana-btn tam" id="btn-tekrar-basla">
      ${kalan ? `Bugünü çalış — ${kalan} soru` : "Fazladan çalış"}
    </button>

    ${zayif.length ? `
      <h2 class="bolum-baslik">En zayıf konular</h2>
      <div class="tekrar-liste">
        ${zayif.map(k => tekrarSatiri(k, true)).join("")}
      </div>` : ""}

    <h2 class="bolum-baslik">Tüm konular</h2>
    <div class="tekrar-liste">
      ${konular.map(k => tekrarSatiri(k, false)).join("")}
    </div>`;

  $("#btn-tekrar-basla").addEventListener("click", () => tekrarBaslat(tekrarKalanBugun(t) === 0));
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
function tekrarBaslat(devam) {
  const t = tekrarDurum();
  const kalan = tekrarKalanBugun(t);
  const adet = devam ? Math.max(5, t.kota || 10) : kalan;
  if (!adet) { bildir("Bugünkü tekrar tamam — yarın yeni sorular gelecek"); return; }

  const secilen = tekrarSecim(t, adet);
  if (!secilen.length) {
    bildir("Bugün sorulabilecek soru kalmadı — yarın devam");
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

  haritayiHazirla();
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

/* Cevap sonucu: doğru bilinen sayaç ilerler, yanlış/pas sıfırlar.
   Öğrenilmiş soru hatırlatmada doğruysa sayaç aynı kalır, süresi uzar. */
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
  const ogrenilen = havuz.filter(x => tekrarOgrenildiMi(x.kart)).length;
  const baskaVar = tekrarSecim(t, 1).length > 0;

  $("#bitis-ozet").textContent =
    `${durum.sorular.length} soru: ${s.dogru} doğru, ${s.yanlis} yanlış, ${s.pas} pas. ` +
    (kalan ? `Bugün ${kalan} soru kaldı.` : "Bugünkü tekrar tamam.") +
    ` Öğrenilen: ${ogrenilen}/${havuz.length}.`;
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

function tekrarOlaylari() {
  $("#btn-tekrar-cik").addEventListener("click", () => anaEkranaGec());
}
