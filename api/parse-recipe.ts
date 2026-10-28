// Vercel serverless function: the only place the Gemini key lives.
// The client sends images + a Supabase access token; we verify the token,
// rate-limit per user, validate input, and call Gemini server-side.
//
// Env (Vercel project settings, NOT prefixed with EXPO_PUBLIC_):
//   GEMINI_API_KEY
//   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (already set for the web build)

const MODEL = 'gemini-3.8-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const MAX_IMAGES = 10;
const MAX_TOTAL_BASE64 = 4_000_000; // Vercel caps request bodies at 4.5 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const LANG_RE = /^[\p{L} ]{1,30}$/u; // language names only — they are interpolated into the prompt

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;
// shortcut: per-instance memory, resets on cold start and isn't shared across instances;
// upgrade to a Supabase table or Vercel KV if abuse shows up. Also set a quota cap on the key in Google Cloud.
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) { hits.set(userId, recent); return true; }
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

const RECIPE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title:    { type: 'STRING' },
    category: {
      type: 'STRING',
      enum: ['Pasta', 'Chicken', 'Beef', 'Fish', 'Vegetarian', 'Dessert', 'Soup', 'Salad', 'High Protein', 'Bread', 'Other'],
    },
    ingredients: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          quantity: { type: 'STRING' },
          unit:     { type: 'STRING' },
          name:     { type: 'STRING' },
        },
        required: ['quantity', 'unit', 'name'],
      },
    },
    steps: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['title', 'category', 'ingredients', 'steps'],
};

const SYSTEM_PROMPT = `You are a recipe extraction expert. You receive one or more images of a recipe — handwritten, printed, or photographed from a book — and extract it into a single structured JSON recipe.

Rules:
- title: The recipe name (usually the first prominent heading).
- category: Best match from the provided enum.
- ingredients: Each ingredient as {quantity, unit, name}.
  • quantity: numeric string ("2", "1/2", "200"). Empty string if none.
  • unit: measurement word. Empty string for unitless ingredients (e.g. "3 eggs"). Use "to taste" for taste-adjusted items.
  • name: ingredient name.
- steps: Each preparation instruction as one complete sentence.
  For serving/plating/tips/notes/storage sections, add "— {Section Name} —" as a separator step before those sentences.
- Apply visual reasoning to handle difficult handwriting, OCR-like noise, multi-column layouts, and crossed-out text.

When multiple images are provided, they are all part of the SAME recipe (e.g. consecutive pages, or the front and back of a recipe card) — merge them into one coherent recipe rather than returning duplicates or treating them as separate recipes. The images may not be in reading order; use context (ingredient lists, step numbering, headings) to determine the correct order and avoid repeating content that appears in more than one image.`;

function buildPrompt(imageCount: number, sourceLanguage?: string, outputLanguage?: string): string {
  const lines = [
    imageCount > 1
      ? `Extract the recipe from these ${imageCount} images, treating them as one recipe.`
      : 'Extract the recipe from this image.',
  ];
  if (sourceLanguage) {
    lines.push(`The recipe is written in ${sourceLanguage} — use this to accurately read the handwriting and characters.`);
  }
  if (outputLanguage) {
    lines.push(`Translate all output text (title, ingredient names, step instructions) into ${outputLanguage}.`);
  } else {
    lines.push('Preserve the original language of the recipe in your output.');
  }
  return lines.join(' ');
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

async function getUserId(request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  return typeof user?.id === 'string' ? user.id : null;
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(500, { error: 'Server is not configured' });

  const userId = await getUserId(request);
  if (!userId) return json(401, { error: 'Not authenticated' });
  if (rateLimited(userId)) return json(429, { error: 'Too many scans — try again in a few minutes' });

  const body = await request.json().catch(() => null);
  const images: unknown = body?.images;
  const { sourceLanguage, outputLanguage } = body ?? {};

  if (!Array.isArray(images) || images.length === 0 || images.length > MAX_IMAGES) {
    return json(400, { error: `Send between 1 and ${MAX_IMAGES} images` });
  }
  let total = 0;
  for (const img of images) {
    if (typeof img?.data !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(img.data) || !ALLOWED_MIME.includes(img?.mimeType)) {
      return json(400, { error: 'Invalid image' });
    }
    total += img.data.length;
  }
  if (total > MAX_TOTAL_BASE64) return json(413, { error: 'Images are too large' });
  for (const lang of [sourceLanguage, outputLanguage]) {
    if (lang !== undefined && (typeof lang !== 'string' || !LANG_RE.test(lang))) {
      return json(400, { error: 'Invalid language' });
    }
  }

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: 'user',
        parts: [
          ...images.map((img: { data: string; mimeType: string }) => ({
            inline_data: { mime_type: img.mimeType, data: img.data },
          })),
          { text: buildPrompt(images.length, sourceLanguage, outputLanguage) },
        ],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RECIPE_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    // Google's reason (e.g. API_KEY_HTTP_REFERRER_BLOCKED, SERVICE_DISABLED) is what tells a bad key apart from a bad request.
    console.error('[parse-recipe] Gemini error', response.status, err?.error?.status,
      err?.error?.details?.find((d: { reason?: string }) => d?.reason)?.reason, err?.error?.message);
    return json(502, { error: `Recipe analysis failed (${response.status})` });
  }

  const data = await response.json();
  const parts: { text?: string }[] = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.find((p) => p.text !== undefined)?.text;
  if (!text) return json(502, { error: 'No response from Gemini' });

  try {
    return json(200, JSON.parse(text));
  } catch {
    return json(502, { error: 'Gemini returned invalid JSON' });
  }
}
