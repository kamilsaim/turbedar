#!/usr/bin/env node
/* Türbedar — Firebase Hosting yayını (turbedar.org + turbedar.web.app)
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
  'index.html', 'gizlilik-politikasi.html', 'kullanim-kosullari.html', 'logo.png', 'sw.js',
  'manifest.webmanifest', 'icon-192.webp', 'icon-512.webp', 'og-kart.png',
  'google164315b3fe8acefa.html',  // Search Console doğrulama dosyası (silme)
];

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
      { source: '/*sitemap*.xml', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }] },
    ],
  },
};

fs.mkdirSync(PUBLIC, { recursive: true });

for (const d of DOSYALAR) {
  fs.copyFileSync(path.join(KOK, d), path.join(PUBLIC, d));
}
// site-uret çalışmamışsa SEO sayfaları ve paylaşım kartları eksik yayınlanır
if (!fs.existsSync(path.join(PUBLIC, 'sitemap.xml'))) {
  console.error('HATA: önce node site-uret çalıştırılmalı (sitemap.xml yok).');
  process.exit(1);
}
fs.writeFileSync(path.join(YAYIN, 'firebase.json'), JSON.stringify(FIREBASE_JSON, null, 2));

console.log('Toplandı:', PUBLIC);

if (process.argv.includes('--kuru')) process.exit(0);

// Kimlik: repo kökündeki servis hesabı anahtarı (*firebase-adminsdk*.json,
// .gitignore'da). `firebase login` oturumu zamanla düşüyor ve haftalık
// TurbedarSite görevi sessizce HATA veriyordu (12 Eki 2026); anahtarın süresi
// dolmaz. Kişisel giriş boş bir yapılandırma klasörüyle gizlenir — ikisi
// birden görünürse CLI bayat kişisel girişi seçebiliyor. Anahtar yoksa eski
// yol (firebase login) kullanılır.
const env = { ...process.env };
const anahtar = fs.readdirSync(KOK).find(d => /firebase-adminsdk.*\.json$/.test(d)
  && JSON.parse(fs.readFileSync(path.join(KOK, d), 'utf8')).project_id === 'turbedar-c512b');
if (anahtar) {
  env.GOOGLE_APPLICATION_CREDENTIALS = path.join(KOK, anahtar);
  env.XDG_CONFIG_HOME = path.join(YAYIN, '.firebase-yapilandirma');
  fs.mkdirSync(env.XDG_CONFIG_HOME, { recursive: true });
  console.log('Kimlik: servis hesabı (' + anahtar + ')');
} else {
  console.log('Kimlik: firebase login (servis hesabı anahtarı bulunamadı)');
}

// --debug: CLI ayrıntılı günlüğü _yayin/firebase-debug.log'a yazar (yükleme hatası teşhisi)
const ekBayrak = process.argv.includes('--debug') ? ' --debug' : '';
execSync('firebase deploy --only hosting:turbedar --project turbedar-c512b' + ekBayrak, {
  cwd: YAYIN, stdio: 'inherit', env,
});
