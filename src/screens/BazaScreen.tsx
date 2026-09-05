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
import { insertMeal } from '../db/meals';
import {
  deleteFavorite,
  listFavorites,
  searchFavorites,
  toggleStar,
} from '../db/favorites';
import {
  deleteTemplate,
  listTemplates,
  TemplateWithItems,
} from '../db/templates';
import {
  CATEGORIES,
  SOURCE_API,
  SOURCE_TEMPLATE,
} from '../lib/constants';
import { fmtG, fmtKcal, scaleMacros, toDouble, todayKey } from '../lib/format';
import { useStore } from '../store/useStore';
import { RootStackParamList, TabParamList } from '../nav';
import { CategoryChips } from '../components/CategoryChips';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Baza'>,
  NativeStackScreenProps<RootStackParamList>
>;

function defaultCategory(): number {
  const h = new Date().getHours();
  if (h < 10) return 0;
  if (h < 13) return 1;
  if (h < 16) return 2;
  if (h < 21) return 3;
  return 4;
}

/**
 * Moja baza: lokalne produkty i dania.
 * Szybkie dodawanie z gramaturą (np. 150 g Snickersa) + tworzenie nowych.
 */
export function BazaScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const tick = useStore((s) => s.tick);
  const bump = useStore((s) => s.bump);
  const [q, setQ] = useState('');
  const [products, setProducts] = useState<FavoriteRow[]>([]);
  const [dishes, setDishes] = useState<TemplateWithItems[]>([]);
  const [addCat, setAddCat] = useState(defaultCategory());
  const [dishCat, setDishCat] = useState(defaultCategory());

  const load = React.useCallback(async () => {
    try {
      const p =
        q.trim() === '' ? await listFavorites() : await searchFavorites(q);
      setProducts(p);
      const t = await listTemplates();
      const needle = q.trim().toLowerCase();
      setDishes(
        needle === ''
          ? t
          : t.filter((d) => d.nazwa.toLowerCase().includes(needle)),
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

  const quickAddProduct = async (f: FavoriteRow, grams: number) => {
    if (!(grams > 0)) {
      Alert.alert('Uwaga', 'Podaj gramaturę większą od zera.');
      return;
    }
    const s = scaleMacros(
      f.kcal100,
      f.bialko100,
      f.tluszcze100,
      f.wegle100,
      grams,
    );
    try {
      await insertMeal({
        nazwa: f.nazwa,
        kcal: s.kcal,
        bialko: s.bialko,
        tluszcze: s.tluszcze,
        wegle: s.wegle,
        waga: grams,
        kategoria: addCat,
        dzien: todayKey(),
        zrodlo: SOURCE_API,
      });
      bump();
      Alert.alert(
        'Gotowe',
        `Dodano: ${f.nazwa} (${Math.round(grams)} g, ${CATEGORIES[addCat]})`,
      );
    } catch {
      Alert.alert('Błąd', 'Nie udało się dodać.');
    }
  };

  const quickAddDish = async (t: TemplateWithItems) => {
    try {
      await insertMeal({
        nazwa: t.nazwa,
        kcal: t.kcal,
        bialko: t.bialko,
        tluszcze: t.tluszcze,
        wegle: t.wegle,
        waga: t.waga,
        kategoria: dishCat,
        dzien: todayKey(),
        zrodlo: SOURCE_TEMPLATE,
      });
      bump();
      Alert.alert(
        'Gotowe',
        `Dodano: ${t.nazwa} (${CATEGORIES[dishCat]})`,
      );
    } catch {
      Alert.alert('Błąd', 'Nie udało się dodać.');
    }
  };

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

  const removeDish = (t: TemplateWithItems) => {
    Alert.alert('Usunąć danie?', `„${t.nazwa}” zostanie usunięte.`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTemplate(t.id);
            bump();
            load();
          } catch {
            Alert.alert('Błąd', 'Nie udało się usunąć.');
          }
        },
      },
    ]);
  };

  const doStar = async (f: FavoriteRow) => {
    try {
      await toggleStar(f.id, f.ulubione);
      bump();
      load();
    } catch {
      Alert.alert('Błąd', 'Nie udało się zapisać gwiazdki.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Szukaj w mojej bazie (np. snickers)"
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
            marginBottom: 8,
          }}>
          Wszystko poniżej jest zapisane na telefonie — działa bez internetu.
        </Text>

        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
          🧃 Moje produkty ({products.length})
        </Text>
        <Text
          style={{
            color: colors.text,
            fontWeight: '600',
            fontSize: 13,
            marginTop: 6,
          }}>
          Kategoria dodawania:
        </Text>
        <View style={{ marginVertical: 6 }}>
          <CategoryChips value={addCat} onChange={setAddCat} />
        </View>
        {products.length === 0 && (
          <Text style={{ color: colors.text, opacity: 0.6, marginVertical: 8 }}>
            Brak produktów. Stuknij ＋ i dodaj pierwszy (ręcznie, kodem,
            etykietą…).
          </Text>
        )}
        {products.map((f) => (
          <BazaProductRow
            key={f.id}
            f={f}
            onAdd={quickAddProduct}
            onStar={() => doStar(f)}
            onEdit={() =>
              navigation.navigate('Creator', { editProductId: f.id })
            }
            onDelete={() => removeProduct(f)}
          />
        ))}

        <Text
          style={{
            fontSize: 17,
            fontWeight: '800',
            color: colors.text,
            marginTop: 16,
          }}>
          🍲 Moje dania ({dishes.length})
        </Text>
        <Text
          style={{
            color: colors.text,
            fontWeight: '600',
            fontSize: 13,
            marginTop: 6,
          }}>
          Kategoria dodawania:
        </Text>
        <View style={{ marginVertical: 6 }}>
          <CategoryChips value={dishCat} onChange={setDishCat} />
        </View>
        {dishes.length === 0 && (
          <Text style={{ color: colors.text, opacity: 0.6, marginVertical: 8 }}>
            Brak dań. Stuknij ＋ i stwórz danie (ręcznie lub ze zdjęcia AI).
          </Text>
        )}
        {dishes.map((t) => (
          <View
            key={t.id}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 10,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
            <Text style={{ fontWeight: '700', color: colors.text }}>
              {t.nazwa}
            </Text>
            <Text
              style={{ fontSize: 12, color: colors.text, opacity: 0.7 }}>
              {fmtKcal(t.kcal)} • {t.items.length} składników • B:
              {fmtG(t.bialko)} T:{fmtG(t.tluszcze)} W:{fmtG(t.wegle)}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => quickAddDish(t)}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 8,
                  padding: 8,
                  paddingHorizontal: 16,
                }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  Dodaj do dziś
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removeDish(t)}
                style={{
                  borderWidth: 1,
                  borderColor: '#e53935',
                  borderRadius: 8,
                  padding: 8,
                  paddingHorizontal: 14,
                }}>
                <Text style={{ color: '#e53935' }}>Usuń</Text>
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

function BazaProductRow({
  f,
  onAdd,
  onStar,
  onEdit,
  onDelete,
}: {
  f: FavoriteRow;
  onAdd: (f: FavoriteRow, grams: number) => void;
  onStar: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const [grams, setGrams] = useState('100');
  return (
    <View
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
          <Text style={{ fontWeight: '700', color: colors.text }} numberOfLines={2}>
            {f.nazwa}
          </Text>
          <Text style={{ fontSize: 12, color: colors.text, opacity: 0.7 }}>
            {fmtKcal(f.kcal100)} /100 g • B:{f.bialko100.toFixed(1)}g T:
            {f.tluszcze100.toFixed(1)}g W:{f.wegle100.toFixed(1)}g
          </Text>
        </View>
        <TouchableOpacity onPress={onStar} style={{ padding: 2 }}>
          <Text style={{ fontSize: 22 }}>
            {f.ulubione === 1 ? '⭐' : '☆'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <TextInput
          value={grams}
          onChangeText={setGrams}
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
        <TouchableOpacity
          onPress={() => onAdd(f, toDouble(grams, 0))}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 8,
            padding: 9,
            paddingHorizontal: 16,
          }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Zjadłem</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onEdit} style={{ padding: 6 }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Edytuj</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={{ padding: 6 }}>
          <Text style={{ color: '#e53935' }}>Usuń</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
