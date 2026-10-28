import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Recipe, RecipeCategory, RootStackParamList } from '../types';
import { filterRecipes } from '../db/recipeRepository';
import { RECIPE_CATEGORIES } from '../utils/constants';
import RecipeCard from '../components/RecipeCard';
import { useTheme, ThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { categoryKey } from '../i18n/strings';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function SearchScreen() {
  const navigation = useNavigation<NavProp>();
  const { theme } = useTheme();
  const { t, tp } = useLanguage();

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
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t('search_placeholder')}
            placeholderTextColor={theme.textSecondary}
            returnKeyType="search"
            clearButtonMode="never"
            autoCorrect={false}
            accessibilityLabel={t('a11y_search')}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearQuery} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel={t('a11y_clear_search')}>
              <Ionicons name="close-circle" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter chips — favorites toggle + category chips */}
      <View style={styles.chipScroll}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipContent}
      >
        <TouchableOpacity
          style={[styles.chip, favOnly && styles.chipActive]}
          onPress={() => setFavOnly((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ selected: favOnly }}
        >
          <Ionicons name={favOnly ? 'heart' : 'heart-outline'} size={16} color={favOnly ? theme.background : theme.text} />
          <Text style={[styles.chipText, favOnly && styles.chipTextActive]}>{t('favorites')}</Text>
        </TouchableOpacity>
        {RECIPE_CATEGORIES.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => handleCategoryPress(cat)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(categoryKey(cat))}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      </View>

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
            searched && !loading && displayed.length > 0 ? (
              <Text style={styles.resultCount}>
                {tp('recipes_count', displayed.length)}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            searched ? (
              <View style={styles.emptyInner}>
                <Ionicons name="search-outline" size={44} color={theme.textSecondary} />
                <Text style={styles.emptyTitle}>{t('search_empty_title')}</Text>
                <Text style={styles.emptySubtitle}>
                  {t('search_empty_body')}
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

    searchBarWrapper: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      minHeight: 52, borderRadius: 12, paddingStart: 14,
      backgroundColor: theme.card, borderWidth: 1.5, borderColor: theme.borderStrong,
    },
    searchInput: { flex: 1, alignSelf: 'stretch', fontSize: 17, color: theme.text },
    clearBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },

    chipScroll: { borderBottomWidth: 1, borderBottomColor: theme.border },
    chipContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      minHeight: 44, borderRadius: 22, paddingHorizontal: 16,
      borderWidth: 1.5, borderColor: theme.borderStrong,
    },
    // Selected chips are an inverted surface: quiet in both modes, unlike a yellow fill in dark.
    chipActive: { backgroundColor: theme.text, borderColor: theme.text },
    chipText: { fontSize: 15, color: theme.text, fontWeight: '700' },
    chipTextActive: { color: theme.background },

    list: { paddingBottom: 40 },
    emptyContainer: { flexGrow: 1 },
    resultCount: { fontSize: 15, fontWeight: '600', color: theme.textSecondary, marginHorizontal: 16, marginTop: 12, marginBottom: 4 },

    emptyInner: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 64 },
    emptyTitle: { fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 14, marginBottom: 6 },
    emptySubtitle: { fontSize: 17, lineHeight: 25, color: theme.textSecondary, textAlign: 'center' },
  });
}
