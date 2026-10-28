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
import { useTheme, ThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { theme } = useTheme();
  const { t } = useLanguage();
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
            <Text style={styles.heading}>{t('home_title')}</Text>
            <Pressable
              style={({ pressed }) => [styles.filterChip, favOnly && styles.filterChipOn, pressed && styles.pressed]}
              onPress={() => setFavOnly((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ selected: favOnly }}
            >
              <Ionicons name={favOnly ? 'heart' : 'heart-outline'} size={18} color={theme.text} />
              <Text style={styles.filterChipText}>{t('favorites')}</Text>
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
            <Text style={styles.emptyTitle}>{t(favOnly ? 'fav_empty_title' : 'home_empty_title')}</Text>
            <Text style={styles.emptySubtitle}>{t(favOnly ? 'fav_empty_body' : 'home_empty_body')}</Text>
            {!favOnly && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('ScanRecipe')}
                accessibilityRole="button"
              >
                <Ionicons name="camera-outline" size={22} color={theme.onPrimary} />
                <Text style={styles.emptyButtonText}>{t('home_empty_cta')}</Text>
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
        accessibilityLabel={t('a11y_add_recipe')}
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
    heading: { fontSize: 30, fontWeight: '800', color: theme.text, textAlign: 'auto' },

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
