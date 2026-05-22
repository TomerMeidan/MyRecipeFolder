import { SQLiteDatabase } from 'expo-sqlite';
import { Recipe, Ingredient, RecipeStep, RecipeCategory } from '../types';

// ── Raw row shapes returned by SQLite ──────────────────────────────────────

interface RecipeRow {
  id: string;
  title: string;
  category: string;
  language: string;
  servings: number;
  prep_time: number;
  cook_time: number;
  is_favorite: number;
  photo_uri: string | null;
  created_at: number;
  updated_at: number;
}

interface IngredientRow {
  id: string;
  recipe_id: string;
  name: string;
  quantity: string;
  unit: string;
}

interface StepRow {
  recipe_id: string;
  order_num: number;
  instruction: string;
}

// ── Mappers ────────────────────────────────────────────────────────────────

function toRecipe(
  row: RecipeRow,
  ingredients: Ingredient[],
  steps: RecipeStep[],
): Recipe {
  return {
    id: row.id,
    title: row.title,
    category: row.category as RecipeCategory,
    language: row.language,
    servings: row.servings,
    prepTime: row.prep_time,
    cookTime: row.cook_time,
    isFavorite: row.is_favorite === 1,
    photoUri: row.photo_uri ?? undefined,
    ingredients,
    steps,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function fetchIngredients(db: SQLiteDatabase, recipeId: string): Promise<Ingredient[]> {
  const rows = await db.getAllAsync<IngredientRow>(
    'SELECT * FROM ingredients WHERE recipe_id = ?',
    recipeId,
  );
  return rows.map(({ id, name, quantity, unit }) => ({ id, name, quantity, unit }));
}

async function fetchSteps(db: SQLiteDatabase, recipeId: string): Promise<RecipeStep[]> {
  const rows = await db.getAllAsync<StepRow>(
    'SELECT * FROM steps WHERE recipe_id = ? ORDER BY order_num',
    recipeId,
  );
  return rows.map(({ order_num, instruction }) => ({ order: order_num, instruction }));
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function getAllRecipes(db: SQLiteDatabase): Promise<Recipe[]> {
  const rows = await db.getAllAsync<RecipeRow>(
    'SELECT * FROM recipes ORDER BY updated_at DESC',
  );
  return Promise.all(
    rows.map(async (row) => {
      const ingredients = await fetchIngredients(db, row.id);
      const steps = await fetchSteps(db, row.id);
      return toRecipe(row, ingredients, steps);
    }),
  );
}

export async function getRecipeById(db: SQLiteDatabase, id: string): Promise<Recipe | null> {
  const row = await db.getFirstAsync<RecipeRow>('SELECT * FROM recipes WHERE id = ?', id);
  if (!row) return null;
  const ingredients = await fetchIngredients(db, id);
  const steps = await fetchSteps(db, id);
  return toRecipe(row, ingredients, steps);
}

export async function insertRecipe(db: SQLiteDatabase, recipe: Recipe): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO recipes
        (id, title, category, language, servings, prep_time, cook_time, is_favorite, photo_uri, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      recipe.id,
      recipe.title,
      recipe.category,
      recipe.language,
      recipe.servings,
      recipe.prepTime,
      recipe.cookTime,
      recipe.isFavorite ? 1 : 0,
      recipe.photoUri ?? null,
      recipe.createdAt,
      recipe.updatedAt,
    );

    for (const ing of recipe.ingredients) {
      await db.runAsync(
        'INSERT INTO ingredients (id, recipe_id, name, quantity, unit) VALUES (?, ?, ?, ?, ?)',
        ing.id, recipe.id, ing.name, ing.quantity, ing.unit,
      );
    }

    for (const step of recipe.steps) {
      await db.runAsync(
        'INSERT INTO steps (recipe_id, order_num, instruction) VALUES (?, ?, ?)',
        recipe.id, step.order, step.instruction,
      );
    }
  });
}

export async function updateRecipe(db: SQLiteDatabase, recipe: Recipe): Promise<void> {
  const updatedAt = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE recipes SET
        title = ?, category = ?, language = ?, servings = ?,
        prep_time = ?, cook_time = ?, is_favorite = ?, photo_uri = ?, updated_at = ?
       WHERE id = ?`,
      recipe.title,
      recipe.category,
      recipe.language,
      recipe.servings,
      recipe.prepTime,
      recipe.cookTime,
      recipe.isFavorite ? 1 : 0,
      recipe.photoUri ?? null,
      updatedAt,
      recipe.id,
    );

    await db.runAsync('DELETE FROM ingredients WHERE recipe_id = ?', recipe.id);
    await db.runAsync('DELETE FROM steps WHERE recipe_id = ?', recipe.id);

    for (const ing of recipe.ingredients) {
      await db.runAsync(
        'INSERT INTO ingredients (id, recipe_id, name, quantity, unit) VALUES (?, ?, ?, ?, ?)',
        ing.id, recipe.id, ing.name, ing.quantity, ing.unit,
      );
    }

    for (const step of recipe.steps) {
      await db.runAsync(
        'INSERT INTO steps (recipe_id, order_num, instruction) VALUES (?, ?, ?)',
        recipe.id, step.order, step.instruction,
      );
    }
  });
}

export async function deleteRecipe(db: SQLiteDatabase, id: string): Promise<void> {
  // ON DELETE CASCADE handles ingredients and steps
  await db.runAsync('DELETE FROM recipes WHERE id = ?', id);
}

export async function toggleFavorite(db: SQLiteDatabase, id: string, isFavorite: boolean): Promise<void> {
  await db.runAsync(
    'UPDATE recipes SET is_favorite = ?, updated_at = ? WHERE id = ?',
    isFavorite ? 1 : 0,
    Date.now(),
    id,
  );
}

export async function filterRecipes(
  db: SQLiteDatabase,
  query: string,
  category?: RecipeCategory,
): Promise<Recipe[]> {
  const hasQuery = query.trim().length > 0;
  const hasCategory = !!category;

  let rows: RecipeRow[];

  if (!hasQuery && !hasCategory) {
    rows = await db.getAllAsync<RecipeRow>(
      'SELECT * FROM recipes ORDER BY updated_at DESC',
    );
  } else if (!hasQuery && hasCategory) {
    rows = await db.getAllAsync<RecipeRow>(
      'SELECT * FROM recipes WHERE category = ? ORDER BY updated_at DESC',
      category,
    );
  } else if (hasQuery && !hasCategory) {
    const like = `%${query.trim()}%`;
    rows = await db.getAllAsync<RecipeRow>(
      `SELECT DISTINCT r.*
       FROM recipes r
       LEFT JOIN ingredients i ON i.recipe_id = r.id
       WHERE r.title LIKE ? OR r.category LIKE ? OR i.name LIKE ?
       ORDER BY r.updated_at DESC`,
      like, like, like,
    );
  } else {
    const like = `%${query.trim()}%`;
    rows = await db.getAllAsync<RecipeRow>(
      `SELECT DISTINCT r.*
       FROM recipes r
       LEFT JOIN ingredients i ON i.recipe_id = r.id
       WHERE r.category = ?
         AND (r.title LIKE ? OR i.name LIKE ?)
       ORDER BY r.updated_at DESC`,
      category as RecipeCategory, like, like,
    );
  }

  return Promise.all(
    rows.map(async (row) => {
      const ingredients = await fetchIngredients(db, row.id);
      const steps = await fetchSteps(db, row.id);
      return toRecipe(row, ingredients, steps);
    }),
  );
}
