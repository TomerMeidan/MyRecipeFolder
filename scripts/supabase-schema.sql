-- ─────────────────────────────────────────────────────────────────
-- MyRecipeFolder — Supabase schema
-- Run this in: Supabase dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────

-- recipes
CREATE TABLE IF NOT EXISTS recipes (
  id          TEXT        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  category    TEXT        NOT NULL,
  language    TEXT        NOT NULL DEFAULT 'en',
  servings    INTEGER     NOT NULL DEFAULT 2,
  prep_time   INTEGER     NOT NULL DEFAULT 0,
  cook_time   INTEGER     NOT NULL DEFAULT 0,
  is_favorite BOOLEAN     NOT NULL DEFAULT false,
  photo_uri   TEXT,
  created_at  BIGINT      NOT NULL,
  updated_at  BIGINT      NOT NULL
);

-- ingredients
CREATE TABLE IF NOT EXISTS ingredients (
  id          TEXT    PRIMARY KEY,
  recipe_id   TEXT    NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  quantity    TEXT    NOT NULL DEFAULT '',
  unit        TEXT    NOT NULL DEFAULT ''
);

-- steps
CREATE TABLE IF NOT EXISTS steps (
  recipe_id   TEXT    NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  order_num   INTEGER NOT NULL,
  instruction TEXT    NOT NULL,
  PRIMARY KEY (recipe_id, order_num)
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_recipes_user_id     ON recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_updated_at  ON recipes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_category    ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_ingredients_recipe  ON ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_steps_recipe        ON steps(recipe_id);

-- ── Row Level Security ────────────────────────────────────────────
-- Users can only read/write their own data.

ALTER TABLE recipes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE steps       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipes: owner access"
  ON recipes FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ingredients: owner access"
  ON ingredients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = ingredients.recipe_id
        AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "steps: owner access"
  ON steps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = steps.recipe_id
        AND recipes.user_id = auth.uid()
    )
  );
