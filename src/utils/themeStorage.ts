import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { ColorSchemeType } from '../theme/ThemeContext';

const STORAGE_KEY = 'theme-prefs';

interface ThemePrefs {
  isDarkMode: boolean;
  colorScheme: ColorSchemeType;
}

async function readRaw(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(STORAGE_KEY);
  return SecureStore.getItemAsync(STORAGE_KEY);
}

async function writeRaw(value: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(STORAGE_KEY, value); return; }
  await SecureStore.setItemAsync(STORAGE_KEY, value);
}

export async function getStoredTheme(): Promise<ThemePrefs | null> {
  try {
    const raw = await readRaw();
    if (!raw) return null;
    return JSON.parse(raw) as ThemePrefs;
  } catch {
    return null;
  }
}

export async function setStoredTheme(prefs: ThemePrefs): Promise<void> {
  try {
    await writeRaw(JSON.stringify(prefs));
  } catch {
    // Best-effort — losing the persisted theme preference isn't worth surfacing to the user.
  }
}
