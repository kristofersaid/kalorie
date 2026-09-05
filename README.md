# 🥗 Kalorie

Prywatna aplikacja mobilna do liczenia kalorii — **Expo (React Native + TypeScript), SDK 57**.

Zero kont, zero logowania, zero analityki. Wszystkie dane na telefonie (SQLite).
Internet używany wyłącznie do AI (rozpoznawanie jedzenia ze zdjęć) oraz
Open Food Facts (wyszukiwanie produktów i kody kreskowe).

## ✨ Funkcje

| Obszar | Co potrafi |
|---|---|
| 🏠 Dashboard | Powitanie, ring kcal vs cel, słupki białko/tłuszcze/węgle, posiłki w kategoriach: Śniadanie, Lunch, Obiad, Kolacja, Przekąski, **Napoje** |
| ➕ Dodawanie | 4 sposoby: **ręcznie** (ze zdjęciem), **wyszukiwarka** (baza lokalna + Open Food Facts), **zdjęcie posiłku** (AI), **zdjęcie etykiety** (AI odczytuje tabelę na 100 g) |
| 📷 Skaner EAN | Kod kreskowy → produkt z OFF → gramatura / **całe opakowanie** / porcja; przy braku kodu: szukaj po nazwie, etykieta AI lub ręcznie |
| 🤖 AI | 5 dostawców do wyboru: Google Gemini, OpenAI, xAI Grok, Anthropic Claude, OpenRouter (własny klucz + model) |
| 📅 Historia | Polski kalendarz z kropkami 🟢 poniżej / 🟡 w normie / 🔴 powyżej celu, edycja i usuwanie wpisów |
| 📊 Statystyki | Wykres kcal 7/14/30 dni, średnie makro, top 5 produktów |
| ⭐ Ulubione | Produkty z gwiazdkami (ze zdjęciami) + **szablony posiłków złożonych** (np. „Moja owsianka”) |
| ⚙️ Ustawienia | Cele kcal/makro, klucz AI, model AI, motyw, eksport/import CSV, test połączenia, czyszczenie danych |

## 🚀 Szybki start (Expo Go)

```powershell
npm install
npx expo start
```

Zeskanuj QR aplikacją **Expo Go** (telefon i komputer w tej samej sieci Wi-Fi
— inaczej `npx expo start --tunnel`). W aplikacji: Ustawienia → dostawca AI →
klucz API → liczysz kalorie.

```powershell
npx tsc --noEmit   # kontrola typów
```

## 📦 Build APK (chmura EAS)

```powershell
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

Gotowy `.apk` instalujesz na wierzch poprzedniego (dane zostają).
Profil `preview` daje APK; `production` daje `.aab` do Sklepu Play.

## 🗂 Struktura

```
src/
├── App.tsx            # nawigacja: 4 zakładki + modal + skaner + statystyki
├── lib/               # ai.ts (5 dostawców), off.ts, gemini prompt, csv, format, photo
├── db/                # expo-sqlite: meals, favorites, templates, stats
├── store/             # zustand + persist (cele, klucze AI, motyw)
├── components/        # ring kcal (SVG), słupki makro, karty, porcje, chipy
└── screens/           # 7 ekranów
```

## 🔒 Prywatność

- Posiłki, ulubione, szablony → SQLite na urządzeniu. Ustawienia i klucze → AsyncStorage.
- Sieć: tylko `generativelanguage.googleapis.com` / API wybranego dostawcy AI
  (zdjęcia) oraz `world.openfoodfacts.org` (produkty).
- Poza telefon nic nie wychodzi. Eksport historii do CSV w Ustawieniach.

## 🛠 Wymagania

Node.js 20+, telefon z Expo Go (dev) lub APK z EAS (docelowo).
