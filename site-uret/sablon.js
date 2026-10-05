/* Ortak sayfa iskeleti: <head> (title/description/canonical/OG/JSON-LD),
 * üst başlık ve alt bilgi. Sayfalar JavaScript içermez. */

const { SITE, PLAY_URL, kacir, jsonLd } = require('./yardimci');

const VARSAYILAN_GORSEL = `${SITE}/og-kart.png`;

const gorselTuru = u => {
  const s = u.toLowerCase();
  if (s.endsWith('.webp')) return 'image/webp';
  if (s.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
};

function bas({ baslik, aciklama, yol, gorsel = VARSAYILAN_GORSEL, tur = 'website', ld = [], ekHead = '' }){
  const url = SITE + yol;
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${kacir(baslik)}</title>
<meta name="description" content="${kacir(aciklama)}">
<link rel="canonical" href="${kacir(url)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#1E4D38">
<link rel="icon" href="/icon-192.webp" type="image/webp">
<link rel="apple-touch-icon" href="/icon-192.webp">
<meta property="og:type" content="${tur}">
<meta property="og:site_name" content="Türbedar">
<meta property="og:locale" content="tr_TR">
<meta property="og:title" content="${kacir(baslik)}">
<meta property="og:description" content="${kacir(aciklama)}">
<meta property="og:url" content="${kacir(url)}">
<meta property="og:image" content="${kacir(gorsel)}">
<meta property="og:image:type" content="${gorselTuru(gorsel)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${kacir(baslik)}">
<meta name="twitter:description" content="${kacir(aciklama)}">
<meta name="twitter:image" content="${kacir(gorsel)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/seo.css">
${ekHead}${ld.map(jsonLd).join('\n')}
</head>
<body>
<header class="ust">
  <div class="kap ust-ic">
    <a class="marka" href="/turbedar-nedir/"><img src="/icon-192.webp" alt="Türbedar logosu" width="36" height="36"><span>Türbedar</span></a>
    <nav>
      <a href="/turbeler/">Türbeler</a>
      <a href="/turbedar-nedir/">Hakkında</a>
      <a class="nav-btn" href="/">Haritayı Aç</a>
    </nav>
  </div>
</header>
`;
}

function son(){
  return `
<footer class="alt">
  <div class="kap">
    <div class="sus" aria-hidden="true"><span>❖</span></div>
    <p class="alt-slogan">Emanet • Hizmet • Sadakat</p>
    <p class="alt-baglanti">
      <a href="/">Haritayı aç</a> ·
      <a href="/turbeler/">Tüm türbeler</a> ·
      <a href="/turbedar-nedir/">Türbedar nedir?</a> ·
      <a href="${PLAY_URL}" rel="noopener">Google Play</a> ·
      <a href="/gizlilik-politikasi.html">Gizlilik</a>
    </p>
    <p class="alt-not">Türbedar, türbe, kümbet ve mezarların gönüllülerce oluşturulan ortak envanteridir. Bilgiler kullanıcı katkısıyla eklenir ve yöneticiler tarafından onaylanır.</p>
  </div>
</footer>
</body>
</html>
`;
}

/* Breadcrumb hem görünür gezinti hem BreadcrumbList JSON-LD üretir.
 * adimlar: [{ad, yol}] — son adımın yolu sayfanın kendisi. */
function gezinti(adimlar){
  const html = `<nav class="gezinti" aria-label="Gezinti">${adimlar.map((a, i) =>
    i === adimlar.length - 1 ? `<span>${kacir(a.ad)}</span>` : `<a href="${kacir(a.yol)}">${kacir(a.ad)}</a>`
  ).join('<i>›</i>')}</nav>`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: adimlar.map((a, i) => ({ '@type': 'ListItem', position: i + 1, name: a.ad, item: SITE + a.yol })),
  };
  return { html, ld };
}

const playRozeti = (metin = 'Google Play\'den İndir') =>
  `<a class="btn btn-play" href="${PLAY_URL}" rel="noopener"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3.6 1.8 13.5 12l-9.9 10.2c-.4-.2-.6-.6-.6-1.1V2.9c0-.5.2-.9.6-1.1Zm11.3 11.6 2.6 2.6-11.3 6.4 8.7-9Zm3.9-3.9 2.8 1.6c.8.5.8 1.3 0 1.8l-2.8 1.6-2.9-2.5 2.9-2.5ZM6.2 1.6l11.3 6.4-2.6 2.6-8.7-9Z"/></svg>${kacir(metin)}</a>`;

module.exports = { bas, son, gezinti, playRozeti, VARSAYILAN_GORSEL };
