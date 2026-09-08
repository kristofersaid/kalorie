import React, { useEffect, useState } from 'react';
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
import { useTheme, useFocusEffect } from '@react-navigation/native';
import { FavoriteRow } from '../db/database';
import {
  deleteFavorite,
  insertFavorite,
  listFavorites,
  searchFavorites,
  toggleStar,
  updateFavorite,
} from '../db/favorites';
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  TemplateItemInput,
  TemplateWithItems,
} from '../db/templates';
import { insertMeal } from '../db/meals';
import {
  CATEGORIES,
  SOURCE_API,
  SOURCE_TEMPLATE,
} from '../lib/constants';
import { fmtG, fmtKcal, scaleMacros, toDouble, todayKey } from '../lib/format';
import { choosePhoto } from '../lib/photo';
import { useStore } from '../store/useStore';
import { CategoryChips } from '../components/CategoryChips';
import { ProductForm } from '../components/ProductForm';
import { TemplateForm } from '../components/TemplateForm';

function defaultCategory(): number {
  const h = new Date().getHours();
  if (h < 10) return 0;
  if (h < 13) return 1;
  if (h < 16) return 2;
  if (h < 21) return 3;
  return 4;
}

export function FavoritesScreen() {
  const { colors } = useTheme();
  const tick = useStore((s) => s.tick);
  const bump = useStore((s) => s.bump);
  const [mode, setMode] = useState<'prod' | 'tmpl'>('prod');
  const [q, setQ] = useState('');
  const [products, setProducts] = useState<FavoriteRow[]>([]);
  const [templates, setTemplates] = useState<TemplateWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProdForm, setShowProdForm] = useState(false);
  const [editingProd, setEditingProd] = useState<FavoriteRow | null>(null);
  const [showTmplForm, setShowTmplForm] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [p, t] = await Promise.all([
        q.trim() === '' ? listFavorites() : searchFavorites(q),
        listTemplates(),
      ]);
      setProducts(p);
      setTemplates(t);
    } catch {
      Alert.alert('Błąd', 'Nie udało się wczytać zapisanych.');
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load, tick]);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

  const doToggleStar = async (f: FavoriteRow) => {
    try {
      await toggleStar(f.id, f.ulubione);
      bump();
      load();
    } catch {
      Alert.alert('Błąd', 'Nie udało się zapisać gwiazdki.');
    }
  };

  const doDeleteProd = (f: FavoriteRow) => {
    Alert.alert('Usunąć produkt?', `„${f.nazwa}” zniknie z zapisanych.`, [
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
      <View style={{ flexDirection: 'row', padding: 12, gap: 8 }}>
        {(
          [
            ['prod', '⭐ Produkty'],
            ['tmpl', '🍲 Szablony'],
          ] as ['prod' | 'tmpl', string][]
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

      {mode === 'prod' && (
        <View style={{ paddingHorizontal: 12 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Szukaj w zapisanych"
            placeholderTextColor={colors.text + '66'}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              padding: 12,
              color: colors.text,
              backgroundColor: colors.card,
            }}
          />
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : mode === 'prod' ? (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 100 }}>
          {showProdForm || editingProd ? (
            <ProductForm
              initial={editingProd}
              onClose={() => {
                setShowProdForm(false);
                setEditingProd(null);
              }}
              onSaved={() => {
                setShowProdForm(false);
                setEditingProd(null);
                bump();
                load();
              }}
            />
          ) : (
            <TouchableOpacity
              onPress={() => setShowProdForm(true)}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 12,
                padding: 13,
                alignItems: 'center',
                marginBottom: 10,
              }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>
                + Dodaj własny produkt (na 100 g)
              </Text>
            </TouchableOpacity>
          )}
          {products.length === 0 && !showProdForm && !editingProd && (
            <Text
              style={{
                textAlign: 'center',
                color: colors.text,
                opacity: 0.6,
                marginTop: 24,
              }}>
              Brak zapisanych produktów.{'\n'}Produkty z wyszukiwarki i skanera
              zapisują się tu automatycznie.
            </Text>
          )}
          {products.map((f) => (
            <ProductTile
              key={f.id}
              f={f}
              onStar={() => doToggleStar(f)}
              onEdit={() => setEditingProd(f)}
              onDelete={() => doDeleteProd(f)}
              onAdded={() => {
                bump();
                load();
              }}
            />
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 100 }}>
          {showTmplForm ? (
            <TemplateForm
              onClose={() => setShowTmplForm(false)}
              onSaved={() => {
                setShowTmplForm(false);
                bump();
                load();
              }}
            />
          ) : (
            <TouchableOpacity
              onPress={() => setShowTmplForm(true)}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 12,
                padding: 13,
                alignItems: 'center',
                marginBottom: 10,
              }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>
                + Nowy szablon (np. Moja owsianka)
              </Text>
            </TouchableOpacity>
          )}
          {templates.length === 0 && !showTmplForm && (
            <Text
              style={{
                textAlign: 'center',
                color: colors.text,
                opacity: 0.6,
                marginTop: 24,
              }}>
              Brak szablonów. Stwórz np. „Moja owsianka”, aby dodawać ją jednym
              stuknięciem.
            </Text>
          )}
          {templates.map((t) => (
            <TemplateTile
              key={t.id}
              t={t}
              expanded={expanded === t.id}
              onToggle={() => setExpanded(expanded === t.id ? null : t.id)}
              onDeleted={() => {
                bump();
                load();
              }}
              onAdded={() => {
                bump();
                load();
              }}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ── Kafelek produktu ─────────────────────────────────────────

function ProductTile({
  f,
  onStar,
  onEdit,
  onDelete,
  onAdded,
}: {
  f: FavoriteRow;
  onStar: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAdded: () => void;
}) {
  const { colors } = useTheme();
  const [adding, setAdding] = useState(false);
  const [grams, setGrams] = useState('100');
  // Startowa kategoria z bazy (np. Mars → Przekąski), do ręcznej zmiany.
  const [cat, setCat] = useState(
    f.kategoria >= 0 && f.kategoria < CATEGORIES.length
      ? f.kategoria
      : defaultCategory(),
  );

  const confirmAdd = async () => {
    const g = toDouble(grams, 0);
    if (!(g >= 0)) {
      Alert.alert('Uwaga', 'Podaj gramaturę (liczbę nieujemną).');
      return;
    }
    const s = scaleMacros(f.kcal100, f.bialko100, f.tluszcze100, f.wegle100, g);
    try {
      await insertMeal({
        nazwa: f.nazwa,
        kcal: s.kcal,
        bialko: s.bialko,
        tluszcze: s.tluszcze,
        wegle: s.wegle,
        waga: g,
        kategoria: cat,
        dzien: todayKey(),
        zrodlo: SOURCE_API,
        zdjecie: f.zdjecie ?? null,
      });
      setAdding(false);
      Alert.alert('Gotowe', `Dodano: ${f.nazwa}`);
      onAdded();
    } catch {
      Alert.alert('Błąd', 'Nie udało się dodać.');
    }
  };

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
          <Image source={{ uri: f.zdjecie }} style={{ width: 48, height: 48, borderRadius: 8 }} />
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
            {fmtKcal(f.kcal100)} /100 g
            {`\nB:${f.bialko100.toFixed(1)}g T:${f.tluszcze100.toFixed(1)}g W:${f.wegle100.toFixed(1)}g`}
          </Text>
        </View>
        <TouchableOpacity onPress={onStar} style={{ padding: 4 }}>
          <Text style={{ fontSize: 24 }}>{f.ulubione === 1 ? '⭐' : '☆'}</Text>
        </TouchableOpacity>
      </View>
      {adding ? (
        <View style={{ marginTop: 8, gap: 8 }}>
          {f.opakowanie_g != null && f.opakowanie_g > 0 && (
            <TouchableOpacity
              onPress={() => setGrams(String(Math.round(f.opakowanie_g as number)))}
              style={{
                alignSelf: 'flex-start',
                backgroundColor: '#2e7d32',
                borderRadius: 14,
                paddingVertical: 6,
                paddingHorizontal: 14,
              }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                Całość ({Math.round(f.opakowanie_g as number)} g)
              </Text>
            </TouchableOpacity>
          )}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput
              value={grams}
              onChangeText={setGrams}
              keyboardType="numeric"
              placeholder="gramy"
              placeholderTextColor={colors.text + '66'}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 8,
                color: colors.text,
              }}
            />
            <TouchableOpacity
              onPress={confirmAdd}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 8,
                padding: 10,
                paddingHorizontal: 18,
              }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Dodaj</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAdding(false)}>
              <Text style={{ color: colors.text, opacity: 0.6 }}>Anuluj</Text>
            </TouchableOpacity>
          </View>
          <CategoryChips value={cat} onChange={setCat} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TouchableOpacity
            onPress={() => {
              setGrams('100');
              // Odśwież kategorię z bazy przy każdym otwarciu.
              setCat(
                f.kategoria >= 0 && f.kategoria < CATEGORIES.length
                  ? f.kategoria
                  : defaultCategory(),
              );
              setAdding(true);
            }}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 8,
              padding: 8,
              paddingHorizontal: 14,
            }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Dodaj do dziś</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onEdit}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 8,
              paddingHorizontal: 14,
            }}>
            <Text style={{ color: colors.text }}>Edytuj</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
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
      )}
    </View>
  );
}

// ── Szablony ─────────────────────────────────────────────────

function TemplateTile({
  t,
  expanded,
  onToggle,
  onDeleted,
  onAdded,
}: {
  t: TemplateWithItems;
  expanded: boolean;
  onToggle: () => void;
  onDeleted: () => void;
  onAdded: () => void;
}) {
  const { colors } = useTheme();
  const [cat, setCat] = useState(defaultCategory());

  const remove = () => {
    Alert.alert('Usunąć szablon?', `„${t.nazwa}” zostanie usunięty.`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTemplate(t.id);
            onDeleted();
          } catch {
            Alert.alert('Błąd', 'Nie udało się usunąć szablonu.');
          }
        },
      },
    ]);
  };

  const addToday = async () => {
    try {
      await insertMeal({
        nazwa: t.nazwa,
        kcal: t.kcal,
        bialko: t.bialko,
        tluszcze: t.tluszcze,
        wegle: t.wegle,
        waga: t.waga,
        kategoria: cat,
        dzien: todayKey(),
        zrodlo: SOURCE_TEMPLATE,
      });
      Alert.alert('Gotowe', `Dodano szablon: ${t.nazwa} (${CATEGORIES[cat]})`);
      onAdded();
    } catch {
      Alert.alert('Błąd', 'Nie udało się dodać szablonu.');
    }
  };

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
      <TouchableOpacity onPress={onToggle}>
        <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>
          {expanded ? '▾' : '▸'} {t.nazwa}
        </Text>
        <Text style={{ color: colors.text, opacity: 0.7, fontSize: 13 }}>
          {fmtKcal(t.kcal)} • {t.items.length} składników • B:{fmtG(t.bialko)}{' '}
          T:{fmtG(t.tluszcze)} W:{fmtG(t.wegle)}
        </Text>
      </TouchableOpacity>
      {expanded && (
        <View style={{ marginTop: 8, gap: 8 }}>
          {t.items.map((it) => (
            <View
              key={it.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text }}>
                {it.nazwa} ({Math.round(it.waga)} g)
              </Text>
              <Text style={{ color: colors.text, opacity: 0.7 }}>
                {fmtKcal(it.kcal)}
              </Text>
            </View>
          ))}
          <Text style={{ color: colors.text, fontWeight: '600' }}>Kategoria:</Text>
          <CategoryChips value={cat} onChange={setCat} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={remove}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#e53935',
                borderRadius: 8,
                padding: 10,
                alignItems: 'center',
              }}>
              <Text style={{ color: '#e53935', fontWeight: '700' }}>Usuń</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={addToday}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                borderRadius: 8,
                padding: 10,
                alignItems: 'center',
              }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                Dodaj do dziś
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
