/* README.md'deki "## Sürüm Geçmişi" tablosunu okur — sürüm notları sayfasının
 * tek kaynağı README'dir (yeni sürümde orayı güncellemek yeter).
 * Dönen: [{ surum, metin, eski }]  — eski: <details> içindeki satırlar */

const fs = require('fs');
const path = require('path');

const README = path.join(__dirname, '..', 'README.md');

function surumleriAyristir(md){
  const bas = md.indexOf('## Sürüm Geçmişi');
  if (bas < 0) return [];
  const sonraki = md.indexOf('\n## ', bas + 1);
  const bolum = md.slice(bas, sonraki < 0 ? undefined : sonraki);
  const surumler = [];
  let eski = false;
  for (const satir of bolum.split(/\r?\n/)){
    if (satir.includes('<details')) eski = true;
    const m = satir.match(/^\|\s*\*\*([^*]+)\*\*\s*\|\s*(.+?)\s*\|\s*$/);
    if (m) surumler.push({ surum: m[1].trim(), metin: m[2], eski });
  }
  return surumler;
}

const surumleriOku = () => surumleriAyristir(fs.readFileSync(README, 'utf8'));

module.exports = { surumleriAyristir, surumleriOku };
