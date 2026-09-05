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
  const [cat, setCat] = useState(defaultCategory());

  const confirmAdd = async () => {
    const g = toDouble(grams, 0);
    if (g <= 0) {
      Alert.alert('Uwaga', 'Podaj gramaturę większą od zera.');
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

// ── Formularz produktu ───────────────────────────────────────

function ProductForm({
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
      };
      if (initial) await updateFavorite(initial.id, data);
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
        {initial ? 'Edytuj produkt' : 'Nowy produkt (wartości na 100 g)'}
      </Text>
      <TextInput value={nazwa} onChangeText={setNazwa} placeholder="Nazwa *" placeholderTextColor={colors.text + '66'} style={inputStyle} />
      <TextInput value={kcal} onChangeText={setKcal} placeholder="Kcal /100 g *" keyboardType="numeric" placeholderTextColor={colors.text + '66'} style={inputStyle} />
      <TextInput value={b} onChangeText={setB} placeholder="Białko /100 g" keyboardType="numeric" placeholderTextColor={colors.text + '66'} style={inputStyle} />
      <TextInput value={t} onChangeText={setT} placeholder="Tłuszcze /100 g" keyboardType="numeric" placeholderTextColor={colors.text + '66'} style={inputStyle} />
      <TextInput value={w} onChangeText={setW} placeholder="Węgle /100 g" keyboardType="numeric" placeholderTextColor={colors.text + '66'} style={inputStyle} />
      <TextInput value={kod} onChangeText={setKod} placeholder="Kod kreskowy (opcjonalnie)" placeholderTextColor={colors.text + '66'} style={inputStyle} />
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

function TemplateForm({
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
