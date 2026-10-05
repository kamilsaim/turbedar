// Çalıştır: node --test site-uret/
const test = require('node:test');
const assert = require('node:assert');
const { slugYap, kacir, jsonLd, kisalt, konumYazisi } = require('./yardimci');
const { slugAta } = require('./sluglar');

test('slugYap Türkçe harfleri dönüştürür', () => {
  assert.strictEqual(slugYap('Seyyid Burhaneddin Türbesi'), 'seyyid-burhaneddin-turbesi');
  assert.strictEqual(slugYap('İstanbul'), 'istanbul');
  assert.strictEqual(slugYap('Şanlıurfa'), 'sanliurfa');
  assert.strictEqual(slugYap('Ağrı'), 'agri');
  assert.strictEqual(slugYap('  Hz. Ebû Eyyûb el-Ensârî (r.a.)  '), 'hz-ebu-eyyub-el-ensari-r-a');
  assert.strictEqual(slugYap('Âşık Veysel'), 'asik-veysel');
});

test('slugYap Latin dışı girdide boş dönmez', () => {
  assert.strictEqual(slugYap('بلدية الصالحية'), '');
  assert.strictEqual(slugYap('بلدية', 'yer'), 'yer');
});

test('kacir HTML özel karakterlerini kaçırır', () => {
  assert.strictEqual(kacir(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.strictEqual(kacir(null), '');
});

test('jsonLd </script> kaçışı yapar ve ayrıştırılabilir kalır', () => {
  const html = jsonLd({ ad: 'x</script><script>alert(1)</script>' });
  assert.ok(!html.slice(0, -9).includes('</script>'), 'gövdede </script> olmamalı');
  const govde = html.replace(/^<script type="application\/ld\+json">/, '').replace(/<\/script>$/, '');
  assert.strictEqual(JSON.parse(govde).ad, 'x</script><script>alert(1)</script>');
});

test('kisalt kelime sınırında keser', () => {
  assert.strictEqual(kisalt('kısa', 10), 'kısa');
  assert.strictEqual(kisalt('bir iki üç dört beş', 12), 'bir iki üç…');
});

test('konumYazisi TR ve yurtdışı', () => {
  assert.strictEqual(konumYazisi({ ulke_kodu: 'tr', mahalle: 'M', ilce: 'İ', il: 'K' }), 'M / İ / K');
  assert.strictEqual(konumYazisi({ ulke_kodu: 'eg', il: 'Kahire', ulke: 'Mısır' }), 'Kahire, Mısır');
});

test('Türkçe ekler ses uyumuna uyar', () => {
  const { bulunmaEki, bildirmeEki } = require('./sayfalar');
  assert.strictEqual(bulunmaEki('Kayseri'), "Kayseri'de");
  assert.strictEqual(bulunmaEki('İstanbul'), "İstanbul'da");
  assert.strictEqual(bulunmaEki('Sivas'), "Sivas'ta");
  assert.strictEqual(bulunmaEki('Bağdat'), "Bağdat'ta");
  assert.strictEqual(bulunmaEki('Diyarbakır'), "Diyarbakır'da");
  assert.strictEqual(bulunmaEki('Kuzey Kıbrıs'), "Kuzey Kıbrıs'ta");
  assert.strictEqual(bildirmeEki('türbe'), 'türbedir');
  assert.strictEqual(bildirmeEki('kümbet'), 'kümbettir');
  assert.strictEqual(bildirmeEki('mezar'), 'mezardır');
  assert.strictEqual(bildirmeEki('şehitlik'), 'şehitliktir');
  assert.strictEqual(bildirmeEki('makam'), 'makamdır');
  assert.strictEqual(bildirmeEki('ziyaret yeri'), 'ziyaret yeridir');
});

test('slugAta kalıcıdır ve çakışmayı çözer', () => {
  const eslesme = { a: 'turbe' };
  // a'nın başlığı değişse de slug'ı aynı kalır
  assert.strictEqual(slugAta(eslesme, 'a', 'Bambaşka Ad'), 'turbe');
  // aynı başlıklı yeni kayıt önce ilçe, sonra il, en son sayı alır
  assert.strictEqual(slugAta(eslesme, 'b', 'Türbe', { ilce: 'Bodrum', il: 'Muğla' }), 'turbe-bodrum');
  assert.strictEqual(slugAta(eslesme, 'c', 'Türbe', { ilce: 'Bodrum', il: 'Muğla' }), 'turbe-mugla');
  assert.strictEqual(slugAta(eslesme, 'd', 'Türbe', { ilce: 'Bodrum', il: 'Muğla' }), 'turbe-2');
  assert.strictEqual(slugAta(eslesme, 'e', 'Türbe'), 'turbe-3');
  assert.strictEqual(slugAta(eslesme, 'f', 'Zeynel Türbe', { ilce: 'Sivas', il: 'Sivas' }), 'zeynel-turbe');
  assert.deepStrictEqual(Object.keys(eslesme), ['a', 'b', 'c', 'd', 'e', 'f']);
});
