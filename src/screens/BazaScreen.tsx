import React, { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CompositeScreenProps,
  useFocusEffect,
  useTheme,
} from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FavoriteRow } from '../db/database';
import {
  deleteFavorite,
  listFavorites,
  searchFavorites,
} from '../db/favorites';
import { fmtKcal } from '../lib/format';
import { CATEGORIES } from '../lib/constants';
import { useStore } from '../store/useStore';
import { RootStackParamList, TabParamList } from '../nav';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Baza'>,
  NativeStackScreenProps<RootStackParamList>
>;

/**
 * Moja baza: lokalne wpisy (produkty i potrawy, wszystko na 100 g).
 * Tylko przeglądanie, edycja i usuwanie.
 * Dodawanie „zjadłem” odbywa się z poziomu posiłków (Start / Skaner).
 */
export function BazaScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const tick = useStore((s) => s.tick);
  const bump = useStore((s) => s.bump);
  const [q, setQ] = useState('');
  const [products, setProducts] = useState<FavoriteRow[]>([]);

  const load = React.useCallback(async () => {
    try {
      setProducts(
        q.trim() === '' ? await listFavorites() : await searchFavorites(q),
      );
    } catch {
      Alert.alert('Błąd', 'Nie udało się wczytać bazy.');
    }
  }, [q]);

  React.useEffect(() => {
    load();
  }, [load, tick]);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

  const removeProduct = (f: FavoriteRow) => {
    Alert.alert('Usunąć?', `„${f.nazwa}” zniknie z bazy.`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFavorite(f.id);
            bump();
            load();
          } catch {
            Alert.alert('Błąd', 'Nie udało się usunąć.');
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Szukaj w mojej bazie"
          placeholderTextColor={colors.text + '66'}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            padding: 12,
            color: colors.text,
            backgroundColor: colors.card,
            marginBottom: 4,
          }}
        />
        <Text
          style={{
            color: colors.text,
            opacity: 0.6,
            fontSize: 12,
            marginBottom: 12,
          }}>
          {products.length} zapisanych • wszystko na tym telefonie (offline).
        </Text>
        {products.length === 0 && (
          <Text
            style={{
              textAlign: 'center',
              color: colors.text,
              opacity: 0.6,
              marginTop: 24,
            }}>
            Baza pusta. Stuknij „＋ Nowy”, aby dodać pierwszy wpis.
          </Text>
        )}
        {products.map((f) => (
          <View
            key={f.id}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 10,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {f.zdjecie ? (
                <Image
                  source={{ uri: f.zdjecie }}
                  style={{ width: 48, height: 48, borderRadius: 8 }}
                />
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
                <Text
                  style={{ fontWeight: '700', color: colors.text }}
                  numberOfLines={2}>
                  {f.nazwa}
                </Text>
                <Text
                  style={{ fontSize: 12, color: colors.text, opacity: 0.7 }}>
                  {fmtKcal(f.kcal100)} /100 g • B:{f.bialko100.toFixed(1)}g T:
                  {f.tluszcze100.toFixed(1)}g W:{f.wegle100.toFixed(1)}g
                  {f.kod ? ` • EAN: ${f.kod}` : ''}
                  {f.opakowanie_g != null && f.opakowanie_g > 0
                    ? ` • opak.: ${Math.round(f.opakowanie_g)} g`
                    : ''}
                  {f.sztuka_g != null && f.sztuka_g > 0
                    ? ` • 1 szt.: ${f.sztuka_g} g`
                    : ''}
                  {`\nZwykle: ${CATEGORIES[f.kategoria] ?? CATEGORIES[4]}`}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('Creator', { editProductId: f.id })
                }
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  borderRadius: 8,
                  padding: 9,
                  alignItems: 'center',
                }}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  Edytuj
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removeProduct(f)}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#e53935',
                  borderRadius: 8,
                  padding: 9,
                  alignItems: 'center',
                }}>
                <Text style={{ color: '#e53935', fontWeight: '700' }}>
                  Usuń
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
      <TouchableOpacity
        onPress={() => navigation.navigate('Creator', {})}
        style={{
          position: 'absolute',
          right: 20,
          bottom: 24,
          backgroundColor: colors.primary,
          borderRadius: 28,
          paddingVertical: 14,
          paddingHorizontal: 22,
          elevation: 4,
        }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
          ＋ Nowy
        </Text>
      </TouchableOpacity>
    </View>
  );
}
