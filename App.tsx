import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { DatabaseProvider } from './src/db/DatabaseProvider';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <DatabaseProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </DatabaseProvider>
  );
}
