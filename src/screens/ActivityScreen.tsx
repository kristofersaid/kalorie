import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getDb, ActivityRow } from '../db/database';
import { insertActivity, updateActivity } from '../db/activities';
import {
  ACTIVITY_TYPES,
  calcBurned,
  formatPace,
  paceMinPerKm,
} from '../lib/activities';
import { fmtKcal, toDouble } from '../lib/format';
import { useStore } from '../store/useStore';
import { RootStackParamList } from '../nav';

type Props = NativeStackScreenProps<RootStackParamList, 'Activity'>;

type Mode = 'kcal' | 'trening';

/**
 * Dodawanie aktywności: wpisane kcal albo trening
 * (typ + czas + dystans → wyliczone kcal z wagi ciała).
 */
export function ActivityScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const bump = useStore((s) => s.bump);
  const weightKg = useStore((s) => s.weightKg);
  const [mode, setMode] = useState<Mode>('trening');
  const [day] = useState(route.params.day);
  const editingId = route.params.activityId;

  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [typeId, setTypeId] = useState(ACTIVITY_TYPES[5].id);
  const [minutes, setMinutes] = useState('30');
  const [km, setKm] = useState('');

  useEffect(() => {
    if (editingId == null) return;
    (async () => {
      try {
        const db = await getDb();
        const a = await db.getFirstAsync<ActivityRow>(
          'SELECT * FROM activities WHERE id = ?',
          [editingId],
        );
        if (!a) return;
        setName(a.nazwa);
        setKcal(String(Math.round(a.kcal)));
        setMinutes(a.czas_min > 0 ? String(a.czas_min) : '30');
        setKm(a.dystans_km > 0 ? String(a.dystans_km) : '');
        const match = ACTIVITY_TYPES.find(
          (t) => t.nazwa.toLowerCase() === a.nazwa.trim().toLowerCase(),
        );
        if (match) {
          setTypeId(match.id);
          setMode('trening');
        } else {
          setMode('kcal');
        }
      } catch {
        Alert.alert('Błąd', 'Nie udało się wczytać aktywności.');
      }
    })();
  }, [editingId]);

  const activeType =
    ACTIVITY_TYPES.find((t) => t.id === typeId) ?? ACTIVITY_TYPES[0];
  const mins = toDouble(minutes, 0);
  const kms = toDouble(km, 0);
  const computed = calcBurned(activeType.met, weightKg, mins);
  const pace = paceMinPerKm(mins, kms);

  const save = async () => {
    try {
      if (mode === 'kcal') {
        const k = toDouble(kcal, 0);
        if (!(k > 0)) {
          Alert.alert('Uwaga', 'Wpisz spalone kalorie.');
          return;
        }
        const input = {
          nazwa: name.trim() === '' ? 'Aktywność' : name,
          kcal: Math.round(k),
          czasMin: 0,
          dystansKm: 0,
          dzien: day,
        };
        if (editingId != null) await updateActivity(editingId, input);
        else await insertActivity(input);
      } else {
        if (!(mins > 0)) {
          Alert.alert('Uwaga', 'Podaj czas treningu w minutach.');
          return;
        }
        const label =
          name.trim() === '' ? activeType.nazwa : name.trim();
        const input = {
          nazwa: label,
          kcal: computed,
          czasMin: mins,
          dystansKm: kms,
          dzien: day,
        };
        if (editingId != null) await updateActivity(editingId, input);
        else await insertActivity(input);
      }
      bump();
      navigation.goBack();
    } catch {
      Alert.alert('Błąd', 'Nie udało się zapisać aktywności.');
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    color: colors.text,
    backgroundColor: colors.card,
  } as const;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(
          [
            ['trening', '🏃 Trening'],
            ['kcal', '🔥 Same kcal'],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMode(m)}
            style={{
              flex: 1,
              padding: 11,
              borderRadius: 10,
              alignItems: 'center',
              backgroundColor: mode === m ? colors.primary : colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
            <Text
              style={{
                color: mode === m ? '#fff' : colors.text,
                fontWeight: '700',
              }}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'trening' ? (
        <>
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            Co trenowałeś?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ACTIVITY_TYPES.map((t) => {
              const active = t.id === typeId;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setTypeId(t.id)}
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: 13,
                    borderRadius: 16,
                    backgroundColor: active ? colors.primary : colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}>
                  <Text
                    style={{
                      color: active ? '#fff' : colors.text,
                      fontWeight: '600',
                      fontSize: 13,
                    }}>
                    {t.nazwa}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={`Własna nazwa (domyślnie: ${activeType.nazwa})`}
            placeholderTextColor={colors.text + '66'}
            style={inputStyle}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, marginBottom: 4 }}>
                Czas (min) *
              </Text>
              <TextInput
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="numeric"
                style={inputStyle}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, marginBottom: 4 }}>
                Dystans (km)
              </Text>
              <TextInput
                value={km}
                onChangeText={setKm}
                keyboardType="numeric"
                placeholder="np. 5 (rower/bieg)"
                placeholderTextColor={colors.text + '66'}
                style={inputStyle}
              />
            </View>
          </View>
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
            }}>
            <Text style={{ color: colors.text, opacity: 0.7 }}>
              {activeType.nazwa} • {Math.round(mins)} min
              {kms > 0 ? ` • ${kms} km` : ''} • {weightKg} kg
            </Text>
            <Text
              style={{ fontSize: 30, fontWeight: '800', color: '#2e7d32' }}>
              −{fmtKcal(computed)}
            </Text>
            {pace != null && (
              <Text style={{ color: colors.text, opacity: 0.7 }}>
                Tempo: {formatPace(pace)}
              </Text>
            )}
          </View>
        </>
      ) : (
        <>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nazwa (np. spacer z psem)"
            placeholderTextColor={colors.text + '66'}
            style={inputStyle}
          />
          <View>
            <Text style={{ color: colors.text, marginBottom: 4 }}>
              Spalone kcal *
            </Text>
            <TextInput
              value={kcal}
              onChangeText={setKcal}
              keyboardType="numeric"
              placeholder="np. 250"
              placeholderTextColor={colors.text + '66'}
              style={inputStyle}
            />
          </View>
          <Text style={{ color: colors.text, opacity: 0.6, fontSize: 13 }}>
            Tryb dla wartości z zegarka / innej aplikacji — bez wyliczeń.
          </Text>
        </>
      )}

      <TouchableOpacity
        onPress={save}
        style={{
          backgroundColor: colors.primary,
          borderRadius: 12,
          padding: 14,
          alignItems: 'center',
          marginTop: 4,
        }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
          {editingId != null ? 'Zapisz zmiany' : 'Dodaj aktywność'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
