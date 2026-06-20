import { RecipeCategory } from '../types';
import { ParsedRecipe } from './recipeParser';
import { createIngredient, createStep } from './recipe';

// Gemini 2.5 Flash — multimodal, replaces Cloud Vision OCR + Cloud Translate entirely.
// The image is sent directly to Gemini which reads it (including handwriting) and
// returns structured recipe data in the requested output language.
//
const MODEL = 'gemini-2.5-flash';
const geminiUrl = (apiKey: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

const RECIPE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title:    { type: 'STRING' },
    category: {
      type: 'STRING',
      enum: ['Pasta', 'Chicken', 'Beef', 'Fish', 'Vegetarian', 'Dessert', 'Soup', 'Salad', 'High Protein', 'Other'],
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

export interface ParseOptions {
  /** BCP-47 code or language name (e.g. "he", "Hebrew") — helps with handwriting recognition */
  sourceLanguage?: string;
  /** Language name for output (e.g. "English", "Hebrew"). Omit to keep the recipe's original language. */
  outputLanguage?: string;
}

function buildPrompt(options: ParseOptions, imageCount: number): string {
  const lines = [
    imageCount > 1
      ? `Extract the recipe from these ${imageCount} images, treating them as one recipe.`
      : 'Extract the recipe from this image.',
  ];

  if (options.sourceLanguage) {
    lines.push(
      `The recipe is written in ${options.sourceLanguage} — use this to accurately read the handwriting and characters.`,
    );
  }

  if (options.outputLanguage) {
    lines.push(
      `Translate all output text (title, ingredient names, step instructions) into ${options.outputLanguage}.`,
    );
  } else {
    lines.push('Preserve the original language of the recipe in your output.');
  }

  return lines.join(' ');
}

function getMimeType(uri: string, fileName?: string): string {
  const name = (fileName ?? uri).toLowerCase();
  if (name.includes('.png'))  return 'image/png';
  if (name.includes('.webp')) return 'image/webp';
  if (name.includes('.heic')) return 'image/heic';
  if (name.includes('.heif')) return 'image/heif';
  return 'image/jpeg';
}

// On web, expo-image-picker returns base64 with a data URL prefix like
// "data:image/jpeg;base64,/9j/..." — Gemini expects raw base64 only.
function stripDataUrlPrefix(base64: string): string {
  const idx = base64.indexOf(',');
  return idx !== -1 ? base64.slice(idx + 1) : base64;
}

export interface RecipeImage {
  base64: string;
  uri: string;
  fileName?: string;
}

export async function parseRecipeFromImages(
  images: RecipeImage[],
  apiKey: string,
  options: ParseOptions = {},
): Promise<ParsedRecipe> {
  if (images.length === 0) throw new Error('No images provided');

  const imageParts = images.map((img) => ({
    inline_data: {
      mime_type: getMimeType(img.uri, img.fileName),
      data: stripDataUrlPrefix(img.base64),
    },
  }));

  const response = await fetch(geminiUrl(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: 'user',
        parts: [
          ...imageParts,
          { text: buildPrompt(options, images.length) },
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
    throw new Error(err?.error?.message ?? `Gemini API error ${response.status}`);
  }

  const data = await response.json();
  const parts: { text?: string }[] = data.candidates?.[0]?.content?.parts ?? [];
  const textPart = parts.find((p) => p.text !== undefined);
  if (!textPart?.text) throw new Error('No response from Gemini');

  const parsed = JSON.parse(textPart.text);

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
