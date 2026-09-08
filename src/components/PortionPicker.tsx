import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { fmtG, fmtKcal, scaleMacros, ScaledMacros } from '../lib/format';

const QUICK = [50, 100, 150, 200, 300];

/** Wybór gramatury z podglądem przeliczonych makro. */
export function PortionPicker({
  kcal100,
  bialko100,
  tluszcze100,
  wegle100,
  grams,
  setGrams,
  extraChips,
}: {
  kcal100: number;
  bialko100: number;
  tluszcze100: number;
  wegle100: number;
  grams: number;
  setGrams: (g: number) => void;
  /** Dodatkowe chipy, np. całe opakowanie albo porcja producenta. */
  extraChips?: { label: string; grams: number }[];
}) {
  const { colors } = useTheme();
  const scaled: ScaledMacros = scaleMacros(
    kcal100,
    bialko100,
    tluszcze100,
    wegle100,
    grams,
  );
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text, flex: 1 }}>
          Porcja: {Math.round(grams)} g
        </Text>
        <TextInput
          value={String(Math.round(grams))}
          onChangeText={(t) => {
            const n = parseFloat(t.replace(',', '.'));
            // Bez limitów: dowolna nieujemna gramatura.
            if (Number.isFinite(n) && n >= 0) setGrams(n);
          }}
          keyboardType="numeric"
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            padding: 8,
            width: 90,
            color: colors.text,
            textAlign: 'center',
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10, flexWrap: 'wrap' }}>
        {QUICK.map((g) => (
          <TouchableOpacity
            key={g}
            onPress={() => setGrams(g)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 16,
              backgroundColor:
                Math.round(grams) === g ? colors.primary : colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
            <Text
              style={{
                color: Math.round(grams) === g ? '#fff' : colors.text,
                fontWeight: '600',
              }}>
              {g} g
            </Text>
          </TouchableOpacity>
        ))}
        {(extraChips ?? []).map((c) => (
          <TouchableOpacity
            key={c.label}
            onPress={() => setGrams(c.grams)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 16,
              backgroundColor:
                Math.round(grams) === Math.round(c.grams)
                  ? '#2e7d32'
                  : colors.card,
              borderWidth: 1,
              borderColor:
                Math.round(grams) === Math.round(c.grams)
                  ? '#2e7d32'
                  : colors.border,
            }}>
            <Text
              style={{
                color:
                  Math.round(grams) === Math.round(c.grams)
                    ? '#fff'
                    : colors.text,
                fontWeight: '600',
              }}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 10,
          padding: 10,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
        <Text style={{ fontWeight: '700', color: colors.text }}>
          {fmtKcal(scaled.kcal)} • B: {fmtG(scaled.bialko)} T:{' '}
          {fmtG(scaled.tluszcze)} W: {fmtG(scaled.wegle)}
        </Text>
      </View>
    </View>
  );
}
