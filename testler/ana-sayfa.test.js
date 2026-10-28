// Çalıştır: node --test testler/ana-sayfa.test.js
// index.html içindeki işaretli "saf" bloğu (DOM'a dokunmayan ana sayfa mantığı) kesip vm'de çalıştırır.
// Günün türbesi seçimi iOS (TurbedarCekirdek gununYeri) ile AYNI olmalı — aynı gün aynı kayıt.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const bas = html.indexOf('/* ==SAF-ANA-SAYFA-BASLA== */');
const bit = html.indexOf('/* ==SAF-ANA-SAYFA-BITIR== */');
if (bas < 0 || bit < 0) throw new Error('index.html içinde SAF-ANA-SAYFA işaretleri bulunamadı');
const f = vm.runInNewContext(html.slice(bas, bit) +
  '; ({fotoYoluGuvenli, istanbulGunNo, gununYeriSec, gonulluSayisi, ziyaretEdilmeyenlerOnce, yerEksikMi, eksikZiyaret, goreceTarih, yolculukOzeti})', {});

function yer({id, durum = 'onaylandi', foto = true, ekleyen = null, aciklama = null, kaynak = null, kaynaklar = null,
  il = 'Konya', ulke_kodu = 'tr', ulke = 'Türkiye', created_at = '2026-10-26T12:00:00Z'}){
  return {id, durum, fotograflar: foto ? [{id: 'f-' + id, yol: id + '/a.jpg', sira: 0}] : [], ekleyen_id: ekleyen,
    aciklama, kaynak, kaynaklar, il, ulke_kodu, ulke, created_at};
}
const ids = ['10000000-0000-4000-8000-000000000000', '20000000-0000-4000-8000-000000000000', '30000000-0000-4000-8000-000000000000',
  '40000000-0000-4000-8000-000000000000', '50000000-0000-4000-8000-000000000000'];

test('istanbulGunNo: 2026-10-28 öğlen = 20754; UTC 21:30 ertesi güne geçer', () => {
  assert.equal(f.istanbulGunNo(new Date('2026-10-28T09:00:00Z')), 20754);
  assert.equal(f.istanbulGunNo(new Date('2026-10-28T21:30:00Z')), 20755);
});

test('gununYeriSec iOS ile aynı: 5 aday, 28 Eki → 5. id, 29 Eki → 1. id; sıra girişten bağımsız', () => {
  const y = ids.map(id => yer({id})).reverse();
  assert.equal(f.gununYeriSec(y, null, new Date('2026-10-28T09:00:00Z')).id, ids[4]);
  assert.equal(f.gununYeriSec(y, null, new Date('2026-10-29T09:00:00Z')).id, ids[0]);
});

test('gununYeriSec yalnız fotoğraflı onaylı; ziyaret edilmeyenlerden, hepsi gidildiyse tümünden', () => {
  const y = [yer({id: ids[0]}), yer({id: ids[1], foto: false}), yer({id: ids[2], durum: 'beklemede'})];
  assert.equal(f.gununYeriSec(y, null, new Date('2026-10-28T09:00:00Z')).id, ids[0]);
  const z = ids.map(id => yer({id}));
  assert.equal(f.gununYeriSec(z, new Set(ids.slice(0, 4)), new Date('2026-10-28T09:00:00Z')).id, ids[4]);
  assert.equal(f.gununYeriSec(z, new Set(ids), new Date('2026-10-28T09:00:00Z')).id, ids[4]);
  assert.equal(f.gununYeriSec([], null), null);
});

test('gonulluSayisi: onaylı kayıtları ekleyen farklı kişiler', () => {
  assert.equal(f.gonulluSayisi([yer({id: ids[0], ekleyen: 'a'}), yer({id: ids[1], ekleyen: 'a'}), yer({id: ids[2], ekleyen: 'b'}),
    yer({id: ids[3]}), yer({id: ids[4], ekleyen: 'c', durum: 'beklemede'})]), 2);
});

test('ziyaretEdilmeyenlerOnce mesafe sırasını korur', () => {
  const l = ['A', 'B', 'C', 'D'].map((b, i) => ({yer: {id: b}, metre: (i + 1) * 10}));
  assert.deepEqual(f.ziyaretEdilmeyenlerOnce(l, new Set(['A', 'C']), 3).map(x => x.yer.id), ['B', 'D', 'A']);
  assert.deepEqual(f.ziyaretEdilmeyenlerOnce(l, new Set(), 2).map(x => x.yer.id), ['A', 'B']);
});

test('eksikZiyaret yalnız ziyaret edilmiş + eksik + onaylı', () => {
  const tam = yer({id: ids[0], aciklama: 'Bilgi', kaynak: 'Kitap'});
  const eksik = yer({id: ids[1], kaynak: 'Kitap'});
  const bekleyen = yer({id: ids[2], durum: 'beklemede'});
  const y = [tam, eksik, yer({id: ids[3]}), bekleyen];
  assert.equal(f.eksikZiyaret(y, new Set([ids[0], ids[1], ids[2]]), new Date('2026-10-28T09:00:00Z')).id, ids[1]);
  assert.equal(f.eksikZiyaret(y, new Set([ids[0]])), null);
  assert.equal(f.yerEksikMi(eksik), 'aciklama');
  assert.equal(f.yerEksikMi(yer({id: ids[4], aciklama: 'x'})), 'kaynak');
  assert.equal(f.yerEksikMi(tam), null);
});

test('goreceTarih', () => {
  const s = new Date('2026-10-28T09:00:00Z');
  assert.equal(f.goreceTarih('2026-10-28T01:00:00Z', s), 'bugün');
  assert.equal(f.goreceTarih('2026-10-27T09:00:00Z', s), 'dün');
  assert.equal(f.goreceTarih('2026-10-25T09:00:00Z', s), '3 gün önce');
  assert.equal(f.goreceTarih('2026-10-07T09:00:00Z', s), '3 hafta önce');
  assert.equal(f.goreceTarih('2026-06-20T09:00:00Z', s), '4 ay önce');
  assert.equal(f.goreceTarih('2024-09-01T09:00:00Z', s), '2 yıl önce');
});

test('yolculukOzeti', () => {
  const y = [yer({id: ids[0], il: 'Kayseri'}), yer({id: ids[1], il: 'Kayseri'}), yer({id: ids[2], il: 'Konya'}),
    yer({id: ids[3], il: 'Mekke', ulke_kodu: 'sa', ulke: 'Suudi Arabistan'})];
  const o = f.yolculukOzeti(y, new Set([ids[0], ids[2], ids[3]]));
  assert.equal(o.metin, '3 türbe · 2 il · 1 ülke');
  assert.deepEqual({...o.il}, {ad: 'Kayseri', toplam: 2, gidilen: 1});
  assert.equal(f.yolculukOzeti(y, new Set()).il, null);
});

test('fotoYoluGuvenli: yalnız {id}/{id}.uzantı biçimi (CSS url() ve öznitelik dışına taşma yok)', () => {
  assert.equal(f.fotoYoluGuvenli('b10b0a0c-41c9-4cd1-8c83-de64dd7a5aa9/396b497f-d5ee-432e-b7df-c8961f0404df.jpg'), true);
  assert.equal(f.fotoYoluGuvenli('notlar/b10b0a0c/abc_1.webp'), true);
  assert.equal(f.fotoYoluGuvenli("x/a.jpg') ;background:url(//kotu"), false);
  assert.equal(f.fotoYoluGuvenli('x/"><img src=x onerror=alert(1)>.png'), false);
  assert.equal(f.fotoYoluGuvenli('../a/b.jpg'), false);
  assert.equal(f.fotoYoluGuvenli(''), false);
  assert.equal(f.fotoYoluGuvenli(null), false);
});

test('gonulluSayisi: "Silinmiş Kullanıcı" sistem profili sayılmaz', () => {
  const a = yer({id: ids[0], ekleyen: 'a'}); a.ekleyen = {id: 'a', ad: 'Kamil'};
  const s = yer({id: ids[1], ekleyen: 's'}); s.ekleyen = {id: 's', ad: 'Silinmiş Kullanıcı'};
  assert.equal(f.gonulluSayisi([a, s]), 1);
});
