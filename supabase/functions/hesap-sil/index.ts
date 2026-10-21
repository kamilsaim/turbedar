// Türbedar — Hesap silme
// Güvenlik: verify_jwt=true, yalnızca giriş yapmış kişi KENDI hesabını silebilir.
// Topluluğa ait katkılar (onaylı kayıtlar, fotoğraflar) SILINMEZ — isimsiz bir
// sistem profiline ("Silinmiş Kullanıcı") devredilir. Kişisel veriler (mesaj,
// bildirim, ziyaret geçmişi) auth kullanıcısı silinince cascade ile tamamen kalkar.
// Apple ile giriş yapmış hesapta Apple yenileme jetonu (profil.apple_jeton) varsa
// silmeden önce Apple'da iptal edilir (App Store 5.1.1(v) şartı).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { SignJWT, importPKCS8 } from 'npm:jose@5';

function cevap(obj: unknown, durum = 200) {
  return new Response(JSON.stringify(obj), {
    status: durum,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ICERIK_TABLOLARI = ['turbedar_yerler', 'turbedar_revizyonlar', 'turbedar_katki_notlari'];
const PLACEHOLDER_EMAIL = 'silinmis-kullanici@turbedar.internal';
// Web akışındaki Apple girişi Services ID ile yapılır; jeton o istemciye aittir
const APPLE_ISTEMCI = Deno.env.get('APPLE_SERVICES_ID') || 'com.kamilsaim.turbedar.web';

// Apple istemci sırrı: APNs ile aynı .p8 anahtarı (Sign in with Apple yetkisi de var)
async function appleIstemciSirri(): Promise<string> {
  const ham = (Deno.env.get('APNS_KEY_P8') || '').trim();
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  if (!ham || !keyId || !teamId) throw new Error('APNS_KEY_P8 / APNS_KEY_ID / APNS_TEAM_ID secret tanımlı değil');
  const pem = ham.includes('BEGIN PRIVATE KEY') ? ham.replace(/\\n/g, '\n') : atob(ham);
  const anahtar = await importPKCS8(pem, 'ES256');
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setSubject(APPLE_ISTEMCI)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(anahtar);
}

async function appleJetonIptal(jeton: string) {
  const govde = new URLSearchParams({
    client_id: APPLE_ISTEMCI,
    client_secret: await appleIstemciSirri(),
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
    const { data: profil } = await sb.from('turbedar_profiller').select('kurucu, apple_jeton').eq('id', uid).maybeSingle();
    if (profil?.kurucu) return cevap({ hata: 'Kurucu hesap silinemez. Önce başka bir kurucu atanmalı.' }, 403);

    // Apple jetonunu iptal et — başarısız olsa da silme sürer (kullanıcının silme hakkı engellenmez)
    if (profil?.apple_jeton) {
      try { await appleJetonIptal(profil.apple_jeton); }
      catch (e) { console.log('Apple jeton iptali hatası', String(e)); }
    }

    // Placeholder profili bul, yoksa oluştur
    const { data: mevcut } = await sb.from('turbedar_profiller').select('id').eq('ad', 'Silinmiş Kullanıcı').maybeSingle();
    let placeholderId: string;
    if (mevcut) {
      placeholderId = mevcut.id;
    } else {
      const { data: yeni, error: cErr } = await sb.auth.admin.createUser({
        email: PLACEHOLDER_EMAIL,
        email_confirm: true,
      });
      if (cErr || !yeni?.user) return cevap({ hata: 'Sistem profili oluşturulamadı: ' + cErr?.message }, 500);
      placeholderId = yeni.user.id;
      // handle_new_user tetikleyicisi profil satırını zaten oluşturdu — sadece adını güncelliyoruz
      await sb.from('turbedar_profiller').update({ ad: 'Silinmiş Kullanıcı', rol: 'uye', kurucu: false }).eq('id', placeholderId);
    }

    // Topluluğa ait katkıları isimsizleştir (içerik KALIR, sadece sahiplik devrolur)
    for (const tablo of ICERIK_TABLOLARI) {
      await sb.from(tablo).update({ ekleyen_id: placeholderId }).eq('ekleyen_id', uid);
      await sb.from(tablo).update({ onaylayan_id: placeholderId }).eq('onaylayan_id', uid);
    }
    await sb.from('turbedar_fotograflar').update({ ekleyen_id: placeholderId }).eq('ekleyen_id', uid);

    // Kişisel verileri ve hesabı tamamen sil (profil + mesaj + bildirim + ziyaret cascade ile gider)
    const { error: delErr } = await sb.auth.admin.deleteUser(uid);
    if (delErr) return cevap({ hata: 'Hesap silinemedi: ' + delErr.message }, 500);

    return cevap({ durum: 'silindi' });
  } catch (e) {
    return cevap({ hata: String(e) }, 500);
  }
});
