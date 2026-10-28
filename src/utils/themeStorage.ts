import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { ColorSchemeType } from '../theme/ThemeContext';

const STORAGE_KEY = 'theme-prefs';
const LANG_KEY = 'ui-lang';

interface ThemePrefs {
  isDarkMode: boolean;
  colorScheme: ColorSchemeType;
}

async function readRaw(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function writeRaw(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
}

export async function getStoredTheme(): Promise<ThemePrefs | null> {
  try {
    const raw = await readRaw(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ThemePrefs;
  } catch {
    return null;
  }
}

export async function setStoredTheme(prefs: ThemePrefs): Promise<void> {
  try {
    await writeRaw(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Best-effort — losing the persisted theme preference isn't worth surfacing to the user.
  }
}

export async function getStoredLanguage(): Promise<string | null> {
  try {
    return await readRaw(LANG_KEY);
  } catch {
    return null;
  }
}

export async function setStoredLanguage(lang: string): Promise<void> {
  try {
    await writeRaw(LANG_KEY, lang);
  } catch {
    // Best-effort, like the theme preference.
  }
}
