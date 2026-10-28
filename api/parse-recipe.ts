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

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

// Nutrition limits: anything outside these is treated as a bad estimate, not stored.
const MAX_INGREDIENTS = 80;
const MAX_FIELD = 200;
const MAX_KCAL_PER_SERVING = 10_000;
const MAX_MACRO_G = 1_000;

const NUTRITION_PROPS = {
  caloriesPerServing: { type: 'INTEGER' },
  proteinG: { type: 'INTEGER' },
  carbsG:   { type: 'INTEGER' },
  fatG:     { type: 'INTEGER' },
  ingredientCalories: {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: { name: { type: 'STRING' }, kcal: { type: 'INTEGER' } },
      required: ['name', 'kcal'],
    },
  },
};
const NUTRITION_REQUIRED = ['caloriesPerServing', 'proteinG', 'carbsG', 'fatG', 'ingredientCalories'];

const NUTRITION_RULES = `Nutrition (an estimate, per serving):
- caloriesPerServing: total kcal of the whole recipe divided by servings, rounded to a whole number.
- proteinG, carbsG, fatG: grams per serving, rounded.
- ingredientCalories: kcal each ingredient contributes to the WHOLE recipe, using the ingredient name as written. Use 0 for water, salt, spices and "to taste" items.
- Use typical edible weights (e.g. a whole chicken without bones, a medium onion ≈ 110 g) when no weight is given.`;

const NUTRITION_SYSTEM_PROMPT = `You are a nutrition estimator. You receive a recipe's ingredient list (in any language) and its number of servings, and estimate its nutrition.

${NUTRITION_RULES}`;

const inRange = (v: unknown, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;

const validServings = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 100;

/**
 * Model output is untrusted: keep only well-formed, in-range numbers. Returns null if the estimate is unusable.
 * When the per-ingredient breakdown is usable, the per-serving figure is derived from it, so the headline
 * always equals the breakdown's total ÷ servings (the model's own arithmetic doesn't always agree).
 */
function cleanNutrition(raw: Record<string, unknown>, servings: unknown) {
  const { caloriesPerServing, proteinG, carbsG, fatG, ingredientCalories } = raw;
  if (![proteinG, carbsG, fatG].every((g) => inRange(g, MAX_MACRO_G))) return null;
  const ingredients = (Array.isArray(ingredientCalories) ? ingredientCalories : [])
    .filter((i) => typeof i?.name === 'string' && inRange(i?.kcal, MAX_KCAL_PER_SERVING * 100))
    .slice(0, MAX_INGREDIENTS)
    .map((i) => ({ name: i.name.slice(0, MAX_FIELD), kcal: Math.round(i.kcal) }));
  const total = ingredients.reduce((sum, i) => sum + i.kcal, 0);
  const perServing = total > 0 && validServings(servings) ? total / servings : caloriesPerServing;
  if (!inRange(perServing, MAX_KCAL_PER_SERVING)) return null;
  return {
    caloriesPerServing: Math.round(perServing),
    nutrition: {
      proteinG: Math.round(proteinG as number),
      carbsG: Math.round(carbsG as number),
      fatG: Math.round(fatG as number),
      ingredients,
    },
  };
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
    servings: { type: 'INTEGER' },
    ...NUTRITION_PROPS,
  },
  required: ['title', 'category', 'ingredients', 'steps', 'servings', ...NUTRITION_REQUIRED],
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
- servings: the number of servings stated in the recipe; if none is stated, your best estimate from the quantities.
- Apply visual reasoning to handle difficult handwriting, OCR-like noise, multi-column layouts, and crossed-out text.

${NUTRITION_RULES}

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

async function callGemini(apiKey: string, systemPrompt: string, parts: unknown[], schema: unknown) {
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
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
  const responseParts: { text?: string }[] = data.candidates?.[0]?.content?.parts ?? [];
  const text = responseParts.find((p) => p.text !== undefined)?.text;
  if (!text) return json(502, { error: 'No response from Gemini' });
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return json(502, { error: 'Gemini returned invalid JSON' });
  }
}

async function handleNutrition(apiKey: string, body: Record<string, unknown> | null): Promise<Response> {
  const { ingredients, servings } = body ?? {};
  if (!validServings(servings)) {
    return json(400, { error: 'Servings must be between 1 and 100' });
  }
  if (!Array.isArray(ingredients) || ingredients.length === 0 || ingredients.length > MAX_INGREDIENTS) {
    return json(400, { error: `Send between 1 and ${MAX_INGREDIENTS} ingredients` });
  }
  const lines: string[] = [];
  for (const ing of ingredients) {
    const fields = [ing?.quantity, ing?.unit, ing?.name];
    if (!fields.every((f) => typeof f === 'string' && f.length <= MAX_FIELD) || !ing.name.trim()) {
      return json(400, { error: 'Invalid ingredient' });
    }
    lines.push(`- ${fields.join(' ').replace(/\s+/g, ' ').trim()}`);
  }

  const result = await callGemini(
    apiKey,
    NUTRITION_SYSTEM_PROMPT,
    [{ text: `Servings: ${servings}\nIngredients:\n${lines.join('\n')}` }],
    { type: 'OBJECT', properties: NUTRITION_PROPS, required: NUTRITION_REQUIRED },
  );
  if (result instanceof Response) return result;
  const cleaned = cleanNutrition(result, servings);
  return cleaned ? json(200, cleaned) : json(502, { error: 'Could not estimate calories' });
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(500, { error: 'Server is not configured' });

  const userId = await getUserId(request);
  if (!userId) return json(401, { error: 'Not authenticated' });

  const body = await request.json().catch(() => null);
  const isNutrition = body?.mode === 'nutrition';
  // Separate budgets so estimating old recipes can't use up the scan allowance.
  if (rateLimited(`${userId}:${isNutrition ? 'nutrition' : 'scan'}`)) {
    return json(429, { error: 'Too many requests, try again in a few minutes' });
  }
  if (isNutrition) return handleNutrition(apiKey, body);

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

  const result = await callGemini(apiKey, SYSTEM_PROMPT, [
    ...images.map((img: { data: string; mimeType: string }) => ({
      inline_data: { mime_type: img.mimeType, data: img.data },
    })),
    { text: buildPrompt(images.length, sourceLanguage, outputLanguage) },
  ], RECIPE_SCHEMA);
  if (result instanceof Response) return result;

  // A bad nutrition estimate shouldn't fail the scan; the client just shows "Calculate calories".
  const { caloriesPerServing: _c, proteinG: _p, carbsG: _cb, fatG: _f, ingredientCalories: _i, ...recipe } = result;
  return json(200, { ...recipe, ...(cleanNutrition(result, result.servings) ?? {}) });
}
