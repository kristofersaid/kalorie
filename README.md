# Kalorie 🥗 – wersja Expo (React Native + TypeScript)

Prywatna aplikacja do liczenia kalorii. Te same funkcje co wersja Flutter,
ale **bez instalowania Flutter ani Android Studio** – wystarczy Node.js
(masz już v24) i telefon z aplikacją **Expo Go**.

- **Expo SDK 57**, React 19, React Native 0.86, TypeScript 6.
- Dane lokalnie na telefonie (SQLite przez `expo-sqlite`).
- Internet tylko do: Gemini 1.5 Flash (zdjęcia AI) i Open Food Facts
  (wyszukiwanie + kody kreskowe). Bez sieci wszystko inne działa offline.
- Zero kont, zero logowania.

## 1. Uruchomienie deweloperskie (2 minuty)

```powershell
cd kalorie_expo
npm install          # jednorazowo (u Ciebie już wykonane ✔)
npx expo start
```

1. Na telefonie zainstaluj **Expo Go** (Sklep Play / App Store).
2. Telefon i komputer w **tej samej sieci Wi-Fi**.
3. Zeskanuj kod QR z terminala aplikacją Expo Go.
4. Aplikacja otworzy się na telefonie. Gotowe.

> Jeśli QR nie łączy (np. firmowy firewall), użyj tunelu:
> `npx expo start --tunnel`

Sprawdzenie typów w każdej chwili:

```powershell
npx tsc --noEmit
```

## 2. Pierwsze kroki w aplikacji

1. Zakładka **Ustawienia** → wklej **klucz API Gemini**
   (https://aistudio.google.com → *Get API key*).
2. Ustaw cel kcal i makro (domyślnie 2000 kcal, B 150 g, T 65 g, W 250 g).
3. Ekran główny → **+ Dodaj**.

## 3. Instalacja APK na stałe (bez Expo Go)

Expo Go wymaga działającego `npx expo start` na komputerze. Żeby mieć
samodzielną aplikację offline, zbuduj APK **w chmurze** (EAS Build –
kompilacja odbywa się na serwerach Expo, nic nie instalujesz).
Plik `eas.json` z profilem `preview` (APK) jest już przygotowany.

```powershell
npm install -g eas-cli   # u Ciebie już wykonane ✔
eas login                # darmowe konto Expo (załuż na expo.dev)
eas build -p android --profile preview
```

Po kilkunastu minutach dostaniesz link do pliku `.apk` – instalujesz na
telefonie i działa samodzielnie (internet potrzebny tylko do AI i OFF).

## 4. Struktura kodu

```
src/
├── App.tsx               # nawigacja (4 zakładki + modal + skaner + statystyki)
├── nav.ts                # typy tras
├── lib/                  # constants, format (polskie daty), off.ts, gemini.ts, csv.ts
├── db/                   # SQLite: database.ts, meals.ts, favorites.ts, templates.ts, stats.ts
├── store/useStore.ts     # ustawienia + motyw (zustand, persist w AsyncStorage)
├── components/           # CalorieRing (SVG), MacroBar, MealCard, CategorySection,
│                         # PortionPicker, CategoryChips
└── screens/              # Dashboard, AddMeal (ręcznie/szukaj/zdjęcie/etykieta), Scanner,
                          # History (kalendarz PL), Stats (wykresy), Favorites, Settings
```

## 5. Różnice względem wersji Flutter

| Temat | Flutter | Expo (to) |
|---|---|---|
| Baza | Drift (kod generowany) | `expo-sqlite`, czysty SQL, zero generowania |
| Stan | Riverpod | zustand + persist |
| Skaner | `mobile_scanner` | `expo-camera` (wbudowane skanowanie EAN + chipy „Całe opakowanie” / „1 porcja” z danych OFF) |
| Zdjęcia | `image_picker` + pakiet `google_generative_ai` | `expo-image-picker` + bezpośredni REST do Gemini |
| Wykresy | fl_chart | react-native-chart-kit |
| Kalendarz | table_calendar | react-native-calendars (locale PL) |
| CSV | `csv` + `share_plus` | własny parser + `expo-sharing` / `expo-document-picker` (pliki CSV przez `expo-file-system/legacy`) |

Prompt do Gemini, endpointy Open Food Facts i cała logika (kategorie,
źródła wpisów, statusy dnia 🟢🟡🔴, przeliczanie makro) – 1:1 jak w specyfikacji.

## 6. Najczęstsze problemy

| Problem | Rozwiązanie |
|---|---|
| QR nie łączy | ta sama sieć Wi-Fi albo `npx expo start --tunnel` |
| Aparat nie działa | testuj na fizycznym telefonie, nie na emulatorze |
| `Brak klucza API Gemini` | wklej klucz w Ustawieniach |
| Błąd wersji paczek | `npx expo install --fix` |
| Import CSV nic nie znajduje | wybierz plik `.csv` wyeksportowany z aplikacji |
