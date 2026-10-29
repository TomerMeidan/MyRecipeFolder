import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { Recipe, RecipeSummary, Nutrition } from '../types';
import {
  getRecipeList, getRecipeById, insertRecipe, updateRecipe,
  deleteRecipe, toggleFavorite, saveNutrition,
} from './recipeRepository';

// Keys start with the user id so one account's recipes are never served to the next.
const listKey   = (uid: string | null) => ['recipes', uid, 'list'] as const;
const detailKey = (uid: string | null, id: string | undefined) => ['recipes', uid, 'detail', id] as const;

const patchList = (qc: QueryClient, uid: string | null, id: string, patch: Partial<RecipeSummary>) =>
  qc.setQueryData<RecipeSummary[]>(listKey(uid), (list) => list?.map((r) => (r.id === id ? { ...r, ...patch } : r)));

const patchDetail = (qc: QueryClient, uid: string | null, id: string, patch: Partial<Recipe>) =>
  qc.setQueryData<Recipe | null>(detailKey(uid, id), (r) => (r ? { ...r, ...patch } : r));

export function useRecipeList() {
  const { userId } = useAuth();
  return useQuery({ queryKey: listKey(userId), queryFn: getRecipeList, enabled: !!userId });
}

/** Full recipe. While it loads, the list entry stands in (isPlaceholderData): header and facts only. */
export function useRecipe(id: string | undefined) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  return useQuery({
    queryKey: detailKey(userId, id),
    queryFn: () => getRecipeById(id!),
    enabled: !!userId && !!id,
    placeholderData: (): Recipe | undefined => {
      const summary = qc.getQueryData<RecipeSummary[]>(listKey(userId))?.find((r) => r.id === id);
      return summary && { ...summary, ingredients: [], steps: [], caloriesManual: false };
    },
  });
}

export function useSaveRecipe() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recipe, isNew }: { recipe: Recipe; isNew: boolean }) =>
      isNew ? insertRecipe(recipe) : updateRecipe(recipe),
    onSuccess: (_void, { recipe }) => {
      qc.setQueryData(detailKey(userId, recipe.id), recipe);
      return qc.invalidateQueries({ queryKey: listKey(userId) });
    },
  });
}

export function useDeleteRecipe() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRecipe,
    onSuccess: (_void, id) => {
      qc.setQueryData<RecipeSummary[]>(listKey(userId), (list) => list?.filter((r) => r.id !== id));
    },
  });
}

export function useToggleFavorite() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) => toggleFavorite(id, isFavorite),
    onMutate: async ({ id, isFavorite }) => {
      await qc.cancelQueries({ queryKey: listKey(userId) }); // onSettled refetches it
      patchList(qc, userId, id, { isFavorite });
      patchDetail(qc, userId, id, { isFavorite });
    },
    onError: (_e, { id, isFavorite }) => {
      patchList(qc, userId, id, { isFavorite: !isFavorite });
      patchDetail(qc, userId, id, { isFavorite: !isFavorite });
    },
    // The server also bumps updated_at, which reorders the list.
    onSettled: () => qc.invalidateQueries({ queryKey: listKey(userId) }),
  });
}

export function useSaveNutrition() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, caloriesPerServing, nutrition }: { id: string; caloriesPerServing: number; nutrition: Nutrition }) =>
      saveNutrition(id, caloriesPerServing, nutrition),
    onSuccess: (_void, { id, caloriesPerServing, nutrition }) => {
      patchDetail(qc, userId, id, { caloriesPerServing, nutrition, caloriesManual: false });
      patchList(qc, userId, id, { caloriesPerServing });
    },
  });
}
