import React, { useState } from 'react';
import {
  Alert,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { FavoriteRow } from '../db/database';
import { insertFavorite, updateFavorite } from '../db/favorites';
import { CATEGORIES } from '../lib/constants';
import { toDouble } from '../lib/format';
import { choosePhoto } from '../lib/photo';
import { CategoryChips } from './CategoryChips';

/**
 * Formularz produktu (wartości na 100 g) z opcjonalnym zdjęciem i kodem.
 * Używany w Ulubionych i w Kreatorze bazy.
 *
 * `initial` z `id <= 0` traktowane jest jako nowy produkt
 * (np. wypełniony danymi z kodu kreskowego lub etykiety).
 */
export function ProductForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: FavoriteRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors } = useTheme();
  const [nazwa, setNazwa] = useState(initial?.nazwa ?? '');
  const [kcal, setKcal] = useState(initial ? String(initial.kcal100) : '');
  const [b, setB] = useState(initial ? String(initial.bialko100) : '');
  const [t, setT] = useState(initial ? String(initial.tluszcze100) : '');
  const [w, setW] = useState(initial ? String(initial.wegle100) : '');
  const [kod, setKod] = useState(initial?.kod ?? '');
  const [totalW, setTotalW] = useState(
    initial?.opakowanie_g != null && initial.opakowanie_g > 0
      ? String(Math.round(initial.opakowanie_g))
      : '',
  );
  const [defCat, setDefCat] = useState(initial?.kategoria ?? 4);
  const [zdjecie, setZdjecie] = useState<string | null>(
    initial?.zdjecie ?? null,
  );

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    color: colors.text,
    backgroundColor: colors.card,
    marginBottom: 8,
  } as const;

  const save = async () => {
    if (nazwa.trim() === '') {
      Alert.alert('Uwaga', 'Wpisz nazwę produktu.');
      return;
    }
    try {
      const data = {
        nazwa,
        kcal100: toDouble(kcal),
        bialko100: toDouble(b),
        tluszcze100: toDouble(t),
        wegle100: toDouble(w),
        kod: kod.trim() === '' ? null : kod.trim(),
        zdjecie,
        kategoria: defCat,
        opakowanieG: (() => {
          const n = parseFloat(totalW.replace(',', '.'));
          return Number.isFinite(n) && n > 0 && n <= 10000
            ? Math.round(n)
            : null;
        })(),
      };
      if (initial && initial.id > 0) await updateFavorite(initial.id, data);
      else await insertFavorite(data);
      onSaved();
    } catch {
      Alert.alert('Błąd', 'Nie udało się zapisać produktu.');
    }
  };

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.primary,
      }}>
      <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 8 }}>
        {initial && initial.id > 0
          ? 'Edytuj produkt'
          : 'Nowy produkt (wartości na 100 g)'}
      </Text>
      <TextInput value={nazwa} onChangeText={setNazwa} placeholder="Nazwa *" placeholderTextColor={colors.text + '66'} style={inputStyle} />
      <TextInput value={kcal} onChangeText={setKcal} placeholder="Kcal /100 g *" keyboardType="numeric" placeholderTextColor={colors.text + '66'} style={inputStyle} />
      <TextInput value={b} onChangeText={setB} placeholder="Białko /100 g" keyboardType="numeric" placeholderTextColor={colors.text + '66'} style={inputStyle} />
      <TextInput value={t} onChangeText={setT} placeholder="Tłuszcze /100 g" keyboardType="numeric" placeholderTextColor={colors.text + '66'} style={inputStyle} />
      <TextInput value={w} onChangeText={setW} placeholder="Węgle /100 g" keyboardType="numeric" placeholderTextColor={colors.text + '66'} style={inputStyle} />
      <TextInput value={kod} onChangeText={setKod} placeholder="Kod kreskowy (opcjonalnie)" placeholderTextColor={colors.text + '66'} style={inputStyle} />
      <TextInput value={totalW} onChangeText={setTotalW} placeholder="Waga całego opakowania w g/ml (opcjonalnie)" keyboardType="numeric" placeholderTextColor={colors.text + '66'} style={inputStyle} />
      <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 6, fontSize: 13 }}>
        Co to zwykle jest? (wybierze się samo przy dodawaniu)
      </Text>
      <View style={{ marginBottom: 8 }}>
        <CategoryChips value={defCat} onChange={setDefCat} />
      </View>
      <Text style={{ color: colors.text, opacity: 0.6, fontSize: 12, marginBottom: 8 }}>
        Aktualnie: {CATEGORIES[defCat] ?? 'Przekąski'}
      </Text>
      {zdjecie ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
          }}>
          <Image
            source={{ uri: zdjecie }}
            style={{ width: 64, height: 64, borderRadius: 10 }}
          />
          <TouchableOpacity onPress={() => setZdjecie(null)}>
            <Text style={{ color: '#e53935', fontWeight: '700' }}>
              Usuń zdjęcie
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => choosePhoto((u) => setZdjecie(u))}
          style={{
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: 10,
            padding: 10,
            alignItems: 'center',
            marginBottom: 8,
          }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            📷 Dodaj zdjęcie produktu
          </Text>
        </TouchableOpacity>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={onClose}
          style={{ flex: 1, padding: 12, alignItems: 'center' }}>
          <Text style={{ color: colors.text }}>Anuluj</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={save}
          style={{
            flex: 1,
            backgroundColor: colors.primary,
            borderRadius: 10,
            padding: 12,
            alignItems: 'center',
          }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Zapisz</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
