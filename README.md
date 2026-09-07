# 🥗 Kalorie

Prywatna aplikacja mobilna do liczenia kalorii — **Expo (React Native + TypeScript), SDK 57**.

Zero kont, zero logowania, zero analityki. Wszystkie dane na telefonie (SQLite).
Internet używany wyłącznie do AI (rozpoznawanie jedzenia ze zdjęć) oraz
baz produktowych: **Open Food Facts** (główna) i **USDA FoodData** (zapasowa).
Bez sieci działa wszystko inne — a wyszukiwanie i skaner najpierw sprawdzają
lokalną bazę na telefonie.

## ✨ Funkcje

| Obszar | Co potrafi |
|---|---|
| 🏠 Dashboard | Powitanie, ring kcal vs cel, słupki białko/tłuszcze/węgle, posiłki w kategoriach: Śniadanie, Lunch, Obiad, Kolacja, Przekąski, **Napoje** |
| ➕ Dodawanie | **📷 Aparat** (jedno zdjęcie → AI rozpoznaje posiłek, etykietę lub kod), **🔍 Szukaj** (baza lokalna + Open Food Facts, kody też sprawdzane lokalnie) + przycisk „Dodaj do mojej bazy”; edycja wpisów w tym samym miejscu |
| 🗄️ Baza | **Moje wpisy** (lokalnie, wszystko na 100 g): przegląd, edycja, usuwanie + **Kreator** (jeden formularz: nazwa i makro + foto tabeli/posiłku + kod kreskowy ze skanerem + zdjęcie produktu) |
| 📷 Skaner EAN | Kod kreskowy → produkt z OFF → gramatura / **całe opakowanie** / porcja; tryb **Zdjęcie AI** (jedno zdjęcie → routing kod/etykieta/posiłek); przy braku kodu: szukaj po nazwie, etykieta AI lub ręcznie |
| 🗄️ Baza | **Moje produkty i dania** (lokalnie): szybkie dodawanie z gramaturą + kreator (ręcznie / kod / etykieta AI / zdjęcie AI dania) |
| 🤖 AI | 5 dostawców do wyboru: Google Gemini, OpenAI, xAI Grok, Anthropic Claude, OpenRouter (własny klucz + model) |
| 📅 Historia | Polski kalendarz z kropkami 🟢 poniżej / 🟡 w normie / 🔴 powyżej celu, edycja i usuwanie wpisów |
| 📊 Statystyki | Wykres kcal 7/14/30 dni, średnie makro, top 5 produktów |
| ⭐ Ulubione | Produkty z gwiazdkami (ze zdjęciami) + **szablony posiłków złożonych** (np. „Moja owsianka”) |
| 🏃 Aktywność | Treningi (typ + czas + dystans → kcal z MET i wagi) albo same kcal; bilans netto na dashboardzie, historii i statystykach |
| 🤖 Asystent AI | Czat z AI widzącym Twój dzień (posiłki, cele, godzina) + przycisk „Co mogę zjeść?” z propozycją następnego posiłku |
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
├── App.tsx            # nawigacja: 5 zakładek + modale + skaner + statystyki
├── lib/               # ai.ts (5 dostawców + klasyfikator zdjęć), off.ts, csv, format, photo
├── db/                # expo-sqlite: meals, favorites, templates, stats
├── store/             # zustand + persist (cele, klucze AI, motyw)
├── components/        # ring kcal (SVG), słupki makro, karty, porcje, chipy,
│                      # SmartCapture, ProductForm, TemplateForm
└── screens/           # 9 ekranów
```

## 🔒 Prywatność

- Posiłki, ulubione, szablony → SQLite na urządzeniu. Ustawienia i klucze → AsyncStorage.
- Sieć: tylko `generativelanguage.googleapis.com` / API wybranego dostawcy AI
  (zdjęcia) oraz `world.openfoodfacts.org` (produkty).
- Poza telefon nic nie wychodzi. Eksport historii do CSV w Ustawieniach.

## 🛠 Wymagania

Node.js 20+, telefon z Expo Go (dev) lub APK z EAS (docelowo).
