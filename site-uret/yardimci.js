/* Ortak yardımcılar — KATEGORILER ve konumYazisi index.html'den KOPYALANMIŞTIR.
 * Kategori listesi değişirse index.html + DB CHECK kısıtı + burası birlikte güncellenmeli. */

const SITE = 'https://turbedar.web.app';
const SUPA_URL = 'https://nzmxjompdipabkvocfio.supabase.co';
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.kamilsaim.turbedar';

const KATEGORILER = {
  turbe: 'Türbe', kumbet: 'Kümbet', mezar: 'Mezar', makam: 'Makam',
  anit_mezar: 'Anıt Mezar', sehitlik: 'Şehitlik', diger: 'Diğer',
};

const kacir = s => String(s ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const HARF = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/* URL parçası: Türkçe harf dönüşümü, aksan temizliği, tire. Latin dışı yazıda
 * boş kalırsa `yedek` döner. */
function slugYap(metin, yedek = ''){
  const s = String(metin ?? '').toLocaleLowerCase('tr')
    .replace(/[çğıöşüâîû]/g, h => HARF[h])
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || yedek;
}

/* <script type="application/ld+json"> bloğu; `<` kaçışı gövdenin
 * </script> ile erken kapanmasını engeller (JSON olarak geçerli kalır). */
const jsonLd = nesne =>
  `<script type="application/ld+json">${JSON.stringify(nesne).replace(/</g, '\\u003c')}</script>`;

function kisalt(metin, uzunluk){
  const s = String(metin ?? '').trim().replace(/\s+/g, ' ');
  if (s.length <= uzunluk) return s;
  const kes = s.slice(0, uzunluk - 1);
  const bosluk = kes.lastIndexOf(' ');
  return (bosluk > uzunluk * 0.6 ? kes.slice(0, bosluk) : kes).replace(/[\s,.;:—-]+$/, '') + '…';
}

const yurtdisiMi = y => { const k = String(y.ulke_kodu ?? '').toLowerCase(); return !!k && k !== 'tr'; };

/* index.html'deki konumYazisi() ile aynı mantık */
function konumYazisi(y){
  if (yurtdisiMi(y)) return [y.il, y.ulke].filter(Boolean).join(', ');
  return [y.mahalle, y.ilce, y.il].filter(Boolean).join(' / ');
}

const kategoriAdi = y => KATEGORILER[y.kategori] ?? 'Türbe';

/* Paylaşım kartı / meta açıklama özeti */
function ozet(y, uzunluk = 160){
  const parcalar = [];
  const yer = konumYazisi(y);
  parcalar.push(yer ? `${kategoriAdi(y)} · ${yer}` : kategoriAdi(y));
  const adlar = (y.kisiler ?? []).slice(0, 3).map(p => p.ad).filter(Boolean);
  if (adlar.length) parcalar.push(`Mekan sahipleri: ${adlar.join(', ')}`);
  if (y.aciklama) parcalar.push(kisalt(y.aciklama, uzunluk));
  return parcalar.join(' — ');
}

const fotoUrl = yol => `${SUPA_URL}/storage/v1/object/public/turbedar/${yol}`;

const sayiYaz = n => n.toLocaleString('tr-TR');

module.exports = {
  SITE, SUPA_URL, PLAY_URL, KATEGORILER, kacir, slugYap, jsonLd, kisalt,
  yurtdisiMi, konumYazisi, kategoriAdi, ozet, fotoUrl, sayiYaz,
};
