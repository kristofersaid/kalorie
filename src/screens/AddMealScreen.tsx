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
import * as ImagePicker from 'expo-image-picker';
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
  fmtG,
  fmtKcal,
  parseDayKey,
  prettyDate,
  scaleMacros,
  toDouble,
} from '../lib/format';
import { OffProduct, offErrorMessage, searchOff } from '../lib/off';
import { choosePhoto } from '../lib/photo';
import { AiConfig, AiIngredient, AiResult, LabelResult, analyzeImage, analyzeLabel } from '../lib/ai';
import { aiConfigOf, useStore } from '../store/useStore';
import { RootStackParamList } from '../nav';
import { CategoryChips } from '../components/CategoryChips';
import { PortionPicker } from '../components/PortionPicker';

type Props = NativeStackScreenProps<RootStackParamList, 'AddMeal'>;

type Tab = 'manual' | 'search' | 'photo' | 'label';

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
  const [tab, setTab] = useState<Tab>(route.params.tab ?? 'manual');
  const [day, setDay] = useState(route.params.day);
  const editingId = route.params.mealId;

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
      <View style={{ flexDirection: 'row', padding: 12, gap: 8 }}>
        {(
          [
            ['manual', '✏️ Ręcznie'],
            ['search', '🔍 Szukaj'],
            ['photo', '📸 Zdjęcie'],
            ['label', '🏷️ Etykieta'],
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
      {tab === 'manual' && (
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
        />
      )}
      {tab === 'photo' && (
        <PhotoTab
          day={day}
          category={category}
          setCategory={setCategory}
          cfg={aiCfg}
          onAdded={() => {
            bump();
            navigation.goBack();
          }}
        />
      )}
      {tab === 'label' && (
        <LabelTab
          day={day}
          category={category}
          setCategory={setCategory}
          cfg={aiCfg}
          onAdded={() => {
            bump();
            navigation.goBack();
          }}
        />
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
}) {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [local, setLocal] = useState<FavoriteRow[]>([]);
  const [remote, setRemote] = useState<OffProduct[]>([]);
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
      setErr(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    setErr(null);
    setLocal(await searchFavorites(needle).catch(() => []));
    try {
      setRemote(await searchOff(needle));
    } catch (e) {
      setErr(`${offErrorMessage(e)} Wyniki lokalne nadal dostępne.`);
    } finally {
      setBusy(false);
    }
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
                    label: `Całe opakowanie (${picked.opakowanieG} g)`,
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
                setPicked({ ...f, fromLocal: true });
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
      {!busy && local.length === 0 && remote.length === 0 && (
        <Text style={{ textAlign: 'center', color: colors.text, opacity: 0.6, marginTop: 24 }}>
          {q.trim() === ''
            ? 'Wpisz nazwę produktu, aby przeszukać bazę lokalną i Open Food Facts.'
            : 'Brak wyników. Spróbuj innej nazwy lub dodaj ręcznie.'}
        </Text>
      )}
    </ScrollView>
  );
}

// ── Zakładka zdjęcia (AI) ────────────────────────────────────

function PhotoTab(p: {
  day: string;
  category: number;
  setCategory: (i: number) => void;
  cfg: AiConfig;
  onAdded: () => void;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);
  const [items, setItems] = useState<AiIngredient[]>([]);

  const pick = async (fromCamera: boolean) => {
    if (p.cfg.apiKey.trim() === '') {
      setErr('Najpierw wklej klucz API w Ustawieniach (sekcja AI).');
      return;
    }
    try {
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({
            quality: 0.6,
            base64: true,
            exif: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            quality: 0.6,
            base64: true,
            exif: false,
          });
      if (res.canceled || !res.assets[0]?.base64) return;
      setBusy(true);
      setErr(null);
      setResult(null);
      const r = await analyzeImage(p.cfg, res.assets[0].base64);
      setBusy(false);
      if (r.error) {
        setErr(r.error);
        return;
      }
      setResult(r);
      setItems(r.skladniki);
    } catch {
      setBusy(false);
      setErr('Błąd analizy zdjęcia. Sprawdź internet i spróbuj ponownie.');
    }
  };

  const toggle = (i: number) =>
    setItems((prev) =>
      prev.map((it, idx) => (idx === i ? { ...it, selected: !it.selected } : it)),
    );

  const chosen = items.filter((i) => i.selected);
  const totKcal = chosen.reduce((s, i) => s + i.kcal, 0);
  const totWaga = chosen.reduce((s, i) => s + i.waga, 0);

  const save = async () => {
    if (chosen.length === 0 || !result) return;
    try {
      for (const s of chosen) {
        await insertMeal({
          nazwa:
            chosen.length > 1
              ? `${result.danie} – ${s.nazwa}`
              : result.danie || s.nazwa,
          kcal: s.kcal,
          bialko: s.bialko,
          tluszcze: s.tluszcze,
          wegle: s.wegle,
          waga: s.waga,
          kategoria: p.category,
          dzien: p.day,
          zrodlo: SOURCE_AI,
        });
      }
      p.onAdded();
    } catch {
      Alert.alert('Błąd', 'Nie udało się zapisać posiłku.');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ textAlign: 'center', color: colors.text, opacity: 0.75 }}>
        Zrób zdjęcie posiłku – AI (wybrany dostawca w Ustawieniach)
        rozpozna składniki i oszacuje kalorie.
      </Text>
      {busy ? (
        <View style={{ alignItems: 'center', padding: 24, gap: 12 }}>
          <ActivityIndicator size="large" />
          <Text style={{ color: colors.text }}>
            Analizuję zdjęcie… to może potrwać chwilę.
          </Text>
        </View>
      ) : (
        <>
          <TouchableOpacity
            onPress={() => pick(true)}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              padding: 14,
              alignItems: 'center',
            }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
              📸 Zrób zdjęcie (aparat)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => pick(false)}
            style={{
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: 12,
              padding: 14,
              alignItems: 'center',
            }}>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>
              🖼️ Wybierz z galerii
            </Text>
          </TouchableOpacity>
        </>
      )}
      {err && (
        <View
          style={{ backgroundColor: '#ffebee', borderRadius: 10, padding: 10 }}>
          <Text style={{ color: '#b71c1c' }}>{err}</Text>
        </View>
      )}
      {result && (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 8,
          }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
            {result.danie}
          </Text>
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            Zaznaczone: {fmtKcal(totKcal)} • {fmtG(totWaga)}
          </Text>
          {items.map((it, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => toggle(i)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: colors.primary,
                  backgroundColor: it.selected ? colors.primary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {it.selected && (
                  <Text style={{ color: '#fff', fontSize: 14 }}>✓</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>
                  {it.nazwa} ({fmtG(it.waga)})
                </Text>
                <Text style={{ fontSize: 12, color: colors.text, opacity: 0.7 }}>
                  {fmtKcal(it.kcal)} • B:{it.bialko.toFixed(1)} T:
                  {it.tluszcze.toFixed(1)} W:{it.wegle.toFixed(1)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={save}
            disabled={chosen.length === 0}
            style={{
              backgroundColor: chosen.length === 0 ? colors.border : colors.primary,
              borderRadius: 12,
              padding: 14,
              alignItems: 'center',
              marginTop: 4,
            }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
              Dodaj zaznaczone ({chosen.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={{ color: colors.text, fontWeight: '600' }}>
        Kategoria posiłku:
      </Text>
      <CategoryChips value={p.category} onChange={p.setCategory} />
      <Text style={{ color: colors.text, opacity: 0.6 }}>
        Dzień: {prettyDate(parseDayKey(p.day))} ({CATEGORIES[p.category]})
      </Text>
    </ScrollView>
  );
}

// ── Zakładka etykiety (zdjęcie tabeli wartości odżywczych) ───

function LabelTab(p: {
  day: string;
  category: number;
  setCategory: (i: number) => void;
  cfg: AiConfig;
  onAdded: () => void;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [b, setB] = useState('');
  const [t, setT] = useState('');
  const [w, setW] = useState('');
  const [grams, setGrams] = useState(100);
  const [extras, setExtras] = useState<{ label: string; grams: number }[]>([]);

  const pick = async (fromCamera: boolean) => {
    if (p.cfg.apiKey.trim() === '') {
      setErr('Najpierw wklej klucz API w Ustawieniach (sekcja AI).');
      return;
    }
    try {
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({
            quality: 0.8,
            base64: true,
            exif: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            quality: 0.8,
            base64: true,
            exif: false,
          });
      if (res.canceled || !res.assets[0]?.base64) return;
      setBusy(true);
      setErr(null);
      const r: LabelResult = await analyzeLabel(p.cfg, res.assets[0].base64);
      setBusy(false);
      if (r.error) {
        setErr(r.error);
        return;
      }
      setName(r.nazwa);
      setKcal(String(r.kcal100));
      setB(String(r.bialko100));
      setT(String(r.tluszcze100));
      setW(String(r.wegle100));
      const chips: { label: string; grams: number }[] = [];
      if (r.opakowanieG) {
        chips.push({
          label: `Całe opakowanie (${r.opakowanieG} g)`,
          grams: r.opakowanieG,
        });
      }
      if (r.porcjaG && r.porcjaG !== r.opakowanieG) {
        chips.push({
          label: `1 porcja (${r.porcjaG} g)`,
          grams: r.porcjaG,
        });
      }
      setExtras(chips);
      setGrams(100);
      setScanned(true);
    } catch {
      setBusy(false);
      setErr('Błąd analizy zdjęcia. Sprawdź internet i spróbuj ponownie.');
    }
  };

  const save = async () => {
    if (name.trim() === '') {
      Alert.alert('Uwaga', 'Wpisz nazwę produktu.');
      return;
    }
    if (grams <= 0) {
      Alert.alert('Uwaga', 'Podaj, ile gramów zjadłeś.');
      return;
    }
    const s = scaleMacros(
      toDouble(kcal),
      toDouble(b),
      toDouble(t),
      toDouble(w),
      grams,
    );
    try {
      await insertMeal({
        nazwa: name,
        kcal: s.kcal,
        bialko: s.bialko,
        tluszcze: s.tluszcze,
        wegle: s.wegle,
        waga: grams,
        kategoria: p.category,
        dzien: p.day,
        zrodlo: SOURCE_AI,
      });
      await rememberProduct({
        nazwa: name,
        kcal100: toDouble(kcal),
        bialko100: toDouble(b),
        tluszcze100: toDouble(t),
        wegle100: toDouble(w),
      });
      p.onAdded();
    } catch {
      Alert.alert('Błąd', 'Nie udało się dodać posiłku.');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ textAlign: 'center', color: colors.text, opacity: 0.75 }}>
        Zrób zdjęcie tabeli wartości odżywczych z opakowania. AI odczyta
        wartości na 100 g, a Ty wpiszesz, ile gramów zjadłeś.
      </Text>
      {busy ? (
        <View style={{ alignItems: 'center', padding: 24, gap: 12 }}>
          <ActivityIndicator size="large" />
          <Text style={{ color: colors.text }}>
            Odczytuję tabelę… to może potrwać chwilę.
          </Text>
        </View>
      ) : (
        <>
          <TouchableOpacity
            onPress={() => pick(true)}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              padding: 14,
              alignItems: 'center',
            }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
              📸 Zrób zdjęcie etykiety
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => pick(false)}
            style={{
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: 12,
              padding: 14,
              alignItems: 'center',
            }}>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>
              🖼️ Wybierz z galerii
            </Text>
          </TouchableOpacity>
        </>
      )}
      {err && (
        <View
          style={{ backgroundColor: '#ffebee', borderRadius: 10, padding: 10 }}>
          <Text style={{ color: '#b71c1c' }}>{err}</Text>
        </View>
      )}
      {scanned && !busy && (
        <>
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            Odczytane wartości (na 100 g) — sprawdź i popraw:
          </Text>
          <Field label="Nazwa produktu *" value={name} onChange={setName} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field label="Kcal /100 g" value={kcal} onChange={setKcal} numeric />
            <Field label="Białko /100 g" value={b} onChange={setB} numeric />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field label="Tłuszcze /100 g" value={t} onChange={setT} numeric />
            <Field label="Węgle /100 g" value={w} onChange={setW} numeric />
          </View>
          <PortionPicker
            kcal100={toDouble(kcal)}
            bialko100={toDouble(b)}
            tluszcze100={toDouble(t)}
            wegle100={toDouble(w)}
            grams={grams}
            setGrams={setGrams}
            extraChips={extras}
          />
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            Kategoria posiłku:
          </Text>
          <CategoryChips value={p.category} onChange={p.setCategory} />
          <TouchableOpacity
            onPress={save}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              padding: 14,
              alignItems: 'center',
            }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
              Dodaj ({Math.round(grams)} g)
            </Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}
