import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { FavoriteRow, getDb } from '../db/database';
import { insertFavorite, updateFavorite } from '../db/favorites';
import { AiConfig, analyzeImage, analyzeLabel } from '../lib/ai';
import { fmtKcal, toDouble } from '../lib/format';
import { offErrorMessage, productByBarcode } from '../lib/off';
import { choosePhoto } from '../lib/photo';
import { aiConfigOf, useStore } from '../store/useStore';
import { RootStackParamList } from '../nav';
import { CategoryChips } from '../components/CategoryChips';

type Props = NativeStackScreenProps<RootStackParamList, 'Creator'>;

/**
 * Kreator wpisu do lokalnej bazy — JEDEN formularz na wszystko.
 * Sekcja 1: nazwa + wartości na 100 g (ręcznie / foto tabeli / foto posiłku).
 * Sekcja 2: kod kreskowy (wpisany lub zeskanowany).
 * Sekcja 3: zdjęcie produktu.
 */
export function CreatorScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const aiCfg: AiConfig = aiConfigOf({
    aiProvider: useStore((s) => s.aiProvider),
    aiKeys: useStore((s) => s.aiKeys),
    aiModels: useStore((s) => s.aiModels),
    apiKey: useStore((s) => s.apiKey),
  });
  const [camPerm, requestCamPerm] = useCameraPermissions();

  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [b, setB] = useState('');
  const [t, setT] = useState('');
  const [w, setW] = useState('');
  const [code, setCode] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [totalW, setTotalW] = useState('');
  const [defCat, setDefCat] = useState(4);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const scanLock = useRef(false);

  useEffect(() => {
    const id = route.params?.editProductId;
    if (id == null) return;
    (async () => {
      try {
        const db = await getDb();
        const row = await db.getFirstAsync<FavoriteRow>(
          'SELECT * FROM favorites WHERE id = ?',
          [id],
        );
        if (row) {
          setEditId(row.id);
          setName(row.nazwa);
          setKcal(String(row.kcal100));
          setB(String(row.bialko100));
          setT(String(row.tluszcze100));
          setW(String(row.wegle100));
          setCode(row.kod ?? '');
          setPhoto(row.zdjecie ?? null);
          setDefCat(row.kategoria);
          setTotalW(
            row.opakowanie_g != null && row.opakowanie_g > 0
              ? String(Math.round(row.opakowanie_g))
              : '',
          );
        }
      } catch {
        Alert.alert('Błąd', 'Nie udało się wczytać wpisu.');
      }
    })();
  }, [route.params]);

  const needKey = (): boolean => {
    if (aiCfg.apiKey.trim() === '') {
      setErr('Najpierw wklej klucz AI w Ustawieniach.');
      return true;
    }
    return false;
  };

  const pickBase64 = async (
    fromCamera: boolean,
  ): Promise<string | null> => {
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({
          quality: 0.8,
          base64: true,
          exif: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          quality: 0.8,
          base64: true,
          exif: false,
        });
    if (res.canceled || !res.assets[0]?.base64) return null;
    return res.assets[0].base64;
  };

  const askPhotoSource = (onBase64: (b64: string) => void) => {
    Alert.alert('Zdjęcie', 'Wybierz źródło:', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Aparat',
        onPress: () =>
          pickBase64(true)
            .then((b) => b && onBase64(b))
            .catch(() => setErr('Nie udało się zrobić zdjęcia.')),
      },
      {
        text: 'Galeria',
        onPress: () =>
          pickBase64(false)
            .then((b) => b && onBase64(b))
            .catch(() => setErr('Nie udało się wybrać zdjęcia.')),
      },
    ]);
  };

  /** Foto TABELI → wartości na 100 g. */
  const photoLabel = () => {
    if (needKey()) return;
    askPhotoSource(async (b64) => {
      setBusy('Odczytuję tabelę…');
      setErr(null);
      setInfo(null);
      try {
        const r = await analyzeLabel(aiCfg, b64);
        if (r.error) {
          setErr(r.error);
          return;
        }
        setName((prev) => (prev.trim() === '' ? r.nazwa : prev));
        setKcal(String(r.kcal100));
        setB(String(r.bialko100));
        setT(String(r.tluszcze100));
        setW(String(r.wegle100));
        if (r.opakowanieG) setTotalW(String(r.opakowanieG));
        const extra =
          r.opakowanieG || r.porcjaG
            ? ` (opakowanie: ${r.opakowanieG ?? '—'} g, porcja: ${r.porcjaG ?? '—'} g)`
            : '';
        setInfo(`Odczytano tabelę${extra}. Sprawdź liczby i popraw w razie potrzeby.`);
      } catch {
        setErr('Błąd analizy zdjęcia.');
      } finally {
        setBusy(null);
      }
    });
  };

  /** Foto POSIŁKU → suma → przeliczenie na 100 g. */
  const photoMeal = () => {
    if (needKey()) return;
    askPhotoSource(async (b64) => {
      setBusy('Analizuję posiłek…');
      setErr(null);
      setInfo(null);
      try {
        const r = await analyzeImage(aiCfg, b64);
        if (r.error) {
          setErr(r.error);
          return;
        }
        const totalW = r.skladniki.reduce((s, i) => s + i.waga, 0);
        if (totalW <= 0) {
          setErr('AI nie oszacowało wagi. Wpisz wartości ręcznie.');
          return;
        }
        const per100 = (v: number) => Math.round((v / totalW) * 1000) / 10;
        setName((prev) =>
          prev.trim() === '' ? r.danie || 'Danie ze zdjęcia' : prev,
        );
        setKcal(String(per100(r.kcal)));
        setB(String(per100(r.bialko)));
        setT(String(per100(r.tluszcze)));
        setW(String(per100(r.wegle)));
        setInfo(
          `Rozpoznano „${r.danie}” (ok. ${Math.round(totalW)} g) i przeliczono na 100 g. Sprawdź liczby.`,
        );
      } catch {
        setErr('Błąd analizy zdjęcia.');
      } finally {
        setBusy(null);
      }
    });
  };

  /** Lookup kodu → wypełnia formularz. */
  const lookupCode = async (raw: string) => {
    const c = raw.trim();
    if (c === '') return;
    setBusy('Szukam produktu po kodzie…');
    setErr(null);
    setInfo(null);
    try {
      const p = await productByBarcode(c);
      if (!p) {
        setErr(`Nie znaleziono kodu ${c} w Open Food Facts. Uzupełnij dane ręcznie.`);
        return;
      }
      setCode(c);
      setName((prev) => (prev.trim() === '' ? p.nazwa : prev));
      setKcal(String(p.kcal100));
      setB(String(p.bialko100));
      setT(String(p.tluszcze100));
      setW(String(p.wegle100));
      if (!photo && p.zdjecie) setPhoto(p.zdjecie);
      if (p.opakowanieG) setTotalW(String(p.opakowanieG));
      const pack = p.opakowanieG ? ` Opakowanie: ok. ${p.opakowanieG} g.` : '';
      setInfo(`Znaleziono: ${p.nazwa} (${fmtKcal(p.kcal100)} /100 g).${pack}`);
    } catch (e) {
      setErr(offErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const onScanned = (data: string) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setScanning(false);
    // Skan w kreatorze tylko UZUPEŁNIA pole kodu (bez szukania online).
    const digits = data.trim().replace(/\s+/g, '');
    setCode(digits);
    setErr(null);
    setInfo(
      `Zeskanowano kod: ${digits}. Uzupełnij resztę danych albo stuknij OK, aby pobrać je z Open Food Facts.`,
    );
    setTimeout(() => {
      scanLock.current = false;
    }, 1500);
  };

  const startScan = async () => {
    if (!camPerm?.granted) {
      const r = await requestCamPerm();
      if (!r.granted) {
        setErr('Brak dostępu do aparatu. Wpisz kod ręcznie.');
        return;
      }
    }
    setScanning(true);
  };

  const save = async () => {
    if (name.trim() === '') {
      setErr('Wpisz nazwę.');
      return;
    }
    try {
      const data = {
        nazwa: name,
        kcal100: toDouble(kcal),
        bialko100: toDouble(b),
        tluszcze100: toDouble(t),
        wegle100: toDouble(w),
        kod: code.trim() === '' ? null : code.trim(),
        zdjecie: photo,
        kategoria: defCat,
        opakowanieG: (() => {
          const n = parseFloat(totalW.replace(',', '.'));
          return Number.isFinite(n) && n > 0 && n <= 10000
            ? Math.round(n)
            : null;
        })(),
      };
      if (editId != null) await updateFavorite(editId, data);
      else await insertFavorite(data);
      navigation.goBack();
    } catch {
      setErr('Nie udało się zapisać.');
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    color: colors.text,
    backgroundColor: colors.card,
  } as const;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
      {err && (
        <View
          style={{ backgroundColor: '#ffebee', borderRadius: 10, padding: 10 }}>
          <Text style={{ color: '#b71c1c' }}>{err}</Text>
        </View>
      )}
      {info && (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 10,
            padding: 10,
            borderWidth: 1,
            borderColor: colors.primary,
          }}>
          <Text style={{ color: colors.text }}>{info}</Text>
        </View>
      )}
      {busy && (
        <View style={{ alignItems: 'center', gap: 6 }}>
          <ActivityIndicator />
          <Text style={{ color: colors.text }}>{busy}</Text>
        </View>
      )}

      {/* Sekcja 1: nazwa + wartości na 100 g */}
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
        1. Nazwa i wartości odżywcze (na 100 g)
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Nazwa *, np. Snickers"
        placeholderTextColor={colors.text + '66'}
        style={inputStyle}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, marginBottom: 4, fontSize: 13 }}>
            Kcal *
          </Text>
          <TextInput
            value={kcal}
            onChangeText={setKcal}
            keyboardType="numeric"
            style={inputStyle}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, marginBottom: 4, fontSize: 13 }}>
            Białko
          </Text>
          <TextInput
            value={b}
            onChangeText={setB}
            keyboardType="numeric"
            style={inputStyle}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, marginBottom: 4, fontSize: 13 }}>
            Tłuszcze
          </Text>
          <TextInput
            value={t}
            onChangeText={setT}
            keyboardType="numeric"
            style={inputStyle}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, marginBottom: 4, fontSize: 13 }}>
            Węgle
          </Text>
          <TextInput
            value={w}
            onChangeText={setW}
            keyboardType="numeric"
            style={inputStyle}
          />
        </View>
      </View>
      <Text style={{ color: colors.text, marginBottom: 4, fontSize: 13 }}>
        Waga całego opakowania w g / ml (opcjonalnie — do przycisku „Całość”)
      </Text>
      <TextInput
        value={totalW}
        onChangeText={setTotalW}
        placeholder="np. 500 (butelka 500 ml) albo 150 (baton)"
        placeholderTextColor={colors.text + '66'}
        keyboardType="numeric"
        style={inputStyle}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={photoLabel}
          disabled={busy != null}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: 10,
            padding: 12,
            alignItems: 'center',
            opacity: busy != null ? 0.5 : 1,
          }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            🏷️ Foto tabeli
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={photoMeal}
          disabled={busy != null}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: 10,
            padding: 12,
            alignItems: 'center',
            opacity: busy != null ? 0.5 : 1,
          }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            🍽️ Foto posiłku
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sekcja 2: kod kreskowy */}
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
        2. Kod kreskowy
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="np. 5901234567890"
          placeholderTextColor={colors.text + '66'}
          keyboardType="numeric"
          onSubmitEditing={() => lookupCode(code)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <TouchableOpacity
          onPress={() => lookupCode(code)}
          disabled={busy != null}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 10,
            paddingHorizontal: 16,
            justifyContent: 'center',
            opacity: busy != null ? 0.5 : 1,
          }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>OK</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => (scanning ? setScanning(false) : startScan())}
          style={{
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: 10,
            paddingHorizontal: 14,
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 22 }}>📷</Text>
        </TouchableOpacity>
      </View>
      <Modal
        visible={scanning}
        animationType="slide"
        onRequestClose={() => setScanning(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
            }}
            onBarcodeScanned={(r) => {
              if (r.data) onScanned(r.data);
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}>
            <View
              style={{
                width: 260,
                height: 150,
                borderWidth: 3,
                borderColor: '#fff',
                borderRadius: 12,
              }}
            />
            <Text style={{ color: '#fff', marginTop: 12, fontWeight: '600' }}>
              Nakieruj na kod kreskowy
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setScanning(false)}
            style={{
              position: 'absolute',
              bottom: 40,
              alignSelf: 'center',
              backgroundColor: '#ffffff22',
              borderWidth: 1,
              borderColor: '#fff',
              borderRadius: 24,
              paddingVertical: 12,
              paddingHorizontal: 32,
            }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
              Anuluj
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Sekcja 3: zdjęcie produktu */}
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
        3. Zdjęcie produktu
      </Text>
      {photo ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image
            source={{ uri: photo }}
            style={{ width: 80, height: 80, borderRadius: 10 }}
          />
          <TouchableOpacity onPress={() => setPhoto(null)}>
            <Text style={{ color: '#e53935', fontWeight: '700' }}>
              Usuń zdjęcie
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => choosePhoto((u) => setPhoto(u))}
          style={{
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: 10,
            padding: 12,
            alignItems: 'center',
          }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            📷 Dodaj zdjęcie
          </Text>
        </TouchableOpacity>
      )}

      {/* Sekcja 4: domyślna kategoria */}
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
        4. Co to zwykle jest?
      </Text>
      <Text style={{ color: colors.text, opacity: 0.7, fontSize: 13 }}>
        Przy dodawaniu „zjadłem” ta kategoria wybierze się sama (np. Mars →
        Przekąski). Zawsze możesz ją zmienić ręcznie.
      </Text>
      <CategoryChips value={defCat} onChange={setDefCat} />

      <TouchableOpacity
        onPress={save}
        style={{
          backgroundColor: colors.primary,
          borderRadius: 12,
          padding: 15,
          alignItems: 'center',
          marginTop: 4,
        }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
          {editId != null ? 'Zapisz zmiany' : '💾 Zapisz w bazie'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
