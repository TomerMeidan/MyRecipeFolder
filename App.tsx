import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { DatabaseProvider } from './src/db/DatabaseProvider';
import { ThemeProvider } from './src/theme/ThemeContext';
import { AuthProvider } from './src/auth/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <DatabaseProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppNavigator />
          <StatusBar style="auto" />
        </AuthProvider>
      </ThemeProvider>
    </DatabaseProvider>
  );
}
