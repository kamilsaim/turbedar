// Türbedar — Push bildirim gönderici
// Tetikleyici: turbedar_bildirimler tablosuna INSERT → pg_net → bu fonksiyon → cihaz
// ÜÇ KANAL: (1) FCM → Android APK (push_token), (2) Web Push/VAPID → iOS ana ekran PWA
// ve masaüstü/mobil tarayıcılar (push_web), (3) APNs → iPhone uygulaması (push_ios).
// Kullanıcının hangi kanalları doluysa hepsine gider.
// Güvenlik: dışarıdan yalnızca bildirim_id alınır; içerik DB'den okunur (sahte push atılamaz),
// push_gonderildi işareti tekrar göndermeyi engeller (replay zararsız).

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { SignJWT, importPKCS8 } from 'npm:jose@5';

function cevap(obj: unknown, durum = 200) {
  return new Response(JSON.stringify(obj), {
    status: durum,
    headers: { 'Content-Type': 'application/json' },
  });
}

/* ===================== yardımcılar ===================== */
const enc = new TextEncoder();

function b64urlCoz(s: string): Uint8Array {
  const d = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const u = new Uint8Array(d.length);
  for (let i = 0; i < d.length; i++) u[i] = d.charCodeAt(i);
  return u;
}
function b64urlYaz(u: Uint8Array): string {
  let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function birlestir(...parcalar: Uint8Array[]): Uint8Array {
  const boy = parcalar.reduce((t, p) => t + p.length, 0);
  const o = new Uint8Array(boy);
  let i = 0;
  for (const p of parcalar) { o.set(p, i); i += p.length; }
  return o;
}
async function hmac(anahtar: Uint8Array, veri: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', anahtar, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, veri));
}
// HKDF (tek turluk çıktı yeterli: en fazla 32 bayt istiyoruz)
async function hkdf(tuz: Uint8Array, ikm: Uint8Array, bilgi: Uint8Array, uzunluk: number) {
  const prk = await hmac(tuz, ikm);
  const okm = await hmac(prk, birlestir(bilgi, new Uint8Array([1])));
  return okm.slice(0, uzunluk);
}

/* ===================== FCM (Android APK) ===================== */
async function fcmErisimTokeni(sa: { client_email: string; private_key: string }) {
  const anahtar = await importPKCS8(sa.private_key, 'RS256');
  const jwt = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(anahtar);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('FCM token alınamadı: ' + JSON.stringify(d));
  return d.access_token as string;
}

/* ===================== Web Push (VAPID + RFC8291 aes128gcm) ===================== */

// VAPID JWT'si (ES256). Özel anahtar ham 'd' (base64url), açık anahtar ham 65 baytlık nokta.
async function vapidBasligi(endpoint: string, acikHam: Uint8Array, ozelD: string, konu: string) {
  const jwk: JsonWebKey = {
    kty: 'EC', crv: 'P-256', ext: true,
    x: b64urlYaz(acikHam.slice(1, 33)),
    y: b64urlYaz(acikHam.slice(33, 65)),
    d: ozelD,
  };
  const anahtar = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const bas = b64urlYaz(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const govde = b64urlYaz(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: konu,
  })));
  const imza = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, anahtar, enc.encode(bas + '.' + govde),
  ));
  return `vapid t=${bas}.${govde}.${b64urlYaz(imza)}, k=${b64urlYaz(acikHam)}`;
}

// İçeriği alıcının anahtarlarıyla şifrele (RFC8291 / aes128gcm)
async function icerikSifrele(metin: string, p256dh: string, auth: string): Promise<Uint8Array> {
  const uaAcik = b64urlCoz(p256dh);
  const authGizli = b64urlCoz(auth);

  // Gönderici için tek kullanımlık ECDH anahtar çifti
  const cift = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asAcik = new Uint8Array(await crypto.subtle.exportKey('raw', cift.publicKey));
  const uaAnahtar = await crypto.subtle.importKey('raw', uaAcik, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const paylasilan = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaAnahtar }, cift.privateKey, 256,
  ));

  // IKM = HKDF(auth, ecdh, "WebPush: info" || 0 || ua_public || as_public)
  const ikm = await hkdf(
    authGizli, paylasilan,
    birlestir(enc.encode('WebPush: info'), new Uint8Array([0]), uaAcik, asAcik),
    32,
  );

  const tuz = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(tuz, ikm, birlestir(enc.encode('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16);
  const nonce = await hkdf(tuz, ikm, birlestir(enc.encode('Content-Encoding: nonce'), new Uint8Array([0])), 12);

  const aes = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const acikMetin = birlestir(enc.encode(metin), new Uint8Array([2])); // 0x02 = son kayıt ayracı
  const sifreli = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, acikMetin));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return birlestir(tuz, rs, new Uint8Array([asAcik.length]), asAcik, sifreli);
}

async function webPushGonder(abone: { endpoint: string; p256dh: string; auth: string }, yuk: unknown) {
  const acik = Deno.env.get('VAPID_PUBLIC_KEY');
  const ozel = Deno.env.get('VAPID_PRIVATE_KEY');
  const konu = Deno.env.get('VAPID_SUBJECT') || 'mailto:saimkamil@gmail.com';
  if (!acik || !ozel) return { durum: 0, hata: 'VAPID secret tanımlı değil' };

  const govde = await icerikSifrele(JSON.stringify(yuk), abone.p256dh, abone.auth);
  const yetki = await vapidBasligi(abone.endpoint, b64urlCoz(acik), ozel, konu);

  const r = await fetch(abone.endpoint, {
    method: 'POST',
    headers: {
      Authorization: yetki,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal',
    },
    body: govde,
  });
  return { durum: r.status, hata: r.ok ? null : await r.text().catch(() => '') };
}

/* ===================== APNs (iPhone uygulaması) ===================== */
// Secrets: APNS_KEY_P8 (.p8 dosyasının içeriği — PEM ya da tek satır base64),
// APNS_KEY_ID (7V2L7K74PL), APNS_TEAM_ID (NBTXFU47EV), opsiyonel APNS_BUNDLE_ID.
// Anahtar Apple Developer'da "Sandbox & Production" olarak oluşturuldu.

function apnsP8(): string {
  const ham = (Deno.env.get('APNS_KEY_P8') || '').trim();
  if (!ham) throw new Error('APNS_KEY_P8 secret tanımlı değil');
  return ham.includes('BEGIN PRIVATE KEY') ? ham.replace(/\\n/g, '\n') : atob(ham);
}

// Apple sağlayıcı JWT'si en fazla 60 dk geçerli ve 20 dk'dan sık yenilenirse 429
// TooManyProviderTokenUpdates verir. Edge örnekleri kısa ömürlü olduğundan jeton
// turbedar_sunucu_onbellek tablosunda 50 dk saklanır.
async function apnsJwt(sb: SupabaseClient, yenile = false): Promise<string> {
  if (!yenile) {
    const { data } = await sb.from('turbedar_sunucu_onbellek')
      .select('deger, guncellendi').eq('ad', 'apns_jwt').maybeSingle();
    if (data && Date.now() - new Date(data.guncellendi).getTime() < 50 * 60 * 1000) return data.deger;
  }
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  if (!keyId || !teamId) throw new Error('APNS_KEY_ID / APNS_TEAM_ID secret tanımlı değil');
  const anahtar = await importPKCS8(apnsP8(), 'ES256');
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .sign(anahtar);
  await sb.from('turbedar_sunucu_onbellek')
    .upsert({ ad: 'apns_jwt', deger: jwt, guncellendi: new Date().toISOString() });
  return jwt;
}

async function apnsIstek(sunucu: string, token: string, jwt: string, govde: string) {
  const r = await fetch(`https://${sunucu}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': Deno.env.get('APNS_BUNDLE_ID') || 'com.kamilsaim.turbedar',
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: govde,
  });
  const neden = r.ok ? null : ((await r.json().catch(() => ({}))) as { reason?: string }).reason || `HTTP ${r.status}`;
  return { durum: r.status, neden };
}

// Xcode'dan kurulan geliştirme sürümünün jetonu sandbox'a, TestFlight/App Store
// sürümününki production'a aittir; istemci hangisi olduğunu bilmez. Önce production
// denenir, "BadDeviceToken" gelirse sandbox.
async function apnsGonder(sb: SupabaseClient, token: string, baslik: string, govdeMetin: string, yerId: string | null) {
  const govde = JSON.stringify({
    aps: { alert: { title: baslik, body: govdeMetin }, sound: 'default' },
    yer_id: yerId || '',   // Capacitor bunu notification.data.yer_id olarak verir
  });
  let jwt = await apnsJwt(sb);
  let r = await apnsIstek('api.push.apple.com', token, jwt, govde);
  if (r.durum === 403 && (r.neden === 'ExpiredProviderToken' || r.neden === 'InvalidProviderToken')) {
    jwt = await apnsJwt(sb, true);
    r = await apnsIstek('api.push.apple.com', token, jwt, govde);
  }
  if (r.durum === 400 && r.neden === 'BadDeviceToken') {
    const s = await apnsIstek('api.sandbox.push.apple.com', token, jwt, govde);
    return { ...s, ortam: 'sandbox' };
  }
  return { ...r, ortam: 'production' };
}

/* ===================== ana akış ===================== */
Deno.serve(async (req: Request) => {
  try {
    const { bildirim_id } = await req.json().catch(() => ({}));
    if (!bildirim_id) return cevap({ hata: 'bildirim_id gerekli' }, 400);

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Bildirimi DB'den oku — içerik dışarıdan gelmez
    const { data: b } = await sb.from('turbedar_bildirimler')
      .select('id, kullanici_id, baslik, govde, yer_id, push_gonderildi')
      .eq('id', bildirim_id).maybeSingle();
    if (!b) return cevap({ hata: 'bildirim bulunamadı' }, 404);
    if (b.push_gonderildi) return cevap({ durum: 'zaten gönderilmiş' });

    // Kullanıcının cihaz kanalları
    const { data: p } = await sb.from('turbedar_profiller')
      .select('push_token, push_web, push_ios').eq('id', b.kullanici_id).maybeSingle();

    // Tekrar denemeyi önle: kanal olsun olmasın işaretle
    await sb.from('turbedar_bildirimler').update({ push_gonderildi: true }).eq('id', b.id);

    const sonuclar: Record<string, unknown> = {};

    /* --- 1) Android APK (FCM) --- */
    if (p?.push_token) {
      try {
        const saHam = Deno.env.get('FCM_SERVICE_ACCOUNT');
        if (!saHam) throw new Error('FCM_SERVICE_ACCOUNT secret tanımlı değil');
        const sa = JSON.parse(saHam);
        const erisim = await fcmErisimTokeni(sa);
        const fcmRes = await fetch(
          `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${erisim}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: {
                token: p.push_token,
                notification: { title: b.baslik, body: b.govde || '' },
                data: { yer_id: b.yer_id || '' },
                android: {
                  priority: 'high',
                  notification: {
                    icon: 'ic_stat_notification',   // beyaz silüet — android/app/src/main/res/drawable-*/ altında olmalı
                    color: '#2F5C46',                 // zümrüt yeşili — Türbedar marka rengi
                  },
                },
              },
            }),
          },
        );
        const sonuc = await fcmRes.json();
        const kayitsiz =
          sonuc?.error?.status === 'NOT_FOUND' ||
          sonuc?.error?.details?.some?.((d: { errorCode?: string }) => d.errorCode === 'UNREGISTERED');
        if (kayitsiz) {
          await sb.from('turbedar_profiller').update({ push_token: null }).eq('id', b.kullanici_id);
          sonuclar.fcm = 'token geçersizdi, temizlendi';
        } else {
          sonuclar.fcm = fcmRes.ok ? 'gönderildi' : { hata: sonuc };
        }
      } catch (e) {
        sonuclar.fcm = { hata: String(e) };
      }
    } else {
      sonuclar.fcm = 'token yok, atlandı';
    }

    /* --- 2) Web Push (iOS ana ekran PWA + tarayıcılar) --- */
    const w = p?.push_web as { endpoint?: string; p256dh?: string; auth?: string } | null;
    if (w?.endpoint && w.p256dh && w.auth) {
      try {
        const r = await webPushGonder(w as { endpoint: string; p256dh: string; auth: string }, {
          baslik: b.baslik,
          govde: b.govde || '',
          yer_id: b.yer_id || null,
          bildirim_id: b.id,
        });
        // 404/410 = abonelik ölmüş (uygulama silinmiş/izin geri alınmış) → temizle
        if (r.durum === 404 || r.durum === 410) {
          await sb.from('turbedar_profiller').update({ push_web: null }).eq('id', b.kullanici_id);
          sonuclar.web = 'abonelik geçersizdi, temizlendi';
        } else if (r.durum >= 200 && r.durum < 300) {
          sonuclar.web = 'gönderildi';
        } else {
          sonuclar.web = { durum: r.durum, hata: r.hata };
        }
      } catch (e) {
        sonuclar.web = { hata: String(e) };
      }
    } else {
      sonuclar.web = 'abonelik yok, atlandı';
    }

    /* --- 3) iPhone uygulaması (APNs) --- */
    if (p?.push_ios) {
      try {
        const r = await apnsGonder(sb, p.push_ios, b.baslik, b.govde || '', b.yer_id);
        // 410 Unregistered = uygulama silinmiş / bildirim kapatılmış; iki ortamda da
        // BadDeviceToken = jeton bu uygulamaya ait değil → ikisinde de temizle
        if (r.durum === 410 || (r.durum === 400 && r.neden === 'BadDeviceToken')) {
          await sb.from('turbedar_profiller').update({ push_ios: null }).eq('id', b.kullanici_id);
          sonuclar.apns = `jeton geçersizdi (${r.neden}), temizlendi`;
        } else {
          sonuclar.apns = r.durum === 200 ? `gönderildi (${r.ortam})` : { durum: r.durum, neden: r.neden, ortam: r.ortam };
        }
      } catch (e) {
        sonuclar.apns = { hata: String(e) };
      }
    } else {
      sonuclar.apns = 'jeton yok, atlandı';
    }

    return cevap({ durum: 'islendi', sonuclar });
  } catch (e) {
    return cevap({ hata: String(e) }, 500);
  }
});
