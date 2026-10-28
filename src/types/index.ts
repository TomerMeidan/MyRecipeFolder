export interface Ingredient {
  id: string;
  name: string;
  quantity: string;
  unit: string;
}

export interface RecipeStep {
  order: number;
  instruction: string;
}

export type RecipeCategory =
  | 'Pasta'
  | 'Chicken'
  | 'Beef'
  | 'Fish'
  | 'Vegetarian'
  | 'Dessert'
  | 'Soup'
  | 'Salad'
  | 'High Protein'
  | 'Bread'
  | 'Other';

/** Gemini's per-serving estimate. Absent when the user typed the number in. */
export interface Nutrition {
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: { name: string; kcal: number }[]; // whole-recipe kcal per ingredient
}

export interface Recipe {
  id: string;
  title: string;
  category: RecipeCategory;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  photoUri?: string;
  language: string;
  servings: number;
  prepTime: number;   // minutes
  cookTime: number;   // minutes
  isFavorite: boolean;
  caloriesPerServing?: number;
  nutrition?: Nutrition;
  caloriesManual: boolean; // true = typed by the user, never overwritten by an estimate
  createdAt: number;  // unix ms
  updatedAt: number;  // unix ms
}

export interface RecipePrefill {
  title?: string;
  category?: RecipeCategory;
  ingredients?: Ingredient[];
  steps?: RecipeStep[];
  servings?: number;
  caloriesPerServing?: number;
  nutrition?: Nutrition;
}

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  RecipeDetail: { recipeId: string };
  AddEditRecipe: { recipeId?: string; prefill?: RecipePrefill };
  ScanRecipe: undefined;
};

export type BottomTabParamList = {
  HomeTab: undefined;
  SearchTab: undefined;
  ScanTab: undefined;
  SettingsTab: undefined;
};
