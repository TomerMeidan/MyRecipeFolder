import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Pressable, Modal,
  StyleSheet, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Recipe } from '../types';
import { getRecipeById, deleteRecipe, toggleFavorite } from '../db/recipeRepository';
import { totalTime } from '../utils/recipe';
import { useTheme, ThemeColors } from '../theme/ThemeContext';
import { isRtlRecipe } from '../utils/rtl';

type Props = NativeStackScreenProps<RootStackParamList, 'RecipeDetail'>;

export default function RecipeDetailScreen({ route, navigation }: Props) {
  const { recipeId } = route.params;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [recipe, setRecipe]         = useState<Recipe | null>(null);
  const [loading, setLoading]       = useState(true);
  const [deleting, setDeleting]     = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  // Ticked-off ingredients while cooking. Screen-local only, never saved.
  const [ticked, setTicked]         = useState<Set<string>>(new Set());

  const toggleTicked = (id: string) => setTicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getRecipeById(recipeId).then((data) => {
        if (active) {
          setRecipe(data);
          setLoading(false);
          if (data) navigation.setOptions({ title: data.title });
        }
      });
      return () => { active = false; };
    }, [recipeId]),
  );

  const handleDelete = () => {
    // Alert.alert doesn't work reliably on web — use a custom modal instead
    if (Platform.OS === 'web') {
      setConfirmVisible(true);
    } else {
      Alert.alert('Delete Recipe', 'Are you sure you want to delete this recipe?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      ]);
    }
  };

  const confirmDelete = async () => {
    setConfirmVisible(false);
    setDeleting(true);
    try {
      await deleteRecipe(recipeId);
      navigation.goBack();
    } catch (e: any) {
      setDeleting(false);
      const msg = e?.message ?? 'Could not delete the recipe.';
      console.error('[Delete]', msg);
      Alert.alert('Delete failed', msg);
    }
  };

  const handleToggleFavorite = async () => {
    if (!recipe) return;
    await toggleFavorite(recipe.id, !recipe.isFavorite);
    setRecipe({ ...recipe, isFavorite: !recipe.isFavorite });
  };

  const styles = makeStyles(theme, insets.bottom);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

  if (!recipe) {
    return <View style={styles.center}><Text style={styles.errorText}>Recipe not found.</Text></View>;
  }

  // The recipe body follows the recipe's language; rows and text inherit it.
  const direction = isRtlRecipe(recipe) ? 'rtl' : 'ltr';

  const facts = [
    { label: 'Servings', value: recipe.servings, unit: '' },
    { label: 'Prep',     value: recipe.prepTime, unit: ' min' },
    { label: 'Cook',     value: recipe.cookTime, unit: ' min' },
    { label: 'Total',    value: totalTime(recipe), unit: ' min' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { direction }]}>

        {/* Header */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{recipe.title}</Text>
          <Pressable
            onPress={handleToggleFavorite}
            style={({ pressed }) => [styles.favButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
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
          <Text style={styles.tagText}>{recipe.category}</Text>
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
                <Text style={styles.factLabel}>{f.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Ingredients */}
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {recipe.ingredients.length === 0
          ? <Text style={styles.emptySection}>No ingredients added.</Text>
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

        {/* Steps */}
        <Text style={[styles.sectionTitle, styles.stepsTitle]}>How to Make It</Text>
        {recipe.steps.length === 0
          ? <Text style={styles.emptySection}>No steps added.</Text>
          : recipe.steps.map((step) => (
            <View key={step.order} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{step.order}</Text>
              </View>
              <Text style={styles.stepText}>{step.instruction}</Text>
            </View>
          ))
        }

      </ScrollView>

      {/* Action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('AddEditRecipe', { recipeId: recipe.id })}
          accessibilityRole="button"
          accessibilityLabel="Edit recipe"
        >
          <Ionicons name="create-outline" size={22} color={theme.onPrimary} />
          <Text style={styles.editButtonText}>Edit Recipe</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.deleteButton, deleting && { opacity: 0.5 }]}
          onPress={handleDelete}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="Delete recipe"
        >
          <Ionicons name="trash-outline" size={20} color={theme.errorText} />
          <Text style={styles.deleteButtonText}>{deleting ? 'Deleting…' : 'Delete'}</Text>
        </TouchableOpacity>
      </View>

      {/* Web-compatible delete confirmation modal */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Delete Recipe</Text>
            <Text style={[styles.modalMsg, { color: theme.textSecondary }]}>
              Are you sure you want to delete this recipe? This cannot be undone.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalCancel, { borderColor: theme.border }]} onPress={() => setConfirmVisible(false)}>
                <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDelete} onPress={confirmDelete}>
                <Text style={styles.modalDeleteText}>Delete</Text>
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
