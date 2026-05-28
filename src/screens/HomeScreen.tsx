import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useDatabase } from '../db/DatabaseProvider';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Recipe, RootStackParamList } from '../types';
import { getAllRecipes } from '../db/recipeRepository';
import RecipeCard from '../components/RecipeCard';
import { useTheme, ColorSchemeType } from '../theme/ThemeContext';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const SCHEME_COLORS: Array<{ key: ColorSchemeType; color: string }> = [
  { key: 'default', color: '#E05C2D' },
  { key: 'blue',    color: '#2563EB' },
  { key: 'black',   color: '#0F172A' },
  { key: 'white',   color: '#94A3B8' },
];

export default function HomeScreen() {
  const db = useDatabase();
  const navigation = useNavigation<NavProp>();
  const { theme, isDarkMode, toggleDarkMode, colorScheme, setColorScheme } = useTheme();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getAllRecipes(db).then((data) => {
        if (active) {
          setRecipes(data);
          setLoading(false);
        }
      });
      return () => { active = false; };
    }, [db]),
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            onPress={() => navigation.navigate('RecipeDetail', { recipeId: item.id })}
          />
        )}
        contentContainerStyle={recipes.length === 0 ? styles.emptyContainer : styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.headingRow}>
              <Text style={[styles.heading, { color: theme.text }]}>My Recipes</Text>
              <TouchableOpacity
                style={[styles.modeBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={toggleDarkMode}
              >
                <Text style={styles.modeBtnIcon}>{isDarkMode ? '☀️' : '🌙'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.schemeRow}>
              {SCHEME_COLORS.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setColorScheme(s.key)}
                  style={[
                    styles.schemeDot,
                    { backgroundColor: s.color },
                    colorScheme === s.key && { borderWidth: 2.5, borderColor: theme.text },
                  ]}
                />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <Text style={styles.emptyIcon}>🍳</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No recipes yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Tap + to add your first recipe</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
        onPress={() => navigation.navigate('AddEditRecipe', {})}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingTop: 8, paddingBottom: 100 },
  emptyContainer: { flex: 1, paddingTop: 8 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 10,
  },
  heading: { fontSize: 28, fontWeight: '700' },
  schemeRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  schemeDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  modeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnIcon: { fontSize: 18 },
  emptyInner: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginBottom: 6 },
  emptySubtitle: { fontSize: 15 },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { fontSize: 30, color: '#fff', lineHeight: 34 },
});
