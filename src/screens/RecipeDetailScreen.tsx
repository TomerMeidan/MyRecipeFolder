import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Pressable, Modal,
  StyleSheet, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useRecipe, useDeleteRecipe, useToggleFavorite, useSaveNutrition } from '../db/queries';
import { estimateNutrition } from '../utils/aiParser';
import { totalTime } from '../utils/recipe';
import { useTheme, ThemeColors } from '../theme/ThemeContext';
import { isRtlRecipe } from '../utils/rtl';
import { useLanguage } from '../i18n/LanguageContext';
import { categoryKey } from '../i18n/strings';

type Props = NativeStackScreenProps<RootStackParamList, 'RecipeDetail'>;

export default function RecipeDetailScreen({ route, navigation }: Props) {
  const { recipeId } = route.params;
  const { theme } = useTheme();
  const { t, isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  const { data: recipe, isPending, isPlaceholderData } = useRecipe(recipeId);
  const deleteMutation = useDeleteRecipe();
  const favoriteMutation = useToggleFavorite();
  const nutritionMutation = useSaveNutrition();
  const [deleting, setDeleting]     = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  // Ticked-off ingredients while cooking. Screen-local only, never saved.
  const [ticked, setTicked]         = useState<Set<string>>(new Set());
  const [estimating, setEstimating] = useState(false);
  const [calcError, setCalcError]   = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const toggleTicked = (id: string) => setTicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  useEffect(() => {
    if (recipe?.title) navigation.setOptions({ title: recipe.title });
  }, [recipe?.title]);

  const handleDelete = () => {
    // Alert.alert doesn't work reliably on web — use a custom modal instead
    if (Platform.OS === 'web') {
      setConfirmVisible(true);
    } else {
      Alert.alert(t('delete_title'), t('delete_confirm'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: confirmDelete },
      ]);
    }
  };

  const confirmDelete = async () => {
    setConfirmVisible(false);
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(recipeId);
      navigation.goBack();
    } catch (e: any) {
      setDeleting(false);
      const msg = e?.message ?? t('delete_failed_msg');
      console.error('[Delete]', msg);
      Alert.alert(t('delete_failed'), msg);
    }
  };

  const handleToggleFavorite = () => {
    if (!recipe) return;
    favoriteMutation.mutate({ id: recipe.id, isFavorite: !recipe.isFavorite });
  };

  const handleEstimate = async () => {
    if (!recipe) return;
    setEstimating(true);
    setCalcError(null);
    try {
      const { caloriesPerServing, nutrition } = await estimateNutrition(recipe.ingredients, recipe.servings);
      await nutritionMutation.mutateAsync({ id: recipe.id, caloriesPerServing, nutrition });
    } catch (e: any) {
      setCalcError(t('calc_calories_failed', { error: e?.message ?? '' }));
    } finally {
      setEstimating(false);
    }
  };

  const styles = makeStyles(theme, insets.bottom);

  if (isPending) {
    return <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

  if (!recipe) {
    return <View style={styles.center}><Text style={styles.errorText}>{t('recipe_not_found')}</Text></View>;
  }

  // Recipe content (title, ingredients, steps) follows the recipe's language.
  // Everything else - facts, section titles, buttons - follows the UI language.
  const recipeDir = { direction: isRtlRecipe(recipe) ? 'rtl' : 'ltr' } as const;
  const uiText = { writingDirection: isRTL ? 'rtl' : 'ltr' } as const;
  const minUnit = ` ${t('min_unit')}`;

  const facts = [
    { label: t('fact_servings'), value: recipe.servings, unit: '' },
    { label: t('fact_prep'),     value: recipe.prepTime, unit: minUnit },
    { label: t('fact_cook'),     value: recipe.cookTime, unit: minUnit },
    { label: t('fact_total'),    value: totalTime(recipe), unit: minUnit },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={recipeDir}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{recipe.title}</Text>
          <Pressable
            onPress={handleToggleFavorite}
            style={({ pressed }) => [styles.favButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t(recipe.isFavorite ? 'a11y_fav_remove' : 'a11y_fav_add')}
            accessibilityState={{ selected: recipe.isFavorite }}
          >
            <Ionicons
              name={recipe.isFavorite ? 'heart' : 'heart-outline'}
              size={28}
              color={recipe.isFavorite ? theme.primary : theme.textSecondary}
            />
          </Pressable>
        </View>

        <View style={styles.tag}>
          <Text style={[styles.tagText, uiText]}>{t(categoryKey(recipe.category))}</Text>
        </View>
        </View>

        {/* Key facts */}
        <View style={styles.facts}>
          {facts.map((f, i) => (
            <React.Fragment key={f.label}>
              {i > 0 && <View style={styles.factDivider} />}
              <View style={styles.fact}>
                <Text style={styles.factValue}>
                  {f.value}<Text style={styles.factUnit}>{f.unit}</Text>
                </Text>
                <Text style={[styles.factLabel, uiText]}>{f.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Until the full recipe arrives, the list entry shows the header and facts only. */}
        {isPlaceholderData ? (
          <ActivityIndicator style={styles.sectionsLoading} size="large" color={theme.primary} />
        ) : (<>

        {/* Calories */}
        <View style={styles.calories}>
          {recipe.caloriesPerServing !== undefined ? (
            <>
              <Pressable
                onPress={() => setShowBreakdown((v) => !v)}
                disabled={!recipe.nutrition}
                style={({ pressed }) => [styles.calPress, pressed && styles.pressed]}
                accessibilityRole={recipe.nutrition ? 'button' : undefined}
                accessibilityLabel={recipe.nutrition ? t(showBreakdown ? 'a11y_calories_hide' : 'a11y_calories_show') : undefined}
                accessibilityState={recipe.nutrition ? { expanded: showBreakdown } : undefined}
              >
                <View style={styles.calRow}>
                  <Text style={styles.calValue}>
                    {recipe.caloriesManual ? '' : '≈ '}{recipe.caloriesPerServing}
                    <Text style={styles.factUnit}> {t('kcal_unit')}</Text>
                    <Text style={[styles.calPer, uiText]}>{'  '}{t('per_serving')}</Text>
                  </Text>
                  {recipe.nutrition && (
                    <Ionicons name={showBreakdown ? 'chevron-up' : 'chevron-down'} size={22} color={theme.textSecondary} />
                  )}
                </View>
                {recipe.nutrition && (
                  <View style={styles.macros}>
                    {([['macro_protein', recipe.nutrition.proteinG], ['macro_carbs', recipe.nutrition.carbsG], ['macro_fat', recipe.nutrition.fatG]] as const).map(([key, g]) => (
                      <View key={key} style={styles.macro}>
                        <Text style={styles.macroValue}>{g}<Text style={styles.macroUnit}> {t('gram_unit')}</Text></Text>
                        <Text style={[styles.factLabel, uiText]}>{t(key)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Pressable>
              <Text style={[styles.calNote, uiText]}>
                {t(recipe.caloriesManual ? 'calories_manual_note' : 'calories_estimate_note')}
              </Text>
              {showBreakdown && recipe.nutrition && (
                <View style={styles.breakdown}>
                  <Text style={[styles.breakdownTitle, uiText]}>{t('calories_breakdown_title')}</Text>
                  <View style={recipeDir}>
                    {recipe.nutrition.ingredients.map((i, idx) => (
                      <View key={`${idx}-${i.name}`} style={styles.breakdownRow}>
                        <Text style={styles.breakdownName}>{i.name}</Text>
                        <Text style={styles.breakdownKcal}>{i.kcal} {t('kcal_unit')}</Text>
                      </View>
                    ))}
                  </View>
                  {recipe.nutrition.ingredients.length > 0 && (
                    <Text style={[styles.breakdownTotal, uiText]}>
                      {t('calories_total_line', {
                        total: recipe.nutrition.ingredients.reduce((sum, i) => sum + i.kcal, 0),
                        servings: recipe.servings,
                      })}
                    </Text>
                  )}
                </View>
              )}
            </>
          ) : (
            <Text style={[styles.calTitle, uiText]}>{t('calories_title')}</Text>
          )}

          {!recipe.caloriesManual && (
            recipe.ingredients.some((i) => i.name.trim()) ? (
              <TouchableOpacity
                style={[styles.calButton, recipe.caloriesPerServing !== undefined && styles.calButtonQuiet, estimating && { opacity: 0.6 }]}
                onPress={handleEstimate}
                disabled={estimating}
                accessibilityRole="button"
              >
                {estimating
                  ? <ActivityIndicator size="small" color={theme.text} />
                  : <Ionicons name={recipe.caloriesPerServing !== undefined ? 'refresh' : 'calculator-outline'} size={20} color={theme.text} />}
                <Text style={styles.calButtonText}>
                  {t(estimating ? 'calc_calories_busy' : recipe.caloriesPerServing !== undefined ? 'recalc_calories' : 'calc_calories')}
                </Text>
              </TouchableOpacity>
            ) : recipe.caloriesPerServing === undefined && (
              <Text style={[styles.calNote, uiText]}>{t('calories_need_ingredients')}</Text>
            )
          )}
          {calcError && <Text style={[styles.calError, uiText]}>{calcError}</Text>}
        </View>

        {/* Ingredients */}
        <Text style={[styles.sectionTitle, uiText]}>{t('ingredients')}</Text>
        <View style={recipeDir}>
        {recipe.ingredients.length === 0
          ? <Text style={[styles.emptySection, uiText]}>{t('no_ingredients')}</Text>
          : recipe.ingredients.map((ing) => {
            const done = ticked.has(ing.id);
            const amount = [ing.quantity, ing.unit].filter(Boolean).join(' ');
            return (
              <Pressable
                key={ing.id}
                onPress={() => toggleTicked(ing.id)}
                style={({ pressed }) => [styles.ingredientRow, pressed && styles.pressed]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={[amount, ing.name].filter(Boolean).join(' ')}
              >
                <View style={[styles.checkbox, done && styles.checkboxOn]}>
                  {done && <Ionicons name="checkmark" size={18} color={theme.onPrimary} />}
                </View>
                <View style={styles.amountCol}>
                  {amount !== '' && (
                    <View>
                      {!done && <View style={styles.mark} />}
                      <Text style={[styles.amount, done && styles.doneText]}>{amount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.ingredientName, done && styles.doneText]}>{ing.name}</Text>
              </Pressable>
            );
          })
        }
        </View>

        {/* Steps */}
        <Text style={[styles.sectionTitle, styles.stepsTitle, uiText]}>{t('how_to_make')}</Text>
        <View style={recipeDir}>
        {recipe.steps.length === 0
          ? <Text style={[styles.emptySection, uiText]}>{t('no_steps')}</Text>
          : recipe.steps.map((step) => (
            <View key={step.order} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{step.order}</Text>
              </View>
              <Text style={styles.stepText}>{step.instruction}</Text>
            </View>
          ))
        }
        </View>
        </>)}

      </ScrollView>

      {/* Action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('AddEditRecipe', { recipeId: recipe.id })}
          accessibilityRole="button"
          accessibilityLabel={t('a11y_edit_recipe')}
        >
          <Ionicons name="create-outline" size={22} color={theme.onPrimary} />
          <Text style={styles.editButtonText}>{t('edit_recipe')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.deleteButton, deleting && { opacity: 0.5 }]}
          onPress={handleDelete}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel={t('a11y_delete_recipe')}
        >
          <Ionicons name="trash-outline" size={20} color={theme.errorText} />
          <Text style={styles.deleteButtonText}>{deleting ? t('deleting') : t('delete')}</Text>
        </TouchableOpacity>
      </View>

      {/* Web-compatible delete confirmation modal */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }, uiText]}>{t('delete_title')}</Text>
            <Text style={[styles.modalMsg, { color: theme.textSecondary }, uiText]}>
              {t('delete_confirm_long')}
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalCancel, { borderColor: theme.border }]} onPress={() => setConfirmVisible(false)}>
                <Text style={[styles.modalCancelText, { color: theme.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDelete} onPress={confirmDelete}>
                <Text style={styles.modalDeleteText}>{t('delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(theme: ThemeColors, bottomInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background },
    errorText: { fontSize: 17, color: theme.textSecondary },
    scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120 },

    pressed: { opacity: 0.6 },

    // Header
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    title: { flex: 1, fontSize: 30, lineHeight: 36, fontWeight: '800', color: theme.text, paddingTop: 4, textAlign: 'auto' },
    favButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
    tag: {
      alignSelf: 'flex-start', marginTop: 10,
      backgroundColor: theme.card, borderRadius: 6,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    tagText: { fontSize: 14, fontWeight: '700', color: theme.textSecondary },

    // Facts
    facts: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: theme.card, borderRadius: 12,
      paddingVertical: 14, marginTop: 20,
    },
    fact: { flex: 1, alignItems: 'center' },
    factValue: { fontSize: 20, fontWeight: '800', color: theme.text, fontVariant: ['tabular-nums'] },
    factUnit: { fontSize: 14, fontWeight: '700' },
    factLabel: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginTop: 2 },
    factDivider: { width: 1, height: 32, backgroundColor: theme.border },

    // Calories
    calories: { marginTop: 12, paddingVertical: 14, paddingHorizontal: 14, backgroundColor: theme.card, borderRadius: 12, gap: 10 },
    calPress: { gap: 12 },
    calRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    calValue: { flex: 1, fontSize: 24, fontWeight: '800', color: theme.text, fontVariant: ['tabular-nums'] },
    calPer: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
    macros: { flexDirection: 'row', justifyContent: 'space-between' },
    macro: { flex: 1, alignItems: 'center' },
    macroValue: { fontSize: 17, fontWeight: '800', color: theme.text, fontVariant: ['tabular-nums'] },
    macroUnit: { fontSize: 13, fontWeight: '700' },
    calTitle: { fontSize: 17, fontWeight: '800', color: theme.text },
    calNote: { fontSize: 15, color: theme.textSecondary },
    calError: { fontSize: 15, color: theme.errorText },
    calButton: {
      minHeight: 48, flexDirection: 'row', gap: 8, alignSelf: 'flex-start',
      paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: theme.borderStrong,
      alignItems: 'center', justifyContent: 'center',
    },
    // Recalculate: same 48px tap area, no border, so the number stays the focus.
    calButtonQuiet: { borderWidth: 0, paddingHorizontal: 4 },
    calButtonText: { fontSize: 16, fontWeight: '700', color: theme.text },
    breakdown: { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10 },
    breakdownTitle: { fontSize: 15, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 },
    breakdownName: { flex: 1, fontSize: 15, color: theme.text, textAlign: 'auto' },
    breakdownKcal: { fontSize: 15, fontWeight: '700', color: theme.text, fontVariant: ['tabular-nums'] },
    breakdownTotal: { fontSize: 15, fontWeight: '700', color: theme.textSecondary, marginTop: 6, fontVariant: ['tabular-nums'] },

    sectionsLoading: { marginTop: 40 },
    sectionTitle: { fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 28, marginBottom: 4 },
    stepsTitle: { marginTop: 32, marginBottom: 8 },
    emptySection: { fontSize: 17, color: theme.textSecondary, paddingVertical: 12 },

    // Ingredients
    ingredientRow: {
      flexDirection: 'row', minHeight: 52, alignItems: 'center', gap: 12, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    checkbox: {
      width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: theme.borderStrong,
      alignItems: 'center', justifyContent: 'center',
    },
    checkboxOn: { backgroundColor: theme.primary, borderColor: theme.primary },
    // Fixed width so amounts scan as one column.
    amountCol: { width: 80, alignItems: 'flex-start' },
    // Highlighter stroke under the bottom ~45% of the amount.
    mark: {
      position: 'absolute', left: -3, right: -3, bottom: 1, height: '45%',
      backgroundColor: theme.highlight, borderRadius: 2,
    },
    amount: { fontSize: 17, fontWeight: '800', color: theme.text, fontVariant: ['tabular-nums'], textAlign: 'auto' },
    ingredientName: { flex: 1, fontSize: 17, lineHeight: 24, color: theme.text, textAlign: 'auto' },
    doneText: { color: theme.textSecondary, textDecorationLine: 'line-through' },

    // Steps
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 12 },
    stepNumber: {
      width: 30, height: 30, borderRadius: 8, marginTop: 2,
      backgroundColor: theme.highlight, alignItems: 'center', justifyContent: 'center',
    },
    stepNumberText: { fontSize: 16, fontWeight: '800', color: theme.text, fontVariant: ['tabular-nums'] },
    stepText: { flex: 1, fontSize: 19, lineHeight: 29, color: theme.text, textAlign: 'auto' },

    // Action bar
    actionBar: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      flexDirection: 'row', padding: 16,
      paddingBottom: Math.max(bottomInset, 16),
      backgroundColor: theme.background,
      borderTopWidth: 1, borderTopColor: theme.border,
      gap: 12,
    },
    editButton: {
      flex: 1, minHeight: 52, flexDirection: 'row', gap: 8,
      backgroundColor: theme.primary, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    editButtonText: { fontSize: 17, fontWeight: '800', color: theme.onPrimary },
    deleteButton: {
      minHeight: 52, flexDirection: 'row', gap: 6,
      borderWidth: 1.5, borderColor: theme.borderStrong, borderRadius: 12,
      paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center',
    },
    deleteButtonText: { fontSize: 17, fontWeight: '700', color: theme.errorText },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
    modalBox:     { borderRadius: 16, padding: 24, width: '85%', maxWidth: 380 },
    modalTitle:   { fontSize: 18, fontWeight: '700', marginBottom: 10 },
    modalMsg:     { fontSize: 14, lineHeight: 20, marginBottom: 24 },
    modalBtns:    { flexDirection: 'row', gap: 12 },
    modalCancel:  { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
    modalCancelText: { fontSize: 15, fontWeight: '600' },
    // errorText fill with background-coloured text stays >= 4.5:1 in light and dark
    modalDelete:  { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: theme.errorText },
    modalDeleteText: { fontSize: 15, fontWeight: '700', color: theme.background },
  });
}
