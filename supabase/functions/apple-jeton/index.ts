// Türbedar — yerel iOS Apple girişinin yetki kodunu yenileme jetonuna çevirir.
// Güvenlik: verify_jwt=true; jeton yalnızca çağıranın KENDI profiline yazılır.
// Neden: hesap silinirken Apple jetonu iptal edilmeli (App Store 5.1.1(v)); yerel girişte
// Apple refresh token yerine 5 dk geçerli bir `authorizationCode` verir, o hemen değiştirilmeli.
// Yerel uygulamanın istemcisi bundle id'dir (web akışı ise Services ID `.web` kullanır).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { SignJWT, importPKCS8 } from 'npm:jose@5';

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

const IOS_ISTEMCI = Deno.env.get('APPLE_BUNDLE_ID') || 'com.kamilsaim.turbedar';

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '').trim();
    if (!jwt) return cevap({ hata: 'Giriş gerekli' }, 401);

    const sbAnon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await sbAnon.auth.getUser(jwt);
    if (userErr || !userData?.user) return cevap({ hata: 'Geçersiz oturum' }, 401);
    const uid = userData.user.id;

    const { kod } = await req.json().catch(() => ({}));
    if (typeof kod !== 'string' || kod.length < 10) return cevap({ hata: 'Yetki kodu eksik' }, 400);

    const govde = new URLSearchParams({
      client_id: IOS_ISTEMCI,
      client_secret: await appleIstemciSirri(IOS_ISTEMCI),
      code: kod,
      grant_type: 'authorization_code',
    });
    const r = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: govde,
    });
    const sonuc = await r.json().catch(() => ({}));
    if (!r.ok || !sonuc.refresh_token) {
      console.log('Apple kod değişimi başarısız', r.status, JSON.stringify(sonuc));
      return cevap({ hata: 'Apple jetonu alınamadı' }, 502);
    }

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error } = await sb.from('turbedar_profiller')
      .update({ apple_jeton: sonuc.refresh_token, apple_jeton_istemci: 'ios' })
      .eq('id', uid);
    if (error) return cevap({ hata: 'Kaydedilemedi: ' + error.message }, 500);

    console.log('Apple jetonu kaydedildi (ios)');
    return cevap({ durum: 'tamam' });
  } catch (e) {
    return cevap({ hata: String(e) }, 500);
  }
});
