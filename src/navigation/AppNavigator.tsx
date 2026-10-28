import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import ScanRecipeScreen from '../screens/ScanRecipeScreen';
import RecipeDetailScreen from '../screens/RecipeDetailScreen';
import AddEditRecipeScreen from '../screens/AddEditRecipeScreen';
import LoginScreen from '../screens/LoginScreen';
import SettingsScreen from '../screens/SettingsScreen';

import { RootStackParamList, BottomTabParamList } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

function MainTabs() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const header = {
    headerShown: true,
    headerStyle: { backgroundColor: theme.card },
    headerTintColor: theme.text,
    headerShadowVisible: false,
  };
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopWidth: 1,
          borderTopColor: theme.border,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          ...header,
          title: t('tab_recipes'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{
          title: t('tab_search'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ScanTab"
        component={ScanRecipeScreen}
        options={{
          ...header,
          title: t('tab_scan'),
          headerTitle: t('title_scan_recipe'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'camera' : 'camera-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          ...header,
          title: t('tab_settings'),
          headerTitle: t('title_settings'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { theme, isDarkMode } = useTheme();
  const { isLoggedIn, isLoading } = useAuth();
  const { t, isRTL } = useLanguage();

  const navTheme = {
    ...DefaultTheme,
    dark: isDarkMode,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.primary,
      background: theme.background,
      card: theme.card,
      text: theme.text,
      border: theme.border,
      notification: theme.primary,
    },
  };

  if (isLoading) return null;

  return (
    // `direction` tells React Navigation to mirror headers, back arrows and swipe gestures.
    <NavigationContainer theme={navTheme} direction={isRTL ? 'rtl' : 'ltr'}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      {!isLoggedIn ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      ) : (
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="Home"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{ title: t('title_recipe') }} />
        <Stack.Screen name="AddEditRecipe" component={AddEditRecipeScreen} options={{ title: t('title_add_recipe') }} />
        <Stack.Screen name="ScanRecipe" component={ScanRecipeScreen} options={{ title: t('title_scan_recipe') }} />
      </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
