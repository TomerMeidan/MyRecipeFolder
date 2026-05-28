import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Recipe } from '../types';
import { totalTime } from '../utils/recipe';
import { useTheme, ThemeColors } from '../theme/ThemeContext';

interface Props {
  recipe: Recipe;
  onPress: () => void;
}

export default function RecipeCard({ recipe, onPress }: Props) {
  const { theme } = useTheme();
  const minutes = totalTime(recipe);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{recipe.title}</Text>
        {recipe.isFavorite && <Text style={styles.heart}>♥</Text>}
      </View>

      <View style={styles.pill}>
        <Text style={styles.pillText}>{recipe.category}</Text>
      </View>

      <View style={styles.meta}>
        <Text style={styles.metaText}>⏱ {minutes > 0 ? `${minutes} min` : '—'}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>🍽 {recipe.servings} servings</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>{recipe.ingredients.length} ingredients</Text>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.07,
      shadowRadius: 4,
      elevation: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
      flex: 1,
    },
    heart: {
      fontSize: 18,
      color: theme.primary,
      marginLeft: 8,
    },
    pill: {
      alignSelf: 'flex-start',
      backgroundColor: theme.primaryLight,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 3,
      marginBottom: 10,
    },
    pillText: {
      fontSize: 12,
      color: theme.primary,
      fontWeight: '500',
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    metaText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    metaDot: {
      fontSize: 13,
      color: theme.border,
      marginHorizontal: 6,
    },
  });
}
