import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getDb, FavoriteRow, MealRow } from '../db/database';
import { insertMeal, updateMeal } from '../db/meals';
import {
  insertFavorite,
  searchFavorites,
} from '../db/favorites';
import {
  CATEGORIES,
  SOURCE_AI,
  SOURCE_API,
} from '../lib/constants';
import {
  dayKey,
  fmtKcal,
  parseDayKey,
  prettyDate,
  scaleMacros,
  toDouble,
} from '../lib/format';
import { OffProduct, offErrorMessage, searchOff } from '../lib/off';
import { searchUsda, usdaErrorMessage } from '../lib/usda';
import { choosePhoto } from '../lib/photo';
import { AiConfig } from '../lib/ai';
import { aiConfigOf, useStore } from '../store/useStore';
import { RootStackParamList } from '../nav';
import { CategoryChips } from '../components/CategoryChips';
import { PortionPicker } from '../components/PortionPicker';
import { SmartCapture } from '../components/SmartCapture';

type Props = NativeStackScreenProps<RootStackParamList, 'AddMeal'>;

type Tab = 'manual' | 'search' | 'camera';

function shiftDay(key: string, delta: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}

function defaultCategory(): number {
  const h = new Date().getHours();
  if (h < 10) return 0;
  if (h < 13) return 1;
  if (h < 16) return 2;
  if (h < 21) return 3;
  return 4;
}

async function rememberProduct(p: {
  nazwa: string;
  kcal100: number;
  bialko100: number;
  tluszcze100: number;
  wegle100: number;
  kod?: string | null;
  zdjecie?: string | null;
  opakowanieG?: number | null;
}): Promise<void> {
  try {
    const found = await searchFavorites(p.nazwa);
    const exists = found.some(
      (f) => f.nazwa.trim().toLowerCase() === p.nazwa.trim().toLowerCase(),
    );
    if (!exists) {
      await insertFavorite({ ...p, ulubione: false });
    }
  } catch {
    /* nie blokuj zapisu posiłku */
  }
}

export function AddMealScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const bump = useStore((s) => s.bump);
  const aiProvider = useStore((s) => s.aiProvider);
  const aiKeys = useStore((s) => s.aiKeys);
  const aiModels = useStore((s) => s.aiModels);
  const legacyKey = useStore((s) => s.apiKey);
  const aiCfg: AiConfig = aiConfigOf({
    aiProvider,
    aiKeys,
    aiModels,
    apiKey: legacyKey,
  });
  const [day, setDay] = useState(route.params.day);
  const editingId = route.params.mealId;
  const isEditing = editingId != null;
  const [tab, setTab] = useState<Tab>(
    isEditing ? 'manual' : (route.params.tab ?? 'camera'),
  );

  // Formularz ręczny
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [bialko, setBialko] = useState('');
  const [tluszcze, setTluszcze] = useState('');
  const [wegle, setWegle] = useState('');
  const [waga, setWaga] = useState('100');
  const [category, setCategory] = useState(defaultCategory());
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (editingId == null) return;
    (async () => {
      try {
        const db = await getDb();
        const m = await db.getFirstAsync<MealRow>(
          'SELECT * FROM meals WHERE id = ?',
          [editingId],
        );
        if (!m) return;
        setName(m.nazwa);
        setKcal(String(Math.round(m.kcal)));
        setBialko(String(m.bialko));
        setTluszcze(String(m.tluszcze));
        setWegle(String(m.wegle));
        setWaga(String(Math.round(m.waga)));
        setCategory(m.kategoria);
        setDay(m.dzien);
        setPhoto(m.zdjecie ?? null);
      } catch {
        Alert.alert('Błąd', 'Nie udało się wczytać wpisu.');
      }
    })();
  }, [editingId]);

  const saveManual = async () => {
    if (name.trim() === '') {
      Alert.alert('Uwaga', 'Wpisz nazwę posiłku.');
      return;
    }
    try {
      const input = {
        nazwa: name,
        kcal: toDouble(kcal),
        bialko: toDouble(bialko),
        tluszcze: toDouble(tluszcze),
        wegle: toDouble(wegle),
        waga: toDouble(waga),
        kategoria: category,
        dzien: day,
        zdjecie: photo,
      };
      if (editingId != null) {
        await updateMeal(editingId, input);
      } else {
        await insertMeal(input);
      }
      bump();
      navigation.goBack();
    } catch {
      Alert.alert('Błąd', 'Nie udało się zapisać posiłku.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {!isEditing && (
        <View style={{ flexDirection: 'row', padding: 12, gap: 8 }}>
          {(
            [
              ['camera', '📷 Aparat'],
              ['search', '🔍 Szukaj'],
            ] as [Tab, string][]
        ).map(([t, label]) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={{
              flex: 1,
              paddingVertical: 10,
              paddingHorizontal: 2,
              borderRadius: 10,
              alignItems: 'center',
              backgroundColor: tab === t ? colors.primary : colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
            <Text
              style={{
                color: tab === t ? '#fff' : colors.text,
                fontWeight: '700',
                fontSize: 12,
              }}>
              {label}
            </Text>
          </TouchableOpacity>
          ))}
        </View>
      )}
      {(isEditing || tab === 'manual') && (
        <ManualTab
          name={name}
          setName={setName}
          kcal={kcal}
          setKcal={setKcal}
          bialko={bialko}
          setBialko={setBialko}
          tluszcze={tluszcze}
          setTluszcze={setTluszcze}
          wegle={wegle}
          setWegle={setWegle}
          waga={waga}
          setWaga={setWaga}
          category={category}
          setCategory={setCategory}
          day={day}
          setDay={setDay}
          photo={photo}
          setPhoto={setPhoto}
          editing={editingId != null}
          onSave={saveManual}
        />
      )}
      {tab === 'search' && (
        <SearchTab
          day={day}
          category={category}
          setCategory={setCategory}
          onAdded={() => {
            bump();
            navigation.goBack();
          }}
          onCreateNew={() => navigation.navigate('Creator', {})}
        />
      )}
      {tab === 'camera' && !isEditing && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <SmartCapture
            cfg={aiCfg}
            day={day}
            category={category}
            setCategory={setCategory}
            showAdd
            showSaveProduct={false}
            showSaveDish={false}
            onDone={() => navigation.goBack()}
          />
        </ScrollView>
      )}
    </View>
  );
}

// ── Zakładka ręczna ──────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  numeric?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.text, marginBottom: 4, fontSize: 13 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'numeric' : 'default'}
        placeholderTextColor={colors.text + '66'}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 10,
          color: colors.text,
          backgroundColor: colors.card,
        }}
      />
    </View>
  );
}

function ManualTab(p: {
  name: string;
  setName: (t: string) => void;
  kcal: string;
  setKcal: (t: string) => void;
  bialko: string;
  setBialko: (t: string) => void;
  tluszcze: string;
  setTluszcze: (t: string) => void;
  wegle: string;
  setWegle: (t: string) => void;
  waga: string;
  setWaga: (t: string) => void;
  category: number;
  setCategory: (i: number) => void;
  day: string;
  setDay: (d: string) => void;
  photo: string | null;
  setPhoto: (u: string | null) => void;
  editing: boolean;
  onSave: () => void;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <TouchableOpacity onPress={() => p.setDay(shiftDay(p.day, -1))}>
          <Text style={{ fontSize: 24, color: colors.primary }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontWeight: '600' }}>
          {prettyDate(parseDayKey(p.day))}
        </Text>
        <TouchableOpacity onPress={() => p.setDay(shiftDay(p.day, 1))}>
          <Text style={{ fontSize: 24, color: colors.primary }}>›</Text>
        </TouchableOpacity>
      </View>
      <Field label="Nazwa posiłku *" value={p.name} onChange={p.setName} />
      <View>
        <Text style={{ color: colors.text, marginBottom: 4, fontSize: 13 }}>
          Zdjęcie (opcjonalnie)
        </Text>
        {p.photo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image
              source={{ uri: p.photo }}
              style={{ width: 72, height: 72, borderRadius: 10 }}
            />
            <TouchableOpacity onPress={() => p.setPhoto(null)}>
              <Text style={{ color: '#e53935', fontWeight: '700' }}>
                Usuń zdjęcie
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => choosePhoto((u) => p.setPhoto(u))}
            style={{
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: 10,
              padding: 12,
              alignItems: 'center',
            }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              📷 Dodaj zdjęcie
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Kcal *" value={p.kcal} onChange={p.setKcal} numeric />
        <Field label="Waga (g)" value={p.waga} onChange={p.setWaga} numeric />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Białko (g)" value={p.bialko} onChange={p.setBialko} numeric />
        <Field label="Tłuszcze (g)" value={p.tluszcze} onChange={p.setTluszcze} numeric />
        <Field label="Węgle (g)" value={p.wegle} onChange={p.setWegle} numeric />
      </View>
      <Text style={{ color: colors.text, fontWeight: '600' }}>Kategoria:</Text>
      <CategoryChips value={p.category} onChange={p.setCategory} />
      <TouchableOpacity
        onPress={p.onSave}
        style={{
          backgroundColor: colors.primary,
          borderRadius: 12,
          padding: 14,
          alignItems: 'center',
          marginTop: 8,
        }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
          {p.editing ? 'Zapisz zmiany' : 'Dodaj posiłek'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Zakładka wyszukiwania ────────────────────────────────────

function SearchTab(p: {
  day: string;
  category: number;
  setCategory: (i: number) => void;
  onAdded: () => void;
  onCreateNew: () => void;
}) {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [local, setLocal] = useState<FavoriteRow[]>([]);
  const [remote, setRemote] = useState<OffProduct[]>([]);
  const [usda, setUsda] = useState<OffProduct[]>([]);
  const [usdaErr, setUsdaErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<
    | ({
        nazwa: string;
        kcal100: number;
        bialko100: number;
        tluszcze100: number;
        wegle100: number;
        kod: string | null;
        zdjecie: string | null;
        opakowanieG?: number | null;
        porcjaG?: number | null;
      } & { fromLocal: boolean })
    | null
  >(null);
  const [grams, setGrams] = useState(100);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = async (text: string) => {
    const needle = text.trim();
    if (needle === '') {
      setLocal(await searchFavorites('').catch(() => []));
      setRemote([]);
      setUsda([]);
      setUsdaErr(null);
      setErr(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    setErr(null);
    setUsdaErr(null);
    setLocal(await searchFavorites(needle).catch(() => []));
    // Oba źródła online niezależnie — pad jednego nie blokuje drugiego.
    const [offRes, usdaRes] = await Promise.allSettled([
      searchOff(needle),
      searchUsda(needle),
    ]);
    if (offRes.status === 'fulfilled') {
      setRemote(offRes.value);
    } else {
      setRemote([]);
      setErr(`${offErrorMessage(offRes.reason)} Wyniki lokalne nadal dostępne.`);
    }
    if (usdaRes.status === 'fulfilled') {
      setUsda(usdaRes.value);
    } else {
      setUsda([]);
      setUsdaErr(usdaErrorMessage(usdaRes.reason));
    }
    setBusy(false);
  };

  useEffect(() => {
    searchFavorites('').then(setLocal).catch(() => {});
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const onChange = (t: string) => {
    setQ(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(t), 500);
  };

  const addPicked = async () => {
    if (!picked) return;
    const s = scaleMacros(
      picked.kcal100,
      picked.bialko100,
      picked.tluszcze100,
      picked.wegle100,
      grams,
    );
    try {
      await insertMeal({
        nazwa: picked.nazwa,
        kcal: s.kcal,
        bialko: s.bialko,
        tluszcze: s.tluszcze,
        wegle: s.wegle,
        waga: grams,
        kategoria: p.category,
        dzien: p.day,
        zrodlo: SOURCE_API,
      });
      await rememberProduct(picked);
      p.onAdded();
    } catch {
      Alert.alert('Błąd', 'Nie udało się dodać posiłku.');
    }
  };

  const tile = (
    key: string,
    nazwa: string,
    kcal100: number,
    b100: number,
    t100: number,
    w100: number,
    zdjecie: string | null,
    badge: string,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 10,
      }}>
      {zdjecie ? (
        <Image source={{ uri: zdjecie }} style={{ width: 48, height: 48, borderRadius: 8 }} />
      ) : (
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            backgroundColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 22 }}>🍽️</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', color: colors.text }} numberOfLines={2}>
          {nazwa}
        </Text>
        <Text style={{ fontSize: 12, color: colors.text, opacity: 0.7 }}>
          {fmtKcal(kcal100)} /100 g • {badge}
          {`\nB: ${b100.toFixed(1)} g  T: ${t100.toFixed(1)} g  W: ${w100.toFixed(1)} g`}
        </Text>
      </View>
      <Text style={{ fontSize: 22, color: colors.primary }}>＋</Text>
    </TouchableOpacity>
  );

  if (picked) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <TouchableOpacity onPress={() => setPicked(null)}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            ‹ Wróć do wyników
          </Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
          {picked.nazwa}
        </Text>
        <PortionPicker
          kcal100={picked.kcal100}
          bialko100={picked.bialko100}
          tluszcze100={picked.tluszcze100}
          wegle100={picked.wegle100}
          grams={grams}
          setGrams={setGrams}
          extraChips={[
            ...(picked.opakowanieG
              ? [
                  {
                    label: `Całość (${picked.opakowanieG} g)`,
                    grams: picked.opakowanieG,
                  },
                ]
              : []),
            ...(picked.porcjaG && picked.porcjaG !== picked.opakowanieG
              ? [
                  {
                    label: `1 porcja (${picked.porcjaG} g)`,
                    grams: picked.porcjaG,
                  },
                ]
              : []),
          ]}
        />
        <Text style={{ color: colors.text, fontWeight: '600' }}>
          Kategoria posiłku:
        </Text>
        <CategoryChips value={p.category} onChange={p.setCategory} />
        <TouchableOpacity
          onPress={addPicked}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            padding: 14,
            alignItems: 'center',
          }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
            Dodaj
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <TextInput
        value={q}
        onChangeText={onChange}
        placeholder="Szukaj produktu, np. jogurt naturalny"
        placeholderTextColor={colors.text + '66'}
        returnKeyType="search"
        onSubmitEditing={() => runSearch(q)}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 12,
          color: colors.text,
          backgroundColor: colors.card,
        }}
      />
      <View style={{ height: 12 }} />
      {busy && <ActivityIndicator />}
      {err && (
        <View
          style={{
            backgroundColor: '#ffebee',
            borderRadius: 10,
            padding: 10,
            marginBottom: 8,
            gap: 8,
          }}>
          <Text style={{ color: '#b71c1c' }}>{err}</Text>
          <TouchableOpacity
            onPress={() => runSearch(q)}
            style={{
              backgroundColor: '#b71c1c',
              borderRadius: 8,
              padding: 10,
              alignItems: 'center',
            }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              🔄 Spróbuj ponownie
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {local.length > 0 && (
        <>
          <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 6 }}>
            Zapisane lokalnie:
          </Text>
          {local.slice(0, 10).map((f) =>
            tile(
              `l${f.id}`,
              f.nazwa,
              f.kcal100,
              f.bialko100,
              f.tluszcze100,
              f.wegle100,
              f.zdjecie,
              'lokalne',
              () => {
                // Kategoria startowa z bazy (np. Mars → Przekąski).
                p.setCategory(
                  f.kategoria >= 0 && f.kategoria < CATEGORIES.length
                    ? f.kategoria
                    : p.category,
                );
                setPicked({
                  nazwa: f.nazwa,
                  kcal100: f.kcal100,
                  bialko100: f.bialko100,
                  tluszcze100: f.tluszcze100,
                  wegle100: f.wegle100,
                  kod: f.kod,
                  zdjecie: f.zdjecie,
                  opakowanieG: f.opakowanie_g,
                  porcjaG: null,
                  fromLocal: true,
                });
                setGrams(100);
              },
            ),
          )}
        </>
      )}
      {remote.length > 0 && (
        <>
          <Text
            style={{
              fontWeight: '800',
              color: colors.text,
              marginBottom: 6,
              marginTop: 8,
            }}>
            Open Food Facts:
          </Text>
          {remote.map((r, i) =>
            tile(
              `r${i}${r.kod ?? ''}`,
              r.nazwa,
              r.kcal100,
              r.bialko100,
              r.tluszcze100,
              r.wegle100,
              r.zdjecie,
              'OFF',
              () => {
                setPicked({ ...r, fromLocal: false });
                setGrams(100);
              },
            ),
          )}
        </>
      )}
      {usdaErr && (
        <Text
          style={{
            color: colors.text,
            opacity: 0.6,
            fontSize: 12,
            marginTop: 8,
          }}>
          USDA: {usdaErr}
        </Text>
      )}
      {usda.length > 0 && (
        <>
          <Text
            style={{
              fontWeight: '800',
              color: colors.text,
              marginBottom: 6,
              marginTop: 8,
            }}>
            USDA FoodData (USA):
          </Text>
          {usda.map((r, i) =>
            tile(
              `u${i}${r.kod ?? ''}${r.nazwa}`,
              r.nazwa,
              r.kcal100,
              r.bialko100,
              r.tluszcze100,
              r.wegle100,
              r.zdjecie,
              'USDA',
              () => {
                setPicked({ ...r, fromLocal: false });
                setGrams(100);
              },
            ),
          )}
        </>
      )}
      {!busy && local.length === 0 && remote.length === 0 && usda.length === 0 && (
        <Text style={{ textAlign: 'center', color: colors.text, opacity: 0.6, marginTop: 24 }}>
          {q.trim() === ''
            ? 'Wpisz nazwę produktu, aby przeszukać MOJĄ bazę, Open Food Facts i USDA.'
            : 'Brak wyników tutaj.'}
        </Text>
      )}
      <TouchableOpacity
        onPress={p.onCreateNew}
        style={{
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: 12,
          padding: 13,
          alignItems: 'center',
          marginTop: 12,
        }}>
        <Text style={{ color: colors.primary, fontWeight: '800' }}>
          ＋ Nie ma na liście? Dodaj do mojej bazy
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

