import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RecipeSummary } from '../types';
import { totalTime } from '../utils/recipe';
import { isRtlRecipe } from '../utils/rtl';
import { useTheme, ThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { categoryKey } from '../i18n/strings';

interface Props {
  recipe: RecipeSummary;
  onPress: () => void;
}

export default function RecipeCard({ recipe, onPress }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const minutes = totalTime(recipe);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable
      // Recipe content follows the recipe's own language; rows below inherit it.
      style={({ pressed }) => [styles.row, { direction: isRtlRecipe(recipe) ? 'rtl' : 'ltr' }, pressed && { backgroundColor: theme.card }]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>{recipe.title}</Text>
        {recipe.isFavorite && (
          <Ionicons name="heart" size={20} color={theme.primary} accessibilityLabel={t('favorite')} />
        )}
      </View>

      <View style={styles.meta}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{t(categoryKey(recipe.category))}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={17} color={theme.textSecondary} />
          <Text style={styles.metaText}>{minutes > 0 ? t('minutes_short', { n: minutes }) : '—'}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="people-outline" size={17} color={theme.textSecondary} />
          <Text style={styles.metaText}>{recipe.servings}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    // Flat list row with a hairline divider instead of a shadowed card.
    row: {
      minHeight: 72, paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
    title: { flex: 1, fontSize: 19, lineHeight: 25, fontWeight: '800', color: theme.text, textAlign: 'auto' },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    tag: { backgroundColor: theme.card, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    tagText: { fontSize: 13, fontWeight: '700', color: theme.textSecondary },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary, fontVariant: ['tabular-nums'] },
  });
}
