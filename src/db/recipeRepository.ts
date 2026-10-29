import { supabase } from '../lib/supabase';
import { Recipe, RecipeSummary, Ingredient, RecipeStep, RecipeCategory, Nutrition } from '../types';

// ── Row shapes from Supabase ──────────────────────────────────────────────────

interface RecipeRow {
  id: string; user_id: string; title: string; category: string;
  language: string; servings: number; prep_time: number; cook_time: number;
  is_favorite: boolean; photo_uri: string | null;
  calories_per_serving?: number | null; nutrition?: Nutrition | null; calories_manual?: boolean;
  created_at: number; updated_at: number;
  ingredients?: IngredientRow[];
  steps?: StepRow[];
}
interface IngredientRow { id: string; recipe_id: string; name: string; quantity: string; unit: string; }
interface StepRow      { recipe_id: string; order_num: number; instruction: string; }

// ── Mapper ────────────────────────────────────────────────────────────────────

function toRecipe(row: RecipeRow): Recipe {
  const ingredients: Ingredient[] = (row.ingredients ?? []).map((i) => ({
    id: i.id, name: i.name, quantity: i.quantity, unit: i.unit,
  }));
  const steps: RecipeStep[] = (row.steps ?? [])
    .sort((a, b) => a.order_num - b.order_num)
    .map((s) => ({ order: s.order_num, instruction: s.instruction }));

  return {
    id: row.id, title: row.title, category: row.category as RecipeCategory,
    language: row.language, servings: row.servings,
    prepTime: row.prep_time, cookTime: row.cook_time,
    isFavorite: row.is_favorite, photoUri: row.photo_uri ?? undefined,
    caloriesPerServing: row.calories_per_serving ?? undefined,
    nutrition: row.nutrition ?? undefined, caloriesManual: row.calories_manual ?? false,
    ingredients, steps, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

const RECIPE_SELECT = '*, ingredients(*), steps(*)';
const LIST_COLUMNS = 'id, title, category, language, servings, prep_time, cook_time, is_favorite, '
  + 'updated_at, created_at, calories_per_serving';

const nutritionColumns = (r: Pick<Recipe, 'caloriesPerServing' | 'nutrition' | 'caloriesManual'>) => ({
  calories_per_serving: r.caloriesPerServing ?? null,
  nutrition: r.nutrition ?? null,
  calories_manual: r.caloriesManual,
});

// "Column not found" (PGRST204 on write, Postgres 42703 on select): the calories migration hasn't been run yet.
// shortcut: saves and lists without calories until then; drop this fallback once every database has the columns.
const isMissingColumn = (e: { code?: string } | null) => e?.code === 'PGRST204' || e?.code === '42703';

async function writeRecipeRow(
  write: (cols: Record<string, unknown>) => PromiseLike<{ error: { code?: string } | null }>,
  base: Record<string, unknown>,
  recipe: Recipe,
) {
  let { error } = await write({ ...base, ...nutritionColumns(recipe) });
  if (isMissingColumn(error)) ({ error } = await write(base));
  if (error) throw error;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Light list for Home and Search: no steps, nutrition breakdown or photo; ingredient names for search. */
export async function getRecipeList(): Promise<RecipeSummary[]> {
  const run = (cols: string) => supabase
    .from('recipes')
    .select(`${cols}, ingredients(name)`)
    .order('updated_at', { ascending: false });
  let { data, error } = await run(LIST_COLUMNS);
  if (isMissingColumn(error)) ({ data, error } = await run(LIST_COLUMNS.replace(', calories_per_serving', '')));
  if (error) throw error;
  return ((data ?? []) as unknown as RecipeRow[]).map((row) => ({
    id: row.id, title: row.title, category: row.category as RecipeCategory,
    language: row.language, servings: row.servings,
    prepTime: row.prep_time, cookTime: row.cook_time, isFavorite: row.is_favorite,
    caloriesPerServing: row.calories_per_serving ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
    ingredientNames: (row.ingredients ?? []).map((i) => i.name),
  }));
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .eq('id', id)
    .single();
  if (error) return null;
  return data ? toRecipe(data as RecipeRow) : null;
}

export async function insertRecipe(recipe: Recipe): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  await writeRecipeRow((cols) => supabase.from('recipes').insert(cols), {
    id: recipe.id, user_id: user.id, title: recipe.title,
    category: recipe.category, language: recipe.language,
    servings: recipe.servings, prep_time: recipe.prepTime,
    cook_time: recipe.cookTime, is_favorite: recipe.isFavorite,
    photo_uri: recipe.photoUri ?? null,
    created_at: recipe.createdAt, updated_at: recipe.updatedAt,
  }, recipe);

  if (recipe.ingredients.length > 0) {
    const { error } = await supabase.from('ingredients').insert(
      recipe.ingredients.map((i) => ({ id: i.id, recipe_id: recipe.id, name: i.name, quantity: i.quantity, unit: i.unit })),
    );
    if (error) throw error;
  }

  if (recipe.steps.length > 0) {
    const { error } = await supabase.from('steps').insert(
      recipe.steps.map((s) => ({ recipe_id: recipe.id, order_num: s.order, instruction: s.instruction })),
    );
    if (error) throw error;
  }
}

export async function updateRecipe(recipe: Recipe): Promise<void> {
  const updatedAt = Date.now();

  await writeRecipeRow((cols) => supabase.from('recipes').update(cols).eq('id', recipe.id), {
    title: recipe.title, category: recipe.category, language: recipe.language,
    servings: recipe.servings, prep_time: recipe.prepTime,
    cook_time: recipe.cookTime, is_favorite: recipe.isFavorite,
    photo_uri: recipe.photoUri ?? null, updated_at: updatedAt,
  }, recipe);

  // Replace ingredients and steps
  await supabase.from('ingredients').delete().eq('recipe_id', recipe.id);
  await supabase.from('steps').delete().eq('recipe_id', recipe.id);

  if (recipe.ingredients.length > 0) {
    await supabase.from('ingredients').insert(
      recipe.ingredients.map((i) => ({ id: i.id, recipe_id: recipe.id, name: i.name, quantity: i.quantity, unit: i.unit })),
    );
  }
  if (recipe.steps.length > 0) {
    await supabase.from('steps').insert(
      recipe.steps.map((s) => ({ recipe_id: recipe.id, order_num: s.order, instruction: s.instruction })),
    );
  }
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) throw error;
}

/** Saves a fresh estimate without touching ingredients or steps. */
export async function saveNutrition(id: string, caloriesPerServing: number, nutrition: Nutrition): Promise<void> {
  const { error } = await supabase.from('recipes').update({
    calories_per_serving: caloriesPerServing, nutrition, calories_manual: false,
  }).eq('id', id);
  if (error) throw error;
}

export async function toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
  const { error } = await supabase.from('recipes').update({
    is_favorite: isFavorite, updated_at: Date.now(),
  }).eq('id', id);
  if (error) throw error;
}
