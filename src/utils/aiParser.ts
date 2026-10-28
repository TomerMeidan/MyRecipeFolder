import { Platform } from 'react-native';
import { Ingredient, Nutrition, RecipeCategory } from '../types';
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
const num = (v: unknown, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v) : undefined;

export interface NutritionEstimate { caloriesPerServing: number; nutrition: Nutrition }

/** The server already validates; this re-checks the shape so a bad response can't corrupt a saved recipe. */
function toEstimate(parsed: { caloriesPerServing?: unknown; nutrition?: Partial<Nutrition> }): NutritionEstimate | undefined {
  const kcal = num(parsed?.caloriesPerServing, 10_000);
  const n = parsed?.nutrition;
  const proteinG = num(n?.proteinG, 1000), carbsG = num(n?.carbsG, 1000), fatG = num(n?.fatG, 1000);
  if (kcal === undefined || proteinG === undefined || carbsG === undefined || fatG === undefined) return undefined;
  const ingredients = (Array.isArray(n?.ingredients) ? n.ingredients : [])
    .map((i) => ({ name: str(i?.name), kcal: num(i?.kcal, 1_000_000) }))
    .filter((i): i is { name: string; kcal: number } => !!i.name && i.kcal !== undefined);
  return { caloriesPerServing: kcal, nutrition: { proteinG, carbsG, fatG, ingredients } };
}

async function postToApi(body: unknown): Promise<any> {
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
    body: JSON.stringify(body),
  });
  const parsed = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(parsed?.error ?? `Recipe scan failed (${response.status})`);
  return parsed;
}

/** Asks the server to estimate calories for an existing recipe (text only, no photo). */
export async function estimateNutrition(ingredients: Ingredient[], servings: number): Promise<NutritionEstimate> {
  const parsed = await postToApi({
    mode: 'nutrition',
    servings,
    ingredients: ingredients
      .filter((i) => i.name.trim())
      .map(({ quantity, unit, name }) => ({ quantity, unit, name })),
  });
  const estimate = toEstimate(parsed);
  if (!estimate) throw new Error('Could not estimate calories');
  return estimate;
}

export async function parseRecipeFromImages(
  images: RecipeImage[],
  options: ParseOptions = {},
): Promise<ParsedRecipe> {
  if (images.length === 0) throw new Error('No images provided');

  const parsed = await postToApi({
    images: images.map((img) => ({
      mimeType: getMimeType(img.uri, img.fileName),
      data: stripDataUrlPrefix(img.base64),
    })),
    sourceLanguage: options.sourceLanguage,
    outputLanguage: options.outputLanguage,
  });

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
    servings: num(parsed.servings, 100) || undefined,
    ...toEstimate(parsed),
  };
}
