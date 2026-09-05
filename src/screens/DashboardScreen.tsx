import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, useFocusEffect, CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CATEGORIES } from '../lib/constants';
import { groupByCategory, mealsByDay, deleteMeal, totalsOf } from '../db/meals';
import { MealRow } from '../db/database';
import { prettyDate, todayKey } from '../lib/format';
import { useStore } from '../store/useStore';
import { RootStackParamList, TabParamList } from '../nav';
import { CalorieRing } from '../components/CalorieRing';
import { MacroBar } from '../components/MacroBar';
import { CategorySection } from '../components/CategorySection';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Start'>,
  NativeStackScreenProps<RootStackParamList>
>;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Dobrej nocy';
  if (h < 18) return 'Dzień dobry';
  return 'Dobry wieczór';
}

export function DashboardScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const tick = useStore((s) => s.tick);
  const bump = useStore((s) => s.bump);
  const kcalGoal = useStore((s) => s.kcalGoal);
  const proteinGoal = useStore((s) => s.proteinGoal);
  const fatGoal = useStore((s) => s.fatGoal);
  const carbsGoal = useStore((s) => s.carbsGoal);
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = React.useCallback(async () => {
    try {
      setMeals(await mealsByDay(todayKey()));
    } catch {
      Alert.alert('Błąd', 'Nie udało się wczytać posiłków.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load, tick]),
  );

  useEffect(() => {
    navigation.setOptions({
      // eslint-disable-next-line react/no-unstable-nested-components
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Stats')}
            style={{ padding: 8 }}>
            <Text style={{ fontSize: 20 }}>📊</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Scanner')}
            style={{ padding: 8 }}>
            <Text style={{ fontSize: 20 }}>📷</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation]);

  const totals = totalsOf(meals);
  const groups = groupByCategory(meals);

  const confirmDelete = (m: MealRow) => {
    Alert.alert('Usunąć wpis?', `„${m.nazwa}” zostanie trwale usunięty.`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMeal(m.id);
            bump();
            load();
          } catch {
            Alert.alert('Błąd', 'Nie udało się usunąć wpisu.');
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>
          {greeting()}! 👋
        </Text>
        <Text style={{ color: colors.text, opacity: 0.6, marginBottom: 12 }}>
          {prettyDate(new Date())}
        </Text>
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
          {loading ? (
            <ActivityIndicator />
          ) : (
            <>
              <CalorieRing eaten={totals.kcal} goal={kcalGoal} />
              <View style={{ height: 16 }} />
              <MacroBar
                label="Białko"
                current={totals.bialko}
                goal={proteinGoal}
                color="#ef5350"
              />
              <MacroBar
                label="Tłuszcze"
                current={totals.tluszcze}
                goal={fatGoal}
                color="#f9a825"
              />
              <MacroBar
                label="Węglowodany"
                current={totals.wegle}
                goal={carbsGoal}
                color="#42a5f5"
              />
            </>
          )}
        </View>
        {groups.map((g, i) => (
          <CategorySection
            key={CATEGORIES[i]}
            title={CATEGORIES[i]}
            meals={g}
            onEdit={(m) =>
              navigation.navigate('AddMeal', { day: m.dzien, mealId: m.id })
            }
            onDelete={confirmDelete}
          />
        ))}
        {!loading && meals.length === 0 && (
          <Text
            style={{
              textAlign: 'center',
              color: colors.text,
              opacity: 0.6,
              marginTop: 32,
            }}>
            Brak posiłków na dziś.{'\n'}Stuknij „+”, aby dodać pierwszy.
          </Text>
        )}
      </ScrollView>
      <TouchableOpacity
        onPress={() => navigation.navigate('AddMeal', { day: todayKey() })}
        style={{
          position: 'absolute',
          right: 20,
          bottom: 24,
          backgroundColor: colors.primary,
          borderRadius: 28,
          paddingVertical: 14,
          paddingHorizontal: 22,
          elevation: 4,
        }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
          + Dodaj
        </Text>
      </TouchableOpacity>
    </View>
  );
}
