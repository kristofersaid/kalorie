export const CATEGORIES = [
  'Śniadanie',
  'Lunch',
  'Obiad',
  'Kolacja',
  'Przekąski',
  'Napoje',
] as const;

export const DEFAULT_KCAL_GOAL = 2000;
export const DEFAULT_PROTEIN_GOAL = 150;
export const DEFAULT_FAT_GOAL = 65;
export const DEFAULT_CARBS_GOAL = 250;

export const SOURCE_MANUAL = 'reczne';
export const SOURCE_API = 'api';
export const SOURCE_AI = 'ai';
export const SOURCE_BARCODE = 'kod';
export const SOURCE_TEMPLATE = 'szablon';

export const OFF_SEARCH_URL =
  'https://world.openfoodfacts.org/cgi/search.pl';
export const OFF_PRODUCT_URL =
  'https://world.openfoodfacts.org/api/v0/product';

export const GEMINI_MODEL = 'gemini-2.0-flash';

export const GEMINI_LABEL_PROMPT = `Jesteś ekspertem od żywienia. Na zdjęciu jest tabela wartości odżywczych (etykieta produktu spożywczego).
Odczytaj wartości W PRZELICZENIU NA 100 g (lub 100 ml). Jeśli tabela podaje wartości tylko na porcję, przelicz je na 100 g na podstawie podanej wielkości porcji.

Odpowiedz WYŁĄCZNIE czystym JSON (bez markdown, bez \`\`\`json):
{
  "nazwa_produktu": "nazwa produktu po polsku (z etykiety, np. 'Jogurt naturalny')",
  "kcal_100g": 62,
  "bialko_100g": 3.3,
  "tluszcze_100g": 3.5,
  "weglowodany_100g": 4.7,
  "porcja_g": 150,
  "opakowanie_g": 400
}

Pola porcja_g i opakowanie_g uzupełnij tylko jeśli są widoczne na etykiecie, w przeciwnym razie pomiń je lub ustaw null.
Jeśli na zdjęciu nie ma tabeli wartości odżywczych, zwróć:
{"error": "Nie rozpoznano tabeli wartości odżywczych na zdjęciu"}`;

export const GEMINI_PROMPT = `Jesteś ekspertem od żywienia. Przeanalizuj zdjęcie posiłku.
Oszacuj realistyczne porcje na podstawie wielkości talerza i proporcji.

Odpowiedz WYŁĄCZNIE czystym JSON (bez markdown, bez \`\`\`json):
{
  "danie": "Nazwa dania po polsku",
  "skladniki": [
    {
      "nazwa": "nazwa składnika",
      "waga_g": 120,
      "kcal": 180,
      "bialko_g": 14.0,
      "tluszcze_g": 13.0,
      "weglowodany_g": 1.0
    }
  ],
  "lacznie": {
    "kcal": 340,
    "bialko_g": 18.0,
    "tluszcze_g": 14.0,
    "weglowodany_g": 36.0
  }
}

Jeśli nie widzisz jedzenia, zwróć:
{"error": "Nie rozpoznano jedzenia na zdjęciu"}`;

export function sourceLabel(s: string): string {
  switch (s) {
    case SOURCE_AI:
      return 'AI';
    case SOURCE_API:
      return 'baza';
    case SOURCE_BARCODE:
      return 'kod';
    case SOURCE_TEMPLATE:
      return 'szablon';
    default:
      return 'ręcznie';
  }
}
