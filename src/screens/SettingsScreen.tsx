import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { wipeAll } from '../db/database';
import { exportCsv, importCsv } from '../lib/csv';
import { AI_PROVIDERS, AiProviderId, listGoogleModels, providerInfo } from '../lib/ai';
import { offErrorMessage, searchOff } from '../lib/off';
import { useStore, ThemeChoice } from '../store/useStore';

export function SettingsScreen() {
  const { colors } = useTheme();
  const kcalGoal = useStore((s) => s.kcalGoal);
  const proteinGoal = useStore((s) => s.proteinGoal);
  const fatGoal = useStore((s) => s.fatGoal);
  const carbsGoal = useStore((s) => s.carbsGoal);
  const weightKg = useStore((s) => s.weightKg);
  const apiKey = useStore((s) => s.apiKey);
  const aiProvider = useStore((s) => s.aiProvider);
  const aiKeys = useStore((s) => s.aiKeys);
  const aiModels = useStore((s) => s.aiModels);
  const theme = useStore((s) => s.theme);
  const setGoals = useStore((s) => s.setGoals);
  const setWeight = useStore((s) => s.setWeight);
  const setAiProvider = useStore((s) => s.setAiProvider);
  const setAiKey = useStore((s) => s.setAiKey);
  const setAiModel = useStore((s) => s.setAiModel);
  const setTheme = useStore((s) => s.setTheme);
  const bump = useStore((s) => s.bump);

  const storedKeyFor = (p: AiProviderId): string => {
    const k = aiKeys[p] || '';
    if (k !== '') return k;
    // Zgodność wsteczna: wcześniej klucz Google trzymany był w polu apiKey.
    return p === 'google' ? apiKey : '';
  };

  const [key, setKey] = useState(storedKeyFor(aiProvider));
  const [model, setModel] = useState(aiModels[aiProvider] || '');
  const [showKey, setShowKey] = useState(false);

  const [kcal, setKcal] = useState(String(Math.round(kcalGoal)));
  const [prot, setProt] = useState(String(Math.round(proteinGoal)));
  const [fat, setFat] = useState(String(Math.round(fatGoal)));
  const [carbs, setCarbs] = useState(String(Math.round(carbsGoal)));
  const [weight, setWeightText] = useState(String(weightKg));
  const [busy, setBusy] = useState(false);
  const [wipeArmed, setWipeArmed] = useState(false);

  // Przeładowanie pól AI po zmianie dostawcy.
  useEffect(() => {
    setKey(storedKeyFor(aiProvider));
    setModel(aiModels[aiProvider] || '');
    setModels(null);
    setModelsErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiProvider]);

  const [models, setModels] = useState<string[] | null>(null);
  const [modelsBusy, setModelsBusy] = useState(false);
  const [modelsErr, setModelsErr] = useState<string | null>(null);
  const [netTest, setNetTest] = useState<string | null>(null);
  const [netBusy, setNetBusy] = useState(false);

  const fetchModels = async () => {
    const k = key.trim() !== '' ? key.trim() : storedKeyFor(aiProvider);
    setModelsBusy(true);
    setModelsErr(null);
    const r = await listGoogleModels(k);
    setModelsBusy(false);
    if (r.error) {
      setModelsErr(r.error);
      setModels(null);
      return;
    }
    setModels(r.models);
  };

  const runNetTest = async () => {
    setNetBusy(true);
    setNetTest('Sprawdzam…');
    const lines: string[] = [];
    try {
      const r = await searchOff('pepsi');
      lines.push(
        `✅ Open Food Facts: połączenie OK (przykładowy wynik: "${r[0]?.nazwa ?? '—'}")`,
      );
    } catch (e) {
      lines.push(`❌ Open Food Facts: ${offErrorMessage(e)}`);
    }
    if (aiProvider === 'google') {
      const k = key.trim() !== '' ? key.trim() : storedKeyFor(aiProvider);
      const m = await listGoogleModels(k);
      if (m.error) lines.push(`❌ Google AI: ${m.error}`);
      else
        lines.push(
          `✅ Google AI: klucz działa (dostępnych modeli: ${m.models.length})`,
        );
    } else {
      lines.push(
        `ℹ️ AI (${providerInfo(aiProvider).label}): ten test sprawdza tylko Google — działanie innego dostawcy widać przy analizie zdjęcia.`,
      );
    }
    setNetBusy(false);
    setNetTest(lines.join('\n'));
  };

  const num = (t: string, fb: number): number => {
    const n = parseFloat(t.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : fb;
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    color: colors.text,
    backgroundColor: colors.card,
  } as const;

  const cardStyle = {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  } as const;

  const saveGoals = () => {
    setGoals({
      kcal: num(kcal, 2000),
      protein: num(prot, 150),
      fat: num(fat, 65),
      carbs: num(carbs, 250),
    });
    setWeight(num(weight, 70));
    Alert.alert('Gotowe', 'Zapisano cele i wagę.');
  };

  const saveAi = () => {
    setAiKey(aiProvider, key);
    setAiModel(aiProvider, model);
    Alert.alert(
      'Gotowe',
      key.trim() === ''
        ? `Usunięto klucz (${providerInfo(aiProvider).label}).`
        : `Zapisano ustawienia AI (${providerInfo(aiProvider).label}).`,
    );
  };

  const doExport = async () => {
    setBusy(true);
    try {
      const uri = await exportCsv();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Eksport historii (CSV)',
        });
      } else {
        Alert.alert('Gotowe', `Zapisano plik:\n${uri}`);
      }
    } catch {
      Alert.alert('Błąd', 'Eksport nie powiódł się.');
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets[0]) return;
      setBusy(true);
      const count = await importCsv(picked.assets[0].uri);
      setBusy(false);
      bump();
      Alert.alert('Gotowe', `Zaimportowano ${count} wpisów.`);
    } catch {
      setBusy(false);
      Alert.alert('Błąd', 'Import nie powiódł się.');
    }
  };

  const doWipe = async () => {
    if (!wipeArmed) {
      setWipeArmed(true);
      setTimeout(() => setWipeArmed(false), 6000);
      return;
    }
    setWipeArmed(false);
    setBusy(true);
    try {
      await wipeAll();
      bump();
      Alert.alert('Gotowe', 'Wyczyszczono wszystkie dane.');
    } catch {
      Alert.alert('Błąd', 'Czyszczenie nie powiodło się.');
    } finally {
      setBusy(false);
    }
  };

  const themeRow = (value: ThemeChoice, label: string) => (
    <TouchableOpacity
      key={value}
      onPress={() => setTheme(value)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {theme === value && (
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.primary,
            }}
          />
        )}
      </View>
      <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
        Cele dzienne i waga
      </Text>
      <View style={cardStyle}>
        <Text style={{ color: colors.text }}>Cel kaloryczny (kcal)</Text>
        <TextInput value={kcal} onChangeText={setKcal} keyboardType="numeric" style={inputStyle} />
        <Text style={{ color: colors.text }}>
          Waga ciała (kg) — do wyliczania spalonych kcal
        </Text>
        <TextInput value={weight} onChangeText={setWeightText} keyboardType="numeric" style={inputStyle} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, marginBottom: 4 }}>Białko (g)</Text>
            <TextInput value={prot} onChangeText={setProt} keyboardType="numeric" style={inputStyle} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, marginBottom: 4 }}>Tłuszcze (g)</Text>
            <TextInput value={fat} onChangeText={setFat} keyboardType="numeric" style={inputStyle} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, marginBottom: 4 }}>Węgle (g)</Text>
            <TextInput value={carbs} onChangeText={setCarbs} keyboardType="numeric" style={inputStyle} />
          </View>
        </View>
        <TouchableOpacity
          onPress={saveGoals}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            padding: 13,
            alignItems: 'center',
          }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Zapisz cele</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
        Sztuczna inteligencja (zdjęcia)
      </Text>
      <View style={cardStyle}>
        <Text style={{ color: colors.text, opacity: 0.75, fontSize: 13 }}>
          Wybierz dostawcę AI do rozpoznawania posiłków i etykiet. Klucze
          przechowywane są tylko na tym telefonie.
        </Text>
        {AI_PROVIDERS.map((p) => {
          const active = aiProvider === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => setAiProvider(p.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                paddingVertical: 6,
              }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: 2,
                  borderColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}>
                {active && (
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: colors.primary,
                    }}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 15,
                    fontWeight: active ? '800' : '400',
                  }}>
                  {p.label}
                </Text>
                <Text
                  style={{ color: colors.text, opacity: 0.6, fontSize: 12 }}>
                  {p.hint}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <Text style={{ color: colors.text, opacity: 0.75, fontSize: 13 }}>
          Klucz dla {providerInfo(aiProvider).label}:{' '}
          {providerInfo(aiProvider).keyUrl}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={key}
            onChangeText={setKey}
            secureTextEntry={!showKey}
            placeholder="Wklej klucz API…"
            placeholderTextColor={colors.text + '66'}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ ...inputStyle, flex: 1 }}
          />
          <TouchableOpacity
            onPress={() => setShowKey((v) => !v)}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              justifyContent: 'center',
            }}>
            <Text style={{ fontSize: 18 }}>{showKey ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: colors.text, marginTop: 2 }}>
          Model (pusty = domyślny: {providerInfo(aiProvider).defaultModel})
        </Text>
        <TextInput
          value={model}
          onChangeText={setModel}
          placeholder={providerInfo(aiProvider).defaultModel}
          placeholderTextColor={colors.text + '66'}
          autoCapitalize="none"
          autoCorrect={false}
          style={inputStyle}
        />
        {aiProvider === 'google' && (
          <>
            <TouchableOpacity
              onPress={fetchModels}
              disabled={modelsBusy}
              style={{
                borderWidth: 1,
                borderColor: colors.primary,
                borderRadius: 12,
                padding: 13,
                alignItems: 'center',
              }}>
              <Text style={{ color: colors.primary, fontWeight: '800' }}>
                {modelsBusy
                  ? 'Pobieram…'
                  : '🔍 Pobierz listę modeli z Google'}
              </Text>
            </TouchableOpacity>
            {modelsErr && (
              <Text style={{ color: '#b71c1c' }}>{modelsErr}</Text>
            )}
            {(models ?? []).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setModel(m)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 6,
                }}>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    borderWidth: 2,
                    borderColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {(model.trim() === m ||
                    (model.trim() === '' &&
                      m === providerInfo(aiProvider).defaultModel)) && (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: colors.primary,
                      }}
                    />
                  )}
                </View>
                <Text style={{ color: colors.text, flex: 1 }}>{m}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
        <TouchableOpacity
          onPress={saveAi}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            padding: 13,
            alignItems: 'center',
          }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Zapisz ustawienia AI</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
        Wygląd
      </Text>
      <View style={cardStyle}>
        {themeRow('system', 'Systemowy')}
        {themeRow('light', 'Jasny')}
        {themeRow('dark', 'Ciemny')}
      </View>

      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
        Połączenie
      </Text>
      <View style={cardStyle}>
        <Text style={{ color: colors.text, opacity: 0.75, fontSize: 13 }}>
          Sprawdza, czy telefon łączy się z Open Food Facts (i z Google AI,
          jeśli jest wybrane).
        </Text>
        <TouchableOpacity
          onPress={runNetTest}
          disabled={netBusy}
          style={{
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: 12,
            padding: 13,
            alignItems: 'center',
          }}>
          <Text style={{ color: colors.primary, fontWeight: '800' }}>
            {netBusy ? 'Sprawdzam…' : '🔌 Testuj połączenie'}
          </Text>
        </TouchableOpacity>
        {netTest && (
          <Text style={{ color: colors.text, fontSize: 13 }}>{netTest}</Text>
        )}
      </View>

      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
        Dane
      </Text>
      <View style={cardStyle}>
        <TouchableOpacity
          onPress={doExport}
          disabled={busy}
          style={{ paddingVertical: 8 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
            ⬇️ Eksportuj do CSV
          </Text>
          <Text style={{ color: colors.text, opacity: 0.6, fontSize: 12 }}>
            Cała historia posiłków do pliku
          </Text>
        </TouchableOpacity>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <TouchableOpacity
          onPress={doImport}
          disabled={busy}
          style={{ paddingVertical: 8 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
            ⬆️ Importuj z CSV
          </Text>
          <Text style={{ color: colors.text, opacity: 0.6, fontSize: 12 }}>
            Wczytaj historię z pliku CSV
          </Text>
        </TouchableOpacity>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <TouchableOpacity
          onPress={doWipe}
          disabled={busy}
          style={{ paddingVertical: 8 }}>
          <Text style={{ color: '#e53935', fontSize: 15, fontWeight: '700' }}>
            🗑️ {wipeArmed ? 'Stuknij PONOWNIE, aby potwierdzić!' : 'Wyczyść wszystkie dane'}
          </Text>
          <Text style={{ color: colors.text, opacity: 0.6, fontSize: 12 }}>
            Usuwa historię, ulubione i szablony
          </Text>
        </TouchableOpacity>
        {busy && <ActivityIndicator />}
      </View>
      <Text
        style={{
          textAlign: 'center',
          color: colors.text,
          opacity: 0.5,
          fontSize: 12,
        }}>
        Kalorie v1.0.0 (Expo) • dane tylko na tym urządzeniu
      </Text>
    </ScrollView>
  );
}
