import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
// Model zinciri: Google tarafinda 503 (asiri yuk) sik yasandigi icin tek modele bagli kalmiyoruz.
// Sirayla denenir, ilk basarili yanit kullanilir. Liste 3 Eyl 2026'da ListModels ile dogrulandi.
const MODELLER = ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-2.5-flash"];
const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
const bekle = (ms: number) => new Promise((c) => setTimeout(c, ms));
// Telefonlar ~60 sn'de isteği koparıyor; zincir bundan çok önce bitmeli (6 Eki 2026: 52 sn'lik zincir
// istemcide "Failed to send a request" olarak düştü). Model başına 15 sn, toplam 35 sn.
const MODEL_ZAMAN_ASIMI_MS = 15000;
const BUTCE_MS = 35000;

const CORS_BASLIKLAR = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_BASLIKLAR });
  }
  try {
    const baslangic = Date.now();
    const govde = await req.json();
    const { baslik, il, ilce, mahalle, ulke, foto_base64, foto_mime } = govde;

    const konumMetni = [mahalle, ilce, il, ulke].filter(Boolean).join(", ") || "konum belirtilmemiş";
    const promptMetni =
      `Sen Türkiye'de (ve dünyada) türbe, kümbet ve mezarları belgeleyen bir envanter uygulamasına yardım ediyorsun. ` +
      `Aşağıdaki yer için SADECE gerçekten emin olduğun, genel bilinen bilgiyi ver. Emin olmadığın bir alanı BOŞ BIRAK — asla uydurma. ` +
      `"kaynak_url" alanını yalnızca gerçekten bildiğin, genel erişilebilir bir kaynak (örn. Wikipedia sayfası) varsa doldur, aksi halde boş bırak.\n\n` +
      `Yerin adı: ${baslik || "(belirtilmemiş)"}\n` +
      `Konum: ${konumMetni}\n\n` +
      `Bazı yerlerde BİRDEN FAZLA kişi yatıyor olabilir (örn. bir aile kabri, birden çok âlimin ortak türbesi) — böyle bir durum biliyorsan hepsini ayrı ayrı listele, tek kişiyle sınırlama.\n\n` +
      `JSON şemasına uygun cevap ver: aciklama (2-4 cümlelik Türkçe tarihi/mimari açıklama), mekan_sahipleri (dizi — her eleman {ad: bilinen kişinin tam adı, vefat: varsa ölüm tarihi (miladi yıl veya hicri, örn. "1244" ya da "H. 642")}; kimse bilmiyorsan boş dizi), kaynak_baslik (varsa kaynağın adı), kaynak_url (varsa bağlantısı).`;

    const parcalar: Record<string, unknown>[] = [{ text: promptMetni }];
    if (foto_base64) {
      parcalar.push({ inline_data: { mime_type: foto_mime || "image/webp", data: foto_base64 } });
    }

    const istek = {
      contents: [{ parts: parcalar }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            aciklama: { type: "STRING" },
            mekan_sahipleri: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  ad: { type: "STRING" },
                  vefat: { type: "STRING" },
                },
              },
            },
            kaynak_baslik: { type: "STRING" },
            kaynak_url: { type: "STRING" },
          },
        },
      },
    };

    // Modeller sırayla denenir; toplam BUTCE_MS içinde kalınır. 500'de aynı model bir kez daha, diğer hatalarda sonraki model.
    let yanit: Response | null = null;
    let sonHata = "";
    for (const model of MODELLER) {
      for (let deneme = 0; deneme < 2; deneme++) {
        const kalan = BUTCE_MS - (Date.now() - baslangic);
        if (kalan < 3000) break; // süre bütçesi bitti — istemci bağlantıyı koparmadan "yoğun" cevabı dön
        if (deneme > 0) await bekle(1200);
        try {
          const r = await fetch(GEMINI_URL(model), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(istek),
            signal: AbortSignal.timeout(Math.min(MODEL_ZAMAN_ASIMI_MS, kalan)),
          });
          if (r.ok) { yanit = r; console.log("Gemini basarili", model); break; }
          sonHata = `${model}: ${r.status} ${(await r.text()).slice(0, 200)}`;
          console.error("Gemini hatasi", sonHata);
          // 500 = aynı modeli bir kez daha dene; 503/429 (aşırı yük) ve kalıcı hatalar = hemen sonraki model
          if (r.status !== 500) break;
        } catch (e) {
          sonHata = `${model}: ${String((e as Error)?.message || e)}`;
          console.error("Gemini istek hatasi", sonHata);
        }
      }
      if (yanit) break;
      if (BUTCE_MS - (Date.now() - baslangic) < 3000) break;
    }
    if (!yanit) {
      return new Response(
        JSON.stringify({ error: "Yapay zeka servisi şu an çok yoğun (Google tarafında geçici aşırı yük). Lütfen birkaç dakika sonra tekrar deneyin.", yogun: true, ayrinti: sonHata }),
        { status: 503, headers: { ...CORS_BASLIKLAR, "Content-Type": "application/json" } },
      );
    }
    const veri = await yanit.json();
    const metin = veri?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!metin) {
      return new Response(JSON.stringify({ error: "Öneri üretilemedi" }), {
        status: 502,
        headers: { ...CORS_BASLIKLAR, "Content-Type": "application/json" },
      });
    }
    const sonuc = JSON.parse(metin);
    return new Response(JSON.stringify(sonuc), {
      headers: { ...CORS_BASLIKLAR, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error)?.message || err) }), {
      status: 500,
      headers: { ...CORS_BASLIKLAR, "Content-Type": "application/json" },
    });
  }
});
