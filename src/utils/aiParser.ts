import { RecipeCategory } from '../types';
import { ParsedRecipe } from './recipeParser';
import { createIngredient, createStep } from './recipe';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 10_000;

// ── Model rotation list ───────────────────────────────────────────────────────
// Ordered best-first. All confirmed free + vision on OpenRouter.
// The cycling logic tries each in order; skips on timeout or API error.

export interface ModelOption {
  id: string;
  label: string;
  hasReasoning: boolean;
}

export const VISION_MODELS: ModelOption[] = [
  { id: 'moonshotai/kimi-k2.6:free',                            label: 'Kimi K2.6',              hasReasoning: false },
  { id: 'google/gemma-4-31b-it:free',                           label: 'Gemma 4 31B',             hasReasoning: false },
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',   label: 'Nemotron 30B Reasoning',  hasReasoning: true  },
  { id: 'google/gemma-4-26b-a4b-it:free',                       label: 'Gemma 4 26B',             hasReasoning: false },
  { id: 'nvidia/nemotron-nano-12b-v2-vl:free',                  label: 'Nemotron 12B VL',         hasReasoning: false },
];

// ── Progress callback ─────────────────────────────────────────────────────────

export type SwitchReason = 'timeout' | 'error';

export interface ProgressUpdate {
  model: ModelOption;
  attempt: number;       // 1-based
  total: number;
  switchReason?: SwitchReason; // why the previous model was skipped
  switchFrom?: ModelOption;
}

export type OnProgress = (update: ProgressUpdate) => void;

// ── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a recipe extraction expert. Given an image of a recipe (handwritten, printed, or photographed), extract the content and return ONLY a valid JSON object with this exact structure:

{
  "title": "recipe name",
  "category": "one of: Pasta | Chicken | Beef | Fish | Vegetarian | Dessert | Soup | Salad | Other",
  "ingredients": [
    { "quantity": "numeric string or empty", "unit": "measurement or empty", "name": "ingredient name" }
  ],
  "steps": ["step 1 text", "step 2 text"]
}

Rules:
- quantity: number as string ("2", "1/2", "200"). Empty string if none.
- unit: measurement word ("cups", "tbsp", "g", "כוסות"). Empty string if none (e.g. "3 eggs"). Use "to taste" for taste-adjusted items.
- For serving/plating/tips/notes sections, add "— {Section Name} —" as a separator step.
- Preserve the original language of the recipe in your output unless asked to translate.
- Apply reasoning to handle difficult handwriting, OCR-like noise, and multi-column layouts.
- Return ONLY the JSON object — no markdown, no code fences, no explanation.`;

export interface ParseOptions {
  sourceLanguage?: string;
  outputLanguage?: string;
}

function buildUserMessage(options: ParseOptions): string {
  const parts = ['Extract the recipe from this image.'];
  if (options.sourceLanguage)
    parts.push(`The recipe is written in ${options.sourceLanguage} — use this to accurately read the handwriting.`);
  if (options.outputLanguage)
    parts.push(`Translate all output text (title, ingredient names, steps) into ${options.outputLanguage}.`);
  else
    parts.push('Preserve the original language in your output.');
  return parts.join(' ');
}

function getMimeType(uri: string, fileName?: string): string {
  const name = (fileName ?? uri).toLowerCase();
  if (name.includes('.png'))  return 'image/png';
  if (name.includes('.webp')) return 'image/webp';
  if (name.includes('.heic')) return 'image/heic';
  if (name.includes('.heif')) return 'image/heif';
  return 'image/jpeg';
}

function stripDataUrlPrefix(base64: string): string {
  const idx = base64.indexOf(',');
  return idx !== -1 ? base64.slice(idx + 1) : base64;
}

// ── Single-model attempt with timeout ────────────────────────────────────────

async function tryModel(
  modelId: string,
  dataUrl: string,
  apiKey: string,
  userMessage: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_URL, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://myrecipefolder.app',
        'X-Title': 'MyRecipeFolder',
      },
      body: JSON.stringify({
        model: modelId,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: userMessage },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `HTTP ${response.status}`);
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';
    if (!content) throw new Error('Empty response');
    return content;
  } finally {
    clearTimeout(timer);
  }
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function parseRecipeFromImage(
  imageBase64: string,
  uri: string,
  apiKey: string,
  options: ParseOptions = {},
  fileName?: string,
  onProgress?: OnProgress,
): Promise<ParsedRecipe & { usedModel: ModelOption }> {
  const mimeType = getMimeType(uri, fileName);
  const dataUrl = `data:${mimeType};base64,${stripDataUrlPrefix(imageBase64)}`;
  const userMessage = buildUserMessage(options);

  const errors: string[] = [];
  let prevModel: ModelOption | undefined;
  let prevReason: SwitchReason | undefined;

  for (let i = 0; i < VISION_MODELS.length; i++) {
    const model = VISION_MODELS[i];

    onProgress?.({
      model,
      attempt: i + 1,
      total: VISION_MODELS.length,
      switchReason: prevReason,
      switchFrom: prevModel,
    });

    try {
      const rawContent = await tryModel(model.id, dataUrl, apiKey, userMessage);

      // Strip accidental code fences
      const jsonStr = rawContent
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(jsonStr);

      return {
        title:    parsed.title    ?? 'Untitled Recipe',
        category: (parsed.category ?? 'Other') as RecipeCategory,
        ingredients: (parsed.ingredients ?? []).map(
          (ing: { quantity: string; unit: string; name: string }) =>
            createIngredient({ name: ing.name, quantity: ing.quantity ?? '', unit: ing.unit ?? '' }),
        ),
        steps: (parsed.steps ?? []).map((instruction: string, idx: number) =>
          createStep(idx + 1, instruction),
        ),
        usedModel: model,
      };
    } catch (e: any) {
      const isTimeout = e?.name === 'AbortError';
      const reason = isTimeout ? 'timeout' : 'error';
      const msg = isTimeout ? 'Timed out' : (e?.message ?? 'Unknown error');
      errors.push(`${model.label}: ${msg}`);
      prevModel = model;
      prevReason = reason;
      console.warn(`[AI] ${model.label} failed (${reason}): ${msg}`);
    }
  }

  // All models exhausted
  throw new Error(
    `All models failed.\n${errors.join('\n')}`,
  );
}
