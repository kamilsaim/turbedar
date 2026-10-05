/* Kalıcı id → slug eşlemesi (repo kökünde seo-sluglar.json, git'te tutulur).
 * Bir kayda bir kez atanan adres, başlık sonradan düzenlense de DEĞİŞMEZ —
 * yoksa Google'daki sıralama ve dışarıdan verilen bağlantılar kırılırdı. */

const fs = require('fs');
const path = require('path');
const { slugYap } = require('./yardimci');

const DOSYA = path.join(__dirname, '..', 'seo-sluglar.json');

function sluglariOku(){
  return fs.existsSync(DOSYA) ? JSON.parse(fs.readFileSync(DOSYA, 'utf8')) : {};
}

function sluglariYaz(eslesme){
  const sirali = Object.fromEntries(Object.entries(eslesme).sort((a, b) => a[1].localeCompare(b[1])));
  fs.writeFileSync(DOSYA, JSON.stringify(sirali, null, 2) + '\n', 'utf8');
}

/* Aynı adlı farklı yerler (iki "Zeynel Abidin Türbesi") için önce ilçe,
 * sonra il eklenir — "-2"den hem okunur hem aranır. Sayı son çare. */
function slugAta(eslesme, id, baslik, { ilce, il } = {}){
  if (eslesme[id]) return eslesme[id];
  const kullanilan = new Set(Object.values(eslesme));
  const kok = slugYap(baslik, 'yer');
  const adaylar = [kok, ...[ilce, il].map(p => slugYap(p)).filter(Boolean).map(p => `${kok}-${p}`)];
  let aday = adaylar.find(a => !kullanilan.has(a));
  for (let i = 2; !aday; i++) if (!kullanilan.has(`${kok}-${i}`)) aday = `${kok}-${i}`;
  eslesme[id] = aday;
  return aday;
}

module.exports = { sluglariOku, sluglariYaz, slugAta };
