import React, { useState } from 'react';
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
import { useStore, ThemeChoice } from '../store/useStore';

export function SettingsScreen() {
  const { colors } = useTheme();
  const kcalGoal = useStore((s) => s.kcalGoal);
  const proteinGoal = useStore((s) => s.proteinGoal);
  const fatGoal = useStore((s) => s.fatGoal);
  const carbsGoal = useStore((s) => s.carbsGoal);
  const apiKey = useStore((s) => s.apiKey);
  const theme = useStore((s) => s.theme);
  const setGoals = useStore((s) => s.setGoals);
  const setApiKey = useStore((s) => s.setApiKey);
  const setTheme = useStore((s) => s.setTheme);
  const bump = useStore((s) => s.bump);

  const [kcal, setKcal] = useState(String(Math.round(kcalGoal)));
  const [prot, setProt] = useState(String(Math.round(proteinGoal)));
  const [fat, setFat] = useState(String(Math.round(fatGoal)));
  const [carbs, setCarbs] = useState(String(Math.round(carbsGoal)));
  const [key, setKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wipeArmed, setWipeArmed] = useState(false);

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
    Alert.alert('Gotowe', 'Zapisano cele.');
  };

  const saveKey = () => {
    setApiKey(key);
    Alert.alert(
      'Gotowe',
      key.trim() === '' ? 'Usunięto klucz API.' : 'Zapisano klucz API.',
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
        Cele dzienne
      </Text>
      <View style={cardStyle}>
        <Text style={{ color: colors.text }}>Cel kaloryczny (kcal)</Text>
        <TextInput value={kcal} onChangeText={setKcal} keyboardType="numeric" style={inputStyle} />
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
        Gemini AI (klucz API)
      </Text>
      <View style={cardStyle}>
        <Text style={{ color: colors.text, opacity: 0.75, fontSize: 13 }}>
          Klucz znajdziesz w Google AI Studio (aistudio.google.com → Get API
          key). Przechowywany jest tylko na tym telefonie.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={key}
            onChangeText={setKey}
            secureTextEntry={!showKey}
            placeholder="AIza…"
            placeholderTextColor={colors.text + '66'}
            autoCapitalize="none"
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
        <TouchableOpacity
          onPress={saveKey}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            padding: 13,
            alignItems: 'center',
          }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Zapisz klucz</Text>
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
