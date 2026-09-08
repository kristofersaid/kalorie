import React, { useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { insertMeal } from '../db/meals';
import { findLocalByBarcode, insertFavorite, searchFavorites } from '../db/favorites';
import { createTemplate, TemplateItemInput } from '../db/templates';
import {
  AiConfig,
  AiIngredient,
  AiResult,
  LabelResult,
  PhotoKind,
  analyzeImage,
  analyzeLabel,
  classifyPhoto,
} from '../lib/ai';
import {
  fmtG,
  fmtKcal,
  scaleMacros,
  toDouble,
} from '../lib/format';
import { OffProduct, offErrorMessage, offFromFavorite, productByBarcode } from '../lib/off';
import { validCategory } from '../lib/constants';
import { searchUsda } from '../lib/usda';
import { useStore } from '../store/useStore';
import { CategoryChips } from './CategoryChips';
import { PortionPicker } from './PortionPicker';

async function rememberProduct(p: {
  nazwa: string;
  kcal100: number;
  bialko100: number;
  tluszcze100: number;
  wegle100: number;
  kod?: string | null;
  zdjecie?: string | null;
  opakowanieG?: number | null;
  kategoria?: number | null;
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
    /* nie blokuj */
  }
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'working'; label: string }
  | { kind: 'barcode'; product: OffProduct }
  | { kind: 'label'; label: LabelResult }
  | { kind: 'meal'; result: AiResult }
  | { kind: 'error'; message: string };

/**
 * Inteligentny aparat: jedno zdjęcie → AI rozpoznaje kod kreskowy,
 * etykietę albo posiłek i kieruje do właściwej akcji.
 * Używane w Skanerze (dodanie do dnia) i w Kreatorze bazy (zapis).
 */
export function SmartCapture({
  cfg,
  day,
  category,
  setCategory,
  showAdd,
  showSaveProduct,
  showSaveDish,
  onDone,
}: {
  cfg: AiConfig;
  day: string;
  category: number;
  setCategory: (i: number) => void;
  showAdd: boolean;
  showSaveProduct: boolean;
  showSaveDish: boolean;
  onDone?: () => void;
}) {
  const { colors } = useTheme();
  const bump = useStore((s) => s.bump);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  // Stan gałęzi: porcja / etykieta / posiłek
  const [grams, setGrams] = useState(100);
  const [items, setItems] = useState<AiIngredient[]>([]);
  const [lname, setLname] = useState('');
  const [lkcal, setLkcal] = useState('');
  const [lb, setLb] = useState('');
  const [lt, setLt] = useState('');
  const [lw, setLw] = useState('');
  const [extras, setExtras] = useState<{ label: string; grams: number }[]>([]);
  const [opakG, setOpakG] = useState<number | null>(null);

  const needKey = (): boolean => {
    if (cfg.apiKey.trim() === '') {
      setPhase({
        kind: 'error',
        message: 'Najpierw wklej klucz API w Ustawieniach (sekcja AI).',
      });
      return true;
    }
    return false;
  };

  const shoot = async (fromCamera: boolean) => {
    if (needKey()) return;
    try {
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({
            quality: 0.7,
            base64: true,
            exif: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            quality: 0.7,
            base64: true,
            exif: false,
          });
      if (res.canceled || !res.assets[0]?.base64) return;
      const base64 = res.assets[0].base64;
      setPhase({ kind: 'working', label: 'Rozpoznaję zdjęcie…' });
      const kind: PhotoKind = await classifyPhoto(cfg, base64);
      if (kind.type === 'kod') {
        setPhase({ kind: 'working', label: 'Szukam produktu po kodzie…' });
        try {
          // Najpierw MOJA baza (offline), potem Open Food Facts.
          const local = await findLocalByBarcode(kind.kod).catch(() => null);
          if (local) {
            const mapped = offFromFavorite(local);
            // Parametry z bazy: kategoria (np. Mars → Przekąski).
            setCategory(validCategory(mapped.kategoria, category));
            setGrams(100);
            setPhase({ kind: 'barcode', product: mapped });
            return;
          }
          const product = await productByBarcode(kind.kod).catch(() => null);
          if (!product) {
            const u = await searchUsda(kind.kod).catch(() => []);
            if (u.length > 0) {
              setGrams(100);
              setPhase({ kind: 'barcode', product: u[0] });
              return;
            }
            setPhase({
              kind: 'error',
              message: `Odczytano kod ${kind.kod}, ale nie ma go w bazach online.`,
            });
            return;
          }
          setGrams(100);
          setPhase({ kind: 'barcode', product });
        } catch (e) {
          setPhase({ kind: 'error', message: offErrorMessage(e) });
        }
        return;
      }
      if (kind.type === 'etykieta') {
        setPhase({ kind: 'working', label: 'Odczytuję tabelę…' });
        const r = await analyzeLabel(cfg, base64);
        if (r.error) {
          setPhase({ kind: 'error', message: r.error });
          return;
        }
        fillLabel(r);
        setPhase({ kind: 'label', label: r });
        return;
      }
      if (kind.type === 'posilek') {
        setPhase({ kind: 'working', label: 'Analizuję posiłek…' });
        const r = await analyzeImage(cfg, base64);
        if (r.error) {
          setPhase({ kind: 'error', message: r.error });
          return;
        }
        setItems(r.skladniki);
        setPhase({ kind: 'meal', result: r });
        return;
      }
      setPhase({
        kind: 'error',
        message: kind.error ?? 'Nie rozpoznano zdjęcia.',
      });
    } catch {
      setPhase({
        kind: 'error',
        message: 'Błąd analizy zdjęcia. Sprawdź internet i spróbuj ponownie.',
      });
    }
  };

  const fillLabel = (r: LabelResult) => {
    setLname(r.nazwa);
    setLkcal(String(r.kcal100));
    setLb(String(r.bialko100));
    setLt(String(r.tluszcze100));
    setLw(String(r.wegle100));
    const chips: { label: string; grams: number }[] = [];
    if (r.opakowanieG) {
      chips.push({
        label: `Całość (${r.opakowanieG} g)`,
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
    setOpakG(r.opakowanieG ?? null);
    setGrams(100);
  };

  const finish = (msg: string) => {
    bump();
    Alert.alert('Gotowe', msg);
    onDone?.();
  };

  const fail = (msg: string) => Alert.alert('Błąd', msg);

  // ── Akcje: kod kreskowy ──
  const addBarcode = async (product: OffProduct) => {
    const s = scaleMacros(
      product.kcal100,
      product.bialko100,
      product.tluszcze100,
      product.wegle100,
      grams,
    );
    try {
      await insertMeal({
        nazwa: product.nazwa,
        kcal: s.kcal,
        bialko: s.bialko,
        tluszcze: s.tluszcze,
        wegle: s.wegle,
        waga: grams,
        kategoria: category,
        dzien: day,
        zrodlo: 'kod',
        zdjecie: product.zdjecie ?? null,
      });
      await rememberProduct({
        ...product,
        kategoria: product.kategoria ?? category,
      });
      finish(`Dodano: ${product.nazwa}`);
    } catch {
      fail('Nie udało się dodać posiłku.');
    }
  };

  const saveBarcode = async (product: OffProduct) => {
    try {
      await rememberProduct(product);
      finish(`Zapisano w bazie: ${product.nazwa}`);
    } catch {
      fail('Nie udało się zapisać produktu.');
    }
  };

  // ── Akcje: etykieta ──
  const labelScaled = () =>
    scaleMacros(toDouble(lkcal), toDouble(lb), toDouble(lt), toDouble(lw), grams);

  const addLabel = async () => {
    if (lname.trim() === '') {
      fail('Wpisz nazwę produktu.');
      return;
    }
    const s = labelScaled();
    try {
      await insertMeal({
        nazwa: lname,
        kcal: s.kcal,
        bialko: s.bialko,
        tluszcze: s.tluszcze,
        wegle: s.wegle,
        waga: grams,
        kategoria: category,
        dzien: day,
        zrodlo: 'ai',
      });
      await rememberProduct({
        nazwa: lname,
        kcal100: toDouble(lkcal),
        bialko100: toDouble(lb),
        tluszcze100: toDouble(lt),
        wegle100: toDouble(lw),
        opakowanieG: opakG,
        kategoria: category,
      });
      finish(`Dodano: ${lname}`);
    } catch {
      fail('Nie udało się dodać posiłku.');
    }
  };

  const saveLabel = async () => {
    if (lname.trim() === '') {
      fail('Wpisz nazwę produktu.');
      return;
    }
    try {
      await rememberProduct({
        nazwa: lname,
        kcal100: toDouble(lkcal),
        bialko100: toDouble(lb),
        tluszcze100: toDouble(lt),
        wegle100: toDouble(lw),
        opakowanieG: opakG,
        kategoria: category,
      });
      finish(`Zapisano w bazie: ${lname}`);
    } catch {
      fail('Nie udało się zapisać produktu.');
    }
  };

  // ── Akcje: posiłek ──
  const chosen = items.filter((i) => i.selected);

  const addMeal = async (danie: string) => {
    if (chosen.length === 0) return;
    try {
      for (const s of chosen) {
        await insertMeal({
          nazwa:
            chosen.length > 1 ? `${danie} – ${s.nazwa}` : danie || s.nazwa,
          kcal: s.kcal,
          bialko: s.bialko,
          tluszcze: s.tluszcze,
          wegle: s.wegle,
          waga: s.waga,
          kategoria: category,
          dzien: day,
          zrodlo: 'ai',
        });
      }
      finish('Dodano posiłek z AI.');
    } catch {
      fail('Nie udało się zapisać posiłku.');
    }
  };

  const saveDish = async (danie: string) => {
    if (chosen.length === 0) return;
    try {
      const dishItems: TemplateItemInput[] = chosen.map((s) => ({
        nazwa: s.nazwa,
        waga: s.waga,
        kcal: s.kcal,
        bialko: s.bialko,
        tluszcze: s.tluszcze,
        wegle: s.wegle,
      }));
      await createTemplate(
        danie.trim() === '' ? 'Danie ze zdjęcia' : danie.trim(),
        dishItems,
      );
      finish(`Zapisano danie w bazie (${chosen.length} składników).`);
    } catch {
      fail('Nie udało się zapisać dania.');
    }
  };

  const reset = () => setPhase({ kind: 'idle' });

  const actionBtn = (
    label: string,
    onPress: () => void,
    primary: boolean,
    disabled = false,
  ) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: primary ? colors.primary : 'transparent',
        borderWidth: primary ? 0 : 1,
        borderColor: colors.primary,
        borderRadius: 12,
        padding: 13,
        alignItems: 'center',
        opacity: disabled ? 0.5 : 1,
      }}>
      <Text
        style={{
          color: primary ? '#fff' : colors.primary,
          fontWeight: '800',
          fontSize: 15,
        }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // ── Render ──
  if (phase.kind === 'working') {
    return (
      <View style={{ alignItems: 'center', padding: 24, gap: 12 }}>
        <ActivityIndicator size="large" />
        <Text style={{ color: colors.text }}>{phase.label}</Text>
        <TouchableOpacity onPress={reset}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            Anuluj
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase.kind === 'error') {
    return (
      <View style={{ gap: 12 }}>
        <View
          style={{ backgroundColor: '#ffebee', borderRadius: 10, padding: 12 }}>
          <Text style={{ color: '#b71c1c' }}>{phase.message}</Text>
        </View>
        {actionBtn('📷 Zrób inne zdjęcie', reset, false)}
      </View>
    );
  }

  if (phase.kind === 'barcode') {
    const p = phase.product;
    return (
      <View style={{ gap: 12 }}>
        <TouchableOpacity onPress={reset}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            ‹ Inne zdjęcie
          </Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
          🔖 {p.nazwa}
        </Text>
        <PortionPicker
          kcal100={p.kcal100}
          bialko100={p.bialko100}
          tluszcze100={p.tluszcze100}
          wegle100={p.wegle100}
          grams={grams}
          setGrams={setGrams}
          pieceGrams={p.sztukaG ?? null}
          extraChips={[
            ...(p.opakowanieG
              ? [
                  {
                    label: `Całość (${p.opakowanieG} g)`,
                    grams: p.opakowanieG,
                  },
                ]
              : []),
            ...(p.porcjaG && p.porcjaG !== p.opakowanieG
              ? [{ label: `1 porcja (${p.porcjaG} g)`, grams: p.porcjaG }]
              : []),
          ]}
        />
        {showAdd && (
          <>
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              Kategoria:
            </Text>
            <CategoryChips value={category} onChange={setCategory} />
          </>
        )}
        {showAdd && actionBtn(`Dodaj do dziś (${Math.round(grams)} g)`, () => addBarcode(p), true)}
        {showSaveProduct &&
          actionBtn('💾 Zapisz produkt w bazie', () => saveBarcode(p), !showAdd)}
      </View>
    );
  }

  if (phase.kind === 'label') {
    return (
      <View style={{ gap: 10 }}>
        <TouchableOpacity onPress={reset}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            ‹ Inne zdjęcie
          </Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontWeight: '700' }}>
          Odczytane wartości (na 100 g) — sprawdź i popraw:
        </Text>
        <LField label="Nazwa produktu *" value={lname} onChange={setLname} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <LField label="Kcal /100 g" value={lkcal} onChange={setLkcal} numeric />
          <LField label="Białko" value={lb} onChange={setLb} numeric />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <LField label="Tłuszcze" value={lt} onChange={setLt} numeric />
          <LField label="Węgle" value={lw} onChange={setLw} numeric />
        </View>
        <PortionPicker
          kcal100={toDouble(lkcal)}
          bialko100={toDouble(lb)}
          tluszcze100={toDouble(lt)}
          wegle100={toDouble(lw)}
          grams={grams}
          setGrams={setGrams}
          extraChips={extras}
        />
        {showAdd && (
          <>
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              Kategoria:
            </Text>
            <CategoryChips value={category} onChange={setCategory} />
          </>
        )}
        {showAdd && actionBtn(`Dodaj do dziś (${Math.round(grams)} g)`, addLabel, true)}
        {showSaveProduct &&
          actionBtn('💾 Zapisz produkt w bazie', saveLabel, !showAdd)}
      </View>
    );
  }

  if (phase.kind === 'meal') {
    const r = phase.result;
    const totKcal = chosen.reduce((s, i) => s + i.kcal, 0);
    return (
      <View style={{ gap: 10 }}>
        <TouchableOpacity onPress={reset}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            ‹ Inne zdjęcie
          </Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
          🍽️ {r.danie}
        </Text>
        <Text style={{ color: colors.text, fontWeight: '600' }}>
          Zaznaczone: {fmtKcal(totKcal)} ({chosen.length} składników)
        </Text>
        {items.map((it, i) => (
          <TouchableOpacity
            key={i}
            onPress={() =>
              setItems((prev) =>
                prev.map((x, idx) =>
                  idx === i ? { ...x, selected: !x.selected } : x,
                ),
              )
            }
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
        {showAdd && (
          <>
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              Kategoria:
            </Text>
            <CategoryChips value={category} onChange={setCategory} />
          </>
        )}
        {showAdd &&
          actionBtn(
            `Dodaj zaznaczone (${chosen.length})`,
            () => addMeal(r.danie),
            true,
            chosen.length === 0,
          )}
        {showSaveDish &&
          actionBtn(
            '💾 Zapisz jako danie w bazie',
            () => saveDish(r.danie),
            !showAdd,
            chosen.length === 0,
          )}
      </View>
    );
  }

  // idle
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ textAlign: 'center', color: colors.text, opacity: 0.75 }}>
        Jedno zdjęcie wystarczy — AI rozpozna, czy to kod kreskowy, etykieta
        czy gotowy posiłek, i pokaże właściwe opcje.
      </Text>
      <TouchableOpacity
        onPress={() => shoot(true)}
        style={{
          backgroundColor: colors.primary,
          borderRadius: 12,
          padding: 14,
          alignItems: 'center',
        }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
          📸 Zrób zdjęcie
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => shoot(false)}
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
    </View>
  );
}

function LField({
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
