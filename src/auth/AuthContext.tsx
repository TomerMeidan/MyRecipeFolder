import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// ── Hashed credentials (SHA-256) ─────────────────────────────────────────────
// Plain-text credentials never appear in source code.
// To change credentials, compute: sha256(newValue) and replace the hash below.
const VALID_USERNAME_HASH = '548b2b3acb84ba558554cfb803b0f01175a837f6c1b0cd8d85f6600167c4bbc8';
const VALID_PASSWORD_HASH = '9f6994262df742e90c773d974898b8d1f4107e3944058f4d32bfe9b3f4066898';
const SESSION_KEY = 'auth_session';

// ── SHA-256 via Web Crypto (works in React Native, Expo, and browser) ────────
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Secure storage with web fallback ─────────────────────────────────────────
async function saveSession(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(SESSION_KEY, '1');
  } else {
    await SecureStore.setItemAsync(SESSION_KEY, '1');
  }
}

async function loadSession(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(SESSION_KEY) === '1';
  }
  const val = await SecureStore.getItemAsync(SESSION_KEY);
  return val === '1';
}

async function clearSession(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(SESSION_KEY);
  } else {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (username: string, password: string, remember: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check for saved session on startup
  useEffect(() => {
    loadSession()
      .then((has) => setIsLoggedIn(has))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (username: string, password: string, remember: boolean): Promise<boolean> => {
    const [uHash, pHash] = await Promise.all([sha256(username.trim()), sha256(password)]);
    if (uHash !== VALID_USERNAME_HASH || pHash !== VALID_PASSWORD_HASH) {
      return false;
    }
    if (remember) await saveSession();
    setIsLoggedIn(true);
    return true;
  };

  const logout = async (): Promise<void> => {
    await clearSession();
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
