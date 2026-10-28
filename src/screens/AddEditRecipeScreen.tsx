import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { StackActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Recipe, Ingredient, RecipeStep, RecipeCategory, Nutrition } from '../types';
import { getRecipeById, insertRecipe, updateRecipe } from '../db/recipeRepository';
import { createRecipe, createIngredient, createStep } from '../utils/recipe';
import { RECIPE_CATEGORIES } from '../utils/constants';
import { isRtlText } from '../utils/rtl';
import { useTheme, ThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { categoryKey } from '../i18n/strings';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditRecipe'>;

// An estimate is only valid for the exact ingredients and servings it was made from.
const nutritionKey = (ings: Ingredient[], servings: number) =>
  JSON.stringify([servings, ings.filter((i) => i.name.trim()).map((i) => [i.quantity.trim(), i.unit.trim(), i.name.trim()])]);

interface Estimate { caloriesPerServing: number; nutrition?: Nutrition; key: string }

export default function AddEditRecipeScreen({ route, navigation }: Props) {
  const { recipeId, prefill } = route.params ?? {};
  const isEditing = !!recipeId;
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(isEditing);
  const [title, setTitle] = useState(prefill?.title ?? '');
  const [category, setCategory] = useState<RecipeCategory>(prefill?.category ?? 'Other');
  const [servings, setServings] = useState(String(prefill?.servings ?? 2));
  const [prepTime, setPrepTime] = useState('0');
  const [cookTime, setCookTime] = useState('0');
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    prefill?.ingredients?.length ? prefill.ingredients : [createIngredient()],
  );
  const [steps, setSteps] = useState<RecipeStep[]>(
    prefill?.steps?.length ? prefill.steps : [createStep(1)],
  );
  const [isFavorite, setIsFavorite] = useState(false);
  // Only a hand-typed number lives in this field; an estimate shows as the placeholder.
  const [calories, setCalories] = useState('');
  const [estimate, setEstimate] = useState<Estimate | null>(
    prefill?.caloriesPerServing !== undefined
      ? { caloriesPerServing: prefill.caloriesPerServing, nutrition: prefill.nutrition,
          key: nutritionKey(prefill.ingredients ?? [], prefill.servings ?? 2) }
      : null,
  );
  const [saving, setSaving] = useState(false);
  const [existingRecipe, setExistingRecipe] = useState<Recipe | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error', duration = 3000) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), duration);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t(isEditing ? 'title_edit_recipe' : prefill ? 'title_edit_scanned' : 'title_add_recipe') });
  }, [isEditing, prefill, t]);

  useEffect(() => {
    if (!isEditing || !recipeId) return;
    getRecipeById(recipeId).then((data) => {
      if (data) {
        setExistingRecipe(data);
        setTitle(data.title);
        setCategory(data.category);
        setServings(String(data.servings));
        setPrepTime(String(data.prepTime));
        setCookTime(String(data.cookTime));
        setIngredients(data.ingredients.length > 0 ? data.ingredients : [createIngredient()]);
        setSteps(data.steps.length > 0 ? data.steps : [createStep(1)]);
        setIsFavorite(data.isFavorite);
        if (data.caloriesManual && data.caloriesPerServing !== undefined) {
          setCalories(String(data.caloriesPerServing));
        } else if (data.caloriesPerServing !== undefined) {
          setEstimate({ caloriesPerServing: data.caloriesPerServing, nutrition: data.nutrition,
            key: nutritionKey(data.ingredients, data.servings) });
        }
      }
      setLoading(false);
    });
  }, [recipeId]);

  // ── Ingredient helpers ────────────────────────────────────────────────────

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)),
    );
  };

  const addIngredient = () => setIngredients((prev) => [...prev, createIngredient()]);

  const removeIngredient = (index: number) => {
    if (ingredients.length === 1) return;
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const moveIngredient = (index: number, direction: -1 | 1) => {
    setIngredients((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  // ── Step helpers ──────────────────────────────────────────────────────────

  const updateStep = (index: number, value: string) => {
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, instruction: value } : step)),
    );
  };

  const addStep = () =>
    setSteps((prev) => [...prev, createStep(prev.length + 1)]);

  const removeStep = (index: number) => {
    if (steps.length === 1) return;
    setSteps((prev) =>
      prev.filter((_, i) => i !== index).map((step, i) => ({ ...step, order: i + 1 })),
    );
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    setSteps((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((step, i) => ({ ...step, order: i + 1 }));
    });
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert(t('missing_title'), t('missing_title_msg'));
      return;
    }

    const filledIngredients = ingredients.filter((i) => i.name.trim());
    const filledSteps = steps.filter((s) => s.instruction.trim());

    const servingsNum = Math.max(1, parseInt(servings) || 1);
    const typedKcal = parseInt(calories);
    const manual = calories.trim() !== '' && typedKcal >= 0 && typedKcal <= 10_000;
    // Keep an estimate only if nothing it depends on changed; otherwise the recipe page offers "Calculate calories".
    const keptEstimate = !manual && estimate && estimate.key === nutritionKey(filledIngredients, servingsNum) ? estimate : null;

    setSaving(true);
    try {
      const now = Date.now();
      const recipe: Recipe = createRecipe({
        ...(existingRecipe ?? {}),
        title: title.trim(),
        category,
        servings: servingsNum,
        prepTime: Math.max(0, parseInt(prepTime) || 0),
        cookTime: Math.max(0, parseInt(cookTime) || 0),
        ingredients: filledIngredients,
        steps: filledSteps,
        isFavorite,
        caloriesPerServing: manual ? typedKcal : keptEstimate?.caloriesPerServing,
        nutrition: manual ? undefined : keptEstimate?.nutrition,
        caloriesManual: manual,
        updatedAt: now,
        ...(isEditing && existingRecipe ? { id: existingRecipe.id, createdAt: existingRecipe.createdAt } : {}),
      });

      if (isEditing) {
        await updateRecipe(recipe);
        showToast(t('toast_updated'), 'success');
        setTimeout(() => navigation.goBack(), 1200);
      } else {
        await insertRecipe(recipe);
        showToast(t('toast_saved'), 'success');
        if (prefill) {
          setTimeout(() => navigation.dispatch(StackActions.replace('ScanRecipe')), 1500);
        } else {
          setTimeout(() => navigation.goBack(), 1200);
        }
      }
    } catch (e) {
      showToast(t('toast_save_failed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const styles = makeStyles(theme);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

  // The form follows the UI language; each free-text field aligns to its own content,
  // so a Hebrew recipe reads right-aligned even in an English UI (and vice versa).
  const align = (v: string) => ({ textAlign: isRtlText(v) ? 'right' : 'left' } as const);
  // Same rule as save: an estimate only survives if ingredients and servings are unchanged.
  const liveEstimate = estimate && estimate.key === nutritionKey(ingredients, Math.max(1, parseInt(servings) || 1)) ? estimate : null;

  return (
    <View style={styles.container}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Title */}
        <Text style={styles.label}>{t('label_title')}</Text>
        <TextInput
          style={[styles.input, styles.titleInput, align(title)]}
          value={title}
          onChangeText={setTitle}
          placeholder={t('title_placeholder')}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={t('a11y_title_required')}
        />

        {/* Category */}
        <Text style={styles.label}>{t('label_category')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {RECIPE_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
              onPress={() => setCategory(cat)}
              accessibilityRole="button"
              accessibilityState={{ selected: category === cat }}
            >
              <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>
                {t(categoryKey(cat))}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Numeric row */}
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.label}>{t('label_servings')}</Text>
            <TextInput
              style={styles.inputSmall}
              value={servings}
              onChangeText={setServings}
              keyboardType="number-pad"
              placeholder="2"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>{t('label_prep_min')}</Text>
            <TextInput
              style={styles.inputSmall}
              value={prepTime}
              onChangeText={setPrepTime}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>{t('label_cook_min')}</Text>
            <TextInput
              style={styles.inputSmall}
              value={cookTime}
              onChangeText={setCookTime}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        </View>

        {/* Calories */}
        <Text style={styles.label}>{t('label_calories')}</Text>
        <TextInput
          style={[styles.inputSmall, styles.caloriesInput]}
          value={calories}
          onChangeText={(v) => setCalories(v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={5}
          placeholder={t('placeholder_calories')}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={t('label_calories')}
        />
        <Text style={styles.hint}>
          {liveEstimate
            ? t('hint_calories_estimate', { kcal: liveEstimate.caloriesPerServing })
            : t('hint_calories')}
        </Text>

        {/* Favorite toggle */}
        <TouchableOpacity
          style={styles.favoriteRow}
          onPress={() => setIsFavorite((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: isFavorite }}
        >
          <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={26} color={isFavorite ? theme.primary : theme.textSecondary} />
          <Text style={styles.favoriteLabel}>
            {t(isFavorite ? 'fav_saved' : 'fav_mark')}
          </Text>
        </TouchableOpacity>

        {/* Ingredients */}
        <Text style={styles.sectionTitle}>{t('ingredients')}</Text>
        <View style={styles.ingredientHeader}>
          <Text style={[styles.colLabel, { flex: 2 }]}>{t('col_ingredient')}</Text>
          <Text style={[styles.colLabel, { flex: 1 }]}>{t('col_qty')}</Text>
          <Text style={[styles.colLabel, { flex: 1 }]}>{t('col_unit')}</Text>
          <View style={{ width: 86 }} />
        </View>
        {ingredients.map((ing, i) => (
          <View key={ing.id} style={styles.ingredientRow}>
            <TextInput
              style={[styles.inlineInput, { flex: 2 }, align(ing.name)]}
              value={ing.name}
              onChangeText={(v) => updateIngredient(i, 'name', v)}
              placeholder={t('ph_ingredient')}
              placeholderTextColor={theme.textSecondary}
            />
            <TextInput
              style={[styles.inlineInput, { flex: 1 }]}
              value={ing.quantity}
              onChangeText={(v) => updateIngredient(i, 'quantity', v)}
              placeholder={t('ph_qty')}
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.inlineInput, { flex: 1 }, align(ing.unit)]}
              value={ing.unit}
              onChangeText={(v) => updateIngredient(i, 'unit', v)}
              placeholder={t('ph_unit')}
              placeholderTextColor={theme.textSecondary}
            />
            <View style={styles.moveCol}>
              <TouchableOpacity
                style={styles.moveBtn}
                onPress={() => moveIngredient(i, -1)}
                disabled={i === 0}
                accessibilityRole="button"
                accessibilityLabel={t('a11y_move_ing_up')}
              >
                <Ionicons name="chevron-up" size={20} color={i === 0 ? theme.border : theme.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.moveBtn}
                onPress={() => moveIngredient(i, 1)}
                disabled={i === ingredients.length - 1}
                accessibilityRole="button"
                accessibilityLabel={t('a11y_move_ing_down')}
              >
                <Ionicons name="chevron-down" size={20} color={i === ingredients.length - 1 ? theme.border : theme.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => removeIngredient(i)}
              style={styles.removeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('a11y_remove_ing')}
            >
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={addIngredient} accessibilityRole="button">
          <Ionicons name="add-circle-outline" size={22} color={theme.text} />
          <Text style={styles.addRowBtnText}>{t('add_ingredient')}</Text>
        </TouchableOpacity>

        {/* Steps */}
        <Text style={styles.sectionTitle}>{t('steps')}</Text>
        {steps.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepCircleText}>{step.order}</Text>
            </View>
            <TextInput
              style={[styles.stepInput, align(step.instruction)]}
              value={step.instruction}
              onChangeText={(v) => updateStep(i, v)}
              placeholder={t('step_placeholder', { n: step.order })}
              placeholderTextColor={theme.textSecondary}
              multiline
            />
            <View style={styles.moveCol}>
              <TouchableOpacity
                style={styles.moveBtn}
                onPress={() => moveStep(i, -1)}
                disabled={i === 0}
                accessibilityRole="button"
                accessibilityLabel={t('a11y_move_step_up')}
              >
                <Ionicons name="chevron-up" size={20} color={i === 0 ? theme.border : theme.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.moveBtn}
                onPress={() => moveStep(i, 1)}
                disabled={i === steps.length - 1}
                accessibilityRole="button"
                accessibilityLabel={t('a11y_move_step_down')}
              >
                <Ionicons name="chevron-down" size={20} color={i === steps.length - 1 ? theme.border : theme.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => removeStep(i)}
              style={styles.removeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('a11y_remove_step')}
            >
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={addStep} accessibilityRole="button">
          <Ionicons name="add-circle-outline" size={22} color={theme.text} />
          <Text style={styles.addRowBtnText}>{t('add_step')}</Text>
        </TouchableOpacity>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving
            ? <ActivityIndicator color={theme.onPrimary} />
            : <Text style={styles.saveButtonText}>{t(isEditing ? 'update_recipe' : 'save_recipe')}</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>

    {toast && (
      <TouchableOpacity style={[styles.toast, toast.type === 'success' ? styles.toastSuccess : styles.toastError]} onPress={() => setToast(null)} activeOpacity={0.9}>
        <View style={styles.toastRow}>
          <Ionicons
            name={toast.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
            size={22}
            color={toast.type === 'success' ? theme.background : theme.errorText}
          />
          <Text style={[styles.toastText, toast.type === 'error' && styles.toastTextError]}>{toast.message}</Text>
        </View>
        <Text style={[styles.toastDismiss, toast.type === 'error' && styles.toastTextError]}>{t('tap_to_dismiss')}</Text>
      </TouchableOpacity>
    )}
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background },
    scroll: { padding: 16, paddingBottom: 48 },

    label: { fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 6, marginTop: 16 },
    input: {
      minHeight: 52, backgroundColor: theme.card, borderRadius: 12, paddingHorizontal: 14,
      fontSize: 17, color: theme.text,
      borderWidth: 1.5, borderColor: theme.borderStrong,
    },
    titleInput: { fontSize: 20, fontWeight: '700' },
    inputSmall: {
      minHeight: 52, backgroundColor: theme.card, borderRadius: 12, paddingHorizontal: 8,
      fontSize: 18, fontWeight: '700', color: theme.text, textAlign: 'center', fontVariant: ['tabular-nums'],
      borderWidth: 1.5, borderColor: theme.borderStrong,
    },

    categoryScroll: { gap: 8, paddingVertical: 2 },
    categoryChip: {
      minHeight: 44, justifyContent: 'center',
      borderRadius: 22, paddingHorizontal: 16,
      borderWidth: 1.5, borderColor: theme.borderStrong,
    },
    // Selected chips are an inverted surface: quiet in both modes, unlike a yellow fill in dark.
    categoryChipActive: { backgroundColor: theme.text, borderColor: theme.text },
    categoryChipText: { fontSize: 15, color: theme.text, fontWeight: '700' },
    categoryChipTextActive: { color: theme.background },

    caloriesInput: { alignSelf: 'flex-start', minWidth: 140 },
    hint: { fontSize: 13, color: theme.textSecondary, marginTop: 6 },

    row: { flexDirection: 'row', gap: 10 },
    rowItem: { flex: 1 },

    favoriteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, marginTop: 12, alignSelf: 'flex-start' },
    favoriteLabel: { fontSize: 17, fontWeight: '600', color: theme.text },

    sectionTitle: {
      fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 24, marginBottom: 8,
      paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.border,
    },

    ingredientHeader: { flexDirection: 'row', gap: 6, marginBottom: 6 },
    colLabel: { fontSize: 13, color: theme.textSecondary, fontWeight: '700', minWidth: 0 },

    ingredientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
    inlineInput: {
      minHeight: 48, borderWidth: 1.5, borderColor: theme.borderStrong, borderRadius: 10,
      paddingHorizontal: 10, fontSize: 16, color: theme.text, backgroundColor: theme.card,
      // minWidth:0 allows flex items to shrink below content width on web
      minWidth: 0,
    },
    moveCol: { width: 36, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    moveBtn: { width: 36, height: 26, alignItems: 'center', justifyContent: 'center' },
    removeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, alignSelf: 'flex-start' },
    addRowBtnText: { fontSize: 16, color: theme.text, fontWeight: '700' },

    stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
    stepCircle: {
      width: 30, height: 30, borderRadius: 8, backgroundColor: theme.highlight,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 10,
    },
    stepCircleText: { fontSize: 16, fontWeight: '800', color: theme.text, fontVariant: ['tabular-nums'] },
    stepInput: {
      flex: 1, borderWidth: 1.5, borderColor: theme.borderStrong, borderRadius: 10,
      padding: 12, fontSize: 17, lineHeight: 24, color: theme.text, backgroundColor: theme.card,
      minHeight: 96, textAlignVertical: 'top',
    },

    saveButton: {
      backgroundColor: theme.primary, borderRadius: 12, minHeight: 56,
      alignItems: 'center', justifyContent: 'center', marginTop: 28,
    },
    saveButtonDisabled: { opacity: 0.6 },
    saveButtonText: { fontSize: 18, fontWeight: '800', color: theme.onPrimary },

    toast: {
      position: 'absolute', bottom: 40, left: 24, right: 24,
      borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18,
      alignItems: 'center',
      shadowColor: theme.shadow, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
    },
    // Success is an inverted surface; error uses the error tokens. Both keep >= 4.5:1.
    toastSuccess: { backgroundColor: theme.text },
    toastError:   { backgroundColor: theme.errorBox, borderWidth: 1.5, borderColor: theme.errorText },
    toastRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
    toastText:    { fontSize: 16, fontWeight: '700', color: theme.background, textAlign: 'center', flexShrink: 1 },
    toastTextError: { color: theme.errorText },
    toastDismiss: { fontSize: 13, fontWeight: '600', color: theme.background, marginTop: 4 },
  });
}
