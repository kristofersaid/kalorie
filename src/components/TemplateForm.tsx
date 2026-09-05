import React, { useState } from 'react';
import {
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { createTemplate, TemplateItemInput } from '../db/templates';
import { fmtKcal, toDouble } from '../lib/format';

/**
 * Kreator szablonu dania złożonego (nazwa + lista składników).
 * Używany w Ulubionych i w Kreatorze bazy.
 */
export function TemplateForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors } = useTheme();
  const [nazwa, setNazwa] = useState('');
  const [items, setItems] = useState<TemplateItemInput[]>([]);
  const [n, setN] = useState('');
  const [g, setG] = useState('100');
  const [k, setK] = useState('');
  const [b, setB] = useState('');
  const [t, setT] = useState('');
  const [w, setW] = useState('');

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    color: colors.text,
    backgroundColor: colors.background,
    marginBottom: 6,
  } as const;

  const addIng = () => {
    if (n.trim() === '') {
      Alert.alert('Uwaga', 'Wpisz nazwę składnika.');
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        nazwa: n.trim(),
        waga: toDouble(g),
        kcal: toDouble(k),
        bialko: toDouble(b),
        tluszcze: toDouble(t),
        wegle: toDouble(w),
      },
    ]);
    setN('');
    setG('100');
    setK('');
    setB('');
    setT('');
    setW('');
  };

  const save = async () => {
    if (nazwa.trim() === '' || items.length === 0) {
      Alert.alert('Uwaga', 'Podaj nazwę szablonu i co najmniej 1 składnik.');
      return;
    }
    try {
      await createTemplate(nazwa, items);
      onSaved();
    } catch {
      Alert.alert('Błąd', 'Nie udało się zapisać szablonu.');
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
        Nowy szablon posiłku
      </Text>
      <TextInput
        value={nazwa}
        onChangeText={setNazwa}
        placeholder="Nazwa szablonu *, np. Moja owsianka"
        placeholderTextColor={colors.text + '66'}
        style={inputStyle}
      />
      {items.map((it, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 4,
          }}>
          <Text style={{ color: colors.text }}>
            {it.nazwa} ({Math.round(it.waga)} g) • {fmtKcal(it.kcal)}
          </Text>
          <TouchableOpacity
            onPress={() => setItems((prev) => prev.filter((_, x) => x !== i))}>
            <Text style={{ color: '#e53935', fontWeight: '800' }}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <Text style={{ color: colors.text, fontWeight: '700', marginTop: 6 }}>
        Dodaj składnik:
      </Text>
      <TextInput value={n} onChangeText={setN} placeholder="Nazwa *" placeholderTextColor={colors.text + '66'} style={inputStyle} />
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TextInput value={g} onChangeText={setG} placeholder="g" keyboardType="numeric" placeholderTextColor={colors.text + '66'} style={{ ...inputStyle, flex: 1 }} />
        <TextInput value={k} onChangeText={setK} placeholder="kcal" keyboardType="numeric" placeholderTextColor={colors.text + '66'} style={{ ...inputStyle, flex: 1 }} />
        <TextInput value={b} onChangeText={setB} placeholder="B" keyboardType="numeric" placeholderTextColor={colors.text + '66'} style={{ ...inputStyle, flex: 1 }} />
        <TextInput value={t} onChangeText={setT} placeholder="T" keyboardType="numeric" placeholderTextColor={colors.text + '66'} style={{ ...inputStyle, flex: 1 }} />
        <TextInput value={w} onChangeText={setW} placeholder="W" keyboardType="numeric" placeholderTextColor={colors.text + '66'} style={{ ...inputStyle, flex: 1 }} />
      </View>
      <TouchableOpacity
        onPress={addIng}
        style={{
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: 8,
          padding: 10,
          alignItems: 'center',
          marginBottom: 8,
        }}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>
          + Dodaj składnik
        </Text>
      </TouchableOpacity>
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
          <Text style={{ color: '#fff', fontWeight: '800' }}>Zapisz szablon</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
