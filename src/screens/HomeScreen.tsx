import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Pressable,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Recipe, RootStackParamList } from '../types';
import { getAllRecipes } from '../db/recipeRepository';
import RecipeCard from '../components/RecipeCard';
import { useTheme, ThemeColors, ColorSchemeType } from '../theme/ThemeContext';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Swatch colours preview each scheme, so they are literal on purpose.
const SCHEME_COLORS: Array<{ key: ColorSchemeType; color: string }> = [
  { key: 'kitchen', color: '#FFE45C' },
  { key: 'default', color: '#E05C2D' },
  { key: 'blue',    color: '#2563EB' },
  { key: 'black',   color: '#0F172A' },
  { key: 'white',   color: '#94A3B8' },
];

export default function HomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { theme, isDarkMode, toggleDarkMode, colorScheme, setColorScheme } = useTheme();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [favOnly, setFavOnly] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getAllRecipes().then((data) => {
        if (active) {
          setRecipes(data);
          setLoading(false);
        }
      });
      return () => { active = false; };
    }, []),
  );

  const styles = makeStyles(theme);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const displayed = favOnly ? recipes.filter((r) => r.isFavorite) : recipes;

  return (
    <View style={styles.container}>
      <FlatList
        data={displayed}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            onPress={() => navigation.navigate('RecipeDetail', { recipeId: item.id })}
          />
        )}
        contentContainerStyle={displayed.length === 0 ? styles.emptyContainer : styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headingRow}>
              <Text style={styles.heading}>My Recipes</Text>
              <Pressable
                style={({ pressed }) => [styles.modeBtn, pressed && styles.pressed]}
                onPress={toggleDarkMode}
                accessibilityRole="button"
                accessibilityLabel={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <Ionicons name={isDarkMode ? 'sunny-outline' : 'moon-outline'} size={22} color={theme.text} />
              </Pressable>
            </View>
            <View style={styles.schemeRow}>
              {SCHEME_COLORS.map((s) => (
                <Pressable
                  key={s.key}
                  onPress={() => setColorScheme(s.key)}
                  style={styles.schemeHit}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: colorScheme === s.key }}
                  accessibilityLabel={`${s.key} colour scheme`}
                >
                  <View style={[styles.schemeRing, colorScheme === s.key && { borderColor: theme.text }]}>
                    <View style={[styles.schemeDot, { backgroundColor: s.color }]} />
                  </View>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [styles.filterChip, favOnly && styles.filterChipOn, pressed && styles.pressed]}
              onPress={() => setFavOnly((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ selected: favOnly }}
            >
              <Ionicons name={favOnly ? 'heart' : 'heart-outline'} size={18} color={theme.text} />
              <Text style={styles.filterChipText}>Favorites</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <Ionicons
              name={favOnly ? 'heart-outline' : 'restaurant-outline'}
              size={48}
              color={theme.textSecondary}
            />
            <Text style={styles.emptyTitle}>{favOnly ? 'No favorites yet' : 'Scan your first recipe'}</Text>
            <Text style={styles.emptySubtitle}>
              {favOnly
                ? 'Tap the heart on a recipe to keep it here.'
                : 'Photograph a recipe card or cookbook page and we will type it up for you.'}
            </Text>
            {!favOnly && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('ScanRecipe')}
                accessibilityRole="button"
              >
                <Ionicons name="camera-outline" size={22} color={theme.onPrimary} />
                <Text style={styles.emptyButtonText}>Scan a Recipe</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddEditRecipe', {})}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Add recipe"
      >
        <Ionicons name="add" size={32} color={theme.onPrimary} />
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background },
    pressed: { opacity: 0.6 },
    list: { paddingBottom: 110 },
    emptyContainer: { flexGrow: 1 },

    header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
    headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heading: { fontSize: 30, fontWeight: '800', color: theme.text },
    modeBtn: {
      width: 44, height: 44, borderRadius: 22,
      borderWidth: 1, borderColor: theme.borderStrong,
      alignItems: 'center', justifyContent: 'center',
    },

    schemeRow: { flexDirection: 'row', marginTop: 8, marginStart: -8 },
    schemeHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    schemeRing: { padding: 3, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
    // Hairline keeps dark swatches visible on a dark background.
    schemeDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: theme.borderStrong },

    filterChip: {
      alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
      minHeight: 44, borderRadius: 22, paddingHorizontal: 16, marginTop: 8,
      borderWidth: 1.5, borderColor: theme.borderStrong,
    },
    // The one highlighted element on Home: the active filter.
    filterChipOn: { backgroundColor: theme.highlight, borderColor: theme.highlight },
    filterChipText: { fontSize: 16, fontWeight: '700', color: theme.text },

    emptyInner: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 64 },
    emptyTitle: { fontSize: 24, fontWeight: '800', color: theme.text, marginTop: 16, marginBottom: 8, textAlign: 'center' },
    emptySubtitle: { fontSize: 17, lineHeight: 25, color: theme.textSecondary, textAlign: 'center' },
    emptyButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      minHeight: 52, paddingHorizontal: 24, marginTop: 24, borderRadius: 12,
      backgroundColor: theme.primary,
    },
    emptyButtonText: { fontSize: 17, fontWeight: '800', color: theme.onPrimary },

    fab: {
      position: 'absolute', bottom: 24, end: 20,
      width: 60, height: 60, borderRadius: 30,
      backgroundColor: theme.primary,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: theme.shadow, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },
  });
}
