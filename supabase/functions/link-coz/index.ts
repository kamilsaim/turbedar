import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Kısa harita linkini (maps.app.goo.gl, goo.gl/maps, maps.apple/p/...) açar: yönlendirmeleri izleyip
// son adresi döner; adreste koordinat yoksa sayfa gövdesinde arar. Yalnız Google/Apple alan adları
// izlenir (SSRF koruması). Kimlik istemez — girişsiz kullanıcı da harita aramasında link yapıştırabilir.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const IZINLI = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|maps\.apple|maps\.apple\.com|consent\.google\.com|([a-z0-9-]+\.)?google\.[a-z]{2,3}(\.[a-z]{2})?)$/i;
const yanit = (v: unknown, durum = 200) =>
  new Response(JSON.stringify(v), { status: durum, headers: { ...CORS, "Content-Type": "application/json" } });

function izinli(adres: string): URL | null {
  try {
    const u = new URL(adres);
    return u.protocol === "https:" && IZINLI.test(u.hostname) ? u : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { url } = await req.json();
    let u = izinli(String(url || ""));
    if (!u) return yanit({ error: "Desteklenmeyen bağlantı" }, 400);
    let govde = "";
    for (let i = 0; i < 6; i++) {
      const r = await fetch(u.href, {
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "Accept-Language": "tr" },
        signal: AbortSignal.timeout(5000),
      });
      const yer = r.headers.get("location");
      if (r.status >= 300 && r.status < 400 && yer) {
        await r.body?.cancel();
        const sonraki = izinli(new URL(yer, u).href);
        if (!sonraki) break;
        // Apple/Google son adreste koordinat taşıyorsa sayfayı indirmeye gerek yok
        if (/[?&](coordinate|ll|q)=-?\d|!3d-?\d|@-?\d+\.\d+,/.test(decodeURIComponent(sonraki.href))) { u = sonraki; break; }
        // Google çerez onayı sayfası: asıl adres 'continue' parametresinde
        const devam = sonraki.hostname.startsWith("consent.") ? izinli(sonraki.searchParams.get("continue") || "") : null;
        u = devam || sonraki;
        if (devam) break;
        continue;
      }
      if (r.ok) govde = (await r.text()).slice(0, 400000); else await r.body?.cancel();
      break;
    }
    let lat: number | null = null, lng: number | null = null;
    if (govde) {
      const m = govde.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
        govde.match(/center=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/) ||
        govde.match(/@(-?\d+\.\d{3,}),(-?\d+\.\d{3,})/) ||
        govde.match(/"latitude"\s*:\s*(-?\d+\.\d+)\s*,\s*"longitude"\s*:\s*(-?\d+\.\d+)/);
      if (m) { lat = Number(m[1]); lng = Number(m[2]); }
    }
    return yanit({ url: u.href, lat, lng });
  } catch (e) {
    return yanit({ error: String((e as Error)?.message || e) }, 500);
  }
});
