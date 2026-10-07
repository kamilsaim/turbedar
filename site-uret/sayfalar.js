/* Sayfa üreticileri. Her fonksiyon tam bir HTML belgesi (string) döndürür.
 * Girdi modeli:
 *   yer   = veri.js'ten gelen kayıt + { slug, bolge }
 *   bolge = { ad, slug, yurtdisi, yerler[], ulke? }  (TR'de il, yurt dışında ülke) */

const {
  SITE, PLAY_URL, kacir, kisalt, konumYazisi, kategoriAdi, ozet, fotoUrl, sayiYaz, yurtdisiMi,
} = require('./yardimci');
const { bas, son, gezinti, playRozeti, VARSAYILAN_GORSEL } = require('./sablon');

const yerYolu = y => `/yer/${y.slug}/`;
const bolgeYolu = b => `/turbeler/${b.slug}/`;
const uygulamaLinki = y => `${SITE}/#yer=${y.id}`;
const yolTarifi = y => `https://www.google.com/maps/dir/?api=1&destination=${y.lat},${y.lng}`;

/* Türkçe bulunma eki: Kayseri'de, İstanbul'da, Sivas'ta, Bağdat'ta */
function bulunmaEki(ad){
  const kucuk = String(ad).toLocaleLowerCase('tr');
  const unluler = kucuk.match(/[aeıioöuü]/g) ?? ['e'];
  const kalin = 'aıou'.includes(unluler[unluler.length - 1]);
  const sert = 'çfhkpsşt'.includes(kucuk.slice(-1));
  return `${ad}'${sert ? 't' : 'd'}${kalin ? 'a' : 'e'}`;
}

/* Türkçe bildirme eki: türbedir, kümbettir, mezardır, şehitliktir, ziyaret yeridir */
function bildirmeEki(kelime){
  const kucuk = String(kelime).toLocaleLowerCase('tr');
  const unluler = kucuk.match(/[aeıioöuü]/g) ?? ['e'];
  const unlu = { a: 'ı', ı: 'ı', e: 'i', i: 'i', o: 'u', u: 'u', ö: 'ü', ü: 'ü' }[unluler.at(-1)];
  const sert = 'çfhkpsşt'.includes(kucuk.slice(-1));
  return `${kelime}${sert ? 't' : 'd'}${unlu}r`;
}

/* Kategori sayımından doğal dil: "40 türbe, 16 mezar ve 3 kümbet" */
function kategoriOzeti(yerler){
  const sayac = {};
  for (const y of yerler) sayac[kategoriAdi(y)] = (sayac[kategoriAdi(y)] ?? 0) + 1;
  const parcalar = Object.entries(sayac).sort((a, b) => b[1] - a[1])
    .map(([ad, n]) => `${n} ${ad.toLocaleLowerCase('tr')}`);
  return parcalar.length > 1 ? `${parcalar.slice(0, -1).join(', ')} ve ${parcalar.at(-1)}` : parcalar[0] ?? '';
}

function kisiSatiri(k){
  const ek = [k.unvan, k.vefat ? `vefat: ${k.vefat}` : ''].filter(Boolean).join(' · ');
  return `<li><b>${kacir(k.ad)}</b>${ek ? `<span>${kacir(ek)}</span>` : ''}</li>`;
}

function kart(y){
  const kapak = y.fotograflar[0];
  const gorsel = kapak
    ? `<img class="kapak" src="${kacir(fotoUrl(kapak.yol))}" alt="${kacir(y.baslik)}" loading="lazy" width="400" height="300">`
    : `<div class="kapak-yok" aria-hidden="true">❖</div>`;
  const kisiler = y.kisiler.slice(0, 3).map(k => k.ad).filter(Boolean).join(', ');
  const alt = y.aciklama ? kisalt(y.aciklama, 120) : kisiler ? `Mekan sahipleri: ${kisiler}` : konumYazisi(y);
  return `<li class="kart"><a class="kart-bag" href="${yerYolu(y)}">${gorsel}<div class="ic">
<div class="meta">${kacir(kategoriAdi(y))}${y.ilce && !yurtdisiMi(y) ? ` · ${kacir(y.ilce)}` : ''}</div>
<h3>${kacir(y.baslik)}</h3><p>${kacir(alt)}</p></div></a></li>`;
}

/* Kayıt için kendiliğinden giriş cümlesi — açıklaması boş kayıtlarda da
 * sayfanın anlamlı metni olsun diye her zaman yazılır. */
function girisCumlesi(y){
  const yer = yurtdisiMi(y)
    ? [y.il, y.ulke].filter(Boolean).join(', ')
    : [y.ilce, y.il].filter(Boolean).join(', ');
  const kat = y.kategori === 'diger' ? 'ziyaret yeri' : kategoriAdi(y).toLocaleLowerCase('tr');
  let s = `${y.baslik}, ${yer ? `${yer} konumunda bulunan ` : ''}bir ${bildirmeEki(kat)}.`;
  const adlar = y.kisiler.map(k => k.ad).filter(Boolean);
  if (adlar.length === 1) s += ` Burada ${adlar[0]} medfundur.`;
  else if (adlar.length > 1) s += ` Burada ${adlar.slice(0, -1).join(', ')} ve ${adlar.at(-1)} medfundur.`;
  return s;
}

/* ---------- Kayıt sayfası ---------- */
function yerSayfasi(y, tumBolgeler){
  const b = y.bolge;
  const yerYazi = yurtdisiMi(y) ? [y.il, y.ulke].filter(Boolean).join(', ') : [y.ilce, y.il].filter(Boolean).join(', ');
  const baslik = `${y.baslik}${yerYazi ? ` – ${yerYazi}` : ''} | Türbedar`;
  const gorseller = y.fotograflar.map(f => fotoUrl(f.yol));
  const adimlar = [
    { ad: 'Türbeler', yol: '/turbeler/' },
    { ad: b.ad, yol: bolgeYolu(b) },
    { ad: y.baslik, yol: yerYolu(y) },
  ];
  const gz = gezinti(adimlar);

  const ld = {
    '@context': 'https://schema.org',
    '@type': ['TouristAttraction', 'LandmarksOrHistoricalBuildings'],
    name: y.baslik,
    description: y.aciklama ? kisalt(y.aciklama, 300) : girisCumlesi(y),
    url: SITE + yerYolu(y),
    ...(gorseller.length ? { image: gorseller } : {}),
    ...(y.lat != null && y.lng != null ? { geo: { '@type': 'GeoCoordinates', latitude: y.lat, longitude: y.lng } } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(y.ilce && !yurtdisiMi(y) ? { addressLocality: y.ilce } : {}),
      ...(y.il ? { addressRegion: y.il } : {}),
      addressCountry: String(y.ulke_kodu || 'tr').toUpperCase(),
    },
    isAccessibleForFree: true,
    publicAccess: true,
    ...(y.lat != null ? { hasMap: `https://www.google.com/maps?q=${y.lat},${y.lng}` } : {}),
  };

  const galeri = gorseller.length ? `<div class="galeri">
<img src="${kacir(gorseller[0])}" alt="${kacir(y.baslik)}" width="800" height="600" fetchpriority="high">
${gorseller.length > 1 ? `<div class="kucukler">${gorseller.slice(1).map((g, i) =>
  `<a href="${kacir(g)}"><img src="${kacir(g)}" alt="${kacir(`${y.baslik} fotoğraf ${i + 2}`)}" loading="lazy" width="200" height="200"></a>`).join('')}</div>` : ''}
</div>` : '';

  const kisiler = y.kisiler.filter(k => k.ad);
  const kaynaklar = y.kaynaklar.length ? `<h2>Kaynaklar</h2><ol class="kaynaklar">${y.kaynaklar.map(k =>
    /^https?:\/\//i.test(k.url ?? '')
      ? `<li><a href="${kacir(k.url)}" rel="nofollow noopener" target="_blank">${kacir(k.baslik || k.url)}</a></li>`
      : `<li>${kacir(k.baslik)}</li>`).join('')}</ol>` : '';

  const komsular = b.yerler.filter(d => d.id !== y.id)
    .sort((a, c) => (a.ilce === y.ilce ? 0 : 1) - (c.ilce === y.ilce ? 0 : 1) || a.baslik.localeCompare(c.baslik, 'tr'))
    .slice(0, 6);

  return bas({
    baslik, aciklama: ozet(y, 140), yol: yerYolu(y), tur: 'article',
    gorsel: gorseller[0] ?? VARSAYILAN_GORSEL, ld: [ld, gz.ld],
  }) + `<main class="kap">
${gz.html}
<div class="yer-ust">
  <div>
    <span class="etiket">${kacir(kategoriAdi(y))}</span>
    <h1>${kacir(y.baslik)}</h1>
    <p class="konum-satir">📍 ${kacir(konumYazisi(y) || 'Konum bilgisi yok')}</p>
    <p class="oncul">${kacir(girisCumlesi(y))}</p>
    <div class="btn-grup">
      <a class="btn btn-ana" href="${kacir(uygulamaLinki(y))}">Türbedar'da Aç</a>
      ${y.lat != null ? `<a class="btn btn-ince" href="${kacir(yolTarifi(y))}" rel="noopener">Yol Tarifi Al</a>` : ''}
    </div>
  </div>
  ${galeri}
</div>
${kisiler.length ? `<h2>Mekan Sahipleri</h2><ul class="kisiler">${kisiler.map(kisiSatiri).join('')}</ul>` : ''}
${y.aciklama ? `<h2>${kacir(y.baslik)} Hakkında</h2><div class="metin">${kacir(String(y.aciklama).trim())}</div>` : ''}
${kaynaklar}
<h2>Konum Bilgileri</h2>
<div class="bilgi-kutu"><dl>
  <dt>Tür</dt><dd>${kacir(kategoriAdi(y))}</dd>
  ${yurtdisiMi(y) ? `<dt>Ülke</dt><dd>${kacir(y.ulke ?? '')}</dd><dt>Şehir</dt><dd>${kacir(y.il ?? '')}</dd>` : `
  <dt>İl</dt><dd><a href="${bolgeYolu(b)}">${kacir(y.il ?? '')}</a></dd>
  ${y.ilce ? `<dt>İlçe</dt><dd>${kacir(y.ilce)}</dd>` : ''}
  ${y.mahalle ? `<dt>Mahalle / Köy</dt><dd>${kacir(y.mahalle)}</dd>` : ''}`}
  ${y.lat != null ? `<dt>Koordinat</dt><dd>${y.lat.toFixed(5)}, ${y.lng.toFixed(5)}</dd>` : ''}
</dl></div>
${komsular.length ? `<h2>${kacir(bulunmaEki(b.ad))} Diğer Ziyaret Yerleri</h2><ul class="kartlar">${komsular.map(kart).join('')}</ul>
<p style="margin-top:14px"><a href="${bolgeYolu(b)}">${kacir(b.ad)} türbelerinin tümünü gör (${b.yerler.length}) →</a></p>` : ''}
${cagri()}
</main>` + son();
}

function cagri(){
  return `<section class="cagri">
<h2>Türbedar'ı Telefonuna Kur</h2>
<p>Haritada yakınındaki türbeleri bul, ziyaret ettiklerini işaretle, bildiğin yerleri ekle. Ücretsiz ve reklamsız.</p>
<div class="btn-grup">${playRozeti()}<a class="btn btn-ana" href="/">Tarayıcıda Aç</a></div>
<p style="font-size:13px;margin:0">iPhone: Safari ile turbedar.web.app'i aç → Paylaş → Ana Ekrana Ekle</p>
</section>`;
}

/* ---------- İl / ülke sayfası ---------- */
function bolgeSayfasi(b, tumBolgeler){
  const n = b.yerler.length;
  const baslik = `${b.ad} Türbeleri ve Mezarları (${n} Kayıt) | Türbedar`;
  const gz = gezinti([{ ad: 'Türbeler', yol: '/turbeler/' }, { ad: b.ad, yol: bolgeYolu(b) }]);

  // TR'de ilçeye, yurt dışında şehre göre grupla
  const gruplar = new Map();
  for (const y of b.yerler){
    const anahtar = (b.yurtdisi ? y.il : y.ilce) || 'Diğer';
    if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
    gruplar.get(anahtar).push(y);
  }
  // Grup içinde fotoğraflılar önce (boş kartlar sayfanın başını kaplamasın), sonra alfabetik
  for (const liste of gruplar.values()) liste.sort((a, c) =>
    (c.fotograflar.length ? 1 : 0) - (a.fotograflar.length ? 1 : 0) || a.baslik.localeCompare(c.baslik, 'tr'));
  const sirali = [...gruplar.entries()].sort((a, c) => c[1].length - a[1].length || a[0].localeCompare(c[0], 'tr'));
  const grupAdlari = sirali.map(g => g[0]).filter(a => a !== 'Diğer');

  const kisiSayisi = b.yerler.reduce((t, y) => t + y.kisiler.filter(k => k.ad).length, 0);
  const one = b.yerler.slice().sort((a, c) => c.kisiler.length - a.kisiler.length || (c.aciklama ? 1 : 0) - (a.aciklama ? 1 : 0))
    .slice(0, 5).map(y => y.baslik);

  const aciklama = `${bulunmaEki(b.ad)} bulunan ${n} türbe, kümbet ve mezar: ${kisalt(one.join(', '), 120)}. Konum, fotoğraf, mekan sahipleri ve yol tarifi.`;
  const giris = `${bulunmaEki(b.ad)} Türbedar'a kayıtlı <b>${n}</b> ziyaret yeri bulunuyor: ${kacir(kategoriOzeti(b.yerler))}.`
    + (kisiSayisi ? ` Bu mekanlarda kayıtlı ${kisiSayisi} kişi medfundur.` : '')
    + (grupAdlari.length > 1 ? ` Kayıtlar ${b.yurtdisi ? 'şehirlere' : 'ilçelere'} göre gruplanmıştır: ${kacir(grupAdlari.slice(0, 8).join(', '))}${grupAdlari.length > 8 ? ' ve diğerleri' : ''}.` : '');

  const ld = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: `${b.ad} Türbeleri ve Mezarları`,
    numberOfItems: n,
    itemListElement: b.yerler.map((y, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + yerYolu(y), name: y.baslik })),
  };

  const digerleri = tumBolgeler.filter(d => d !== b && d.yurtdisi === b.yurtdisi).slice(0, 24);

  return bas({ baslik, aciklama, yol: bolgeYolu(b), ld: [ld, gz.ld],
    gorsel: b.yerler.find(y => y.fotograflar.length) ? fotoUrl(b.yerler.find(y => y.fotograflar.length).fotograflar[0].yol) : VARSAYILAN_GORSEL,
  }) + `<main class="kap">
${gz.html}
<h1>${kacir(b.ad)} Türbeleri ve Mezarları</h1>
<p class="oncul">${giris}</p>
<div class="btn-grup"><a class="btn btn-ana" href="/">Haritada Gör</a>${playRozeti('Uygulamayı İndir')}</div>
${sirali.map(([ad, yerler]) => `<h2>${kacir(ad === 'Diğer' ? 'Diğer Kayıtlar' : `${ad} (${yerler.length})`)}</h2>
<ul class="kartlar">${yerler.map(kart).join('')}</ul>`).join('\n')}
${digerleri.length ? `<h2>${b.yurtdisi ? 'Diğer Ülkeler' : 'Diğer İllerin Türbeleri'}</h2>
<ul class="bolgeler">${digerleri.map(bolgeLi).join('')}</ul>
<p style="margin-top:12px"><a href="/turbeler/">Tüm il ve ülkeler →</a></p>` : ''}
${cagri()}
</main>` + son();
}

const bolgeLi = b => `<li><a href="${bolgeYolu(b)}">${kacir(b.ad)} <small>${b.yerler.length}</small></a></li>`;

/* ---------- Hub: tüm iller ve ülkeler ---------- */
function hubSayfasi(bolgeler, yerler){
  const tr = bolgeler.filter(b => !b.yurtdisi).sort((a, c) => a.ad.localeCompare(c.ad, 'tr'));
  const dis = bolgeler.filter(b => b.yurtdisi).sort((a, c) => a.ad.localeCompare(c.ad, 'tr'));
  const trSayi = tr.reduce((t, b) => t + b.yerler.length, 0);
  const gz = gezinti([{ ad: 'Türbeler', yol: '/turbeler/' }]);
  const son6 = yerler.slice().sort((a, c) => String(c.created_at).localeCompare(String(a.created_at))).slice(0, 6);

  const ld = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'Türkiye ve Dünyadaki Türbeler, Kümbetler ve Mezarlar',
    url: `${SITE}/turbeler/`,
    hasPart: bolgeler.map(b => ({ '@type': 'WebPage', name: `${b.ad} Türbeleri`, url: SITE + bolgeYolu(b) })),
  };

  return bas({
    baslik: 'Türbeler ve Mezarlar – İl İl Türbe Listesi | Türbedar',
    aciklama: `Türkiye'nin ${tr.length} ilinde ${trSayi} ve yurt dışında ${yerler.length - trSayi} türbe, kümbet ve mezar. İl il türbe listesi, konumlar, fotoğraflar ve mekan sahipleri.`,
    yol: '/turbeler/', ld: [ld, gz.ld],
  }) + `<main class="kap">
${gz.html}
<h1>İl İl Türbeler ve Mezarlar</h1>
<p class="oncul">Türbedar'da şu an <b>${sayiYaz(yerler.length)}</b> onaylı kayıt var: ${kacir(kategoriOzeti(yerler))}. Bir il seç, oradaki türbeleri, kümbetleri ve mezarları fotoğraf, konum ve mekan sahipleriyle birlikte gör.</p>
<h2>Türkiye (${tr.length} il)</h2>
<ul class="bolgeler">${tr.map(bolgeLi).join('')}</ul>
${dis.length ? `<h2>Yurt Dışı (${dis.length} ülke)</h2><ul class="bolgeler">${dis.map(bolgeLi).join('')}</ul>` : ''}
<h2>Son Eklenenler</h2>
<ul class="kartlar">${son6.map(kart).join('')}</ul>
<p style="margin-top:16px;color:var(--soluk)">Aradığın türbe listede yok mu? Uygulamayı açıp fotoğrafı ve konumuyla ekleyebilirsin; yönetici onayından sonra herkes görür.</p>
${cagri()}
</main>` + son();
}

/* ---------- Tanıtım sayfası ---------- */
const SSS = [
  ['Türbedar nedir?', 'Türbedar; türbe, kümbet, makam ve mezarların gönüllüler tarafından oluşturulan ortak envanteridir. Her kayıt fotoğrafı, harita konumu, mekan sahipleri ve kaynaklarıyla birlikte tutulur; uygulamayı kullanan herkes haritada bu yerleri bulabilir ve ziyaret edebilir.'],
  ['Türbedar ücretli mi?', 'Hayır. Türbedar tamamen ücretsizdir; reklam ve analitik takip içermez.'],
  ['Hesap açmadan kullanabilir miyim?', 'Evet. Haritayı, kayıtları ve fotoğrafları görmek için giriş yapmanız gerekmez. Yer eklemek, ziyaret işaretlemek ve yorum yazmak için Google ya da Apple hesabıyla tek dokunuşla giriş yapılır.'],
  ['Nasıl türbe eklerim?', 'Uygulamada “Ekle” düğmesine dokunun: önce fotoğrafları seçin (fotoğrafın konum bilgisi varsa pin otomatik yerleşir), sonra haritada konumu doğrulayın, en son adı, türü ve mekan sahiplerini yazın. Kayıt yönetici onayından sonra herkese görünür.'],
  ['iPhone\'da Türbedar\'ı nasıl kullanırım?', 'iPhone ve iPad\'de Safari ile turbedar.web.app adresini açın, alttaki Paylaş simgesine dokunup “Ana Ekrana Ekle”yi seçin. Türbedar bir uygulama gibi ana ekranınıza yerleşir ve bildirim alabilir.'],
  ['Yakınımdaki türbeleri nasıl bulurum?', 'Harita ekranındaki “yakınımdaki yerler” düğmesi konumunuza en yakın türbeleri mesafeleriyle listeler. Uydu görünümüyle yerin çevresini de görebilirsiniz.'],
  ['Bilgiler ne kadar güvenilir?', 'Her yeni kayıt ve her düzenleme önerisi yayına girmeden önce yöneticiler tarafından incelenir. Kayıtlarda kaynak bağlantıları gösterilir; hatalı bir bilgi gördüğünüzde uygulama içinden düzeltme önerebilirsiniz.'],
];

function tanitimSayfasi(yerler, bolgeler, bilgiler){
  const trBolge = bolgeler.filter(b => !b.yurtdisi).length;
  const ulkeSayisi = bolgeler.filter(b => b.yurtdisi).length + (trBolge ? 1 : 0);
  const kisiSayisi = yerler.reduce((t, y) => t + y.kisiler.filter(k => k.ad).length, 0);
  const fotoSayisi = yerler.reduce((t, y) => t + y.fotograflar.length, 0);
  const onde = bolgeler.slice().sort((a, c) => c.yerler.length - a.yerler.length).slice(0, 12);

  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'MobileApplication',
      name: 'Türbedar', alternateName: 'Türbedar – Türbe ve Mezar Haritası',
      operatingSystem: 'Android, iOS (PWA), Web',
      applicationCategory: 'TravelApplication',
      inLanguage: 'tr',
      url: `${SITE}/turbedar-nedir/`,
      downloadUrl: PLAY_URL, installUrl: PLAY_URL,
      image: `${SITE}/icon-512.webp`,
      description: 'Türbe, kümbet ve mezarların harita üzerinde ortak envanteri. Yakınındaki türbeleri bul, ziyaretini işaretle, bildiğin yerleri ekle.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'TRY' },
    },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Türbedar', url: `${SITE}/`, inLanguage: 'tr' },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: SSS.map(([s, c]) => ({ '@type': 'Question', name: s, acceptedAnswer: { '@type': 'Answer', text: c } })),
    },
  ];

  return bas({
    baslik: 'Türbedar – Türbe, Kümbet ve Mezar Haritası | Türbe Ziyaret Uygulaması',
    aciklama: `Türkiye ve dünyadaki ${yerler.length}+ türbe, kümbet ve mezar tek haritada. Yakınındaki türbeleri bul, il il türbe listesine bak, ziyaretini işaretle. Ücretsiz Android uygulaması ve web.`,
    yol: '/turbedar-nedir/', ld,
  }) + `<main class="kap">
<section class="kahraman">
  <img class="amblem" src="/icon-512.webp" alt="Türbedar amblemi" width="120" height="120">
  <div class="slogan">EMANET • HİZMET • SADAKAT</div>
  <h1>Türbedar: Türbe, Kümbet ve Mezar Haritası</h1>
  <p class="oncul">Evliyânın, âlimlerin, sultanların ve şehitlerin kabirlerini tek haritada bir araya getiren ücretsiz bir uygulama. Yakınındaki türbeleri bul, ziyaretini işaretle, bildiğin yerleri herkesle paylaş.</p>
  <div class="btn-grup">${playRozeti()}<a class="btn btn-ana" href="/">Haritayı Aç</a></div>
</section>

<div class="sayaclar">
  <div class="sayac"><b>${sayiYaz(yerler.length)}</b><span>onaylı kayıt</span></div>
  <div class="sayac"><b>${trBolge}</b><span>il</span></div>
  <div class="sayac"><b>${ulkeSayisi}</b><span>ülke</span></div>
  <div class="sayac"><b>${sayiYaz(kisiSayisi)}</b><span>mekan sahibi</span></div>
  <div class="sayac"><b>${sayiYaz(fotoSayisi)}</b><span>fotoğraf</span></div>
</div>

<div class="sus" aria-hidden="true"><span>❖</span></div>

<h2>Türbedar Nedir?</h2>
<p>Türbedar, Türkiye'deki ve dünyadaki önemli şahsiyetlerin <b>türbe, kümbet, makam ve mezarlarının</b> gönüllüler tarafından oluşturulan ortak envanteridir. Her kayıt; fotoğrafları, harita konumu, orada medfun olan kişiler (mekan sahipleri), vefat tarihleri, açıklama ve kaynaklarıyla birlikte tutulur.</p>
<p>Amacımız, şehirlerin içinde ya da köy yollarında unutulmaya yüz tutmuş kabirleri kayıt altına almak, ziyaretçilere doğru bilgiyle ulaştırmak ve bu emaneti gelecek nesillere aktarmaktır. Türbedar'da her yeni kayıt ve her düzenleme yöneticiler tarafından incelendikten sonra yayına girer.</p>

<h2>Nasıl Çalışır?</h2>
<div class="izgara">
  <div class="kutu"><span class="no">1</span><h3>Keşfet</h3><p>Haritada ya da il il listede türbeleri gör. “Yakınımdaki yerler” ile sana en yakın türbeleri mesafeleriyle bul, yol tarifi al.</p></div>
  <div class="kutu"><span class="no">2</span><h3>Ziyaret Et</h3><p>Ziyaret ettiğin yerleri işaretle; kendi ziyaret listen ve istatistiklerin oluşsun. Ziyaret âdâbını ve yerin hikâyesini önceden oku.</p></div>
  <div class="kutu"><span class="no">3</span><h3>Katkı Ver</h3><p>Bildiğin bir türbeyi fotoğrafı ve konumuyla ekle, eksik bilgileri tamamla, kaynak öner. Onaylanan katkıların herkesin hizmetine girer.</p></div>
</div>

<h2>Özellikler</h2>
<div class="izgara">
  <div class="kutu"><h3>🗺️ Harita ve Uydu Görünümü</h3><p>Kubbe biçimli pinlerle tüm kayıtlar haritada; uydu görüntüsüyle yerin çevresini gör.</p></div>
  <div class="kutu"><h3>📍 Yakınımdaki Türbeler</h3><p>Konumuna en yakın on türbe, mesafesiyle birlikte tek dokunuşla listelenir.</p></div>
  <div class="kutu"><h3>🔎 Arama ve Keşfet</h3><p>Türbe adıyla, mekan sahibinin adıyla ya da il, ilçe ve mahalleye göre ara ve süz.</p></div>
  <div class="kutu"><h3>📷 Fotoğraf Galerisi</h3><p>Her yerin fotoğrafları, konum bilgisi fotoğraftan otomatik okunarak eklenir.</p></div>
  <div class="kutu"><h3>✅ Ziyaret İşareti</h3><p>Ziyaret ettiklerini işaretle, kilometre taşlarını kutla, topluluk sıralamasında yerini gör.</p></div>
  <div class="kutu"><h3>🔔 Bildirimler</h3><p>Eklediğin kayıt onaylandığında ya da kaydına yorum geldiğinde haberin olsun.</p></div>
</div>

<h2>İllere Göre Türbeler</h2>
<ul class="bolgeler">${onde.map(bolgeLi).join('')}</ul>
<p style="margin-top:12px"><a href="/turbeler/">Tüm il ve ülkelerin listesi →</a></p>

${bilgiler.length ? `<h2>Türbe Ziyareti Hakkında Bilinmesi Gerekenler</h2>
${bilgiler.map(b => `<details class="sss"><summary>${kacir(b.baslik)}</summary><p class="metin">${kacir(String(b.icerik ?? '').trim())}</p></details>`).join('\n')}` : ''}

<h2>Türbedar'ı Nasıl Kurarım?</h2>
<div class="izgara">
  <div class="kutu"><h3>Android</h3><p>Google Play Store'dan “Türbedar” uygulamasını ücretsiz indir.</p><div class="btn-grup" style="margin-bottom:0">${playRozeti('Google Play')}</div></div>
  <div class="kutu"><h3>iPhone ve iPad</h3><p>Safari ile <b>turbedar.web.app</b> adresini aç, Paylaş simgesine dokun ve “Ana Ekrana Ekle”yi seç.</p></div>
  <div class="kutu"><h3>Bilgisayar</h3><p>Herhangi bir tarayıcıdan <a href="/">turbedar.web.app</a> adresine gir; kurulum gerekmez.</p></div>
</div>

<h2>Sıkça Sorulan Sorular</h2>
${SSS.map(([s, c]) => `<details class="sss"><summary>${kacir(s)}</summary><p>${kacir(c)}</p></details>`).join('\n')}

${cagri()}
</main>` + son();
}

/* ---------- Paylaşım kartı (y/<id>.html) ----------
 * WhatsApp/X botları için kayda özel OG kartı; insan ziyaretçi anında uygulamaya
 * yönlendirilir. canonical SEO sayfasını gösterir — Google asıl sayfa olarak onu sayar. */
function kartSayfasi(y){
  const gorsel = y.fotograflar.length ? fotoUrl(y.fotograflar[0].yol) : VARSAYILAN_GORSEL;
  const aciklama = ozet(y);
  const hedef = uygulamaLinki(y);
  const seo = SITE + yerYolu(y);
  const tur = gorsel.toLowerCase().endsWith('.webp') ? 'image/webp' : gorsel.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${kacir(y.baslik)} — Türbedar</title>
<meta name="description" content="${kacir(aciklama)}">
<link rel="canonical" href="${kacir(seo)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Türbedar">
<meta property="og:locale" content="tr_TR">
<meta property="og:title" content="${kacir(y.baslik)}">
<meta property="og:description" content="${kacir(aciklama)}">
<meta property="og:image" content="${kacir(gorsel)}">
<meta property="og:image:secure_url" content="${kacir(gorsel)}">
<meta property="og:image:type" content="${tur}">
<meta property="og:image:alt" content="${kacir(y.baslik)}">
<meta property="og:url" content="${kacir(seo)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${kacir(y.baslik)}">
<meta name="twitter:description" content="${kacir(aciklama)}">
<meta name="twitter:image" content="${kacir(gorsel)}">
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#F7F0E6;color:#1E4D38;font-family:Georgia,'Times New Roman',serif;
       text-align:center;padding:24px}
  h1{font-size:22px;font-weight:600;margin:0 0 6px}
  p{font-size:14px;color:#233129;margin:6px 0}
  a{color:#B8923E}
</style>
</head>
<body>
<div>
  <h1>${kacir(y.baslik)}</h1>
  <p>Türbedar açılıyor…</p>
  <p style="font-size:13px"><a href="${kacir(hedef)}">Açılmazsa buraya dokun</a></p>
</div>
<script>location.replace(${JSON.stringify(hedef).replace(/</g, '\\u003c')});</script>
</body>
</html>
`;
}

/* ---------- Sürüm notları (kaynak: README > Sürüm Geçmişi) ---------- */
function surumNotlariSayfasi(surumler){
  const gz = gezinti([{ ad: 'Hakkında', yol: '/turbedar-nedir/' }, { ad: 'Sürüm Notları', yol: '/surum-notlari/' }]);
  const satir = s => `<li id="v${kacir(s.surum)}"><b>${kacir(s.surum)}</b><span>${kacir(s.metin)}</span></li>`;
  const yeni = surumler.filter(s => !s.eski);
  const eski = surumler.filter(s => s.eski);
  return bas({
    baslik: 'Sürüm Notları | Türbedar',
    aciklama: `Türbedar uygulamasının sürüm geçmişi: son sürüm ${surumler[0].surum} ve önceki sürümlerle gelen yenilikler.`,
    yol: '/surum-notlari/', ld: [gz.ld],
  }) + `<main class="kap">
${gz.html}
<h1>Sürüm Notları</h1>
<p class="oncul">Türbedar'a gelen yenilikler, en yeniden eskiye. Güncel sürüm: <b>${kacir(surumler[0].surum)}</b>. Uygulama web üzerinden güncellendiği için yeni sürüm telefonuna kendiliğinden gelir.</p>
<ul class="surumler">${yeni.map(satir).join('')}</ul>
${eski.length ? `<details class="surum-eski"><summary>Daha eski sürümler (${kacir(eski.at(-1).surum)} – ${kacir(eski[0].surum)})</summary><ul class="surumler">${eski.map(satir).join('')}</ul></details>` : ''}
${cagri()}
</main>` + son();
}

/* ---------- sitemap.xml + robots.txt ---------- */
const xml = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function sitemap(yerler, bolgeler){
  const tarih = d => String(d ?? '').slice(0, 10);
  const enYeni = liste => liste.map(y => tarih(y.updated_at)).sort().at(-1) ?? tarih(new Date().toISOString());
  const genel = enYeni(yerler);
  const url = (yol, lastmod, ek = '') => `<url><loc>${xml(SITE + yol)}</loc><lastmod>${lastmod}</lastmod>${ek}</url>`;
  const satirlar = [
    url('/', genel),
    url('/turbedar-nedir/', genel),
    url('/turbeler/', genel),
    url('/surum-notlari/', genel),
    ...bolgeler.map(b => url(bolgeYolu(b), enYeni(b.yerler))),
    ...yerler.map(y => url(yerYolu(y), tarih(y.updated_at),
      y.fotograflar.map(f => `<image:image><image:loc>${xml(fotoUrl(f.yol))}</image:loc></image:image>`).join(''))),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${satirlar.join('\n')}
</urlset>
`;
}

const robots = () => `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;

module.exports = {
  yerSayfasi, bolgeSayfasi, hubSayfasi, tanitimSayfasi, kartSayfasi, surumNotlariSayfasi, sitemap, robots,
  yerYolu, bolgeYolu, bulunmaEki, bildirmeEki,
};
