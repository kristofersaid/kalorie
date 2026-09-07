import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View, useColorScheme } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { getDb } from './db/database';
import { useStore } from './store/useStore';
import { RootStackParamList, TabParamList } from './nav';
import { DashboardScreen } from './screens/DashboardScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { BazaScreen } from './screens/BazaScreen';
import { FavoritesScreen } from './screens/FavoritesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AddMealScreen } from './screens/AddMealScreen';
import { ActivityScreen } from './screens/ActivityScreen';
import { AssistantScreen } from './screens/AssistantScreen';
import { CreatorScreen } from './screens/CreatorScreen';
import { ScannerScreen } from './screens/ScannerScreen';
import { StatsScreen } from './screens/StatsScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const ICONS: Record<string, string> = {
  Start: '🏠',
  Historia: '📅',
  Baza: '🗄️',
  Ulubione: '⭐',
  Ustawienia: '⚙️',
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // eslint-disable-next-line react/no-unstable-nested-components
        tabBarIcon: () => <Text style={{ fontSize: 22 }}>{ICONS[route.name] ?? '•'}</Text>,
      })}>
      <Tab.Screen
        name="Start"
        component={DashboardScreen}
        options={{ title: 'Kalorie' }}
      />
      <Tab.Screen name="Historia" component={HistoryScreen} />
      <Tab.Screen
        name="Baza"
        component={BazaScreen}
        options={{ title: 'Moja baza' }}
      />
      <Tab.Screen name="Ulubione" component={FavoritesScreen} />
      <Tab.Screen name="Ustawienia" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const scheme = useColorScheme();
  const themeChoice = useStore((s) => s.theme);
  const hydrated = useStore((s) => s.hydrated);
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    getDb()
      .then(() => setDbReady(true))
      .catch((e) =>
        setDbError(e instanceof Error ? e.message : String(e)),
      );
  }, []);

  const dark =
    themeChoice === 'dark' ||
    (themeChoice === 'system' && scheme === 'dark');

  if (!dbReady || !hydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          backgroundColor: '#fff',
        }}>
        <ActivityIndicator size="large" />
        <Text>Ładowanie…</Text>
        {dbError && (
          <Text style={{ color: 'red', padding: 24, textAlign: 'center' }}>
            Błąd bazy danych: {dbError}
          </Text>
        )}
      </View>
    );
  }

  return (
    <NavigationContainer theme={dark ? DarkTheme : DefaultTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack.Navigator>
        <Stack.Screen
          name="Tabs"
          component={Tabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AddMeal"
          component={AddMealScreen}
          options={{ title: 'Dodaj posiłek', presentation: 'modal' }}
        />
        <Stack.Screen
          name="Creator"
          component={CreatorScreen}
          options={{ title: 'Moja baza: nowy wpis', presentation: 'modal' }}
        />
        <Stack.Screen
          name="Activity"
          component={ActivityScreen}
          options={{ title: 'Aktywność', presentation: 'modal' }}
        />
        <Stack.Screen
          name="Assistant"
          component={AssistantScreen}
          options={{ title: 'Asystent AI' }}
        />
        <Stack.Screen
          name="Scanner"
          component={ScannerScreen}
          options={{ title: 'Skanuj kod' }}
        />
        <Stack.Screen
          name="Stats"
          component={StatsScreen}
          options={{ title: 'Statystyki' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
