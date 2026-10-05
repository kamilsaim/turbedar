/* Supabase'den onaylı kayıtları çeker (anonim/publishable anahtar — RLS zaten
 * sadece durum='onaylandi' olanları gösterir). PostgREST 1000 satır limiti
 * yüzünden sayfalı döngü (index.html'deki veriYukle deseni). */

const { SUPA_URL } = require('./yardimci');

const ANAHTAR = 'sb_publishable_V2X8E-NSSCxFPHlSVhNtOw_rSD4R3W7';

async function onayliYerleriCek(){
  const sorgu = new URL(`${SUPA_URL}/rest/v1/turbedar_yerler`);
  sorgu.searchParams.set('durum', 'eq.onaylandi');
  sorgu.searchParams.set('order', 'baslik.asc');
  sorgu.searchParams.set('select',
    'id,baslik,kategori,aciklama,kaynak,kaynaklar,il,ilce,mahalle,ulke,ulke_kodu,lat,lng,' +
    'created_at,updated_at,' +
    'kisiler:turbedar_kisiler(ad,unvan,vefat),fotograflar:turbedar_fotograflar(yol,sira)');

  const hepsi = [];
  const ADIM = 1000;
  for (let bas = 0; ; bas += ADIM){
    const yanit = await fetch(sorgu, {
      headers: { apikey: ANAHTAR, Authorization: `Bearer ${ANAHTAR}`, Range: `${bas}-${bas + ADIM - 1}` },
    });
    if (!yanit.ok) throw new Error(`Supabase ${yanit.status}: ${await yanit.text()}`);
    const dilim = await yanit.json();
    hepsi.push(...dilim);
    if (dilim.length < ADIM) break;
  }
  return hepsi.map(duzenle);
}

/* Kapak önce (sira=0); kaynaklar boşsa eski tekil `kaynak`tan türet. */
function duzenle(y){
  const fotograflar = (y.fotograflar ?? []).slice().sort((a, b) => (a.sira ?? 99) - (b.sira ?? 99));
  let kaynaklar = Array.isArray(y.kaynaklar) ? y.kaynaklar.filter(k => k && (k.baslik || k.url)) : [];
  if (!kaynaklar.length && y.kaynak){
    const k = String(y.kaynak).trim();
    kaynaklar = [/^https?:\/\//i.test(k) ? { baslik: k, url: k } : { baslik: k, url: '' }];
  }
  return { ...y, fotograflar, kaynaklar, kisiler: y.kisiler ?? [] };
}

/* "Ziyaret Hakkında Bilinmesi Gerekenler" (Yönetim > Bilgiler) — tanıtım sayfasında gösterilir */
async function bilgileriCek(){
  const sorgu = new URL(`${SUPA_URL}/rest/v1/turbedar_bilgiler`);
  sorgu.searchParams.set('select', 'baslik,icerik,sira');
  sorgu.searchParams.set('order', 'sira.asc');
  const yanit = await fetch(sorgu, { headers: { apikey: ANAHTAR, Authorization: `Bearer ${ANAHTAR}` } });
  if (!yanit.ok) throw new Error(`Supabase ${yanit.status}: ${await yanit.text()}`);
  return yanit.json();
}

module.exports = { onayliYerleriCek, bilgileriCek };
