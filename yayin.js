#!/usr/bin/env node
/* Türbedar — Firebase Hosting yayını (turbedar.web.app)
 *
 * NEDEN VAR: eskiden yayın klasörü %TEMP%\turbedar-deploy altındaydı ve
 * Windows disk temizliği onu sildi. Artık repo içinde, git'e girmeyen
 * _yayin/ klasöründe kurulur — her çalıştırmada yeniden oluşturulur.
 *
 * KULLANIM:  node yayin.js            (topla + yükle)
 *            node yayin.js --kuru     (sadece topla, yükleme yapma)
 *
 * site-uret.js çıktısını doğrudan _yayin/public altına yazar; bu betik
 * statik dosyaları onun yanına kopyalar, firebase.json'u yazar ve yükler.
 * Bu yüzden public/ klasörünü SİLMEZ, sadece üzerine yazar.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const KOK = __dirname;
const YAYIN = path.join(KOK, '_yayin');
const PUBLIC = path.join(YAYIN, 'public');

// Yayınlanan statik dosya seti (CLAUDE.md ile aynı tutulmalı)
const DOSYALAR = [
  'index.html', 'gizlilik-politikasi.html', 'logo.png', 'sw.js',
  'manifest.webmanifest', 'icon-192.webp', 'icon-512.webp', 'og-kart.png',
];
// Repodaki klasörler (geçiş dönemi: y/ henüz repoda duruyorsa kopyalanır)
const KLASORLER = ['y'];

const FIREBASE_JSON = {
  hosting: {
    site: 'turbedar',
    public: 'public',
    ignore: ['firebase.json', '**/.*'],
    rewrites: [{ source: '/y/**', destination: '/y/index.html' }],
    headers: [
      { source: '/sw.js', headers: [
        { key: 'Cache-Control', value: 'no-store' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ]},
      { source: '/index.html', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
      { source: '/', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
      { source: '/y/**', headers: [{ key: 'Cache-Control', value: 'public, max-age=1800' }] },
      { source: '/yer/**', headers: [{ key: 'Cache-Control', value: 'public, max-age=1800' }] },
      { source: '/turbeler/**', headers: [{ key: 'Cache-Control', value: 'public, max-age=1800' }] },
      { source: '/turbedar-nedir/**', headers: [{ key: 'Cache-Control', value: 'public, max-age=1800' }] },
      { source: '/sitemap.xml', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }] },
    ],
  },
};

fs.mkdirSync(PUBLIC, { recursive: true });

for (const d of DOSYALAR) {
  fs.copyFileSync(path.join(KOK, d), path.join(PUBLIC, d));
}
for (const k of KLASORLER) {
  const kaynak = path.join(KOK, k);
  if (fs.existsSync(kaynak)) fs.cpSync(kaynak, path.join(PUBLIC, k), { recursive: true });
}
fs.writeFileSync(path.join(YAYIN, 'firebase.json'), JSON.stringify(FIREBASE_JSON, null, 2));

console.log('Toplandı:', PUBLIC);

if (process.argv.includes('--kuru')) process.exit(0);

execSync('firebase deploy --only hosting:turbedar --project turbedar-c512b', {
  cwd: YAYIN, stdio: 'inherit',
});
