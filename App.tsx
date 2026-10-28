import 'react-native-gesture-handler';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from './src/theme/ThemeContext';
import { AuthProvider } from './src/auth/AuthContext';
import { LanguageProvider, useLanguage } from './src/i18n/LanguageContext';
import AppNavigator from './src/navigation/AppNavigator';

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
          <DirectionRoot>
            <AppNavigator />
          </DirectionRoot>
          <StatusBar style="auto" />
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
