// Çalıştır: node --test testler/gezi-link.test.js
// Harita linki çözme, gezi sıralama, "şu an türbede misin" ve durum bildirimi saf mantığı.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const bas = html.indexOf('/* ==SAF-ANA-SAYFA-BASLA== */');
const bit = html.indexOf('/* ==SAF-ANA-SAYFA-BITIR== */');
const f = vm.runInNewContext(html.slice(bas, bit) +
  '; ({haritaLinkiCoz, geziSirala, geziMesafe, geziGoogleUrl, buradakiYer, durumEtiketDegistir, sonDurum})', {URL});
const yakin = (r, lat, lng) => { assert.ok(r && Math.abs(r.lat - lat) < 1e-6 && Math.abs(r.lng - lng) < 1e-6, JSON.stringify(r)); };

test('düz koordinat ve geo:', () => {
  yakin(f.haritaLinkiCoz('41.0478, 28.9336'), 41.0478, 28.9336);
  yakin(f.haritaLinkiCoz('geo:37.87,32.50?z=17'), 37.87, 32.5);
  assert.equal(f.haritaLinkiCoz('Eyüp Sultan'), null);
  assert.equal(f.haritaLinkiCoz('95.0, 28.0'), null);
});
test('Google uzun linkler: !3d!4d önce, sonra q, sonra @', () => {
  const r = f.haritaLinkiCoz('https://www.google.com/maps/place/Ey%C3%BCp+Sultan+T%C3%BCrbesi/@41.0480,28.9330,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d41.0478012!4d28.9336543');
  yakin(r, 41.0478012, 28.9336543);
  assert.equal(r.ad, 'Eyüp Sultan Türbesi');
  yakin(f.haritaLinkiCoz('https://maps.google.com/?q=39.9208,32.8541'), 39.9208, 32.8541);
  yakin(f.haritaLinkiCoz('Şuraya bak: https://www.google.com/maps/@38.4192,27.1287,15z'), 38.4192, 27.1287);
  yakin(f.haritaLinkiCoz('https://www.google.com/maps/search/?api=1&query=40.18,29.06'), 40.18, 29.06);
});
test('Apple linkleri', () => {
  const r = f.haritaLinkiCoz('https://maps.apple.com/?ll=37.8714,32.5047&q=Mevlana');
  yakin(r, 37.8714, 32.5047); assert.equal(r.ad, 'Mevlana');
  yakin(f.haritaLinkiCoz('https://maps.apple.com/place?coordinate=41.01,28.97&name=Fatih'), 41.01, 28.97);
});
test('kısa ve koordinatsız linkler sunucuya', () => {
  assert.deepEqual(f.haritaLinkiCoz('https://maps.app.goo.gl/AbCd123'), {kisa: 'https://maps.app.goo.gl/AbCd123'});
  assert.ok(f.haritaLinkiCoz('https://maps.apple/p/xyz').kisa);
  assert.ok(f.haritaLinkiCoz('https://www.google.com/maps/place/Konya').kisa);
  assert.equal(f.haritaLinkiCoz('https://evil.com/maps?q=1,2'), null);
  assert.equal(f.haritaLinkiCoz('https://google.com.evil.io/maps/@1.5,2.5'), null);
});
test('geziSirala en yakın komşu', () => {
  const a = {id: 'a', lat: 41, lng: 29}, b = {id: 'b', lat: 41.1, lng: 29}, c = {id: 'c', lat: 41.05, lng: 29};
  assert.deepEqual(f.geziSirala([b, a, c], {lat: 40.99, lng: 29}).map(x => x.id), ['a', 'c', 'b']);
  assert.deepEqual(f.geziSirala([a, b, c]).map(x => x.id), ['a', 'c', 'b']);
  assert.ok(f.geziMesafe([a, c, b]) > 11000 && f.geziMesafe([a, c, b]) < 11300);
});
test('geziGoogleUrl', () => {
  const d = [{lat: 41, lng: 29}, {lat: 41.1, lng: 29.1}];
  const u = f.geziGoogleUrl(d, {lat: 40.9, lng: 28.9});
  assert.match(u, /destination=41\.100000,29\.100000/);
  assert.match(u, /origin=40\.900000,28\.900000/);
  assert.match(u, /waypoints=41\.000000%2C29\.000000/);
  const on2 = Array.from({length: 12}, (_, i) => ({lat: 40 + i / 10, lng: 29}));
  assert.equal(decodeURIComponent(f.geziGoogleUrl(on2).split('waypoints=')[1]).split('|').length, 9);
  assert.equal(f.geziGoogleUrl([]), null);
});
test('buradakiYer 150 m', () => {
  const ys = [{id: 1, durum: 'onaylandi', lat: 41, lng: 29}, {id: 2, durum: 'beklemede', lat: 41.0001, lng: 29}];
  assert.equal(f.buradakiYer({lat: 41.0005, lng: 29}, ys).yer.id, 1);
  assert.equal(f.buradakiYer({lat: 41.01, lng: 29}, ys), null);
  assert.equal(f.buradakiYer(null, ys), null);
});
test('durum etiketleri', () => {
  assert.deepEqual(f.durumEtiketDegistir(['acikti', 'otopark'], 'kapaliydi'), ['otopark', 'kapaliydi']);
  assert.deepEqual(f.durumEtiketDegistir(['otopark'], 'otopark'), []);
  const s = f.sonDurum([{etiketler: ['acikti'], created_at: '2026-01-01T00:00:00Z'}, {etiketler: ['kapaliydi', 'uydurma'], not_metni: 'n', created_at: '2026-11-01T00:00:00Z'}], new Date('2026-11-10'));
  assert.deepEqual(s.etiketler, ['kapaliydi']); assert.equal(s.eski, false); assert.equal(s.not, 'n');
  assert.equal(f.sonDurum([{etiketler: [], created_at: '2026-01-01T00:00:00Z'}], new Date('2026-11-10')).eski, true);
  assert.equal(f.sonDurum([]), null);
});
