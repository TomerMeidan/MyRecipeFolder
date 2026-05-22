import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useDatabase } from '../db/DatabaseProvider';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Recipe } from '../types';
import { getRecipeById, deleteRecipe, toggleFavorite } from '../db/recipeRepository';
import { totalTime } from '../utils/recipe';

type Props = NativeStackScreenProps<RootStackParamList, 'RecipeDetail'>;

export default function RecipeDetailScreen({ route, navigation }: Props) {
  const { recipeId } = route.params;
  const db = useDatabase();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getRecipeById(db, recipeId).then((data) => {
        if (active) {
          setRecipe(data);
          setLoading(false);
          if (data) navigation.setOptions({ title: data.title });
        }
      });
      return () => { active = false; };
    }, [db, recipeId]),
  );

  const handleDelete = () => {
    Alert.alert('Delete Recipe', 'Are you sure you want to delete this recipe?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteRecipe(db, recipeId);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleToggleFavorite = async () => {
    if (!recipe) return;
    await toggleFavorite(db, recipe.id, !recipe.isFavorite);
    setRecipe({ ...recipe, isFavorite: !recipe.isFavorite });
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#E05C2D" /></View>;
  }

  if (!recipe) {
    return <View style={styles.center}><Text style={styles.errorText}>Recipe not found.</Text></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{recipe.title}</Text>
            <TouchableOpacity onPress={handleToggleFavorite} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.heart, recipe.isFavorite && styles.heartActive]}>
                {recipe.isFavorite ? '♥' : '♡'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pill}>
            <Text style={styles.pillText}>{recipe.category}</Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>{recipe.servings}</Text>
              <Text style={styles.metaLabel}>Servings</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>{recipe.prepTime} min</Text>
              <Text style={styles.metaLabel}>Prep</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>{recipe.cookTime} min</Text>
              <Text style={styles.metaLabel}>Cook</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>{totalTime(recipe)} min</Text>
              <Text style={styles.metaLabel}>Total</Text>
            </View>
          </View>
        </View>

        {/* Ingredients */}
        <Text style={styles.sectionTitle}>Ingredients</Text>
        <View style={styles.section}>
          {recipe.ingredients.length === 0
            ? <Text style={styles.emptySection}>No ingredients added.</Text>
            : recipe.ingredients.map((ing) => (
              <View key={ing.id} style={styles.ingredientRow}>
                <View style={styles.bullet} />
                <Text style={styles.ingredientText}>
                  {[ing.quantity, ing.unit, ing.name].filter(Boolean).join(' ')}
                </Text>
              </View>
            ))
          }
        </View>

        {/* Steps */}
        <Text style={styles.sectionTitle}>How to Make It</Text>
        <View style={styles.section}>
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
        </View>

      </ScrollView>

      {/* Action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('AddEditRecipe', { recipeId: recipe.id })}
        >
          <Text style={styles.editButtonText}>Edit Recipe</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: '#888' },
  scroll: { paddingBottom: 100 },

  headerCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 22, fontWeight: '700', color: '#1C1C1C', flex: 1, marginRight: 8 },
  heart: { fontSize: 26, color: '#ccc' },
  heartActive: { color: '#E05C2D' },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF0EB',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  pillText: { fontSize: 13, color: '#E05C2D', fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaItem: { flex: 1, alignItems: 'center' },
  metaValue: { fontSize: 15, fontWeight: '600', color: '#1C1C1C' },
  metaLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  metaDivider: { width: 1, height: 30, backgroundColor: '#F0F0F0' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1C', marginHorizontal: 16, marginBottom: 8, marginTop: 8 },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  emptySection: { fontSize: 14, color: '#aaa', fontStyle: 'italic' },

  ingredientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  bullet: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E05C2D', marginRight: 12 },
  ingredientText: { fontSize: 15, color: '#1C1C1C', flex: 1 },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  stepNumber: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#E05C2D', alignItems: 'center', justifyContent: 'center',
    marginRight: 12, marginTop: 1, flexShrink: 0,
  },
  stepNumberText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  stepText: { fontSize: 15, color: '#1C1C1C', flex: 1, lineHeight: 22 },

  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', padding: 16, paddingBottom: 28,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    gap: 12,
  },
  editButton: {
    flex: 1, backgroundColor: '#E05C2D', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  editButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  deleteButton: {
    backgroundColor: '#FFF0EB', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center',
  },
  deleteButtonText: { fontSize: 16, fontWeight: '600', color: '#E05C2D' },
});
