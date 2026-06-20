import { useState, useEffect, useLayoutEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Recipe, Ingredient, RecipeStep, RecipeCategory } from '../types';
import { getRecipeById, insertRecipe, updateRecipe } from '../db/recipeRepository';
import { createRecipe, createIngredient, createStep } from '../utils/recipe';
import { RECIPE_CATEGORIES } from '../utils/constants';
import { useTheme, ThemeColors } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditRecipe'>;

export default function AddEditRecipeScreen({ route, navigation }: Props) {
  const { recipeId, prefill } = route.params ?? {};
  const isEditing = !!recipeId;
  const { theme } = useTheme();

  const [loading, setLoading] = useState(isEditing);
  const [title, setTitle] = useState(prefill?.title ?? '');
  const [category, setCategory] = useState<RecipeCategory>(prefill?.category ?? 'Other');
  const [servings, setServings] = useState('2');
  const [prepTime, setPrepTime] = useState('0');
  const [cookTime, setCookTime] = useState('0');
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    prefill?.ingredients?.length ? prefill.ingredients : [createIngredient()],
  );
  const [steps, setSteps] = useState<RecipeStep[]>(
    prefill?.steps?.length ? prefill.steps : [createStep(1)],
  );
  const [isFavorite, setIsFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingRecipe, setExistingRecipe] = useState<Recipe | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit Recipe' : prefill ? 'Review Scanned Recipe' : 'Add Recipe' });
  }, [isEditing, prefill]);

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

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a recipe title.');
      return;
    }

    const filledIngredients = ingredients.filter((i) => i.name.trim());
    const filledSteps = steps.filter((s) => s.instruction.trim());

    setSaving(true);
    try {
      const now = Date.now();
      const recipe: Recipe = createRecipe({
        ...(existingRecipe ?? {}),
        title: title.trim(),
        category,
        servings: Math.max(1, parseInt(servings) || 1),
        prepTime: Math.max(0, parseInt(prepTime) || 0),
        cookTime: Math.max(0, parseInt(cookTime) || 0),
        ingredients: filledIngredients,
        steps: filledSteps,
        isFavorite,
        updatedAt: now,
        ...(isEditing && existingRecipe ? { id: existingRecipe.id, createdAt: existingRecipe.createdAt } : {}),
      });

      if (isEditing) {
        await updateRecipe(recipe);
        navigation.goBack();
      } else {
        await insertRecipe(recipe);
        navigation.goBack();
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save the recipe. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const styles = makeStyles(theme);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Title */}
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Spaghetti Bolognese"
          placeholderTextColor={theme.textSecondary}
        />

        {/* Category */}
        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {RECIPE_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Numeric row */}
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Servings</Text>
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
            <Text style={styles.label}>Prep (min)</Text>
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
            <Text style={styles.label}>Cook (min)</Text>
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

        {/* Favorite toggle */}
        <TouchableOpacity style={styles.favoriteRow} onPress={() => setIsFavorite((v) => !v)}>
          <Text style={[styles.heart, isFavorite && styles.heartActive]}>
            {isFavorite ? '♥' : '♡'}
          </Text>
          <Text style={styles.favoriteLabel}>
            {isFavorite ? 'Saved as favorite' : 'Mark as favorite'}
          </Text>
        </TouchableOpacity>

        {/* Ingredients */}
        <Text style={styles.sectionTitle}>Ingredients</Text>
        <View style={styles.card}>
          <View style={styles.ingredientHeader}>
            <Text style={[styles.colLabel, { flex: 2 }]}>Name</Text>
            <Text style={[styles.colLabel, { flex: 1 }]}>Qty</Text>
            <Text style={[styles.colLabel, { flex: 1 }]}>Unit</Text>
            <View style={{ width: 30 }} />
          </View>
          {ingredients.map((ing, i) => (
            <View key={ing.id} style={styles.ingredientRow}>
              <TextInput
                style={[styles.inlineInput, { flex: 2 }]}
                value={ing.name}
                onChangeText={(v) => updateIngredient(i, 'name', v)}
                placeholder="Ingredient"
                placeholderTextColor={theme.textSecondary}
              />
              <TextInput
                style={[styles.inlineInput, { flex: 1 }]}
                value={ing.quantity}
                onChangeText={(v) => updateIngredient(i, 'quantity', v)}
                placeholder="1"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.inlineInput, { flex: 1 }]}
                value={ing.unit}
                onChangeText={(v) => updateIngredient(i, 'unit', v)}
                placeholder="cup"
                placeholderTextColor={theme.textSecondary}
              />
              <TouchableOpacity
                onPress={() => removeIngredient(i)}
                style={styles.removeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addRowBtn} onPress={addIngredient}>
            <Text style={styles.addRowBtnText}>+ Add Ingredient</Text>
          </TouchableOpacity>
        </View>

        {/* Steps */}
        <Text style={styles.sectionTitle}>Steps</Text>
        <View style={styles.card}>
          {steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepCircleText}>{step.order}</Text>
              </View>
              <TextInput
                style={styles.stepInput}
                value={step.instruction}
                onChangeText={(v) => updateStep(i, v)}
                placeholder={`Step ${step.order}...`}
                placeholderTextColor={theme.textSecondary}
                multiline
              />
              <TouchableOpacity
                onPress={() => removeStep(i)}
                style={styles.removeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addRowBtn} onPress={addStep}>
            <Text style={styles.addRowBtnText}>+ Add Step</Text>
          </TouchableOpacity>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveButtonText}>{isEditing ? 'Update Recipe' : 'Save Recipe'}</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background },
    scroll: { padding: 16, paddingBottom: 40 },

    label: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
      backgroundColor: theme.card, borderRadius: 10, padding: 14,
      fontSize: 16, color: theme.text,
      borderWidth: 1, borderColor: theme.border,
    },
    inputSmall: {
      backgroundColor: theme.card, borderRadius: 10, padding: 12,
      fontSize: 15, color: theme.text, textAlign: 'center',
      borderWidth: 1, borderColor: theme.border,
    },

    categoryScroll: { marginBottom: 4 },
    categoryChip: {
      borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
      marginRight: 8, backgroundColor: theme.card,
      borderWidth: 1, borderColor: theme.border,
    },
    categoryChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    categoryChipText: { fontSize: 14, color: theme.textSecondary, fontWeight: '500' },
    categoryChipTextActive: { color: '#fff' },

    row: { flexDirection: 'row', gap: 10 },
    rowItem: { flex: 1 },

    favoriteRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 4 },
    heart: { fontSize: 24, color: theme.border, marginRight: 10 },
    heartActive: { color: theme.primary },
    favoriteLabel: { fontSize: 15, color: theme.textSecondary },

    sectionTitle: { fontSize: 17, fontWeight: '700', color: theme.text, marginTop: 20, marginBottom: 10 },
    card: {
      backgroundColor: theme.card, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: theme.border,
    },

    ingredientHeader: { flexDirection: 'row', marginBottom: 6 },
    colLabel: { fontSize: 11, color: theme.textSecondary, fontWeight: '600', textTransform: 'uppercase', minWidth: 0 },

    ingredientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 4 },
    inlineInput: {
      borderWidth: 1, borderColor: theme.border, borderRadius: 8,
      padding: 8, fontSize: 14, color: theme.text, backgroundColor: theme.background,
      // minWidth:0 allows flex items to shrink below content width on web
      minWidth: 0,
    },
    removeBtn: { width: 26, alignItems: 'center' },
    removeBtnText: { fontSize: 14, color: theme.textSecondary },
    addRowBtn: { marginTop: 6, paddingVertical: 8 },
    addRowBtnText: { fontSize: 14, color: theme.primary, fontWeight: '600' },

    stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10 },
    stepCircle: {
      width: 28, height: 28, borderRadius: 14, backgroundColor: theme.primary,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 6,
    },
    stepCircleText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    stepInput: {
      flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 8,
      padding: 10, fontSize: 14, color: theme.text, backgroundColor: theme.background,
      minHeight: 44,
    },

    saveButton: {
      backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 16,
      alignItems: 'center', marginTop: 24,
    },
    saveButtonDisabled: { opacity: 0.6 },
    saveButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  });
}
