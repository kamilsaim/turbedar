#!/usr/bin/env node
/* Türbedar — yere özel paylaşım kartı üreticisi
 *
 * NEDEN VAR: yer bağlantısı hash kullanır (#yer=<id>) ve hash sunucuya HİÇ
 * gönderilmez; bu yüzden WhatsApp/X gibi botlar kayda özel kartı göremez.
 * Supabase Edge Function denendi ama Supabase gateway'i HTML yanıtları
 * text/plain'e çevirip CSP sandbox uyguluyor — o yol kapalı. Çözüm: her
 * onaylı kayıt için önceden küçük bir HTML üretip kendi barındırmamızda
 * (turbedar.web.app/y/<id>.html) sunmak.
 *
 * KULLANIM:  node kart-uret.js
 * Çıktı:     y/<id>.html  (+ y/index.html yönlendirici zaten repoda durur)
 *
 * YENİ KAYIT ONAYLANDIĞINDA TEKRAR ÇALIŞTIRILMALI, yoksa o kaydın kartı
 * genel Türbedar kartına düşer (kırılmaz, sadece kişiselleşmez).
 */

const fs = require('fs');
const path = require('path');

const SUPA_URL = 'https://nzmxjompdipabkvocfio.supabase.co';
const ANAHTAR = 'sb_publishable_V2X8E-NSSCxFPHlSVhNtOw_rSD4R3W7';
const SITE = 'https://turbedar.web.app';
const VARSAYILAN_GORSEL = `${SITE}/og-kart.png`;
const CIKTI = path.join(__dirname, 'y');

const KATEGORILER = {
  turbe: 'Türbe', kumbet: 'Kümbet', mezar: 'Mezar',
  anit_mezar: 'Anıt Mezar', sehitlik: 'Şehitlik', diger: 'Diğer',
};

const kacir = s => String(s ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const gorselTuru = u => {
  const s = u.toLowerCase();
  if (s.endsWith('.webp')) return 'image/webp';
  if (s.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
};

/* index.html'deki konumYazisi() ile aynı mantık */
function konumYazisi(y){
  const kod = String(y.ulke_kodu ?? '').toLowerCase();
  if (kod && kod !== 'tr') return [y.il, y.ulke].filter(Boolean).join(', ');
  return [y.mahalle, y.ilce, y.il].filter(Boolean).join(' / ');
}

function ozet(y){
  const parcalar = [];
  const k = KATEGORILER[y.kategori] ?? 'Türbe';
  const yer = konumYazisi(y);
  parcalar.push(yer ? `${k} · ${yer}` : k);

  const adlar = (y.kisiler ?? []).slice(0, 3).map(p => p.ad).filter(Boolean);
  if (adlar.length) parcalar.push(`Burada yatanlar: ${adlar.join(', ')}`);

  const aciklama = String(y.aciklama ?? '').trim().replace(/\s+/g, ' ');
  if (aciklama) parcalar.push(aciklama.length > 160 ? aciklama.slice(0, 157) + '…' : aciklama);

  return parcalar.join(' — ');
}

function sayfa({baslik, aciklama, gorsel, hedef, tur = 'article'}){
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${kacir(baslik)} — Türbedar</title>
<meta name="description" content="${kacir(aciklama)}">
<meta property="og:type" content="${tur}">
<meta property="og:site_name" content="Türbedar">
<meta property="og:locale" content="tr_TR">
<meta property="og:title" content="${kacir(baslik)}">
<meta property="og:description" content="${kacir(aciklama)}">
<meta property="og:image" content="${kacir(gorsel)}">
<meta property="og:image:secure_url" content="${kacir(gorsel)}">
<meta property="og:image:type" content="${gorselTuru(gorsel)}">
<meta property="og:image:alt" content="${kacir(baslik)}">
<meta property="og:url" content="${kacir(hedef)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${kacir(baslik)}">
<meta name="twitter:description" content="${kacir(aciklama)}">
<meta name="twitter:image" content="${kacir(gorsel)}">
<link rel="canonical" href="${kacir(hedef)}">
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
  <h1>${kacir(baslik)}</h1>
  <p>Türbedar açılıyor…</p>
  <p style="font-size:13px"><a href="${kacir(hedef)}">Açılmazsa buraya dokun</a></p>
</div>
<script>location.replace(${JSON.stringify(hedef)});</script>
</body>
</html>
`;
}

async function main(){
  const sorgu = new URL(`${SUPA_URL}/rest/v1/turbedar_yerler`);
  sorgu.searchParams.set('durum', 'eq.onaylandi');
  sorgu.searchParams.set('select',
    'id,baslik,kategori,aciklama,il,ilce,mahalle,ulke,ulke_kodu,' +
    'kisiler:turbedar_kisiler(ad),fotograflar:turbedar_fotograflar(yol,sira)');

  // PostgREST 1000 satır limiti — sayfalı çek (index.html'deki veriYukle deseni)
  const hepsi = [];
  const ADIM = 1000;
  for (let bas = 0; ; bas += ADIM){
    const yanit = await fetch(sorgu, {
      headers: {
        apikey: ANAHTAR,
        Authorization: `Bearer ${ANAHTAR}`,
        Range: `${bas}-${bas + ADIM - 1}`,
      },
    });
    if (!yanit.ok) throw new Error(`Supabase ${yanit.status}: ${await yanit.text()}`);
    const dilim = await yanit.json();
    hepsi.push(...dilim);
    if (dilim.length < ADIM) break;
  }

  fs.mkdirSync(CIKTI, {recursive: true});

  // Artık onaylı olmayan kayıtların eski kartlarını temizle
  const gecerli = new Set(hepsi.map(y => `${y.id}.html`));
  gecerli.add('index.html');                       // yönlendirici korunur
  let silinen = 0;
  for (const dosya of fs.readdirSync(CIKTI)){
    if (dosya.endsWith('.html') && !gecerli.has(dosya)){
      fs.unlinkSync(path.join(CIKTI, dosya));
      silinen++;
    }
  }

  let fotolu = 0;
  for (const y of hepsi){
    const fotolar = (y.fotograflar ?? []).slice()
      .sort((a, b) => (a.sira ?? 99) - (b.sira ?? 99));
    const gorsel = fotolar.length
      ? `${SUPA_URL}/storage/v1/object/public/turbedar/${fotolar[0].yol}`
      : VARSAYILAN_GORSEL;
    if (fotolar.length) fotolu++;

    fs.writeFileSync(
      path.join(CIKTI, `${y.id}.html`),
      sayfa({baslik: y.baslik, aciklama: ozet(y), gorsel, hedef: `${SITE}/#yer=${y.id}`}),
      'utf8',
    );
  }

  console.log(`${hepsi.length} kart üretildi (${fotolu} tanesi kendi fotoğrafıyla).`);
  if (silinen) console.log(`${silinen} eski kart silindi.`);
}

main().catch(e => { console.error('HATA:', e.message); process.exit(1); });
