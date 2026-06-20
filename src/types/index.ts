export interface Ingredient {
  id: string;
  name: string;
  quantity: string;
  unit: string;
}

export interface RecipeStep {
  id: string;
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
  | 'Other';

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
  createdAt: number;  // unix ms
  updatedAt: number;  // unix ms
}

export interface RecipePrefill {
  title?: string;
  category?: RecipeCategory;
  ingredients?: Ingredient[];
  steps?: RecipeStep[];
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
};
