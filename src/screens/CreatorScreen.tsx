import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FavoriteRow, getDb } from '../db/database';
import { AiConfig } from '../lib/ai';
import { offErrorMessage, productByBarcode } from '../lib/off';
import { todayKey } from '../lib/format';
import { aiConfigOf, useStore } from '../store/useStore';
import { RootStackParamList } from '../nav';
import { ProductForm } from '../components/ProductForm';
import { SmartCapture } from '../components/SmartCapture';
import { TemplateForm } from '../components/TemplateForm';

type Props = NativeStackScreenProps<RootStackParamList, 'Creator'>;

/**
 * Kreator lokalnej bazy: produkty (ręcznie / kod / etykieta AI)
 * i dania (ręcznie / zdjęcie AI). Wszystko zapisywane na telefonie.
 */
export function CreatorScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const aiCfg: AiConfig = aiConfigOf({
    aiProvider: useStore((s) => s.aiProvider),
    aiKeys: useStore((s) => s.aiKeys),
    aiModels: useStore((s) => s.aiModels),
    apiKey: useStore((s) => s.apiKey),
  });
  const [kind, setKind] = useState<'produkt' | 'danie'>('produkt');
  const [source, setSource] = useState<'recznie' | 'kod' | 'etykieta'>(
    'recznie',
  );
  const [dishSource, setDishSource] = useState<'recznie' | 'zdjecie'>(
    'recznie',
  );
  const [editProduct, setEditProduct] = useState<FavoriteRow | null>(null);
  const [code, setCode] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [codeFound, setCodeFound] = useState<FavoriteRow | null>(null);

  const editId = route.params?.editProductId;

  useEffect(() => {
    if (editId == null) return;
    (async () => {
      try {
        const db = await getDb();
        const row = await db.getFirstAsync<FavoriteRow>(
          'SELECT * FROM favorites WHERE id = ?',
          [editId],
        );
        if (row) {
          setEditProduct(row);
          setKind('produkt');
          setSource('recznie');
        }
      } catch {
        /* ignoruj */
      }
    })();
  }, [editId]);

  const lookupCode = async () => {
    if (code.trim() === '') return;
    setCodeBusy(true);
    setCodeErr(null);
    setCodeFound(null);
    try {
      const p = await productByBarcode(code.trim());
      if (!p) {
        setCodeErr('Nie znaleziono produktu o tym kodzie w Open Food Facts.');
        return;
      }
      setCodeFound({
        id: -1,
        nazwa: p.nazwa,
        kcal100: p.kcal100,
        bialko100: p.bialko100,
        tluszcze100: p.tluszcze100,
        wegle100: p.wegle100,
        kod: p.kod,
        zdjecie: p.zdjecie,
        ulubione: 0,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      setCodeErr(offErrorMessage(e));
    } finally {
      setCodeBusy(false);
    }
  };

  const segBtn = (
    label: string,
    active: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={label}
      onPress={onPress}
      style={{
        flex: 1,
        padding: 10,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: active ? colors.primary : colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
      <Text
        style={{
          color: active ? '#fff' : colors.text,
          fontWeight: '700',
          fontSize: 13,
        }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {segBtn('🧃 Produkt', kind === 'produkt', () => setKind('produkt'))}
        {segBtn('🍲 Danie', kind === 'danie', () => setKind('danie'))}
      </View>

      {kind === 'produkt' ? (
        <>
          {!editProduct && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {segBtn('✏️ Ręcznie', source === 'recznie', () =>
                setSource('recznie'),
              )}
              {segBtn('🔖 Kod', source === 'kod', () => setSource('kod'))}
              {segBtn('🏷️ Etykieta', source === 'etykieta', () =>
                setSource('etykieta'),
              )}
            </View>
          )}
          {(source === 'recznie' || editProduct) && (
            <ProductForm
              initial={editProduct}
              onClose={() => navigation.goBack()}
              onSaved={() => navigation.goBack()}
            />
          )}
          {source === 'kod' && !editProduct && (
            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.text, opacity: 0.75 }}>
                Wpisz kod kreskowy (albo zeskanuj go w zakładce Skaner) —
                dane z Open Food Facts wypełnią formularz.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="np. 5901234567890"
                  placeholderTextColor={colors.text + '66'}
                  keyboardType="numeric"
                  onSubmitEditing={lookupCode}
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
                  onPress={lookupCode}
                  disabled={codeBusy}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 10,
                    paddingHorizontal: 18,
                    justifyContent: 'center',
                  }}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>
                    {codeBusy ? '…' : 'Szukaj'}
                  </Text>
                </TouchableOpacity>
              </View>
              {codeBusy && <ActivityIndicator />}
              {codeErr && <Text style={{ color: '#b71c1c' }}>{codeErr}</Text>}
              {codeFound && (
                <ProductForm
                  initial={codeFound}
                  onClose={() => setCodeFound(null)}
                  onSaved={() => navigation.goBack()}
                />
              )}
            </View>
          )}
          {source === 'etykieta' && !editProduct && (
            <SmartCapture
              cfg={aiCfg}
              day={todayKey()}
              category={4}
              setCategory={() => {}}
              showAdd={false}
              showSaveProduct
              showSaveDish={false}
              onDone={() => navigation.goBack()}
            />
          )}
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {segBtn('✏️ Ręcznie', dishSource === 'recznie', () =>
              setDishSource('recznie'),
            )}
            {segBtn('📸 Zdjęcie AI', dishSource === 'zdjecie', () =>
              setDishSource('zdjecie'),
            )}
          </View>
          {dishSource === 'recznie' ? (
            <TemplateForm
              onClose={() => navigation.goBack()}
              onSaved={() => navigation.goBack()}
            />
          ) : (
            <SmartCapture
              cfg={aiCfg}
              day={todayKey()}
              category={4}
              setCategory={() => {}}
              showAdd={false}
              showSaveProduct={false}
              showSaveDish
              onDone={() => navigation.goBack()}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}
