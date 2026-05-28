import { RecipeCategory } from '../types';
import { ParsedRecipe } from './recipeParser';
import { createIngredient, createStep } from './recipe';

// OpenRouter — OpenAI-compatible API aggregator with free model tier.
// Docs: https://openrouter.ai/docs
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Free model that supports vision (image input).
// Other free vision options: "meta-llama/llama-3.2-90b-vision-instruct:free"
const MODEL = 'google/gemini-2.0-flash-exp:free';

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
  if (options.sourceLanguage) {
    parts.push(`The recipe is written in ${options.sourceLanguage} — use this to accurately read the handwriting.`);
  }
  if (options.outputLanguage) {
    parts.push(`Translate all output text (title, ingredient names, steps) into ${options.outputLanguage}.`);
  } else {
    parts.push('Preserve the original language in your output.');
  }
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

// expo-image-picker on web returns base64 with a data URL prefix — strip it.
function stripDataUrlPrefix(base64: string): string {
  const idx = base64.indexOf(',');
  return idx !== -1 ? base64.slice(idx + 1) : base64;
}

export async function parseRecipeFromImage(
  imageBase64: string,
  uri: string,
  apiKey: string,
  options: ParseOptions = {},
  fileName?: string,
): Promise<ParsedRecipe> {
  const mimeType = getMimeType(uri, fileName);
  const cleanBase64 = stripDataUrlPrefix(imageBase64);
  const dataUrl = `data:${mimeType};base64,${cleanBase64}`;

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://myrecipefolder.app',
      'X-Title': 'MyRecipeFolder',
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: buildUserMessage(options) },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message ?? `OpenRouter API error ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('Empty response from AI');

  // Strip accidental markdown code fences if model includes them
  const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(jsonStr);

  return {
    title:    parsed.title    ?? 'Untitled Recipe',
    category: (parsed.category ?? 'Other') as RecipeCategory,
    ingredients: (parsed.ingredients ?? []).map(
      (ing: { quantity: string; unit: string; name: string }) =>
        createIngredient({ name: ing.name, quantity: ing.quantity ?? '', unit: ing.unit ?? '' }),
    ),
    steps: (parsed.steps ?? []).map((instruction: string, i: number) =>
      createStep(i + 1, instruction),
    ),
  };
}
