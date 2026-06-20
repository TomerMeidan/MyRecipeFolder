import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { Recipe, Ingredient, RecipeStep } from '../types';

export function createRecipe(partial: Partial<Recipe> = {}): Recipe {
  const now = Date.now();
  return {
    id: uuidv4(),
    title: '',
    category: 'Other',
    ingredients: [],
    steps: [],
    language: 'en',
    servings: 2,
    prepTime: 0,
    cookTime: 0,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function createIngredient(partial: Partial<Ingredient> = {}): Ingredient {
  return {
    id: uuidv4(),
    name: '',
    quantity: '',
    unit: '',
    ...partial,
  };
}

export function createStep(order: number, instruction = ''): RecipeStep {
  return { id: uuidv4(), order, instruction };
}

export function totalTime(recipe: Pick<Recipe, 'prepTime' | 'cookTime'>): number {
  return recipe.prepTime + recipe.cookTime;
}
