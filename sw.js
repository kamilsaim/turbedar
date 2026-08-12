/* Türbedar — SADECE bildirim servis çalışanı.
   BİLİNÇLİ OLARAK 'fetch' dinleyicisi YOKTUR: hiçbir şey önbelleğe alınmaz,
   böylece bayat sürüm sorunu doğmaz ve uygulamanın "Güncelle" akışı bozulmaz.
   Buradaki tek iş: sunucudan gelen push'u göstermek ve dokunulunca uygulamayı açmak. */

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let v = {};
  try { v = event.data ? event.data.json() : {}; } catch (e) { v = { baslik: 'Türbedar', govde: event.data ? event.data.text() : '' }; }

  const baslik = v.baslik || v.title || 'Türbedar';
  const govde  = v.govde  || v.body  || '';
  const yerId  = v.yer_id || null;

  event.waitUntil(self.registration.showNotification(baslik, {
    body: govde,
    icon: 'icon-192.webp',
    badge: 'icon-192.webp',
    tag: v.bildirim_id ? ('turbedar-' + v.bildirim_id) : 'turbedar',
    data: { yer_id: yerId },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const yerId = event.notification.data && event.notification.data.yer_id;
  const hedef = new URL(yerId ? ('./#yer=' + yerId) : './', self.registration.scope).href;

  event.waitUntil((async () => {
    const liste = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of liste) {
      if (c.url.indexOf(self.registration.scope) === 0) {
        await c.focus();
        if (yerId) c.postMessage({ tur: 'bildirim-tik', yer_id: yerId });
        return;
      }
    }
    await self.clients.openWindow(hedef);
  })());
});
