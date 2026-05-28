import { TouchableOpacity, Text } from 'react-native';
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

import { RootStackParamList, BottomTabParamList } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

function MainTabs() {
  const { theme } = useTheme();
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
          title: 'Recipes',
          headerShown: true,
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          headerRight: () => <LogoutButton />,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ScanTab"
        component={ScanRecipeScreen}
        options={{
          title: 'Scan',
          headerShown: true,
          headerTitle: 'Scan Recipe',
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'camera' : 'camera-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function LogoutButton() {
  const { logout } = useAuth();
  const { theme } = useTheme();
  return (
    <TouchableOpacity onPress={logout} style={{ marginRight: 16 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: '600' }}>Sign Out</Text>
    </TouchableOpacity>
  );
}

export default function AppNavigator() {
  const { theme, isDarkMode } = useTheme();
  const { isLoggedIn, isLoading } = useAuth();

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
    <NavigationContainer theme={navTheme}>
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
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{ title: 'Recipe' }} />
        <Stack.Screen name="AddEditRecipe" component={AddEditRecipeScreen} options={{ title: 'Add Recipe' }} />
        <Stack.Screen name="ScanRecipe" component={ScanRecipeScreen} options={{ title: 'Scan Recipe' }} />
      </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
