#!/usr/bin/env node
/* Türbedar — SEO sitesi + paylaşım kartları üreticisi (eski kart-uret.js'in yerini alır)
 *
 * KULLANIM:  node site-uret          (sonra: node yayin.js)
 * Çıktı:     _yayin/public/ altına
 *   turbedar-nedir/index.html   tanıtım
 *   surum-notlari/index.html    sürüm notları (README > Sürüm Geçmişi'nden)
 *   turbeler/index.html         il/ülke listesi
 *   turbeler/<bolge>/index.html il veya ülke sayfası
 *   yer/<slug>/index.html       kayıt sayfası
 *   y/<id>.html + y/index.html  paylaşım kartları (WhatsApp vb.)
 *   seo.css, sitemap.xml, robots.txt
 *
 * Slug'lar seo-sluglar.json'da kalıcıdır (repoda tutulur — yeni kayıt
 * eklendikçe dosya büyür, commit edilmeli).
 *
 * Son adımda tüm iç bağlantılar ve JSON-LD blokları denetlenir; kırık
 * bağlantı ya da bozuk JSON varsa çıkış kodu 1 (yayın yapılmamalı).
 */

const fs = require('fs');
const path = require('path');
const { slugYap, yurtdisiMi } = require('./yardimci');
const { onayliYerleriCek, bilgileriCek } = require('./veri');
const { sluglariOku, sluglariYaz, slugAta } = require('./sluglar');
const S = require('./sayfalar');
const { surumleriOku } = require('./surumler');

const CIKTI = path.join(__dirname, '..', '_yayin', 'public');
const URETILEN_KLASORLER = ['y', 'yer', 'turbeler', 'turbedar-nedir', 'surum-notlari'];

function yaz(goreli, icerik){
  const hedef = path.join(CIKTI, goreli);
  fs.mkdirSync(path.dirname(hedef), { recursive: true });
  fs.writeFileSync(hedef, icerik, 'utf8');
}

function bolgelereAyir(yerler){
  const harita = new Map();
  for (const y of yerler){
    const dis = yurtdisiMi(y);
    const ad = (dis ? y.ulke : y.il) || (dis ? 'Diğer Ülkeler' : 'Diğer');
    const anahtar = `${dis ? 'd' : 't'}:${ad}`;
    if (!harita.has(anahtar)) harita.set(anahtar, { ad, slug: slugYap(ad, 'diger'), yurtdisi: dis, yerler: [] });
    const b = harita.get(anahtar);
    b.yerler.push(y);
    y.bolge = b;
  }
  const bolgeler = [...harita.values()];
  // Slug çakışması (örn. aynı adlı il ve ülke) — ikinciye ek ver
  const gorulen = new Set();
  for (const b of bolgeler){
    while (gorulen.has(b.slug)) b.slug += b.yurtdisi ? '-ulke' : '-il';
    gorulen.add(b.slug);
  }
  for (const b of bolgeler) b.yerler.sort((a, c) => a.baslik.localeCompare(c.baslik, 'tr'));
  return bolgeler.sort((a, c) => c.yerler.length - a.yerler.length || a.ad.localeCompare(c.ad, 'tr'));
}

/* Üretilen HTML'lerdeki iç bağlantılar dosyaya karşılık geliyor mu,
 * JSON-LD blokları ayrıştırılabiliyor mu? */
function denetle(){
  const hatalar = [];
  const dosyalar = [];
  const gez = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })){
    const p = path.join(d, f.name);
    if (f.isDirectory()) gez(p); else if (p.endsWith('.html')) dosyalar.push(p);
  }};
  for (const k of ['yer', 'turbeler', 'turbedar-nedir', 'surum-notlari']) gez(path.join(CIKTI, k));

  // Yayın setinde olacak ama burada üretilmeyen statik dosyalar
  const statik = new Set(['/', '/index.html', '/gizlilik-politikasi.html', '/icon-192.webp', '/icon-512.webp', '/og-kart.png', '/logo.png']);
  const varMi = yol => {
    if (statik.has(yol)) return true;
    const p = path.join(CIKTI, yol);
    return yol.endsWith('/') ? fs.existsSync(path.join(p, 'index.html')) : fs.existsSync(p);
  };

  for (const d of dosyalar){
    const html = fs.readFileSync(d, 'utf8');
    for (const [, yol] of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)){
      if (!varMi(yol)) hatalar.push(`${path.relative(CIKTI, d)}: kırık bağlantı ${yol}`);
    }
    for (const [, govde] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)){
      try { JSON.parse(govde); } catch (e){ hatalar.push(`${path.relative(CIKTI, d)}: bozuk JSON-LD (${e.message})`); }
    }
    if ((html.match(/<h1[ >]/g) ?? []).length !== 1) hatalar.push(`${path.relative(CIKTI, d)}: tek <h1> olmalı`);
  }
  return { hatalar, sayfa: dosyalar.length };
}

async function main(){
  const [yerler, bilgiler] = await Promise.all([onayliYerleriCek(), bilgileriCek()]);
  if (!yerler.length) throw new Error('Hiç onaylı kayıt gelmedi — yayın iptal (boş site yayınlanmasın).');
  const surumler = surumleriOku();
  if (!surumler.length) throw new Error('README.md > Sürüm Geçmişi tablosu okunamadı — yayın iptal.');

  const sluglar = sluglariOku();
  // Eski kayıtlar önce: aynı adlı yerlerde yalın adres ilk ekleneni kalır
  const kronolojik = yerler.slice().sort((a, c) => String(a.created_at).localeCompare(String(c.created_at)));
  for (const y of kronolojik) y.slug = slugAta(sluglar, y.id, y.baslik, y);
  sluglariYaz(sluglar);

  const bolgeler = bolgelereAyir(yerler);

  // Eski üretimi temizle (silinen/reddedilen kayıtların sayfaları kalmasın)
  for (const k of URETILEN_KLASORLER) fs.rmSync(path.join(CIKTI, k), { recursive: true, force: true });

  yaz('turbedar-nedir/index.html', S.tanitimSayfasi(yerler, bolgeler, bilgiler));
  yaz('turbeler/index.html', S.hubSayfasi(bolgeler, yerler));
  yaz('surum-notlari/index.html', S.surumNotlariSayfasi(surumler));
  for (const b of bolgeler) yaz(`turbeler/${b.slug}/index.html`, S.bolgeSayfasi(b, bolgeler));
  for (const y of yerler){
    yaz(`yer/${y.slug}/index.html`, S.yerSayfasi(y, bolgeler));
    yaz(`y/${y.id}.html`, S.kartSayfasi(y));
  }
  fs.copyFileSync(path.join(__dirname, 'y-yonlendirici.html'), path.join(CIKTI, 'y', 'index.html'));
  fs.copyFileSync(path.join(__dirname, 'seo.css'), path.join(CIKTI, 'seo.css'));
  yaz('sitemap.xml', S.sitemap(yerler, bolgeler));
  yaz('robots.txt', S.robots());

  const { hatalar, sayfa } = denetle();
  console.log(`${yerler.length} kayıt, ${bolgeler.length} bölge → ${sayfa} SEO sayfası + ${yerler.length} paylaşım kartı üretildi.`);
  if (hatalar.length){
    console.error(`DENETİM HATASI (${hatalar.length}):\n` + hatalar.slice(0, 30).join('\n'));
    process.exit(1);
  }
  console.log('Denetim temiz: iç bağlantılar, JSON-LD ve <h1> sayıları doğru.');
}

main().catch(e => { console.error('HATA:', e.message); process.exit(1); });
