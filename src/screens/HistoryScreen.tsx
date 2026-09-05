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
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { CATEGORIES } from '../lib/constants';
import { groupByCategory, mealsByDay, deleteMeal } from '../db/meals';
import { activitiesByDay, burnedOf, deleteActivity } from '../db/activities';
import { monthKcal } from '../db/stats';
import { ActivityRow, MealRow } from '../db/database';
import { fmtKcal, parseDayKey, prettyDate, todayKey } from '../lib/format';
import { useStore } from '../store/useStore';
import { RootStackParamList, TabParamList } from '../nav';
import { ActivityCard } from '../components/ActivityCard';
import { CategorySection } from '../components/CategorySection';

LocaleConfig.locales['pl'] = {
  monthNames: [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
  ],
  monthNamesShort: [
    'Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze',
    'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru',
  ],
  dayNames: [
    'Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota',
  ],
  dayNamesShort: ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'],
  today: 'Dziś',
};
LocaleConfig.defaultLocale = 'pl';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Historia'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function HistoryScreen({ navigation }: Props) {
  const { colors, dark } = useTheme();
  const tick = useStore((s) => s.tick);
  const bump = useStore((s) => s.bump);
  const kcalGoal = useStore((s) => s.kcalGoal);
  const [selected, setSelected] = useState(todayKey());
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() + 1 };
  });
  const [dots, setDots] = useState<Record<string, number>>({});
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [acts, setActs] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMonth = React.useCallback(async () => {
    try {
      setDots(await monthKcal(month.y, month.m));
    } catch {
      /* ignoruj */
    }
  }, [month]);

  const loadDay = React.useCallback(async () => {
    try {
      const [m, a] = await Promise.all([
        mealsByDay(selected),
        activitiesByDay(selected),
      ]);
      setMeals(m);
      setActs(a);
    } catch {
      Alert.alert('Błąd', 'Nie udało się wczytać posiłków.');
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth, tick]);

  useFocusEffect(
    React.useCallback(() => {
      loadDay();
      loadMonth();
    }, [loadDay, loadMonth, tick]),
  );

  const dotColor = (kcal: number): string => {
    if (kcalGoal <= 0) return '#9e9e9e';
    const r = kcal / kcalGoal;
    if (r < 0.9) return '#4caf50';
    if (r <= 1.1) return '#f9a825';
    return '#e53935';
  };

  const marked: Record<string, { marked?: boolean; dotColor?: string; selected?: boolean; selectedColor?: string }> = {};
  for (const [k, v] of Object.entries(dots)) {
    marked[k] = { marked: true, dotColor: dotColor(v) };
  }
  marked[selected] = { ...(marked[selected] ?? {}), selected: true, selectedColor: colors.primary };

  const groups = groupByCategory(meals);
  const dayKcal = meals.reduce((s, m) => s + m.kcal, 0);
  const dayBurned = burnedOf(acts);

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
            loadDay();
            loadMonth();
          } catch {
            Alert.alert('Błąd', 'Nie udało się usunąć wpisu.');
          }
        },
      },
    ]);
  };

  const confirmDeleteActivity = (a: ActivityRow) => {
    Alert.alert('Usunąć aktywność?', `„${a.nazwa}” zostanie usunięta.`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteActivity(a.id);
            bump();
            loadDay();
            loadMonth();
          } catch {
            Alert.alert('Błąd', 'Nie udało się usunąć aktywności.');
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
          }}>
          <Calendar
            current={selected}
            onDayPress={(d) => setSelected(d.dateString)}
            onMonthChange={(d) => {
              const [y, m] = d.dateString.split('-').map(Number);
              setMonth({ y, m });
            }}
            markedDates={marked}
            firstDay={1}
            theme={{
              backgroundColor: colors.card,
              calendarBackground: colors.card,
              textSectionTitleColor: colors.text,
              dayTextColor: colors.text,
              monthTextColor: colors.text,
              textDisabledColor: dark ? '#555' : '#ccc',
              arrowColor: colors.primary,
              todayTextColor: colors.primary,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: '#fff',
            }}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 16,
            marginTop: 8,
          }}>
          <Legend color="#4caf50" label="poniżej" />
          <Legend color="#f9a825" label="w normie" />
          <Legend color="#e53935" label="powyżej" />
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 12,
          }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
            {prettyDate(parseDayKey(selected))}
          </Text>
          <View
            style={{
              backgroundColor: colors.primary,
              borderRadius: 14,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {fmtKcal(dayKcal)}
            </Text>
          </View>
        </View>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : (
          <>
            {dayBurned > 0 && (
              <Text
                style={{
                  color: '#2e7d32',
                  fontWeight: '700',
                  marginTop: 8,
                }}>
                🏃 Spalono tego dnia: −{fmtKcal(dayBurned)} (netto:{' '}
                {fmtKcal(dayKcal - dayBurned)})
              </Text>
            )}
            {acts.map((a) => (
              <View key={`a${a.id}`} style={{ marginTop: 8 }}>
                <ActivityCard
                  activity={a}
                  onEdit={() =>
                    navigation.navigate('Activity', {
                      day: a.dzien,
                      activityId: a.id,
                    })
                  }
                  onDelete={() => confirmDeleteActivity(a)}
                />
              </View>
            ))}
            {meals.length === 0 && acts.length === 0 ? (
              <Text
                style={{
                  textAlign: 'center',
                  color: colors.text,
                  opacity: 0.6,
                  marginTop: 24,
                }}>
                Brak posiłków tego dnia.
              </Text>
            ) : (
              groups.map((g, i) => (
                <CategorySection
                  key={CATEGORIES[i]}
                  title={CATEGORIES[i]}
                  meals={g}
                  onEdit={(m) =>
                    navigation.navigate('AddMeal', {
                      day: m.dzien,
                      mealId: m.id,
                    })
                  }
                  onDelete={confirmDelete}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
      <TouchableOpacity
        onPress={() => navigation.navigate('AddMeal', { day: selected })}
        style={{
          position: 'absolute',
          right: 20,
          bottom: 24,
          backgroundColor: colors.primary,
          borderRadius: 28,
          width: 56,
          height: 56,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
        }}>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '300' }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View
        style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }}
      />
      <Text style={{ fontSize: 12, color: colors.text }}>{label}</Text>
    </View>
  );
}
