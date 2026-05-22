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

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const db = useDatabase();
  const navigation = useNavigation<NavProp>();
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E05C2D" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
        ListHeaderComponent={<Text style={styles.heading}>My Recipes</Text>}
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <Text style={styles.emptyIcon}>🍳</Text>
            <Text style={styles.emptyTitle}>No recipes yet</Text>
            <Text style={styles.emptySubtitle}>Tap + to add your first recipe</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddEditRecipe', {})}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingTop: 16, paddingBottom: 100 },
  emptyContainer: { flex: 1, paddingTop: 16 },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1C',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  emptyInner: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#1C1C1C', marginBottom: 6 },
  emptySubtitle: { fontSize: 15, color: '#888' },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E05C2D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E05C2D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { fontSize: 30, color: '#fff', lineHeight: 34 },
});
