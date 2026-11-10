import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.71.0";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
function ANTHROPIC_VAR_MI() { return !!ANTHROPIC_API_KEY; }
// Model zinciri: Google tarafinda 503 (asiri yuk) sik yasandigi icin tek modele bagli kalmiyoruz.
// Sirayla denenir, ilk basarili yanit kullanilir. Liste 3 Eyl 2026'da ListModels ile dogrulandi.
// 6 Eki 2026: 3.6 ücretsiz günlük kotası (429) doldu, 3.8 sürekli 503 veriyor; o gün yanıt veren tek model 3.7 olduğu için başa alındı.
// 14 Eki 2026: flash modellerin hepsinin günlük kotası (20) aynı gün doldu → ayrı kotalı lite modeller sona eklendi.
// gemini-4-argon listede var ama ücretsiz kotası 0 (faturalandırma ister); gemini-2.5-flash-lite artık yeni kullanıcıya 404.
// 4 Kas 2026: ListModels yeniden doğrulandı (3.8-flash en yeni flash); gemini-2.5-flash artık yeni kullanıcıya 404 → zincirden çıkarıldı.
const MODELLER = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]; // lite modeller son çare: ayrı günlük kota, hızlı ama daha kısa cevap
const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
const bekle = (ms: number) => new Promise((c) => setTimeout(c, ms));
// Telefonlar ~60 sn'de isteği koparıyor; zincir bundan çok önce bitmeli (6 Eki 2026: 52 sn'lik zincir
// istemcide "Failed to send a request" olarak düştü). Yoğunlukta başarılı model ~17 sn sürdüğü için
// model başına 20 sn, toplam 45 sn.
const MODEL_ZAMAN_ASIMI_MS = ANTHROPIC_VAR_MI() ? 6000 : 20000;
// Son çare: Gemini zinciri tükenirse Claude Haiku 5.5 (ücretli, ANTHROPIC_API_KEY secret'ı varsa). Telefonun ~60 sn sınırı için
// Gemini bütçesi 45 → 14 sn'ye çekilir, Claude'a 15 sn ayrılır (toplam ≤ ~30 sn). Secret yoksa eski davranış (45 sn, Claude yok).
// 10 Kas 2026: öncelik Gemini → Sonnet; Sonnet süreye yetişmezse paralel başlatılan Haiku yanıtı kullanılır.
const CLAUDE_ANA = "claude-sonnet-5-5";
const CLAUDE_YEDEK = "claude-haiku-5-5";
const CLAUDE_ZAMAN_ASIMI_MS = 9000;
// 5 Kas 2026: Gemini 3.7 20 sn zaman aşımına uğrayıp Claude'a 30+ sn'de geçiliyordu, iOS 'bağlantı koptu' dedi → Gemini'ye en çok 14 sn (model başı 8 sn).
// 5 Kas 2026 (v20): iOS istemcisi ~14 sn'de bağlantıyı kopardığı için (200 dönen yanıtlar bile 'bağlantı koptu' oldu) Gemini 7 sn, Claude 9 sn.
const BUTCE_MS = ANTHROPIC_API_KEY ? 7000 : 45000;
const SEMA = {
  type: "object",
  properties: {
    aciklama: { type: "string" },
    mekan_sahipleri: {
      type: "array",
      items: { type: "object", properties: { ad: { type: "string" }, vefat: { type: "string" } }, required: ["ad", "vefat"], additionalProperties: false },
    },
    kaynak_baslik: { type: "string" },
    kaynak_url: { type: "string" },
  },
  required: ["aciklama", "mekan_sahipleri", "kaynak_baslik", "kaynak_url"],
  additionalProperties: false,
};

async function claudeModelIleOner(model: string, promptMetni: string, fotoBase64?: string, fotoMime?: string): Promise<Record<string, unknown> | null> {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const istemci = new Anthropic({ apiKey: ANTHROPIC_API_KEY, maxRetries: 0, timeout: CLAUDE_ZAMAN_ASIMI_MS });
    const icerik: Record<string, unknown>[] = [];
    if (fotoBase64) icerik.push({ type: "image", source: { type: "base64", media_type: fotoMime || "image/webp", data: fotoBase64 } });
    icerik.push({ type: "text", text: promptMetni });
    // deno-lint-ignore no-explicit-any
    const yanit: any = await (istemci.messages as any).create({
      model,
      max_tokens: 2000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SEMA } },
      messages: [{ role: "user", content: icerik }],
    });
    const metin = yanit?.content?.find((b: { type: string }) => b.type === "text")?.text;
    if (!metin) return null;
    console.log("Claude basarili", model);
    return JSON.parse(metin);
  } catch (e) {
    console.error("Claude hatasi", model, String((e as Error)?.message || e));
    return null;
  }
}

// Sonnet ve Haiku aynı anda başlar: Sonnet başarılıysa o, değilse Haiku (Haiku ucuz, çift istek maliyeti önemsiz).
async function claudeIleOner(promptMetni: string, fotoBase64?: string, fotoMime?: string): Promise<Record<string, unknown> | null> {
  if (!ANTHROPIC_API_KEY) return null;
  const yedek = claudeModelIleOner(CLAUDE_YEDEK, promptMetni, fotoBase64, fotoMime);
  const ana = await claudeModelIleOner(CLAUDE_ANA, promptMetni, fotoBase64, fotoMime);
  return ana ?? await yedek;
}

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
      const claudeSonuc = await claudeIleOner(promptMetni, foto_base64, foto_mime);
      if (claudeSonuc) {
        return new Response(JSON.stringify(claudeSonuc), { headers: { ...CORS_BASLIKLAR, "Content-Type": "application/json" } });
      }
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
