import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Recipe, RecipeCategory, RootStackParamList } from '../types';
import { filterRecipes } from '../db/recipeRepository';
import { RECIPE_CATEGORIES } from '../utils/constants';
import RecipeCard from '../components/RecipeCard';
import { useTheme, ThemeColors } from '../theme/ThemeContext';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function SearchScreen() {
  const navigation = useNavigation<NavProp>();
  const { theme } = useTheme();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<RecipeCategory | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [results, setResults] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (q: string, cat: RecipeCategory | null) => {
      setLoading(true);
      const data = await filterRecipes(q, cat ?? undefined);
      setResults(data);
      setSearched(true);
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(query, selectedCategory);
    }, query.length > 0 ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selectedCategory, runSearch]);

  useFocusEffect(
    useCallback(() => {
      runSearch(query, selectedCategory);
    }, []),
  );

  const handleCategoryPress = (cat: RecipeCategory) => {
    setSelectedCategory((prev) => (prev === cat ? null : cat));
  };

  const clearQuery = () => setQuery('');

  const displayed = favOnly ? results.filter((r) => r.isFavorite) : results;

  const styles = makeStyles(theme);

  return (
    <View style={styles.container}>

      {/* Search bar */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Title, ingredient or category…"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="search"
            clearButtonMode="never"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearQuery} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter chips — favorites toggle + category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContent}
      >
        <TouchableOpacity
          style={[styles.chip, styles.chipFav, favOnly && styles.chipActive]}
          onPress={() => setFavOnly((v) => !v)}
        >
          <Text style={[styles.chipText, favOnly && styles.chipTextActive]}>♥  Favorites</Text>
        </TouchableOpacity>
        {RECIPE_CATEGORIES.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => handleCategoryPress(cat)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Results */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
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
            searched && !loading ? (
              <Text style={styles.resultCount}>
                {displayed.length === 0
                  ? 'No recipes found'
                  : `${displayed.length} recipe${displayed.length !== 1 ? 's' : ''} found`}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            searched ? (
              <View style={styles.emptyInner}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>No results</Text>
                <Text style={styles.emptySubtitle}>
                  Try a different name, ingredient{'\n'}or remove the category filter
                </Text>
              </View>
            ) : null
          }
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    searchBarWrapper: { backgroundColor: theme.card, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
    searchBar: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: theme.background, borderRadius: 12,
      paddingHorizontal: 12, paddingVertical: 10,
      borderWidth: 1, borderColor: theme.border,
    },
    searchIcon: { fontSize: 16, marginRight: 8 },
    searchInput: { flex: 1, fontSize: 15, color: theme.text },
    clearBtn: { fontSize: 14, color: theme.textSecondary, paddingLeft: 8 },

    chipScroll: { backgroundColor: theme.card },
    chipContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
    chip: {
      borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
      backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border,
    },
    chipFav: { borderColor: theme.primary },
    chipActive: { backgroundColor: theme.primaryLight, borderColor: theme.primary },
    chipText: { fontSize: 13, color: theme.textSecondary, fontWeight: '500' },
    chipTextActive: { color: theme.primary },

    list: { paddingTop: 12, paddingBottom: 40 },
    emptyContainer: { flex: 1, paddingTop: 12 },
    resultCount: { fontSize: 13, color: theme.textSecondary, marginHorizontal: 16, marginBottom: 8 },

    emptyInner: { alignItems: 'center', marginTop: 70 },
    emptyIcon: { fontSize: 48, marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.text, marginBottom: 6 },
    emptySubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
  });
}
