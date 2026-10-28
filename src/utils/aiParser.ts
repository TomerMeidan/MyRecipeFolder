import { Platform } from 'react-native';
import { RecipeCategory } from '../types';
import { ParsedRecipe } from './recipeParser';
import { createIngredient, createStep } from './recipe';
import { RECIPE_CATEGORIES } from './constants';
import { supabase } from '../lib/supabase';

// Recipe photos are parsed by Gemini via our own server endpoint (api/parse-recipe.ts),
// which holds the Gemini key. The key must never be in the client bundle.
// Web calls it same-origin; native needs the deployed origin in EXPO_PUBLIC_API_BASE_URL.
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export interface ParseOptions {
  /** Language name (e.g. "Hebrew") — helps with handwriting recognition */
  sourceLanguage?: string;
  /** Language name for output (e.g. "English", "Hebrew"). Omit to keep the recipe's original language. */
  outputLanguage?: string;
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

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export async function parseRecipeFromImages(
  images: RecipeImage[],
  options: ParseOptions = {},
): Promise<ParsedRecipe> {
  if (images.length === 0) throw new Error('No images provided');
  if (!API_BASE && Platform.OS !== 'web') {
    throw new Error('Set EXPO_PUBLIC_API_BASE_URL to your deployed site to scan on mobile.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE}/api/parse-recipe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      images: images.map((img) => ({
        mimeType: getMimeType(img.uri, img.fileName),
        data: stripDataUrlPrefix(img.base64),
      })),
      sourceLanguage: options.sourceLanguage,
      outputLanguage: options.outputLanguage,
    }),
  });

  const parsed = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(parsed?.error ?? `Recipe scan failed (${response.status})`);

  // Treat model output as untrusted: coerce every field to the expected shape.
  const category = RECIPE_CATEGORIES.includes(parsed.category) ? parsed.category as RecipeCategory : 'Other';
  return {
    title: str(parsed.title) || 'Untitled Recipe',
    category,
    ingredients: (Array.isArray(parsed.ingredients) ? parsed.ingredients : []).map(
      (ing: { quantity?: unknown; unit?: unknown; name?: unknown }) =>
        createIngredient({ name: str(ing?.name), quantity: str(ing?.quantity), unit: str(ing?.unit) }),
    ),
    steps: (Array.isArray(parsed.steps) ? parsed.steps : []).map((instruction: unknown, i: number) =>
      createStep(i + 1, str(instruction)),
    ),
  };
}
