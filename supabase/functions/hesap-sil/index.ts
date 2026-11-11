// Türbedar — Hesap silme
// Güvenlik: verify_jwt=true, yalnızca giriş yapmış kişi KENDI hesabını silebilir.
// Topluluğa ait katkılar (onaylı kayıtlar, fotoğraflar) SILINMEZ — isimsiz bir
// sistem profiline ("Silinmiş Kullanıcı") devredilir. Kişisel veriler (mesaj,
// bildirim, ziyaret geçmişi) auth kullanıcısı silinince cascade ile tamamen kalkar.
// Apple ile giriş yapmış hesapta Apple yenileme jetonu (profil.apple_jeton) varsa
// silmeden önce Apple'da iptal edilir (App Store 5.1.1(v) şartı).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { SignJWT, importPKCS8 } from 'npm:jose@5';

// Tarayıcı/uygulama (turbedar.org, web.app, Capacitor) farklı kökenden çağırır: ön kontrol (OPTIONS)
// ve her yanıt CORS başlığı taşımalı, yoksa istek hiç gönderilmez ("Load failed").
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function cevap(obj: unknown, durum = 200) {
  return new Response(JSON.stringify(obj), {
    status: durum,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const ICERIK_TABLOLARI = ['turbedar_yerler', 'turbedar_revizyonlar', 'turbedar_katki_notlari'];
// "Silinmiş Kullanıcı" sistem hesabı (auth e-postası silinmis-kullanici@turbedar.internal, 21 Eki 2026)
const SISTEM_PROFIL_ID = Deno.env.get('SISTEM_PROFIL_ID') || '4e80d30b-df42-4a3a-89ce-43984217d3c6';
// Web akışındaki Apple girişi Services ID ile yapılır; yerel iOS girişi (apple-jeton) bundle id ile.
// Jeton hangi istemciye aitse iptal de o istemciyle yapılmalı (profil.apple_jeton_istemci).
const APPLE_WEB_ISTEMCI = Deno.env.get('APPLE_SERVICES_ID') || 'com.kamilsaim.turbedar.web';
const APPLE_IOS_ISTEMCI = Deno.env.get('APPLE_BUNDLE_ID') || 'com.kamilsaim.turbedar';

// Apple istemci sırrı: APNs ile aynı .p8 anahtarı (Sign in with Apple yetkisi de var)
async function appleIstemciSirri(istemci: string): Promise<string> {
  const ham = (Deno.env.get('APNS_KEY_P8') || '').trim();
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  if (!ham || !keyId || !teamId) throw new Error('APNS_KEY_P8 / APNS_KEY_ID / APNS_TEAM_ID secret tanımlı değil');
  const pem = ham.includes('BEGIN PRIVATE KEY') ? ham.replace(/\\n/g, '\n') : atob(ham);
  const anahtar = await importPKCS8(pem, 'ES256');
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setSubject(istemci)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(anahtar);
}

async function appleJetonIptal(jeton: string, istemci: string) {
  const govde = new URLSearchParams({
    client_id: istemci,
    client_secret: await appleIstemciSirri(istemci),
    token: jeton,
    token_type_hint: 'refresh_token',
  });
  const r = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: govde,
  });
  console.log('Apple jeton iptali', r.status, r.ok ? '' : await r.text().catch(() => ''));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '').trim();
    if (!jwt) return cevap({ hata: 'Giriş gerekli' }, 401);

    const sbAnon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await sbAnon.auth.getUser(jwt);
    if (userErr || !userData?.user) return cevap({ hata: 'Geçersiz oturum' }, 401);
    const uid = userData.user.id;

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Kurucu hesap silinemez (güvenlik)
    const { data: profil } = await sb.from('turbedar_profiller').select('kurucu, apple_jeton, apple_jeton_istemci').eq('id', uid).maybeSingle();
    if (profil?.kurucu) return cevap({ hata: 'Kurucu hesap silinemez. Önce başka bir kurucu atanmalı.' }, 403);

    // Apple jetonunu iptal et — başarısız olsa da silme sürer (kullanıcının silme hakkı engellenmez)
    if (profil?.apple_jeton) {
      const istemci = profil.apple_jeton_istemci === 'ios' ? APPLE_IOS_ISTEMCI : APPLE_WEB_ISTEMCI;
      try { await appleJetonIptal(profil.apple_jeton, istemci); }
      catch (e) { console.log('Apple jeton iptali hatası', String(e)); }
    }

    // Sistem profili SABİT kimlikle bulunur — ada göre aramak tehlikeliydi (kullanıcı adını
    // "Silinmiş Kullanıcı" yapınca sorgu bozuluyor, hesap silme herkes için kilitleniyordu).
    const placeholderId = SISTEM_PROFIL_ID;
    if (uid === placeholderId) return cevap({ hata: 'Sistem hesabı silinemez' }, 403);
    const { data: sistem, error: sErr } = await sb.from('turbedar_profiller').select('id').eq('id', placeholderId).maybeSingle();
    if (sErr || !sistem) return cevap({ hata: 'Sistem profili bulunamadı, silme yapılmadı' }, 500);

    // Topluluğa ait katkıları isimsizleştir (içerik KALIR, sadece sahiplik devrolur).
    // ekleyen_id FK'leri CASCADE: devir başarısızsa hesabı SİLME, yoksa katkılar da gider.
    const devirler: [string, string][] = [
      ...ICERIK_TABLOLARI.flatMap((t) => [[t, 'ekleyen_id'], [t, 'onaylayan_id']] as [string, string][]),
      ['turbedar_fotograflar', 'ekleyen_id'],
    ];
    for (const [tablo, sutun] of devirler) {
      const { error } = await sb.from(tablo).update({ [sutun]: placeholderId }).eq(sutun, uid);
      if (error) {
        console.log('Devir hatası', tablo, sutun, error.message);
        return cevap({ hata: 'Katkılar devredilemedi, hesap silinmedi. Lütfen tekrar deneyin.' }, 500);
      }
    }
    // Son güvence: kişiye bağlı katkı kalmadığını say
    for (const [tablo, sutun] of devirler) {
      const { count, error } = await sb.from(tablo).select('id', { count: 'exact', head: true }).eq(sutun, uid);
      if (error || (count ?? 0) > 0) {
        console.log('Devir doğrulanamadı', tablo, sutun, count, error?.message);
        return cevap({ hata: 'Katkılar devredilemedi, hesap silinmedi. Lütfen tekrar deneyin.' }, 500);
      }
    }

    // Kişisel verileri ve hesabı tamamen sil (profil + mesaj + bildirim + ziyaret cascade ile gider)
    const { error: delErr } = await sb.auth.admin.deleteUser(uid);
    if (delErr) return cevap({ hata: 'Hesap silinemedi: ' + delErr.message }, 500);

    return cevap({ durum: 'silindi' });
  } catch (e) {
    return cevap({ hata: String(e) }, 500);
  }
});
