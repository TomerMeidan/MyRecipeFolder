import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';

/** Shown when the recipe list could not be loaded (after retries). */
export default function LoadError({ onRetry }: { onRetry: () => void }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  return (
    <View style={[styles.box, { backgroundColor: theme.background }]} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={48} color={theme.textSecondary} />
      <Text style={[styles.title, { color: theme.text }]}>{t('load_error_title')}</Text>
      <Text style={[styles.body, { color: theme.textSecondary }]}>{t('load_error_body')}</Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={onRetry}
        accessibilityRole="button"
      >
        <Ionicons name="refresh" size={22} color={theme.onPrimary} />
        <Text style={[styles.buttonText, { color: theme.onPrimary }]}>{t('try_again')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 64 },
  title: { fontSize: 24, fontWeight: '800', marginTop: 16, marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 17, lineHeight: 25, textAlign: 'center' },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 52, paddingHorizontal: 24, marginTop: 24, borderRadius: 12,
  },
  buttonText: { fontSize: 17, fontWeight: '800' },
});
