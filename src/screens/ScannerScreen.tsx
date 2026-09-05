import React, { useRef, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { insertMeal } from '../db/meals';
import { insertFavorite, searchFavorites } from '../db/favorites';
import { CATEGORIES, SOURCE_BARCODE } from '../lib/constants';
import { fmtKcal, scaleMacros, todayKey } from '../lib/format';
import { OffProduct, productByBarcode } from '../lib/off';
import { RootStackParamList } from '../nav';
import { aiConfigOf, useStore } from '../store/useStore';
import { AiConfig } from '../lib/ai';
import { CategoryChips } from '../components/CategoryChips';
import { PortionPicker } from '../components/PortionPicker';
import { SmartCapture } from '../components/SmartCapture';

function defaultCategory(): number {
  const h = new Date().getHours();
  if (h < 10) return 0;
  if (h < 13) return 1;
  if (h < 16) return 2;
  if (h < 21) return 3;
  return 4;
}

export function ScannerScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bump = useStore((s) => s.bump);
  const aiCfg: AiConfig = aiConfigOf({
    aiProvider: useStore((s) => s.aiProvider),
    aiKeys: useStore((s) => s.aiKeys),
    aiModels: useStore((s) => s.aiModels),
    apiKey: useStore((s) => s.apiKey),
  });
  const [mode, setMode] = useState<'live' | 'photo'>('live');
  const [photoCat, setPhotoCat] = useState(defaultCategory());
  const [permission, requestPermission] = useCameraPermissions();
  const [fetching, setFetching] = useState(false);
  const [product, setProduct] = useState<OffProduct | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [grams, setGrams] = useState(100);
  const [category, setCategory] = useState(defaultCategory());
  const lock = useRef(false);

  const lookup = async (code: string) => {
    if (lock.current || fetching) return;
    lock.current = true;
    setFetching(true);
    setErr(null);
    setProduct(null);
    try {
      const p = await productByBarcode(code);
      if (!p) {
        setErr(`Nie znaleziono produktu o kodzie ${code}.`);
      } else {
        setProduct(p);
        setGrams(100);
      }
    } catch {
      setErr('Błąd pobierania produktu. Sprawdź internet.');
    } finally {
      setFetching(false);
      setTimeout(() => {
        lock.current = false;
      }, 2000);
    }
  };

  const save = async () => {
    if (!product) return;
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
        dzien: todayKey(),
        zrodlo: SOURCE_BARCODE,
      });
      try {
        const found = await searchFavorites(product.nazwa);
        const exists = found.some(
          (f) =>
            f.nazwa.trim().toLowerCase() === product.nazwa.trim().toLowerCase(),
        );
        if (!exists) {
          await insertFavorite({
            nazwa: product.nazwa,
            kcal100: product.kcal100,
            bialko100: product.bialko100,
            tluszcze100: product.tluszcze100,
            wegle100: product.wegle100,
            kod: product.kod,
            zdjecie: product.zdjecie,
            ulubione: false,
            opakowanieG: product.opakowanieG,
          });
        }
      } catch {
        /* ignoruj */
      }
      bump();
      Alert.alert('Gotowe', `Dodano: ${product.nazwa}`);
      nav.goBack();
    } catch {
      Alert.alert('Błąd', 'Nie udało się dodać posiłku.');
    }
  };

  if (!permission) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          gap: 12,
          backgroundColor: colors.background,
        }}>
        <Text style={{ textAlign: 'center', color: colors.text }}>
          Aplikacja potrzebuje dostępu do aparatu, aby skanować kody kreskowe.
          Możesz też wpisać kod ręcznie:
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 10,
            padding: 12,
            paddingHorizontal: 24,
          }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>
            Zezwól na aparat
          </Text>
        </TouchableOpacity>
        <ManualCode
          manualCode={manualCode}
          setManualCode={setManualCode}
          onGo={() => lookup(manualCode)}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', padding: 10, gap: 8 }}>
        {(
          [
            ['live', '🔖 Skan na żywo'],
            ['photo', '✨ Zdjęcie AI'],
          ] as ['live' | 'photo', string][]
        ).map(([m, label]) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMode(m)}
            style={{
              flex: 1,
              padding: 10,
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
      {mode === 'photo' ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <SmartCapture
            cfg={aiCfg}
            day={todayKey()}
            category={photoCat}
            setCategory={setPhotoCat}
            showAdd
            showSaveProduct={false}
            showSaveDish={false}
          />
        </ScrollView>
      ) : (
        <>
          {!product && !err && (
        <View style={{ flex: 1 }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
            }}
            onBarcodeScanned={(r) => {
              if (r.data) lookup(r.data);
            }}
          />
          <View style={{ padding: 12, gap: 8 }}>
            {fetching && (
              <View style={{ alignItems: 'center', gap: 6 }}>
                <ActivityIndicator />
                <Text style={{ color: colors.text }}>Pobieram produkt…</Text>
              </View>
            )}
            <ManualCode
              manualCode={manualCode}
              setManualCode={setManualCode}
              onGo={() => lookup(manualCode)}
            />
          </View>
        </View>
      )}
      {err && !product && (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            gap: 10,
          }}>
          <Text style={{ fontSize: 48 }}>⚠️</Text>
          <Text style={{ textAlign: 'center', color: colors.text }}>{err}</Text>
          <Text
            style={{
              textAlign: 'center',
              color: colors.text,
              opacity: 0.65,
              fontSize: 13,
            }}>
            Tego kodu nie ma (jeszcze) w bazie Open Food Facts. Możesz dodać
            produkt inaczej:
          </Text>
          <TouchableOpacity
            onPress={() => {
              setErr(null);
              setProduct(null);
            }}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 10,
              padding: 12,
              paddingHorizontal: 24,
              marginTop: 4,
            }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              Skanuj ponownie
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              nav.navigate('AddMeal', { day: todayKey(), tab: 'search' })
            }
            style={{
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: 10,
              padding: 12,
              paddingHorizontal: 24,
            }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              🔍 Znajdź po nazwie
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              nav.navigate('AddMeal', { day: todayKey(), tab: 'label' })
            }
            style={{
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: 10,
              padding: 12,
              paddingHorizontal: 24,
            }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              🏷️ Zrób zdjęcie etykiety (AI)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => nav.navigate('Creator', {})}
            style={{ padding: 8 }}>
            <Text style={{ color: colors.text, opacity: 0.7 }}>
              …albo dodaj do mojej bazy
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {product && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {product.zdjecie ? (
              <Image
                source={{ uri: product.zdjecie }}
                style={{ width: 90, height: 90, borderRadius: 12 }}
              />
            ) : (
              <View
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: 12,
                  backgroundColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ fontSize: 36 }}>🍽️</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
                {product.nazwa}
              </Text>
              {product.kod && (
                <Text style={{ color: colors.text, opacity: 0.6, fontSize: 12 }}>
                  EAN: {product.kod}
                </Text>
              )}
              <Text style={{ color: colors.text, opacity: 0.75, fontSize: 12 }}>
                Na 100 g: {fmtKcal(product.kcal100)}
              </Text>
            </View>
          </View>
          <PortionPicker
            kcal100={product.kcal100}
            bialko100={product.bialko100}
            tluszcze100={product.tluszcze100}
            wegle100={product.wegle100}
            grams={grams}
            setGrams={setGrams}
            extraChips={[
              ...(product.opakowanieG
                ? [
                    {
                      label: `Całość (${product.opakowanieG} g)`,
                      grams: product.opakowanieG,
                    },
                  ]
                : []),
              ...(product.porcjaG &&
              product.porcjaG !== product.opakowanieG
                ? [
                    {
                      label: `1 porcja (${product.porcjaG} g)`,
                      grams: product.porcjaG,
                    },
                  ]
                : []),
            ]}
          />
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            Kategoria posiłku:
          </Text>
          <CategoryChips value={category} onChange={setCategory} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => {
                setProduct(null);
                setErr(null);
              }}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.primary,
                borderRadius: 12,
                padding: 14,
                alignItems: 'center',
              }}>
              <Text style={{ color: colors.primary, fontWeight: '800' }}>
                Skanuj dalej
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={save}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                borderRadius: 12,
                padding: 14,
                alignItems: 'center',
              }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Dodaj</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.text, opacity: 0.6, fontSize: 12 }}>
            {CATEGORIES[category]} • dziś
          </Text>
        </ScrollView>
      )}
        </>
      )}
    </View>
  );
}

function ManualCode({
  manualCode,
  setManualCode,
  onGo,
}: {
  manualCode: string;
  setManualCode: (t: string) => void;
  onGo: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <TextInput
        value={manualCode}
        onChangeText={setManualCode}
        placeholder="…lub wpisz kod EAN"
        placeholderTextColor={colors.text + '66'}
        keyboardType="numeric"
        onSubmitEditing={onGo}
        style={{
          flex: 1,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 12,
          color: colors.text,
          backgroundColor: colors.card,
        }}
      />
      <TouchableOpacity
        onPress={onGo}
        style={{
          backgroundColor: colors.primary,
          borderRadius: 10,
          paddingHorizontal: 18,
          justifyContent: 'center',
        }}>
        <Text style={{ color: '#fff', fontWeight: '800' }}>OK</Text>
      </TouchableOpacity>
    </View>
  );
}
