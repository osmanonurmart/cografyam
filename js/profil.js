/* ==========================================================
   Coğrafyam — profiller

   Şifre yok, Netflix mantığı: açılışta kim olduğunu seç, o cihaz seni
   hatırlasın. Konular, objeler ve sorular herkeste ORTAK; ilerleme,
   istatistik ve günlük tekrar KİŞİYE ÖZEL.

   Profil listesi `ayarlar.profiller` içinde durur, yani buluttan bütün
   cihazlara gider. Seçili profil ise `aktifProfil` anahtarında, YALNIZCA
   o cihazda kalır (bulut anahtarlarında yok) — böylece iki kişi iki
   cihazda aynı anda çalışabilir.
   ========================================================== */

const PROFIL_KARAKTERLER = ["👾", "🐙", "🦖", "🤖", "👻", "🐉", "🦊", "🎃",
                            "🦑", "🐸", "🦉", "🐺", "🦁", "🐳", "🦄", "🧛"];

const PROFIL_VARSAYILAN = [
  { id: "p-osman", ad: "Osman", avatar: "👾", renk: "#3b82f6" },
  { id: "p-fatma", ad: "Fatma", avatar: "🦊", renk: "#ec4899" }
];

function profilleriYukle() {
  const a = durum.ayarlar;
  if (!Array.isArray(a.profiller) || !a.profiller.length) {
    a.profiller = JSON.parse(JSON.stringify(PROFIL_VARSAYILAN));
    ayarlariKaydet();
  }
  durum.profiller = a.profiller;

  const kayitli = Depo.oku("aktifProfil", null);
  durum.aktifProfilId = durum.profiller.some(p => p.id === kayitli) ? kayitli : null;
}

/* Profiller eklenmeden önceki tek kullanıcılı kayıtlar silinmez, taşınmaz:
   ilk profil okurken onlara da bakar. Taşımak bulutla yarışa giriyordu —
   yazılan değeri buluttan gelen eski snapshot geri alıyordu. */
function eskiKayitlarBuProfilde() {
  return !!(durum.profiller[0] && durum.aktifProfilId === durum.profiller[0].id);
}

function profilKaydet() {
  durum.ayarlar.profiller = durum.profiller;
  ayarlariKaydet();
}

function profilSec(id) {
  if (!durum.profiller.some(p => p.id === id)) return;
  durum.aktifProfilId = id;
  Depo.yaz("aktifProfil", id);
  anaEkranaGec();
}

/* ---------------- seçim ekranı ---------------- */
function profilSecimAc() {
  profilSecimCiz();
  ekranGoster("profil-sec");
}

function profilSecimCiz() {
  const kap = $("#profil-listesi");
  kap.innerHTML = "";
  durum.profiller.forEach(p => {
    const el = document.createElement("div");
    el.className = "profil-kutu" + (p.id === durum.aktifProfilId ? " secili" : "");
    el.innerHTML = `
      <button class="profil-yuz" style="--p1:${guvenli(p.renk)};--p2:${karart(p.renk, 0.45)}"
              title="${guvenli(p.ad)} olarak devam et">${guvenli(p.avatar)}</button>
      <span class="profil-ad">${guvenli(p.ad)}</span>
      <button class="profil-kalem" title="Düzenle">✏️</button>`;
    $(".profil-yuz", el).addEventListener("click", () => profilSec(p.id));
    $(".profil-kalem", el).addEventListener("click", () => profilDuzenleAc(p));
    kap.appendChild(el);
  });

  const ekle = document.createElement("div");
  ekle.className = "profil-kutu";
  ekle.innerHTML = `
    <button class="profil-yuz ekle" title="Yeni profil">＋</button>
    <span class="profil-ad">Profil ekle</span>`;
  $(".profil-yuz", ekle).addEventListener("click", () => profilDuzenleAc(null));
  kap.appendChild(ekle);
}

/* ---------------- düzenleme kutusu ---------------- */
let profilDuzenlenen = null;

function profilDuzenleAc(profil) {
  profilDuzenlenen = profil;
  const yeni = !profil;
  $("#profil-duzen-baslik").textContent = yeni ? "Yeni profil" : "Profili düzenle";
  $("#profil-ad-alan").value = yeni ? "" : profil.ad;
  $("#btn-profil-sil").classList.toggle("gizli", yeni || durum.profiller.length < 2);

  const secili = { avatar: yeni ? PROFIL_KARAKTERLER[0] : profil.avatar,
                   renk: yeni ? RENKLER[durum.profiller.length % RENKLER.length] : profil.renk };
  const ciz = () => {
    const k = $("#profil-karakter-secim");
    k.innerHTML = "";
    PROFIL_KARAKTERLER.forEach(a => {
      const b = document.createElement("button");
      b.className = "sec-ogesi" + (secili.avatar === a ? " secili" : "");
      b.textContent = a;
      b.addEventListener("click", () => { secili.avatar = a; ciz(); });
      k.appendChild(b);
    });
    const r = $("#profil-renk-secim");
    r.innerHTML = "";
    RENKLER.forEach(x => {
      const b = document.createElement("button");
      b.className = "renk-nokta" + (secili.renk === x ? " secili" : "");
      b.style.background = x;
      b.addEventListener("click", () => { secili.renk = x; ciz(); });
      r.appendChild(b);
    });
  };
  ciz();
  $("#modal-profil").dataset.secim = "";
  $("#modal-profil").classList.remove("gizli");
  $("#modal-profil")._secili = secili;
  setTimeout(() => $("#profil-ad-alan").focus(), 60);
}

function profilDuzenKaydet() {
  const secili = $("#modal-profil")._secili;
  const ad = $("#profil-ad-alan").value.trim();
  if (!ad) { bildir("Bir ad yaz"); return; }

  if (profilDuzenlenen) {
    Object.assign(profilDuzenlenen, { ad, avatar: secili.avatar, renk: secili.renk });
  } else {
    const p = { id: "p" + yeniId(), ad, avatar: secili.avatar, renk: secili.renk };
    durum.profiller.push(p);
    profilDuzenlenen = p;
  }
  profilKaydet();
  $("#modal-profil").classList.add("gizli");
  profilSecimCiz();
  profilAvatariCiz();
  bildir(`"${ad}" kaydedildi`);
}

function profilSilme() {
  const p = profilDuzenlenen;
  if (!p) return;
  onay(`"${p.ad}" profili ve bu profile ait ilerleme, istatistik ve günlük tekrar kayıtları silinecek. Konular ve sorular silinmez.`,
       { baslik: "Profili sil", ikon: p.avatar, evet: "Profili sil" }).then(evet => {
    if (!evet) return;
    durum.profiller = durum.profiller.filter(x => x.id !== p.id);
    ["ilerleme", "gunluk"].forEach(anahtar => {
      const tum = Depo.oku(anahtar, {}) || {};
      if (tum[p.id]) { delete tum[p.id]; Depo.yaz(anahtar, tum); }
    });
    if (durum.ayarlar.tekrar && durum.ayarlar.tekrar[p.id]) delete durum.ayarlar.tekrar[p.id];
    profilKaydet();
    if (durum.aktifProfilId === p.id) { durum.aktifProfilId = null; Depo.yaz("aktifProfil", null); }
    $("#modal-profil").classList.add("gizli");
    profilSecimCiz();
    bildir("Profil silindi");
  });
}

/* ---------------- üst bardaki avatar ---------------- */
function profilAvatariCiz() {
  const b = $("#btn-profil");
  if (!b) return;
  const p = aktifProfil();
  b.textContent = p ? p.avatar : "👤";
  b.title = p ? `${p.ad} — profil değiştir` : "Profil seç";
  b.style.setProperty("--p1", p ? p.renk : "#64748b");
}

function profilOlaylari() {
  $("#btn-profil").addEventListener("click", profilSecimAc);
  $("#btn-profil-sec-cik").addEventListener("click", () => {
    if (durum.aktifProfilId) anaEkranaGec();
  });
  $("#btn-profil-kaydet").addEventListener("click", profilDuzenKaydet);
  $("#btn-profil-iptal").addEventListener("click", () => $("#modal-profil").classList.add("gizli"));
  $("#btn-profil-sil").addEventListener("click", profilSilme);
  $("#modal-profil").addEventListener("click", e => {
    if (e.target.id === "modal-profil") e.target.classList.add("gizli");
  });
}
