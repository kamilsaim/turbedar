import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
// NOT: 'gemini-flash-latest' alias'ı denendi ama sürekli 503 (aşırı yük) döndürdü;
// Google'ın kendi 404 hata mesajı 'gemini-3.6-flash'ı öneriyor ve o güvenilir çalışıyor.
// Gelecekte yeni bir flash modeli çıkarsa burayı güncelle.
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;

const CORS_BASLIKLAR = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_BASLIKLAR });
  }
  try {
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

    const yanit = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(istek),
    });
    if (!yanit.ok) {
      return new Response(JSON.stringify({ error: `Gemini hatası: ${yanit.status}` }), {
        status: 502,
        headers: { ...CORS_BASLIKLAR, "Content-Type": "application/json" },
      });
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
