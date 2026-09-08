import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { fmtG, fmtKcal, scaleMacros, ScaledMacros } from '../lib/format';

const QUICK = [50, 100, 150, 200, 300];

/** Wybór gramatury (wpis / chipy) albo sztuk (np. 3 jajka). */
export function PortionPicker({
  kcal100,
  bialko100,
  tluszcze100,
  wegle100,
  grams,
  setGrams,
  extraChips,
  pieceGrams,
}: {
  kcal100: number;
  bialko100: number;
  tluszcze100: number;
  wegle100: number;
  grams: number;
  setGrams: (g: number) => void;
  /** Dodatkowe chipy, np. całe opakowanie albo porcja producenta. */
  extraChips?: { label: string; grams: number }[];
  /** Waga 1 sztuki w g (z bazy) — startowa do trybu sztuk. */
  pieceGrams?: number | null;
}) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<'g' | 'szt'>('g');
  const [pieces, setPieces] = useState(1);
  const [perPieceTxt, setPerPieceTxt] = useState(
    pieceGrams != null && pieceGrams > 0 ? String(pieceGrams) : '',
  );
  useEffect(() => {
    if (pieceGrams != null && pieceGrams > 0) {
      setPerPieceTxt(String(pieceGrams));
    }
  }, [pieceGrams]);
  const perPiece = parseFloat(perPieceTxt.replace(',', '.'));
  const perPieceOk = Number.isFinite(perPiece) && perPiece > 0;
  const scaled: ScaledMacros = scaleMacros(
    kcal100,
    bialko100,
    tluszcze100,
    wegle100,
    grams,
  );
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        {(
          [
            ['g', '⚖️ Gramy'],
            ['szt', '🥚 Sztuki'],
          ] as ['g' | 'szt', string][]
        ).map(([m, label]) => (
          <TouchableOpacity
            key={m}
            onPress={() => {
              setMode(m);
              if (m === 'szt' && perPieceOk) {
                setGrams(Math.round(pieces * perPiece * 10) / 10);
              }
            }}
            style={{
              flex: 1,
              paddingVertical: 8,
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
      {mode === 'g' ? (
        <>
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
        </>
      ) : (
        <View style={{ gap: 10, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              1 szt. =
            </Text>
            <TextInput
              value={perPieceTxt}
              onChangeText={(t) => {
                setPerPieceTxt(t);
                const n = parseFloat(t.replace(',', '.'));
                if (Number.isFinite(n) && n > 0) {
                  setGrams(Math.round(pieces * n * 10) / 10);
                }
              }}
              keyboardType="numeric"
              placeholder="g"
              placeholderTextColor={colors.text + '66'}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 8,
                width: 80,
                color: colors.text,
                textAlign: 'center',
              }}
            />
            <Text style={{ color: colors.text, fontWeight: '600' }}>g</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              onPress={() => {
                if (!perPieceOk) return;
                const n = Math.max(1, Math.floor(pieces) - 1);
                setPieces(n);
                setGrams(Math.round(n * perPiece * 10) / 10);
              }}
              disabled={!perPieceOk}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: perPieceOk ? 1 : 0.4,
              }}>
              <Text style={{ fontSize: 22, color: colors.text }}>−</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, minWidth: 70, textAlign: 'center' }}>
              {pieces} szt.
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (!perPieceOk) return;
                const n = Math.floor(pieces) + 1;
                setPieces(n);
                setGrams(Math.round(n * perPiece * 10) / 10);
              }}
              disabled={!perPieceOk}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.primary,
                opacity: perPieceOk ? 1 : 0.4,
              }}>
              <Text style={{ fontSize: 22, color: '#fff' }}>+</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.text, opacity: 0.7 }}>
              = {fmtG(grams)}
            </Text>
          </View>
          {!perPieceOk && (
            <Text style={{ color: colors.text, opacity: 0.6, fontSize: 12 }}>
              Wpisz wagę 1 sztuki (albo zapisz ją w bazie przy produkcie).
            </Text>
          )}
        </View>
      )}
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
