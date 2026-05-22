import { SQLiteDatabase } from 'expo-sqlite';

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS recipes (
        id          TEXT PRIMARY KEY NOT NULL,
        title       TEXT NOT NULL,
        category    TEXT NOT NULL,
        language    TEXT NOT NULL DEFAULT 'en',
        servings    INTEGER NOT NULL DEFAULT 2,
        prep_time   INTEGER NOT NULL DEFAULT 0,
        cook_time   INTEGER NOT NULL DEFAULT 0,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        photo_uri   TEXT,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      )`,
    );

    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ingredients (
        id        TEXT PRIMARY KEY NOT NULL,
        recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        name      TEXT NOT NULL,
        quantity  TEXT NOT NULL DEFAULT '',
        unit      TEXT NOT NULL DEFAULT ''
      )`,
    );

    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS steps (
        recipe_id   TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        order_num   INTEGER NOT NULL,
        instruction TEXT NOT NULL,
        PRIMARY KEY (recipe_id, order_num)
      )`,
    );

    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_ingredients_recipe_id ON ingredients(recipe_id)');
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_steps_recipe_id ON steps(recipe_id)');
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category)');
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_recipes_is_favorite ON recipes(is_favorite)');

    await db.runAsync('PRAGMA user_version = 1');
  }
}
