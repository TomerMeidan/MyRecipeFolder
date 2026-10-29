import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { View, AppState, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { ThemeProvider } from './src/theme/ThemeContext';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { LanguageProvider, useLanguage } from './src/i18n/LanguageContext';
import AppNavigator from './src/navigation/AppNavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60_000, gcTime: 30 * 60_000, retry: 2, refetchOnWindowFocus: true },
  },
});

// Web refetches stale data when the tab regains focus; on native, "focus" is the app returning to the foreground.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
    return () => sub.remove();
  });
}

// Signing out drops every cached recipe, so the next account starts clean.
function ClearCacheOnSignOut() {
  const { userId } = useAuth();
  useEffect(() => { if (!userId) queryClient.clear(); }, [userId]);
  return null;
}

// Layout direction follows the UI language without a reload (no I18nManager.forceRTL).
function DirectionRoot({ children }: { children: React.ReactNode }) {
  const { isRTL } = useLanguage();
  return <View style={{ flex: 1, direction: isRTL ? 'rtl' : 'ltr' }}>{children}</View>;
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <ClearCacheOnSignOut />
            <DirectionRoot>
              <AppNavigator />
            </DirectionRoot>
          </QueryClientProvider>
          <StatusBar style="auto" />
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
