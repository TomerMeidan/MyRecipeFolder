import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { DatabaseProvider } from './src/db/DatabaseProvider';
import { ThemeProvider } from './src/theme/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <DatabaseProvider>
      <ThemeProvider>
        <AppNavigator />
        <StatusBar style="auto" />
      </ThemeProvider>
    </DatabaseProvider>
  );
}
