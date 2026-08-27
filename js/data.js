/* Coğrafyam — konu / obje / soru verisi (tohum)
   ------------------------------------------------------------------
   Bu dosya SADECE ilk açılışta okunur; sonrasında kütüphane
   localStorage'a (ileride Firebase'e) taşınır ve düzenleme
   ekranlarından yönetilir. Buradaki veriyi tekrar yüklemek için
   Ayarlar > "Konuları varsayılana döndür".

   OBJE = SORU. Haritaya konan her emoji aynı zamanda bir sorudur.
     emoji     : haritada görünecek işaret
     ad        : objenin adı (soru metni boşsa buradan üretilir)
     il        : doğru cevap (il adı)
     soruMetni : boş bırakılırsa "<ad> hangi ilimizdedir?" olur
     x, y      : SVG koordinatı. Boşsa ilin merkezine yerleşir,
                 aynı ilde birden fazla obje varsa otomatik dağıtılır
     boyut     : 1 = normal (0.5 - 3)
     aci       : derece, 0 = düz (dağları çapraz yatırmak için)

   KONU AYARI
     ilIsimleri  : haritada il adları yazsın mı
     objeGorunur : "bastan"  -> tüm objeler baştan görünür
                   "cevapta" -> cevaplanınca görünür (birikimli ayarına tabi)
     cevapBirimi : "il" | "bolge"
   ------------------------------------------------------------------ */

const BOLGELER = {
  "Marmara":            ["Balıkesir","Bilecik","Bursa","Çanakkale","Edirne","İstanbul","Kırklareli","Kocaeli","Sakarya","Tekirdağ","Yalova"],
  "Ege":                ["Afyonkarahisar","Aydın","Denizli","İzmir","Kütahya","Manisa","Muğla","Uşak"],
  "Akdeniz":            ["Adana","Antalya","Burdur","Hatay","Isparta","Kahramanmaraş","Mersin","Osmaniye"],
  "İç Anadolu":         ["Aksaray","Ankara","Çankırı","Eskişehir","Karaman","Kayseri","Kırıkkale","Kırşehir","Konya","Nevşehir","Niğde","Sivas","Yozgat"],
  "Karadeniz":          ["Amasya","Artvin","Bartın","Bayburt","Bolu","Çorum","Düzce","Giresun","Gümüşhane","Karabük","Kastamonu","Ordu","Rize","Samsun","Sinop","Tokat","Trabzon","Zonguldak"],
  "Doğu Anadolu":       ["Ağrı","Ardahan","Bingöl","Bitlis","Elazığ","Erzincan","Erzurum","Hakkari","Iğdır","Kars","Malatya","Muş","Tunceli","Van"],
  "Güneydoğu Anadolu":  ["Adıyaman","Batman","Diyarbakır","Gaziantep","Kilis","Mardin","Siirt","Şanlıurfa","Şırnak"]
};

const TOHUM_KONULAR = [
  {
    id: "iller",
    ad: "İller",
    ikon: "🗺️",
    renk: "#3b82f6",
    aciklama: "81 ilin haritadaki yeri",
    ayar: { ilIsimleri: false, objeGorunur: "cevapta", cevapBirimi: "il" },
    objeler: [],
    sorular: [
      { metin: "Adana ilini haritada göster",       hedef: ["Adana"] },
      { metin: "Edirne ilini haritada göster",      hedef: ["Edirne"] },
      { metin: "Van ilini haritada göster",         hedef: ["Van"] },
      { metin: "Muğla ilini haritada göster",       hedef: ["Muğla"] },
      { metin: "Sinop ilini haritada göster",       hedef: ["Sinop"] },
      { metin: "Konya ilini haritada göster",       hedef: ["Konya"] },
      { metin: "Hakkari ilini haritada göster",     hedef: ["Hakkari"] },
      { metin: "Çanakkale ilini haritada göster",   hedef: ["Çanakkale"] },
      { metin: "Kars ilini haritada göster",        hedef: ["Kars"] },
      { metin: "Isparta ilini haritada göster",     hedef: ["Isparta"] },
      { metin: "Şanlıurfa ilini haritada göster",   hedef: ["Şanlıurfa"] },
      { metin: "Rize ilini haritada göster",        hedef: ["Rize"] },
      { metin: "Nevşehir ilini haritada göster",    hedef: ["Nevşehir"] },
      { metin: "Bilecik ilini haritada göster",     hedef: ["Bilecik"] },
      { metin: "Iğdır ilini haritada göster",       hedef: ["Iğdır"] },
      { metin: "Tunceli ilini haritada göster",     hedef: ["Tunceli"] },
      { metin: "Kırklareli ilini haritada göster",  hedef: ["Kırklareli"] },
      { metin: "Karaman ilini haritada göster",     hedef: ["Karaman"] },
      { metin: "Bayburt ilini haritada göster",     hedef: ["Bayburt"] },
      { metin: "Osmaniye ilini haritada göster",    hedef: ["Osmaniye"] }
    ]
  },

  {
    id: "bolgeler",
    ad: "Coğrafi Bölgeler",
    ikon: "🧭",
    renk: "#8b5cf6",
    aciklama: "7 bölge — bölgeye tek tık",
    ayar: { ilIsimleri: false, objeGorunur: "cevapta", cevapBirimi: "bolge" },
    objeler: [],
    sorular: [
      { metin: "Marmara Bölgesi'ni haritada göster",           bolge: "Marmara" },
      { metin: "Ege Bölgesi'ni haritada göster",               bolge: "Ege" },
      { metin: "Akdeniz Bölgesi'ni haritada göster",           bolge: "Akdeniz" },
      { metin: "İç Anadolu Bölgesi'ni haritada göster",        bolge: "İç Anadolu" },
      { metin: "Karadeniz Bölgesi'ni haritada göster",         bolge: "Karadeniz" },
      { metin: "Doğu Anadolu Bölgesi'ni haritada göster",      bolge: "Doğu Anadolu" },
      { metin: "Güneydoğu Anadolu Bölgesi'ni haritada göster", bolge: "Güneydoğu Anadolu" }
    ]
  },

  {
    id: "madenler",
    ad: "Madenler",
    ikon: "⛏️",
    renk: "#f59e0b",
    aciklama: "Maden yatakları ve çıkarıldığı iller",
    ayar: { ilIsimleri: true, objeGorunur: "cevapta", cevapBirimi: "il" },
    sorular: [],
    objeler: [
      { emoji: "🧪", ad: "Bor yatakları",             il: "Eskişehir",      soruMetni: "" },
      { emoji: "🧪", ad: "Bor yatakları",             il: "Balıkesir",      soruMetni: "" },
      { emoji: "🧪", ad: "Bor yatakları",             il: "Kütahya",        soruMetni: "" },
      { emoji: "⚫", ad: "Taşkömürü havzası",         il: "Zonguldak",      soruMetni: "" },
      { emoji: "🟤", ad: "Linyit yatakları",          il: "Kahramanmaraş",  soruMetni: "" },
      { emoji: "🟤", ad: "Linyit yatakları",          il: "Manisa",         soruMetni: "" },
      { emoji: "🟤", ad: "Linyit yatakları",          il: "Kütahya",        soruMetni: "" },
      { emoji: "⚙️", ad: "Demir yatakları",           il: "Sivas",          soruMetni: "" },
      { emoji: "🔩", ad: "Krom yatakları",            il: "Elazığ",         soruMetni: "" },
      { emoji: "🟠", ad: "Bakır yatakları",           il: "Artvin",         soruMetni: "" },
      { emoji: "🟠", ad: "Bakır yatakları",           il: "Kastamonu",      soruMetni: "" },
      { emoji: "🛢️", ad: "Petrol sahaları",          il: "Batman",         soruMetni: "" },
      { emoji: "🔷", ad: "Boksit yatakları",          il: "Konya",          soruMetni: "" },
      { emoji: "🔴", ad: "Cıva yatakları",            il: "Konya",          soruMetni: "" },
      { emoji: "⬜", ad: "Mermer ocakları",           il: "Afyonkarahisar", soruMetni: "" }
    ]
  },

  {
    id: "ovalar",
    ad: "Ovalar",
    ikon: "🌾",
    renk: "#22c55e",
    aciklama: "Ovalar hangi ilde?",
    ayar: { ilIsimleri: true, objeGorunur: "cevapta", cevapBirimi: "il" },
    sorular: [],
    objeler: [
      { emoji: "🌾", ad: "Çukurova",        il: "Adana",    soruMetni: "" },
      { emoji: "🌾", ad: "Bafra Ovası",     il: "Samsun",   soruMetni: "" },
      { emoji: "🌾", ad: "Çarşamba Ovası",  il: "Samsun",   soruMetni: "" },
      { emoji: "🌾", ad: "Amik Ovası",      il: "Hatay",    soruMetni: "" },
      { emoji: "🌾", ad: "Muş Ovası",       il: "Muş",      soruMetni: "" },
      { emoji: "🌾", ad: "Iğdır Ovası",     il: "Iğdır",    soruMetni: "" },
      { emoji: "🌾", ad: "Söke Ovası",      il: "Aydın",    soruMetni: "" },
      { emoji: "🌾", ad: "Gediz Ovası",     il: "Manisa",   soruMetni: "" },
      { emoji: "🌾", ad: "Ergene Ovası",    il: "Tekirdağ", soruMetni: "" },
      { emoji: "🌾", ad: "Konya Ovası",     il: "Konya",    soruMetni: "" }
    ]
  },

  {
    id: "daglar",
    ad: "Dağlar",
    ikon: "⛰️",
    renk: "#ef4444",
    aciklama: "Dağlar ve zirveler",
    ayar: { ilIsimleri: true, objeGorunur: "bastan", cevapBirimi: "il" },
    sorular: [],
    objeler: [
      { emoji: "🌋", ad: "Ağrı Dağı",        il: "Ağrı",      boyut: 1.3, aci: 0,   soruMetni: "" },
      { emoji: "🌋", ad: "Erciyes Dağı",     il: "Kayseri",   boyut: 1.2, aci: 0,   soruMetni: "" },
      { emoji: "⛰️", ad: "Uludağ",           il: "Bursa",     boyut: 1,   aci: 0,   soruMetni: "" },
      { emoji: "🏔️", ad: "Kaçkar Dağları",  il: "Rize",      boyut: 1.2, aci: -25, soruMetni: "" },
      { emoji: "⛰️", ad: "Nemrut Dağı",      il: "Adıyaman",  boyut: 1,   aci: 0,   soruMetni: "" },
      { emoji: "🌋", ad: "Süphan Dağı",      il: "Bitlis",    boyut: 1.1, aci: 0,   soruMetni: "" },
      { emoji: "🌋", ad: "Hasandağı",        il: "Aksaray",   boyut: 1,   aci: 0,   soruMetni: "" },
      { emoji: "🏔️", ad: "Ilgaz Dağları",   il: "Kastamonu", boyut: 1.1, aci: -12, soruMetni: "" },
      { emoji: "🏔️", ad: "Cilo Dağları",    il: "Hakkari",   boyut: 1.2, aci: 15,  soruMetni: "" },
      { emoji: "⛰️", ad: "Palandöken Dağı",  il: "Erzurum",   boyut: 1,   aci: 0,   soruMetni: "" }
    ]
  },

  {
    id: "goller",
    ad: "Göller",
    ikon: "💧",
    renk: "#0ea5e9",
    aciklama: "Göller hangi ilde?",
    ayar: { ilIsimleri: true, objeGorunur: "cevapta", cevapBirimi: "il" },
    sorular: [],
    objeler: [
      { emoji: "💧", ad: "Van Gölü",        il: "Van",     soruMetni: "" },
      { emoji: "💧", ad: "Tuz Gölü",        il: "Aksaray", soruMetni: "" },
      { emoji: "💧", ad: "Beyşehir Gölü",   il: "Konya",   soruMetni: "" },
      { emoji: "💧", ad: "Eğirdir Gölü",    il: "Isparta", soruMetni: "" },
      { emoji: "💧", ad: "İznik Gölü",      il: "Bursa",   soruMetni: "" },
      { emoji: "💧", ad: "Sapanca Gölü",    il: "Sakarya", soruMetni: "" },
      { emoji: "💧", ad: "Manyas Gölü",     il: "Balıkesir", soruMetni: "" },
      { emoji: "💧", ad: "Hazar Gölü",      il: "Elazığ",  soruMetni: "" }
    ]
  }
];
