import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { useDatabase } from '../db/DatabaseProvider';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Recipe, RecipeCategory, RootStackParamList } from '../types';
import { filterRecipes } from '../db/recipeRepository';
import { RECIPE_CATEGORIES } from '../utils/constants';
import RecipeCard from '../components/RecipeCard';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function SearchScreen() {
  const db = useDatabase();
  const navigation = useNavigation<NavProp>();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<RecipeCategory | null>(null);
  const [results, setResults] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (q: string, cat: RecipeCategory | null) => {
      setLoading(true);
      const data = await filterRecipes(db, q, cat ?? undefined);
      setResults(data);
      setSearched(true);
      setLoading(false);
    },
    [db],
  );

  // Debounce text input; category changes fire immediately
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(query, selectedCategory);
    }, query.length > 0 ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selectedCategory, runSearch]);

  // Re-run current search whenever the tab comes back into focus
  useFocusEffect(
    useCallback(() => {
      runSearch(query, selectedCategory);
    }, [db]),
  );

  const handleCategoryPress = (cat: RecipeCategory) => {
    setSelectedCategory((prev) => (prev === cat ? null : cat));
  };

  const clearQuery = () => setQuery('');

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
            placeholderTextColor="#aaa"
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

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContent}
      >
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
          <ActivityIndicator size="large" color="#E05C2D" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              onPress={() => navigation.navigate('RecipeDetail', { recipeId: item.id })}
            />
          )}
          contentContainerStyle={results.length === 0 ? styles.emptyContainer : styles.list}
          ListHeaderComponent={
            searched && !loading ? (
              <Text style={styles.resultCount}>
                {results.length === 0
                  ? 'No recipes found'
                  : `${results.length} recipe${results.length !== 1 ? 's' : ''} found`}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  searchBarWrapper: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F2F2F2', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#1C1C1C' },
  clearBtn: { fontSize: 14, color: '#aaa', paddingLeft: 8 },

  chipScroll: { backgroundColor: '#fff', maxHeight: 52 },
  chipContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 8, flexDirection: 'row' },
  chip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: '#F2F2F2', borderWidth: 1, borderColor: 'transparent',
  },
  chipActive: { backgroundColor: '#FFF0EB', borderColor: '#E05C2D' },
  chipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  chipTextActive: { color: '#E05C2D' },

  list: { paddingTop: 12, paddingBottom: 40 },
  emptyContainer: { flex: 1, paddingTop: 12 },
  resultCount: { fontSize: 13, color: '#888', marginHorizontal: 16, marginBottom: 8 },

  emptyInner: { alignItems: 'center', marginTop: 70 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1C1C1C', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
});
