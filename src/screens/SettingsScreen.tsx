import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, ThemeColors, ColorSchemeType } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Lang, schemeKey } from '../i18n/strings';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';

// Swatch colours preview each scheme, so they are literal on purpose.
const SCHEMES: Array<{ key: ColorSchemeType; color: string }> = [
  { key: 'kitchen', color: '#FFE45C' },
  { key: 'default', color: '#E05C2D' },
  { key: 'blue',    color: '#2563EB' },
  { key: 'black',   color: '#0F172A' },
  { key: 'white',   color: '#94A3B8' },
];

// Each language is named in its own language.
const LANGUAGES: Array<{ key: Lang; label: string }> = [
  { key: 'en', label: 'English' },
  { key: 'he', label: 'עברית' },
];

export default function SettingsScreen() {
  const { theme, isDarkMode, toggleDarkMode, colorScheme, setColorScheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const { logout } = useAuth();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // Read-only: show who is signed in. AuthContext does not expose the user.
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email ?? null));
  }, []);

  const styles = makeStyles(theme);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>

      {/* Language */}
      <Text style={styles.sectionTitle}>{t('settings_language')}</Text>
      <View accessibilityRole="radiogroup">
        {LANGUAGES.map((l) => {
          const selected = lang === l.key;
          return (
            <Pressable
              key={l.key}
              onPress={() => setLang(l.key)}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLanguage={l.key}
            >
              <Text style={[styles.optionText, selected && styles.optionTextOn]}>{l.label}</Text>
              {selected && <Ionicons name="checkmark" size={24} color={theme.text} />}
            </Pressable>
          );
        })}
      </View>

      {/* Appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings_appearance')}</Text>
        <View style={styles.option}>
          <Text style={styles.optionText}>{t('dark_mode')}</Text>
          <Switch
            value={isDarkMode}
            onValueChange={toggleDarkMode}
            trackColor={{ false: theme.borderStrong, true: theme.primary }}
            thumbColor={theme.card}
            // react-native-web ignores thumbColor when on and defaults to teal; this prop is web-only.
            {...({ activeThumbColor: theme.card } as object)}
            accessibilityLabel={t('dark_mode')}
          />
        </View>

        <Text style={styles.subTitle}>{t('colour_scheme')}</Text>
        <View accessibilityRole="radiogroup">
          {SCHEMES.map((s) => {
            const selected = colorScheme === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setColorScheme(s.key)}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={styles.schemeLabel}>
                  <View style={[styles.swatch, { backgroundColor: s.color }]} />
                  <Text style={[styles.optionText, selected && styles.optionTextOn]}>{t(schemeKey(s.key))}</Text>
                </View>
                {selected && <Ionicons name="checkmark" size={24} color={theme.text} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings_account')}</Text>
        {email && (
          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>{t('signed_in_as')}</Text>
            {/* Emails are always left-to-right, even in a Hebrew UI. */}
            <Text style={[styles.accountEmail, { writingDirection: 'ltr' }]}>{email}</Text>
          </View>
        )}
        <Pressable
          onPress={logout}
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="log-out-outline" size={22} color={theme.errorText} />
          <Text style={styles.signOutText}>{t('sign_out')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 },
    pressed: { opacity: 0.6 },

    // Option rows already end in a hairline, so sections only need space between them.
    section: { marginTop: 24 },
    sectionTitle: { fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 16, marginBottom: 4 },
    subTitle: { fontSize: 15, fontWeight: '700', color: theme.textSecondary, marginTop: 16, marginBottom: 2 },

    option: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      minHeight: 52, borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    optionText: { fontSize: 18, fontWeight: '600', color: theme.text },
    optionTextOn: { fontWeight: '800' },
    schemeLabel: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: theme.borderStrong },

    accountRow: { paddingVertical: 12 },
    accountLabel: { fontSize: 15, fontWeight: '700', color: theme.textSecondary },
    accountEmail: { fontSize: 18, fontWeight: '600', color: theme.text, marginTop: 2, textAlign: 'auto' },
    signOut: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      minHeight: 52, marginTop: 8, borderRadius: 12,
      borderWidth: 1.5, borderColor: theme.borderStrong,
    },
    signOutText: { fontSize: 17, fontWeight: '700', color: theme.errorText },
  });
}
